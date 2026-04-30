# Solución 02: Material criptográfico con Fabric CA

> **Recordatorio:** este documento asume que ya has leído [solucion-01-arquitectura.md](solucion-01-arquitectura.md) y que entiendes el modelo de 3 organizaciones (Cliente, Proveedor, OrdererOrg).

## Por qué Fabric CA y no cryptogen

`cryptogen` genera todos los certificados de golpe a partir de un YAML. Es rápido para aulas, pero:
- No permite añadir nuevos usuarios sin regenerar todo
- No permite revocar ni renovar certificados
- No registra quién emitió qué certificado

En esta práctica usamos **Fabric CA** porque queremos un escenario realista donde cada organización opera **su propia autoridad certificadora** y emite identidades bajo demanda.

```mermaid
graph TB
    subgraph "Material criptográfico (3 CAs separadas)"
        CC["Fabric CA Cliente<br/>:7054"]
        CP["Fabric CA Proveedor<br/>:8054"]
        CO["Fabric CA Orderer<br/>:9054"]
    end

    CC -->|"emite"| CCERTS["• Cert raíz Cliente<br/>• peer0.cliente<br/>• Admin@cliente"]
    CP -->|"emite"| PCERTS["• Cert raíz Proveedor<br/>• peer0.proveedor<br/>• Admin@proveedor"]
    CO -->|"emite"| OCERTS["• Cert raíz Orderer<br/>• orderer.signchain<br/>• Admin@orderer"]

    style CC fill:#7C3AED,color:#fff
    style CP fill:#7C3AED,color:#fff
    style CO fill:#7C3AED,color:#fff
    style CCERTS fill:#22627E,color:#fff
    style PCERTS fill:#0D9448,color:#fff
    style OCERTS fill:#B45D09,color:#fff
```

---

## Paso 1: Crear estructura de directorios

```bash
mkdir -p $HOME/signchain/{network,chaincode,application,scripts}
mkdir -p $HOME/signchain/network/{fabric-ca/cliente,fabric-ca/proveedor,fabric-ca/orderer}
mkdir -p $HOME/signchain/network/{organizations,channel-artifacts,docker}
cd $HOME/signchain
```

---

## Paso 2: Docker Compose para las 3 CAs

Crea el archivo `network/docker/docker-compose-ca.yaml`:

```yaml
# network/docker/docker-compose-ca.yaml
version: '3.7'

networks:
  signchain-net:
    name: signchain-net

services:
  ca.cliente.signchain.com:
    container_name: ca.cliente.signchain.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-cliente
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=7054
    ports:
      - 7054:7054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/cliente:/etc/hyperledger/fabric-ca-server
    networks:
      - signchain-net

  ca.proveedor.signchain.com:
    container_name: ca.proveedor.signchain.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-proveedor
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=8054
    ports:
      - 8054:8054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/proveedor:/etc/hyperledger/fabric-ca-server
    networks:
      - signchain-net

  ca.orderer.signchain.com:
    container_name: ca.orderer.signchain.com
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
      - signchain-net
```

> **Nota sobre TLS**: las CAs arrancan con TLS habilitado (`FABRIC_CA_SERVER_TLS_ENABLED=true`). En el primer arranque cada CA genera su propio certificado TLS auto-firmado en `tls-cert.pem`. Lo necesitamos como `--tls.certfiles` al hacer los enroll/register.

Levanta las 3 CAs:

```bash
cd $HOME/signchain
docker compose -f network/docker/docker-compose-ca.yaml up -d
```

Verifica que están corriendo:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ca.
```

Comprueba que responden:

```bash
curl -k https://localhost:7054/cainfo  # CA Cliente
curl -k https://localhost:8054/cainfo  # CA Proveedor
curl -k https://localhost:9054/cainfo  # CA Orderer
```

---

## Paso 3: Enrollar el admin bootstrap de cada CA

Cada CA arrancó con un usuario bootstrap (`admin:adminpw`). Tenemos que enrollarlo para poder operar la CA.

```mermaid
sequenceDiagram
    participant Admin as Admin local
    participant CA as Fabric CA

    Admin->>CA: enroll (admin:adminpw, --caname ca-cliente)
    CA-->>Admin: Cert + clave del admin bootstrap
    Note over Admin: Ya puede registrar nuevas identidades
```

### Enrollar admin bootstrap de Cliente

```bash
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/cliente/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:7054 \
  --caname ca-cliente \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem
```

Esto crea la carpeta `fabric-ca/cliente/admin/msp/` con el cert del admin bootstrap.

### Enrollar admin bootstrap de Proveedor

```bash
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/proveedor/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:8054 \
  --caname ca-proveedor \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem
```

### Enrollar admin bootstrap de OrdererOrg

```bash
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/orderer/admin

fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:9054 \
  --caname ca-orderer \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem
```

---

## Paso 4: Registrar y enrollar identidades de Cliente

Para Cliente necesitamos:
- Un peer (`peer0`)
- Un admin de la org (`clienteadmin`)

```bash
# Volver al admin bootstrap de Cliente
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/cliente/admin

# Registrar el peer
fabric-ca-client register \
  --caname ca-cliente \
  --id.name peer0 --id.secret peer0pw --id.type peer \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem

# Registrar el admin de la org
fabric-ca-client register \
  --caname ca-cliente \
  --id.name clienteadmin --id.secret clienteadminpw --id.type admin \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem
```

Ahora enrollamos cada uno (genera sus certificados):

```bash
# Enrollar peer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/cliente/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:7054 \
  --caname ca-cliente \
  --csr.hosts peer0.cliente.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem

# Enrollar TLS del peer (cert separado para TLS)
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/cliente/peer0/tls
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:7054 \
  --caname ca-cliente \
  --enrollment.profile tls \
  --csr.hosts peer0.cliente.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem

# Enrollar admin
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/cliente/clienteadmin
fabric-ca-client enroll \
  -u https://clienteadmin:clienteadminpw@localhost:7054 \
  --caname ca-cliente \
  --tls.certfiles $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem
```

> **Importante:** el peer necesita **dos identidades**: una para identidad de Fabric (firmar transacciones) y otra para TLS (cifrar comunicaciones gRPC). Usamos la misma CA pero con `--enrollment.profile tls` para la TLS.

---

## Paso 5: Repetir para Proveedor

```bash
# Admin bootstrap de Proveedor
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/proveedor/admin

# Registrar peer y admin
fabric-ca-client register --caname ca-proveedor \
  --id.name peer0 --id.secret peer0pw --id.type peer \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem

fabric-ca-client register --caname ca-proveedor \
  --id.name proveedoradmin --id.secret proveedoradminpw --id.type admin \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem

# Enrollar peer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/proveedor/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:8054 \
  --caname ca-proveedor \
  --csr.hosts peer0.proveedor.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem

# Enrollar TLS del peer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/proveedor/peer0/tls
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:8054 \
  --caname ca-proveedor \
  --enrollment.profile tls \
  --csr.hosts peer0.proveedor.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem

# Enrollar admin
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/proveedor/proveedoradmin
fabric-ca-client enroll \
  -u https://proveedoradmin:proveedoradminpw@localhost:8054 \
  --caname ca-proveedor \
  --tls.certfiles $HOME/signchain/network/fabric-ca/proveedor/tls-cert.pem
```

---

## Paso 6: Repetir para OrdererOrg

```bash
# Admin bootstrap del Orderer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/orderer/admin

# Registrar orderer y admin
fabric-ca-client register --caname ca-orderer \
  --id.name orderer --id.secret ordererpw --id.type orderer \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem

fabric-ca-client register --caname ca-orderer \
  --id.name ordereradmin --id.secret ordereradminpw --id.type admin \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem

# Enrollar orderer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/orderer/orderer
fabric-ca-client enroll \
  -u https://orderer:ordererpw@localhost:9054 \
  --caname ca-orderer \
  --csr.hosts orderer.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem

# Enrollar TLS del orderer
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/orderer/orderer/tls
fabric-ca-client enroll \
  -u https://orderer:ordererpw@localhost:9054 \
  --caname ca-orderer \
  --enrollment.profile tls \
  --csr.hosts orderer.signchain.com,localhost \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem

# Enrollar admin
export FABRIC_CA_CLIENT_HOME=$HOME/signchain/network/fabric-ca/orderer/ordereradmin
fabric-ca-client enroll \
  -u https://ordereradmin:ordereradminpw@localhost:9054 \
  --caname ca-orderer \
  --tls.certfiles $HOME/signchain/network/fabric-ca/orderer/tls-cert.pem
```

---

## Paso 7: Construir la estructura MSP

Ahora hay que organizar todos esos certificados en la estructura que Fabric espera (`organizations/`).

### MSP de la organización Cliente (channel MSP)

```bash
ORG_DIR=$HOME/signchain/network/organizations/peerOrganizations/cliente.signchain.com
mkdir -p $ORG_DIR/{msp/cacerts,msp/tlscacerts,msp/admincerts,msp/users,peers,users/Admin@cliente.signchain.com/msp}

# Cert raíz de la CA (identidad)
cp $HOME/signchain/network/fabric-ca/cliente/admin/msp/cacerts/* \
   $ORG_DIR/msp/cacerts/

# Cert raíz TLS
cp $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem \
   $ORG_DIR/msp/tlscacerts/

# config.yaml con NodeOUs
cat > $ORG_DIR/msp/config.yaml << EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$(ls $ORG_DIR/msp/cacerts/)
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$(ls $ORG_DIR/msp/cacerts/)
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$(ls $ORG_DIR/msp/cacerts/)
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$(ls $ORG_DIR/msp/cacerts/)
    OrganizationalUnitIdentifier: orderer
EOF
```

### MSP local del peer Cliente

```bash
PEER_DIR=$ORG_DIR/peers/peer0.cliente.signchain.com
mkdir -p $PEER_DIR/{msp/cacerts,msp/tlscacerts,msp/keystore,msp/signcerts,tls}

# Identidad del peer
cp $HOME/signchain/network/fabric-ca/cliente/peer0/msp/cacerts/* $PEER_DIR/msp/cacerts/
cp $HOME/signchain/network/fabric-ca/cliente/peer0/msp/keystore/* $PEER_DIR/msp/keystore/
cp $HOME/signchain/network/fabric-ca/cliente/peer0/msp/signcerts/* $PEER_DIR/msp/signcerts/
cp $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem $PEER_DIR/msp/tlscacerts/
cp $ORG_DIR/msp/config.yaml $PEER_DIR/msp/config.yaml

# TLS del peer
cp $HOME/signchain/network/fabric-ca/cliente/peer0/tls/tlscacerts/* $PEER_DIR/tls/ca.crt
cp $HOME/signchain/network/fabric-ca/cliente/peer0/tls/keystore/* $PEER_DIR/tls/server.key
cp $HOME/signchain/network/fabric-ca/cliente/peer0/tls/signcerts/* $PEER_DIR/tls/server.crt
```

### MSP local del admin de Cliente

```bash
ADMIN_DIR=$ORG_DIR/users/Admin@cliente.signchain.com/msp
mkdir -p $ADMIN_DIR/{cacerts,tlscacerts,keystore,signcerts}

cp $HOME/signchain/network/fabric-ca/cliente/clienteadmin/msp/cacerts/* $ADMIN_DIR/cacerts/
cp $HOME/signchain/network/fabric-ca/cliente/clienteadmin/msp/keystore/* $ADMIN_DIR/keystore/
cp $HOME/signchain/network/fabric-ca/cliente/clienteadmin/msp/signcerts/* $ADMIN_DIR/signcerts/
cp $HOME/signchain/network/fabric-ca/cliente/tls-cert.pem $ADMIN_DIR/tlscacerts/
cp $ORG_DIR/msp/config.yaml $ADMIN_DIR/config.yaml
```

> **Nota:** la sección de admin necesita ese `config.yaml` para que Fabric pueda determinar el rol admin a partir del cert.

---

## Paso 8: Repetir para Proveedor y OrdererOrg

El proceso es idéntico, cambiando paths. Por brevedad, en este documento lo dejamos en un script `02-build-msps.sh` que automatiza todo. Ese script lo encuentras en el repositorio de la práctica:

```bash
$HOME/signchain/scripts/02-build-msps.sh
```

Estructura final esperada:

```
organizations/
├── peerOrganizations/
│   ├── cliente.signchain.com/
│   │   ├── msp/                    # MSP de la org (channel MSP)
│   │   ├── peers/peer0.cliente.../
│   │   │   ├── msp/                # MSP local del peer
│   │   │   └── tls/                # TLS del peer
│   │   └── users/Admin@.../msp/    # MSP local del admin
│   └── proveedor.signchain.com/
│       └── (misma estructura)
└── ordererOrganizations/
    └── signchain.com/
        ├── msp/                    # MSP del orderer org
        ├── orderers/orderer.signchain.../
        │   ├── msp/
        │   └── tls/
        └── users/Admin@.../msp/
```

---

## Verificación

Comprueba que los certificados son válidos:

```bash
# Inspeccionar un cert del peer
openssl x509 -in $HOME/signchain/network/organizations/peerOrganizations/cliente.signchain.com/peers/peer0.cliente.signchain.com/msp/signcerts/cert.pem -text -noout | head -20

# Comprobar que tiene el OU "peer"
openssl x509 -in $HOME/signchain/network/organizations/peerOrganizations/cliente.signchain.com/peers/peer0.cliente.signchain.com/msp/signcerts/cert.pem -text -noout | grep "OU"
```

Deberías ver algo como:

```
Subject: ... OU=peer ...
```

Eso confirma que el cert lleva el rol `peer` en el campo OU, que es lo que NodeOUs usa para identificar el tipo de identidad.

---

## Lo que tienes ahora

```mermaid
graph LR
    subgraph "fabric-ca/ (datos de las CAs)"
        F1["cliente/<br/>admin, peer0, clienteadmin"]
        F2["proveedor/<br/>admin, peer0, proveedoradmin"]
        F3["orderer/<br/>admin, orderer, ordereradmin"]
    end

    subgraph "organizations/ (MSPs construidos)"
        O1["peerOrganizations/cliente.signchain.com/"]
        O2["peerOrganizations/proveedor.signchain.com/"]
        O3["ordererOrganizations/signchain.com/"]
    end

    F1 -->|"copy & organize"| O1
    F2 -->|"copy & organize"| O2
    F3 -->|"copy & organize"| O3

    style F1 fill:#7C3AED,color:#fff
    style F2 fill:#7C3AED,color:#fff
    style F3 fill:#7C3AED,color:#fff
    style O1 fill:#22627E,color:#fff
    style O2 fill:#0D9448,color:#fff
    style O3 fill:#B45D09,color:#fff
```

Ya tienes:
- **3 Fabric CAs** corriendo y emitiendo certificados
- **3 MSPs construidos** listos para usar en el `configtx.yaml` y los peers/orderer
- **Certificados separados** para identidad y TLS

---

**Siguiente:** [solucion-03-red-y-canal.md](solucion-03-red-y-canal.md)
