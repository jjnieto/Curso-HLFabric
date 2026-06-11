#!/usr/bin/env bash
# start-network.sh — Levanta la red FidelityChain desde cero
#
# - Genera el material crypto con cryptogen (si aún no existe).
# - Crea el bloque génesis del canal fidelity-channel.
# - Levanta orderer + 2 peers + 2 CouchDBs con docker compose.
# - Une el orderer al canal con osnadmin.
# - Une los dos peers al canal.
#
# Es idempotente: si los certificados o el bloque génesis ya existen,
# no los re-genera. Si quieres empezar de cero, ejecuta clean-all.sh.

source "$(dirname "$0")/common.sh"

require_cmd docker
require_cmd cryptogen
require_cmd configtxgen
require_cmd osnadmin
require_cmd peer

log_step "1/5 Material criptográfico"
if [ -d "$CRYPTO_DIR" ] && [ "$(ls -A "$CRYPTO_DIR" 2>/dev/null)" ]; then
    log_info "Ya existe $CRYPTO_DIR — no se regenera. Usa clean-all.sh para empezar de cero."
else
    (cd "$NETWORK_DIR" && cryptogen generate \
        --config=crypto-config.yaml \
        --output=crypto-config)
    log_ok "Certificados generados en $CRYPTO_DIR"
fi

log_step "2/5 Bloque génesis"
mkdir -p "$NETWORK_DIR/channel-artifacts"
GENESIS_BLOCK="$NETWORK_DIR/channel-artifacts/$CHANNEL_NAME.block"
if [ -f "$GENESIS_BLOCK" ]; then
    log_info "Ya existe $GENESIS_BLOCK — no se regenera."
else
    export FABRIC_CFG_PATH="$NETWORK_DIR"
    (cd "$NETWORK_DIR" && configtxgen -profile FidelityChannel \
        -outputBlock "$GENESIS_BLOCK" \
        -channelID "$CHANNEL_NAME")
    log_ok "Bloque génesis: $GENESIS_BLOCK"
fi

log_step "3/5 Levantando contenedores Docker"
docker compose -f "$NETWORK_DIR/docker/docker-compose.yaml" up -d

log_step "4/5 Esperando al endpoint admin del orderer"
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
        log_err "Orderer admin no responde tras 30 intentos."
        log_info "Revisa: docker logs orderer.fidelitychain.com"
        exit 1
    fi
    sleep 1
done

# ¿Está el orderer ya unido al canal? (idempotencia tras un docker compose start)
if osnadmin channel list \
    -o "localhost:$ORDERER_ADMIN_PORT" \
    --ca-file "$ORDERER_TLS_CA" \
    --client-cert "$ORDERER_ADMIN_TLS_CERT" \
    --client-key "$ORDERER_ADMIN_TLS_KEY" 2>/dev/null | grep -q "$CHANNEL_NAME"; then
    log_info "Orderer ya unido a $CHANNEL_NAME"
else
    log_step "Uniendo el orderer a $CHANNEL_NAME"
    osnadmin channel join \
        --channelID "$CHANNEL_NAME" \
        --config-block "$GENESIS_BLOCK" \
        -o "localhost:$ORDERER_ADMIN_PORT" \
        --ca-file "$ORDERER_TLS_CA" \
        --client-cert "$ORDERER_ADMIN_TLS_CERT" \
        --client-key "$ORDERER_ADMIN_TLS_KEY"
    log_ok "Orderer unido"
fi

log_step "5/5 Uniendo los peers al canal"
ensure_fabric_cfg_path

# Hotel
set_org_env_hotel
if peer channel list 2>/dev/null | grep -q "$CHANNEL_NAME"; then
    log_info "peer0.hotel ya está en el canal"
else
    peer channel join -b "$GENESIS_BLOCK"
    log_ok "peer0.hotel unido"
fi

# Cafetería
set_org_env_cafeteria
if peer channel list 2>/dev/null | grep -q "$CHANNEL_NAME"; then
    log_info "peer0.cafeteria ya está en el canal"
else
    peer channel join -b "$GENESIS_BLOCK"
    log_ok "peer0.cafeteria unido"
fi

log_step "Red FidelityChain operativa"
docker ps --format "table {{.Names}}\t{{.Status}}" \
    | grep -E "orderer|peer|couchdb" || true
log_info ""
log_info "Siguiente: bash scripts/deploy-chaincode.sh"
