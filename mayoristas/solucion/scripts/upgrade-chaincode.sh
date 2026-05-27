#!/usr/bin/env bash
# upgrade-chaincode.sh
# Actualiza un chaincode aprovechando el lifecycle de Fabric (sin redesplegar
# los demás). Detecta la versión y secuencia actuales en el canal y las
# incrementa automáticamente.
#
# Uso:
#   bash scripts/upgrade-chaincode.sh cc-producto
#   bash scripts/upgrade-chaincode.sh cc-garantia
#   bash scripts/upgrade-chaincode.sh cc-pedido
#
# Variables opcionales:
#   NEW_VERSION=1.2    (por defecto bumpa el minor: 1.0 → 1.1)
#   NEW_SEQUENCE=3     (por defecto: secuencia commiteada + 1)

source "$(dirname "$0")/common.sh"

require_cmd peer
require_cmd go

resolve_fabric_cfg_path

CC_NAME="${1:-}"
if [ -z "$CC_NAME" ]; then
    log_err "Uso: bash scripts/upgrade-chaincode.sh <cc-name>"
    log_info "Chaincodes disponibles: cc-producto, cc-garantia, cc-pedido"
    exit 1
fi

# ── Resolver canales y política según el chaincode ──────────────
case "$CC_NAME" in
    cc-producto)
        CHANNELS=("$CANAL_TRAZABILIDAD")
        POLICY="$POLICY_PRODUCTO"
        ORGS=("fabricante" "mayorista" "minorista")
        ;;
    cc-garantia)
        CHANNELS=("$CANAL_TRAZABILIDAD")
        POLICY="$POLICY_GARANTIA"
        ORGS=("fabricante" "mayorista" "minorista")
        ;;
    cc-pedido)
        # cc-pedido vive en 2 canales con políticas distintas
        CHANNELS=("$CANAL_MAYORISTA" "$CANAL_MINORISTA")
        ORGS=("fabricante" "mayorista" "minorista")
        ;;
    *)
        log_err "Chaincode desconocido: $CC_NAME"
        log_info "Disponibles: cc-producto, cc-garantia, cc-pedido"
        exit 1
        ;;
esac

# ── Detectar versión y secuencia actuales ───────────────────────
# Usamos el canal[0] como referencia (en el caso de cc-pedido, ambos
# canales deberían estar a la misma secuencia tras un primer deploy
# coherente; si difieren, se gestionan en bucle más abajo).
set_org_env_fabricante
REF_CHANNEL="${CHANNELS[0]}"
log_step "Consultando estado actual de $CC_NAME en $REF_CHANNEL"

CURRENT=$(peer lifecycle chaincode querycommitted \
    --channelID "$REF_CHANNEL" --name "$CC_NAME" --output json 2>/dev/null || true)

if [ -z "$CURRENT" ]; then
    log_err "$CC_NAME no está commiteado en $REF_CHANNEL — usa 05-deploy-chaincodes.sh para el primer despliegue"
    exit 1
fi

CURRENT_VERSION=$(echo "$CURRENT" | grep -oP '"version":\s*"\K[^"]+' | head -1)
CURRENT_SEQUENCE=$(echo "$CURRENT" | grep -oP '"sequence":\s*\K[0-9]+' | head -1)

log_info "Versión actual: $CURRENT_VERSION | Secuencia actual: $CURRENT_SEQUENCE"

# Bump por defecto: minor +1 (1.0 → 1.1, 1.5 → 1.6)
if [ -z "${NEW_VERSION:-}" ]; then
    MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
    MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
    NEW_VERSION="${MAJOR}.$((MINOR+1))"
fi
NEW_SEQUENCE="${NEW_SEQUENCE:-$((CURRENT_SEQUENCE+1))}"
NEW_LABEL="${CC_NAME}_${NEW_VERSION}"

log_step "Nueva versión: $NEW_VERSION | Nueva secuencia: $NEW_SEQUENCE"

# ── 1. Vendor + empaquetado ──────────────────────────────────────
CC_DIR="$CHAINCODE_DIR/$CC_NAME"
PKG_FILE="$CHAINCODE_DIR/${CC_NAME}-${NEW_VERSION}.tar.gz"

log_step "Vendoring $CC_NAME"
(cd "$CC_DIR" && go mod tidy && go mod vendor)

log_step "Empaquetando $CC_NAME v$NEW_VERSION"
peer lifecycle chaincode package "$PKG_FILE" \
    --path "$CC_DIR" --lang golang --label "$NEW_LABEL"
log_ok "Paquete: $PKG_FILE"

# ── 2. Instalar en cada peer ─────────────────────────────────────
for org in "${ORGS[@]}"; do
    log_step "Instalando $NEW_LABEL en peer0.$org"
    "set_org_env_$org"
    peer lifecycle chaincode install "$PKG_FILE"
done

# ── 3. Obtener Package ID del nuevo paquete ─────────────────────
set_org_env_fabricante
PKG_ID=$(peer lifecycle chaincode queryinstalled \
    | awk -v label="$NEW_LABEL" '$0 ~ label {print $3}' \
    | sed 's/,$//')
if [ -z "$PKG_ID" ]; then
    log_err "No encuentro el package ID para $NEW_LABEL"
    peer lifecycle chaincode queryinstalled
    exit 1
fi
log_ok "Package ID: $PKG_ID"

# ── 4. Aprobar + commitear en cada canal ────────────────────────
peer_addresses_for_channel() {
    # Devuelve los flags --peerAddresses/--tlsRootCertFiles para los peers
    # endosantes del canal indicado.
    local channel="$1"
    case "$channel" in
        "$CANAL_TRAZABILIDAD")
            echo "--peerAddresses localhost:7051  --tlsRootCertFiles $PEER_FABRICANTE_TLS \
                  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MAYORISTA_TLS \
                  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_MINORISTA_TLS"
            ;;
        "$CANAL_MAYORISTA")
            echo "--peerAddresses localhost:7051 --tlsRootCertFiles $PEER_FABRICANTE_TLS \
                  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_MAYORISTA_TLS"
            ;;
        "$CANAL_MINORISTA")
            echo "--peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MAYORISTA_TLS \
                  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_MINORISTA_TLS"
            ;;
    esac
}

orgs_for_channel() {
    local channel="$1"
    case "$channel" in
        "$CANAL_TRAZABILIDAD") echo "fabricante mayorista minorista" ;;
        "$CANAL_MAYORISTA")    echo "fabricante mayorista" ;;
        "$CANAL_MINORISTA")    echo "mayorista minorista" ;;
    esac
}

policy_for_channel() {
    local channel="$1"
    case "$CC_NAME" in
        cc-producto) echo "$POLICY_PRODUCTO" ;;
        cc-garantia) echo "$POLICY_GARANTIA" ;;
        cc-pedido)
            if [ "$channel" = "$CANAL_MAYORISTA" ]; then
                echo "$POLICY_PEDIDO_MAYORISTA"
            else
                echo "$POLICY_PEDIDO_MINORISTA"
            fi
            ;;
    esac
}

for channel in "${CHANNELS[@]}"; do
    log_step "Procesando canal: $channel"
    POLICY=$(policy_for_channel "$channel")

    for org in $(orgs_for_channel "$channel"); do
        log_step "Approve como ${org}MSP"
        "set_org_env_$org"
        peer lifecycle chaincode approveformyorg \
            -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
            --tls --cafile "$ORDERER_TLS_CA" \
            --channelID "$channel" \
            --name "$CC_NAME" --version "$NEW_VERSION" \
            --package-id "$PKG_ID" --sequence "$NEW_SEQUENCE" \
            --signature-policy "$POLICY"
        log_ok "Approve ${org}MSP"
    done

    log_step "Commit $CC_NAME v$NEW_VERSION en $channel"
    set_org_env_fabricante
    # shellcheck disable=SC2046
    peer lifecycle chaincode commit \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        --channelID "$channel" \
        --name "$CC_NAME" --version "$NEW_VERSION" \
        --sequence "$NEW_SEQUENCE" \
        --signature-policy "$POLICY" \
        $(peer_addresses_for_channel "$channel")
    log_ok "$CC_NAME v$NEW_VERSION commiteado en $channel"
done

# ── 5. Verificación ──────────────────────────────────────────────
log_step "Verificación final"
set_org_env_fabricante
for channel in "${CHANNELS[@]}"; do
    log_info "$channel:"
    peer lifecycle chaincode querycommitted --channelID "$channel" --name "$CC_NAME"
done

log_step "$CC_NAME actualizado a v$NEW_VERSION (sequence $NEW_SEQUENCE)"
