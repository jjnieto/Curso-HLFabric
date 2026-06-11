#!/usr/bin/env bash
# deploy-chaincode.sh — Empaqueta, instala, aprueba y commitea fidelitypoints,
# y ejecuta InitLedger para crear el TokenInfo inicial.
#
# Para re-deploys posteriores, exporta CHAINCODE_VERSION y CHAINCODE_SEQUENCE:
#   CHAINCODE_VERSION=1.1 CHAINCODE_SEQUENCE=2 bash scripts/deploy-chaincode.sh

source "$(dirname "$0")/common.sh"

require_cmd peer
require_cmd go
require_cmd docker
ensure_fabric_cfg_path

CC_DIR="$CHAINCODE_DIR/chaincode-go"
PACKAGE_FILE="$PROJECT_DIR/${CHAINCODE_NAME}.tar.gz"

log_step "1/7 Vendoring de las dependencias del chaincode"
(cd "$CC_DIR" && go mod tidy && go mod vendor)
log_ok "go mod tidy + vendor completado"

log_step "2/7 Empaquetando $CHAINCODE_LABEL"
peer lifecycle chaincode package "$PACKAGE_FILE" \
    --path "$CC_DIR" \
    --lang golang \
    --label "$CHAINCODE_LABEL"
log_ok "Paquete: $PACKAGE_FILE"

log_step "3/7 Instalando en peer0.hotel"
set_org_env_hotel
peer lifecycle chaincode install "$PACKAGE_FILE"

log_step "4/7 Instalando en peer0.cafeteria"
set_org_env_cafeteria
peer lifecycle chaincode install "$PACKAGE_FILE"

log_step "5/7 Obteniendo Package ID"
PACKAGE_ID="$(peer lifecycle chaincode queryinstalled \
    | awk -v label="$CHAINCODE_LABEL" '$0 ~ label {print $3}' \
    | sed 's/,$//' \
    | head -n 1)"
if [ -z "$PACKAGE_ID" ]; then
    log_err "No he podido obtener el package ID. Salida de queryinstalled:"
    peer lifecycle chaincode queryinstalled
    exit 1
fi
log_ok "Package ID: $PACKAGE_ID"

approve_for_org() {
    local org_label="$1"
    log_step "Approve como $org_label (sequence $CHAINCODE_SEQUENCE)"
    peer lifecycle chaincode approveformyorg \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
        --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE"
}

log_step "6/7 Aprobando en ambas orgs"
set_org_env_cafeteria
approve_for_org CafeteriaMSP
set_org_env_hotel
approve_for_org HotelMSP

log_step "Comprobando readiness"
peer lifecycle chaincode checkcommitreadiness \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
    --sequence "$CHAINCODE_SEQUENCE" --output json

log_step "7/7 Commit y InitLedger"
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
    --sequence "$CHAINCODE_SEQUENCE" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER_HOTEL_TLS" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER_CAFE_TLS"

log_step "Verificación"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME"

if [ "$CHAINCODE_SEQUENCE" -eq 1 ]; then
    log_step "Inicializando token (InitLedger)"
    peer chaincode invoke \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        -C "$CHANNEL_NAME" -n "$CHAINCODE_NAME" \
        --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER_HOTEL_TLS" \
        --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER_CAFE_TLS" \
        -c '{"function":"InitLedger","Args":[]}'
else
    log_info "Re-deploy con sequence > 1: omito InitLedger (el token ya estaba inicializado)."
fi

log_step "Chaincode $CHAINCODE_NAME commiteado y operativo"
log_info ""
log_info "Siguiente: cd application && node hotel-app.js  (o cafeteria-app.js)"

rm -f "$PACKAGE_FILE"
