#!/usr/bin/env bash
# Variables y funciones comunes para todos los scripts.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
export SIGNCHAIN_ROOT="$(cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd)"
export NETWORK_DIR="$SIGNCHAIN_ROOT/network"
export CHAINCODE_DIR="$SIGNCHAIN_ROOT/chaincode"

CHANNEL_NAME="signchain-channel"
CHAINCODE_NAME="signchain"
# Para un re-deploy, exporta CHAINCODE_VERSION y CHAINCODE_SEQUENCE distintos
# antes de ejecutar 04-deploy-chaincode.sh, p. ej.:
#   CHAINCODE_VERSION=1.1 CHAINCODE_SEQUENCE=2 bash scripts/04-deploy-chaincode.sh
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_LABEL="signchain_${CHAINCODE_VERSION}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
SIGNATURE_POLICY="AND('ClienteMSP.peer','ProveedorMSP.peer')"

ORDERER_HOST="orderer.signchain.com"
ORDERER_PORT="7050"
ORDERER_ADMIN_PORT="7053"

CLIENTE_DOMAIN="cliente.signchain.com"
PROVEEDOR_DOMAIN="proveedor.signchain.com"
ORDERER_DOMAIN="signchain.com"

ORG_DIR_CLIENTE="$NETWORK_DIR/organizations/peerOrganizations/$CLIENTE_DOMAIN"
ORG_DIR_PROVEEDOR="$NETWORK_DIR/organizations/peerOrganizations/$PROVEEDOR_DOMAIN"
ORG_DIR_ORDERER="$NETWORK_DIR/organizations/ordererOrganizations/$ORDERER_DOMAIN"

ORDERER_TLS_CA="$ORG_DIR_ORDERER/orderers/orderer.signchain.com/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="$ORG_DIR_ORDERER/orderers/orderer.signchain.com/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="$ORG_DIR_ORDERER/orderers/orderer.signchain.com/tls/server.key"

PEER_CLIENTE_TLS="$ORG_DIR_CLIENTE/peers/peer0.cliente.signchain.com/tls/ca.crt"
PEER_PROVEEDOR_TLS="$ORG_DIR_PROVEEDOR/peers/peer0.proveedor.signchain.com/tls/ca.crt"

ADMIN_CLIENTE_MSP="$ORG_DIR_CLIENTE/users/Admin@$CLIENTE_DOMAIN/msp"
ADMIN_PROVEEDOR_MSP="$ORG_DIR_PROVEEDOR/users/Admin@$PROVEEDOR_DOMAIN/msp"

color_red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
color_green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
color_cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }
color_dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

log_step() { color_cyan "==> $*"; }
log_ok()   { color_green "  [OK] $*"; }
log_err()  { color_red "  [ERR] $*"; }
log_info() { color_dim "  $*"; }

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_err "Falta el comando '$1' en el PATH."
        log_info "Instala los binarios de Fabric o ajusta el PATH."
        exit 1
    fi
}

set_org_env_cliente() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=ClienteMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_CLIENTE_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_CLIENTE_MSP"
    export CORE_PEER_ADDRESS=localhost:7051
}

set_org_env_proveedor() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=ProveedorMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_PROVEEDOR_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_PROVEEDOR_MSP"
    export CORE_PEER_ADDRESS=localhost:9051
}
