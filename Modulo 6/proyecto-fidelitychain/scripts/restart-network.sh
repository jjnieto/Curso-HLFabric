#!/usr/bin/env bash
# restart-network.sh — Reanuda la red tras un stop-network.sh.
#
# No regenera certificados ni canal: simplemente vuelve a arrancar los
# contenedores que se pausaron. El estado on-chain sigue intacto.

source "$(dirname "$0")/common.sh"

log_step "Reanudando contenedores"
docker compose -f "$NETWORK_DIR/docker/docker-compose.yaml" start

log_step "Esperando a que el orderer admin responda"
for i in {1..30}; do
    if osnadmin channel list \
        -o "localhost:$ORDERER_ADMIN_PORT" \
        --ca-file "$ORDERER_TLS_CA" \
        --client-cert "$ORDERER_ADMIN_TLS_CERT" \
        --client-key "$ORDERER_ADMIN_TLS_KEY" >/dev/null 2>&1; then
        log_ok "Red operativa de nuevo"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_err "Orderer admin no responde tras 30 intentos."
        log_info "Revisa: docker logs orderer.fidelitychain.com"
        exit 1
    fi
    sleep 1
done

docker ps --format "table {{.Names}}\t{{.Status}}" \
    | grep -E "orderer|peer|couchdb" || true
