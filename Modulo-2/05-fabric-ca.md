# 05 - Fabric CA: Gestión de identidades en producción

## Por que Fabric CA

En los documentos anteriores usamos `cryptogen` para generar todos los certificados de golpe. Esto funciona para desarrollo, pero tiene limitaciones serias en producción:

- **No puedes añadir nuevos usuarios** sin regenerar todo
- **No puedes revocar** un certificado comprometido
- **No puedes renovar** certificados que caducan
- **No hay registro** de quien solicito que certificado y cuando

Fabric CA es una **autoridad certificadora** real que resuelve todos estos problemas. Funciona como un servicio independiente al que las organizaciones envian peticiones para registrar y enrollar identidades.

```mermaid
graph TB
    subgraph "Con cryptogen (desarrollo)"
        CG["cryptogen"] --> |"Genera todo de golpe"| CERTS1["Todos los certs"]
        CERTS1 -. "No se pueden anadir,<br/>revocar ni renovar" .-> X["Limitado"]
    end

    subgraph "Con Fabric CA (produccion)"
        CA["Fabric CA Server"] --> |"register"| ID["Identidad registrada"]
        ID --> |"enroll"| CERT["Certificado emitido"]
        CA --> |"revoke"| REV["Certificado revocado"]
        CA --> |"reenroll"| REN["Certificado renovado"]
    end

    style CG fill:#B45D09,color:#fff
    style X fill:#EC0000,color:#fff
    style CA fill:#0D9448,color:#fff
    style CERT fill:#0D9448,color:#fff
```

> **Analogia:** `cryptogen` es como imprimir todos los DNIs de un país de golpe el dia de la fundación. Fabric CA es el registro civil: emite DNIs bajo demanda, los renueva cuando caducan y los invalida si se pierden.

---

## Pregunta frecuente: ¿puedo usar Fabric CA sobre una red creada con cryptogen?

**No.** Son incompatibles sobre la misma red. La razón:

- `cryptogen` genera su propia CA raiz (con su clave privada)
- Fabric CA genera una CA raiz diferente (con otra clave privada)
- Los peers solo confian en la CA raiz que tienen en su MSP
- Los certificados emitidos por Fabric CA estarian firmados por una CA que los peers no reconocen

```mermaid
graph TB
    subgraph "Red montada con cryptogen"
        CA_CG["CA raiz A<br/>(generada por cryptogen)"]
        CA_CG --> CERT_CG["Certs firmados por A"]
        CERT_CG --> PEER["Peer confia en A"]
    end

    subgraph "Fabric CA (servidor nuevo)"
        CA_FC["CA raiz B<br/>(generada por Fabric CA)"]
        CA_FC --> CERT_FC["Certs firmados por B"]
        CERT_FC -. "RECHAZADO:<br/>B no esta en el MSP" .-> PEER
    end

    style CA_CG fill:#0D9448,color:#fff
    style CA_FC fill:#EC0000,color:#fff
```

Para usar Fabric CA hay que **montar la red desde cero** con Fabric CA desde el principio. Los ejemplos de este documento son exactamente eso: un tutorial completo para montar una red con Fabric CA.

> **Nota para alumnos curiosos:** Tecnicamente podrias usar `openssl` para generar certificados sueltos firmados por la CA raiz de `cryptogen` (la clave privada esta en `crypto-config/.../ca/`). Funcionaria, pero tendrias que gestionar manualmente los atributos NodeOU, la estructura MSP, las extensiones X.509 y la revocación. Fabric CA hace todo eso por ti.

---

## Fabric CA: emisión vs validación

Es importante entender que Fabric CA **solo emite certificados**. No los valida en tiempo real.

```mermaid
sequenceDiagram
    participant CA as Fabric CA
    participant User as Usuario
    participant Peer as Peer

    Note over CA,User: EMISION (una vez)
    User->>CA: enroll (dame mi cert)
    CA-->>User: Certificado firmado por CA

    Note over User,Peer: VALIDACION (cada transaccion)
    User->>Peer: Transaccion + certificado
    Peer->>Peer: ¿El cert esta firmado por<br/>una CA que esta en mi MSP?
    Note over Peer: NO contacta a la CA
    Peer-->>User: OK / Rechazado
```

La validación la hacen los **peers localmente**, verificando la cadena de firmas contra el certificado raiz de la CA que tienen en su MSP. Es como un DNI: el registro civil lo emite, pero cuando lo ensenias en un hotel, el hotel no llama al registro civil — comprueba los sellos de seguridad.

La **única excepción** es la revocación: cuando se revoca un certificado, hay que generar una CRL y distribuirla a los MSPs de los peers. Si no se actualiza la CRL, un certificado revocado seguira siendo aceptado.

---

## Arquitectura de Fabric CA

En una red real, **cada organización tiene su propia Fabric CA**. La CA de Org1 solo emite certificados para miembros de Org1, y la CA de Org2 solo para los suyos.

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
            CA0 --> ORD["orderer<br/>(cert emitido por CA0)"]
        end
    end

    style CA1 fill:#7C3AED,color:#fff
    style CA2 fill:#7C3AED,color:#fff
    style CA0 fill:#7C3AED,color:#fff
```

Fabric CA tiene dos componentes:
- **fabric-ca-server**: el servidor que gestiona las identidades (uno por org)
- **fabric-ca-client**: el CLI que usan los admins para interactuar con el server

---

## Conceptos clave

### Register vs Enroll

Estas son las dos operaciones fundamentales de Fabric CA y es importante no confundirlas:

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

| Operación | Quien la ejecuta | Que hace | Resultado |
|-----------|-----------------|----------|-----------|
| **register** | Admin de la org | Crea una identidad en la CA | La identidad existe pero aun no tiene certificado |
| **enroll** | El propio usuario | Solicita su certificado a la CA | Obtiene cert X.509 + clave privada |

> **Analogia:** Register es como dar de alta a un ciudadano en el padron. Enroll es cuando ese ciudadano va a la oficina a recoger su DNI.

### Atributos y tipos

Al registrar una identidad se puede especificar:
- **Tipo**: `client`, `peer`, `orderer`, `admin`
- **Atributos personalizados**: `role=auditor`, `department=legal`, etc.
- **Afiliacion**: la posición en la jerarquia de la org (`org1.department1`)

Estos atributos quedan embebidos en el certificado X.509 y pueden usarse para control de acceso en los chaincodes (ABAC).

---

## Tutorial: montar una red completa con Fabric CA

Los ejemplos de este documento son un tutorial completo y funcional. Vamos a montar una red con dos organizaciones (Org1 y Org2) donde todas las identidades se generan con Fabric CA.

### Paso 0: Crear la estructura de directorios

```bash
mkdir -p $HOME/red-con-ca/{fabric-ca/org1,fabric-ca/org2,fabric-ca/orderer}
mkdir -p $HOME/red-con-ca/{organizations,channel-artifacts,docker}
cd $HOME/red-con-ca
```

### Paso 1: Levantar las CAs con Docker Compose

Crea el archivo `docker/docker-compose-ca.yaml`:

```yaml
# docker/docker-compose-ca.yaml
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

Levantar las CAs:

```bash
docker compose -f docker/docker-compose-ca.yaml up -d
```

Verificar que las tres CAs estan corriendo:

```bash
curl -k https://localhost:7054/cainfo   # CA Org1
curl -k https://localhost:8054/cainfo   # CA Org2
curl -k https://localhost:9054/cainfo   # CA Orderer
```

### Paso 2: Enrollar al admin bootstrap de Org1

El admin bootstrap es el primer usuario de cada CA. Se creo automáticamente al arrancar el server con `-b admin:adminpw`.

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:7054 \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

Esto genera:
```
fabric-ca/hotel/admin/
├── msp/
│   ├── cacerts/          # Certificado raiz de la CA
│   ├── keystore/         # Clave privada del admin
│   ├── signcerts/        # Certificado del admin
│   └── IssuerPublicKey
└── fabric-ca-client-config.yaml
```

### Paso 3: Registrar las identidades de Org1

Con el admin bootstrap enrollado, ahora registramos el peer, un admin de la org y un usuario:

```bash
# Registrar el peer de Org1
fabric-ca-client register \
  --caname ca-org1 \
  --id.name peer0 \
  --id.secret peer0pw \
  --id.type peer \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# Registrar el admin de Org1
fabric-ca-client register \
  --caname ca-org1 \
  --id.name org1admin \
  --id.secret org1adminpw \
  --id.type admin \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# Registrar un usuario con atributos personalizados
fabric-ca-client register \
  --caname ca-org1 \
  --id.name user1 \
  --id.secret user1pw \
  --id.type client \
  --id.attrs '"role=operator,department=reception"' \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

Los atributos `role=operator` y `department=reception` quedaran embebidos en el certificado de user1 y podran verificarse desde un chaincode con `GetAttributeValue("role")`.

### Paso 4: Enrollar las identidades de Org1

Cada identidad registrada ahora tiene que enrollarse para obtener su certificado:

```bash
# Enrollar el peer
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:7054 \
  --caname ca-org1 \
  --csr.hosts peer0.org1.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# Enrollar el admin
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/org1admin
fabric-ca-client enroll \
  -u https://org1admin:org1adminpw@localhost:7054 \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# Enrollar el usuario (con sus atributos)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/user1
fabric-ca-client enroll \
  -u https://user1:user1pw@localhost:7054 \
  --caname ca-org1 \
  --enrollment.attrs "role,department" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

El flag `--csr.hosts` añade SANs al certificado del peer (equivalente al `SANS` de `crypto-config.yaml`).
El flag `--enrollment.attrs` indica que atributos incluir en el certificado del usuario.

### Paso 5: Repetir para Org2 y OrdererOrg

El proceso es identico pero apuntando a las CAs de Org2 (puerto 8054) y OrdererOrg (puerto 9054):

```bash
# Enrollar admin bootstrap de Org2
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/admin
fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:8054 \
  --caname ca-org2 \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Registrar peer de Org2
fabric-ca-client register --caname ca-org2 \
  --id.name peer0 --id.secret peer0pw --id.type peer \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Enrollar peer de Org2
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org2/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:8054 \
  --caname ca-org2 \
  --csr.hosts peer0.org2.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org2/tls-cert.pem

# Enrollar admin bootstrap del Orderer
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/admin
fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:9054 \
  --caname ca-orderer \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

# Registrar y enrollar el nodo orderer
fabric-ca-client register --caname ca-orderer \
  --id.name orderer --id.secret ordererpw --id.type orderer \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem

export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/orderer/orderer
fabric-ca-client enroll \
  -u https://orderer:ordererpw@localhost:9054 \
  --caname ca-orderer \
  --csr.hosts orderer.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/orderer/tls-cert.pem
```

### Paso 6: Construir la estructura MSP de cada org

Con todos los certificados generados, hay que organizar las carpetas MSP que Fabric espera. Esto implica copiar los certificados en la estructura correcta:

```bash
# Ejemplo para Org1: construir el MSP de la organizacion
mkdir -p organizations/peerOrganizations/org1.example.com/msp/{cacerts,tlscacerts}
cp fabric-ca/org1/tls-cert.pem \
   organizations/peerOrganizations/org1.example.com/msp/cacerts/ca-cert.pem
cp fabric-ca/org1/tls-cert.pem \
   organizations/peerOrganizations/org1.example.com/msp/tlscacerts/tlsca-cert.pem

# Copiar el config.yaml de NodeOUs (ver seccion mas adelante)
# Copiar los certs de cada identidad a su carpeta...
```

> **Nota:** En la práctica, este proceso de construir los MSPs se automatiza con un script.
> El repositorio `fabric-samples/test-network` incluye un script `registerEnroll.sh`
> que hace exactamente esto. Es una buena referencia para entender el proceso completo.

---

## Diagrama del flujo completo (Org1)

```mermaid
sequenceDiagram
    participant CA as CA Org1<br/>:7054
    participant Admin as Admin bootstrap
    participant Peer as peer0.org1
    participant OrgAdmin as org1admin
    participant User as user1

    Admin->>CA: enroll (admin:adminpw)
    CA-->>Admin: Cert admin bootstrap

    Admin->>CA: register peer0 (type=peer)
    Admin->>CA: register org1admin (type=admin)
    Admin->>CA: register user1 (type=client, role=operator)
    CA-->>Admin: OK (x3)

    Peer->>CA: enroll (peer0:peer0pw, hosts=peer0.org1...,localhost)
    CA-->>Peer: Cert peer0 + clave privada

    OrgAdmin->>CA: enroll (org1admin:org1adminpw)
    CA-->>OrgAdmin: Cert admin

    User->>CA: enroll (user1:user1pw, attrs=role,department)
    CA-->>User: Cert user1 (con role=operator, department=reception)

    Note over Admin: Repetir para Org2 (:8054)<br/>y OrdererOrg (:9054)
```

---

## Revocar un certificado

Cuando un certificado se ve comprometido o un empleado deja la organización, hay que revocarlo.

```bash
# Usar el admin bootstrap para revocar
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/admin

# Revocar el certificado de user1
fabric-ca-client revoke \
  --caname ca-org1 \
  -e user1 \
  -r "affiliationchange" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

Después de revocar, hay que **generar una nueva CRL** (Certificate Revocation List) y distribuirla a los peers:

```bash
# Generar CRL actualizada
fabric-ca-client gencrl \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

La CRL se coloca en el MSP de la organización (`msp/crls/`) y los peers la consultan para rechazar certificados revocados.

```mermaid
graph LR
    REV["Admin revoca cert"] --> CRL["Genera nueva CRL"]
    CRL --> MSP["Actualiza MSP<br/>de la org"]
    MSP --> PEERS["Peers rechazan<br/>cert revocado"]

    style REV fill:#EC0000,color:#fff
    style CRL fill:#B45D09,color:#fff
    style PEERS fill:#0D9448,color:#fff
```

> **Importante:** La revocación no es instantanea. Los peers solo la aplican cuando se actualiza la CRL en su MSP. En producción, automatizar este proceso es crítico.

---

## Renovar un certificado (reenroll)

Los certificados tienen fecha de caducidad. Antes de que caduquen, el titular puede solicitar uno nuevo:

```bash
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/user1

fabric-ca-client reenroll \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem
```

El reenroll genera un nuevo certificado con la misma identidad y atributos, pero con nueva fecha de validez y nueva clave privada.

---

## Estructura del MSP con Fabric CA

Cuando usas Fabric CA, la estructura del MSP es la misma que con cryptogen, pero la gestionas tu:

```
msp/
├── cacerts/              # Certificado raiz de la CA de la org
│   └── ca-cert.pem
├── keystore/             # Clave privada de esta identidad
│   └── priv_sk
├── signcerts/            # Certificado de esta identidad
│   └── cert.pem
├── tlscacerts/           # Certificado raiz de la TLS CA
│   └── tlsca-cert.pem
├── crls/                 # Certificate Revocation Lists (opcional)
│   └── crl.pem
└── config.yaml           # Configuracion NodeOUs
```

El archivo `config.yaml` habilita NodeOUs para distinguir tipos de identidad:

```yaml
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: orderer
```

---

## cryptogen vs Fabric CA: cuando usar cada uno

| Aspecto | cryptogen | Fabric CA |
|---------|-----------|-----------|
| Uso | Desarrollo y testing | Producción |
| Generación | Todo de golpe | Bajo demanda |
| Añadir usuarios | Regenerar todo | `register` + `enroll` |
| Revocar | No es posible | `revoke` + `gencrl` |
| Renovar | No es posible | `reenroll` |
| Atributos custom | No | Si (`--id.attrs`) |
| Complejidad | Mínima | Mayor (server + client) |
| Auditoría | No hay registro | Log completo de operaciones |

> **Regla práctica:** Usa `cryptogen` para aprender y prototipar. Usa Fabric CA para cualquier cosa que se parezca a producción.

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `Authorization failure` | El admin no esta enrollado o el token expiro | Re-enrollar al admin |
| `Identity already registered` | Ya existe un registro con ese nombre | Usar otro nombre o eliminar el existente |
| `Failed to connect to CA` | CA no esta corriendo o puerto incorrecto | Verificar con `docker ps` y `curl -k https://localhost:7054/cainfo` |
| `Certificate has expired` | El cert caduco | `reenroll` para obtener uno nuevo |
| `Certificate is revoked` | El cert esta en la CRL | Emitir una nueva identidad |

---

**Anterior:** [04 - Chaincode Lifecycle](04-chaincode-lifecycle.md)
**Siguiente:** [06 - Operaciones de administracion](06-operaciones-administracion.md)
