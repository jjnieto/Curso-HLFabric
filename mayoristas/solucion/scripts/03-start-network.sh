#!/usr/bin/env bash
# 03-start-network.sh
# Levanta orderer + peers + CouchDBs y espera a que estén operativos.

source "$(dirname "$0")/common.sh"

require_cmd docker
require_cmd osnadmin

log_step "Levantando orderer + 3 peers + 3 CouchDBs"
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
        log_info "Revisa: docker logs orderer.distributech.com"
        exit 1
    fi
    sleep 1
done

log_step "Red levantada"
log_info "Siguiente: bash scripts/04-create-channels.sh"
