#!/usr/bin/env bash
# clean-all.sh — Borra todo y deja el proyecto listo para empezar de cero.

source "$(dirname "$0")/common.sh"

log_step "Bajando contenedores y borrando volúmenes"
docker compose -f "$NETWORK_DIR/docker/docker-compose.yaml" down -v --remove-orphans 2>/dev/null || true

log_step "Borrando contenedores de chaincode (creados dinámicamente por los peers)"
docker ps -a --format '{{.Names}}' | grep -E '^dev-peer0\.' | xargs -r docker rm -f
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^dev-peer0\.' | xargs -r docker rmi -f

log_step "Borrando material crypto y artefactos"
rm -rf "$CRYPTO_DIR"
rm -rf "$NETWORK_DIR/channel-artifacts"
rm -f  "$PROJECT_DIR/${CHAINCODE_NAME}.tar.gz"
rm -rf "$CHAINCODE_DIR/chaincode-go/vendor"
rm -f  "$CHAINCODE_DIR/chaincode-go/go.sum"

log_step "Limpieza completa"
log_info "Para volver a montar todo: bash scripts/start-network.sh && bash scripts/deploy-chaincode.sh"
