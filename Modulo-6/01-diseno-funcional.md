# 01 - Diseño funcional: FidelityChain

## Descripción del proyecto

FidelityChain es un sistema de puntos de fidelizacion compartido entre dos empresas: un **hotel** y una **cafeteria**. El hotel emite puntos a sus clientes como recompensa por cada estancia. Los clientes pueden gastar esos puntos en la cafeteria para pagar desayunos, cafes y otros productos.

Ambas empresas comparten un ledger común en Hyperledger Fabric que registra de forma inmutable todas las emisiones, canjes y transferencias de puntos. Ninguna de las dos puede modificar los datos de la otra, y ambas tienen visibilidad completa de los movimientos.

---

## Por que blockchain para esto?

Sin blockchain, este sistema requeriria que una de las dos empresas (o un tercero) gestionase la base de datos de puntos. Esto genera problemas de confianza:

- Si el hotel gestiona la base de datos, la cafeteria tiene que confiar en que no emite puntos fraudulentos
- Si la cafeteria la gestiona, el hotel tiene que confiar en que los canjes son legitimos
- Si un tercero la gestiona, ambas dependen de el y pagan por el servicio

Con Fabric, **cada empresa mantiene su propia copia del ledger** y valida las transacciones de la otra. No hay intermediario, no hay confianza ciega, y el registro es inmutable.

---

## Actores del sistema

```mermaid
graph TB
    subgraph "Hotel (Org1)"
        HA["Admin Hotel<br/>Emite puntos"]
    end

    subgraph "Cafeteria (Org2)"
        CA["Admin Cafeteria<br/>Canjea puntos"]
    end

    subgraph "Clientes"
        C1["Cliente<br/>Recibe y gasta puntos"]
    end

    HA -- "Emite 100 puntos<br/>al DNI 12345678A" --> C1
    C1 -- "Muestra DNI, canjea<br/>30 puntos por desayuno" --> CA

    style HA fill:#22627E,color:#fff
    style CA fill:#0D9448,color:#fff
    style C1 fill:#B45D09,color:#fff
```

| Actor | Organización | Rol | Que puede hacer |
|-------|-------------|-----|-----------------|
| **Admin Hotel** | Org1 (Hotel) | Emisor | Emitir puntos a clientes, consultar saldos |
| **Admin Cafeteria** | Org2 (Cafeteria) | Canjeador | Canjear puntos de clientes por productos, consultar saldos |
| **Cliente** | Identificado por DNI | Beneficiario | Consultar su saldo e historial |

> **Identificación de clientes:** Los clientes se identifican por su **número de DNI/pasaporte** (por ejemplo `12345678A`). No tienen certificado X.509 propio en la red Fabric — son registros en el World State gestionados por los admins. Cuando un cliente quiere canjear puntos en la cafeteria, muestra su DNI y el admin de la cafeteria ejecuta la transacción en su nombre.

---

## Flujos funcionales

### Flujo 1: Emisión de puntos

```mermaid
sequenceDiagram
    participant H as Admin Hotel
    participant CC as Chaincode
    participant WS as World State

    H->>CC: Mint("12345678A", 100)
    CC->>CC: Verifica: caller es Org1 (hotel)?
    CC->>CC: Verifica: amount > 0?
    CC->>WS: balance["12345678A"] += 100
    CC->>WS: totalSupply += 100
    CC->>H: OK + evento PointsMinted
```

1. Un huesped hace check-out en el hotel
2. El admin del hotel ejecuta `Mint("12345678A", 100)` para emitirle 100 puntos
3. El chaincode verifica que quien llama es Org1 (solo el hotel puede emitir)
4. Se actualiza el saldo del cliente y el supply total
5. Se emite un evento `PointsMinted` que la cafeteria puede escuchar

### Flujo 2: Canje de puntos

```mermaid
sequenceDiagram
    participant C as Cliente
    participant CA as Admin Cafeteria
    participant CC as Chaincode
    participant WS as World State

    C->>CA: Muestra DNI: "Quiero un desayuno (30 puntos)"
    CA->>CC: Redeem("12345678A", 30, "desayuno")
    CC->>CC: Verifica: caller es Org2 (cafeteria)?
    CC->>CC: Verifica: saldo >= 30?
    CC->>WS: balance["12345678A"] -= 30
    CC->>WS: totalRedeemed += 30
    CC->>CA: OK + evento PointsRedeemed
    CA->>C: "Aqui tiene su desayuno"
```

1. El cliente llega a la cafeteria y dice que quiere pagar con puntos
2. El admin de la cafeteria ejecuta `Redeem("12345678A", 30, "desayuno")`
3. El chaincode verifica que quien llama es Org2 (solo la cafeteria canjea)
4. Se verifica que el cliente tiene saldo suficiente
5. Se descuenta del saldo y se registra el canje
6. Se emite un evento `PointsRedeemed`

### Flujo 3: Consulta de saldo e historial

```mermaid
sequenceDiagram
    participant U as Cualquier admin
    participant CC as Chaincode
    participant WS as World State

    U->>CC: BalanceOf("12345678A")
    CC->>WS: Lee balance["12345678A"]
    CC-->>U: 70 puntos

    U->>CC: TransactionHistory("12345678A")
    CC->>WS: Lee historial
    CC-->>U: [{type:"mint", amount:100}, {type:"redeem", amount:30, product:"desayuno"}]
```

---

## Catalogo de productos (cafeteria)

| Producto | Puntos |
|----------|--------|
| Cafe solo | 10 |
| Cafe con leche | 15 |
| Tostada | 15 |
| Desayuno completo | 30 |
| Menu almuerzo | 50 |

> El catalogo se gestiona en la aplicación cliente, no en el chaincode. El chaincode solo ve el canje de puntos con una descripción del producto.

---

## Reglas de negocio

1. **Solo el hotel (Org1) puede emitir puntos** — La cafeteria no puede crear puntos de la nada
2. **Solo la cafeteria (Org2) puede canjear puntos** — El hotel no canjea en nombre del cliente
3. **Ambas organizaciones pueden consultar saldos e historiales** — Transparencia total
4. **No se puede gastar mas de lo que se tiene** — el chaincode valida saldo >= amount
5. **Los puntos no caducan** — Simplificacion para el proyecto (en producción se añadiría TTL)
6. **No hay transferencia entre clientes** — Solo mint y redeem (simplificacion)
7. **El amount debe ser positivo** — No se permiten operaciones con 0 o negativos
8. **El historial es inmutable** — Cada operación queda registrada para siempre

---

## Modelo de datos

```mermaid
erDiagram
    CLIENT {
        string clientID PK "DNI o pasaporte del cliente"
        string name "Nombre del cliente"
        int balance "Saldo actual de puntos"
        string registeredBy "Org que registro al cliente"
        string createdAt "Fecha de registro"
    }

    TRANSACTION {
        string txID PK "ID de transaccion (Fabric)"
        string clientID FK "Cliente asociado"
        string txType "mint | redeem"
        int amount "Cantidad de puntos"
        string description "Motivo (estancia, desayuno...)"
        string org "Org que ejecuto la operacion"
        string timestamp "Fecha y hora"
    }

    TOKEN_INFO {
        string key PK "tokenInfo"
        string name "FidelityPoints"
        string symbol "FP"
        int totalSupply "Total emitido"
        int totalRedeemed "Total canjeado"
    }

    CLIENT ||--o{ TRANSACTION : "tiene"
```

### Keys en el World State

| Key | Valor | Propósito |
|-----|-------|-----------|
| `client~12345678A` | JSON del cliente (name, balance...) | Datos del cliente |
| `tx~12345678A~00001` | JSON de la transacción | Historial (composite key) |
| `tokenInfo` | JSON con totales | Metadata del token |

---

## Funciones del chaincode

| Funcion | Quien puede llamarla | Descripción |
|---------|---------------------|-------------|
| `RegisterClient(clientID, name)` | Org1 o Org2 | Registrar un nuevo cliente |
| `Mint(clientID, amount, description)` | Solo Org1 (Hotel) | Emitir puntos |
| `Redeem(clientID, amount, product)` | Solo Org2 (Cafeteria) | Canjear puntos por producto |
| `BalanceOf(clientID)` | Org1 o Org2 | Consultar saldo |
| `ClientHistory(clientID)` | Org1 o Org2 | Ver historial de movimientos |
| `GetTokenInfo()` | Org1 o Org2 | Ver totales (supply, redeemed) |
| `GetAllClients()` | Org1 o Org2 | Listar todos los clientes |

---

## Eventos

| Evento | Payload | Cuando se emite |
|--------|---------|-----------------|
| `ClientRegistered` | `{clientID, name, registeredBy}` | Al registrar un cliente nuevo |
| `PointsMinted` | `{clientID, amount, description, newBalance}` | Al emitir puntos |
| `PointsRedeemed` | `{clientID, amount, product, newBalance}` | Al canjear puntos |

---

**Siguiente:** [02 - Arquitectura de red](02-arquitectura-red.md)
