#!/usr/bin/env bash
# 03-start-network.sh
# Genera el bloque génesis, levanta orderer + peers + CouchDBs,
# crea el canal en el orderer y une los dos peers al canal.

source "$(dirname "$0")/common.sh"

require_cmd docker
require_cmd configtxgen
require_cmd osnadmin
require_cmd peer

mkdir -p "$NETWORK_DIR/channel-artifacts"

log_step "Generando el bloque génesis del canal $CHANNEL_NAME"
export FABRIC_CFG_PATH="$NETWORK_DIR"
configtxgen -profile SignChainChannel \
    -outputBlock "$NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block" \
    -channelID "$CHANNEL_NAME"
log_ok "Bloque génesis: $NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block"

log_step "Levantando orderer + peers + CouchDBs"
docker compose -f "$NETWORK_DIR/docker/docker-compose-net.yaml" up -d

log_step "Esperando a que el orderer admin endpoint responda"
for i in {1..30}; do
    if osnadmin channel list \
        -o "localhost:$ORDERER_ADMIN_PORT" \
        --ca-file "$ORDERER_TLS_CA" \
        --client-cert "$ORDERER_ADMIN_TLS_CERT" \
        --client-key "$ORDERER_ADMIN_TLS_KEY" >/dev/null 2>&1; then
        log_ok "Orderer admin listo"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_err "Orderer admin no responde tras 30 intentos"
        log_info "Revisa: docker logs orderer.signchain.com"
        exit 1
    fi
    sleep 1
done

log_step "Uniendo el orderer al canal"
osnadmin channel join \
    --channelID "$CHANNEL_NAME" \
    --config-block "$NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block" \
    -o "localhost:$ORDERER_ADMIN_PORT" \
    --ca-file "$ORDERER_TLS_CA" \
    --client-cert "$ORDERER_ADMIN_TLS_CERT" \
    --client-key "$ORDERER_ADMIN_TLS_KEY"
log_ok "Orderer unido a $CHANNEL_NAME"

# FABRIC_CFG_PATH para `peer` necesita apuntar al config global de Fabric
# (donde vive core.yaml). Si el alumno tiene los binarios en ./bin, suele
# haber un ./config al lado. Si no, pedimos que se exporte.
if [ -z "${PEER_FABRIC_CFG_PATH:-}" ]; then
    if [ -d "$SIGNCHAIN_ROOT/../../config" ]; then
        export FABRIC_CFG_PATH="$(cd "$SIGNCHAIN_ROOT/../../config" && pwd)"
    elif [ -d "$HOME/practica01/config" ]; then
        export FABRIC_CFG_PATH="$HOME/practica01/config"
    elif [ -d "$HOME/fabric/fabric-samples/config" ]; then
        export FABRIC_CFG_PATH="$HOME/fabric/fabric-samples/config"
    else
        log_err "No encuentro core.yaml. Exporta FABRIC_CFG_PATH apuntando al directorio config/ de Fabric antes de ejecutar este script."
        exit 1
    fi
else
    export FABRIC_CFG_PATH="$PEER_FABRIC_CFG_PATH"
fi
log_info "Usando FABRIC_CFG_PATH=$FABRIC_CFG_PATH para los comandos peer"

log_step "Uniendo peer0.cliente al canal"
set_org_env_cliente
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block"

log_step "Uniendo peer0.proveedor al canal"
set_org_env_proveedor
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block"

log_step "Verificando que los peers están en el canal"
set_org_env_cliente
peer channel list

log_step "Red operativa"
log_info "Siguiente: bash scripts/04-deploy-chaincode.sh"
