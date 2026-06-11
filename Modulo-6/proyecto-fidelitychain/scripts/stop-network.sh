#!/usr/bin/env bash
# stop-network.sh — Pausa la red conservando todo el estado.
#
# Equivalente a "apagar el servidor": vuelves más tarde con restart-network.sh
# y los documentos, balances, transacciones y chaincode commiteado siguen ahí.
#
# Si lo que quieres es liberar disco o empezar de cero, usa clean-all.sh.

source "$(dirname "$0")/common.sh"

log_step "Pausando contenedores (manteniendo volúmenes y datos)"
docker compose -f "$NETWORK_DIR/docker/docker-compose.yaml" stop

log_ok "Red pausada"
log_info "Para reanudar: bash scripts/restart-network.sh"
log_info "Para tear-down completo: bash scripts/clean-all.sh"
