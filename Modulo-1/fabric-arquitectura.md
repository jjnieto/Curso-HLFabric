# Arquitectura de Hyperledger Fabric

## Enunciado del caso

Tres empresas que ya colaboran en el día a día deciden digitalizar parte de su trazabilidad sobre Hyperledger Fabric:

- **Org1** — Fabricante.
- **Org2** — Minorista.
- **Org3** — Distribuidor que opera en el centro de la cadena.

Quieren registrar sus operaciones comunes en una red compartida, pero por confidencialidad cada par de empresas mantiene flujos de información que el tercero **no debe ver**:

- **Org1** (Fabricante) y **Org3** (Distribuidor) comparten información de **logística**: rutas de envío, volúmenes en tránsito, incidencias de almacén. El minorista no debe acceder a estos datos.
- **Org2** (Minorista) y **Org3** (Distribuidor) comparten información de **facturación**: precios negociados, plazos de pago, ajustes y abonos. El fabricante no debe acceder a estos datos.
- **Org1**, **Org2** y **Org3** comparten información de **comercio**: catálogo de productos, disponibilidad de stock y pedidos confirmados. Es la capa común que ven los tres.

Cada flujo debe ir en un ledger independiente, accesible solo por las partes implicadas, manteniendo a la vez la trazabilidad común de las operaciones que sí afectan a las tres organizaciones.

Las secciones siguientes describen la arquitectura Fabric que resuelve este planteamiento: los actores principales, el flujo de una transacción, la organización en canales y ledgers, las identidades y MSPs, y el ciclo de vida del chaincode.

> **Nota:** Algunos diagramas posteriores (vista completa, flujo de transacción) muestran solo dos organizaciones para que se vea con claridad el detalle. Los conceptos escalan a las tres organizaciones del enunciado de la misma forma.

---

## Vista simplificada: los 4 actores principales

```mermaid
graph LR
    APP["📱 Cliente<br/>(Aplicación)"]
    E1["🟦 Endorsing Peer<br/>Org1"]
    E2["🟩 Endorsing Peer<br/>Org2"]
    ORD["🟧 Ordering<br/>Service"]
    C1["🟦 Committing Peer<br/>Org1"]
    C2["🟩 Committing Peer<br/>Org2"]

    APP -->|"1. Propuesta<br/>de transacción"| E1
    APP -->|"1. Propuesta<br/>de transacción"| E2
    E1 -->|"2. Respuesta<br/>firmada"| APP
    E2 -->|"2. Respuesta<br/>firmada"| APP
    APP -->|"3. Envía tx<br/>endorsada"| ORD
    ORD -->|"4. Distribuye<br/>bloque"| C1
    ORD -->|"4. Distribuye<br/>bloque"| C2

    style APP fill:#FFF9C4,stroke:#F9A825,color:#000
    style E1 fill:#64B5F6,color:#000
    style E2 fill:#81C784,color:#000
    style ORD fill:#FFB74D,color:#000
    style C1 fill:#64B5F6,color:#000
    style C2 fill:#81C784,color:#000
```

| Paso | Quién | Qué hace |
|------|-------|----------|
| 1 | **Cliente** → Endorsing Peers | Envía la propuesta de transacción |
| 2 | **Endorsing Peers** → Cliente | Simulan el chaincode y devuelven el resultado firmado |
| 3 | **Cliente** → Ordering Service | Envía la transacción con las firmas de endorsement |
| 4 | **Ordering Service** → Committing Peers | Ordena en bloque y lo distribuye. Los peers validan y escriben en el ledger |

> **Nota:** En Fabric, un mismo peer puede ser endorser y committer a la vez. Se separan en el diagrama para que se entienda el flujo.

---

## Vista completa de la red (detalle)

```mermaid
graph TB
    subgraph RED["RED HYPERLEDGER FABRIC"]

        subgraph ORD["Ordering Service"]
            O1["Orderer 1<br/>(Raft Leader)"]
            O2["Orderer 2<br/>(Raft Follower)"]
            O3["Orderer 3<br/>(Raft Follower)"]
            O1 <-->|"Raft<br/>consenso"| O2
            O1 <-->|"Raft<br/>consenso"| O3
            O2 <-->|"Raft<br/>consenso"| O3
        end

        subgraph ORG1["Organización 1"]
            CA1["Fabric CA<br/>Org1"]
            MSP1["MSP<br/>Org1"]
            P1["Peer0 Org1<br/>(Endorser + Committer)<br/>🔗 Anchor Peer"]
            P1b["Peer1 Org1<br/>(Committer)"]
            L1["Ledger Org1<br/>📋 Blockchain<br/>📦 World State"]
            CC1["Chaincode<br/>(Go / Node / Java)"]

            CA1 -->|"Emite<br/>certificados X.509"| MSP1
            MSP1 -->|"Define identidad<br/>y roles"| P1
            MSP1 -->|"Define identidad<br/>y roles"| P1b
            P1 --- L1
            P1b --- L1
            P1 --- CC1
            P1 <-->|"Gossip"| P1b
        end

        subgraph ORG2["Organización 2"]
            CA2["Fabric CA<br/>Org2"]
            MSP2["MSP<br/>Org2"]
            P2["Peer0 Org2<br/>(Endorser + Committer)<br/>🔗 Anchor Peer"]
            P2b["Peer1 Org2<br/>(Committer)"]
            L2["Ledger Org2<br/>📋 Blockchain<br/>📦 World State"]
            CC2["Chaincode<br/>(Go / Node / Java)"]

            CA2 -->|"Emite<br/>certificados X.509"| MSP2
            MSP2 -->|"Define identidad<br/>y roles"| P2
            MSP2 -->|"Define identidad<br/>y roles"| P2b
            P2 --- L2
            P2b --- L2
            P2 --- CC2
            P2 <-->|"Gossip"| P2b
        end

        subgraph CANAL["Canal: canal-negocio"]
            CH["Canal<br/>📑 Configuración<br/>📜 Políticas de endorsement"]
        end

        P1 <-->|"Gossip<br/>inter-org"| P2
        ORD -->|"Distribuye<br/>bloques"| P1
        ORD -->|"Distribuye<br/>bloques"| P2
        ORD -->|"Distribuye<br/>bloques"| P1b
        ORD -->|"Distribuye<br/>bloques"| P2b
        CH -.-|"Pertenecen al canal"| P1
        CH -.-|"Pertenecen al canal"| P2

    end

    subgraph APPS["Aplicaciones Cliente"]
        APP1["App Org1<br/>(SDK Node/Go/Java)"]
        APP2["App Org2<br/>(SDK Node/Go/Java)"]
    end

    APP1 -->|"1. Propuesta<br/>de transacción"| P1
    APP1 -->|"1. Propuesta<br/>de transacción"| P2
    APP2 -->|"1. Propuesta<br/>de transacción"| P2
    APP2 -->|"1. Propuesta<br/>de transacción"| P1
    APP1 -->|"3. Envía tx<br/>endorsada"| O1
    APP2 -->|"3. Envía tx<br/>endorsada"| O1

    style ORD fill:#FFE0B2,stroke:#F57C00
    style ORG1 fill:#E3F2FD,stroke:#1565C0
    style ORG2 fill:#E8F5E9,stroke:#2E7D32
    style CANAL fill:#F3E5F5,stroke:#7B1FA2
    style APPS fill:#FFF9C4,stroke:#F9A825
    style O1 fill:#FFB74D,color:#000
    style O2 fill:#FFB74D,color:#000
    style O3 fill:#FFB74D,color:#000
    style P1 fill:#64B5F6,color:#000
    style P1b fill:#90CAF9,color:#000
    style P2 fill:#81C784,color:#000
    style P2b fill:#A5D6A7,color:#000
    style CA1 fill:#42A5F5,color:#fff
    style CA2 fill:#66BB6A,color:#fff
```

---

## Flujo de una transacción — Swimlane (vista simplificada)

```mermaid
block-beta
    columns 6

    %% Header
    space:6

    %% Lane labels
    block:LBL1:1
        L1["📱 CLIENTE"]
    end
    block:LBL2:2
        L2["🟦🟩 ENDORSING PEERS"]
    end
    block:LBL3:1
        L3["🟧 ORDERING SERVICE"]
    end
    block:LBL4:2
        L4["🟦🟩 COMMITTING PEERS"]
    end

    style L1 fill:#FFF9C4,stroke:#F9A825,color:#000
    style L2 fill:#E3F2FD,stroke:#1565C0,color:#000
    style L3 fill:#FFE0B2,stroke:#F57C00,color:#000
    style L4 fill:#E8F5E9,stroke:#2E7D32,color:#000
```

```mermaid
sequenceDiagram
    box rgb(255,249,196) Cliente
        participant App as 📱 App Cliente
    end
    box rgb(227,242,253) Endorsing Peers
        participant E1 as 🟦 Peer Org1
        participant E2 as 🟩 Peer Org2
    end
    box rgb(255,224,178) Ordering Service
        participant Ord as 🟧 Orderer
    end
    box rgb(232,245,233) Committing Peers
        participant C1 as 🟦 Peer Org1
        participant C2 as 🟩 Peer Org2
    end

    Note over App,C2: FASE 1 — ENDORSE

    App->>E1: 1. Propuesta de transacción
    App->>E2: 1. Propuesta de transacción

    activate E1
    Note right of E1: Ejecuta chaincode<br/>(simula, NO escribe)
    E1-->>App: 2. Read/Write Set + firma Org1
    deactivate E1

    activate E2
    Note right of E2: Ejecuta chaincode<br/>(simula, NO escribe)
    E2-->>App: 2. Read/Write Set + firma Org2
    deactivate E2

    Note over App: Verifica que ambos<br/>resultados coinciden

    Note over App,C2: FASE 2 — ORDER

    App->>Ord: 3. Transacción endorsada (con ambas firmas)

    activate Ord
    Note right of Ord: Ordena por timestamp<br/>Agrupa en bloque
    Ord->>C1: 4. Bloque
    Ord->>C2: 4. Bloque
    deactivate Ord

    Note over App,C2: FASE 3 — VALIDATE & COMMIT

    activate C1
    C1->>C1: 5. Valida firmas
    C1->>C1: 6. Verifica versiones (MVCC)
    C1->>C1: 7. Escribe en World State
    C1->>C1: 8. Añade bloque al ledger
    deactivate C1

    activate C2
    C2->>C2: 5. Valida firmas
    C2->>C2: 6. Verifica versiones (MVCC)
    C2->>C2: 7. Escribe en World State
    C2->>C2: 8. Añade bloque al ledger
    deactivate C2

    Note over App,C2: ✅ Transacción confirmada — Ledger consistente en ambas orgs
```

> **Nota:** Los endorsing peers y los committing peers son los mismos nodos físicos. Se separan en carriles distintos para que se vea claramente qué rol desempeñan en cada fase.

---

## Flujo de una transacción — Diagrama de secuencia (detalle)

```mermaid
sequenceDiagram
    participant App as 📱 Aplicación Cliente
    participant E1 as 🟦 Peer Org1<br/>(Endorser)
    participant E2 as 🟩 Peer Org2<br/>(Endorser)
    participant Ord as 🟧 Ordering Service
    participant C1 as 🟦 Peers Org1<br/>(Committers)
    participant C2 as 🟩 Peers Org2<br/>(Committers)

    Note over App,C2: FASE 1 — ENDORSE (Simular y firmar)

    App->>E1: 1. Propuesta de transacción
    App->>E2: 1. Propuesta de transacción

    activate E1
    E1->>E1: Ejecuta chaincode<br/>(simula, NO escribe)
    E1-->>App: 2. Respuesta endorsada<br/>(Read/Write Set + firma Org1)
    deactivate E1

    activate E2
    E2->>E2: Ejecuta chaincode<br/>(simula, NO escribe)
    E2-->>App: 2. Respuesta endorsada<br/>(Read/Write Set + firma Org2)
    deactivate E2

    Note over App: Verifica que ambos<br/>resultados coinciden

    Note over App,C2: FASE 2 — ORDER (Ordenar en bloque)

    App->>Ord: 3. Envía transacción endorsada<br/>(con firmas de ambas orgs)

    activate Ord
    Ord->>Ord: Ordena transacciones<br/>Empaqueta en bloque
    Ord-->>C1: 4. Distribuye bloque
    Ord-->>C2: 4. Distribuye bloque
    deactivate Ord

    Note over App,C2: FASE 3 — VALIDATE (Validar y escribir)

    activate C1
    C1->>C1: 5. Valida firmas de endorsement
    C1->>C1: 6. Verifica versiones (MVCC)
    C1->>C1: 7. Actualiza World State
    C1->>C1: 8. Añade bloque a la blockchain
    deactivate C1

    activate C2
    C2->>C2: 5. Valida firmas de endorsement
    C2->>C2: 6. Verifica versiones (MVCC)
    C2->>C2: 7. Actualiza World State
    C2->>C2: 8. Añade bloque a la blockchain
    deactivate C2

    Note over App,C2: ✅ Transacción confirmada<br/>El ledger es consistente en ambas orgs
```

---

## Estructura del Ledger

```mermaid
graph LR
    subgraph LEDGER["Ledger de Fabric"]
        subgraph BC["📋 Blockchain (inmutable)"]
            B0["Bloque 0<br/>(Génesis)"]
            B1["Bloque 1"]
            B2["Bloque 2"]
            B3["Bloque N"]
            B0 -->|"hash"| B1
            B1 -->|"hash"| B2
            B2 -->|"..."| B3
        end

        subgraph WS["📦 World State del canal comercio (estado actual)"]
            DB["LevelDB o CouchDB"]
            K1["prod_001 → Café Premium 250g, stock 1.200, precio mayorista 4,50€"]
            K2["prod_002 → Té Verde 100g, stock 800, precio mayorista 3,20€"]
            K3["pedido_452 → Org2 (Minorista), 50 unid de prod_001, 2026-04-15"]
        end
    end

    subgraph BLOQUE["Contenido de un bloque"]
        BH["Header<br/>- Hash del bloque anterior<br/>- Número de bloque<br/>- Timestamp"]
        BD["Data<br/>- Transacción 1 (Read/Write Set)<br/>- Transacción 2 (Read/Write Set)<br/>- ..."]
        BM["Metadata<br/>- Firma del orderer<br/>- Validación (válida/inválida)"]
    end

    BC -->|"Los bloques contienen<br/>las transacciones que<br/>modificaron el estado"| WS
    B3 -.->|"Estructura"| BLOQUE

    style BC fill:#E3F2FD,stroke:#1565C0
    style WS fill:#FFF3E0,stroke:#E65100
    style BLOQUE fill:#F3E5F5,stroke:#7B1FA2
```

---

## Canales y privacidad

```mermaid
graph TD
    subgraph RED["Infraestructura física compartida"]
        subgraph CH1["Canal: comercio"]
            L1A["Ledger Org1<br/>canal comercio"]
            L1B["Ledger Org2<br/>canal comercio"]
            L1C["Ledger Org3<br/>canal comercio"]
        end

        subgraph CH2["Canal: logística"]
            L2A["Ledger Org1<br/>canal logística"]
            L2B["Ledger Org3<br/>canal logística"]
        end

        subgraph CH3["Canal: facturación"]
            L3A["Ledger Org2<br/>canal facturación"]
            L3B["Ledger Org3<br/>canal facturación"]
        end
    end

    ORG1["🏢 Org1"] -->|"Miembro"| CH1
    ORG1 -->|"Miembro"| CH2
    ORG2["🏢 Org2"] -->|"Miembro"| CH1
    ORG2 -->|"Miembro"| CH3
    ORG3["🏢 Org3"] -->|"Miembro"| CH1
    ORG3 -->|"Miembro"| CH2
    ORG3 -->|"Miembro"| CH3

    style CH1 fill:#E3F2FD,stroke:#1565C0
    style CH2 fill:#E8F5E9,stroke:#2E7D32
    style CH3 fill:#FFF3E0,stroke:#E65100
    style RED fill:#FAFAFA,stroke:#424242
```

**Org1** (Fabricante) no ve nada de lo que pasa en el canal de facturación.
**Org2** (Minorista) no ve nada de lo que pasa en el canal de logística.
**Org3** (Distribuidor) participa en los tres canales: es el nodo conector entre fabricante y minorista, y mantiene tres ledgers, uno por canal.
Cada canal tiene su propio ledger independiente.

---

## Identidades y MSP

```mermaid
graph TD
    subgraph PKI["Infraestructura de Clave Pública (PKI)"]
        RCA["Root CA"]
        ICA["Intermediate CA<br/>(opcional)"]
        RCA -->|"Firma"| ICA
    end

    subgraph FABCA["Fabric CA"]
        REG["Register<br/>(crear identidad)"]
        ENR["Enroll<br/>(obtener certificado)"]
        REV["Revoke<br/>(revocar certificado)"]
    end

    subgraph MSP_DIR["Estructura MSP (carpeta)"]
        CAC["cacerts/<br/>Certificados raíz de la CA"]
        SIG["signcerts/<br/>Certificado del nodo/usuario"]
        KEY["keystore/<br/>Clave privada"]
        TLS["tlscacerts/<br/>Certificados TLS"]
        CRL["crls/<br/>Lista de revocación"]
    end

    subgraph ROLES["Roles en MSP"]
        ADMIN["Admin<br/>Gestiona canal y chaincode"]
        PEER_R["Peer<br/>Endosa y mantiene ledger"]
        CLIENT["Client<br/>Envía transacciones"]
        ORDERER_R["Orderer<br/>Ordena bloques"]
    end

    ICA --> FABCA
    FABCA -->|"Genera"| MSP_DIR
    MSP_DIR -->|"Define"| ROLES

    style PKI fill:#E3F2FD,stroke:#1565C0
    style FABCA fill:#E8F5E9,stroke:#2E7D32
    style MSP_DIR fill:#FFF3E0,stroke:#E65100
    style ROLES fill:#F3E5F5,stroke:#7B1FA2
```

---

## Comparativa: identidad en EVM vs Fabric

```mermaid
graph LR
    subgraph EVM["🔷 EVM (Ethereum)"]
        PK_E["Clave privada<br/>(en MetaMask)"]
        PUB_E["Clave pública"]
        ADDR["Dirección<br/>0x742d...4f8B"]
        PK_E -->|"Deriva"| PUB_E
        PUB_E -->|"Hash"| ADDR
        PSEUDO["Pseudónima<br/>Sin nombre ni org"]
        NOREV["No revocable"]
    end

    subgraph FAB["🟧 Hyperledger Fabric"]
        PK_F["Clave privada<br/>(en keystore MSP)"]
        CERT["Certificado X.509<br/>CN=peer0.org1.example.com<br/>O=Org1MSP"]
        CA_F["Emitido por<br/>Fabric CA"]
        PK_F -->|"Asociada"| CERT
        CA_F -->|"Firma"| CERT
        IDENT["Identificada<br/>Nombre + Org + Rol"]
        REV["Revocable<br/>(CRL)"]
    end

    style EVM fill:#E3F2FD,stroke:#1565C0
    style FAB fill:#FFF3E0,stroke:#E65100
```

---

## Ciclo de vida del chaincode

```mermaid
graph LR
    PKG["📦 Package<br/>peer lifecycle chaincode<br/>package"]
    INS["💾 Install<br/>peer lifecycle chaincode<br/>install<br/>(en cada peer)"]
    APR["✅ Approve<br/>peer lifecycle chaincode<br/>approveformyorg<br/>(cada org vota)"]
    CHK["🔍 Check<br/>peer lifecycle chaincode<br/>checkcommitreadiness"]
    COM["🚀 Commit<br/>peer lifecycle chaincode<br/>commit<br/>(se activa en el canal)"]
    USE["💬 Invoke / Query<br/>peer chaincode invoke<br/>peer chaincode query"]

    PKG -->|"Crea .tar.gz"| INS
    INS -->|"Package ID"| APR
    APR -->|"¿Mayoría?"| CHK
    CHK -->|"Sí"| COM
    COM -->|"Chaincode activo"| USE

    style PKG fill:#E3F2FD,stroke:#1565C0
    style INS fill:#E8F5E9,stroke:#2E7D32
    style APR fill:#FFF3E0,stroke:#E65100
    style CHK fill:#F3E5F5,stroke:#7B1FA2
    style COM fill:#C8E6C9,stroke:#2E7D32
    style USE fill:#B3E5FC,stroke:#0288D1
```
