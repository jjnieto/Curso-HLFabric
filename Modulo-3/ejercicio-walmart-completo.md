# Ejercicio 1 — Solución COMPLETA (caso Walmart)

> ⚠ **Este fichero contiene la solución ÍNTEGRA del ejercicio.** Todos los YAML, el chaincode, los comandos y el `env.sh` están aquí completos y han sido verificados. La intención es que copies y pegues sin tener que rellenar nada.
>
> Para el ejercicio didáctico con huecos y pistas, mira [`ejercicio-walmart.md`](ejercicio-walmart.md).
>
> **Versiones probadas**: Hyperledger Fabric 2.5, CouchDB 3.3, Go 1.21, fabric-contract-api-go 1.2.2.

---

## Estructura final de directorios

Al terminar tendrás esto:

```
$HOME/foodtrace/
├── channel-artifacts/
│   └── trazabilidad-channel.block
├── chaincode/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   └── vendor/                     ← se genera con 'go mod vendor'
├── docker/
│   └── docker-compose-net.yaml
├── network/
│   ├── crypto-config.yaml
│   ├── configtx.yaml
│   ├── collections_config.json
│   └── crypto-config/              ← se genera con 'cryptogen generate'
│       ├── ordererOrganizations/
│       └── peerOrganizations/
└── env.sh
```

Crea la estructura base ahora:

```bash
mkdir -p $HOME/foodtrace/{network,chaincode,channel-artifacts,docker}
cd $HOME/foodtrace/network
```

---

## Paso 1: `crypto-config.yaml` (certificados)

Crea `$HOME/foodtrace/network/crypto-config.yaml` con este contenido EXACTO:

```yaml
OrdererOrgs:
  - Name: Orderer
    Domain: foodtrace.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
        SANS:
          - localhost
          - 127.0.0.1

PeerOrgs:
  - Name: Productor
    Domain: productor.foodtrace.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Distribuidor
    Domain: distribuidor.foodtrace.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Supermercado
    Domain: supermercado.foodtrace.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Regulador
    Domain: regulador.foodtrace.com
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
cd $HOME/foodtrace/network
cryptogen generate --config=crypto-config.yaml --output=crypto-config
```

**Verificación**:

```bash
ls crypto-config/peerOrganizations/
# Esperado: distribuidor.foodtrace.com  productor.foodtrace.com  regulador.foodtrace.com  supermercado.foodtrace.com

ls crypto-config/ordererOrganizations/
# Esperado: foodtrace.com
```

---

## Paso 2: `configtx.yaml` (canal)

Crea `$HOME/foodtrace/network/configtx.yaml` con este contenido EXACTO:

```yaml
---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/foodtrace.com/msp
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
      - orderer.foodtrace.com:7050

  - &Productor
    Name: ProductorMSP
    ID: ProductorMSP
    MSPDir: crypto-config/peerOrganizations/productor.foodtrace.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('ProductorMSP.admin', 'ProductorMSP.peer', 'ProductorMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('ProductorMSP.admin', 'ProductorMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('ProductorMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('ProductorMSP.peer')"
    AnchorPeers:
      - Host: peer0.productor.foodtrace.com
        Port: 7051

  - &Distribuidor
    Name: DistribuidorMSP
    ID: DistribuidorMSP
    MSPDir: crypto-config/peerOrganizations/distribuidor.foodtrace.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('DistribuidorMSP.admin', 'DistribuidorMSP.peer', 'DistribuidorMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('DistribuidorMSP.admin', 'DistribuidorMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('DistribuidorMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('DistribuidorMSP.peer')"
    AnchorPeers:
      - Host: peer0.distribuidor.foodtrace.com
        Port: 9051

  - &Supermercado
    Name: SupermercadoMSP
    ID: SupermercadoMSP
    MSPDir: crypto-config/peerOrganizations/supermercado.foodtrace.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('SupermercadoMSP.admin', 'SupermercadoMSP.peer', 'SupermercadoMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('SupermercadoMSP.admin', 'SupermercadoMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('SupermercadoMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('SupermercadoMSP.peer')"
    AnchorPeers:
      - Host: peer0.supermercado.foodtrace.com
        Port: 11051

  - &Regulador
    Name: ReguladorMSP
    ID: ReguladorMSP
    MSPDir: crypto-config/peerOrganizations/regulador.foodtrace.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('ReguladorMSP.admin', 'ReguladorMSP.peer', 'ReguladorMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('ReguladorMSP.admin', 'ReguladorMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('ReguladorMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('ReguladorMSP.peer')"
    AnchorPeers:
      - Host: peer0.regulador.foodtrace.com
        Port: 13051

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
      - Host: orderer.foodtrace.com
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls/server.crt
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
  TrazabilidadChannel:
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
        - *Productor
        - *Distribuidor
        - *Supermercado
        - *Regulador
      Capabilities: *ApplicationCapabilities
```

Genera el bloque génesis del canal:

```bash
cd $HOME/foodtrace/network
export FABRIC_CFG_PATH=$PWD

configtxgen -profile TrazabilidadChannel \
  -outputBlock $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block \
  -channelID trazabilidad-channel
```

**Verificación**:

```bash
ls -la $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block
# Esperado: fichero binario de unos 20-30 KB
```

---

## Paso 3: `docker-compose-net.yaml` (red)

Crea `$HOME/foodtrace/docker/docker-compose-net.yaml` con este contenido EXACTO:

```yaml
networks:
  fabric-foodtrace-net:
    name: fabric-foodtrace-net

volumes:
  orderer.foodtrace.com:
  peer0.productor.foodtrace.com:
  peer0.distribuidor.foodtrace.com:
  peer0.supermercado.foodtrace.com:
  peer0.regulador.foodtrace.com:

services:

  orderer.foodtrace.com:
    container_name: orderer.foodtrace.com
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
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer.foodtrace.com:9443
    command: orderer
    volumes:
      - ../network/crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/msp:/var/hyperledger/orderer/msp
      - ../network/crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls:/var/hyperledger/orderer/tls
      - orderer.foodtrace.com:/var/hyperledger/production/orderer
    ports:
      - 7050:7050
      - 7053:7053
      - 9443:9443
    networks:
      - fabric-foodtrace-net

  couchdb.productor:
    container_name: couchdb.productor
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 5984:5984
    networks:
      - fabric-foodtrace-net

  peer0.productor.foodtrace.com:
    container_name: peer0.productor.foodtrace.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.productor.foodtrace.com
      - CORE_PEER_ADDRESS=peer0.productor.foodtrace.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.productor.foodtrace.com:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.productor.foodtrace.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.productor.foodtrace.com:7051
      - CORE_PEER_LOCALMSPID=ProductorMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-foodtrace-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.productor:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.productor.foodtrace.com:9444
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/productor.foodtrace.com/peers/peer0.productor.foodtrace.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/productor.foodtrace.com/peers/peer0.productor.foodtrace.com/tls:/etc/hyperledger/fabric/tls
      - peer0.productor.foodtrace.com:/var/hyperledger/production
    ports:
      - 7051:7051
      - 9444:9444
    depends_on:
      - couchdb.productor
    networks:
      - fabric-foodtrace-net

  couchdb.distribuidor:
    container_name: couchdb.distribuidor
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 7984:5984
    networks:
      - fabric-foodtrace-net

  peer0.distribuidor.foodtrace.com:
    container_name: peer0.distribuidor.foodtrace.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.distribuidor.foodtrace.com
      - CORE_PEER_ADDRESS=peer0.distribuidor.foodtrace.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.distribuidor.foodtrace.com:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.distribuidor.foodtrace.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.distribuidor.foodtrace.com:9051
      - CORE_PEER_LOCALMSPID=DistribuidorMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-foodtrace-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.distribuidor:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.distribuidor.foodtrace.com:9445
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/distribuidor.foodtrace.com/peers/peer0.distribuidor.foodtrace.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/distribuidor.foodtrace.com/peers/peer0.distribuidor.foodtrace.com/tls:/etc/hyperledger/fabric/tls
      - peer0.distribuidor.foodtrace.com:/var/hyperledger/production
    ports:
      - 9051:9051
      - 9445:9445
    depends_on:
      - couchdb.distribuidor
    networks:
      - fabric-foodtrace-net

  couchdb.supermercado:
    container_name: couchdb.supermercado
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 9984:5984
    networks:
      - fabric-foodtrace-net

  peer0.supermercado.foodtrace.com:
    container_name: peer0.supermercado.foodtrace.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.supermercado.foodtrace.com
      - CORE_PEER_ADDRESS=peer0.supermercado.foodtrace.com:11051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:11051
      - CORE_PEER_CHAINCODEADDRESS=peer0.supermercado.foodtrace.com:11052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:11052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.supermercado.foodtrace.com:11051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.supermercado.foodtrace.com:11051
      - CORE_PEER_LOCALMSPID=SupermercadoMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-foodtrace-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.supermercado:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.supermercado.foodtrace.com:9446
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/supermercado.foodtrace.com/peers/peer0.supermercado.foodtrace.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/supermercado.foodtrace.com/peers/peer0.supermercado.foodtrace.com/tls:/etc/hyperledger/fabric/tls
      - peer0.supermercado.foodtrace.com:/var/hyperledger/production
    ports:
      - 11051:11051
      - 9446:9446
    depends_on:
      - couchdb.supermercado
    networks:
      - fabric-foodtrace-net

  couchdb.regulador:
    container_name: couchdb.regulador
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 11984:5984
    networks:
      - fabric-foodtrace-net

  peer0.regulador.foodtrace.com:
    container_name: peer0.regulador.foodtrace.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.regulador.foodtrace.com
      - CORE_PEER_ADDRESS=peer0.regulador.foodtrace.com:13051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:13051
      - CORE_PEER_CHAINCODEADDRESS=peer0.regulador.foodtrace.com:13052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:13052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.regulador.foodtrace.com:13051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.regulador.foodtrace.com:13051
      - CORE_PEER_LOCALMSPID=ReguladorMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-foodtrace-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.regulador:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.regulador.foodtrace.com:9447
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/regulador.foodtrace.com/peers/peer0.regulador.foodtrace.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/regulador.foodtrace.com/peers/peer0.regulador.foodtrace.com/tls:/etc/hyperledger/fabric/tls
      - peer0.regulador.foodtrace.com:/var/hyperledger/production
    ports:
      - 13051:13051
      - 9447:9447
    depends_on:
      - couchdb.regulador
    networks:
      - fabric-foodtrace-net
```

Levanta la red:

```bash
cd $HOME/foodtrace
docker compose -f docker/docker-compose-net.yaml up -d
```

**Verificación**:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "foodtrace|couchdb"
# Esperado: 9 contenedores en estado "Up"
#   orderer.foodtrace.com
#   peer0.productor.foodtrace.com  + couchdb.productor
#   peer0.distribuidor.foodtrace.com + couchdb.distribuidor
#   peer0.supermercado.foodtrace.com + couchdb.supermercado
#   peer0.regulador.foodtrace.com  + couchdb.regulador
```

---

## Paso 4: `env.sh` (variables de entorno)

Crea `$HOME/foodtrace/env.sh` con este contenido EXACTO:

```bash
#!/usr/bin/env bash
# Variables y funciones para operar la red FoodTrace.
# Uso: source $HOME/foodtrace/env.sh

# FABRIC_CFG_PATH apunta al core.yaml de fabric-samples (necesario para 'peer' y 'osnadmin')
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config

# Rutas TLS del orderer (para osnadmin y para el commit del chaincode)
export ORDERER_CA=$HOME/foodtrace/network/crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls/ca.crt
export ORDERER_ADMIN_TLS_CERT=$HOME/foodtrace/network/crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls/server.crt
export ORDERER_ADMIN_TLS_KEY=$HOME/foodtrace/network/crypto-config/ordererOrganizations/foodtrace.com/orderers/orderer.foodtrace.com/tls/server.key

# Rutas TLS de cada peer (para --tlsRootCertFiles del invoke/commit)
export PEER_PRODUCTOR_TLS=$HOME/foodtrace/network/crypto-config/peerOrganizations/productor.foodtrace.com/peers/peer0.productor.foodtrace.com/tls/ca.crt
export PEER_DISTRIBUIDOR_TLS=$HOME/foodtrace/network/crypto-config/peerOrganizations/distribuidor.foodtrace.com/peers/peer0.distribuidor.foodtrace.com/tls/ca.crt
export PEER_SUPERMERCADO_TLS=$HOME/foodtrace/network/crypto-config/peerOrganizations/supermercado.foodtrace.com/peers/peer0.supermercado.foodtrace.com/tls/ca.crt
export PEER_REGULADOR_TLS=$HOME/foodtrace/network/crypto-config/peerOrganizations/regulador.foodtrace.com/peers/peer0.regulador.foodtrace.com/tls/ca.crt

set_org_productor() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=ProductorMSP
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_PRODUCTOR_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/foodtrace/network/crypto-config/peerOrganizations/productor.foodtrace.com/users/Admin@productor.foodtrace.com/msp
  echo "→ ahora soy Productor (puerto 7051)"
}

set_org_distribuidor() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=DistribuidorMSP
  export CORE_PEER_ADDRESS=localhost:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_DISTRIBUIDOR_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/foodtrace/network/crypto-config/peerOrganizations/distribuidor.foodtrace.com/users/Admin@distribuidor.foodtrace.com/msp
  echo "→ ahora soy Distribuidor (puerto 9051)"
}

set_org_supermercado() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=SupermercadoMSP
  export CORE_PEER_ADDRESS=localhost:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_SUPERMERCADO_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/foodtrace/network/crypto-config/peerOrganizations/supermercado.foodtrace.com/users/Admin@supermercado.foodtrace.com/msp
  echo "→ ahora soy Supermercado (puerto 11051)"
}

set_org_regulador() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=ReguladorMSP
  export CORE_PEER_ADDRESS=localhost:13051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_REGULADOR_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/foodtrace/network/crypto-config/peerOrganizations/regulador.foodtrace.com/users/Admin@regulador.foodtrace.com/msp
  echo "→ ahora soy Regulador (puerto 13051)"
}
```

Cárgalo en la terminal:

```bash
source $HOME/foodtrace/env.sh
```

**Verificación**:

```bash
set_org_productor
# Esperado: → ahora soy Productor (puerto 7051)

ls $CORE_PEER_MSPCONFIGPATH
# Esperado: admincerts  cacerts  IssuerPublicKey  IssuerRevocationPublicKey  keystore  signcerts  user
```

---

## Paso 5: Crear canal y unir peers

```bash
# 5.1 — Unir el orderer al canal (usa osnadmin)
osnadmin channel join --channelID trazabilidad-channel \
  --config-block $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block \
  -o localhost:7053 --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT \
  --client-key $ORDERER_ADMIN_TLS_KEY

# 5.2 — Unir cada peer al canal
set_org_productor
peer channel join -b $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block

set_org_distribuidor
peer channel join -b $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block

set_org_supermercado
peer channel join -b $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block

set_org_regulador
peer channel join -b $HOME/foodtrace/channel-artifacts/trazabilidad-channel.block

# 5.3 — Verificar que los 4 peers están en el canal
for org in productor distribuidor supermercado regulador; do
  set_org_$org
  peer channel list
done
# Esperado: cada org lista 'trazabilidad-channel'
```

---

## Paso 6: `collections_config.json` (Private Data Collections)

Crea `$HOME/foodtrace/network/collections_config.json` con este contenido EXACTO:

```json
[
  {
    "name": "priceAgreement",
    "policy": "OR('ProductorMSP.member', 'DistribuidorMSP.member')",
    "requiredPeerCount": 1,
    "maxPeerCount": 2,
    "blockToLive": 0,
    "memberOnlyRead": true,
    "memberOnlyWrite": true
  },
  {
    "name": "wholesalePrice",
    "policy": "OR('DistribuidorMSP.member', 'SupermercadoMSP.member')",
    "requiredPeerCount": 1,
    "maxPeerCount": 2,
    "blockToLive": 0,
    "memberOnlyRead": true,
    "memberOnlyWrite": true
  }
]
```

---

## Paso 7: Chaincode `foodtrace` (Go)

### 7.1 `go.mod`

Crea `$HOME/foodtrace/chaincode/go.mod` con este contenido EXACTO:

```
module foodtrace

go 1.21

require github.com/hyperledger/fabric-contract-api-go v1.2.2
```

### 7.2 `main.go`

Crea `$HOME/foodtrace/chaincode/main.go` con este contenido EXACTO:

```go
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract implementa el chaincode de trazabilidad.
type SmartContract struct {
	contractapi.Contract
}

// Lot representa un lote de producto trazado en el ledger.
type Lot struct {
	DocType       string         `json:"docType"`
	LotID         string         `json:"lotID"`
	ProductType   string         `json:"productType"`
	Origin        string         `json:"origin"`
	Producer      string         `json:"producer"`
	CurrentHolder string         `json:"currentHolder"`
	Status        string         `json:"status"`
	Temperature   float64        `json:"temperature"`
	Weight        float64        `json:"weight"`
	History       []HistoryEntry `json:"history"`
}

// HistoryEntry representa una entrada en el historial de un lote.
type HistoryEntry struct {
	Org       string `json:"org"`
	Action    string `json:"action"`
	Timestamp string `json:"timestamp"`
	Location  string `json:"location"`
}

// ProduceLot crea un nuevo lote (solo el productor que invoca queda como producer/currentHolder).
func (s *SmartContract) ProduceLot(ctx contractapi.TransactionContextInterface,
	lotID, productType, origin, weightStr string) error {

	exists, err := s.lotExists(ctx, lotID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("el lote %s ya existe", lotID)
	}

	weight, err := strconv.ParseFloat(weightStr, 64)
	if err != nil {
		return fmt.Errorf("weight inválido: %v", err)
	}

	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("no se pudo obtener MSPID del invocador: %v", err)
	}

	ts := time.Now().UTC().Format(time.RFC3339)

	lot := Lot{
		DocType:       "foodLot",
		LotID:         lotID,
		ProductType:   productType,
		Origin:        origin,
		Producer:      mspID,
		CurrentHolder: mspID,
		Status:        "produced",
		Temperature:   0,
		Weight:        weight,
		History: []HistoryEntry{
			{Org: mspID, Action: "produced", Timestamp: ts, Location: origin},
		},
	}

	lotBytes, err := json.Marshal(lot)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(lotID, lotBytes)
}

// TransferLot transfiere la posesión del lote a otra org y actualiza temperatura+localización.
func (s *SmartContract) TransferLot(ctx contractapi.TransactionContextInterface,
	lotID, toMSP, location, temperatureStr string) error {

	lot, err := s.readLot(ctx, lotID)
	if err != nil {
		return err
	}

	caller, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if lot.CurrentHolder != caller {
		return fmt.Errorf("solo el holder actual (%s) puede transferir el lote, no %s",
			lot.CurrentHolder, caller)
	}

	temp, err := strconv.ParseFloat(temperatureStr, 64)
	if err != nil {
		return fmt.Errorf("temperature inválida: %v", err)
	}

	ts := time.Now().UTC().Format(time.RFC3339)

	lot.CurrentHolder = toMSP
	lot.Status = "in_transit"
	lot.Temperature = temp
	lot.History = append(lot.History, HistoryEntry{
		Org:       caller,
		Action:    fmt.Sprintf("transferred_to_%s", toMSP),
		Timestamp: ts,
		Location:  location,
	})

	lotBytes, err := json.Marshal(lot)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(lotID, lotBytes)
}

// ReadLot devuelve el lote completo en JSON.
func (s *SmartContract) ReadLot(ctx contractapi.TransactionContextInterface, lotID string) (*Lot, error) {
	return s.readLot(ctx, lotID)
}

// GetLotHistory devuelve solo la lista de entradas históricas.
func (s *SmartContract) GetLotHistory(ctx contractapi.TransactionContextInterface, lotID string) ([]HistoryEntry, error) {
	lot, err := s.readLot(ctx, lotID)
	if err != nil {
		return nil, err
	}
	return lot.History, nil
}

// RecallLot marca un lote como retirado del mercado.
func (s *SmartContract) RecallLot(ctx contractapi.TransactionContextInterface,
	lotID, reason string) error {

	lot, err := s.readLot(ctx, lotID)
	if err != nil {
		return err
	}

	caller, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	lot.Status = "recalled"
	lot.History = append(lot.History, HistoryEntry{
		Org:       caller,
		Action:    fmt.Sprintf("recalled: %s", reason),
		Timestamp: ts,
		Location:  "",
	})

	lotBytes, err := json.Marshal(lot)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(lotID, lotBytes)
}

// SetPrivatePrice guarda un precio privado en una colección.
// El precio se pasa por transient data, no como argumento (queda off-chain).
func (s *SmartContract) SetPrivatePrice(ctx contractapi.TransactionContextInterface,
	lotID, collection string) error {

	transient, err := ctx.GetStub().GetTransient()
	if err != nil {
		return err
	}
	priceBytes, ok := transient["price"]
	if !ok {
		return fmt.Errorf("falta el dato transient 'price'")
	}
	return ctx.GetStub().PutPrivateData(collection, lotID, priceBytes)
}

// GetPrivatePrice lee un precio privado de una colección.
// Devuelve error si el invocador no es miembro de la colección.
func (s *SmartContract) GetPrivatePrice(ctx contractapi.TransactionContextInterface,
	lotID, collection string) (string, error) {

	data, err := ctx.GetStub().GetPrivateData(collection, lotID)
	if err != nil {
		return "", fmt.Errorf("no se pudo leer la colección %s: %v", collection, err)
	}
	if data == nil {
		return "", fmt.Errorf("no hay precio privado para el lote %s en %s", lotID, collection)
	}
	return string(data), nil
}

// === helpers ===

func (s *SmartContract) lotExists(ctx contractapi.TransactionContextInterface, lotID string) (bool, error) {
	data, err := ctx.GetStub().GetState(lotID)
	if err != nil {
		return false, err
	}
	return data != nil, nil
}

func (s *SmartContract) readLot(ctx contractapi.TransactionContextInterface, lotID string) (*Lot, error) {
	data, err := ctx.GetStub().GetState(lotID)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("el lote %s no existe", lotID)
	}
	var lot Lot
	if err := json.Unmarshal(data, &lot); err != nil {
		return nil, err
	}
	return &lot, nil
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

### 7.3 Vendoring (dependencias dentro del paquete)

Fabric necesita que las dependencias de Go vivan dentro del propio paquete (`vendor/`). Ejecuta:

```bash
cd $HOME/foodtrace/chaincode
go mod tidy
go mod vendor
```

**Verificación**:

```bash
ls vendor/github.com/hyperledger/fabric-contract-api-go/
# Esperado: contractapi  internal  metadata  serializer
```

### 7.4 Desplegar el chaincode

> 🛑 **NO COPIES ESTA SECCIÓN ENTERA DE GOLPE.** El despliegue tiene **7 sub-pasos** y uno de ellos (el 7.4.3) **requiere que TÚ copies y pegues a mano** un valor que solo conoces en ejecución (el Package ID). Si copias todo el bloque seguido, aprobarás el chaincode con un valor de marcador (`PEGA_AQUI_EL_HASH`) y, aunque `approve` y `commit` parezcan funcionar, al invocar fallará con:
>
> ```
> chaincode definition for 'foodtrace' exists, but chaincode is not installed
> ```
>
> Ejecuta **un sub-paso cada vez**, leyendo lo que devuelve antes de pasar al siguiente.

Empieza colocándote en el directorio y cargando las funciones de entorno:

```bash
cd $HOME/foodtrace/network
source $HOME/foodtrace/env.sh   # por si abriste terminal nueva
```

#### 7.4.1 — Empaquetar (una sola vez)

```bash
set_org_productor
peer lifecycle chaincode package foodtrace.tar.gz \
  --path $HOME/foodtrace/chaincode/ \
  --lang golang --label foodtrace_1.0
```

#### 7.4.2 — Instalar en los 4 peers

```bash
for org in productor distribuidor supermercado regulador; do
  set_org_$org
  peer lifecycle chaincode install foodtrace.tar.gz
done
```

Cada instalación imprime una línea con el Package ID. Lo verás también en el siguiente paso.

#### 7.4.3 — ✋ PARADA OBLIGATORIA: copia el Package ID a mano

Este es el sub-paso que **no se puede automatizar copiando**. Primero pregunta a Fabric qué Package ID se ha generado:

```bash
peer lifecycle chaincode queryinstalled
```

Verás algo así (el hash será **distinto** en tu máquina):

```
Installed chaincodes on peer:
Package ID: foodtrace_1.0:302e49cb2e3619702a0eae19c3b4c0717a63e0ca72fa75af2bae7cea40622000, Label: foodtrace_1.0
```

Ahora **copia ese valor completo** (todo lo que va después de `Package ID: ` y antes de la coma) y pégalo en este comando, **sustituyendo el texto `PEGA_AQUI_EL_HASH`**:

```bash
# ⚠ EDITA esta línea antes de ejecutarla. NO la dejes con PEGA_AQUI_EL_HASH.
export CC_PACKAGE_ID=foodtrace_1.0:PEGA_AQUI_EL_HASH
```

Comprueba que lo has hecho bien — el siguiente comando NO debe contener la palabra `PEGA_AQUI`:

```bash
echo "$CC_PACKAGE_ID"
# Correcto:   foodtrace_1.0:302e49cb2e36...40622000
# INCORRECTO: foodtrace_1.0:PEGA_AQUI_EL_HASH   ← si ves esto, repite el export
```

> Si `echo` te muestra `PEGA_AQUI_EL_HASH`, **párate aquí**: todos los pasos siguientes fallarían en silencio (aprobarían un paquete inexistente). Vuelve a copiar el hash real de `queryinstalled`.

#### 7.4.4 — Aprobar desde las 4 orgs

Solo cuando el `echo` anterior muestre el hash real, ejecuta:

```bash
for org in productor distribuidor supermercado regulador; do
  set_org_$org
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
    --tls --cafile $ORDERER_CA \
    --channelID trazabilidad-channel \
    --name foodtrace --version 1.0 \
    --package-id $CC_PACKAGE_ID --sequence 1 \
    --collections-config $HOME/foodtrace/network/collections_config.json
done
```

#### 7.4.5 — Verificar aprobaciones

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID trazabilidad-channel \
  --name foodtrace --version 1.0 --sequence 1 \
  --collections-config $HOME/foodtrace/network/collections_config.json \
  --output json
# Esperado: las 4 orgs en "true"
```

> ⚠ **Ojo**: que las 4 salgan en `true` NO garantiza que el Package ID sea correcto — solo que las 4 orgs aprobaron **el mismo** valor. Si todas aprobaron el placeholder, también saldrá `true`. La validación real del Package ID llega al invocar (Paso 8). Por eso el `echo` del 7.4.3 es tu única red de seguridad aquí.

#### 7.4.6 — Commit (una sola vez, recogiendo endorsements de las 4 orgs)

```bash
set_org_productor
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
  --tls --cafile $ORDERER_CA \
  --channelID trazabilidad-channel \
  --name foodtrace --version 1.0 --sequence 1 \
  --collections-config $HOME/foodtrace/network/collections_config.json \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_PRODUCTOR_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_DISTRIBUIDOR_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_SUPERMERCADO_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_REGULADOR_TLS
```

#### 7.4.7 — Verificar

```bash
peer lifecycle chaincode querycommitted --channelID trazabilidad-channel --name foodtrace
# Esperado: Committed chaincode definition for chaincode 'foodtrace' on channel 'trazabilidad-channel':
#   Version: 1.0, Sequence: 1, ...
```

> 🔧 **Si ya te pasó** (aprobaste con `PEGA_AQUI_EL_HASH` y el invoke del Paso 8 falla con *"chaincode is not installed"*): no necesitas re-commitear ni cambiar de sequence. El Package ID es parte de la **aprobación local de cada org**, no de la definición del canal. Basta con repetir el **7.4.3 bien** (export del hash real + `echo` de comprobación) y volver a ejecutar el **7.4.4** (re-aprobar las 4 orgs con la misma `--sequence 1`). Tras eso, el invoke funcionará sin tocar el commit.

---

## Paso 8: Probar el caso (Fase 3)

```bash
source $HOME/foodtrace/env.sh   # por si abriste terminal nueva

# 8.1 — Como Productor: crear un lote
set_org_productor
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
  --tls --cafile $ORDERER_CA \
  -C trazabilidad-channel -n foodtrace \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_PRODUCTOR_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_DISTRIBUIDOR_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_SUPERMERCADO_TLS \
  -c '{"function":"ProduceLot","Args":["LOT-AGU-2026-001","aguacate","Malaga","500"]}'

# 8.2 — Como Productor: acordar precio privado con Distribuidor (vía transient)
#       Aunque la colección priceAgreement solo la tienen Productor y Distribuidor,
#       hay que pasar 3 --peerAddresses para cumplir la endorsement policy MAJORITY
#       del canal (3 de 4 orgs). Supermercado endorsa solo el HASH del dato privado;
#       no almacenará el contenido porque no es miembro de la colección.
set_org_productor
export PRICE_DATA=$(echo -n '{"price":1500,"currency":"EUR"}' | base64 | tr -d '\n')
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
  --tls --cafile $ORDERER_CA \
  -C trazabilidad-channel -n foodtrace \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_PRODUCTOR_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_DISTRIBUIDOR_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_SUPERMERCADO_TLS \
  --transient "{\"price\":\"$PRICE_DATA\"}" \
  -c '{"function":"SetPrivatePrice","Args":["LOT-AGU-2026-001","priceAgreement"]}'

# 8.3 — Como Productor: transferir el lote al Distribuidor
set_org_productor
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
  --tls --cafile $ORDERER_CA \
  -C trazabilidad-channel -n foodtrace \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_PRODUCTOR_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_DISTRIBUIDOR_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_SUPERMERCADO_TLS \
  -c '{"function":"TransferLot","Args":["LOT-AGU-2026-001","DistribuidorMSP","Malaga","6.5"]}'

# 8.4 — Como Distribuidor: leer el lote
set_org_distribuidor
peer chaincode query -C trazabilidad-channel -n foodtrace \
  -c '{"Args":["ReadLot","LOT-AGU-2026-001"]}'
# Esperado: el JSON del lote con currentHolder=DistribuidorMSP, status=in_transit

# 8.5 — Como Supermercado: leer el historial del lote
set_org_supermercado
peer chaincode query -C trazabilidad-channel -n foodtrace \
  -c '{"Args":["GetLotHistory","LOT-AGU-2026-001"]}'
# Esperado: JSON con 2 entradas (produced + transferred_to_DistribuidorMSP)

# 8.6 — Como Regulador: hacer recall del lote
set_org_regulador
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.foodtrace.com \
  --tls --cafile $ORDERER_CA \
  -C trazabilidad-channel -n foodtrace \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_PRODUCTOR_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_DISTRIBUIDOR_TLS \
  --peerAddresses localhost:13051 --tlsRootCertFiles $PEER_REGULADOR_TLS \
  -c '{"function":"RecallLot","Args":["LOT-AGU-2026-001","Contaminacion detectada"]}'

# 8.7 — Confirmar que el status es 'recalled'
set_org_supermercado
peer chaincode query -C trazabilidad-channel -n foodtrace \
  -c '{"Args":["ReadLot","LOT-AGU-2026-001"]}'
# Esperado: status=recalled, history con la entrada del recall
```

### Validar que la privacidad funciona

```bash
# 8.8 — Como Productor: SÍ puede leer priceAgreement (es miembro)
set_org_productor
peer chaincode query -C trazabilidad-channel -n foodtrace \
  -c '{"Args":["GetPrivatePrice","LOT-AGU-2026-001","priceAgreement"]}'
# Esperado: {"price":1500,"currency":"EUR"}

# 8.9 — Como Supermercado: NO puede leer priceAgreement (no es miembro)
set_org_supermercado
peer chaincode query -C trazabilidad-channel -n foodtrace \
  -c '{"Args":["GetPrivatePrice","LOT-AGU-2026-001","priceAgreement"]}'
# Esperado: error indicando que no es parte de la colección
```

---

## Reset completo (si algo falla)

Si quieres empezar de cero:

```bash
cd $HOME/foodtrace
docker compose -f docker/docker-compose-net.yaml down -v
docker rmi -f $(docker images -q --filter "reference=dev-peer0*") 2>/dev/null || true
docker network rm fabric-foodtrace-net 2>/dev/null || true

rm -rf network/crypto-config
rm -f  network/foodtrace.tar.gz
rm -f  channel-artifacts/*.block
```

Después, vuelve al Paso 1.

---

## Referencias

- Doc 03 — Crear red personalizada: [`docs/Modulo 2/03-crear-red-personalizada.md`](../../Modulo%202/03-crear-red-personalizada.md)
- Doc 04 — Chaincode lifecycle: [`docs/Modulo 2/04-chaincode-lifecycle.md`](../../Modulo%202/04-chaincode-lifecycle.md)
- Doc 06 — Operaciones de administración: [`docs/Modulo 2/06-operaciones-administracion.md`](../../Modulo%202/06-operaciones-administracion.md)
- Versión didáctica con huecos: [`ejercicio-walmart.md`](ejercicio-walmart.md)
