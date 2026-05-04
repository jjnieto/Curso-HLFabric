#!/usr/bin/env bash
# 04-deploy-chaincode.sh
# Empaqueta, instala, aprueba y commitea el chaincode signchain.

source "$(dirname "$0")/common.sh"

require_cmd peer
require_cmd go

if [ -z "${FABRIC_CFG_PATH:-}" ]; then
    if [ -d "$SIGNCHAIN_ROOT/../../config" ]; then
        export FABRIC_CFG_PATH="$(cd "$SIGNCHAIN_ROOT/../../config" && pwd)"
    elif [ -d "$HOME/practica01/config" ]; then
        export FABRIC_CFG_PATH="$HOME/practica01/config"
    elif [ -d "$HOME/fabric/fabric-samples/config" ]; then
        export FABRIC_CFG_PATH="$HOME/fabric/fabric-samples/config"
    else
        log_err "No encuentro core.yaml. Exporta FABRIC_CFG_PATH antes de ejecutar."
        exit 1
    fi
fi

CC_DIR="$CHAINCODE_DIR/signchain"
PACKAGE_FILE="$CHAINCODE_DIR/signchain.tar.gz"

log_step "Vendoring de las dependencias del chaincode"
(cd "$CC_DIR" && go mod tidy && go mod vendor)
log_ok "go mod tidy + vendor completado"

log_step "Empaquetando el chaincode"
peer lifecycle chaincode package "$PACKAGE_FILE" \
    --path "$CC_DIR" \
    --lang golang \
    --label "$CHAINCODE_LABEL"
log_ok "Paquete: $PACKAGE_FILE"

log_step "Instalando el chaincode en peer0.cliente"
set_org_env_cliente
peer lifecycle chaincode install "$PACKAGE_FILE"

log_step "Instalando el chaincode en peer0.proveedor"
set_org_env_proveedor
peer lifecycle chaincode install "$PACKAGE_FILE"

log_step "Obteniendo Package ID"
set_org_env_cliente
PACKAGE_ID="$(peer lifecycle chaincode queryinstalled \
    | awk -v label="$CHAINCODE_LABEL" '$0 ~ label {print $3}' \
    | sed 's/,$//')"
if [ -z "$PACKAGE_ID" ]; then
    log_err "No he podido obtener el package ID. Salida de queryinstalled:"
    peer lifecycle chaincode queryinstalled
    exit 1
fi
log_ok "Package ID: $PACKAGE_ID"

approve_for_org() {
    local org_label="$1"
    log_step "Approve como $org_label"
    peer lifecycle chaincode approveformyorg \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
        --package-id "$PACKAGE_ID" --sequence "$CHAINCODE_SEQUENCE" \
        --signature-policy "$SIGNATURE_POLICY"
}

set_org_env_cliente
approve_for_org ClienteMSP

set_org_env_proveedor
approve_for_org ProveedorMSP

log_step "Comprobando readiness"
peer lifecycle chaincode checkcommitreadiness \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
    --sequence "$CHAINCODE_SEQUENCE" \
    --signature-policy "$SIGNATURE_POLICY" \
    --output json

log_step "Commit del chaincode"
set_org_env_cliente
peer lifecycle chaincode commit \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CHANNEL_NAME" \
    --name "$CHAINCODE_NAME" --version "$CHAINCODE_VERSION" \
    --sequence "$CHAINCODE_SEQUENCE" \
    --signature-policy "$SIGNATURE_POLICY" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER_CLIENTE_TLS" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER_PROVEEDOR_TLS"

log_step "Verificación final"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CHAINCODE_NAME"

log_step "Chaincode signchain commiteado y operativo"
log_info "Siguiente: cd application && npm install && npm run check"
