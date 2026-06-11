# 07 - Anexo: Despliegue en producción real

## Introducción

Hasta ahora hemos visto FidelityChain corriendo todo en una sola máquina con Docker Compose. Es perfecto para aprender, pero no se parece a lo que harían el Hotel y la Cafetería en un despliegue real.

Este anexo es un **ejercicio teórico**: ¿cómo se montaría FidelityChain si cada organización tuviera su propia infraestructura? Veremos dos opciones: una **mínima realista** con 3 máquinas y una **separación de roles** con 5-7 máquinas.

> **Importante:** este documento NO se va a desplegar en clase (requiere infraestructura real). Es para que los alumnos entiendan cómo se traduce la arquitectura lógica de Fabric a un despliegue real distribuido.

---

## Recordatorio de FidelityChain

Antes de hablar de máquinas, repasemos los componentes lógicos:

```mermaid
graph TB
    subgraph FC["FidelityChain (componentes lógicos)"]
        subgraph H["Hotel - HotelMSP"]
            HCA["CA Hotel"]
            HP["Peer Hotel"]
            HDB["CouchDB Hotel"]
            HAPP["App Hotel<br/>(emitir puntos)"]
        end

        subgraph C["Cafetería - CafeteriaMSP"]
            CCA["CA Cafetería"]
            CP["Peer Cafetería"]
            CDB["CouchDB Cafetería"]
            CAPP["App Cafetería<br/>(canjear puntos)"]
        end

        subgraph O["OrdererOrg"]
            OCA["CA Orderer"]
            ORD["Orderer"]
        end

        CANAL["Canal: fidelity-channel"]

        HP --- CANAL
        CP --- CANAL
        ORD --- CANAL
    end

    style HCA fill:#7C3AED,color:#fff
    style HP fill:#22627E,color:#fff
    style HDB fill:#22627E,color:#fff
    style HAPP fill:#22627E,color:#fff
    style CCA fill:#7C3AED,color:#fff
    style CP fill:#0D9448,color:#fff
    style CDB fill:#0D9448,color:#fff
    style CAPP fill:#0D9448,color:#fff
    style OCA fill:#7C3AED,color:#fff
    style ORD fill:#B45D09,color:#fff
    style CANAL fill:#EC0000,color:#fff
```

Total de componentes: **3 CAs + 2 peers + 2 CouchDB + 1 orderer + 2 apps cliente = 10 procesos**.

En la red de aula, los 10 corren en una sola máquina. En producción real se reparten.

---

## Opción A: Mínimo realista (3 máquinas)

Una máquina por organización. Es la opción más cercana a un consorcio pequeño y permite enseñar todos los conceptos importantes de un despliegue distribuido.

### Diagrama de arquitectura

```mermaid
graph TB
    subgraph M1["Máquina 1: Hotel<br/>(operada por el Hotel)"]
        HCA["Fabric CA Hotel<br/>:7054"]
        HPEER["Peer Hotel<br/>:7051"]
        HDB["CouchDB Hotel<br/>:5984"]
        HAPP["App Hotel<br/>(Node.js)"]
    end

    subgraph M2["Máquina 2: Cafetería<br/>(operada por la Cafetería)"]
        CCA["Fabric CA Cafetería<br/>:8054"]
        CPEER["Peer Cafetería<br/>:9051"]
        CDB["CouchDB Cafetería<br/>:5984"]
        CAPP["App Cafetería<br/>(Node.js)"]
    end

    subgraph M3["Máquina 3: OrdererOrg<br/>(operada por un tercero<br/>o uno de los socios)"]
        OCA["Fabric CA Orderer<br/>:9054"]
        ORD["Orderer<br/>:7050"]
    end

    HPEER <-->|"gRPC + TLS"| ORD
    CPEER <-->|"gRPC + TLS"| ORD
    HPEER <-->|"gossip"| CPEER
    HAPP --> HPEER
    CAPP --> CPEER

    style HCA fill:#7C3AED,color:#fff
    style HPEER fill:#22627E,color:#fff
    style HDB fill:#22627E,color:#fff
    style HAPP fill:#22627E,color:#fff
    style CCA fill:#7C3AED,color:#fff
    style CPEER fill:#0D9448,color:#fff
    style CDB fill:#0D9448,color:#fff
    style CAPP fill:#0D9448,color:#fff
    style OCA fill:#7C3AED,color:#fff
    style ORD fill:#B45D09,color:#fff
```

### Inventario de máquinas

| # | Máquina | Quién la opera | Procesos | Recursos mínimos |
|---|---------|---------------|----------|-----------------|
| 1 | Hotel | El Hotel | CA + Peer + CouchDB + App | 4 vCPU, 8 GB RAM, 100 GB SSD |
| 2 | Cafetería | La Cafetería | CA + Peer + CouchDB + App | 4 vCPU, 8 GB RAM, 100 GB SSD |
| 3 | OrdererOrg | Tercero neutral o uno de los socios | CA + Orderer | 2 vCPU, 4 GB RAM, 50 GB SSD |

### Reparto de responsabilidades

```mermaid
graph LR
    subgraph "Hotel (M1)"
        HOTEL_RESP["• Genera identidades de su org<br/>• Opera su CA<br/>• Mantiene su peer y CouchDB<br/>• Hace backup de sus datos<br/>• Aprueba chaincodes (lifecycle)<br/>• Audita transacciones de Cafetería"]
    end

    subgraph "Cafetería (M2)"
        CAFE_RESP["• Genera identidades de su org<br/>• Opera su CA<br/>• Mantiene su peer y CouchDB<br/>• Hace backup de sus datos<br/>• Aprueba chaincodes (lifecycle)<br/>• Audita transacciones del Hotel"]
    end

    subgraph "OrdererOrg (M3)"
        ORD_RESP["• Genera identidades del orderer<br/>• Opera la CA del orderer<br/>• Mantiene el orderer<br/>• Coordina creación del canal<br/>• Genera el bloque génesis<br/>• Distribuye el bloque a las orgs"]
    end

    style HOTEL_RESP fill:#22627E,color:#fff
    style CAFE_RESP fill:#0D9448,color:#fff
    style ORD_RESP fill:#B45D09,color:#fff
```

### Setup inicial (paso a paso)

El despliegue distribuido requiere coordinación entre las 3 organizaciones. Asumimos que cada una tiene su máquina operativa con Docker.

```mermaid
sequenceDiagram
    participant Hotel as M1 Hotel
    participant Cafe as M2 Cafetería
    participant Ord as M3 OrdererOrg

    Note over Hotel,Ord: Fase 1: Cada org genera su material criptográfico
    Hotel->>Hotel: Levanta CA Hotel<br/>Enrolla peer + admin
    Cafe->>Cafe: Levanta CA Cafetería<br/>Enrolla peer + admin
    Ord->>Ord: Levanta CA Orderer<br/>Enrolla orderer + admin

    Note over Hotel,Ord: Fase 2: Intercambio de certificados raíz (públicos)
    Hotel->>Ord: Cert raíz Hotel + TLS CA + cert admin público
    Cafe->>Ord: Cert raíz Cafetería + TLS CA + cert admin público
    Ord->>Hotel: Cert raíz Orderer + TLS CA
    Ord->>Cafe: Cert raíz Orderer + TLS CA

    Note over Ord: Fase 3: Coordinador (OrdererOrg) genera config
    Ord->>Ord: Construye configtx.yaml<br/>con MSPs de las 3 orgs
    Ord->>Ord: configtxgen → bloque génesis

    Note over Hotel,Ord: Fase 4: Distribuye bloque génesis
    Ord->>Hotel: bloque génesis (fidelity-channel.block)
    Ord->>Cafe: bloque génesis (fidelity-channel.block)

    Note over Hotel,Ord: Fase 5: Levantan los nodos de operación
    Ord->>Ord: Levanta orderer + osnadmin channel join
    Hotel->>Hotel: Levanta peer + couchdb<br/>peer channel join
    Cafe->>Cafe: Levanta peer + couchdb<br/>peer channel join

    Note over Hotel,Ord: Fase 6: Despliegue del chaincode (lifecycle)
    Hotel->>Hotel: package + install
    Cafe->>Cafe: package + install
    Hotel->>Ord: approveformyorg
    Cafe->>Ord: approveformyorg
    Hotel->>Ord: commit (con peer addresses de Hotel y Cafe)
```

### Cómo se intercambian los certificados raíz

Las claves privadas **NUNCA** salen de la máquina que las generó. Lo que se comparte son los certificados raíz públicos. Maneras habituales:

- **Repositorio git compartido** (público o privado): cada org sube sus certs públicos. El coordinador los lee de ahí.
- **Transferencia segura puntual**: SFTP, SCP, e-mail cifrado. Los certs no son secretos pero su autenticidad sí — verificar fingerprints.
- **Servicio dedicado**: en consorcios grandes, una secretaría coordina el intercambio.

Estructura típica de carpeta compartida:

```
fidelitychain-org-certs/
├── hotel.fidelitychain.com/
│   ├── ca-cert.pem          # Cert raíz de la CA Hotel (público)
│   ├── tlsca-cert.pem       # Cert raíz TLS de Hotel
│   └── admin-cert.pem       # Cert público del admin (no la clave privada)
├── cafeteria.fidelitychain.com/
│   ├── ca-cert.pem
│   ├── tlsca-cert.pem
│   └── admin-cert.pem
└── fidelitychain.com/        # Orderer
    ├── ca-cert.pem
    ├── tlsca-cert.pem
    └── orderer-cert.pem
```

### Networking entre máquinas

```mermaid
graph LR
    subgraph "Internet pública o VPN del consorcio"
        HOTEL_DNS["hotel.fidelitychain.com<br/>→ IP pública M1"]
        CAFE_DNS["cafeteria.fidelitychain.com<br/>→ IP pública M2"]
        ORD_DNS["orderer.fidelitychain.com<br/>→ IP pública M3"]
    end

    M1["M1 (Hotel)"] -->|7051,7054| HOTEL_DNS
    M2["M2 (Cafetería)"] -->|9051,8054| CAFE_DNS
    M3["M3 (Orderer)"] -->|7050,7053,9054| ORD_DNS

    style HOTEL_DNS fill:#22627E,color:#fff
    style CAFE_DNS fill:#0D9448,color:#fff
    style ORD_DNS fill:#B45D09,color:#fff
```

**Requisitos de red:**

- **DNS público o privado**: cada hostname (`peer0.hotel.fidelitychain.com`, etc.) debe resolver a la IP correcta desde las otras máquinas. Se puede usar DNS real, registros internos del consorcio, o VPN con DNS propio.

- **Firewalls abiertos**: cada máquina expone puertos TCP específicos:

| Máquina | Puertos a abrir |
|---------|-----------------|
| M1 (Hotel) | 7051 (peer), 7054 (CA), 9444 (operations) |
| M2 (Cafetería) | 9051 (peer), 8054 (CA), 9445 (operations) |
| M3 (Orderer) | 7050 (orderer), 7053 (admin), 9054 (CA), 9443 (operations) |

- **TLS con SANS reales**: los certificados TLS deben llevar en `csr.hosts` los hostnames y/o IPs públicas reales (no `localhost`). Esto se configura al hacer `enroll` en cada CA:

```bash
fabric-ca-client enroll \
  -u https://peer0:peer0pw@ca.hotel.fidelitychain.com:7054 \
  --csr.hosts peer0.hotel.fidelitychain.com,hotel.fidelitychain.com,1.2.3.4
```

- **Conexión cliente ↔ peer**: las apps Node.js (hotel-app.js, cafeteria-app.js) se conectan al endpoint público del peer (`grpcs://peer0.hotel.fidelitychain.com:7051`). En producción suelen estar en máquinas separadas dentro de la misma org (DMZ + zona aplicaciones), pero para empezar pueden estar en la misma máquina del peer.

### Operación día a día

Una vez desplegado, cada máquina opera de forma autónoma:

```mermaid
graph LR
    subgraph "Día a día"
        H["Hotel: emite puntos<br/>desde su app"] --> NET["Red Fabric<br/>(consenso)"]
        C["Cafetería: canjea puntos<br/>desde su app"] --> NET
        NET --> AUDIT["Cualquiera audita<br/>desde su peer"]
    end

    style H fill:#22627E,color:#fff
    style C fill:#0D9448,color:#fff
    style NET fill:#B45D09,color:#fff
    style AUDIT fill:#7C3AED,color:#fff
```

**Tareas operativas habituales:**

- **Cada org**: monitoriza la salud de SU peer (logs, métricas de Operations API, espacio en disco)
- **Cada org**: hace backup periódico de SU CouchDB y de SUS certificados
- **Cada org**: rota los certificados de SU peer antes de que caduquen
- **OrdererOrg**: monitoriza el orderer y gestiona la admisión de nuevas orgs en el canal

---

## Opción B: Separación de roles (5-7 máquinas)

Aquí separamos la Fabric CA del peer/orderer, lo cual es práctica habitual en producción seria. La razón es **seguridad**: la CA emite los certificados que dan acceso a la red, así que conviene aislarla del componente que ejecuta operaciones (el peer), que es el que más expuesto está.

### Diagrama de arquitectura

```mermaid
graph TB
    subgraph HOTEL_ZONE["Zona Hotel"]
        subgraph HOTEL_DMZ["Zona segura (DMZ)"]
            HCA["M2: Fabric CA Hotel<br/>:7054"]
        end
        subgraph HOTEL_OPS["Zona operaciones"]
            HPEER["M3: Peer Hotel + CouchDB<br/>:7051, :5984"]
            HAPP["(App Hotel — opcional<br/>en máquina aparte)"]
        end
    end

    subgraph CAFE_ZONE["Zona Cafetería"]
        subgraph CAFE_DMZ["Zona segura (DMZ)"]
            CCA["M4: Fabric CA Cafetería<br/>:8054"]
        end
        subgraph CAFE_OPS["Zona operaciones"]
            CPEER["M5: Peer Cafetería + CouchDB<br/>:9051, :5984"]
        end
    end

    subgraph ORD_ZONE["Zona OrdererOrg"]
        OCA["M6: Fabric CA Orderer<br/>:9054"]
        ORD["M7: Orderer<br/>:7050"]
    end

    ADMIN["M1: Coordinador admin<br/>(genera configtx,<br/>distribuye bloques)"]

    HCA -.->|"emite cert"| HPEER
    CCA -.->|"emite cert"| CPEER
    OCA -.->|"emite cert"| ORD

    HPEER <-->|"gRPC + TLS"| ORD
    CPEER <-->|"gRPC + TLS"| ORD
    HPEER <-->|"gossip"| CPEER

    ADMIN -.->|"reparte bloque<br/>génesis"| HPEER
    ADMIN -.->|"reparte bloque<br/>génesis"| CPEER
    ADMIN -.->|"reparte bloque<br/>génesis"| ORD

    style HCA fill:#7C3AED,color:#fff
    style HPEER fill:#22627E,color:#fff
    style CCA fill:#7C3AED,color:#fff
    style CPEER fill:#0D9448,color:#fff
    style OCA fill:#7C3AED,color:#fff
    style ORD fill:#B45D09,color:#fff
    style ADMIN fill:#999,color:#fff
```

### Inventario de máquinas

| # | Máquina | Función | Quién la opera | Recursos |
|---|---------|---------|---------------|----------|
| 1 | **Coordinador admin** | Genera configtx, distribuye bloques, ejecuta lifecycle | Tercero neutral o turno rotativo | 1 vCPU, 2 GB |
| 2 | CA Hotel | Solo Fabric CA | Hotel | 1 vCPU, 2 GB |
| 3 | Peer + CouchDB Hotel | Operación | Hotel | 4 vCPU, 8 GB, 100 GB |
| 4 | CA Cafetería | Solo Fabric CA | Cafetería | 1 vCPU, 2 GB |
| 5 | Peer + CouchDB Cafetería | Operación | Cafetería | 4 vCPU, 8 GB, 100 GB |
| 6 | CA Orderer | Solo Fabric CA | OrdererOrg | 1 vCPU, 2 GB |
| 7 | Orderer | Servicio de ordenación | OrdererOrg | 2 vCPU, 4 GB |

### Por qué separar la CA del peer

```mermaid
graph TB
    subgraph "Sin separar (Opción A)"
        A1["Atacante compromete el peer"] --> A2["Acceso a la CA<br/>(en la misma máquina)"]
        A2 --> A3["Puede emitir certs falsos<br/>= comprometer toda la red"]
    end

    subgraph "Con separación (Opción B)"
        B1["Atacante compromete el peer"] --> B2["NO tiene acceso a la CA<br/>(en máquina distinta)"]
        B2 --> B3["Solo puede impersonar a este peer<br/>hasta que se detecte y revoque"]
    end

    style A3 fill:#EC0000,color:#fff
    style B3 fill:#0D9448,color:#fff
```

**Otras razones para separar:**

- **Auditoría**: las operaciones de la CA (register, enroll, revoke) quedan separadas de las operaciones de negocio. Más fácil de auditar.
- **Disponibilidad**: el peer puede caer sin afectar a la CA. La CA puede estar offline la mayor parte del tiempo (solo se necesita al emitir/revocar certs).
- **Compliance**: en sectores regulados (banca, salud), las autoridades certificadoras suelen tener requisitos más estrictos que el resto de la infraestructura.

### Diferencias clave con la Opción A

| Aspecto | Opción A (3 máquinas) | Opción B (7 máquinas) |
|---------|----------------------|----------------------|
| **Aislamiento de la CA** | CA y peer en misma máquina | CA aislada del peer |
| **Coordinador admin** | Compartido con OrdererOrg | Máquina dedicada |
| **Coste de infra** | Bajo | Medio |
| **Complejidad operativa** | Baja | Media |
| **Seguridad** | Aceptable | Alta |
| **Cuándo usar** | Pilotos, MVPs, consorcios pequeños | Producción seria con datos sensibles |

---

## Opción C: Producción enterprise con alta disponibilidad (referencia)

Solo a título informativo — es lo que verías en consorcios reales tipo HKMA o We.Trade.

| Componente | Máquinas | Razón |
|------------|----------|-------|
| Coordinador admin | 1 | Operaciones puntuales |
| CA Hotel + replica | 2 | HA de la CA |
| Peers Hotel (peer0 + peer1) | 2 | HA del peer (uno endorsa, otro respalda) |
| CouchDB Hotel | 1 | Estado de Hotel |
| CA Cafetería + replica | 2 | HA de la CA |
| Peers Cafetería | 2 | HA |
| CouchDB Cafetería | 1 | Estado de Cafetería |
| CA Orderer | 1 | |
| **Cluster Orderer Raft** | **3-5 nodos** | Tolerancia a fallos del consenso |
| Apps cliente con load balancer | 2-3 | HA de la capa de aplicación |
| Monitorización (Prometheus + Grafana) | 1-2 | Observabilidad |

**Total: 17-22 máquinas**.

```mermaid
graph TB
    subgraph "Hotel"
        HCA1["CA Hotel"]
        HCA2["CA Hotel replica"]
        HP1["Peer Hotel 0"]
        HP2["Peer Hotel 1"]
        HDB["CouchDB"]
    end

    subgraph "Cafetería"
        CCA1["CA Cafetería"]
        CCA2["CA Cafetería replica"]
        CP1["Peer Cafetería 0"]
        CP2["Peer Cafetería 1"]
        CDB["CouchDB"]
    end

    subgraph "OrdererOrg"
        OCA["CA Orderer"]
        O1["Orderer 1"]
        O2["Orderer 2"]
        O3["Orderer 3"]
        O4["Orderer 4"]
        O5["Orderer 5"]
    end

    subgraph "Operaciones globales"
        ADMIN["Coordinador admin"]
        MON["Monitorización"]
        APP["Apps cliente<br/>(load balanced)"]
    end

    HP1 --- O1
    HP2 --- O2
    CP1 --- O3
    CP2 --- O4
    O1 -.- O2 -.- O3 -.- O4 -.- O5

    style HCA1 fill:#7C3AED,color:#fff
    style HCA2 fill:#7C3AED,color:#fff
    style CCA1 fill:#7C3AED,color:#fff
    style CCA2 fill:#7C3AED,color:#fff
    style OCA fill:#7C3AED,color:#fff
    style HP1 fill:#22627E,color:#fff
    style HP2 fill:#22627E,color:#fff
    style CP1 fill:#0D9448,color:#fff
    style CP2 fill:#0D9448,color:#fff
    style O1 fill:#B45D09,color:#fff
    style O2 fill:#B45D09,color:#fff
    style O3 fill:#B45D09,color:#fff
    style O4 fill:#B45D09,color:#fff
    style O5 fill:#B45D09,color:#fff
```

**Características clave de esta opción:**

- **Cluster Raft de orderers**: tolera (N-1)/2 fallos. Con 5 nodos, soporta 2 caídos simultáneamente sin afectar al servicio.
- **Peers redundantes por org**: si peer0 cae, peer1 sigue endorsando. Las apps detectan y se redirigen.
- **CAs replicadas**: si la CA principal cae, la réplica responde a peticiones de enroll/reenroll.
- **Apps detrás de load balancer**: distribuyen carga y permiten despliegues sin downtime.
- **Monitorización 24/7**: Prometheus recopila métricas de todos los componentes, Grafana las visualiza, alertas a oncall.

---

## Comparativa de las tres opciones

| Aspecto | Opción A (3) | Opción B (7) | Opción C (17+) |
|---------|--------------|--------------|----------------|
| Máquinas | 3 | 7 | 17-22 |
| Coste mensual cloud | ~150€ | ~350€ | ~1500-3000€ |
| Tiempo de setup | 1-2 días | 1 semana | 1-2 meses |
| Tolerancia a fallos | Ninguna | Limitada | Alta |
| Aislamiento CA | No | Sí | Sí + replicación |
| Cuándo usar | MVPs, formación | Pilotos serios, consorcios pequeños | Producción enterprise |
| Equivale a | FidelityChain inicial | We.Trade inicial | HKMA eTradeConnect |

---

## Consideraciones operativas comunes

Independientemente de la opción elegida, hay aspectos que resolver al pasar de una sola máquina a múltiples:

### 1. DNS y resolución de nombres

Los nodos Fabric se identifican por hostname (`peer0.hotel.fidelitychain.com`), no por IP. Hay que asegurar que cada máquina puede resolver los nombres del resto:

- **DNS público**: si las orgs publican sus endpoints en internet (consorcios públicos)
- **DNS interno**: zona DNS gestionada por el consorcio (recomendado para consorcios privados)
- **VPN con DNS**: una VPN del consorcio con DNS propio (alternativa a DNS interno)
- **Hosts file**: solo aceptable para pruebas iniciales, no para producción

### 2. Certificados TLS con SANS correctos

Al enrollar peers y orderers, los certificados TLS deben incluir todos los nombres y IPs por los que serán accesibles:

```bash
fabric-ca-client enroll \
  -u https://peer0:peer0pw@ca.hotel.fidelitychain.com:7054 \
  --csr.hosts peer0.hotel.fidelitychain.com \
  --csr.hosts hotel.fidelitychain.com \
  --csr.hosts 198.51.100.10 \
  --csr.hosts localhost
```

Si falta un SAN, el TLS rechaza la conexión.

### 3. Firewalls y conectividad

| De → A | Puertos | Motivo |
|--------|---------|--------|
| Peer Hotel → Orderer | TCP 7050 | Enviar transacciones para ordering |
| Peer Cafetería → Orderer | TCP 7050 | Enviar transacciones |
| Peer Hotel ↔ Peer Cafetería | TCP 7051/9051 | Gossip (descubrimiento, sincronización) |
| Apps → Peers | TCP 7051/9051 | Invocar/consultar chaincode |
| Admin → Orderer | TCP 7053 | osnadmin (gestión del orderer) |
| Cualquiera → CA | TCP 7054/8054/9054 | Enroll/register |

### 4. Backup y recuperación

Cada org backupea su propia infraestructura. **No hay backup centralizado**.

| Componente | Frecuencia | Ubicación |
|-----------|------------|-----------|
| Claves privadas (CA + admin + peer) | 1 vez (no cambian) | Bóveda segura, fuera de la máquina |
| Volumen del peer (ledger) | Diaria | Storage backup de la org |
| Volumen del CouchDB | Diaria | Storage backup de la org |
| BD de Fabric CA | Semanal | Storage backup de la org |
| Configuración (yaml, scripts) | En cada cambio | Git de la org |

### 5. Rotación de certificados en multi-máquina

En la red local de aula, rotar un cert era cuestión de regenerar y reiniciar. En multi-máquina:

```mermaid
sequenceDiagram
    participant Admin as Admin Hotel
    participant CA as CA Hotel (M2)
    participant Peer as Peer Hotel (M3)

    Admin->>CA: reenroll peer0
    CA-->>Admin: Nuevo cert + clave
    Admin->>Peer: SCP nuevo cert + clave (canal seguro)
    Admin->>Peer: docker restart peer0
    Note over Peer: El peer arranca con nuevo cert
    Peer->>Peer: Verificar peer channel list (siguen los canales)
```

**Pasos clave**:
- Reenrollar SIEMPRE en la máquina de la CA (donde está la clave de la CA)
- Transferir el nuevo cert + clave al peer **por canal seguro** (SCP, no e-mail)
- Reiniciar el peer
- Verificar que sigue conectado al canal

### 6. Coordinación entre orgs

Operaciones que requieren coordinación entre las 3 orgs:

| Operación | Acciones por org | Quién coordina |
|-----------|------------------|---------------|
| **Crear el canal** | OrdererOrg genera bloque génesis con MSPs de las 3 orgs | OrdererOrg |
| **Desplegar chaincode** | Cada org instala + aprueba; uno commitea | El que propone el chaincode |
| **Actualizar chaincode** | Cada org instala nueva versión + aprueba sequence+1 | El que propone la actualización |
| **Añadir nueva org al canal** | Mayoría aprueba el config update | Quien quiere unirse + sponsor |
| **Cambiar políticas del canal** | Mayoría aprueba | Cualquier admin |
| **Rotar cert de orderer** | OrdererOrg lo hace; las orgs actualizan trust | OrdererOrg |

---

## Ejercicio para los alumnos

Antes de pasar a otro tema, piensa en estas preguntas para tu proyecto FidelityChain en una versión real:

1. **Si el Hotel y la Cafetería estuvieran en países distintos**, ¿qué cambiaría en la arquitectura? Piensa en latencia, regulación, soberanía de datos.

2. **¿Quién debería operar la máquina del orderer?** ¿Tiene sentido que sea el Hotel? ¿La Cafetería? ¿Un tercero? ¿Por qué?

3. **¿Qué pasa si la conexión a internet del Hotel cae durante 1 hora?** ¿Pueden los clientes seguir canjeando puntos en la Cafetería?

4. **El cert TLS del peer Hotel caduca el viernes a las 18:00**. La Cafetería trabaja todo el fin de semana. Diseña un plan para rotar el cert sin interrumpir la operación de la Cafetería.

5. **Una nueva empresa (Restaurante) quiere unirse al consorcio**. ¿Cuántas máquinas más hace falta? ¿Quién aprueba la incorporación? ¿Cómo se le incluye en el canal?

6. **Si fueras consultor**, ¿qué opción (A, B o C) recomendarías para FidelityChain en su primer año en producción? Justifica.

---

## Referencias

- Despliegue de Fabric en producción (oficial): https://hyperledger-fabric.readthedocs.io/en/latest/deployment_guide_overview.html
- Doc del proyecto: [02 - Arquitectura de red](02-arquitectura-red.md)
- Doc relacionado: [05 - Fabric CA](../05-fabric-ca.md) y [06 - Operaciones de administración](../06-operaciones-administración.md)

---

**Anterior:** [06 - Pruebas y demo](06-pruebas-y-demo.md)
