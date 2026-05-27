#!/usr/bin/env bash
# 01-setup-cas.sh
# Levanta las 4 Fabric CAs y enrolla todas las identidades necesarias.
#
# Resultado: network/fabric-ca/{fabricante,mayorista,minorista,orderer}/ con
# admin bootstrap, peer/orderer y admin de cada org enrollados.

source "$(dirname "$0")/common.sh"

require_cmd docker
require_cmd fabric-ca-client
require_cmd curl

log_step "Levantando las 4 Fabric CAs"
docker compose -f "$NETWORK_DIR/docker/docker-compose-ca.yaml" up -d

log_step "Esperando a que las CAs respondan..."
for port in 7054 8054 9054 10054; do
    for i in {1..30}; do
        if curl -ksf "https://localhost:$port/cainfo" >/dev/null 2>&1; then
            log_ok "CA en :$port lista"
            break
        fi
        if [ "$i" -eq 30 ]; then
            log_err "CA en :$port no responde tras 30 intentos"
            exit 1
        fi
        sleep 1
    done
done

for org in fabricante mayorista minorista orderer; do
    for i in {1..30}; do
        if [ -f "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem" ]; then
            break
        fi
        if [ "$i" -eq 30 ]; then
            log_err "tls-cert.pem de la CA $org no aparece"
            exit 1
        fi
        sleep 1
    done
done
log_ok "Todas las CAs han escrito su tls-cert.pem"

# ── Funciones helper ─────────────────────────────────────────────
enroll_bootstrap() {
    local org="$1" port="$2" caname="$3"
    log_step "Enroll del admin bootstrap de $org"
    export FABRIC_CA_CLIENT_HOME="$NETWORK_DIR/fabric-ca/$org/admin"
    fabric-ca-client enroll \
        -u "https://admin:adminpw@localhost:$port" \
        --caname "$caname" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem"
}

register_id() {
    local org="$1" port="$2" caname="$3" name="$4" secret="$5" type="$6"
    export FABRIC_CA_CLIENT_HOME="$NETWORK_DIR/fabric-ca/$org/admin"
    if fabric-ca-client identity list --caname "$caname" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem" 2>/dev/null \
        | grep -q "Name: $name"; then
        log_info "Identidad $name ya registrada en $caname"
        return 0
    fi
    log_step "Registrando $name ($type) en $caname"
    fabric-ca-client register \
        --caname "$caname" \
        --id.name "$name" --id.secret "$secret" --id.type "$type" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem"
}

enroll_id() {
    local org="$1" port="$2" caname="$3" name="$4" secret="$5" home="$6" hosts="$7"
    log_step "Enroll de $name (identidad)"
    export FABRIC_CA_CLIENT_HOME="$home"
    fabric-ca-client enroll \
        -u "https://$name:$secret@localhost:$port" \
        --caname "$caname" \
        --csr.hosts "$hosts" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem"
}

enroll_id_tls() {
    local org="$1" port="$2" caname="$3" name="$4" secret="$5" home="$6" hosts="$7"
    log_step "Enroll de $name (TLS)"
    export FABRIC_CA_CLIENT_HOME="$home"
    fabric-ca-client enroll \
        -u "https://$name:$secret@localhost:$port" \
        --caname "$caname" \
        --enrollment.profile tls \
        --csr.hosts "$hosts" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem"
}

enroll_admin() {
    local org="$1" port="$2" caname="$3" name="$4" secret="$5" home="$6"
    log_step "Enroll del admin $name de $org"
    export FABRIC_CA_CLIENT_HOME="$home"
    fabric-ca-client enroll \
        -u "https://$name:$secret@localhost:$port" \
        --caname "$caname" \
        --tls.certfiles "$NETWORK_DIR/fabric-ca/$org/tls-cert.pem"
}

# ── FABRICANTE ───────────────────────────────────────────────────
enroll_bootstrap fabricante 7054 ca-fabricante
register_id fabricante 7054 ca-fabricante peer0 peer0pw peer
register_id fabricante 7054 ca-fabricante fabricanteadmin fabricanteadminpw admin
enroll_id     fabricante 7054 ca-fabricante peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/fabricante/peer0" \
              "peer0.fabricante.distributech.com,localhost"
enroll_id_tls fabricante 7054 ca-fabricante peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/fabricante/peer0/tls" \
              "peer0.fabricante.distributech.com,localhost"
enroll_admin  fabricante 7054 ca-fabricante fabricanteadmin fabricanteadminpw \
              "$NETWORK_DIR/fabric-ca/fabricante/fabricanteadmin"

# ── MAYORISTA ────────────────────────────────────────────────────
enroll_bootstrap mayorista 8054 ca-mayorista
register_id mayorista 8054 ca-mayorista peer0 peer0pw peer
register_id mayorista 8054 ca-mayorista mayoristaadmin mayoristaadminpw admin
enroll_id     mayorista 8054 ca-mayorista peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/mayorista/peer0" \
              "peer0.mayorista.distributech.com,localhost"
enroll_id_tls mayorista 8054 ca-mayorista peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/mayorista/peer0/tls" \
              "peer0.mayorista.distributech.com,localhost"
enroll_admin  mayorista 8054 ca-mayorista mayoristaadmin mayoristaadminpw \
              "$NETWORK_DIR/fabric-ca/mayorista/mayoristaadmin"

# ── MINORISTA ────────────────────────────────────────────────────
enroll_bootstrap minorista 9054 ca-minorista
register_id minorista 9054 ca-minorista peer0 peer0pw peer
register_id minorista 9054 ca-minorista minoristaadmin minoristaadminpw admin
enroll_id     minorista 9054 ca-minorista peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/minorista/peer0" \
              "peer0.minorista.distributech.com,localhost"
enroll_id_tls minorista 9054 ca-minorista peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/minorista/peer0/tls" \
              "peer0.minorista.distributech.com,localhost"
enroll_admin  minorista 9054 ca-minorista minoristaadmin minoristaadminpw \
              "$NETWORK_DIR/fabric-ca/minorista/minoristaadmin"

# ── ORDERER ──────────────────────────────────────────────────────
enroll_bootstrap orderer 10054 ca-orderer
register_id orderer 10054 ca-orderer orderer ordererpw orderer
register_id orderer 10054 ca-orderer ordereradmin ordereradminpw admin
enroll_id     orderer 10054 ca-orderer orderer ordererpw \
              "$NETWORK_DIR/fabric-ca/orderer/orderer" \
              "orderer.distributech.com,localhost"
enroll_id_tls orderer 10054 ca-orderer orderer ordererpw \
              "$NETWORK_DIR/fabric-ca/orderer/orderer/tls" \
              "orderer.distributech.com,localhost"
enroll_admin  orderer 10054 ca-orderer ordereradmin ordereradminpw \
              "$NETWORK_DIR/fabric-ca/orderer/ordereradmin"

log_step "Setup de CAs e identidades completado"
log_info "Siguiente: bash scripts/02-build-msps.sh"
