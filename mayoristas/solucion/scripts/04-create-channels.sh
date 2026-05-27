#!/usr/bin/env bash
# 04-create-channels.sh
# Genera los bloques génesis de los 3 canales, une el orderer y los peers
# correspondientes a cada canal.
#
# canal-trazabilidad: Fabricante + Mayorista + Minorista
# canal-mayorista:    Fabricante + Mayorista
# canal-minorista:    Mayorista  + Minorista

source "$(dirname "$0")/common.sh"

require_cmd configtxgen
require_cmd osnadmin
require_cmd peer

mkdir -p "$NETWORK_DIR/channel-artifacts"

# ── Generar bloques génesis ──────────────────────────────────────
export FABRIC_CFG_PATH="$NETWORK_DIR"

log_step "Generando bloque génesis de $CANAL_TRAZABILIDAD"
configtxgen -profile CanalTrazabilidad \
    -outputBlock "$NETWORK_DIR/channel-artifacts/$CANAL_TRAZABILIDAD.block" \
    -channelID "$CANAL_TRAZABILIDAD"
log_ok "$CANAL_TRAZABILIDAD.block"

log_step "Generando bloque génesis de $CANAL_MAYORISTA"
configtxgen -profile CanalMayorista \
    -outputBlock "$NETWORK_DIR/channel-artifacts/$CANAL_MAYORISTA.block" \
    -channelID "$CANAL_MAYORISTA"
log_ok "$CANAL_MAYORISTA.block"

log_step "Generando bloque génesis de $CANAL_MINORISTA"
configtxgen -profile CanalMinorista \
    -outputBlock "$NETWORK_DIR/channel-artifacts/$CANAL_MINORISTA.block" \
    -channelID "$CANAL_MINORISTA"
log_ok "$CANAL_MINORISTA.block"

# ── Unir orderer a los 3 canales ────────────────────────────────
join_orderer() {
    local channel="$1"
    log_step "Uniendo orderer a $channel"
    osnadmin channel join \
        --channelID "$channel" \
        --config-block "$NETWORK_DIR/channel-artifacts/$channel.block" \
        -o "localhost:$ORDERER_ADMIN_PORT" \
        --ca-file "$ORDERER_TLS_CA" \
        --client-cert "$ORDERER_ADMIN_TLS_CERT" \
        --client-key "$ORDERER_ADMIN_TLS_KEY"
    log_ok "Orderer unido a $channel"
}

join_orderer "$CANAL_TRAZABILIDAD"
join_orderer "$CANAL_MAYORISTA"
join_orderer "$CANAL_MINORISTA"

# ── Resolver FABRIC_CFG_PATH para comandos peer ─────────────────
resolve_fabric_cfg_path
log_info "Usando FABRIC_CFG_PATH=$FABRIC_CFG_PATH para los comandos peer"

# ── Unir peers a canal-trazabilidad (los 3) ─────────────────────
log_step "Uniendo peer0.fabricante a $CANAL_TRAZABILIDAD"
set_org_env_fabricante
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_TRAZABILIDAD.block"

log_step "Uniendo peer0.mayorista a $CANAL_TRAZABILIDAD"
set_org_env_mayorista
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_TRAZABILIDAD.block"

log_step "Uniendo peer0.minorista a $CANAL_TRAZABILIDAD"
set_org_env_minorista
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_TRAZABILIDAD.block"

# ── Unir peers a canal-mayorista (fabricante + mayorista) ────────
log_step "Uniendo peer0.fabricante a $CANAL_MAYORISTA"
set_org_env_fabricante
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_MAYORISTA.block"

log_step "Uniendo peer0.mayorista a $CANAL_MAYORISTA"
set_org_env_mayorista
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_MAYORISTA.block"

# ── Unir peers a canal-minorista (mayorista + minorista) ─────────
log_step "Uniendo peer0.mayorista a $CANAL_MINORISTA"
set_org_env_mayorista
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_MINORISTA.block"

log_step "Uniendo peer0.minorista a $CANAL_MINORISTA"
set_org_env_minorista
peer channel join -b "$NETWORK_DIR/channel-artifacts/$CANAL_MINORISTA.block"

# ── Verificación ─────────────────────────────────────────────────
log_step "Verificando canales de cada peer"

set_org_env_fabricante
log_info "peer0.fabricante:"
peer channel list

set_org_env_mayorista
log_info "peer0.mayorista:"
peer channel list

set_org_env_minorista
log_info "peer0.minorista:"
peer channel list

log_step "3 canales creados y operativos"
log_info "Siguiente: bash scripts/05-deploy-chaincodes.sh"
