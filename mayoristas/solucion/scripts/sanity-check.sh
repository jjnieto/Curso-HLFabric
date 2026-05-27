#!/usr/bin/env bash
# sanity-check.sh
# Comprobación completa de la red DistribuTech tras la instalación.
# Ejecutar después de 01..05.  No modifica nada salvo un producto de prueba
# que se crea y se consulta para verificar el flujo end-to-end.
#
# Salida: contadores de checks OK / WARN / ERR.
#   0 errores = la red está operativa.

source "$(dirname "$0")/common.sh"

PASS=0; WARN=0; FAIL=0

# Importante: usamos PASS=$((PASS+1)) en lugar de ((PASS++)) porque el
# postincremento devuelve el valor *antes* de incrementar (0 la primera
# vez), y con `set -e` un retorno 0 aritmético se interpreta como fallo
# y el script aborta silenciosamente.
check_ok()   { PASS=$((PASS+1)); log_ok   "$*"; }
check_warn() { WARN=$((WARN+1)); color_dim "  [WARN] $*"; }
check_fail() { FAIL=$((FAIL+1)); log_err  "$*"; }

# ═════════════════════════════════════════════════════════════════
# FASE 1 — Contenedores Docker
# ═════════════════════════════════════════════════════════════════
log_step "Fase 1: contenedores Docker"

EXPECTED_CONTAINERS=(
    "ca.fabricante.distributech.com"
    "ca.mayorista.distributech.com"
    "ca.minorista.distributech.com"
    "ca.orderer.distributech.com"
    "orderer.distributech.com"
    "peer0.fabricante.distributech.com"
    "peer0.mayorista.distributech.com"
    "peer0.minorista.distributech.com"
    "couchdb.fabricante"
    "couchdb.mayorista"
    "couchdb.minorista"
)

for cname in "${EXPECTED_CONTAINERS[@]}"; do
    status="$(docker inspect -f '{{.State.Status}}' "$cname" 2>/dev/null || true)"
    if [ "$status" = "running" ]; then
        check_ok "Contenedor $cname running"
    elif [ -n "$status" ]; then
        check_fail "Contenedor $cname existe pero está en estado: $status"
    else
        check_fail "Contenedor $cname NO existe"
    fi
done

# ═════════════════════════════════════════════════════════════════
# FASE 2 — Puertos accesibles
# ═════════════════════════════════════════════════════════════════
log_step "Fase 2: puertos TCP"

check_port() {
    local label="$1" port="$2"
    if timeout 2 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null; then
        check_ok "$label (localhost:$port)"
    else
        check_fail "$label (localhost:$port) no responde"
    fi
}

check_port "CA fabricante"       7054
check_port "CA mayorista"        8054
check_port "CA minorista"        9054
check_port "CA orderer"          10054
check_port "Orderer"             7050
check_port "Orderer admin"       7053
check_port "peer0.fabricante"    7051
check_port "peer0.mayorista"     9051
check_port "peer0.minorista"     11051
check_port "CouchDB fabricante"  5984
check_port "CouchDB mayorista"   7984
check_port "CouchDB minorista"   9984

# ═════════════════════════════════════════════════════════════════
# FASE 3 — CAs respondiendo HTTPS
# ═════════════════════════════════════════════════════════════════
log_step "Fase 3: health check de las CAs"

check_ca() {
    local label="$1" port="$2"
    if curl -ksf "https://localhost:$port/cainfo" >/dev/null 2>&1; then
        check_ok "$label responde en /cainfo"
    else
        check_fail "$label NO responde en /cainfo (puerto $port)"
    fi
}

check_ca "CA fabricante" 7054
check_ca "CA mayorista"  8054
check_ca "CA minorista"  9054
check_ca "CA orderer"    10054

# ═════════════════════════════════════════════════════════════════
# FASE 4 — CouchDB respondiendo
# ═════════════════════════════════════════════════════════════════
log_step "Fase 4: health check de CouchDB"

check_couchdb() {
    local label="$1" port="$2"
    local resp
    resp="$(curl -sf "http://admin:adminpw@localhost:$port/" 2>/dev/null || true)"
    if echo "$resp" | grep -q '"couchdb"'; then
        check_ok "$label responde"
    else
        check_fail "$label NO responde (puerto $port)"
    fi
}

check_couchdb "CouchDB fabricante" 5984
check_couchdb "CouchDB mayorista"  7984
check_couchdb "CouchDB minorista"  9984

# ═════════════════════════════════════════════════════════════════
# FASE 5 — Material criptográfico (MSPs)
# ═════════════════════════════════════════════════════════════════
log_step "Fase 5: material criptográfico"

check_file() {
    local label="$1" path="$2"
    if [ -f "$path" ]; then
        check_ok "$label"
    else
        check_fail "$label — no existe: $path"
    fi
}

check_dir_nonempty() {
    local label="$1" dir="$2"
    if [ -d "$dir" ] && [ "$(ls -A "$dir" 2>/dev/null)" ]; then
        check_ok "$label"
    else
        check_fail "$label — vacío o no existe: $dir"
    fi
}

# Orderer
check_file "Orderer TLS cert"   "$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/server.crt"
check_file "Orderer TLS key"    "$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/server.key"
check_file "Orderer TLS CA"     "$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/tls/ca.crt"
check_file "Orderer MSP config" "$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/msp/config.yaml"
check_dir_nonempty "Orderer MSP signcerts" "$ORG_DIR_ORDERER/orderers/$ORDERER_HOST/msp/signcerts"

# Peer orgs
for org_info in \
    "fabricante:$FABRICANTE_DOMAIN:$ORG_DIR_FABRICANTE:$ADMIN_FABRICANTE_MSP" \
    "mayorista:$MAYORISTA_DOMAIN:$ORG_DIR_MAYORISTA:$ADMIN_MAYORISTA_MSP" \
    "minorista:$MINORISTA_DOMAIN:$ORG_DIR_MINORISTA:$ADMIN_MINORISTA_MSP"; do

    IFS=: read -r org domain org_dir admin_msp <<< "$org_info"
    peer_dir="$org_dir/peers/peer0.$domain"

    check_file "$org — org MSP config.yaml"  "$org_dir/msp/config.yaml"
    check_dir_nonempty "$org — org MSP cacerts"    "$org_dir/msp/cacerts"
    check_dir_nonempty "$org — org MSP tlscacerts"  "$org_dir/msp/tlscacerts"

    check_file "$org — peer TLS cert"   "$peer_dir/tls/server.crt"
    check_file "$org — peer TLS key"    "$peer_dir/tls/server.key"
    check_file "$org — peer TLS CA"     "$peer_dir/tls/ca.crt"
    check_dir_nonempty "$org — peer MSP signcerts"  "$peer_dir/msp/signcerts"
    check_dir_nonempty "$org — peer MSP keystore"   "$peer_dir/msp/keystore"

    check_dir_nonempty "$org — admin MSP signcerts" "$admin_msp/signcerts"
    check_dir_nonempty "$org — admin MSP keystore"  "$admin_msp/keystore"
done

# ═════════════════════════════════════════════════════════════════
# FASE 6 — Orderer admin API
# ═════════════════════════════════════════════════════════════════
log_step "Fase 6: orderer admin API"

ORDERER_CHANNELS="$(osnadmin channel list \
    -o "localhost:$ORDERER_ADMIN_PORT" \
    --ca-file "$ORDERER_TLS_CA" \
    --client-cert "$ORDERER_ADMIN_TLS_CERT" \
    --client-key "$ORDERER_ADMIN_TLS_KEY" 2>/dev/null || true)"

for ch in "$CANAL_TRAZABILIDAD" "$CANAL_MAYORISTA" "$CANAL_MINORISTA"; do
    if echo "$ORDERER_CHANNELS" | grep -q "$ch"; then
        check_ok "Orderer unido a $ch"
    else
        check_fail "Orderer NO está en $ch"
    fi
done

# ═════════════════════════════════════════════════════════════════
# FASE 7 — Canales en cada peer
# ═════════════════════════════════════════════════════════════════
log_step "Fase 7: membresía de canales por peer"

resolve_fabric_cfg_path

check_peer_channel() {
    local org_label="$1" channel="$2"
    local channels
    channels="$(peer channel list 2>&1 || true)"
    if echo "$channels" | grep -q "$channel"; then
        check_ok "$org_label está en $channel"
    else
        check_fail "$org_label NO está en $channel"
    fi
}

set_org_env_fabricante
check_peer_channel "peer0.fabricante" "$CANAL_TRAZABILIDAD"
check_peer_channel "peer0.fabricante" "$CANAL_MAYORISTA"

set_org_env_mayorista
check_peer_channel "peer0.mayorista" "$CANAL_TRAZABILIDAD"
check_peer_channel "peer0.mayorista" "$CANAL_MAYORISTA"
check_peer_channel "peer0.mayorista" "$CANAL_MINORISTA"

set_org_env_minorista
check_peer_channel "peer0.minorista" "$CANAL_TRAZABILIDAD"
check_peer_channel "peer0.minorista" "$CANAL_MINORISTA"

# ═════════════════════════════════════════════════════════════════
# FASE 8 — Chaincodes commiteados
# ═════════════════════════════════════════════════════════════════
log_step "Fase 8: chaincodes commiteados"

check_chaincode_committed() {
    local channel="$1" cc_name="$2"
    local result
    result="$(peer lifecycle chaincode querycommitted \
        --channelID "$channel" --name "$cc_name" 2>&1 || true)"
    if echo "$result" | grep -q "Version:"; then
        check_ok "$cc_name commiteado en $channel"
    else
        check_fail "$cc_name NO commiteado en $channel"
    fi
}

set_org_env_fabricante
check_chaincode_committed "$CANAL_TRAZABILIDAD" "$CC_PRODUCTO_NAME"
check_chaincode_committed "$CANAL_TRAZABILIDAD" "$CC_GARANTIA_NAME"
check_chaincode_committed "$CANAL_MAYORISTA"    "$CC_PEDIDO_NAME"

set_org_env_minorista
check_chaincode_committed "$CANAL_MINORISTA"    "$CC_PEDIDO_NAME"

# ═════════════════════════════════════════════════════════════════
# FASE 9 — Test end-to-end con cc-producto
# ═════════════════════════════════════════════════════════════════
log_step "Fase 9: test end-to-end (cc-producto)"

TEST_SERIE="SANITY-$(date +%s)"
E2E_OK=true

# 9a. Registrar producto (como Fabricante)
set_org_env_fabricante
log_info "Registrando producto $TEST_SERIE como FabricanteMSP..."
INVOKE_RESULT="$(peer chaincode invoke \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    -C "$CANAL_TRAZABILIDAD" -n "$CC_PRODUCTO_NAME" \
    -c "{\"function\":\"RegistrarProducto\",\"Args\":[\"$TEST_SERIE\",\"GPU-Test\",\"LOTE-001\"]}" \
    --peerAddresses localhost:7051  --tlsRootCertFiles "$PEER_FABRICANTE_TLS" \
    --waitForEvent 2>&1 || true)"

if echo "$INVOKE_RESULT" | grep -q "status:200"; then
    check_ok "RegistrarProducto($TEST_SERIE) — invoke exitoso"
else
    check_fail "RegistrarProducto($TEST_SERIE) — invoke falló"
    log_info "$INVOKE_RESULT"
    E2E_OK=false
fi

# 9b. Consultar producto (como Mayorista — demuestra que el canal se comparte)
if [ "$E2E_OK" = true ]; then
    sleep 2
    set_org_env_mayorista
    log_info "Consultando producto $TEST_SERIE como MayoristaMSP..."
    QUERY_RESULT="$(peer chaincode query \
        -C "$CANAL_TRAZABILIDAD" -n "$CC_PRODUCTO_NAME" \
        -c "{\"function\":\"ConsultarProducto\",\"Args\":[\"$TEST_SERIE\"]}" 2>&1 || true)"

    if echo "$QUERY_RESULT" | grep -q "$TEST_SERIE"; then
        check_ok "ConsultarProducto($TEST_SERIE) — query exitoso desde MayoristaMSP"
    else
        check_fail "ConsultarProducto($TEST_SERIE) — query falló desde MayoristaMSP"
        log_info "$QUERY_RESULT"
        E2E_OK=false
    fi
fi

# 9c. Transferir custodia Fabricante → Mayorista
if [ "$E2E_OK" = true ]; then
    set_org_env_fabricante
    log_info "Transfiriendo custodia $TEST_SERIE: FabricanteMSP → MayoristaMSP..."
    TRANSFER_RESULT="$(peer chaincode invoke \
        -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
        --tls --cafile "$ORDERER_TLS_CA" \
        -C "$CANAL_TRAZABILIDAD" -n "$CC_PRODUCTO_NAME" \
        -c "{\"function\":\"TransferirCustodia\",\"Args\":[\"$TEST_SERIE\",\"MayoristaMSP\"]}" \
        --peerAddresses localhost:7051  --tlsRootCertFiles "$PEER_FABRICANTE_TLS" \
        --waitForEvent 2>&1 || true)"

    if echo "$TRANSFER_RESULT" | grep -q "status:200"; then
        check_ok "TransferirCustodia($TEST_SERIE → MayoristaMSP) — invoke exitoso"
    else
        check_fail "TransferirCustodia($TEST_SERIE → MayoristaMSP) — invoke falló"
        log_info "$TRANSFER_RESULT"
        E2E_OK=false
    fi
fi

# 9d. Verificar autenticidad (historial de custodia)
if [ "$E2E_OK" = true ]; then
    sleep 2
    set_org_env_minorista
    log_info "Verificando autenticidad de $TEST_SERIE como MinoristaMSP..."
    VERIFY_RESULT="$(peer chaincode query \
        -C "$CANAL_TRAZABILIDAD" -n "$CC_PRODUCTO_NAME" \
        -c "{\"function\":\"VerificarAutenticidad\",\"Args\":[\"$TEST_SERIE\"]}" 2>&1 || true)"

    if echo "$VERIFY_RESULT" | grep -q "FabricanteMSP"; then
        check_ok "VerificarAutenticidad($TEST_SERIE) — trazabilidad visible desde MinoristaMSP"
    else
        check_fail "VerificarAutenticidad($TEST_SERIE) — no se ve la trazabilidad"
        log_info "$VERIFY_RESULT"
    fi
fi

# 9e. Verificar ACL: Mayorista NO puede registrar productos
set_org_env_mayorista
log_info "Verificando ACL: MayoristaMSP intenta RegistrarProducto (debe fallar)..."
ACL_RESULT="$(peer chaincode invoke \
    -o "localhost:$ORDERER_PORT" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_TLS_CA" \
    -C "$CANAL_TRAZABILIDAD" -n "$CC_PRODUCTO_NAME" \
    -c "{\"function\":\"RegistrarProducto\",\"Args\":[\"ACL-TEST-$TEST_SERIE\",\"X\",\"X\"]}" \
    --peerAddresses localhost:9051  --tlsRootCertFiles "$PEER_MAYORISTA_TLS" \
    --waitForEvent 2>&1 || true)"

if echo "$ACL_RESULT" | grep -qi "solo FabricanteMSP\|endorsement failure\|500"; then
    check_ok "ACL: MayoristaMSP rechazado correctamente al intentar RegistrarProducto"
else
    check_warn "ACL: respuesta inesperada al test de control de acceso"
    log_info "$ACL_RESULT"
fi

# ═════════════════════════════════════════════════════════════════
# RESUMEN
# ═════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
color_green "  PASS: $PASS"
if [ "$WARN" -gt 0 ]; then
    color_dim  "  WARN: $WARN"
fi
if [ "$FAIL" -gt 0 ]; then
    color_red  "  FAIL: $FAIL"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -eq 0 ]; then
    echo ""
    color_green "  DistribuTech operativa. 0 errores."
    echo ""
    exit 0
else
    echo ""
    color_red "  $FAIL errores detectados. Revisa los [ERR] de arriba."
    echo ""
    exit 1
fi
