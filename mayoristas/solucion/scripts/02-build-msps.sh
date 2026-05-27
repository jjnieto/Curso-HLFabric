#!/usr/bin/env bash
# 02-build-msps.sh
# Construye la estructura organizations/{peerOrganizations,ordererOrganizations}
# a partir del material crypto que las CAs generaron en network/fabric-ca/.

source "$(dirname "$0")/common.sh"

# Copia el fichero más reciente que matchee el glob al fichero destino.
# Necesario porque keystore/ y signcerts/ pueden tener más de un fichero
# si se re-enrolla una identidad (cada enroll deja una clave nueva).
cp_latest_to_file() {
    local src_glob="$1" dest="$2"
    local latest
    # shellcheck disable=SC2086
    latest=$(ls -t $src_glob 2>/dev/null | head -1)
    if [ -z "$latest" ]; then
        log_err "No hay archivos que coincidan con: $src_glob"
        exit 1
    fi
    cp "$latest" "$dest"
}

# Copia al directorio destino la única clave privada del keystore origen que
# corresponde al cert.pem indicado. Imprescindible cuando hubo re-enrolls:
# fabric-ca-client deja claves stale en keystore/ y solo una matchea con el
# cert actual. Coger otra rompe la firma de cualquier transacción.
cp_matching_key_to_dir() {
    local src_keystore="$1" src_cert="$2" dest_dir="$3"
    local cert_pub matched=""
    cert_pub=$(openssl x509 -in "$src_cert" -pubkey -noout 2>/dev/null)
    if [ -z "$cert_pub" ]; then
        log_err "No puedo extraer la clave pública del cert: $src_cert"
        exit 1
    fi
    for k in "$src_keystore"/*_sk; do
        [ -f "$k" ] || continue
        local key_pub
        key_pub=$(openssl ec -in "$k" -pubout 2>/dev/null)
        if [ "$cert_pub" = "$key_pub" ]; then
            matched="$k"
            break
        fi
    done
    if [ -z "$matched" ]; then
        log_err "Ninguna clave en $src_keystore coincide con $src_cert"
        exit 1
    fi
    cp "$matched" "$dest_dir/"
}

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

    local tls_ca_root="$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/tlscacerts"

    # MSP de la org (channel MSP)
    cp "$NETWORK_DIR/fabric-ca/$org/admin/msp/cacerts/"* "$org_dir/msp/cacerts/"
    cp "$tls_ca_root/"*                                  "$org_dir/msp/tlscacerts/"
    build_org_msp_yaml "$org_dir/msp"

    # MSP local del peer
    local peer_dir="$org_dir/peers/peer0.$domain"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/msp/cacerts/"*   "$peer_dir/msp/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/$org/peer0/msp/signcerts/"* "$peer_dir/msp/signcerts/"
    cp_matching_key_to_dir "$NETWORK_DIR/fabric-ca/$org/peer0/msp/keystore" \
                           "$peer_dir/msp/signcerts/cert.pem" \
                           "$peer_dir/msp/keystore"
    cp "$tls_ca_root/"*                                    "$peer_dir/msp/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$peer_dir/msp/config.yaml"

    # TLS del peer (destino = fichero → seleccionamos el más reciente)
    cp_latest_to_file "$tls_ca_root/*"                                         "$peer_dir/tls/ca.crt"
    cp_latest_to_file "$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/keystore/*"   "$peer_dir/tls/server.key"
    cp_latest_to_file "$NETWORK_DIR/fabric-ca/$org/peer0/tls/msp/signcerts/*"  "$peer_dir/tls/server.crt"

    # MSP local del admin
    local admin_dir="$org_dir/users/Admin@$domain/msp"
    cp "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/cacerts/"*   "$admin_dir/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/signcerts/"* "$admin_dir/signcerts/"
    cp_matching_key_to_dir "$NETWORK_DIR/fabric-ca/$org/$admin_user/msp/keystore" \
                           "$admin_dir/signcerts/cert.pem" \
                           "$admin_dir/keystore"
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
    mkdir -p "$org_dir"/orderers/$ORDERER_HOST/msp/{cacerts,tlscacerts,keystore,signcerts}
    mkdir -p "$org_dir"/orderers/$ORDERER_HOST/tls
    mkdir -p "$org_dir"/users/Admin@$domain/msp/{cacerts,tlscacerts,keystore,signcerts}

    local tls_ca_root="$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/tlscacerts"

    cp "$NETWORK_DIR/fabric-ca/orderer/admin/msp/cacerts/"* "$org_dir/msp/cacerts/"
    cp "$tls_ca_root/"*                                     "$org_dir/msp/tlscacerts/"
    build_org_msp_yaml "$org_dir/msp"

    local ord_dir="$org_dir/orderers/$ORDERER_HOST"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/cacerts/"*   "$ord_dir/msp/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/signcerts/"* "$ord_dir/msp/signcerts/"
    cp_matching_key_to_dir "$NETWORK_DIR/fabric-ca/orderer/orderer/msp/keystore" \
                           "$ord_dir/msp/signcerts/cert.pem" \
                           "$ord_dir/msp/keystore"
    cp "$tls_ca_root/"*                                         "$ord_dir/msp/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$ord_dir/msp/config.yaml"

    cp_latest_to_file "$tls_ca_root/*"                                              "$ord_dir/tls/ca.crt"
    cp_latest_to_file "$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/keystore/*"   "$ord_dir/tls/server.key"
    cp_latest_to_file "$NETWORK_DIR/fabric-ca/orderer/orderer/tls/msp/signcerts/*"  "$ord_dir/tls/server.crt"

    local admin_dir="$org_dir/users/Admin@$domain/msp"
    cp "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/cacerts/"*   "$admin_dir/cacerts/"
    cp "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/signcerts/"* "$admin_dir/signcerts/"
    cp_matching_key_to_dir "$NETWORK_DIR/fabric-ca/orderer/ordereradmin/msp/keystore" \
                           "$admin_dir/signcerts/cert.pem" \
                           "$admin_dir/keystore"
    cp "$tls_ca_root/"*                                              "$admin_dir/tlscacerts/"
    cp "$org_dir/msp/config.yaml" "$admin_dir/config.yaml"

    log_ok "OrdererMSP construido en $org_dir"
}

build_peer_org fabricante "$FABRICANTE_DOMAIN" FabricanteMSP fabricanteadmin
build_peer_org mayorista  "$MAYORISTA_DOMAIN"  MayoristaMSP  mayoristaadmin
build_peer_org minorista  "$MINORISTA_DOMAIN"  MinoristaMSP  minoristaadmin
build_orderer_org

log_step "MSPs construidos"
log_info "Siguiente: bash scripts/03-start-network.sh"
