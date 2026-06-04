# Ejercicio 4 — Solución COMPLETA (caso TradeLens / MaritimeChain)

> ⚠ **Este fichero contiene la solución ÍNTEGRA del ejercicio.** Todos los YAML, el chaincode con State-Based Endorsement, los comandos y el `env.sh` están aquí completos. Copia y pega sin tener que rellenar nada.
>
> Para el ejercicio didáctico con huecos y pistas, mira [`ejercicio-tradelens.md`](ejercicio-tradelens.md).
>
> **Versiones probadas**: Hyperledger Fabric 2.5, CouchDB 3.3, Go 1.21, fabric-contract-api-go 1.2.2.
>
> **Diferencias respecto a la solución de Walmart**:
> - 6 organizaciones (3 navieras + 2 puertos + 1 aduanas) en lugar de 4.
> - **3 orderers en Raft** repartidos entre las navieras (en vez de 1) para que ninguna controle el orden.
> - **State-Based Endorsement** en el chaincode: la política de endoso de cada contenedor cambia según quién lo lleva en cada momento.

---

## Estructura final de directorios

```
$HOME/maritimechain/
├── channel-artifacts/
│   └── shipping-channel.block
├── chaincode/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   └── vendor/
├── docker/
│   └── docker-compose-net.yaml
├── network/
│   ├── crypto-config.yaml
│   ├── configtx.yaml
│   └── crypto-config/
│       ├── ordererOrganizations/
│       └── peerOrganizations/
└── env.sh
```

Crea la estructura base:

```bash
mkdir -p $HOME/maritimechain/{network,chaincode,channel-artifacts,docker}
cd $HOME/maritimechain/network
```

---

## Paso 1: `crypto-config.yaml`

Crea `$HOME/maritimechain/network/crypto-config.yaml` con este contenido EXACTO:

```yaml
OrdererOrgs:
  - Name: Orderer
    Domain: maritimechain.org
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer1
        SANS:
          - localhost
          - 127.0.0.1
      - Hostname: orderer2
        SANS:
          - localhost
          - 127.0.0.1
      - Hostname: orderer3
        SANS:
          - localhost
          - 127.0.0.1

PeerOrgs:
  - Name: Maersk
    Domain: maersk.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: MSC
    Domain: msc.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: CMA
    Domain: cma.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Valencia
    Domain: valencia.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Rotterdam
    Domain: rotterdam.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Customs
    Domain: customs.maritimechain.org
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1
```

Genera los certificados:

```bash
cd $HOME/maritimechain/network
cryptogen generate --config=crypto-config.yaml --output=crypto-config
```

**Verificación**:

```bash
ls crypto-config/peerOrganizations/
# Esperado: 6 carpetas (cma, customs, maersk, msc, rotterdam, valencia .maritimechain.org)

ls crypto-config/ordererOrganizations/maritimechain.org/orderers/
# Esperado: 3 orderers (orderer1, orderer2, orderer3 .maritimechain.org)
```

---

## Paso 2: `configtx.yaml`

Crea `$HOME/maritimechain/network/configtx.yaml` con este contenido EXACTO:

```yaml
---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"
    OrdererEndpoints:
      - orderer1.maritimechain.org:7050
      - orderer2.maritimechain.org:8050
      - orderer3.maritimechain.org:9050

  - &Maersk
    Name: MaerskMSP
    ID: MaerskMSP
    MSPDir: crypto-config/peerOrganizations/maersk.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('MaerskMSP.admin', 'MaerskMSP.peer', 'MaerskMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('MaerskMSP.admin', 'MaerskMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('MaerskMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('MaerskMSP.peer')"
    AnchorPeers:
      - Host: peer0.maersk.maritimechain.org
        Port: 7051

  - &MSC
    Name: MSCMSP
    ID: MSCMSP
    MSPDir: crypto-config/peerOrganizations/msc.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('MSCMSP.admin', 'MSCMSP.peer', 'MSCMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('MSCMSP.admin', 'MSCMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('MSCMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('MSCMSP.peer')"
    AnchorPeers:
      - Host: peer0.msc.maritimechain.org
        Port: 9051

  - &CMA
    Name: CMAMSP
    ID: CMAMSP
    MSPDir: crypto-config/peerOrganizations/cma.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('CMAMSP.admin', 'CMAMSP.peer', 'CMAMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('CMAMSP.admin', 'CMAMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('CMAMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('CMAMSP.peer')"
    AnchorPeers:
      - Host: peer0.cma.maritimechain.org
        Port: 11051

  - &Valencia
    Name: ValenciaMSP
    ID: ValenciaMSP
    MSPDir: crypto-config/peerOrganizations/valencia.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('ValenciaMSP.admin', 'ValenciaMSP.peer', 'ValenciaMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('ValenciaMSP.admin', 'ValenciaMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('ValenciaMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('ValenciaMSP.peer')"
    AnchorPeers:
      - Host: peer0.valencia.maritimechain.org
        Port: 13051

  - &Rotterdam
    Name: RotterdamMSP
    ID: RotterdamMSP
    MSPDir: crypto-config/peerOrganizations/rotterdam.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('RotterdamMSP.admin', 'RotterdamMSP.peer', 'RotterdamMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('RotterdamMSP.admin', 'RotterdamMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('RotterdamMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('RotterdamMSP.peer')"
    AnchorPeers:
      - Host: peer0.rotterdam.maritimechain.org
        Port: 15051

  - &Customs
    Name: CustomsMSP
    ID: CustomsMSP
    MSPDir: crypto-config/peerOrganizations/customs.maritimechain.org/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('CustomsMSP.admin', 'CustomsMSP.peer', 'CustomsMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('CustomsMSP.admin', 'CustomsMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('CustomsMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('CustomsMSP.peer')"
    AnchorPeers:
      - Host: peer0.customs.maritimechain.org
        Port: 17051

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults
  OrdererType: etcdraft
  BatchTimeout: 2s
  BatchSize:
    MaxMessageCount: 10
    AbsoluteMaxBytes: 99 MB
    PreferredMaxBytes: 512 KB
  EtcdRaft:
    Consenters:
      - Host: orderer1.maritimechain.org
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls/server.crt
      - Host: orderer2.maritimechain.org
        Port: 8050
        ClientTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls/server.crt
      - Host: orderer3.maritimechain.org
        Port: 9050
        ClientTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls/server.crt
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"
  Capabilities:
    <<: *OrdererCapabilities

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  ShippingChannel:
    <<: *ChannelDefaults
    Consortium: SampleConsortium
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
      Capabilities: *OrdererCapabilities
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Maersk
        - *MSC
        - *CMA
        - *Valencia
        - *Rotterdam
        - *Customs
      Capabilities: *ApplicationCapabilities
```

Genera el bloque génesis:

```bash
cd $HOME/maritimechain/network
export FABRIC_CFG_PATH=$PWD

configtxgen -profile ShippingChannel \
  -outputBlock $HOME/maritimechain/channel-artifacts/shipping-channel.block \
  -channelID shipping-channel
```

**Verificación**:

```bash
ls -la $HOME/maritimechain/channel-artifacts/shipping-channel.block
# Esperado: fichero binario de ~30-40 KB (más grande que en Walmart por las 3 entries Raft)
```

---

## Paso 3: `docker-compose-net.yaml` (15 contenedores)

Crea `$HOME/maritimechain/docker/docker-compose-net.yaml` con este contenido EXACTO. Es largo: 3 orderers + 6 peers + 6 CouchDB.

```yaml
networks:
  fabric-maritime-net:
    name: fabric-maritime-net

volumes:
  orderer1.maritimechain.org:
  orderer2.maritimechain.org:
  orderer3.maritimechain.org:
  peer0.maersk.maritimechain.org:
  peer0.msc.maritimechain.org:
  peer0.cma.maritimechain.org:
  peer0.valencia.maritimechain.org:
  peer0.rotterdam.maritimechain.org:
  peer0.customs.maritimechain.org:

services:

  orderer1.maritimechain.org:
    container_name: orderer1.maritimechain.org
    image: hyperledger/fabric-orderer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=7050
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_CLUSTER_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:7053
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer1.maritimechain.org:9443
    command: orderer
    volumes:
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/msp:/var/hyperledger/orderer/msp
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls:/var/hyperledger/orderer/tls
      - orderer1.maritimechain.org:/var/hyperledger/production/orderer
    ports:
      - 7050:7050
      - 7053:7053
      - 9443:9443
    networks:
      - fabric-maritime-net

  orderer2.maritimechain.org:
    container_name: orderer2.maritimechain.org
    image: hyperledger/fabric-orderer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=8050
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_CLUSTER_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:8053
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer2.maritimechain.org:9448
    command: orderer
    volumes:
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/msp:/var/hyperledger/orderer/msp
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls:/var/hyperledger/orderer/tls
      - orderer2.maritimechain.org:/var/hyperledger/production/orderer
    ports:
      - 8050:8050
      - 8053:8053
      - 9448:9448
    networks:
      - fabric-maritime-net

  orderer3.maritimechain.org:
    container_name: orderer3.maritimechain.org
    image: hyperledger/fabric-orderer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=9050
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_CLUSTER_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:9053
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer3.maritimechain.org:9449
    command: orderer
    volumes:
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/msp:/var/hyperledger/orderer/msp
      - ../network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls:/var/hyperledger/orderer/tls
      - orderer3.maritimechain.org:/var/hyperledger/production/orderer
    ports:
      - 9050:9050
      - 9053:9053
      - 9449:9449
    networks:
      - fabric-maritime-net

  couchdb.maersk:
    container_name: couchdb.maersk
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 5984:5984
    networks:
      - fabric-maritime-net

  peer0.maersk.maritimechain.org:
    container_name: peer0.maersk.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.maersk.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.maersk.maritimechain.org:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.maersk.maritimechain.org:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.maersk.maritimechain.org:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.maersk.maritimechain.org:7051
      - CORE_PEER_LOCALMSPID=MaerskMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.maersk:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.maersk.maritimechain.org:9444
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/maersk.maritimechain.org/peers/peer0.maersk.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/maersk.maritimechain.org/peers/peer0.maersk.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.maersk.maritimechain.org:/var/hyperledger/production
    ports:
      - 7051:7051
      - 9444:9444
    depends_on:
      - couchdb.maersk
    networks:
      - fabric-maritime-net

  couchdb.msc:
    container_name: couchdb.msc
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 7984:5984
    networks:
      - fabric-maritime-net

  peer0.msc.maritimechain.org:
    container_name: peer0.msc.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.msc.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.msc.maritimechain.org:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.msc.maritimechain.org:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.msc.maritimechain.org:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.msc.maritimechain.org:9051
      - CORE_PEER_LOCALMSPID=MSCMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.msc:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.msc.maritimechain.org:9445
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/msc.maritimechain.org/peers/peer0.msc.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/msc.maritimechain.org/peers/peer0.msc.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.msc.maritimechain.org:/var/hyperledger/production
    ports:
      - 9051:9051
      - 9445:9445
    depends_on:
      - couchdb.msc
    networks:
      - fabric-maritime-net

  couchdb.cma:
    container_name: couchdb.cma
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 9984:5984
    networks:
      - fabric-maritime-net

  peer0.cma.maritimechain.org:
    container_name: peer0.cma.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.cma.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.cma.maritimechain.org:11051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:11051
      - CORE_PEER_CHAINCODEADDRESS=peer0.cma.maritimechain.org:11052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:11052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.cma.maritimechain.org:11051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.cma.maritimechain.org:11051
      - CORE_PEER_LOCALMSPID=CMAMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.cma:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.cma.maritimechain.org:9446
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/cma.maritimechain.org/peers/peer0.cma.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/cma.maritimechain.org/peers/peer0.cma.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.cma.maritimechain.org:/var/hyperledger/production
    ports:
      - 11051:11051
      - 9446:9446
    depends_on:
      - couchdb.cma
    networks:
      - fabric-maritime-net

  couchdb.valencia:
    container_name: couchdb.valencia
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 11984:5984
    networks:
      - fabric-maritime-net

  peer0.valencia.maritimechain.org:
    container_name: peer0.valencia.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.valencia.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.valencia.maritimechain.org:13051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:13051
      - CORE_PEER_CHAINCODEADDRESS=peer0.valencia.maritimechain.org:13052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:13052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.valencia.maritimechain.org:13051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.valencia.maritimechain.org:13051
      - CORE_PEER_LOCALMSPID=ValenciaMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.valencia:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.valencia.maritimechain.org:9447
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/valencia.maritimechain.org/peers/peer0.valencia.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/valencia.maritimechain.org/peers/peer0.valencia.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.valencia.maritimechain.org:/var/hyperledger/production
    ports:
      - 13051:13051
      - 9447:9447
    depends_on:
      - couchdb.valencia
    networks:
      - fabric-maritime-net

  couchdb.rotterdam:
    container_name: couchdb.rotterdam
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 13984:5984
    networks:
      - fabric-maritime-net

  peer0.rotterdam.maritimechain.org:
    container_name: peer0.rotterdam.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.rotterdam.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.rotterdam.maritimechain.org:15051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:15051
      - CORE_PEER_CHAINCODEADDRESS=peer0.rotterdam.maritimechain.org:15052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:15052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.rotterdam.maritimechain.org:15051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.rotterdam.maritimechain.org:15051
      - CORE_PEER_LOCALMSPID=RotterdamMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.rotterdam:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.rotterdam.maritimechain.org:9450
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/rotterdam.maritimechain.org/peers/peer0.rotterdam.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/rotterdam.maritimechain.org/peers/peer0.rotterdam.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.rotterdam.maritimechain.org:/var/hyperledger/production
    ports:
      - 15051:15051
      - 9450:9450
    depends_on:
      - couchdb.rotterdam
    networks:
      - fabric-maritime-net

  couchdb.customs:
    container_name: couchdb.customs
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 15984:5984
    networks:
      - fabric-maritime-net

  peer0.customs.maritimechain.org:
    container_name: peer0.customs.maritimechain.org
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.customs.maritimechain.org
      - CORE_PEER_ADDRESS=peer0.customs.maritimechain.org:17051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:17051
      - CORE_PEER_CHAINCODEADDRESS=peer0.customs.maritimechain.org:17052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:17052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.customs.maritimechain.org:17051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.customs.maritimechain.org:17051
      - CORE_PEER_LOCALMSPID=CustomsMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-maritime-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.customs:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.customs.maritimechain.org:9451
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/customs.maritimechain.org/peers/peer0.customs.maritimechain.org/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/customs.maritimechain.org/peers/peer0.customs.maritimechain.org/tls:/etc/hyperledger/fabric/tls
      - peer0.customs.maritimechain.org:/var/hyperledger/production
    ports:
      - 17051:17051
      - 9451:9451
    depends_on:
      - couchdb.customs
    networks:
      - fabric-maritime-net
```

Levanta la red:

```bash
cd $HOME/maritimechain
docker compose -f docker/docker-compose-net.yaml up -d
```

**Verificación**:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "maritimechain|couchdb"
# Esperado: 15 contenedores Up
#   orderer1/2/3.maritimechain.org
#   peer0.{maersk,msc,cma,valencia,rotterdam,customs}.maritimechain.org
#   couchdb.{maersk,msc,cma,valencia,rotterdam,customs}
```

---

## Paso 4: `env.sh` (variables y funciones set_org_*)

Crea `$HOME/maritimechain/env.sh` con este contenido EXACTO:

```bash
#!/usr/bin/env bash
# Variables y funciones para operar la red MaritimeChain.
# Uso: source $HOME/maritimechain/env.sh

export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config

# Orderer (usaremos orderer1 como punto de entrada para osnadmin y commit)
export ORDERER_CA=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls/ca.crt
export ORDERER_ADMIN_TLS_CERT=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls/server.crt
export ORDERER_ADMIN_TLS_KEY=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer1.maritimechain.org/tls/server.key

# TLS de orderer2 y orderer3 (para osnadmin del Paso 5)
export ORDERER2_CA=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls/ca.crt
export ORDERER2_TLS_CERT=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls/server.crt
export ORDERER2_TLS_KEY=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer2.maritimechain.org/tls/server.key
export ORDERER3_CA=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls/ca.crt
export ORDERER3_TLS_CERT=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls/server.crt
export ORDERER3_TLS_KEY=$HOME/maritimechain/network/crypto-config/ordererOrganizations/maritimechain.org/orderers/orderer3.maritimechain.org/tls/server.key

# TLS de cada peer (para --tlsRootCertFiles de invoke/commit)
export PEER_MAERSK_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/maersk.maritimechain.org/peers/peer0.maersk.maritimechain.org/tls/ca.crt
export PEER_MSC_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/msc.maritimechain.org/peers/peer0.msc.maritimechain.org/tls/ca.crt
export PEER_CMA_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/cma.maritimechain.org/peers/peer0.cma.maritimechain.org/tls/ca.crt
export PEER_VALENCIA_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/valencia.maritimechain.org/peers/peer0.valencia.maritimechain.org/tls/ca.crt
export PEER_ROTTERDAM_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/rotterdam.maritimechain.org/peers/peer0.rotterdam.maritimechain.org/tls/ca.crt
export PEER_CUSTOMS_TLS=$HOME/maritimechain/network/crypto-config/peerOrganizations/customs.maritimechain.org/peers/peer0.customs.maritimechain.org/tls/ca.crt

set_org_maersk() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=MaerskMSP
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_MAERSK_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/maersk.maritimechain.org/users/Admin@maersk.maritimechain.org/msp
  echo "→ ahora soy Maersk (puerto 7051)"
}

set_org_msc() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=MSCMSP
  export CORE_PEER_ADDRESS=localhost:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_MSC_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/msc.maritimechain.org/users/Admin@msc.maritimechain.org/msp
  echo "→ ahora soy MSC (puerto 9051)"
}

set_org_cma() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=CMAMSP
  export CORE_PEER_ADDRESS=localhost:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_CMA_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/cma.maritimechain.org/users/Admin@cma.maritimechain.org/msp
  echo "→ ahora soy CMA CGM (puerto 11051)"
}

set_org_valencia() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=ValenciaMSP
  export CORE_PEER_ADDRESS=localhost:13051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_VALENCIA_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/valencia.maritimechain.org/users/Admin@valencia.maritimechain.org/msp
  echo "→ ahora soy Puerto de Valencia (puerto 13051)"
}

set_org_rotterdam() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=RotterdamMSP
  export CORE_PEER_ADDRESS=localhost:15051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ROTTERDAM_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/rotterdam.maritimechain.org/users/Admin@rotterdam.maritimechain.org/msp
  echo "→ ahora soy Puerto de Rotterdam (puerto 15051)"
}

set_org_customs() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=CustomsMSP
  export CORE_PEER_ADDRESS=localhost:17051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_CUSTOMS_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/maritimechain/network/crypto-config/peerOrganizations/customs.maritimechain.org/users/Admin@customs.maritimechain.org/msp
  echo "→ ahora soy Aduanas UE (puerto 17051)"
}
```

Cárgalo:

```bash
source $HOME/maritimechain/env.sh
set_org_maersk
# Esperado: → ahora soy Maersk (puerto 7051)
```

---

## Paso 5: Crear canal y unir peers

```bash
# 5.1 — Unir los 3 orderers al canal (osnadmin, uno por puerto admin)
osnadmin channel join --channelID shipping-channel \
  --config-block $HOME/maritimechain/channel-artifacts/shipping-channel.block \
  -o localhost:7053 --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT --client-key $ORDERER_ADMIN_TLS_KEY

osnadmin channel join --channelID shipping-channel \
  --config-block $HOME/maritimechain/channel-artifacts/shipping-channel.block \
  -o localhost:8053 --ca-file $ORDERER2_CA \
  --client-cert $ORDERER2_TLS_CERT --client-key $ORDERER2_TLS_KEY

osnadmin channel join --channelID shipping-channel \
  --config-block $HOME/maritimechain/channel-artifacts/shipping-channel.block \
  -o localhost:9053 --ca-file $ORDERER3_CA \
  --client-cert $ORDERER3_TLS_CERT --client-key $ORDERER3_TLS_KEY

# 5.2 — Unir los 6 peers al canal
for org in maersk msc cma valencia rotterdam customs; do
  set_org_$org
  peer channel join -b $HOME/maritimechain/channel-artifacts/shipping-channel.block
done

# 5.3 — Verificar
for org in maersk msc cma valencia rotterdam customs; do
  set_org_$org
  peer channel list
done
# Esperado: cada org lista 'shipping-channel'
```

---

## Paso 6: Chaincode `maritimechain` (Go con State-Based Endorsement)

### 6.1 `go.mod`

Crea `$HOME/maritimechain/chaincode/go.mod` con este contenido EXACTO:

```
module maritimechain

go 1.21

require (
	github.com/hyperledger/fabric-contract-api-go v1.2.2
	github.com/hyperledger/fabric-chaincode-go v0.0.0-20230731094759-d199e1582a08
)
```

### 6.2 `main.go`

Crea `$HOME/maritimechain/chaincode/main.go` con este contenido EXACTO:

```go
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-chaincode-go/pkg/statebased"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract implementa el chaincode de trazabilidad marítima con SBE.
type SmartContract struct {
	contractapi.Contract
}

// navierasValidas lista los MSPs autorizados a crear contenedores y a ser carriers.
var navierasValidas = map[string]bool{
	"MaerskMSP": true,
	"MSCMSP":    true,
	"CMAMSP":    true,
}

// Container representa un contenedor trazado.
type Container struct {
	DocType        string         `json:"docType"`
	ContainerID    string         `json:"containerID"`
	CurrentCarrier string         `json:"currentCarrier"`
	Status         string         `json:"status"`
	Origin         string         `json:"origin"`
	Destination    string         `json:"destination"`
	Cargo          string         `json:"cargo"`
	Weight         float64        `json:"weight"`
	History        []HistoryEntry `json:"history"`
}

// HistoryEntry es una entrada del historial del contenedor.
type HistoryEntry struct {
	Event        string `json:"event"`
	Location     string `json:"location"`
	Carrier      string `json:"carrier"`
	FromCarrier  string `json:"fromCarrier,omitempty"`
	ToCarrier    string `json:"toCarrier,omitempty"`
	Timestamp    string `json:"timestamp"`
}

// Clearance representa una autorización aduanera (clave independiente del container).
type Clearance struct {
	ContainerID string `json:"containerID"`
	Approved    bool   `json:"approved"`
	Authority   string `json:"authority"`
	Timestamp   string `json:"timestamp"`
}

// CreateContainer crea un contenedor nuevo. SOLO navieras pueden crearlo.
// La SBE de la clave resultante restringe modificaciones posteriores SOLO a la
// naviera creadora (hasta el siguiente Transship).
func (s *SmartContract) CreateContainer(ctx contractapi.TransactionContextInterface,
	containerID, origin, destination, cargo, weightStr string) error {

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("no se pudo leer MSPID del invocador: %v", err)
	}
	if !navierasValidas[callerMSP] {
		return fmt.Errorf("solo las navieras (Maersk/MSC/CMA) pueden crear contenedores, %s no lo es", callerMSP)
	}

	key := containerKey(containerID)
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("el contenedor %s ya existe", containerID)
	}

	weight, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("weight inválido: %v", err)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	container := Container{
		DocType:        "container",
		ContainerID:    containerID,
		CurrentCarrier: callerMSP,
		Status:         "loaded",
		Origin:         origin,
		Destination:    destination,
		Cargo:          cargo,
		Weight:         weight,
		History: []HistoryEntry{
			{Event: "loaded", Location: origin, Carrier: callerMSP, Timestamp: ts},
		},
	}

	if err := putContainer(ctx, &container); err != nil {
		return err
	}

	// SBE: a partir de aquí, solo callerMSP puede modificar esta clave.
	return setStateEP(ctx, key, callerMSP)
}

// RegisterEvent añade un evento al historial del contenedor.
// SBE restringe esta operación a la naviera actual (currentCarrier).
func (s *SmartContract) RegisterEvent(ctx contractapi.TransactionContextInterface,
	containerID, eventType, location string) error {

	container, err := s.readContainer(ctx, containerID)
	if err != nil {
		return err
	}

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if container.CurrentCarrier != callerMSP {
		return fmt.Errorf("solo la naviera actual (%s) puede registrar eventos, no %s",
			container.CurrentCarrier, callerMSP)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	container.History = append(container.History, HistoryEntry{
		Event:     eventType,
		Location:  location,
		Carrier:   callerMSP,
		Timestamp: ts,
	})
	container.Status = eventType
	return putContainer(ctx, container)
}

// Transship cambia la naviera de un contenedor. La SBE pasa de
// {currentCarrier} a {currentCarrier, newCarrier} dentro de la MISMA transacción,
// lo que obliga a que AMBAS navieras firmen este transbordo.
func (s *SmartContract) Transship(ctx contractapi.TransactionContextInterface,
	containerID, toCarrierMSP, location string) error {

	container, err := s.readContainer(ctx, containerID)
	if err != nil {
		return err
	}

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if container.CurrentCarrier != callerMSP {
		return fmt.Errorf("solo la naviera actual (%s) puede iniciar un transbordo, no %s",
			container.CurrentCarrier, callerMSP)
	}
	if !navierasValidas[toCarrierMSP] {
		return fmt.Errorf("la nueva naviera %s no es válida (debe ser Maersk/MSC/CMA)", toCarrierMSP)
	}
	if toCarrierMSP == callerMSP {
		return fmt.Errorf("transbordo a la misma naviera no tiene sentido")
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	fromCarrier := container.CurrentCarrier
	container.CurrentCarrier = toCarrierMSP
	container.Status = "in_transit"
	container.History = append(container.History, HistoryEntry{
		Event:       "transshipment",
		Location:    location,
		FromCarrier: fromCarrier,
		ToCarrier:   toCarrierMSP,
		Timestamp:   ts,
	})

	key := containerKey(containerID)

	// PRIMERO cambiamos la SBE a AND(fromCarrier, toCarrier).
	// Esto hace que ESTA MISMA tx requiera el endorsement de las dos navieras
	// para validarse (intersección de la política vieja y la nueva).
	if err := setStateEP(ctx, key, fromCarrier, toCarrierMSP); err != nil {
		return err
	}

	// Después, escribimos el container actualizado.
	if err := putContainer(ctx, container); err != nil {
		return err
	}

	// Tras el commit la clave queda bajo SBE {fromCarrier, toCarrierMSP}.
	// Si queremos que a partir de ahora solo la nueva naviera modifique,
	// hacemos un segundo cambio de SBE.
	return setStateEP(ctx, key, toCarrierMSP)
}

// ClearCustoms autoriza el despacho de un contenedor. SOLO CustomsMSP puede.
// NO modifica el container (que está bajo SBE de la naviera); crea una clave
// independiente 'clearance_<id>' con la decisión aduanera.
func (s *SmartContract) ClearCustoms(ctx contractapi.TransactionContextInterface,
	containerID string) error {

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if callerMSP != "CustomsMSP" {
		return fmt.Errorf("solo Aduanas (CustomsMSP) puede autorizar el despacho, no %s", callerMSP)
	}

	// El contenedor debe existir
	if _, err := s.readContainer(ctx, containerID); err != nil {
		return err
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	clearance := Clearance{
		ContainerID: containerID,
		Approved:    true,
		Authority:   callerMSP,
		Timestamp:   ts,
	}
	data, err := json.Marshal(clearance)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(clearanceKey(containerID), data)
}

// ReadContainer devuelve el contenedor completo.
func (s *SmartContract) ReadContainer(ctx contractapi.TransactionContextInterface,
	containerID string) (*Container, error) {
	return s.readContainer(ctx, containerID)
}

// GetContainerHistory devuelve solo el historial.
func (s *SmartContract) GetContainerHistory(ctx contractapi.TransactionContextInterface,
	containerID string) ([]HistoryEntry, error) {
	c, err := s.readContainer(ctx, containerID)
	if err != nil {
		return nil, err
	}
	return c.History, nil
}

// GetClearance devuelve el estado de despacho aduanero (si existe).
func (s *SmartContract) GetClearance(ctx contractapi.TransactionContextInterface,
	containerID string) (*Clearance, error) {
	data, err := ctx.GetStub().GetState(clearanceKey(containerID))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("el contenedor %s no ha sido despachado por aduanas", containerID)
	}
	var c Clearance
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

// === helpers ===

func containerKey(id string) string {
	return "container_" + id
}

func clearanceKey(id string) string {
	return "clearance_" + id
}

func (s *SmartContract) readContainer(ctx contractapi.TransactionContextInterface,
	containerID string) (*Container, error) {
	data, err := ctx.GetStub().GetState(containerKey(containerID))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("el contenedor %s no existe", containerID)
	}
	var c Container
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func putContainer(ctx contractapi.TransactionContextInterface, c *Container) error {
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(containerKey(c.ContainerID), data)
}

// setStateEP fija una política de State-Based Endorsement para una clave,
// exigiendo el endorsement (en AND) de los MSPs indicados.
func setStateEP(ctx contractapi.TransactionContextInterface, key string, mspIDs ...string) error {
	ep, err := statebased.NewStateEP(nil)
	if err != nil {
		return err
	}
	if err := ep.AddOrgs(statebased.RoleTypePeer, mspIDs...); err != nil {
		return err
	}
	policy, err := ep.Policy()
	if err != nil {
		return err
	}
	return ctx.GetStub().SetStateValidationParameter(key, policy)
}

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("error creando chaincode: %v\n", err)
		return
	}
	if err := cc.Start(); err != nil {
		fmt.Printf("error arrancando chaincode: %v\n", err)
	}
}
```

### 6.3 Vendoring

```bash
cd $HOME/maritimechain/chaincode
go mod tidy
go mod vendor
```

### 6.4 Desplegar el chaincode

> 🛑 **NO COPIES ESTA SECCIÓN ENTERA DE GOLPE.** El despliegue tiene **7 sub-pasos** y uno de ellos (el 6.4.3) **requiere que TÚ copies y pegues a mano** el Package ID, un valor que solo conoces en ejecución. Si copias todo el bloque seguido, aprobarás el chaincode con el marcador `PEGA_AQUI_EL_HASH` y, aunque `approve` y `commit` parezcan funcionar, al invocar fallará con:
>
> ```
> chaincode definition for 'maritimechain' exists, but chaincode is not installed
> ```
>
> Ejecuta **un sub-paso cada vez**, leyendo lo que devuelve antes de pasar al siguiente.

Colócate en el directorio y carga las funciones de entorno:

```bash
cd $HOME/maritimechain/network
source $HOME/maritimechain/env.sh
```

#### 6.4.1 — Empaquetar (una sola vez)

```bash
set_org_maersk
peer lifecycle chaincode package maritimechain.tar.gz \
  --path $HOME/maritimechain/chaincode/ \
  --lang golang --label maritimechain_1.0
```

#### 6.4.2 — Instalar en los 6 peers

```bash
for org in maersk msc cma valencia rotterdam customs; do
  set_org_$org
  peer lifecycle chaincode install maritimechain.tar.gz
done
```

#### 6.4.3 — ✋ PARADA OBLIGATORIA: copia el Package ID a mano

Pregunta a Fabric qué Package ID se ha generado:

```bash
peer lifecycle chaincode queryinstalled
```

Verás algo así (el hash será **distinto** en tu máquina):

```
Installed chaincodes on peer:
Package ID: maritimechain_1.0:7a9c1f...e02b, Label: maritimechain_1.0
```

**Copia ese valor completo** (todo lo que va tras `Package ID: ` y antes de la coma) y pégalo aquí, **sustituyendo `PEGA_AQUI_EL_HASH`**:

```bash
# ⚠ EDITA esta línea antes de ejecutarla. NO la dejes con PEGA_AQUI_EL_HASH.
export CC_PACKAGE_ID=maritimechain_1.0:PEGA_AQUI_EL_HASH
```

Comprueba que lo has hecho bien — NO debe aparecer la palabra `PEGA_AQUI`:

```bash
echo "$CC_PACKAGE_ID"
# Correcto:   maritimechain_1.0:7a9c1f...e02b
# INCORRECTO: maritimechain_1.0:PEGA_AQUI_EL_HASH   ← si ves esto, repite el export
```

> Si `echo` te muestra `PEGA_AQUI_EL_HASH`, **párate aquí**: los pasos siguientes aprobarían un paquete inexistente y el invoke fallaría en silencio. Vuelve a copiar el hash real de `queryinstalled`.

#### 6.4.4 — Aprobar desde las 6 orgs

Solo cuando el `echo` muestre el hash real:

```bash
for org in maersk msc cma valencia rotterdam customs; do
  set_org_$org
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
    --tls --cafile $ORDERER_CA \
    --channelID shipping-channel \
    --name maritimechain --version 1.0 \
    --package-id $CC_PACKAGE_ID --sequence 1
done
```

#### 6.4.5 — Verificar aprobaciones

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID shipping-channel \
  --name maritimechain --version 1.0 --sequence 1 \
  --output json
# Esperado: las 6 orgs en "true"
```

> ⚠ **Ojo**: que las 6 salgan en `true` NO garantiza que el Package ID sea correcto — solo que las 6 orgs aprobaron **el mismo** valor (también saldría `true` si todas aprobaron el placeholder). La validación real del Package ID llega al invocar (Paso 7). El `echo` del 6.4.3 es tu única red de seguridad.

#### 6.4.6 — Commit (una sola vez, con los 6 --peerAddresses)

```bash
set_org_maersk
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  --channelID shipping-channel \
  --name maritimechain --version 1.0 --sequence 1 \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MSC_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_CMA_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_VALENCIA_TLS \
  --peerAddresses localhost:15051 --tlsRootCertFiles $PEER_ROTTERDAM_TLS \
  --peerAddresses localhost:17051 --tlsRootCertFiles $PEER_CUSTOMS_TLS
```

#### 6.4.7 — Verificar

```bash
peer lifecycle chaincode querycommitted --channelID shipping-channel --name maritimechain
# Esperado: Version: 1.0, Sequence: 1, ...
```

> 🔧 **Si ya te pasó** (aprobaste con `PEGA_AQUI_EL_HASH` y el invoke del Paso 7 falla con *"chaincode is not installed"*): no necesitas re-commitear ni cambiar de sequence. El Package ID es parte de la **aprobación local de cada org**, no de la definición del canal. Basta con repetir el **6.4.3 bien** (export del hash real + `echo` de comprobación) y volver a ejecutar el **6.4.4** (re-aprobar las 6 orgs con la misma `--sequence 1`). Los errores `requested sequence is 1, but new definition must be sequence 2` al re-hacer checkcommitreadiness/commit son **esperados e inofensivos** (la sequence 1 ya está commiteada): ignóralos y pasa directo al invoke.

---

## Paso 7: Probar el caso (Fase 3) — flujo con transbordo

> 💡 **Conceptos a tener claros antes del primer invoke**:
> - **CreateContainer**: la clave no tiene SBE todavía, así que aplica la política del canal (MAJORITY = 4 de 6). Pasamos los 6 `--peerAddresses` para ir sobrados.
> - **RegisterEvent**: la clave ya tiene SBE `{naviera_actual}`. Basta con el `--peerAddresses` de esa naviera.
> - **Transship**: la SBE va a cambiar dentro de la tx. Como Fabric exige cumplir tanto la política vieja `{from}` como la nueva `{from, to}`, hacen falta los `--peerAddresses` de las DOS navieras.
> - **ClearCustoms**: no toca la clave del contenedor (escribe en `clearance_<id>` que no tiene SBE), así que aplica MAJORITY del canal. Pasamos los 6.

```bash
source $HOME/maritimechain/env.sh   # por si abriste terminal nueva

# 7.1 — Como Maersk: crear el contenedor en Shanghai
set_org_maersk
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MSC_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_CMA_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_VALENCIA_TLS \
  --peerAddresses localhost:15051 --tlsRootCertFiles $PEER_ROTTERDAM_TLS \
  --peerAddresses localhost:17051 --tlsRootCertFiles $PEER_CUSTOMS_TLS \
  -c '{"function":"CreateContainer","Args":["MAEU1234567","Shanghai","Rotterdam","electronics","24500"]}'

# 7.2 — Como Maersk: registrar eventos del viaje
# La clave ya tiene SBE = {MaerskMSP}, basta con el peer de Maersk.
set_org_maersk
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_MAERSK_TLS \
  -c '{"function":"RegisterEvent","Args":["MAEU1234567","departed","Shanghai"]}'

peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_MAERSK_TLS \
  -c '{"function":"RegisterEvent","Args":["MAEU1234567","passed_suez","Suez Canal"]}'

# 7.3 — Transbordo en Singapur: Maersk → MSC. NECESITA las dos firmas.
# Si pasas solo un --peerAddresses, fallará con 'endorsement policy failure'.
set_org_maersk
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_MSC_TLS \
  -c '{"function":"Transship","Args":["MAEU1234567","MSCMSP","Singapore"]}'

# 7.4 — Como MSC: registrar eventos (ahora la SBE es {MSCMSP})
set_org_msc
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_MSC_TLS \
  -c '{"function":"RegisterEvent","Args":["MAEU1234567","arrived","Rotterdam"]}'

# 7.5 — Como Aduanas: dar luz verde (escribe en clearance_<id>, no en el container)
set_org_customs
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MSC_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_CMA_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_VALENCIA_TLS \
  --peerAddresses localhost:15051 --tlsRootCertFiles $PEER_ROTTERDAM_TLS \
  --peerAddresses localhost:17051 --tlsRootCertFiles $PEER_CUSTOMS_TLS \
  -c '{"function":"ClearCustoms","Args":["MAEU1234567"]}'

# 7.6 — Como cualquier miembro: leer el historial completo
set_org_rotterdam
peer chaincode query -C shipping-channel -n maritimechain \
  -c '{"Args":["GetContainerHistory","MAEU1234567"]}'
# Esperado: 4 entradas: loaded(Shanghai) → departed → passed_suez → transshipment(Singapore) → arrived(Rotterdam)

peer chaincode query -C shipping-channel -n maritimechain \
  -c '{"Args":["GetClearance","MAEU1234567"]}'
# Esperado: {"containerID":"MAEU1234567","approved":true,"authority":"CustomsMSP",...}
```

### Validar que el control de acceso funciona

```bash
# 7.7 — Como MSC: intentar registrar un evento DESPUÉS del transbordo funciona,
#       pero ANTES del transbordo (cuando Maersk lo llevaba) NO debería.
#       Si has seguido el orden 7.1-7.4, ya está en manos de MSC y este invoke OK.
#       Para reproducir el rechazo, hazlo entre 7.2 y 7.3.
set_org_msc
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_MSC_TLS \
  -c '{"function":"RegisterEvent","Args":["MAEU1234567","unloaded","Rotterdam"]}'
# Esperado tras 7.4: OK (MSC es la naviera actual y la SBE así lo permite).

# 7.8 — Como Puerto de Valencia: intentar crear un contenedor (debe fallar)
set_org_valencia
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MSC_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_CMA_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_VALENCIA_TLS \
  -c '{"function":"CreateContainer","Args":["XXXX","A","B","carga","1000"]}'
# Esperado: error "solo las navieras (Maersk/MSC/CMA) pueden crear contenedores, ValenciaMSP no lo es"

# 7.9 — Como Maersk: intentar ClearCustoms (debe fallar)
set_org_maersk
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer1.maritimechain.org \
  --tls --cafile $ORDERER_CA \
  -C shipping-channel -n maritimechain \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_MAERSK_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_MSC_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_CMA_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_VALENCIA_TLS \
  -c '{"function":"ClearCustoms","Args":["MAEU1234567"]}'
# Esperado: error "solo Aduanas (CustomsMSP) puede autorizar el despacho, no MaerskMSP"
```

---

## Reset completo

```bash
cd $HOME/maritimechain
docker compose -f docker/docker-compose-net.yaml down -v
docker rmi -f $(docker images -q --filter "reference=dev-peer0*") 2>/dev/null || true
docker network rm fabric-maritime-net 2>/dev/null || true

rm -rf network/crypto-config
rm -f  network/maritimechain.tar.gz
rm -f  channel-artifacts/*.block
```

---

## Referencias

- Doc 03 — Crear red personalizada: [`docs/Modulo 2/03-crear-red-personalizada.md`](../../Modulo%202/03-crear-red-personalizada.md)
- Doc 04 — Chaincode lifecycle: [`docs/Modulo 2/04-chaincode-lifecycle.md`](../../Modulo%202/04-chaincode-lifecycle.md)
- Doc 06 — Operaciones de administración (Raft, channel updates): [`docs/Modulo 2/06-operaciones-administracion.md`](../../Modulo%202/06-operaciones-administracion.md)
- Políticas de endorsement (incluido State-Based Endorsement): [`docs/Modulo 2/politicas-endorsement.md`](../../Modulo%202/politicas-endorsement.md)
- Versión didáctica con huecos: [`ejercicio-tradelens.md`](ejercicio-tradelens.md)
