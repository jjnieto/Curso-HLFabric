#!/usr/bin/env bash
# 05-deploy-chaincodes.sh
# Empaqueta, instala, aprueba y commitea los 3 chaincodes en sus canales:
#   cc-producto  → canal-trazabilidad  (Fabricante, Mayorista, Minorista)
#   cc-garantia  → canal-trazabilidad  (Fabricante, Mayorista, Minorista)
#   cc-pedido    → canal-mayorista     (Fabricante, Mayorista)
#   cc-pedido    → canal-minorista     (Mayorista, Minorista)

source "$(dirname "$0")/common.sh"

require_cmd peer
require_cmd go

resolve_fabric_cfg_path

# ── 1. Vendor + empaquetado ──────────────────────────────────────
package_chaincode() {
    local name="$1" label="$2"
    local cc_dir="$CHAINCODE_DIR/$name"
    local pkg="$CHAINCODE_DIR/$name.tar.gz"

    log_step "Vendoring $name"
    (cd "$cc_dir" && go mod tidy && go mod vendor)

    log_step "Empaquetando $name"
    peer lifecycle chaincode package "$pkg" \
        --path "$cc_dir" \
        --lang golang \
        --label "$label"
    log_ok "Paquete: $pkg"
}

package_chaincode cc-producto "$CC_PRODUCTO_LABEL"
package_chaincode cc-garantia "$CC_GARANTIA_LABEL"
package_chaincode cc-pedido   "$CC_PEDIDO_LABEL"

# ── 2. Instalar los 3 paquetes en los 3 peers ───────────────────
install_on_peer() {
    local org_label="$1" pkg="$2"
    log_step "Instalando $(basename "$pkg") en $org_label"
    peer lifecycle chaincode install "$pkg"
}

log_step "Instalando chaincodes en peer0.fabricante"
set_org_env_fabricante
install_on_peer FabricanteMSP "$CHAINCODE_DIR/cc-producto.tar.gz"
install_on_peer FabricanteMSP "$CHAINCODE_DIR/cc-garantia.tar.gz"
install_on_peer FabricanteMSP "$CHAINCODE_DIR/cc-pedido.tar.gz"

log_step "Instalando chaincodes en peer0.mayorista"
set_org_env_mayorista
install_on_peer MayoristaMSP "$CHAINCODE_DIR/cc-producto.tar.gz"
install_on_peer MayoristaMSP "$CHAINCODE_DIR/cc-garantia.tar.gz"
install_on_peer MayoristaMSP "$CHAINCODE_DIR/cc-pedido.tar.gz"

log_step "Instalando chaincodes en peer0.minorista"
set_org_env_minorista
install_on_peer MinoristaMSP "$CHAINCODE_DIR/cc-producto.tar.gz"
install_on_peer MinoristaMSP "$CHAINCODE_DIR/cc-garantia.tar.gz"
install_on_peer MinoristaMSP "$CHAINCODE_DIR/cc-pedido.tar.gz"

# ── 3. Obtener Package IDs ──────────────────────────────────────
get_package_id() {
    local label="$1"
    set_org_env_fabricante
    local pid
    pid="$(peer lifecycle chaincode queryinstalled \
        | awk -v label="$label" '$0 ~ label {print $3}' \
        | sed 's/,$//')"
    if [ -z "$pid" ]; then
        log_err "No encuentro el package ID para $label"
        peer lifecycle chaincode queryinstalled
        exit 1
    fi
    echo "$pid"
}

PKGID_PRODUCTO="$(get_package_id "$CC_PRODUCTO_LABEL")"
log_ok "cc-producto Package ID: $PKGID_PRODUCTO"

PKGID_GARANTIA="$(get_package_id "$CC_GARANTIA_LABEL")"
log_ok "cc-garantia Package ID: $PKGID_GARANTIA"

PKGID_PEDIDO="$(get_package_id "$CC_PEDIDO_LABEL")"
log_ok "cc-pedido Package ID: $PKGID_PEDIDO"

# ── Helper: approve + commit ─────────────────────────────────────
approve() {
    local channel="$1" cc_name="$2" cc_version="$3" pkg_id="$4" sequence="$5" policy="$6"
    peer lifecycle chaincode approveformyorg \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        --channelID "$channel" \
        --name "$cc_name" --version "$cc_version" \
        --package-id "$pkg_id" --sequence "$sequence" \
        --signature-policy "$policy"
}

# ── 4. cc-producto en canal-trazabilidad ─────────────────────────
log_step "Aprobando cc-producto (canal-trazabilidad)"

set_org_env_fabricante
approve "$CANAL_TRAZABILIDAD" "$CC_PRODUCTO_NAME" "$CC_PRODUCTO_VERSION" \
    "$PKGID_PRODUCTO" "$CC_PRODUCTO_SEQUENCE" "$POLICY_PRODUCTO"
log_ok "Approve FabricanteMSP"

set_org_env_mayorista
approve "$CANAL_TRAZABILIDAD" "$CC_PRODUCTO_NAME" "$CC_PRODUCTO_VERSION" \
    "$PKGID_PRODUCTO" "$CC_PRODUCTO_SEQUENCE" "$POLICY_PRODUCTO"
log_ok "Approve MayoristaMSP"

set_org_env_minorista
approve "$CANAL_TRAZABILIDAD" "$CC_PRODUCTO_NAME" "$CC_PRODUCTO_VERSION" \
    "$PKGID_PRODUCTO" "$CC_PRODUCTO_SEQUENCE" "$POLICY_PRODUCTO"
log_ok "Approve MinoristaMSP"

log_step "Commit cc-producto"
set_org_env_fabricante
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CANAL_TRAZABILIDAD" \
    --name "$CC_PRODUCTO_NAME" --version "$CC_PRODUCTO_VERSION" \
    --sequence "$CC_PRODUCTO_SEQUENCE" \
    --signature-policy "$POLICY_PRODUCTO" \
    --peerAddresses localhost:7051  --tlsRootCertFiles "$PEER_FABRICANTE_TLS" \
    --peerAddresses localhost:9051  --tlsRootCertFiles "$PEER_MAYORISTA_TLS" \
    --peerAddresses localhost:11051 --tlsRootCertFiles "$PEER_MINORISTA_TLS"
log_ok "cc-producto commiteado en $CANAL_TRAZABILIDAD"

# ── 5. cc-garantia en canal-trazabilidad ─────────────────────────
log_step "Aprobando cc-garantia (canal-trazabilidad)"

set_org_env_fabricante
approve "$CANAL_TRAZABILIDAD" "$CC_GARANTIA_NAME" "$CC_GARANTIA_VERSION" \
    "$PKGID_GARANTIA" "$CC_GARANTIA_SEQUENCE" "$POLICY_GARANTIA"
log_ok "Approve FabricanteMSP"

set_org_env_mayorista
approve "$CANAL_TRAZABILIDAD" "$CC_GARANTIA_NAME" "$CC_GARANTIA_VERSION" \
    "$PKGID_GARANTIA" "$CC_GARANTIA_SEQUENCE" "$POLICY_GARANTIA"
log_ok "Approve MayoristaMSP"

set_org_env_minorista
approve "$CANAL_TRAZABILIDAD" "$CC_GARANTIA_NAME" "$CC_GARANTIA_VERSION" \
    "$PKGID_GARANTIA" "$CC_GARANTIA_SEQUENCE" "$POLICY_GARANTIA"
log_ok "Approve MinoristaMSP"

log_step "Commit cc-garantia"
set_org_env_fabricante
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CANAL_TRAZABILIDAD" \
    --name "$CC_GARANTIA_NAME" --version "$CC_GARANTIA_VERSION" \
    --sequence "$CC_GARANTIA_SEQUENCE" \
    --signature-policy "$POLICY_GARANTIA" \
    --peerAddresses localhost:7051  --tlsRootCertFiles "$PEER_FABRICANTE_TLS" \
    --peerAddresses localhost:9051  --tlsRootCertFiles "$PEER_MAYORISTA_TLS" \
    --peerAddresses localhost:11051 --tlsRootCertFiles "$PEER_MINORISTA_TLS"
log_ok "cc-garantia commiteado en $CANAL_TRAZABILIDAD"

# ── 6. cc-pedido en canal-mayorista ──────────────────────────────
log_step "Aprobando cc-pedido (canal-mayorista)"

set_org_env_fabricante
approve "$CANAL_MAYORISTA" "$CC_PEDIDO_NAME" "$CC_PEDIDO_VERSION" \
    "$PKGID_PEDIDO" "$CC_PEDIDO_SEQUENCE" "$POLICY_PEDIDO_MAYORISTA"
log_ok "Approve FabricanteMSP"

set_org_env_mayorista
approve "$CANAL_MAYORISTA" "$CC_PEDIDO_NAME" "$CC_PEDIDO_VERSION" \
    "$PKGID_PEDIDO" "$CC_PEDIDO_SEQUENCE" "$POLICY_PEDIDO_MAYORISTA"
log_ok "Approve MayoristaMSP"

log_step "Commit cc-pedido en canal-mayorista"
set_org_env_fabricante
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CANAL_MAYORISTA" \
    --name "$CC_PEDIDO_NAME" --version "$CC_PEDIDO_VERSION" \
    --sequence "$CC_PEDIDO_SEQUENCE" \
    --signature-policy "$POLICY_PEDIDO_MAYORISTA" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER_FABRICANTE_TLS" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER_MAYORISTA_TLS"
log_ok "cc-pedido commiteado en $CANAL_MAYORISTA"

# ── 7. cc-pedido en canal-minorista ──────────────────────────────
log_step "Aprobando cc-pedido (canal-minorista)"

set_org_env_mayorista
approve "$CANAL_MINORISTA" "$CC_PEDIDO_NAME" "$CC_PEDIDO_VERSION" \
    "$PKGID_PEDIDO" "$CC_PEDIDO_SEQUENCE" "$POLICY_PEDIDO_MINORISTA"
log_ok "Approve MayoristaMSP"

set_org_env_minorista
approve "$CANAL_MINORISTA" "$CC_PEDIDO_NAME" "$CC_PEDIDO_VERSION" \
    "$PKGID_PEDIDO" "$CC_PEDIDO_SEQUENCE" "$POLICY_PEDIDO_MINORISTA"
log_ok "Approve MinoristaMSP"

log_step "Commit cc-pedido en canal-minorista"
set_org_env_mayorista
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CANAL_MINORISTA" \
    --name "$CC_PEDIDO_NAME" --version "$CC_PEDIDO_VERSION" \
    --sequence "$CC_PEDIDO_SEQUENCE" \
    --signature-policy "$POLICY_PEDIDO_MINORISTA" \
    --peerAddresses localhost:9051  --tlsRootCertFiles "$PEER_MAYORISTA_TLS" \
    --peerAddresses localhost:11051 --tlsRootCertFiles "$PEER_MINORISTA_TLS"
log_ok "cc-pedido commiteado en $CANAL_MINORISTA"

# ── 8. Verificación final ────────────────────────────────────────
log_step "Verificación de chaincodes commiteados"

set_org_env_fabricante
log_info "$CANAL_TRAZABILIDAD:"
peer lifecycle chaincode querycommitted --channelID "$CANAL_TRAZABILIDAD"

log_info "$CANAL_MAYORISTA:"
peer lifecycle chaincode querycommitted --channelID "$CANAL_MAYORISTA"

set_org_env_minorista
log_info "$CANAL_MINORISTA:"
peer lifecycle chaincode querycommitted --channelID "$CANAL_MINORISTA"

log_step "Todos los chaincodes desplegados y operativos"
