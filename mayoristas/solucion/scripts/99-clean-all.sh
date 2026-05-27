#!/usr/bin/env bash
# 99-clean-all.sh
# Para todos los contenedores y borra el estado on-disk.
# Después de esto, una nueva ejecución de 01..05 levanta la red desde cero.

source "$(dirname "$0")/common.sh"

log_step "Bajando los contenedores de Fabric (red)"
docker compose -f "$NETWORK_DIR/docker/docker-compose-net.yaml" down -v --remove-orphans 2>/dev/null || true

log_step "Bajando los contenedores de las CAs"
docker compose -f "$NETWORK_DIR/docker/docker-compose-ca.yaml" down -v --remove-orphans 2>/dev/null || true

log_step "Borrando contenedores de chaincode (creados dinámicamente)"
docker ps -a --format '{{.Names}}' | grep -E '^dev-peer0\.' | xargs -r docker rm -f
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^dev-peer0\.' | xargs -r docker rmi -f

log_step "Borrando datos generados (preservando .gitkeep)"
clean_dir() {
    local dir="$1"
    [ -d "$dir" ] || return 0
    find "$dir" -mindepth 1 -not -name .gitkeep -delete 2>/dev/null || true
}
clean_dir "$NETWORK_DIR/fabric-ca/fabricante"
clean_dir "$NETWORK_DIR/fabric-ca/mayorista"
clean_dir "$NETWORK_DIR/fabric-ca/minorista"
clean_dir "$NETWORK_DIR/fabric-ca/orderer"
clean_dir "$NETWORK_DIR/organizations"
clean_dir "$NETWORK_DIR/channel-artifacts"

for cc in cc-producto cc-garantia cc-pedido; do
    rm -f  "$CHAINCODE_DIR/$cc.tar.gz"
    rm -rf "$CHAINCODE_DIR/$cc/vendor"
    rm -f  "$CHAINCODE_DIR/$cc/go.sum"
done

log_step "Limpieza completa"
log_info "Para levantar de nuevo: bash scripts/01-setup-cas.sh"
