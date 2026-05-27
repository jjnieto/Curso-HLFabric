#!/usr/bin/env bash
# Variables y funciones comunes para todos los scripts de DistribuTech.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
export DISTRIBUTECH_ROOT="$(cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd)"
export NETWORK_DIR="$DISTRIBUTECH_ROOT/network"
export CHAINCODE_DIR="$DISTRIBUTECH_ROOT/chaincode"

# ── Canales ──────────────────────────────────────────────────────
CANAL_TRAZABILIDAD="canal-trazabilidad"
CANAL_MAYORISTA="canal-mayorista"
CANAL_MINORISTA="canal-minorista"

# ── Chaincodes ───────────────────────────────────────────────────
CC_PRODUCTO_NAME="cc-producto"
CC_PRODUCTO_VERSION="${CC_PRODUCTO_VERSION:-1.0}"
CC_PRODUCTO_LABEL="${CC_PRODUCTO_NAME}_${CC_PRODUCTO_VERSION}"
CC_PRODUCTO_SEQUENCE="${CC_PRODUCTO_SEQUENCE:-1}"

CC_GARANTIA_NAME="cc-garantia"
CC_GARANTIA_VERSION="${CC_GARANTIA_VERSION:-1.0}"
CC_GARANTIA_LABEL="${CC_GARANTIA_NAME}_${CC_GARANTIA_VERSION}"
CC_GARANTIA_SEQUENCE="${CC_GARANTIA_SEQUENCE:-1}"

CC_PEDIDO_NAME="cc-pedido"
CC_PEDIDO_VERSION="${CC_PEDIDO_VERSION:-1.0}"
CC_PEDIDO_LABEL="${CC_PEDIDO_NAME}_${CC_PEDIDO_VERSION}"
CC_PEDIDO_SEQUENCE="${CC_PEDIDO_SEQUENCE:-1}"

# ── Políticas de endoso ──────────────────────────────────────────
# cc-producto y cc-garantia en canal-trazabilidad: OR + ACL en chaincode
POLICY_PRODUCTO="OR('FabricanteMSP.peer','MayoristaMSP.peer','MinoristaMSP.peer')"
POLICY_GARANTIA="OR('FabricanteMSP.peer','MinoristaMSP.peer')"
# cc-pedido: AND bilateral en cada canal comercial
POLICY_PEDIDO_MAYORISTA="AND('FabricanteMSP.peer','MayoristaMSP.peer')"
POLICY_PEDIDO_MINORISTA="AND('MayoristaMSP.peer','MinoristaMSP.peer')"

# ── Dominios ─────────────────────────────────────────────────────
FABRICANTE_DOMAIN="fabricante.distributech.com"
MAYORISTA_DOMAIN="mayorista.distributech.com"
MINORISTA_DOMAIN="minorista.distributech.com"
ORDERER_DOMAIN="distributech.com"

# ── Orderer ──────────────────────────────────────────────────────
ORDERER_HOST="orderer.distributech.com"
ORDERER_PORT="7050"
ORDERER_ADMIN_PORT="7053"

# ── Directorios de organizaciones ────────────────────────────────
ORG_DIR_FABRICANTE="$NETWORK_DIR/organizations/peerOrganizations/$FABRICANTE_DOMAIN"
ORG_DIR_MAYORISTA="$NETWORK_DIR/organizations/peerOrganizations/$MAYORISTA_DOMAIN"
ORG_DIR_MINORISTA="$NETWORK_DIR/organizations/peerOrganizations/$MINORISTA_DOMAIN"
ORG_DIR_ORDERER="$NETWORK_DIR/organizations/ordererOrganizations/$ORDERER_DOMAIN"

# ── TLS del orderer ──────────────────────────────────────────────
ORDERER_TLS_CA="$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/server.key"

# ── TLS de peers ─────────────────────────────────────────────────
PEER_FABRICANTE_TLS="$ORG_DIR_FABRICANTE/peers/peer0.$FABRICANTE_DOMAIN/tls/ca.crt"
PEER_MAYORISTA_TLS="$ORG_DIR_MAYORISTA/peers/peer0.$MAYORISTA_DOMAIN/tls/ca.crt"
PEER_MINORISTA_TLS="$ORG_DIR_MINORISTA/peers/peer0.$MINORISTA_DOMAIN/tls/ca.crt"

# ── MSP de admins ────────────────────────────────────────────────
ADMIN_FABRICANTE_MSP="$ORG_DIR_FABRICANTE/users/Admin@$FABRICANTE_DOMAIN/msp"
ADMIN_MAYORISTA_MSP="$ORG_DIR_MAYORISTA/users/Admin@$MAYORISTA_DOMAIN/msp"
ADMIN_MINORISTA_MSP="$ORG_DIR_MINORISTA/users/Admin@$MINORISTA_DOMAIN/msp"

# ── Helpers de color ─────────────────────────────────────────────
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

# ── Funciones para cambiar el contexto de org ────────────────────
set_org_env_fabricante() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=FabricanteMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_FABRICANTE_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_FABRICANTE_MSP"
    export CORE_PEER_ADDRESS=localhost:7051
}

set_org_env_mayorista() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=MayoristaMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_MAYORISTA_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_MAYORISTA_MSP"
    export CORE_PEER_ADDRESS=localhost:9051
}

set_org_env_minorista() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=MinoristaMSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$PEER_MINORISTA_TLS"
    export CORE_PEER_MSPCONFIGPATH="$ADMIN_MINORISTA_MSP"
    export CORE_PEER_ADDRESS=localhost:11051
}

# ── Resolver FABRIC_CFG_PATH para comandos peer ─────────────────
# Importante: peer necesita encontrar core.yaml en FABRIC_CFG_PATH. Si la
# variable ya está exportada pero apunta a un directorio sin core.yaml
# (por ejemplo, porque antes la usamos para configtxgen apuntando a
# network/), la sobreescribimos buscando una ubicación válida.
resolve_fabric_cfg_path() {
    if [ -n "${FABRIC_CFG_PATH:-}" ] && [ -f "$FABRIC_CFG_PATH/core.yaml" ]; then
        return
    fi
    for candidate in \
        "$DISTRIBUTECH_ROOT/config" \
        "$DISTRIBUTECH_ROOT/../../config" \
        "$HOME/practica01/config" \
        "$HOME/fabric/fabric-samples/config"; do
        if [ -f "$candidate/core.yaml" ]; then
            export FABRIC_CFG_PATH="$(cd "$candidate" && pwd)"
            return
        fi
    done
    log_err "No encuentro core.yaml. Exporta FABRIC_CFG_PATH apuntando al directorio config/ de Fabric."
    exit 1
}
