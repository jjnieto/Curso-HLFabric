# 05 — Fabric CA: gestión de identidades en producción

En los documentos anteriores hemos usado `cryptogen` para generar todos los certificados de golpe. Eso funciona para aprender y para hacer demos, pero no encaja en un entorno real donde las identidades **nacen y mueren** continuamente: empleados que entran, equipos que se rotan, certificados que caducan, claves que se filtran.

Fabric CA es una **autoridad certificadora** real que cada organización opera por su cuenta. Emite certificados bajo demanda, los renueva, los revoca y mantiene un registro auditable de cada operación.

Este documento te lleva de la mano por todo el ciclo de vida: levantar las CAs en Docker, enrollar al administrador raíz de cada una, registrar y enrollar las identidades concretas (peer, admin, usuarios), construir los MSPs que Fabric espera, y finalmente revocar y renovar cuando haga falta.

---

## ¿Por qué Fabric CA si ya tenemos cryptogen?

Las limitaciones de `cryptogen` se ven nada más entrar en producción:

- **No puedes añadir nuevos usuarios** sin regenerar TODO el material crypto desde cero.
- **No puedes revocar** un certificado comprometido (un portátil robado, un empleado despedido, una clave filtrada).
- **No puedes renovar** certificados que caducan: hay que regenerar la red entera.
- **No hay registro auditable** de quién pidió qué certificado y cuándo. Sin trazabilidad, no hay forma de demostrar el cumplimiento ante un regulador o un auditor.

Fabric CA resuelve esas cuatro limitaciones a la vez y añade:

- **Cada organización opera su propia CA**, manteniendo soberanía total sobre sus identidades.
- **Atributos personalizados** en los certificados (`role=auditor`, `department=legal`) que los chaincodes pueden leer para autorización fina (ABAC).
- **Política de afiliaciones** jerárquicas que reflejan la estructura interna de cada organización.

> **Analogía**: `cryptogen` es como imprimir todos los DNIs de un país el día de la fundación. Fabric CA es el registro civil: emite DNIs bajo demanda, los renueva cuando caducan y los invalida si se pierden o se denuncian como robados.

---

## Comparativa rápida: cryptogen vs Fabric CA

| Aspecto | cryptogen | Fabric CA |
|---|---|---|
| Uso recomendado | Desarrollo, prototipos, aprendizaje | Producción, demos serias |
| Generación de identidades | Todas a la vez | Bajo demanda con `register` + `enroll` |
| Añadir usuarios nuevos | Regenerar toda la red | Una línea de comando |
| Revocar certificados | No es posible | `revoke` + `gencrl` |
| Renovar certificados | No es posible | `reenroll` |
| Atributos personalizados | No | Sí (`--id.attrs`) |
| Auditoría | Sin registro | Log completo de operaciones |
| Complejidad de puesta en marcha | Mínima | Mayor (servidor + cliente por org) |

> **Regla práctica**: usa `cryptogen` para aprender y prototipar. Usa Fabric CA para cualquier cosa que se parezca a un entorno de producción, demo a un cliente o piloto.

---

## El flujo completo de Fabric CA

Para tener una red con Fabric CA totalmente operativa hay que recorrer seis pasos. Es importante entender este flujo antes de tocar comandos:

```mermaid
graph LR
    P1["1. Levantar<br/>las 3 CAs<br/>(Docker)"] --> P2["2. Enrollar admin<br/>bootstrap<br/>(por CA)"]
    P2 --> P3["3. Registrar<br/>identidades<br/>(peer, admin, users)"]
    P3 --> P4["4. Enrollar<br/>identidades<br/>(obtener certs)"]
    P4 --> P5["5. Construir<br/>estructura MSP<br/>(channel + locales)"]
    P5 --> P6["Red lista para<br/>arrancar peers<br/>y orderer"]

    style P1 fill:#7C3AED,color:#fff
    style P2 fill:#22627E,color:#fff
    style P3 fill:#B45D09,color:#fff
    style P4 fill:#B45D09,color:#fff
    style P5 fill:#0D9448,color:#fff
    style P6 fill:#EC0000,color:#fff
```

Cada paso tiene un responsable distinto y produce un resultado concreto:

| Paso | ¿Quién lo hace? | ¿Cuántas veces? | ¿Qué produce? |
|------|-----------------|------------------|----------------|
| **1. Levantar CAs** | Administrador de la red | 1 vez (al desplegar la red) | Tres CAs corriendo (Org1, Org2, OrdererOrg) |
| **2. Enrollar admin bootstrap** | Admin de cada org | 1 vez por CA | Cert del super-admin de la CA |
| **3. Registrar identidades** | Admin bootstrap | 1 vez por identidad | La identidad existe en la CA, lista para enrollarse |
| **4. Enrollar identidades** | El propio titular (peer, admin, user...) | 1 vez por identidad | Cert X.509 + clave privada |
| **5. Construir MSPs** | Admin de la red | 1 vez al inicio | Carpetas `organizations/` con la estructura que Fabric espera |
| **6. Operación continua** | Cualquier admin | A demanda | Nuevas identidades, revocaciones, renovaciones |

> **Esto NO es como cryptogen**: en cryptogen, los pasos 2-5 son una sola ejecución de `cryptogen generate`. En Fabric CA cada paso es explícito y se hace por separado, lo cual da control y trazabilidad a cambio de más complejidad operativa.

---

## Emisión vs validación: ¿quién comprueba los certificados?

Es crítico entender que **Fabric CA solo emite certificados**. No los valida en tiempo real cada vez que un usuario hace una transacción.

```mermaid
sequenceDiagram
    participant CA as Fabric CA
    participant User as Usuario
    participant Peer as Peer

    Note over CA,User: EMISIÓN (una vez)
    User->>CA: enroll (dame mi cert)
    CA-->>User: Certificado firmado por la CA

    Note over User,Peer: VALIDACIÓN (cada transacción)
    User->>Peer: Transacción + certificado
    Peer->>Peer: ¿El cert está firmado por una<br/>CA que está en mi MSP?
    Note over Peer: NO contacta a la CA
    Peer-->>User: OK / Rechazado
```

La validación la hacen los **peers localmente**, verificando la cadena de firmas contra el certificado raíz de la CA que tienen en su MSP. Es como un DNI: el registro civil lo emite, pero cuando lo enseñas en un hotel, el hotel no llama al registro civil — comprueba los sellos de seguridad por sí mismo.

La **única excepción** es la revocación: cuando se revoca un certificado, hay que generar una CRL (Certificate Revocation List) y distribuirla a los MSPs de los peers. Si no se actualiza la CRL, un certificado revocado seguirá siendo aceptado por los peers que no la tengan.

---

## ¿Se puede usar Fabric CA sobre una red ya creada con cryptogen?

**No.** Son incompatibles sobre la misma red. La razón:

- `cryptogen` genera su propia CA raíz (con su clave privada propia).
- Fabric CA genera otra CA raíz diferente (con otra clave privada).
- Los peers solo confían en la CA raíz que tienen registrada en su MSP.
- Los certificados emitidos por Fabric CA estarían firmados por una CA que los peers no reconocen → **los rechazarían todos**.

```mermaid
graph TB
    subgraph "Red montada con cryptogen"
        CA_CG["CA raíz A<br/>(generada por cryptogen)"]
        CA_CG --> CERT_CG["Certs firmados por A"]
        CERT_CG --> PEER["Peer confía en A"]
    end

    subgraph "Fabric CA (servidor nuevo)"
        CA_FC["CA raíz B<br/>(generada por Fabric CA)"]
        CA_FC --> CERT_FC["Certs firmados por B"]
        CERT_FC -. "RECHAZADO:<br/>B no está en el MSP" .-> PEER
    end

    style CA_CG fill:#0D9448,color:#fff
    style CA_FC fill:#EC0000,color:#fff
```

Para usar Fabric CA hay que **montar la red desde cero** con Fabric CA desde el principio. Eso es justo lo que vamos a hacer en el resto de este documento.

> **Nota para alumnos curiosos**: técnicamente podrías usar `openssl` para generar certificados sueltos firmados por la CA raíz de `cryptogen` (la clave privada está en `crypto-config/.../ca/`). Funcionaría, pero tendrías que gestionar manualmente los atributos NodeOU, la estructura MSP, las extensiones X.509 y la revocación. Fabric CA hace todo eso por ti.

---

## Arquitectura de Fabric CA en una red real

En una red de producción, **cada organización tiene su propia Fabric CA**. La CA de Org1 solo emite certificados para miembros de Org1, y la CA de Org2 solo para los suyos. La organización del orderer también tiene su CA propia.

```mermaid
graph TB
    subgraph "Red Fabric"
        subgraph Org1["Org1"]
            CA1["Fabric CA Org1<br/>Puerto: 7054"]
            CA1 --> P1["peer0.org1<br/>(cert emitido por CA1)"]
            CA1 --> A1["Admin@org1<br/>(cert emitido por CA1)"]
            CA1 --> U1["User1@org1<br/>(cert emitido por CA1)"]
        end

        subgraph Org2["Org2"]
            CA2["Fabric CA Org2<br/>Puerto: 8054"]
            CA2 --> P2["peer0.org2<br/>(cert emitido por CA2)"]
            CA2 --> A2["Admin@org2<br/>(cert emitido por CA2)"]
        end

        subgraph OrdererOrg["OrdererOrg"]
            CA0["Fabric CA Orderer<br/>Puerto: 9054"]
            CA0 --> ORD["orderer.example.com<br/>(cert emitido por CA0)"]
            CA0 --> AO["Admin@example.com<br/>(cert emitido por CA0)"]
        end
    end

    style CA1 fill:#7C3AED,color:#fff
    style CA2 fill:#7C3AED,color:#fff
    style CA0 fill:#7C3AED,color:#fff
```

Fabric CA tiene dos componentes:

- **`fabric-ca-server`**: el servidor que gestiona las identidades. Hay uno por organización.
- **`fabric-ca-client`**: la herramienta CLI que usan los administradores para interactuar con el servidor (registrar, enrollar, revocar...).

---

## Register vs Enroll: los dos verbos clave

Estas son las dos operaciones fundamentales y es muy importante no confundirlas:

```mermaid
sequenceDiagram
    participant Admin as Admin de la Org
    participant CA as Fabric CA Server
    participant User as Nuevo usuario

    Note over Admin,CA: REGISTER (crear la identidad)
    Admin->>CA: register --id.name juan --id.secret password123
    CA->>CA: Guarda: juan puede enrollarse
    CA-->>Admin: OK, identidad registrada

    Note over User,CA: ENROLL (obtener el certificado)
    User->>CA: enroll -u https://juan:password123@ca:7054
    CA->>CA: Genera cert X.509 para juan
    CA-->>User: Certificado + clave privada
```

| Operación | Quién la ejecuta | Qué hace | Resultado |
|-----------|------------------|----------|-----------|
| **`register`** | Admin de la org | Crea una identidad en la CA y le asigna una contraseña inicial | La identidad existe pero **aún no tiene certificado** |
| **`enroll`** | El propio titular de la identidad | Solicita su certificado a la CA usando la contraseña inicial | Obtiene cert X.509 + clave privada |

> **Analogía**: `register` es como dar de alta a un ciudadano en el padrón. `enroll` es cuando ese ciudadano va a la oficina a recoger su DNI por primera vez.

### Atributos y tipos

Al registrar una identidad se puede especificar:

- **Tipo** (`--id.type`): `client`, `peer`, `orderer`, `admin`. Marca en el OU del cert y se usa para NodeOUs.
- **Atributos personalizados** (`--id.attrs`): `role=auditor`, `department=legal`, etc.
- **Afiliación** (`--id.affiliation`): la posición jerárquica dentro de la org (`org1.department1`).

Estos atributos quedan embebidos en el certificado X.509 y pueden usarse para control de acceso fino en los chaincodes (Attribute-Based Access Control, ABAC).

---

## Prerequisitos

Para seguir este tutorial necesitas:

- **Docker** y **Docker Compose** instalados y funcionando.
- Los **binarios de Fabric** instalados, incluyendo `fabric-ca-client`. Si seguiste el documento `01-requisitos-e-instalacion.md`, ya los tienes.
- Comprobar que `fabric-ca-client` está en el PATH:

```bash
fabric-ca-client version
```

Debe mostrar la versión (1.5.x o superior).

- Variables de entorno para los binarios de Fabric (si no las tienes ya):

```bash
export PATH=$PWD/bin:$PATH
export FABRIC_CFG_PATH=$PWD/config
```

> Si vas a montar esta red en paralelo con otra red de prácticas (por ejemplo la del documento `03-crear-red-personalizada.md`), revisa que los puertos `7054`, `8054`, `9054`, `7050`, `7051`, `9051` no estén ya en uso.

---

## Paso 1 — Crear la estructura de directorios

Antes de levantar nada, prepara el árbol de directorios donde va a vivir todo el material crypto y de configuración:

```bash
mkdir -p $HOME/red-con-ca/{fabric-ca/org1,fabric-ca/org2,fabric-ca/orderer}
mkdir -p $HOME/red-con-ca/{organizations,channel-artifacts,docker}
cd $HOME/red-con-ca
```

Estructura resultante:

```
red-con-ca/
├── fabric-ca/
│   ├── org1/          # ← aquí vivirán los datos de la CA de Org1
│   ├── org2/          # ← idem Org2
│   └── orderer/       # ← idem OrdererOrg
├── organizations/     # ← aquí construiremos los MSPs en el Paso 6
├── channel-artifacts/ # ← bloque génesis y configtx (lo veremos después)
└── docker/            # ← compose files
```

> Mantén una terminal abierta en `$HOME/red-con-ca` durante todo el tutorial. **Todos los comandos asumen que estás ahí**.

---

## Paso 2 — Levantar las tres CAs con Docker Compose

Vamos a arrancar tres servidores `fabric-ca-server`, uno por organización, en puertos distintos:

| Organización | Puerto | Container |
|---|---|---|
| Org1 | 7054 | `ca.org1.example.com` |
| Org2 | 8054 | `ca.org2.example.com` |
| OrdererOrg | 9054 | `ca.orderer.example.com` |

Crea el archivo `docker/docker-compose-ca.yaml` con este contenido:

```yaml
version: '3.7'

networks:
  fabric-ca-net:
    name: fabric-ca-net

services:
  ca.org1.example.com:
    container_name: ca.org1.example.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-org1
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=7054
    ports:
      - 7054:7054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/org1:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric-ca-net

  ca.org2.example.com:
    container_name: ca.org2.example.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-org2
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=8054
    ports:
      - 8054:8054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/org2:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric-ca-net

  ca.orderer.example.com:
    container_name: ca.orderer.example.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-orderer
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=9054
    ports:
      - 9054:9054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/orderer:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric-ca-net
```

**Decisiones importantes del compose:**

| Variable | Para qué |
|---|---|
| `FABRIC_CA_SERVER_CA_NAME` | Nombre lógico de la CA. Lo usaremos en el cliente con `--caname` |
| `FABRIC_CA_SERVER_TLS_ENABLED=true` | Obliga a TLS. Sin esto las claves viajan en claro |
| `FABRIC_CA_SERVER_PORT` | Puerto donde escucha. Cada CA, uno distinto |
| `command: ... -b admin:adminpw` | Crea el usuario administrador "bootstrap" al arrancar la CA por primera vez |
| `volumes: ../fabric-ca/orgX:/etc/hyperledger/fabric-ca-server` | Persiste todo el estado de la CA en `fabric-ca/orgX/` para que sobreviva a reinicios |

Levanta las tres CAs:

```bash
docker compose -f docker/docker-compose-ca.yaml up -d
```

Comprueba que están corriendo:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep ca\.
```

Salida esperada (las tres en estado `Up`):

```
ca.org1.example.com     Up 5 seconds
ca.org2.example.com     Up 5 seconds
ca.orderer.example.com  Up 5 seconds
```

Y verifica que cada CA responde por HTTPS:

```bash
curl -k https://localhost:7054/cainfo   # CA Org1
curl -k https://localhost:8054/cainfo   # CA Org2
curl -k https://localhost:9054/cainfo   # CA Orderer
```

Cada llamada debe devolver un JSON con el nombre de la CA y su cert raíz en base64. Si te da error de conexión, espera unos segundos a que la CA termine de arrancar y reintenta.

> En el primer arranque, cada CA crea automáticamente su par de certificados raíz dentro de `fabric-ca/orgX/`. El archivo `fabric-ca/orgX/tls-cert.pem` es el cert TLS del propio servidor — lo necesitaremos en todos los comandos `fabric-ca-client` que vienen después.

---

## Paso 3 — Enrollar al admin bootstrap de cada CA

Cuando arrancamos cada CA con `-b admin:adminpw`, se crea un usuario "bootstrap" llamado `admin`. Es el super-administrador de esa CA y el único que puede registrar nuevas identidades. Pero antes de poder usarlo, hay que **enrollarlo** para obtener su certificado.

```mermaid
sequenceDiagram
    participant Admin as Admin bootstrap
    participant CA as Fabric CA Server

    Admin->>CA: enroll (admin:adminpw)
    CA-->>Admin: Cert + clave privada
    Note over Admin: Ya puede registrar otras identidades
```

### Enrollar admin bootstrap de Org1

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:7054 \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

**Resultado esperado**: se crea la carpeta `fabric-ca/org1/admin/msp/` con esta estructura:

```
fabric-ca/org1/admin/
├── msp/
│   ├── cacerts/          # Cert raíz de la CA de Org1
│   ├── keystore/         # Clave privada del admin bootstrap
│   ├── signcerts/        # Certificado del admin bootstrap
│   ├── tlscacerts/       # Cert TLS root de la CA
│   ├── user/
│   ├── IssuerPublicKey
│   └── IssuerRevocationPublicKey
└── fabric-ca-client-config.yaml
```

A partir de aquí, mientras tengamos `FABRIC_CA_CLIENT_HOME` apuntando a este directorio, todos los comandos `fabric-ca-client` se ejecutarán **como admin bootstrap de Org1**.

### Enrollar admin bootstrap de Org2

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:8054 \
  --caname ca-org2 \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem
```

### Enrollar admin bootstrap de OrdererOrg

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:9054 \
  --caname ca-orderer \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem
```

**Parámetros que conviene entender:**

| Flag | Descripción |
|---|---|
| `-u https://admin:adminpw@localhost:7054` | URL con usuario, contraseña y endpoint de la CA |
| `--caname ca-org1` | Nombre lógico de la CA (el del compose) |
| `--tls.certfiles` | Cert TLS de la CA, necesario porque hablamos por HTTPS |
| `FABRIC_CA_CLIENT_HOME` | Carpeta donde se guarda la identidad enrollada |

---

## Paso 4 — Registrar las identidades de Org1

Con el admin bootstrap de Org1 enrollado, ya podemos **registrar** las identidades que necesita la organización: su peer, su admin operacional y, opcionalmente, algunos usuarios cliente.

> **Recuerda**: registrar **no genera** certificados todavía. Solo crea la identidad en la CA y le asigna una contraseña inicial. El certificado se genera en el siguiente paso (enroll).

```bash
# Asegurarnos de operar como admin bootstrap de Org1
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

# 4.1 - Registrar el peer
fabric-ca-client register \
  --caname ca-org1 \
  --id.name peer0 \
  --id.secret peer0pw \
  --id.type peer \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# 4.2 - Registrar el admin de la org
fabric-ca-client register \
  --caname ca-org1 \
  --id.name org1admin \
  --id.secret org1adminpw \
  --id.type admin \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# 4.3 - Registrar un usuario cliente con atributos personalizados
fabric-ca-client register \
  --caname ca-org1 \
  --id.name user1 \
  --id.secret user1pw \
  --id.type client \
  --id.attrs '"role=operator,department=reception"' \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

**¿Qué hace cada flag?**

| Flag | Descripción |
|---|---|
| `--id.name` | Nombre interno de la identidad (usuario único en la CA) |
| `--id.secret` | Contraseña inicial. Solo se usa en el primer enroll |
| `--id.type` | `peer`, `admin`, `orderer` o `client`. Marca el OU del cert |
| `--id.attrs` | Atributos personalizados embebidos en el cert (para ABAC) |

> Los atributos `role=operator` y `department=reception` quedarán embebidos en el certificado de `user1` y podrán verificarse desde un chaincode con `ctx.GetClientIdentity().GetAttributeValue("role")`. Lo veremos en detalle en el Módulo 4.

**Verificar lo registrado:**

```bash
fabric-ca-client identity list \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

Debes ver una lista con `admin` (el bootstrap), `peer0`, `org1admin` y `user1`.

---

## Paso 5 — Enrollar las identidades de Org1

Cada identidad registrada ahora necesita **enrollarse** para obtener su certificado X.509. El enroll lo hace el propio titular de la identidad usando la contraseña que se le asignó en el register.

> En este tutorial actuamos como cada usuario "manualmente" cambiando el `FABRIC_CA_CLIENT_HOME` para apuntar a su carpeta. En producción cada usuario lo haría desde su propia máquina.

### 5.1 — Enrollar el peer (identidad MSP)

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/peer0

fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:7054 \
  --caname ca-org1 \
  --csr.hosts peer0.org1.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

El flag `--csr.hosts` añade Subject Alternative Names (SANs) al certificado, equivalentes al `SANS` de `crypto-config.yaml` en cryptogen. Sin esto, el peer no aceptará conexiones que apunten a `localhost`.

### 5.2 — Enrollar el peer (identidad TLS)

El peer necesita **dos identidades** distintas:

- Una para firmar transacciones (MSP, el enroll anterior).
- Otra para cifrar las comunicaciones gRPC (TLS, el enroll que viene ahora).

Usamos la misma CA pero con el flag `--enrollment.profile tls`, que le dice a la CA que emita un certificado con propósito TLS:

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/peer0/tls

fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:7054 \
  --caname ca-org1 \
  --enrollment.profile tls \
  --csr.hosts peer0.org1.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

### 5.3 — Enrollar el admin operacional de Org1

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/org1admin

fabric-ca-client enroll \
  -u https://org1admin:org1adminpw@localhost:7054 \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

### 5.4 — Enrollar el usuario con sus atributos

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/user1

fabric-ca-client enroll \
  -u https://user1:user1pw@localhost:7054 \
  --caname ca-org1 \
  --enrollment.attrs "role,department" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

El flag `--enrollment.attrs "role,department"` le dice a la CA que incluya esos atributos en el cert. Si no lo pones, la CA emite el cert sin atributos aunque los hayas registrado.

**Verificar que tu cert lleva los atributos:**

```bash
openssl x509 -in $PWD/fabric-ca/org1/user1/msp/signcerts/cert.pem -text -noout | grep -A 2 "Custom Attributes"
```

---

## Paso 6 — Repetir registro y enroll para Org2 y OrdererOrg

El proceso es idéntico al de Org1 pero cambiando puertos y CAs. Aquí va el bloque completo:

### Org2 (puerto 8054)

```bash
# Operar como admin bootstrap de Org2
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/admin

# Registrar peer y admin
fabric-ca-client register --caname ca-org2 \
  --id.name peer0 --id.secret peer0pw --id.type peer \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

fabric-ca-client register --caname ca-org2 \
  --id.name org2admin --id.secret org2adminpw --id.type admin \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Enrollar peer (identidad MSP)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:8054 \
  --caname ca-org2 \
  --csr.hosts peer0.org2.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Enrollar peer (identidad TLS)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/peer0/tls
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:8054 \
  --caname ca-org2 \
  --enrollment.profile tls \
  --csr.hosts peer0.org2.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Enrollar admin operacional
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/org2admin
fabric-ca-client enroll \
  -u https://org2admin:org2adminpw@localhost:8054 \
  --caname ca-org2 \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem
```

### OrdererOrg (puerto 9054)

```bash
# Operar como admin bootstrap del Orderer
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/admin

# Registrar el orderer y un admin operacional
fabric-ca-client register --caname ca-orderer \
  --id.name orderer --id.secret ordererpw --id.type orderer \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

fabric-ca-client register --caname ca-orderer \
  --id.name ordereradmin --id.secret ordereradminpw --id.type admin \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

# Enrollar el nodo orderer (identidad MSP)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/orderer
fabric-ca-client enroll \
  -u https://orderer:ordererpw@localhost:9054 \
  --caname ca-orderer \
  --csr.hosts orderer.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

# Enrollar el nodo orderer (identidad TLS)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/orderer/tls
fabric-ca-client enroll \
  -u https://orderer:ordererpw@localhost:9054 \
  --caname ca-orderer \
  --enrollment.profile tls \
  --csr.hosts orderer.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

# Enrollar admin operacional
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/ordereradmin
fabric-ca-client enroll \
  -u https://ordereradmin:ordereradminpw@localhost:9054 \
  --caname ca-orderer \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem
```

A estas alturas tienes **todos los certificados** generados pero esparcidos por `fabric-ca/`. El siguiente paso es organizarlos en la estructura `organizations/` que Fabric espera.

---

## Paso 7 — Construir la estructura MSP

Fabric espera una estructura de carpetas muy concreta dentro de `organizations/`. Para cada peer-organización necesitamos:

```
organizations/peerOrganizations/orgX.example.com/
├── msp/                                  # MSP de la org (channel MSP)
│   ├── cacerts/ca-cert.pem
│   ├── tlscacerts/tlsca-cert.pem
│   └── config.yaml                       # NodeOUs
├── peers/peer0.orgX.example.com/
│   ├── msp/                              # MSP local del peer
│   │   ├── cacerts/
│   │   ├── tlscacerts/
│   │   ├── keystore/
│   │   ├── signcerts/
│   │   └── config.yaml
│   └── tls/                              # TLS del peer
│       ├── ca.crt
│       ├── server.crt
│       └── server.key
└── users/Admin@orgX.example.com/
    └── msp/                              # MSP local del admin
        ├── cacerts/
        ├── tlscacerts/
        ├── keystore/
        ├── signcerts/
        └── config.yaml
```

Y para la orderer-organización una estructura similar bajo `organizations/ordererOrganizations/`. Vamos a construirla **paso a paso** para que veas exactamente qué archivo va en cada sitio.

### 7.1 — MSP de Org1 (channel MSP)

El MSP de la organización es la "carpeta pública" de Org1: los peers de **otras** orgs lo usan para validar que las firmas que dicen ser de Org1 lo son realmente.

```bash
# Definimos una variable local con el directorio para no repetirla
ORG1_DIR=$PWD/organizations/peerOrganizations/org1.example.com

# Crear la estructura
mkdir -p $ORG1_DIR/msp/{cacerts,tlscacerts,admincerts,users}

# Copiar el cert raíz de la CA de identidad
cp $PWD/fabric-ca/org1/admin/msp/cacerts/* \
   $ORG1_DIR/msp/cacerts/

# Copiar el cert raíz de la TLS CA (en Fabric CA es el mismo, pero conceptualmente separado)
cp $PWD/fabric-ca/org1/peer0/tls/msp/tlscacerts/* \
   $ORG1_DIR/msp/tlscacerts/

# Crear el config.yaml con NodeOUs
CA_CERT_NAME=$(ls $ORG1_DIR/msp/cacerts/)
cat > $ORG1_DIR/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: orderer
EOF
```

**¿Qué es NodeOUs y por qué importa?** Es el mecanismo que permite distinguir si un certificado pertenece a un cliente, un peer, un admin o un orderer mirando solo el campo OU (Organizational Unit) del cert. Sin esto, Fabric no sabría diferenciar entre, por ejemplo, una transacción firmada por un peer interno y una firmada por un cliente externo.

### 7.2 — MSP local del peer de Org1

```bash
PEER_DIR=$ORG1_DIR/peers/peer0.org1.example.com

mkdir -p $PEER_DIR/msp/{cacerts,tlscacerts,keystore,signcerts}
mkdir -p $PEER_DIR/tls

# MSP local (identidad para firmar transacciones)
cp $PWD/fabric-ca/org1/peer0/msp/cacerts/*    $PEER_DIR/msp/cacerts/
cp $PWD/fabric-ca/org1/peer0/msp/keystore/*   $PEER_DIR/msp/keystore/
cp $PWD/fabric-ca/org1/peer0/msp/signcerts/*  $PEER_DIR/msp/signcerts/
cp $PWD/fabric-ca/org1/peer0/tls/msp/tlscacerts/* $PEER_DIR/msp/tlscacerts/
cp $ORG1_DIR/msp/config.yaml $PEER_DIR/msp/config.yaml

# TLS (identidad para cifrar gRPC)
cp $PWD/fabric-ca/org1/peer0/tls/msp/tlscacerts/*  $PEER_DIR/tls/ca.crt
cp $PWD/fabric-ca/org1/peer0/tls/msp/signcerts/*   $PEER_DIR/tls/server.crt
cp $PWD/fabric-ca/org1/peer0/tls/msp/keystore/*    $PEER_DIR/tls/server.key
```

### 7.3 — MSP local del admin de Org1

```bash
ADMIN_DIR=$ORG1_DIR/users/Admin@org1.example.com/msp

mkdir -p $ADMIN_DIR/{cacerts,tlscacerts,keystore,signcerts}

cp $PWD/fabric-ca/org1/org1admin/msp/cacerts/*    $ADMIN_DIR/cacerts/
cp $PWD/fabric-ca/org1/org1admin/msp/keystore/*   $ADMIN_DIR/keystore/
cp $PWD/fabric-ca/org1/org1admin/msp/signcerts/*  $ADMIN_DIR/signcerts/
cp $PWD/fabric-ca/org1/peer0/tls/msp/tlscacerts/* $ADMIN_DIR/tlscacerts/
cp $ORG1_DIR/msp/config.yaml $ADMIN_DIR/config.yaml
```

> El admin necesita su propio `config.yaml` de NodeOUs porque Fabric, al ver su certificado, comprueba si lleva el OU `admin` para concederle privilegios. Sin NodeOUs habilitado, el admin no podría ejecutar operaciones administrativas.

### 7.4 — Repetir para Org2

```bash
ORG2_DIR=$PWD/organizations/peerOrganizations/org2.example.com

# --- MSP de la org ---
mkdir -p $ORG2_DIR/msp/{cacerts,tlscacerts,admincerts,users}
cp $PWD/fabric-ca/org2/admin/msp/cacerts/*           $ORG2_DIR/msp/cacerts/
cp $PWD/fabric-ca/org2/peer0/tls/msp/tlscacerts/*    $ORG2_DIR/msp/tlscacerts/

CA_CERT_NAME=$(ls $ORG2_DIR/msp/cacerts/)
cat > $ORG2_DIR/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: orderer
EOF

# --- MSP local del peer ---
PEER_DIR=$ORG2_DIR/peers/peer0.org2.example.com
mkdir -p $PEER_DIR/msp/{cacerts,tlscacerts,keystore,signcerts}
mkdir -p $PEER_DIR/tls

cp $PWD/fabric-ca/org2/peer0/msp/cacerts/*           $PEER_DIR/msp/cacerts/
cp $PWD/fabric-ca/org2/peer0/msp/keystore/*          $PEER_DIR/msp/keystore/
cp $PWD/fabric-ca/org2/peer0/msp/signcerts/*         $PEER_DIR/msp/signcerts/
cp $PWD/fabric-ca/org2/peer0/tls/msp/tlscacerts/*    $PEER_DIR/msp/tlscacerts/
cp $ORG2_DIR/msp/config.yaml                          $PEER_DIR/msp/config.yaml

cp $PWD/fabric-ca/org2/peer0/tls/msp/tlscacerts/*    $PEER_DIR/tls/ca.crt
cp $PWD/fabric-ca/org2/peer0/tls/msp/signcerts/*     $PEER_DIR/tls/server.crt
cp $PWD/fabric-ca/org2/peer0/tls/msp/keystore/*      $PEER_DIR/tls/server.key

# --- MSP local del admin ---
ADMIN_DIR=$ORG2_DIR/users/Admin@org2.example.com/msp
mkdir -p $ADMIN_DIR/{cacerts,tlscacerts,keystore,signcerts}

cp $PWD/fabric-ca/org2/org2admin/msp/cacerts/*       $ADMIN_DIR/cacerts/
cp $PWD/fabric-ca/org2/org2admin/msp/keystore/*      $ADMIN_DIR/keystore/
cp $PWD/fabric-ca/org2/org2admin/msp/signcerts/*     $ADMIN_DIR/signcerts/
cp $PWD/fabric-ca/org2/peer0/tls/msp/tlscacerts/*    $ADMIN_DIR/tlscacerts/
cp $ORG2_DIR/msp/config.yaml                          $ADMIN_DIR/config.yaml
```

### 7.5 — MSPs de OrdererOrg

La estructura del orderer-org es similar pero con un nivel `orderers/` en lugar de `peers/`:

```bash
ORD_DIR=$PWD/organizations/ordererOrganizations/example.com

# --- MSP de la org ---
mkdir -p $ORD_DIR/msp/{cacerts,tlscacerts,admincerts,users}
cp $PWD/fabric-ca/orderer/admin/msp/cacerts/*            $ORD_DIR/msp/cacerts/
cp $PWD/fabric-ca/orderer/orderer/tls/msp/tlscacerts/*   $ORD_DIR/msp/tlscacerts/

CA_CERT_NAME=$(ls $ORD_DIR/msp/cacerts/)
cat > $ORD_DIR/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$CA_CERT_NAME
    OrganizationalUnitIdentifier: orderer
EOF

# --- MSP local del nodo orderer ---
ORDERER_NODE_DIR=$ORD_DIR/orderers/orderer.example.com
mkdir -p $ORDERER_NODE_DIR/msp/{cacerts,tlscacerts,keystore,signcerts}
mkdir -p $ORDERER_NODE_DIR/tls

cp $PWD/fabric-ca/orderer/orderer/msp/cacerts/*          $ORDERER_NODE_DIR/msp/cacerts/
cp $PWD/fabric-ca/orderer/orderer/msp/keystore/*         $ORDERER_NODE_DIR/msp/keystore/
cp $PWD/fabric-ca/orderer/orderer/msp/signcerts/*        $ORDERER_NODE_DIR/msp/signcerts/
cp $PWD/fabric-ca/orderer/orderer/tls/msp/tlscacerts/*   $ORDERER_NODE_DIR/msp/tlscacerts/
cp $ORD_DIR/msp/config.yaml                              $ORDERER_NODE_DIR/msp/config.yaml

cp $PWD/fabric-ca/orderer/orderer/tls/msp/tlscacerts/*   $ORDERER_NODE_DIR/tls/ca.crt
cp $PWD/fabric-ca/orderer/orderer/tls/msp/signcerts/*    $ORDERER_NODE_DIR/tls/server.crt
cp $PWD/fabric-ca/orderer/orderer/tls/msp/keystore/*     $ORDERER_NODE_DIR/tls/server.key

# --- MSP local del admin ---
ORDADMIN_DIR=$ORD_DIR/users/Admin@example.com/msp
mkdir -p $ORDADMIN_DIR/{cacerts,tlscacerts,keystore,signcerts}

cp $PWD/fabric-ca/orderer/ordereradmin/msp/cacerts/*     $ORDADMIN_DIR/cacerts/
cp $PWD/fabric-ca/orderer/ordereradmin/msp/keystore/*    $ORDADMIN_DIR/keystore/
cp $PWD/fabric-ca/orderer/ordereradmin/msp/signcerts/*   $ORDADMIN_DIR/signcerts/
cp $PWD/fabric-ca/orderer/orderer/tls/msp/tlscacerts/*   $ORDADMIN_DIR/tlscacerts/
cp $ORD_DIR/msp/config.yaml                              $ORDADMIN_DIR/config.yaml
```

### 7.6 — Verificación final del MSP construido

Comprueba que la estructura es la correcta:

```bash
tree organizations/ -L 4
```

Deberías ver tres ramas (`org1.example.com`, `org2.example.com` y `example.com` bajo `ordererOrganizations`), cada una con `msp/`, sus `peers/` o `orderers/`, y sus `users/`.

Y comprueba que los certs son válidos (deben tener un OU correcto):

```bash
openssl x509 \
  -in $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/signcerts/cert.pem \
  -text -noout | grep "OU"
```

Deberías ver `OU = peer` en alguna línea.

---

## Operaciones continuas

Una vez la red está en marcha, hay tres operaciones que harás con frecuencia: añadir nuevos usuarios, revocar certificados comprometidos y renovar los que caducan.

### Añadir un nuevo usuario

Es básicamente repetir los pasos 4 y 5 con la identidad nueva. Por ejemplo, para añadir un auditor en Org1:

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

fabric-ca-client register \
  --caname ca-org1 \
  --id.name auditor1 \
  --id.secret auditor1pw \
  --id.type client \
  --id.attrs '"role=auditor"' \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/auditor1
fabric-ca-client enroll \
  -u https://auditor1:auditor1pw@localhost:7054 \
  --caname ca-org1 \
  --enrollment.attrs "role" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

### Revocar un certificado

Cuando un certificado se ve comprometido o un empleado deja la organización, hay que revocarlo:

```bash
# Operar como admin bootstrap
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

# Revocar el certificado de user1
fabric-ca-client revoke \
  --caname ca-org1 \
  -e user1 \
  -r "affiliationchange" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

Razones válidas para `-r`: `keycompromise`, `cacompromise`, `affiliationchange`, `superseded`, `cessationofoperation`, `unspecified`.

Después de revocar, hay que **generar una nueva CRL** (Certificate Revocation List) y distribuirla a los peers:

```bash
# Generar CRL actualizada
fabric-ca-client gencrl \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

La CRL se coloca en el MSP de la organización (`msp/crls/`) y los peers la consultan para rechazar certificados revocados:

```bash
mkdir -p $PWD/organizations/peerOrganizations/org1.example.com/msp/crls
cp $PWD/fabric-ca/org1/admin/msp/crls/* \
   $PWD/organizations/peerOrganizations/org1.example.com/msp/crls/
```

```mermaid
graph LR
    REV["Admin revoca cert"] --> CRL["Genera nueva CRL"]
    CRL --> MSP["Copia CRL al MSP<br/>de la org"]
    MSP --> PEERS["Peers leen la CRL<br/>y rechazan cert revocado"]

    style REV fill:#EC0000,color:#fff
    style CRL fill:#B45D09,color:#fff
    style PEERS fill:#0D9448,color:#fff
```

> **Importante**: la revocación no es instantánea. Los peers solo la aplican cuando se actualiza la CRL en su MSP **y se les hace recargar el canal** (o se reinician). En producción, automatizar este proceso es crítico.

### Renovar un certificado (reenroll)

Los certificados tienen fecha de caducidad. Antes de que caduquen, el titular puede solicitar uno nuevo:

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/user1

fabric-ca-client reenroll \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

El reenroll genera un nuevo certificado con la misma identidad y atributos, pero con nueva fecha de validez y nueva clave privada. La identidad sigue siendo la misma (mismo `--id.name`), no hace falta repetir el `register`.

---

## Estructura final del MSP (resumen)

Después de todos los pasos, cada componente tiene su MSP con esta forma:

```
msp/
├── cacerts/              # Certificado raíz de la CA de identidad
│   └── ca-cert.pem
├── tlscacerts/           # Certificado raíz de la CA de TLS
│   └── tlsca-cert.pem
├── keystore/             # Clave privada de esta identidad
│   └── priv_sk
├── signcerts/            # Certificado de esta identidad
│   └── cert.pem
├── crls/                 # Certificate Revocation Lists (opcional)
│   └── crl.pem
└── config.yaml           # Configuración NodeOUs
```

---

## Resumen de comandos

| Operación | Comando | Quién lo ejecuta |
|-----------|---------|------------------|
| Levantar las CAs | `docker compose -f docker/docker-compose-ca.yaml up -d` | Admin de la red, una vez |
| Comprobar que una CA está viva | `curl -k https://localhost:7054/cainfo` | Cualquiera |
| Enrollar admin bootstrap | `fabric-ca-client enroll -u https://admin:adminpw@localhost:PORT` | Admin de cada org, una vez por CA |
| Listar identidades de una CA | `fabric-ca-client identity list --caname ca-orgX` | Admin bootstrap |
| Registrar identidad | `fabric-ca-client register --id.name X --id.secret Y --id.type Z` | Admin bootstrap |
| Enrollar identidad (MSP) | `fabric-ca-client enroll -u https://X:Y@host:PORT --csr.hosts ...` | El propio titular |
| Enrollar identidad (TLS) | `fabric-ca-client enroll ... --enrollment.profile tls` | El propio titular |
| Revocar certificado | `fabric-ca-client revoke -e nombre -r razon` | Admin bootstrap |
| Generar CRL | `fabric-ca-client gencrl --caname ca-orgX` | Admin bootstrap |
| Renovar certificado | `fabric-ca-client reenroll` | El propio titular |
| Inspeccionar un cert X.509 | `openssl x509 -in cert.pem -text -noout` | Cualquiera |

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `Authorization failure` | El admin no está enrollado, o el token de la sesión expiró | Re-enrollar al admin bootstrap |
| `Identity 'X' is already registered` | Ya existe una identidad con ese nombre | Usa otro nombre o elimina la existente (`fabric-ca-client identity remove X`) |
| `Failed to connect to host` | La CA no está corriendo, o el puerto es incorrecto | `docker ps` y comprueba con `curl -k https://localhost:PORT/cainfo` |
| `certificate signed by unknown authority` | Falta el `--tls.certfiles` o apunta a un fichero erróneo | Usa la ruta correcta a `fabric-ca/orgX/tls-cert.pem` |
| `Certificate has expired` | El cert ya caducó | `reenroll` para obtener uno nuevo |
| `Certificate is revoked` | El cert está en la CRL | Emitir una nueva identidad (no se puede "des-revocar") |
| `x509: certificate is valid for X, not Y` | El cert no tiene SANs para el host | Re-enrolla con `--csr.hosts X,Y,localhost` |
| `cp: cannot stat 'fabric-ca/orgX/peer0/tls/...'` al construir MSPs | No has enrollado la identidad TLS (paso 5.2) | Vuelve al paso 5.2 y ejecuta el enroll con `--enrollment.profile tls` |
| El peer no arranca: `CA Certificate did not have the CA attribute` | Has puesto `tls-cert.pem` (cert HTTPS del server) en `tlscacerts/` por error | Usa el cert de `peer0/tls/msp/tlscacerts/` en su lugar |
| `Failed to enroll: empty body` | Estás conectando por `http://` y la CA exige `https://` | Cambia la URL del `-u` a `https://` |

---

**Anterior:** [04 — Chaincode Lifecycle](04-chaincode-lifecycle.md)
**Siguiente:** [06 — Operaciones de administración](06-operaciones-administracion.md)
