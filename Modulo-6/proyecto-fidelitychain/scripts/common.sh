#!/usr/bin/env bash
# Variables y helpers compartidos por los scripts del proyecto FidelityChain.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
export PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd)"
export NETWORK_DIR="$PROJECT_DIR/network"
export CHAINCODE_DIR="$PROJECT_DIR/chaincode"

# Canal y chaincode
CHANNEL_NAME="fidelity-channel"
CHAINCODE_NAME="fidelitypoints"
# Para re-deploys, exporta CHAINCODE_VERSION y CHAINCODE_SEQUENCE distintos:
#   CHAINCODE_VERSION=1.1 CHAINCODE_SEQUENCE=2 bash scripts/deploy-chaincode.sh
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"

# Endpoints
ORDERER_HOST="orderer.fidelitychain.com"
ORDERER_PORT="7050"
ORDERER_ADMIN_PORT="7053"

HOTEL_DOMAIN="hotel.fidelitychain.com"
CAFE_DOMAIN="cafeteria.fidelitychain.com"
ORDERER_DOMAIN="fidelitychain.com"

CRYPTO_DIR="$NETWORK_DIR/crypto-config"
ORG_DIR_HOTEL="$CRYPTO_DIR/peerOrganizations/$HOTEL_DOMAIN"
ORG_DIR_CAFE="$CRYPTO_DIR/peerOrganizations/$CAFE_DOMAIN"
ORG_DIR_ORDERER="$CRYPTO_DIR/ordererOrganizations/$ORDERER_DOMAIN"

ORDERER_TLS_CA="$ORG_DIR_ORDERER/orderers/orderer.fidelitychain.com/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="$ORG_DIR_ORDERER/orderers/orderer.fidelitychain.com/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="$ORG_DIR_ORDERER/orderers/orderer.fidelitychain.com/tls/server.key"

PEER_HOTEL_TLS="$ORG_DIR_HOTEL/peers/peer0.hotel.fidelitychain.com/tls/ca.crt"
PEER_CAFE_TLS="$ORG_DIR_CAFE/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt"

ADMIN_HOTEL_MSP="$ORG_DIR_HOTEL/users/Admin@$HOTEL_DOMAIN/msp"
ADMIN_CAFE_MSP="$ORG_DIR_CAFE/users/Admin@$CAFE_DOMAIN/msp"

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
        log_info "Instala los binarios de Fabric o ajusta el PATH antes de continuar."
        exit 1
    fi
}

# Detecta FABRIC_CFG_PATH (donde vive core.yaml). Lo necesita `peer`.
# Respeta el ya exportado, si no busca rutas típicas.
ensure_fabric_cfg_path() {
    if [ -n "${FABRIC_CFG_PATH:-}" ] && [ -f "$FABRIC_CFG_PATH/core.yaml" ]; then
        return 0
    fi
    local candidates=(
        "$HOME/fabric/fabric-samples/config"
        "$HOME/practica01/config"
        "$HOME/fabric-samples/config"
        "/opt/fabric/config"
    )
    for p in "${candidates[@]}"; do
        if [ -f "$p/core.yaml" ]; then
            export FABRIC_CFG_PATH="$p"
            log_info "FABRIC_CFG_PATH detectado en $p"
            return 0
        fi
    done
    log_err "No encuentro core.yaml. Exporta FABRIC_CFG_PATH apuntando al directorio config/ de Fabric."
    exit 1
}

set_org_env_hotel() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=HotelMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_HOTEL_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_HOTEL_MSP"
    export CORE_PEER_ADDRESS=localhost:7051
}

set_org_env_cafeteria() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=CafeteriaMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_CAFE_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_CAFE_MSP"
    export CORE_PEER_ADDRESS=localhost:9051
}
