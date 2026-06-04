# Ejercicio 2 — Solución COMPLETA (caso We.Trade)

> ⚠ **Solución íntegra del ejercicio.** Todos los YAML, el chaincode con las dos funciones que en el ejercicio quedaban incompletas (`set_org_db` y `ConfirmDelivery`), los comandos y el `env.sh` están aquí completos y verificados.
>
> Para el ejercicio didáctico con dos huecos, mira [`ejercicio-wetrade.md`](ejercicio-wetrade.md).
>
> **Versiones probadas**: Hyperledger Fabric 2.5, CouchDB 3.3, Go 1.21, fabric-contract-api-go 1.2.2.

---

## Recordatorio: el modelo tiene 2 capas de actores

Antes de meterse en YAML, retener el modelo mental que se vio en la Fase 1 del ejercicio:

- **PYMEs (clientes — exportadora e importadora)**: son las que disparan cada paso del flujo desde el portal de banca-online de su banco. **NO interactúan con Fabric directamente** y por eso en la red **no son una organización ni un usuario MSP**; aparecen únicamente como strings (`sellerClient`, `buyerClient`) dentro de cada `Operation` para dejar trazabilidad.
- **Bancos (Santander / BBVA / Deutsche Bank)**: son las únicas organizaciones de la red, con MSP propio y peers. Reciben la petición de su PYME, la traducen a un `invoke` y firman la transacción con su MSP. Todo el control de acceso del chaincode se hace **por MSP del banco**, NUNCA por el clientID.

Mapeo de la operación de ejemplo (`OP-2026-000123`) que se prueba en la Fase 3:

| Quién dispara la acción       | Banco que firma en Fabric | Función invocada    |
|-------------------------------|---------------------------|---------------------|
| PYME importadora (BBVA)       | BBVAMSP                   | `CreateOperation`   |
| PYME exportadora (Santander)  | SantanderMSP              | `ApproveOperation`  |
| PYME importadora (BBVA)       | BBVAMSP                   | `ConfirmDelivery`   |
| Cualquiera de las 2 PYMEs     | El banco respectivo       | `ReleasePayment`    |

---

## Estructura final de directorios

```
$HOME/tradefinance/
├── channel-artifacts/
│   └── trade-channel.block
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

Crea la estructura:

```bash
mkdir -p $HOME/tradefinance/{network,chaincode,channel-artifacts,docker}
cd $HOME/tradefinance/network
```

---

## Paso 1: `crypto-config.yaml`

Crea `$HOME/tradefinance/network/crypto-config.yaml`:

```yaml
OrdererOrgs:
  - Name: Orderer
    Domain: tradefinance.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
        SANS:
          - localhost
          - 127.0.0.1

PeerOrgs:
  - Name: Santander
    Domain: santander.tradefinance.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: BBVA
    Domain: bbva.tradefinance.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: DB
    Domain: db.tradefinance.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1
```

Genera:

```bash
cd $HOME/tradefinance/network
cryptogen generate --config=crypto-config.yaml --output=crypto-config
```

---

## Paso 2: `configtx.yaml`

Crea `$HOME/tradefinance/network/configtx.yaml`:

```yaml
---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/tradefinance.com/msp
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
      - orderer.tradefinance.com:7050

  - &Santander
    Name: SantanderMSP
    ID: SantanderMSP
    MSPDir: crypto-config/peerOrganizations/santander.tradefinance.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('SantanderMSP.admin', 'SantanderMSP.peer', 'SantanderMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('SantanderMSP.admin', 'SantanderMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('SantanderMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('SantanderMSP.peer')"
    AnchorPeers:
      - Host: peer0.santander.tradefinance.com
        Port: 7051

  - &BBVA
    Name: BBVAMSP
    ID: BBVAMSP
    MSPDir: crypto-config/peerOrganizations/bbva.tradefinance.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('BBVAMSP.admin', 'BBVAMSP.peer', 'BBVAMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('BBVAMSP.admin', 'BBVAMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('BBVAMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('BBVAMSP.peer')"
    AnchorPeers:
      - Host: peer0.bbva.tradefinance.com
        Port: 9051

  - &DB
    Name: DBMSP
    ID: DBMSP
    MSPDir: crypto-config/peerOrganizations/db.tradefinance.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('DBMSP.admin', 'DBMSP.peer', 'DBMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('DBMSP.admin', 'DBMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('DBMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('DBMSP.peer')"
    AnchorPeers:
      - Host: peer0.db.tradefinance.com
        Port: 11051

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
      - Host: orderer.tradefinance.com
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls/server.crt
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
  TradeChannel:
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
        - *Santander
        - *BBVA
        - *DB
      Capabilities: *ApplicationCapabilities
```

Genera el bloque génesis:

```bash
cd $HOME/tradefinance/network
export FABRIC_CFG_PATH=$PWD

configtxgen -profile TradeChannel \
  -outputBlock $HOME/tradefinance/channel-artifacts/trade-channel.block \
  -channelID trade-channel
```

---

## Paso 3: `docker-compose-net.yaml`

Crea `$HOME/tradefinance/docker/docker-compose-net.yaml`:

```yaml
networks:
  fabric-tradefinance-net:
    name: fabric-tradefinance-net

volumes:
  orderer.tradefinance.com:
  peer0.santander.tradefinance.com:
  peer0.bbva.tradefinance.com:
  peer0.db.tradefinance.com:

services:

  orderer.tradefinance.com:
    container_name: orderer.tradefinance.com
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
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer.tradefinance.com:9443
    command: orderer
    volumes:
      - ../network/crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/msp:/var/hyperledger/orderer/msp
      - ../network/crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls:/var/hyperledger/orderer/tls
      - orderer.tradefinance.com:/var/hyperledger/production/orderer
    ports:
      - 7050:7050
      - 7053:7053
      - 9443:9443
    networks:
      - fabric-tradefinance-net

  couchdb.santander:
    container_name: couchdb.santander
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 5984:5984
    networks:
      - fabric-tradefinance-net

  peer0.santander.tradefinance.com:
    container_name: peer0.santander.tradefinance.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.santander.tradefinance.com
      - CORE_PEER_ADDRESS=peer0.santander.tradefinance.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.santander.tradefinance.com:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.santander.tradefinance.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.santander.tradefinance.com:7051
      - CORE_PEER_LOCALMSPID=SantanderMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-tradefinance-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.santander:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.santander.tradefinance.com:9444
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/santander.tradefinance.com/peers/peer0.santander.tradefinance.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/santander.tradefinance.com/peers/peer0.santander.tradefinance.com/tls:/etc/hyperledger/fabric/tls
      - peer0.santander.tradefinance.com:/var/hyperledger/production
    ports:
      - 7051:7051
      - 9444:9444
    depends_on:
      - couchdb.santander
    networks:
      - fabric-tradefinance-net

  couchdb.bbva:
    container_name: couchdb.bbva
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 7984:5984
    networks:
      - fabric-tradefinance-net

  peer0.bbva.tradefinance.com:
    container_name: peer0.bbva.tradefinance.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.bbva.tradefinance.com
      - CORE_PEER_ADDRESS=peer0.bbva.tradefinance.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.bbva.tradefinance.com:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.bbva.tradefinance.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.bbva.tradefinance.com:9051
      - CORE_PEER_LOCALMSPID=BBVAMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-tradefinance-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.bbva:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.bbva.tradefinance.com:9445
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/bbva.tradefinance.com/peers/peer0.bbva.tradefinance.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/bbva.tradefinance.com/peers/peer0.bbva.tradefinance.com/tls:/etc/hyperledger/fabric/tls
      - peer0.bbva.tradefinance.com:/var/hyperledger/production
    ports:
      - 9051:9051
      - 9445:9445
    depends_on:
      - couchdb.bbva
    networks:
      - fabric-tradefinance-net

  couchdb.db:
    container_name: couchdb.db
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 9984:5984
    networks:
      - fabric-tradefinance-net

  peer0.db.tradefinance.com:
    container_name: peer0.db.tradefinance.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.db.tradefinance.com
      - CORE_PEER_ADDRESS=peer0.db.tradefinance.com:11051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:11051
      - CORE_PEER_CHAINCODEADDRESS=peer0.db.tradefinance.com:11052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:11052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.db.tradefinance.com:11051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.db.tradefinance.com:11051
      - CORE_PEER_LOCALMSPID=DBMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-tradefinance-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.db:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.db.tradefinance.com:9446
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../network/crypto-config/peerOrganizations/db.tradefinance.com/peers/peer0.db.tradefinance.com/msp:/etc/hyperledger/fabric/msp
      - ../network/crypto-config/peerOrganizations/db.tradefinance.com/peers/peer0.db.tradefinance.com/tls:/etc/hyperledger/fabric/tls
      - peer0.db.tradefinance.com:/var/hyperledger/production
    ports:
      - 11051:11051
      - 9446:9446
    depends_on:
      - couchdb.db
    networks:
      - fabric-tradefinance-net
```

Levanta la red:

```bash
cd $HOME/tradefinance
docker compose -f docker/docker-compose-net.yaml up -d
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "tradefinance|couchdb"
# Esperado: 7 contenedores Up
```

---

## Paso 4: `env.sh` (completo, incluida la función que faltaba)

Crea `$HOME/tradefinance/env.sh`:

```bash
#!/usr/bin/env bash
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config

export ORDERER_CA=$HOME/tradefinance/network/crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls/ca.crt
export ORDERER_ADMIN_TLS_CERT=$HOME/tradefinance/network/crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls/server.crt
export ORDERER_ADMIN_TLS_KEY=$HOME/tradefinance/network/crypto-config/ordererOrganizations/tradefinance.com/orderers/orderer.tradefinance.com/tls/server.key

export PEER_SANTANDER_TLS=$HOME/tradefinance/network/crypto-config/peerOrganizations/santander.tradefinance.com/peers/peer0.santander.tradefinance.com/tls/ca.crt
export PEER_BBVA_TLS=$HOME/tradefinance/network/crypto-config/peerOrganizations/bbva.tradefinance.com/peers/peer0.bbva.tradefinance.com/tls/ca.crt
export PEER_DB_TLS=$HOME/tradefinance/network/crypto-config/peerOrganizations/db.tradefinance.com/peers/peer0.db.tradefinance.com/tls/ca.crt

set_org_santander() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=SantanderMSP
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_SANTANDER_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/tradefinance/network/crypto-config/peerOrganizations/santander.tradefinance.com/users/Admin@santander.tradefinance.com/msp
  echo "→ ahora soy Santander (puerto 7051)"
}

set_org_bbva() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=BBVAMSP
  export CORE_PEER_ADDRESS=localhost:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_BBVA_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/tradefinance/network/crypto-config/peerOrganizations/bbva.tradefinance.com/users/Admin@bbva.tradefinance.com/msp
  echo "→ ahora soy BBVA (puerto 9051)"
}

# Esta era la función que faltaba en el ejercicio.
set_org_db() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=DBMSP
  export CORE_PEER_ADDRESS=localhost:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_DB_TLS
  export CORE_PEER_MSPCONFIGPATH=$HOME/tradefinance/network/crypto-config/peerOrganizations/db.tradefinance.com/users/Admin@db.tradefinance.com/msp
  echo "→ ahora soy Deutsche Bank (puerto 11051)"
}
```

Cárgalo:

```bash
source $HOME/tradefinance/env.sh
```

---

## Paso 5: Crear canal y unir peers

```bash
osnadmin channel join --channelID trade-channel \
  --config-block $HOME/tradefinance/channel-artifacts/trade-channel.block \
  -o localhost:7053 --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT --client-key $ORDERER_ADMIN_TLS_KEY

for org in santander bbva db; do
  set_org_$org
  peer channel join -b $HOME/tradefinance/channel-artifacts/trade-channel.block
done

for org in santander bbva db; do
  set_org_$org
  peer channel list
done
```

---

## Paso 6: Chaincode `tradefinance` (Go, completo)

### 6.1 `go.mod`

```
module tradefinance

go 1.21

require github.com/hyperledger/fabric-contract-api-go v1.2.2
```

### 6.2 `main.go` — incluida la función `ConfirmDelivery` completa

```go
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

type Operation struct {
	DocType      string         `json:"docType"`
	OperationID  string         `json:"operationID"`
	SellerOrg    string         `json:"sellerOrg"`
	BuyerOrg     string         `json:"buyerOrg"`
	SellerClient string         `json:"sellerClient"`
	BuyerClient  string         `json:"buyerClient"`
	Description  string         `json:"description"`
	Amount       float64        `json:"amount"`
	Currency     string         `json:"currency"`
	Status       string         `json:"status"`
	CreatedAt    string         `json:"createdAt"`
	History      []HistoryEntry `json:"history"`
}

type HistoryEntry struct {
	Org       string `json:"org"`
	Action    string `json:"action"`
	Timestamp string `json:"timestamp"`
}

var bancosValidos = map[string]bool{
	"SantanderMSP": true,
	"BBVAMSP":      true,
	"DBMSP":        true,
}

func (s *SmartContract) CreateOperation(ctx contractapi.TransactionContextInterface,
	operationID, sellerOrg, sellerClient, buyerClient, description, amountStr, currency string) error {

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if !bancosValidos[callerMSP] {
		return fmt.Errorf("solo los bancos del consorcio pueden crear operaciones, %s no lo es", callerMSP)
	}
	if !bancosValidos[sellerOrg] {
		return fmt.Errorf("sellerOrg %s no es un banco válido", sellerOrg)
	}
	if sellerOrg == callerMSP {
		return fmt.Errorf("el banco del vendedor y el del comprador deben ser distintos")
	}

	if exists, _ := s.operationExists(ctx, operationID); exists {
		return fmt.Errorf("la operación %s ya existe", operationID)
	}

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return fmt.Errorf("amount inválido: %v", err)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	op := Operation{
		DocType:      "tradeOperation",
		OperationID:  operationID,
		SellerOrg:    sellerOrg,
		BuyerOrg:     callerMSP,
		SellerClient: sellerClient,
		BuyerClient:  buyerClient,
		Description:  description,
		Amount:       amount,
		Currency:     currency,
		Status:       "created",
		CreatedAt:    ts,
		History: []HistoryEntry{
			{Org: callerMSP, Action: "created", Timestamp: ts},
		},
	}
	return putOperation(ctx, &op)
}

func (s *SmartContract) ApproveOperation(ctx contractapi.TransactionContextInterface,
	operationID string) error {

	op, err := s.readOperation(ctx, operationID)
	if err != nil {
		return err
	}

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if callerMSP != op.SellerOrg {
		return fmt.Errorf("solo el banco del vendedor (%s) puede aprobar, no %s", op.SellerOrg, callerMSP)
	}
	if op.Status != "created" {
		return fmt.Errorf("la operación está en estado %q, no se puede aprobar (debe estar en 'created')", op.Status)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	op.Status = "approved"
	op.History = append(op.History, HistoryEntry{Org: callerMSP, Action: "approved", Timestamp: ts})
	return putOperation(ctx, op)
}

// ConfirmDelivery — esta es la función que el alumno tenía que implementar.
// Es espejo casi exacto de ApproveOperation, cambiando 3 cosas:
//   1) compara con op.BuyerOrg (no SellerOrg)
//   2) el estado previo debe ser "approved" (no "created")
//   3) el nuevo estado es "delivered" (no "approved")
func (s *SmartContract) ConfirmDelivery(ctx contractapi.TransactionContextInterface,
	operationID string) error {

	op, err := s.readOperation(ctx, operationID)
	if err != nil {
		return err
	}

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if callerMSP != op.BuyerOrg {
		return fmt.Errorf("solo el banco del comprador (%s) puede confirmar la entrega, no %s", op.BuyerOrg, callerMSP)
	}
	if op.Status != "approved" {
		return fmt.Errorf("la operación está en estado %q, no se puede confirmar (debe estar en 'approved')", op.Status)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	op.Status = "delivered"
	op.History = append(op.History, HistoryEntry{Org: callerMSP, Action: "delivered", Timestamp: ts})
	return putOperation(ctx, op)
}

func (s *SmartContract) ReleasePayment(ctx contractapi.TransactionContextInterface,
	operationID string) error {

	op, err := s.readOperation(ctx, operationID)
	if err != nil {
		return err
	}

	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return err
	}
	if callerMSP != op.SellerOrg && callerMSP != op.BuyerOrg {
		return fmt.Errorf("solo los bancos involucrados (%s o %s) pueden liberar el pago", op.SellerOrg, op.BuyerOrg)
	}
	if op.Status != "delivered" {
		return fmt.Errorf("la operación está en estado %q, no se puede liberar el pago (debe estar en 'delivered')", op.Status)
	}

	ts := time.Now().UTC().Format(time.RFC3339)
	op.Status = "paid"
	op.History = append(op.History, HistoryEntry{Org: callerMSP, Action: "paid", Timestamp: ts})
	return putOperation(ctx, op)
}

func (s *SmartContract) ReadOperation(ctx contractapi.TransactionContextInterface,
	operationID string) (*Operation, error) {
	return s.readOperation(ctx, operationID)
}

func (s *SmartContract) GetOperationHistory(ctx contractapi.TransactionContextInterface,
	operationID string) ([]HistoryEntry, error) {
	op, err := s.readOperation(ctx, operationID)
	if err != nil {
		return nil, err
	}
	return op.History, nil
}

// === helpers ===

func operationKey(id string) string { return "op_" + id }

func (s *SmartContract) operationExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	data, err := ctx.GetStub().GetState(operationKey(id))
	return data != nil, err
}

func (s *SmartContract) readOperation(ctx contractapi.TransactionContextInterface, id string) (*Operation, error) {
	data, err := ctx.GetStub().GetState(operationKey(id))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("la operación %s no existe", id)
	}
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

func putOperation(ctx contractapi.TransactionContextInterface, op *Operation) error {
	data, err := json.Marshal(op)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(operationKey(op.OperationID), data)
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
cd $HOME/tradefinance/chaincode
go mod tidy
go mod vendor
```

### 6.4 Desplegar

> 🛑 **NO COPIES ESTA SECCIÓN ENTERA DE GOLPE.** Tiene **7 sub-pasos** y uno de ellos (el 6.4.3) **requiere que TÚ copies y pegues a mano** el Package ID, un valor que solo conoces en ejecución. Si copias todo el bloque seguido, aprobarás con el marcador `PEGA_AQUI_EL_HASH` y, aunque `approve` y `commit` parezcan ir bien, al invocar fallará con:
>
> ```
> chaincode definition for 'tradefinance' exists, but chaincode is not installed
> ```
>
> Ejecuta **un sub-paso cada vez**, leyendo lo que devuelve antes de seguir.

```bash
cd $HOME/tradefinance/network
source $HOME/tradefinance/env.sh
```

#### 6.4.1 — Empaquetar (una sola vez)

```bash
set_org_santander
peer lifecycle chaincode package tradefinance.tar.gz \
  --path $HOME/tradefinance/chaincode/ \
  --lang golang --label tradefinance_1.0
```

#### 6.4.2 — Instalar en los 3 peers

```bash
for org in santander bbva db; do
  set_org_$org
  peer lifecycle chaincode install tradefinance.tar.gz
done
```

#### 6.4.3 — ✋ PARADA OBLIGATORIA: copia el Package ID a mano

```bash
peer lifecycle chaincode queryinstalled
```

Verás algo así (el hash será **distinto** en tu máquina):

```
Installed chaincodes on peer:
Package ID: tradefinance_1.0:5b3e90...c14a, Label: tradefinance_1.0
```

**Copia ese valor completo** (lo que va tras `Package ID: ` y antes de la coma) y pégalo aquí, **sustituyendo `PEGA_AQUI_EL_HASH`**:

```bash
# ⚠ EDITA esta línea antes de ejecutarla. NO la dejes con PEGA_AQUI_EL_HASH.
export CC_PACKAGE_ID=tradefinance_1.0:PEGA_AQUI_EL_HASH
```

Comprueba que lo has hecho bien — NO debe aparecer `PEGA_AQUI`:

```bash
echo "$CC_PACKAGE_ID"
# Correcto:   tradefinance_1.0:5b3e90...c14a
# INCORRECTO: tradefinance_1.0:PEGA_AQUI_EL_HASH   ← si ves esto, repite el export
```

> Si `echo` muestra `PEGA_AQUI_EL_HASH`, **párate aquí**: los pasos siguientes aprobarían un paquete inexistente y el invoke fallaría en silencio. Copia el hash real de `queryinstalled`.

#### 6.4.4 — Aprobar desde las 3 orgs

Solo cuando el `echo` muestre el hash real:

```bash
for org in santander bbva db; do
  set_org_$org
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
    --tls --cafile $ORDERER_CA \
    --channelID trade-channel \
    --name tradefinance --version 1.0 \
    --package-id $CC_PACKAGE_ID --sequence 1
done
```

#### 6.4.5 — Verificar aprobaciones

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID trade-channel \
  --name tradefinance --version 1.0 --sequence 1 \
  --output json
# Esperado: las 3 orgs en "true"
```

> ⚠ **Ojo**: que las 3 salgan en `true` NO garantiza que el Package ID sea correcto — solo que las 3 aprobaron **el mismo** valor (también saldría `true` con el placeholder). La validación real llega al invocar (Paso 7). El `echo` del 6.4.3 es tu red de seguridad.

#### 6.4.6 — Commit (una sola vez, con los 3 --peerAddresses)

```bash
set_org_santander
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  --channelID trade-channel \
  --name tradefinance --version 1.0 --sequence 1 \
  --peerAddresses localhost:7051  --tlsRootCertFiles $PEER_SANTANDER_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_BBVA_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_DB_TLS
```

#### 6.4.7 — Verificar

```bash
peer lifecycle chaincode querycommitted --channelID trade-channel --name tradefinance
# Esperado: Version: 1.0, Sequence: 1, ...
```

> 🔧 **Si ya te pasó** (aprobaste con `PEGA_AQUI_EL_HASH` y el invoke falla con *"chaincode is not installed"*): no hace falta re-commitear ni cambiar de sequence. El Package ID es parte de la **aprobación local de cada org**, no de la definición del canal. Repite el **6.4.3 bien** (export del hash real + `echo`) y vuelve a ejecutar el **6.4.4** (re-aprobar las 3 orgs con la misma `--sequence 1`). Los errores `requested sequence is 1, but new definition must be sequence 2` al re-hacer checkcommitreadiness/commit son **esperados e inofensivos** (la sequence 1 ya está commiteada): ignóralos y pasa directo al invoke.

---

## Paso 7: Probar el caso (Fase 3)

```bash
source $HOME/tradefinance/env.sh

# 1. Como BBVA: crear operación (Santander será el banco del vendedor)
set_org_bbva
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  -C trade-channel -n tradefinance \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_BBVA_TLS \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_SANTANDER_TLS \
  -c '{"function":"CreateOperation","Args":["OP-2026-000123","SantanderMSP","pyme-export-001","pyme-import-042","500 unidades producto X","50000","EUR"]}'

# 2. Como Santander: aprobar
set_org_santander
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  -C trade-channel -n tradefinance \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_SANTANDER_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_BBVA_TLS \
  -c '{"function":"ApproveOperation","Args":["OP-2026-000123"]}'

# 3. Como BBVA: confirmar entrega
set_org_bbva
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  -C trade-channel -n tradefinance \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_BBVA_TLS \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_SANTANDER_TLS \
  -c '{"function":"ConfirmDelivery","Args":["OP-2026-000123"]}'

# 4. Como Santander: liberar pago
set_org_santander
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  -C trade-channel -n tradefinance \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_SANTANDER_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_BBVA_TLS \
  -c '{"function":"ReleasePayment","Args":["OP-2026-000123"]}'

# 5. Como Deutsche Bank: leer la operación (no estuvo involucrado pero puede verla)
set_org_db
peer chaincode query -C trade-channel -n tradefinance \
  -c '{"Args":["ReadOperation","OP-2026-000123"]}'
# Esperado: status=paid, 4 entradas en history

peer chaincode query -C trade-channel -n tradefinance \
  -c '{"Args":["GetOperationHistory","OP-2026-000123"]}'
# Esperado: [created BBVAMSP, approved SantanderMSP, delivered BBVAMSP, paid SantanderMSP]
```

### Validar control de acceso

```bash
# Como Deutsche Bank: intentar aprobar (debe fallar — no es el seller)
set_org_db
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.tradefinance.com \
  --tls --cafile $ORDERER_CA \
  -C trade-channel -n tradefinance \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_DB_TLS \
  --peerAddresses localhost:9051  --tlsRootCertFiles $PEER_BBVA_TLS \
  -c '{"function":"ApproveOperation","Args":["OP-2026-000123"]}'
# Esperado: error "solo el banco del vendedor (SantanderMSP) puede aprobar, no DBMSP"
```

---

## Reset completo

```bash
cd $HOME/tradefinance
docker compose -f docker/docker-compose-net.yaml down -v
docker rmi -f $(docker images -q --filter "reference=dev-peer0*") 2>/dev/null || true
docker network rm fabric-tradefinance-net 2>/dev/null || true
rm -rf network/crypto-config
rm -f  network/tradefinance.tar.gz
rm -f  channel-artifacts/*.block
```

---

## Referencias

- Doc 03 — Crear red personalizada: [`docs/Modulo 2/03-crear-red-personalizada.md`](../../Modulo%202/03-crear-red-personalizada.md)
- Doc 04 — Chaincode lifecycle: [`docs/Modulo 2/04-chaincode-lifecycle.md`](../../Modulo%202/04-chaincode-lifecycle.md)
- Doc 06 — Operaciones de administración: [`docs/Modulo 2/06-operaciones-administracion.md`](../../Modulo%202/06-operaciones-administracion.md)
- Versión didáctica con dos huecos: [`ejercicio-wetrade.md`](ejercicio-wetrade.md)
