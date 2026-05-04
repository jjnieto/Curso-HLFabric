#!/usr/bin/env bash
# 02-build-msps.sh
# Construye la estructura organizations/{peerOrganizations,ordererOrganizations}
# a partir del material crypto que las CAs generaron en network/fabric-ca/.

source "$(dirname "$0")/common.sh"

build_org_msp_yaml() {
    local org_msp_dir="$1"
    local cacert
    cacert="$(ls "$org_msp_dir/cacerts/" | head -n 1)"
    cat > "$org_msp_dir/config.yaml" <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$cacert
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$cacert
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$cacert
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$cacert
    OrganizationalUnitIdentifier: orderer
EOF
}

build_peer_org() {
    local org="$1" domain="$2" msp_id="$3" admin_user="$4"
    log_step "Construyendo MSP de la peer org $msp_id ($domain)"

    local org_dir="$NETWORK_DIR/organizations/peerOrganizations/$domain"
    rm -rf "$org_dir"
    mkdir -p "$org_dir"/msp/{cacerts,tlscacerts,admincerts,users}
    mkdir -p "$org_dir"/peers/peer0.$domain/msp/{cacerts,tlscacerts,keystore,signcerts}
    mkdir -p "$org_dir"/peers/peer0.$domain/tls
    mkdir -p "$org_dir"/users/Admin@$domain/msp/{cacerts,tlscacerts,keystore,signcerts}

    # El cert raíz de la CA TLS está en el msp/tlscacerts/ generado por el enroll TLS.
    # NO usar tls-cert.pem (ese es el cert HTTPS del proceso fabric-ca-server, no la CA).
    local tls_ca_root="$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/tlscacerts"

    # MSP de la org (channel MSP)
    cp "$NETWORK_DIR/fabric-ca/$org/admin/msp/cacerts/"* "$org_dir/msp/cacerts/"
    cp "$tls_ca_root/"*                                  "$org_dir/msp/tlscacerts/"
    build_org_msp_yaml "$org_dir/msp"

    # MSP local del peer
    local peer_dir="$org_dir/peers/peer0.$domain"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/msp/cacerts/"*   "$peer_dir/msp/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/msp/keystore/"*  "$peer_dir/msp/keystore/"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/msp/signcerts/"* "$peer_dir/msp/signcerts/"
    cp "$tls_ca_root/"*                                    "$peer_dir/msp/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$peer_dir/msp/config.yaml"

    # TLS del peer
    cp "$tls_ca_root/"*                                         "$peer_dir/tls/ca.crt"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/keystore/"*   "$peer_dir/tls/server.key"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/signcerts/"*  "$peer_dir/tls/server.crt"

    # MSP local del admin
    local admin_dir="$org_dir/users/Admin@$domain/msp"
    cp "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/cacerts/"*   "$admin_dir/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/keystore/"*  "$admin_dir/keystore/"
    cp "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/signcerts/"* "$admin_dir/signcerts/"
    cp "$tls_ca_root/"*                                          "$admin_dir/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$admin_dir/config.yaml"

    log_ok "$msp_id construido en $org_dir"
}

build_orderer_org() {
    log_step "Construyendo MSP de la orderer org OrdererMSP"
    local domain="$ORDERER_DOMAIN"
    local org_dir="$NETWORK_DIR/organizations/ordererOrganizations/$domain"
    rm -rf "$org_dir"
    mkdir -p "$org_dir"/msp/{cacerts,tlscacerts,admincerts,users}
    mkdir -p "$org_dir"/orderers/orderer.signchain.com/msp/{cacerts,tlscacerts,keystore,signcerts}
    mkdir -p "$org_dir"/orderers/orderer.signchain.com/tls
    mkdir -p "$org_dir"/users/Admin@$domain/msp/{cacerts,tlscacerts,keystore,signcerts}

    local tls_ca_root="$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/tlscacerts"

    cp "$NETWORK_DIR/fabric-ca/orderer/admin/msp/cacerts/"* "$org_dir/msp/cacerts/"
    cp "$tls_ca_root/"*                                     "$org_dir/msp/tlscacerts/"
    build_org_msp_yaml "$org_dir/msp"

    local ord_dir="$org_dir/orderers/orderer.signchain.com"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/cacerts/"*   "$ord_dir/msp/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/keystore/"*  "$ord_dir/msp/keystore/"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/signcerts/"* "$ord_dir/msp/signcerts/"
    cp "$tls_ca_root/"*                                         "$ord_dir/msp/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$ord_dir/msp/config.yaml"

    cp "$tls_ca_root/"*                                              "$ord_dir/tls/ca.crt"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/keystore/"*   "$ord_dir/tls/server.key"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/signcerts/"*  "$ord_dir/tls/server.crt"

    local admin_dir="$org_dir/users/Admin@$domain/msp"
    cp "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/cacerts/"*   "$admin_dir/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/keystore/"*  "$admin_dir/keystore/"
    cp "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/signcerts/"* "$admin_dir/signcerts/"
    cp "$tls_ca_root/"*                                              "$admin_dir/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$admin_dir/config.yaml"

    log_ok "OrdererMSP construido en $org_dir"
}

build_peer_org cliente   "$CLIENTE_DOMAIN"   ClienteMSP   clienteadmin
build_peer_org proveedor "$PROVEEDOR_DOMAIN" ProveedorMSP proveedoradmin
build_orderer_org

log_step "MSPs construidos"
log_info "Siguiente: bash scripts/03-start-network.sh"
