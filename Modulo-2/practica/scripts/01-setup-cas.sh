#!/usr/bin/env bash
# 01-setup-cas.sh
# Levanta las 3 Fabric CAs y enrolla todas las identidades necesarias.
#
# Resultado: network/fabric-ca/{cliente,proveedor,orderer}/ con admin
# bootstrap, peer/orderer y admin de cada org enrollados.

source "$(dirname "$0")/common.sh"

require_cmd docker
require_cmd fabric-ca-client
require_cmd curl

log_step "Levantando las 3 Fabric CAs"
docker compose -f "$NETWORK_DIR/docker/docker-compose-ca.yaml" up -d

log_step "Esperando a que las CAs respondan..."
for port in 7054 8054 9054; do
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

# Las CAs generan tls-cert.pem en su volumen. Esperamos a que aparezca.
for org in cliente proveedor orderer; do
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
    local org="$1" port="$2" caname="$3" name="$4" secret="$5" home="$6"
    log_step "Enroll de $name (identidad)"
    export FABRIC_CA_CLIENT_HOME="$home"
    local hosts="$7"
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

# CLIENTE
enroll_bootstrap cliente 7054 ca-cliente
register_id cliente 7054 ca-cliente peer0 peer0pw peer
register_id cliente 7054 ca-cliente clienteadmin clienteadminpw admin
enroll_id     cliente 7054 ca-cliente peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/cliente/peer0" \
              "peer0.cliente.signchain.com,localhost"
enroll_id_tls cliente 7054 ca-cliente peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/cliente/peer0/tls" \
              "peer0.cliente.signchain.com,localhost"
enroll_admin  cliente 7054 ca-cliente clienteadmin clienteadminpw \
              "$NETWORK_DIR/fabric-ca/cliente/clienteadmin"

# PROVEEDOR
enroll_bootstrap proveedor 8054 ca-proveedor
register_id proveedor 8054 ca-proveedor peer0 peer0pw peer
register_id proveedor 8054 ca-proveedor proveedoradmin proveedoradminpw admin
enroll_id     proveedor 8054 ca-proveedor peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/proveedor/peer0" \
              "peer0.proveedor.signchain.com,localhost"
enroll_id_tls proveedor 8054 ca-proveedor peer0 peer0pw \
              "$NETWORK_DIR/fabric-ca/proveedor/peer0/tls" \
              "peer0.proveedor.signchain.com,localhost"
enroll_admin  proveedor 8054 ca-proveedor proveedoradmin proveedoradminpw \
              "$NETWORK_DIR/fabric-ca/proveedor/proveedoradmin"

# ORDERER
enroll_bootstrap orderer 9054 ca-orderer
register_id orderer 9054 ca-orderer orderer ordererpw orderer
register_id orderer 9054 ca-orderer ordereradmin ordereradminpw admin
enroll_id     orderer 9054 ca-orderer orderer ordererpw \
              "$NETWORK_DIR/fabric-ca/orderer/orderer" \
              "orderer.signchain.com,localhost"
enroll_id_tls orderer 9054 ca-orderer orderer ordererpw \
              "$NETWORK_DIR/fabric-ca/orderer/orderer/tls" \
              "orderer.signchain.com,localhost"
enroll_admin  orderer 9054 ca-orderer ordereradmin ordereradminpw \
              "$NETWORK_DIR/fabric-ca/orderer/ordereradmin"

log_step "Setup de CAs e identidades completado"
log_info "Siguiente: bash scripts/02-build-msps.sh"
