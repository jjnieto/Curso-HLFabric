# 02 - Arquitectura de red: FidelityChain

## Topologia de la red

Nuestra red tiene la estructura mínima para un consorcio real: dos organizaciones independientes que comparten un canal. Cada una mantiene su propio peer y valida las transacciones de la otra.

```mermaid
graph TB
    subgraph "Red FidelityChain"
        subgraph Hotel["Org1 — HotelMSP"]
            peer1["peer0.hotel.fidelitychain.com<br/>Puerto: 7051<br/>Endorser + Committer"]
            ca1["CA Hotel<br/>Certificados X.509"]
            admin1["Admin@hotel"]
        end

        subgraph Cafeteria["Org2 — CafeteriaMSP"]
            peer2["peer0.cafeteria.fidelitychain.com<br/>Puerto: 9051<br/>Endorser + Committer"]
            ca2["CA Cafeteria<br/>Certificados X.509"]
            admin2["Admin@cafeteria"]
        end

        subgraph Orderer["OrdererOrg"]
            ord["orderer.fidelitychain.com<br/>Puerto: 7050 / Admin: 7053<br/>Raft (1 nodo)"]
        end

        canal["Canal: fidelity-channel"]

        ord --- canal
        peer1 --- canal
        peer2 --- canal
        ca1 -.-> peer1
        ca1 -.-> admin1
        ca2 -.-> peer2
        ca2 -.-> admin2
    end

    style peer1 fill:#22627E,color:#fff
    style peer2 fill:#0D9448,color:#fff
    style ord fill:#B45D09,color:#fff
    style canal fill:#EC0000,color:#fff
    style ca1 fill:#7C3AED,color:#fff
    style ca2 fill:#7C3AED,color:#fff
```

### Decisiones de diseño

| Decisión | Eleccion | Motivo |
|----------|----------|--------|
| Organizaciones | 2 (Hotel + Cafeteria) | Mínimo para demostrar consorcio |
| Peers por org | 1 | Suficiente para desarrollo |
| Orderer | Raft, 1 nodo | Simplicidad (producción: 3-5 nodos) |
| Canal | 1 (fidelity-channel) | Ambas orgs comparten todos los datos |
| Base de datos | CouchDB | Necesitamos rich queries para historial |
| Chaincode | Go + Node.js | Ambas versiones para el curso |
| Política endorsement | AND(Hotel, Cafeteria) | Ambas orgs deben aprobar cada transacción |

> **¿Por que AND y no MAJORITY?** Con solo 2 organizaciones, MAJORITY seria "al menos 1", lo que permitiria que una org modifique el ledger sin aprobación de la otra. AND garantiza que ambas validen cada transacción.

---

## Contenedores Docker

```mermaid
graph LR
    subgraph "docker compose"
        O["orderer.fidelitychain.com<br/>fabric-orderer:2.5"]
        P1["peer0.hotel.fidelitychain.com<br/>fabric-peer:2.5"]
        P2["peer0.cafeteria.fidelitychain.com<br/>fabric-peer:2.5"]
        DB1["couchdb.hotel<br/>couchdb:3.3<br/>Puerto: 5984"]
        DB2["couchdb.cafeteria<br/>couchdb:3.3<br/>Puerto: 7984"]
        CLI["cli<br/>fabric-tools:2.5"]
    end

    P1 --> DB1
    P2 --> DB2

    style O fill:#B45D09,color:#fff
    style P1 fill:#22627E,color:#fff
    style P2 fill:#0D9448,color:#fff
    style DB1 fill:#22627E,color:#fff
    style DB2 fill:#0D9448,color:#fff
    style CLI fill:#666,color:#fff
```

| Contenedor | Imagen | Puerto | Propósito |
|-----------|--------|--------|-----------|
| orderer.fidelitychain.com | fabric-orderer:2.5 | 7050, 7053 | Servicio de ordenación |
| peer0.hotel.fidelitychain.com | fabric-peer:2.5 | 7051 | Peer del hotel |
| peer0.cafeteria.fidelitychain.com | fabric-peer:2.5 | 9051 | Peer de la cafeteria |
| couchdb.hotel | couchdb:3.3 | 5984 | World State del hotel |
| couchdb.cafeteria | couchdb:3.3 | 7984 | World State de la cafeteria |
| cli | fabric-tools:2.5 | - | Administración |

> **¿Por que CouchDB?** Porque necesitamos rich queries para buscar transacciones por cliente, por tipo o por rango de fechas. Con LevelDB solo podriamos buscar por clave exacta o por rango de claves.

---

## Identidades y permisos

```mermaid
graph TB
    subgraph "HotelMSP"
        HA["Admin@hotel<br/>role: admin"]
        HO["Operador@hotel<br/>role: operator"]
    end

    subgraph "CafeteriaMSP"
        CAD["Admin@cafeteria<br/>role: admin"]
        CO["Operador@cafeteria<br/>role: operator"]
    end

    HA -- "Puede: Mint, RegisterClient,<br/>BalanceOf, History" --> CC["Chaincode<br/>fidelitypoints"]
    CAD -- "Puede: Redeem, RegisterClient,<br/>BalanceOf, History" --> CC

    style HA fill:#22627E,color:#fff
    style CAD fill:#0D9448,color:#fff
    style CC fill:#B45D09,color:#fff
```

El control de acceso se implementa en el chaincode verificando el MSPID del caller:
- `HotelMSP` → puede ejecutar `Mint`
- `CafeteriaMSP` → puede ejecutar `Redeem`
- Ambos → pueden ejecutar `RegisterClient`, `BalanceOf`, `ClientHistory`, `GetTokenInfo`

---

## Estructura del proyecto

```
proyecto-fidelitychain/
├── network/
│   ├── crypto-config.yaml            # Definicion de orgs e identidades
│   ├── configtx.yaml                 # Topologia del canal y politicas
│   └── docker/
│       └── docker-compose.yaml       # Todos los contenedores
├── chaincode/
│   ├── chaincode-go/                 # Chaincode en Go
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── fidelitypoints.go         # Contrato principal
│   │   └── fidelitypoints_test.go    # Tests unitarios
│   └── chaincode-javascript/         # Chaincode en Node.js
│       ├── package.json
│       ├── lib/
│       │   └── fidelitypoints.js
│       └── test/
│           └── fidelitypoints.test.js
├── application/
│   ├── package.json
│   ├── hotel-app.js                  # App del hotel (emitir puntos)
│   ├── cafeteria-app.js              # App de la cafeteria (canjear puntos)
│   ├── utils/
│   │   └── fabric-connection.js      # Helper de conexion al Gateway
│   └── wallet/                       # Identidades (se genera al arrancar)
└── scripts/
    ├── start-network.sh              # Levantar red + crear canal
    ├── deploy-chaincode.sh           # Empaquetar, instalar, aprobar, commit
    ├── stop-network.sh               # Parar red
    └── clean-all.sh                  # Borrar todo y empezar de cero
```

---

## Archivos de configuración

### crypto-config.yaml

```yaml
# proyecto-fidelitychain/network/crypto-config.yaml
OrdererOrgs:
  - Name: Orderer
    Domain: fidelitychain.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
        SANS:
          - localhost
          - 127.0.0.1

PeerOrgs:
  - Name: Hotel
    Domain: hotel.fidelitychain.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1

  - Name: Cafeteria
    Domain: cafeteria.fidelitychain.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - 127.0.0.1
    Users:
      Count: 1
```

### configtx.yaml

```yaml
# proyecto-fidelitychain/network/configtx.yaml
---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/fidelitychain.com/msp
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
      - orderer.fidelitychain.com:7050

  - &Hotel
    Name: HotelMSP
    ID: HotelMSP
    MSPDir: crypto-config/peerOrganizations/hotel.fidelitychain.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('HotelMSP.admin', 'HotelMSP.peer', 'HotelMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('HotelMSP.admin', 'HotelMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('HotelMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('HotelMSP.peer')"
    AnchorPeers:
      - Host: peer0.hotel.fidelitychain.com
        Port: 7051

  - &Cafeteria
    Name: CafeteriaMSP
    ID: CafeteriaMSP
    MSPDir: crypto-config/peerOrganizations/cafeteria.fidelitychain.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('CafeteriaMSP.admin', 'CafeteriaMSP.peer', 'CafeteriaMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('CafeteriaMSP.admin', 'CafeteriaMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('CafeteriaMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('CafeteriaMSP.peer')"
    AnchorPeers:
      - Host: peer0.cafeteria.fidelitychain.com
        Port: 9051

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
      - Host: orderer.fidelitychain.com
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/tls/server.crt
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
  FidelityChannel:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Hotel
        - *Cafeteria
```

---

## Flujo completo de despliegue

```mermaid
graph LR
    A["crypto-config.yaml<br/>Generar certs"] --> B["configtx.yaml<br/>Bloque genesis"]
    B --> C["docker-compose<br/>Levantar red"]
    C --> D["osnadmin<br/>Crear canal"]
    D --> E["peer channel join<br/>Unir peers"]
    E --> F["Lifecycle<br/>Desplegar chaincode"]
    F --> G["App Node.js<br/>Conectar y operar"]

    style A fill:#7C3AED,color:#fff
    style B fill:#22627E,color:#fff
    style C fill:#0D9448,color:#fff
    style D fill:#B45D09,color:#fff
    style E fill:#B45D09,color:#fff
    style F fill:#EC0000,color:#fff
    style G fill:#EC0000,color:#fff
```

Cada uno de estos pasos se detalla en los documentos siguientes (04 y 05).

---

**Anterior:** [01 - Diseño funcional](01-diseno-funcional.md)
**Siguiente:** [03 - Chaincode](03-chaincode.md)
