# 06 — Operaciones de administración

## Visión general

Este documento parte de la red montada con Fabric CA en el [doc 05](05-fabric-ca.md). Completamos la red con peers y orderer, desplegamos un chaincode y practicamos las operaciones de administración más comunes.

```mermaid
graph TB
    subgraph "Lo que vamos a hacer"
        A["0. Completar la red<br/>(peers + orderer + canal)"]
        B["1. Desplegar un<br/>chaincode"]
        C["2. Añadir organización<br/>al canal"]
        D["3. Actualizar config<br/>del canal"]
        E["4. Monitorización<br/>y logs"]
        F["5. Backup y<br/>recuperación"]
        G["6. Rotación de<br/>certificados"]
    end

    A --> B --> C
    A --> D
    A --> E
    A --> F
    A --> G

    style A fill:#EC0000,color:#fff
    style B fill:#22627E,color:#fff
    style C fill:#22627E,color:#fff
    style D fill:#0D9448,color:#fff
    style E fill:#0D9448,color:#fff
    style F fill:#B45D09,color:#fff
    style G fill:#7C3AED,color:#fff
```

---

## Prerequisitos

Debes haber completado el [doc 05](05-fabric-ca.md) hasta el paso 7 (todas las identidades generadas con Fabric CA y los MSPs construidos). Deberías tener:

```
$HOME/red-con-ca/
├── fabric-ca/
│   ├── org1/        # CA de Org1 + identidades enrolladas
│   ├── org2/        # CA de Org2 + identidades enrolladas
│   └── orderer/     # CA del Orderer + identidades enrolladas
├── organizations/   # MSPs construidos
├── channel-artifacts/
└── docker/
    └── docker-compose-ca.yaml   # Las 3 CAs (ya corriendo)
```

---

## 0. Completar la red: peers, orderer y canal

El doc 05 montó las CAs y generó las identidades. Ahora levantamos los peers y el orderer que usan esos certificados, y creamos el canal donde operarán.

### 0.0 Empezar limpio: parar y resetear lo que haya

A estas alturas del curso, unos alumnos ya han tocado los yaml, arrancado contenedores y creado el canal; otros vienen totalmente limpios. Para que **todos** partamos del mismo punto, ejecuta esta secuencia ANTES de seguir.

**Lo que vamos a borrar:** contenedores de peers/orderer/CouchDBs, sus volúmenes (donde viven los bloques y el world state), imágenes de chaincode generadas y artefactos del canal.

**Lo que NO se toca:**
- Las 3 CAs del doc 05 (siguen corriendo).
- La red Docker `fabric-ca-net` (la usan las CAs).
- Las carpetas `fabric-ca/` y `organizations/` (identidades enroladas y MSPs).
- Los ficheros yaml de configuración (`docker-compose-ca.yaml`, `docker-compose-net.yaml`, `configtx.yaml`).

Si necesitas rehacer alguna de esas cosas, lo digo al final del paso.

#### Paso 1 — Parar y eliminar los contenedores de peers, orderer y CouchDBs

```bash
cd $HOME/red-con-ca

# Bajar SOLO la red (peers, orderer, CouchDBs). -v borra sus volúmenes.
# Las CAs siguen vivas — NO se tocan.
docker compose -f docker/docker-compose-net.yaml down -v 2>/dev/null || true

# Por si quedó algo huérfano de prácticas anteriores
docker rm -f $(docker ps -aq --filter "name=peer0\\.")   2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=orderer\\.") 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=couchdb")    2>/dev/null || true
```

El flag `-v` de `docker compose down` borra los **volúmenes** asociados — ahí viven el ledger del peer (los bloques) y el world state. Sin eso, al volver a levantar la red el peer reutilizaría datos antiguos.

#### Paso 2 — Eliminar imágenes de chaincode generadas

Cada vez que se instala un chaincode, Fabric construye una imagen Docker `dev-peer0...-basic_*` que persiste aunque pares el peer. Si no se borra, una nueva instalación con el mismo Package ID podría arrancar el chaincode viejo.

```bash
docker rmi -f $(docker images -q --filter "reference=dev-peer0*") 2>/dev/null || true
```

#### Paso 3 — Borrar artefactos del canal y empaquetados locales

```bash
rm -f $HOME/red-con-ca/channel-artifacts/*.block 2>/dev/null
rm -f $HOME/red-con-ca/channel-artifacts/*.pb    2>/dev/null
rm -f $HOME/red-con-ca/channel-artifacts/*.json  2>/dev/null
rm -f $HOME/red-con-ca/basic*.tar.gz             2>/dev/null
```

#### Paso 4 — Verificar el estado

Deben cumplirse las dos cosas: **peers/orderer/CouchDBs limpios** y **CAs + red vivas**.

```bash
# 1. No debe quedar ningún contenedor de peer, orderer o couchdb
docker ps -a --format "{{.Names}}" | \
  grep -E "peer0\\.|orderer\\.|couchdb" \
  || echo "✓ Contenedores de red: limpio"

# 2. No debe quedar ningún volumen de peer, orderer o couchdb
docker volume ls --format "{{.Name}}" | \
  grep -E "peer0|orderer|couchdb" \
  || echo "✓ Volúmenes de red: limpio"

# 3. Las 3 CAs deben SEGUIR corriendo
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "^ca\\."
# Esperado: ca.org1.example.com, ca.org2.example.com, ca.orderer.example.com (Up)

# 4. La red Docker fabric-ca-net debe SEGUIR existiendo
docker network ls --format "{{.Name}}" | grep -E "^fabric-ca-net$"
# Esperado: fabric-ca-net
```

Si los puntos 1 y 2 dicen `✓ ... limpio` y los 3 y 4 listan las CAs + la red, ya puedes continuar al 0.1.

> **¿Las CAs no están corriendo?** Si en el punto 3 no salen las CAs, levántalas antes de seguir:
>
> ```bash
> cd $HOME/red-con-ca
> docker compose -f docker/docker-compose-ca.yaml up -d
> ```
>
> Esto **no toca** las identidades en `fabric-ca/` (son bind mounts, no volúmenes Docker): solo arranca los procesos.

> **¿Y los yaml que toqué a mano?** Si has modificado `docker-compose-net.yaml` o `configtx.yaml` de formas que no sabes deshacer, **bórralos** y créalos de nuevo con los YAML literales de este documento (0.1 para `docker-compose-net.yaml`, 0.3.1 para `configtx.yaml`):
>
> ```bash
> rm -f $HOME/red-con-ca/docker/docker-compose-net.yaml
> rm -f $HOME/red-con-ca/configtx.yaml
> ```
>
> **No borres `docker-compose-ca.yaml`** — las CAs lo están usando ahora mismo. Si crees que está dañado, primero baja las CAs (`docker compose -f docker/docker-compose-ca.yaml down`, **sin `-v`** para no perder identidades), corrige el yaml, y vuelve a levantarlas.

> **¿Quieres rehacer también el doc 05 (CAs e identidades)?** Solo hazlo si las identidades quedaron corruptas o quieres practicar el doc 05 entero otra vez. Para ello primero baja las CAs con `-v` y luego borra las carpetas:
>
> ```bash
> cd $HOME/red-con-ca
> docker compose -f docker/docker-compose-ca.yaml down -v
> docker network rm fabric-ca-net
> rm -rf fabric-ca organizations
> ```
>
> Tendrás que rehacer el doc 05 completo antes de continuar aquí. **Lo habitual es NO borrar nada de esto** y reutilizar lo que el doc 05 generó.

### 0.1 Docker Compose para la red

Crea el archivo `docker/docker-compose-net.yaml`:

```yaml
# docker/docker-compose-net.yaml
version: '3.7'

volumes:
  orderer.example.com:
  peer0.org1.example.com:
  peer0.org2.example.com:

networks:
  fabric-ca-net:
    external: true
    name: fabric-ca-net

services:
  orderer.example.com:
    container_name: orderer.example.com
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
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer.example.com:9443
    command: orderer
    volumes:
      - ../organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp
      - ../organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls:/var/hyperledger/orderer/tls
      - orderer.example.com:/var/hyperledger/production/orderer
    ports:
      - 7050:7050
      - 7053:7053
      - 9443:9443
    networks:
      - fabric-ca-net

  couchdb.org1:
    container_name: couchdb.org1
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 5984:5984
    networks:
      - fabric-ca-net

  peer0.org1.example.com:
    container_name: peer0.org1.example.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org1.example.com
      - CORE_PEER_ADDRESS=peer0.org1.example.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org1.example.com:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-ca-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.org1:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.org1.example.com:9444
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls:/etc/hyperledger/fabric/tls
      - peer0.org1.example.com:/var/hyperledger/production
    ports:
      - 7051:7051
      - 9444:9444
    depends_on:
      - couchdb.org1
    networks:
      - fabric-ca-net

  couchdb.org2:
    container_name: couchdb.org2
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 7984:5984
    networks:
      - fabric-ca-net

  peer0.org2.example.com:
    container_name: peer0.org2.example.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org2.example.com
      - CORE_PEER_ADDRESS=peer0.org2.example.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org2.example.com:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.example.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.example.com:9051
      - CORE_PEER_LOCALMSPID=Org2MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-ca-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.org2:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.org2.example.com:9445
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls:/etc/hyperledger/fabric/tls
      - peer0.org2.example.com:/var/hyperledger/production
    ports:
      - 9051:9051
      - 9445:9445
    depends_on:
      - couchdb.org2
    networks:
      - fabric-ca-net
```

### 0.2 Levantar la red

```bash
cd $HOME/red-con-ca
docker compose -f docker/docker-compose-net.yaml up -d
```

Verificar (deberías ver 8 contenedores: 3 CAs + orderer + 2 peers + 2 CouchDB):

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 0.3 Crear canal y unir peers

Esta sub-sección está dividida en 5 pasos. Síguelos en orden desde `$HOME/red-con-ca/`.

#### 0.3.1 Crear `configtx.yaml`

El doc 05 no genera este archivo. Lo crearemos ahora, ya adaptado a la estructura `organizations/` que produjo el paso 7 del doc 05 (NO a `crypto-config/` que usa el doc 03).

Crea el archivo `$HOME/red-con-ca/configtx.yaml` con el siguiente contenido **tal cual** (no hace falta adaptar nada):

```yaml
# configtx.yaml
---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: organizations/ordererOrganizations/example.com/msp
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
      - orderer.example.com:7050

  - &Org1
    Name: Org1MSP
    ID: Org1MSP
    MSPDir: organizations/peerOrganizations/org1.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.peer', 'Org1MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org1MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org1MSP.peer')"
    AnchorPeers:
      - Host: peer0.org1.example.com
        Port: 7051

  - &Org2
    Name: Org2MSP
    ID: Org2MSP
    MSPDir: organizations/peerOrganizations/org2.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.peer', 'Org2MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org2MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org2MSP.peer')"
    AnchorPeers:
      - Host: peer0.org2.example.com
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
      - Host: orderer.example.com
        Port: 7050
        ClientTLSCert: organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
        ServerTLSCert: organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
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
  TwoOrgsChannel:
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
        - *Org1
        - *Org2
      Capabilities: *ApplicationCapabilities
```

> **Errores comunes con este archivo:**
> - `could not load MSP configuration: open .../msp/cacerts: no such file or directory` → las rutas `MSPDir` no apuntan a una estructura `organizations/` válida. Verifica que el paso 7 del doc 05 se completó.
> - `Error reading configuration: while parsing config: yaml ...` → indentación rota. Es YAML; respeta los espacios.

#### 0.3.2 Generar el bloque génesis del canal

Para `configtxgen` el `FABRIC_CFG_PATH` debe ser el directorio donde está `configtx.yaml` (es decir, `$PWD`):

```bash
cd $HOME/red-con-ca
mkdir -p channel-artifacts

export FABRIC_CFG_PATH=$PWD

configtxgen -profile TwoOrgsChannel \
  -outputBlock channel-artifacts/mychannel.block \
  -channelID mychannel
```

Comprueba que se generó el bloque:

```bash
ls -la channel-artifacts/mychannel.block
```

#### 0.3.3 Unir el orderer al canal

```bash
# Rutas TLS del orderer (las usa osnadmin)
export ORDERER_CA=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt
export ORDERER_ADMIN_TLS_CERT=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
export ORDERER_ADMIN_TLS_KEY=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key

osnadmin channel join \
  --channelID mychannel \
  --config-block channel-artifacts/mychannel.block \
  -o localhost:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT \
  --client-key $ORDERER_ADMIN_TLS_KEY
```

#### 0.3.4 Unir el peer de Org1

A partir de aquí los comandos `peer` necesitan que `FABRIC_CFG_PATH` apunte al `core.yaml` de fabric-samples (no a tu `configtx.yaml`). Es un cambio intencionado:

```bash
# core.yaml por defecto para el cliente peer
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config

# Identidad y endpoint de Org1
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=$HOME/red-con-ca/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$HOME/red-con-ca/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

cd $HOME/red-con-ca
peer channel join -b channel-artifacts/mychannel.block
```

#### 0.3.5 Unir el peer de Org2

Cambiamos las variables del peer (no hace falta tocar `FABRIC_CFG_PATH`):

```bash
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ROOTCERT_FILE=$HOME/red-con-ca/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$HOME/red-con-ca/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel join -b channel-artifacts/mychannel.block
```

### 0.4 Verificar que la red está bien arrancada

Antes de seguir, comprueba estas tres cosas:

```bash
# 1. El orderer está en el canal
osnadmin channel list \
  -o localhost:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT \
  --client-key $ORDERER_ADMIN_TLS_KEY
# Esperado: ve "mychannel" en la lista con status "active"

# 2. El peer ve el canal (ejecuta esto con las env vars de la org que sea)
peer channel list
# Esperado: ve "mychannel" en "Channels peers has joined"

# 3. Altura de la cadena (bloque génesis = 1)
peer channel getinfo -c mychannel
# Esperado: height: 1, hash y previous_block_hash poblados
```

Si las tres salen sin error, la red está operativa y lista para el resto del documento.

---

## 1. Desplegar un chaincode

> **¿Qué es?** Es el proceso por el que se pública un nuevo smart contract (chaincode) en un canal de Fabric. Sigue un lifecycle de 4 pasos: empaquetar el código, instalarlo en cada peer, aprobar la definición desde cada org y, finalmente, hacer commit en el canal.
>
> **¿Para qué sirve?** Para que la red empiece a procesar transacciones sobre una nueva lógica de negocio. Sin chaincode desplegado el canal está vacío — los peers no tienen reglas que aplicar.
>
> **¿Cuándo hacerlo?** Al lanzar la red (primer chaincode), al añadir nuevas funcionalidades a la red (chaincodes adicionales en el mismo canal) o al sustituir un chaincode antiguo por una versión incompatible (incrementando el sequence). Cada despliegue requiere consenso: la mayoría de orgs (según política `MAJORITY Endorsement`) deben aprobar antes del commit.

Desplegamos el `asset-transfer-basic` de fabric-samples para tener algo con lo que trabajar.

```mermaid
graph LR
    P["Package"] --> I["Install"] --> A["Approve"] --> C["Commit"] --> T["Test"]
    style P fill:#7C3AED,color:#fff
    style I fill:#22627E,color:#fff
    style A fill:#B45D09,color:#fff
    style C fill:#0D9448,color:#fff
    style T fill:#EC0000,color:#fff
```

### 1.1 Preparar y empaquetar

```bash
cd $HOME/red-con-ca

# Preparar dependencias del chaincode
cd $HOME/fabric/fabric-samples/asset-transfer-basic/chaincode-go
GO111MODULE=on go mod vendor
cd $HOME/red-con-ca

# Empaquetar
peer lifecycle chaincode package basic.tar.gz \
  --path $HOME/fabric/fabric-samples/asset-transfer-basic/chaincode-go/ \
  --lang golang \
  --label basic_1.0
```

### 1.2 Instalar en ambos peers

```bash
# Variables comunes para el orderer
export ORDERER_CA=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt
export PEER_ORG1_TLS=$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export PEER_ORG2_TLS=$PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

# Instalar en peer Org1
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG1_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

peer lifecycle chaincode install basic.tar.gz

# Instalar en peer Org2
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG2_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp

peer lifecycle chaincode install basic.tar.gz
```

### 1.3 Obtener Package ID

```bash
peer lifecycle chaincode queryinstalled
export CC_PACKAGE_ID=basic_1.0:XXXX...
```

### 1.4 Aprobar como ambas orgs

```bash
# Aprobar como Org2 (ya estamos como Org2)
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  --channelID mychannel --name basic --version 1.0 \
  --package-id $CC_PACKAGE_ID --sequence 1

# Aprobar como Org1
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG1_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  --channelID mychannel --name basic --version 1.0 \
  --package-id $CC_PACKAGE_ID --sequence 1
```

### 1.5 Verificar y commit

```bash
# Verificar aprobaciones
peer lifecycle chaincode checkcommitreadiness \
  --channelID mychannel --name basic --version 1.0 --sequence 1 --output json

# Commit
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  --channelID mychannel --name basic --version 1.0 --sequence 1 \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_ORG1_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_ORG2_TLS
```

### 1.6 Probar que funciona

```bash
# Inicializar
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_ORG1_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_ORG2_TLS \
  -c '{"function":"InitLedger","Args":[]}'

# Consultar
peer chaincode query -C mychannel -n basic \
  -c '{"Args":["GetAllAssets"]}'
```

Si ves una lista de activos en JSON, la red está operativa y el chaincode funciona. Ya podemos practicar las operaciones de administración.

---

## 2. Añadir una nueva organización al canal

> **¿Qué es?** Es el procedimiento para incorporar una organización nueva a un canal que ya está en funcionamiento. Implica generar el material criptográfico de la nueva org, modificar la configuración del canal para añadir su MSP, conseguir la aprobación de las orgs existentes y, finalmente, que la nueva org una su peer al canal.
>
> **¿Para qué sirve?** Para que el consorcio pueda crecer sin tener que recrear la red desde cero. La nueva org puede leer datos del canal, contribuir a las transacciones y participar en el endorsement según las políticas establecidas.
>
> **¿Cuándo hacerlo?** Cuando un nuevo socio quiere unirse al consorcio (por ejemplo, una tercera empresa que se suma al programa de fidelización) o cuando se crea una organización nueva dentro de un mismo grupo empresarial (filial, división, joint venture). Es una operación que **requiere consenso** entre las orgs existentes — no se puede hacer unilateralmente. Suele coordinarse en una reunión de gobernanza del consorcio.

Esta es una de las operaciones más complejas en Fabric. Un nuevo socio se une al consorcio y necesita participar en un canal existente.

### Flujo general

```mermaid
sequenceDiagram
    participant NewOrg as Nueva Org (Org3)
    participant Admin as Admin existente
    participant Orderer as Orderer
    participant Canal as Canal

    Note over NewOrg: 1. Preparar material criptográfico
    NewOrg->>NewOrg: Generar certs con Fabric CA
    NewOrg->>Admin: Entregar MSP de Org3

    Note over Admin,Orderer: 2. Actualizar config del canal
    Admin->>Orderer: Fetch config actual
    Admin->>Admin: Añadir Org3 al JSON de config
    Admin->>Admin: Calcular delta (config update)
    Admin->>Orderer: Enviar config update firmada

    Note over NewOrg,Canal: 3. Unir peer al canal
    NewOrg->>Orderer: Obtener bloque génesis
    NewOrg->>Canal: peer channel join
```

### Paso a paso

#### 2.1 Levantar la CA de Org3 y generar sus identidades

Primero, añade un servicio nuevo al `docker-compose-ca.yaml` para la CA de Org3 (puerto **10054**):

```yaml
  ca.org3.example.com:
    container_name: ca.org3.example.com
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-org3
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=10054
    ports:
      - 10054:10054
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../fabric-ca/org3:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric-ca-net
```

Levanta solo el contenedor nuevo:

```bash
mkdir -p fabric-ca/org3
docker compose -f docker/docker-compose-ca.yaml up -d ca.org3.example.com
```

Una vez arrancada la CA, repite el ciclo register + enroll del [doc 05](05-fabric-ca.md):

```bash
# Enrollar admin bootstrap de Org3
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org3/admin
fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:10054 \
  --caname ca-org3 \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem

# Registrar y enrollar peer de Org3 (identidad MSP)
fabric-ca-client register --caname ca-org3 \
  --id.name peer0 --id.secret peer0pw --id.type peer \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem

export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org3/peer0
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:10054 \
  --caname ca-org3 \
  --csr.hosts peer0.org3.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem

# Enrollar peer de Org3 (identidad TLS)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org3/peer0/tls
fabric-ca-client enroll \
  -u https://peer0:peer0pw@localhost:10054 \
  --caname ca-org3 \
  --enrollment.profile tls \
  --csr.hosts peer0.org3.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem

# Registrar y enrollar el admin de Org3
fabric-ca-client register --caname ca-org3 \
  --id.name org3admin --id.secret org3adminpw --id.type admin \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem

export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org3/org3admin
fabric-ca-client enroll \
  -u https://org3admin:org3adminpw@localhost:10054 \
  --caname ca-org3 \
  --tls.certfiles $PWD/fabric-ca/org3/tls-cert.pem
```

Construye después el MSP de Org3 con los siguientes comandos (mismo patrón que el paso 7 del doc 05):

```bash
cd $HOME/red-con-ca

ORG3_PEER_DIR=organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com
ORG3_ADMIN_DIR=organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com
ORG3_MSP_DIR=organizations/peerOrganizations/org3.example.com/msp

# Carpetas
mkdir -p $ORG3_MSP_DIR/{cacerts,tlscacerts}
mkdir -p $ORG3_PEER_DIR/{msp/{cacerts,tlscacerts,signcerts,keystore},tls}
mkdir -p $ORG3_ADMIN_DIR/msp/{cacerts,tlscacerts,signcerts,keystore}

# Cert raíz de la CA en el MSP de la org
cp fabric-ca/org3/tls-cert.pem $ORG3_MSP_DIR/cacerts/ca-cert.pem
cp fabric-ca/org3/tls-cert.pem $ORG3_MSP_DIR/tlscacerts/tlsca-cert.pem

# config.yaml de NodeOUs (clasifica admin/peer/client por OU)
cat > $ORG3_MSP_DIR/config.yaml <<'YAML'
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
YAML

# MSP del peer
cp fabric-ca/org3/peer0/msp/signcerts/cert.pem  $ORG3_PEER_DIR/msp/signcerts/
cp fabric-ca/org3/peer0/msp/keystore/*          $ORG3_PEER_DIR/msp/keystore/priv_sk
cp fabric-ca/org3/tls-cert.pem                  $ORG3_PEER_DIR/msp/cacerts/ca-cert.pem
cp fabric-ca/org3/tls-cert.pem                  $ORG3_PEER_DIR/msp/tlscacerts/tlsca-cert.pem
cp $ORG3_MSP_DIR/config.yaml                    $ORG3_PEER_DIR/msp/config.yaml

# TLS del peer (server.crt, server.key, ca.crt) - usamos el enroll TLS
cp fabric-ca/org3/peer0/tls/msp/signcerts/cert.pem  $ORG3_PEER_DIR/tls/server.crt
cp fabric-ca/org3/peer0/tls/msp/keystore/*          $ORG3_PEER_DIR/tls/server.key
cp fabric-ca/org3/tls-cert.pem                      $ORG3_PEER_DIR/tls/ca.crt

# MSP del admin
cp fabric-ca/org3/org3admin/msp/signcerts/cert.pem $ORG3_ADMIN_DIR/msp/signcerts/
cp fabric-ca/org3/org3admin/msp/keystore/*         $ORG3_ADMIN_DIR/msp/keystore/priv_sk
cp fabric-ca/org3/tls-cert.pem                     $ORG3_ADMIN_DIR/msp/cacerts/ca-cert.pem
cp fabric-ca/org3/tls-cert.pem                     $ORG3_ADMIN_DIR/msp/tlscacerts/tlsca-cert.pem
cp $ORG3_MSP_DIR/config.yaml                       $ORG3_ADMIN_DIR/msp/config.yaml
```

#### 2.2 Añadir Org3 al `configtx.yaml` y generar su definición JSON

Edita `$HOME/red-con-ca/configtx.yaml` (el que creaste en el paso 0.3.1) y **añade este bloque dentro de la sección `Organizations:`** (al final, después de `&Org2`):

```yaml
  - &Org3
    Name: Org3MSP
    ID: Org3MSP
    MSPDir: organizations/peerOrganizations/org3.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org3MSP.admin', 'Org3MSP.peer', 'Org3MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org3MSP.admin', 'Org3MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org3MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org3MSP.peer')"
    AnchorPeers:
      - Host: peer0.org3.example.com
        Port: 11051
```

Genera ahora la definición de Org3 que se incrustará en el config update del canal:

```bash
cd $HOME/red-con-ca
export FABRIC_CFG_PATH=$PWD
configtxgen -printOrg Org3MSP > channel-artifacts/org3-definition.json
```

#### 2.3 Obtener la config actual del canal

```bash
# Como Org1
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG1_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

peer channel fetch config channel-artifacts/config_block.pb \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  -c mychannel

configtxlator proto_decode --input channel-artifacts/config_block.pb \
  --type common.Block --output channel-artifacts/config_block.json

jq '.data.data[0].payload.data.config' channel-artifacts/config_block.json \
  > channel-artifacts/config.json
```

#### 2.4 Añadir Org3 a la configuración

```bash
jq -s '.[0] * {"channel_group":{"groups":{"Application":{"groups":{
  "Org3MSP":.[1]}}}}}' \
  channel-artifacts/config.json \
  channel-artifacts/org3-definition.json \
  > channel-artifacts/config_modified.json
```

#### 2.5 Calcular el delta

```bash
configtxlator proto_encode --input channel-artifacts/config.json \
  --type common.Config --output channel-artifacts/config.pb
configtxlator proto_encode --input channel-artifacts/config_modified.json \
  --type common.Config --output channel-artifacts/modified_config.pb

configtxlator compute_update --channel_id mychannel \
  --original channel-artifacts/config.pb \
  --updated channel-artifacts/modified_config.pb \
  --output channel-artifacts/config_update.pb

configtxlator proto_decode --input channel-artifacts/config_update.pb \
  --type common.ConfigUpdate --output channel-artifacts/config_update.json

echo '{"payload":{"header":{"channel_header":{
  "channel_id":"mychannel","type":2}},
  "data":{"config_update":'$(cat channel-artifacts/config_update.json)'}}}' | \
  jq . > channel-artifacts/config_update_envelope.json

configtxlator proto_encode --input channel-artifacts/config_update_envelope.json \
  --type common.Envelope --output channel-artifacts/config_update_envelope.pb
```

#### 2.6 Firmar y enviar

```bash
# Org1 firma
peer channel signconfigtx -f channel-artifacts/config_update_envelope.pb

# Cambiar a Org2 para enviar (su firma se añade automáticamente al enviar)
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG2_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp

peer channel update -f channel-artifacts/config_update_envelope.pb \
  -c mychannel \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA
```

> **¿Y si faltan firmas?** Con `MAJORITY Admins`, en una red de 2 orgs hace falta firma de las dos. Si solo firma una, `peer channel update` devuelve `error: error applying config update to existing channel ... permission denied`. Resuelve recopilando las firmas que falten (ver sección 3.6 más abajo).

#### 2.7 Levantar el peer y CouchDB de Org3

Antes de unir al canal nada de Org3, hay que arrancar el contenedor del peer (y su CouchDB). En tu fichero `docker/docker-compose-net.yaml`, añade estos dos servicios bajo `services:`:

```yaml
  couchdb.org3:
    container_name: couchdb.org3
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - 11984:5984
    networks:
      - fabric-ca-net

  peer0.org3.example.com:
    container_name: peer0.org3.example.com
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org3.example.com
      - CORE_PEER_ADDRESS=peer0.org3.example.com:11051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:11051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org3.example.com:11052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:11052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org3.example.com:11051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org3.example.com:11051
      - CORE_PEER_LOCALMSPID=Org3MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-ca-net
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.org3:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
      - CORE_OPERATIONS_LISTENADDRESS=peer0.org3.example.com:9446
    command: peer node start
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls:/etc/hyperledger/fabric/tls
      - peer0.org3.example.com:/var/hyperledger/production
    ports:
      - 11051:11051
      - 9446:9446
    depends_on:
      - couchdb.org3
    networks:
      - fabric-ca-net
```

Y añade el nuevo volumen al bloque `volumes:` de arriba del mismo fichero:

```yaml
volumes:
  orderer.example.com:
  peer0.org1.example.com:
  peer0.org2.example.com:
  peer0.org3.example.com:   # ← añadir esta línea
```

Levanta solo los dos servicios nuevos sin tocar el resto:

```bash
cd $HOME/red-con-ca
docker compose -f docker/docker-compose-net.yaml up -d couchdb.org3 peer0.org3.example.com
```

Verifica que los dos contenedores están corriendo:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "org3|couchdb.org3"
```

#### 2.8 Unir el peer de Org3 al canal

Ahora sí, con el peer ya arrancado, lo unimos al canal:

```bash
# FABRIC_CFG_PATH al core.yaml de fabric-samples (no al configtx)
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config

export CORE_PEER_LOCALMSPID=Org3MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_TLS_ROOTCERT_FILE=$HOME/red-con-ca/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$HOME/red-con-ca/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp

cd $HOME/red-con-ca

# Obtener bloque genesis
peer channel fetch 0 channel-artifacts/mychannel.block \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  -c mychannel

# Unirse
peer channel join -b channel-artifacts/mychannel.block
```

#### 2.9 Verificar que Org3 está activa en el canal

Tras unir Org3, deberías ver tres cosas:

```bash
# 1. La altura del canal ha crecido (al menos +1 por el bloque de config update)
peer channel getinfo -c mychannel
# Esperado: height mayor que antes del config update

# 2. Org3 aparece en la lista de organizaciones del canal
peer channel fetch config /tmp/config_block.pb \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA -c mychannel

configtxlator proto_decode --input /tmp/config_block.pb \
  --type common.Block | jq '.data.data[0].payload.data.config.channel_group.groups.Application.groups | keys'
# Esperado: ["Org1MSP", "Org2MSP", "Org3MSP"]

# 3. Desde Org3, puedes hacer queries de solo lectura del chaincode
export CORE_PEER_LOCALMSPID=Org3MSP
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp

peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllAssets"]}'
# Esperado: mismo resultado que desde Org1 u Org2
```

#### 2.10 ¿Org3 como endorsing peer del chaincode existente?

Unir el peer al canal **no** convierte automáticamente a Org3 en endorsing peer del chaincode `basic`. Para que Org3 pueda endorsar transacciones tienes que **redesplegar el chaincode con sequence + 1** incluyendo a Org3 en las aprobaciones:

```bash
# 1. Instalar el chaincode en peer0.org3 (mismo .tar.gz que las demás orgs)
peer lifecycle chaincode install basic.tar.gz

# 2. Aprobar como Org3 con sequence + 1
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  --channelID mychannel --name basic --version 1.0 \
  --package-id $CC_PACKAGE_ID --sequence 2

# 3. Volver a aprobar como Org1 y Org2 con la misma sequence 2

# 4. Hacer commit incluyendo a Org3 en --peerAddresses
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA \
  --channelID mychannel --name basic --version 1.0 --sequence 2 \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_ORG1_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_ORG2_TLS \
  --peerAddresses localhost:11051 --tlsRootCertFiles $PEER_ORG3_TLS
```

Tras el commit, Org3 forma parte de la política de endorsement y puede contribuir a las transacciones.

> **Nota:** este proceso es complejo a propósito. Fabric requiere gobernanza: no puedes añadir una org sin el consentimiento de las existentes. Es una característica, no un defecto.

---

## 3. Actualizar la configuración del canal

> **¿Qué es?** Es el procedimiento estándar para modificar parámetros del canal después de su creación: políticas, batch size del orderer, anchor peers, capabilities, ACLs, etc. Se hace mediante un `config update` que sigue el patrón **fetch → decode → modify → compute → submit**.
>
> **¿Para qué sirve?** Para adaptar la red a nuevas necesidades sin tener que recrearla. La configuración del canal define cómo se comporta toda la red, así que cambiarla de forma controlada y consensuada es esencial.
>
> **¿Cuándo hacerlo?**
> - **Cambios de rendimiento**: bajar `BatchTimeout` para reducir latencia, subir `MaxMessageCount` para mayor throughput.
> - **Endurecer seguridad**: cambiar políticas de `MAJORITY` a `ALL` cuando crece la criticidad de los datos.
> - **Actualizar versión de Fabric**: subir `Capabilities` cuando todas las orgs migran a una nueva versión.
> - **Anchor peers**: añadir o cambiar el anchor peer de una org si la infraestructura cambia.
> - **Permisos (ACLs)**: ajustar quién puede invocar ciertos recursos del sistema.
>
> Como toda modificación del canal, requiere mayoría de admins firmando la propuesta.

### Qué se puede cambiar

| Parámetro | Dónde | Ejemplo |
|-----------|-------|---------|
| Batch timeout | Orderer | Cambiar de 2 s a 1 s para más velocidad |
| Batch size | Orderer | Aumentar MaxMessageCount de 10 a 50 |
| Políticas | Channel/Application/Orderer | Cambiar MAJORITY a ALL |
| Anchor peers | Application.groups.OrgX | Añadir o cambiar anchor peers |
| ACLs | Application | Cambiar permisos de acceso a recursos |
| Capabilities | Channel/Orderer/Application | Habilitar nuevas features de Fabric |

### Proceso general

El patrón es siempre el mismo (fetch → decode → modify → compute → submit):

```mermaid
graph LR
    F["1. Fetch config<br/>actual"] --> D["2. Decode<br/>a JSON"]
    D --> M["3. Modificar<br/>el JSON"]
    M --> C["4. Compute<br/>update (delta)"]
    C --> S["5. Sign + Submit<br/>la actualizacion"]

    style F fill:#22627E,color:#fff
    style D fill:#22627E,color:#fff
    style M fill:#B45D09,color:#fff
    style C fill:#22627E,color:#fff
    style S fill:#0D9448,color:#fff
```

### Ejemplo: cambiar el batch timeout

```bash
# Como Org1
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG1_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

# 1-2. Fetch y decode
peer channel fetch config channel-artifacts/config_block.pb \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA -c mychannel

configtxlator proto_decode --input channel-artifacts/config_block.pb \
  --type common.Block --output channel-artifacts/config_block.json

jq '.data.data[0].payload.data.config' channel-artifacts/config_block.json \
  > channel-artifacts/config.json

# 3. Modificar: batch timeout de 2s a 1s
jq '.channel_group.groups.Orderer.values.BatchTimeout.value.timeout = "1s"' \
  channel-artifacts/config.json > channel-artifacts/config_modified.json

# 4. Compute update
configtxlator proto_encode --input channel-artifacts/config.json \
  --type common.Config --output channel-artifacts/config.pb
configtxlator proto_encode --input channel-artifacts/config_modified.json \
  --type common.Config --output channel-artifacts/modified_config.pb

configtxlator compute_update --channel_id mychannel \
  --original channel-artifacts/config.pb \
  --updated channel-artifacts/modified_config.pb \
  --output channel-artifacts/config_update.pb

configtxlator proto_decode --input channel-artifacts/config_update.pb \
  --type common.ConfigUpdate --output channel-artifacts/config_update.json

echo '{"payload":{"header":{"channel_header":{
  "channel_id":"mychannel","type":2}},
  "data":{"config_update":'$(cat channel-artifacts/config_update.json)'}}}' | \
  jq . > channel-artifacts/config_update_envelope.json

configtxlator proto_encode --input channel-artifacts/config_update_envelope.json \
  --type common.Envelope --output channel-artifacts/config_update_envelope.pb

# 5. Enviar
peer channel update -f channel-artifacts/config_update_envelope.pb \
  -c mychannel \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA
```

### Otros ejemplos comunes

El patrón anterior (fetch → decode → modify → compute → submit) es siempre el mismo; lo único que cambia es el `jq` del paso 3. Aquí van los más pedidos en la práctica:

**Cambiar anchor peers de Org1** (los peers que actúan como puntos de descubrimiento entre orgs):

```bash
jq '.channel_group.groups.Application.groups.Org1MSP.values.AnchorPeers = {
  "mod_policy": "Admins",
  "value": {
    "anchor_peers": [{"host": "peer0.org1.example.com", "port": 7051}]
  },
  "version": "0"
}' channel-artifacts/config.json > channel-artifacts/config_modified.json
```

**Cambiar la política de endorsement por defecto del canal** (de `MAJORITY` a `ALL`):

```bash
jq '.channel_group.groups.Application.policies.Endorsement.policy.value.rule = "ALL"' \
  channel-artifacts/config.json > channel-artifacts/config_modified.json
```

**Habilitar capabilities V2_5** (cuando todas las orgs ya corren Fabric 2.5):

```bash
jq '.channel_group.values.Capabilities.value.capabilities = {"V2_5": {}}' \
  channel-artifacts/config.json > channel-artifacts/config_modified.json
```

> **Importante**: las capabilities solo se pueden subir cuando **todas** las orgs corren la versión correspondiente. Si alguna está aún en una versión anterior, no podrá procesar bloques con la nueva capability y se quedará desincronizada.

### 3.6 Recopilar firmas de múltiples orgs

Cuando la política exige `MAJORITY Admins` y tienes más de una org, el flujo es:

1. Org1 firma el envelope con `peer channel signconfigtx -f config_update_envelope.pb`.
2. Org1 entrega el `.pb` firmado a Org2 (email seguro, repo privado, lo que sea).
3. Org2 firma sobre el mismo archivo: `peer channel signconfigtx -f config_update_envelope.pb`.
4. Cualquiera de las dos envía la versión ya firmada por ambas con `peer channel update`.

Si solo cuentas con una firma y la política requiere dos, el orderer rechaza el envelope:

```
Error: error applying config update to existing channel: ... permission denied
```

Si lo ves, comprueba con `mod_policy` qué políticas se aplican al campo que modificaste (suele estar en `.mod_policy` de cada grupo o valor del JSON) y recopila las firmas que falten.

---

## 4. Monitorización y logs

> **¿Qué es?** Es el conjunto de prácticas para observar el estado de la red en tiempo real: leer logs de los contenedores, consultar métricas operativas (Operations API en formato Prometheus) y configurar alertas cuando algo va mal.
>
> **¿Para qué sirve?**
> - **Detectar problemas pronto**: tasa alta de transacciones inválidas, peers desincronizados, espacio en disco bajo, certificados próximos a caducar.
> - **Diagnosticar incidencias**: cuando una transacción falla, los logs te dicen por qué (validación, endorsement, MVCC, etc).
> - **Auditoría**: dejar evidencia de qué pasó y cuándo, para cumplir requisitos regulatorios o investigar anomalías.
> - **Optimización**: identificar cuellos de botella (chaincode lento, orderer saturado).
>
> **¿Cuándo hacerlo?** Es una tarea **continua**, no puntual. En producción se configuran alertas automáticas (Prometheus + Grafana + Alertmanager) que notifican a los oncall cuando se cruzan umbrales críticos. En desarrollo se consultan logs solo cuando algo falla. Subir el nivel de log a `DEBUG` solo es aceptable de forma temporal y para diagnóstico — en producción genera demasiado ruido.

### Logs de los contenedores

```bash
# Ver logs en tiempo real
docker logs -f peer0.org1.example.com
docker logs -f orderer.example.com

# Últimas 100 líneas
docker logs --tail 100 peer0.org1.example.com

# Filtrar por nivel
docker logs peer0.org1.example.com 2>&1 | grep -i error
```

> **Ojo con los logs del chaincode**: el código del smart contract no corre dentro del contenedor del peer. Cuando un peer instancia un chaincode, lanza otro contenedor aparte llamado `dev-peer0.<orgX>.example.com-<label>-<hash>`. Los `fmt.Println` o `console.log` del chaincode salen ahí, no en el log del peer.
>
> ```bash
> # Listar los contenedores de chaincode
> docker ps --format '{{.Names}}' | grep '^dev-'
>
> # Ver sus logs (sustituye el nombre por el real)
> docker logs -f dev-peer0.org1.example.com-basic_1.0-abc123...
> ```

### Niveles de log

Se controlan con la variable `FABRIC_LOGGING_SPEC`:

```bash
# En docker-compose: FABRIC_LOGGING_SPEC=INFO
# Más detalle:       FABRIC_LOGGING_SPEC=DEBUG
# Solo un módulo:    FABRIC_LOGGING_SPEC=INFO:gossip=DEBUG:msp=DEBUG

# Cambiar en caliente (sin reiniciar el contenedor)
docker exec peer0.org1.example.com \
  peer node logsetlevel gossip DEBUG
```

| Nivel | Cuando usarlo |
|-------|--------------|
| `ERROR` | Producción (solo errores críticos) |
| `WARNING` | Producción (errores + advertencias) |
| `INFO` | Normal (operaciones principales) |
| `DEBUG` | Diagnóstico (muy verboso, solo temporal) |

### Métricas con Operations API

Los peers y el orderer exponen un endpoint HTTP de operaciones con health checks y métricas en formato Prometheus. **No está activo por defecto**: hay que declararlo en el docker-compose con las env vars adecuadas (el docker-compose de la sección 0 ya lo tiene):

```yaml
# Para el peer
- CORE_OPERATIONS_LISTENADDRESS=peer0.org1.example.com:9444

# Para el orderer
- ORDERER_OPERATIONS_LISTENADDRESS=orderer.example.com:9443
```

Con esas variables, los puertos `9443` (orderer), `9444` (Org1) y `9445` (Org2) escuchan HTTP:

```bash
# Health check del peer Org1 (puerto 9444)
curl -s http://localhost:9444/healthz

# Health check del orderer (puerto 9443)
curl -s http://localhost:9443/healthz

# Métricas en formato Prometheus
curl -s http://localhost:9444/metrics | head -20
```

Métricas útiles:

| Métrica | Qué indica |
|---------|-----------|
| `endorser_proposal_duration` | Tiempo de endorsement |
| `ledger_block_processing_time` | Tiempo de procesado de bloque |
| `ledger_blockchain_height` | Número de bloques en el ledger |
| `gossip_state_height` | Altura del state según gossip |
| `chaincode_launch_duration` | Tiempo de arranque del chaincode |

```mermaid
graph LR
    P["Peers<br/>:9444, :9445"] --> |"/metrics"| PROM["Prometheus<br/>(recolecta metricas)"]
    O["Orderer<br/>:9443"] --> |"/metrics"| PROM
    PROM --> GRAF["Grafana<br/>(dashboards)"]

    style PROM fill:#B45D09,color:#fff
    style GRAF fill:#0D9448,color:#fff
```

> En producción se configura Prometheus para recolectar métricas y Grafana para visualizarlas.

### Eventos del chaincode (chaincode events)

Otra fuente de información operativa son los **eventos** que emite el chaincode. Un chaincode puede llamar a `ctx.GetStub().SetEvent("EventName", payload)` para señalizar que ha pasado algo importante (`AssetCreated`, `TransferConfirmed`, etc). Estos eventos viajan en el bloque junto con la transacción.

Casos de uso típicos:

- **Disparar workflows externos**: un sistema legacy escucha `AssetCreated` y reacciona.
- **Auditoría en tiempo real**: una herramienta consume todos los eventos del canal y alimenta un dashboard.
- **Notificaciones**: una app cliente avisa al usuario cuando se confirma una transacción suya.

Para escucharlos desde un cliente Node.js o Go basta con suscribirse al stream de eventos del canal mediante el Gateway SDK. Lo vemos con más detalle en el [doc 05 del Módulo 6](../Modulo%206/05-aplicacion-cliente.md).

---

## 5. Backup y recuperación

> **¿Qué es?** Es la práctica de copiar periódicamente los datos críticos de la red (claves privadas, certificados, ledger, world state, base de datos de la CA, configuración) a un almacenamiento separado, junto con el procedimiento para restaurarlos cuando algo falla.
>
> **¿Para qué sirve?** Para sobrevivir a desastres: corrupción de disco, borrado accidental, ransomware, fallo de hardware. En blockchain hay un componente especial: si tu peer pierde sus datos pero los demás siguen vivos, puedes reconstruir descargando los bloques desde el orderer. **Pero** si pierdes las claves privadas o los certificados, pierdes la identidad de la org y no hay forma de recuperarla.
>
> **¿Cuándo hacerlo?**
> - **Claves privadas y certificados raíz**: backup inmediato y guardado en bóveda fuera del sistema (idealmente HSM o vault). Se hace una sola vez (no cambian).
> - **Ledger del peer**: backup periódico (diario en producción). Si pierdes los datos pero las claves están bien, puedes recuperarte sincronizando con otros peers o desde un snapshot.
> - **CouchDB / world state**: junto con el ledger. Se puede reconstruir desde los bloques pero tarda mucho con millones de transacciones.
> - **Base de datos de Fabric CA**: backup semanal. Contiene el registro de identidades emitidas, importante para auditoría.
> - **Configuración**: en cada cambio de configuración (`docker-compose.yaml`, `configtx.yaml`). Tener todo en git es la práctica habitual.
>
> En multi-máquina, **cada org backupea sus propios datos**. No hay backup centralizado — cada participante es responsable de su infraestructura.

### Qué hay que respaldar

```mermaid
graph TB
    subgraph "Datos críticos a respaldar"
        A["Ledger<br/>(bloques + world state)"]
        B["Material criptográfico<br/>(certs + claves)"]
        C["Configuración<br/>(yaml, docker-compose)"]
    end

    A --> |"Volumen Docker:<br/>/var/hyperledger/production"| BA["Backup del volumen"]
    B --> |"Directorio:<br/>organizations/ + fabric-ca/"| BB["Backup del directorio"]
    C --> |"Archivos yaml"| BC["Backup en git"]

    style A fill:#EC0000,color:#fff
    style B fill:#EC0000,color:#fff
    style C fill:#B45D09,color:#fff
```

| Qué | Dónde está | Frecuencia | Criticidad |
|-----|-----------|-----------|------------|
| **Claves privadas** | `organizations/*/keystore/` y `fabric-ca/*/` | Una vez (no cambian) | **CRÍTICA** |
| **Certificados** | `organizations/*/signcerts/` | Al renovar | Alta |
| **Ledger** | Volumen Docker del peer | Periódica | Alta (se reconstruye desde otros peers) |
| **World State** | Volumen Docker (CouchDB) | Periódica | Media (se reconstruye desde bloques) |
| **Configuración** | Archivos yaml | En cada cambio | Alta (tener en git) |
| **Fabric CA database** | `fabric-ca/*/fabric-ca-server.db` | Periódica | **CRÍTICA** (registro de identidades) |

### Backup del ledger del peer

```bash
# Opción A: parar y copiar (lo más seguro)
docker stop peer0.org1.example.com
docker cp peer0.org1.example.com:/var/hyperledger/production ./backup-peer0-org1
docker start peer0.org1.example.com

# Opción B: snapshot sin parar (Fabric 2.5+)
peer snapshot submitrequest \
  -c mychannel \
  --peerAddress localhost:7051 \
  --tlsRootCertFiles $PEER_ORG1_TLS

# Una vez completado el snapshot, se guarda en el volumen del peer en
# /var/hyperledger/production/snapshots/. Cópialo a un sitio seguro:
docker cp peer0.org1.example.com:/var/hyperledger/production/snapshots ./backup-snapshots-org1
```

### Backup del world state (CouchDB)

CouchDB se reconstruye desde los bloques, pero si tu canal tiene millones de transacciones eso lleva horas. Conviene respaldarlo aparte:

```bash
# Volcado de todas las bases de datos del CouchDB de Org1
mkdir -p backup-couchdb-org1
for db in $(curl -s http://admin:adminpw@localhost:5984/_all_dbs | jq -r '.[]'); do
    curl -s http://admin:adminpw@localhost:5984/$db/_all_docs?include_docs=true \
        > backup-couchdb-org1/$db.json
done
```

### Backup de la base de datos de Fabric CA

Cada Fabric CA mantiene un SQLite local con todas las identidades emitidas y revocadas. Es crítico para la auditoría:

```bash
# Parar la CA brevemente para que SQLite cierre el fichero
docker stop ca.org1.example.com

# Copiar la BD y los archivos asociados
cp -r fabric-ca/org1 ./backup-ca-org1

# Volver a arrancar
docker start ca.org1.example.com
```

> **Alternativa sin downtime**: ejecutar `sqlite3 fabric-ca/org1/fabric-ca-server.db ".backup '/tmp/ca-backup.db'"` mientras la CA está corriendo. Funciona porque SQLite soporta backups online a través de su API.

### Recuperación

```mermaid
graph TB
    LOST["Peer perdido"] --> A["Opción A:<br/>Restaurar backup"]
    LOST --> B["Opción B:<br/>Unirse desde cero"]

    A --> A1["Restaurar volumen → arrancar → sincroniza bloques faltantes"]
    B --> B1["Arrancar limpio → peer channel join → descarga TODO"]

    style A fill:#0D9448,color:#fff
    style B fill:#B45D09,color:#fff
```

#### Opción A: restaurar desde backup

```bash
# 1. Parar el peer (si aún está arrancado con datos corruptos)
docker stop peer0.org1.example.com
docker rm peer0.org1.example.com

# 2. Restaurar el volumen Docker desde el backup
docker volume rm red-con-ca_peer0.org1.example.com 2>/dev/null || true
docker volume create red-con-ca_peer0.org1.example.com

# Copiar el contenido del backup dentro del volumen
docker run --rm -v red-con-ca_peer0.org1.example.com:/dst \
  -v "$PWD/backup-peer0-org1:/src" alpine \
  sh -c 'cp -a /src/. /dst/'

# 3. Volver a arrancar
docker compose -f docker/docker-compose-net.yaml up -d peer0.org1.example.com

# 4. Verificar que recupera la altura del canal
peer channel getinfo -c mychannel
```

El peer detectará que falta historia respecto al orderer y se sincronizará automáticamente.

#### Opción B: arrancar limpio y resincronizar

Útil si **no tienes backup** o si la corrupción es total. Solo necesitas tener los **certificados y claves** (lo más crítico). El ledger se reconstruye desde el orderer y los otros peers:

```bash
# 1. Asegúrate de tener intacto el material crypto en organizations/peerOrganizations/org1.example.com/
ls organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp

# 2. Borrar el volumen viejo
docker stop peer0.org1.example.com 2>/dev/null
docker rm peer0.org1.example.com 2>/dev/null
docker volume rm red-con-ca_peer0.org1.example.com

# 3. Arrancar el peer limpio
docker compose -f docker/docker-compose-net.yaml up -d peer0.org1.example.com

# 4. Unir al canal de nuevo (descargará todos los bloques desde el principio)
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_ORG1_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

# Obtener bloque génesis del canal
peer channel fetch 0 channel-artifacts/mychannel.block \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $ORDERER_CA -c mychannel

peer channel join -b channel-artifacts/mychannel.block

# El peer descargará todo el historial del canal. En canales grandes tarda.
```

> **Caso "lo he perdido todo"**: si pierdes incluso las claves privadas (carpeta `organizations/` borrada y sin backup), no puedes recuperar la identidad de la org. Tendrías que coordinarte con las otras orgs para emitir certificados nuevos y añadir la org otra vez como si fuera nueva (sección 2). El historial del canal sigue intacto en las otras orgs.

---

## 6. Rotación de certificados TLS

> **¿Qué es?** Es el proceso de sustituir los certificados TLS de un nodo (peer u orderer) por unos nuevos antes de que los anteriores caduquen. Implica solicitar a Fabric CA un `reenroll`, copiar los nuevos archivos al nodo y reiniciarlo.
>
> **¿Para qué sirve?** Los certificados X.509 tienen fecha de caducidad. Si caducan sin haber sido renovados, el nodo deja de poder comunicarse — los demás peers/orderers rechazan su TLS y queda aislado de la red. La rotación periódica también limita el daño potencial si una clave privada se ve comprometida (cuanto más nuevo el cert, menos tiempo ha tenido el atacante para usarlo).
>
> **¿Cuándo hacerlo?**
> - **Antes de caducar**: con margen de al menos 30 días. Lo habitual es rotar TLS de peers y orderers anualmente.
> - **Tras un incidente de seguridad**: si se sospecha que una clave privada está comprometida, **rotar inmediatamente y revocar el cert antiguo** (publicar nueva CRL).
> - **Al renovar la CA raíz**: cada 5-10 años. Es una operación pesada porque hay que renovar toda la cadena de confianza y reconstruir los MSPs.
> - **Al cambiar de hostname o IP del nodo**: el cert TLS lleva los SANS — si cambian, hay que reemitir.
>
> **Nota importante**: la rotación de certificados de **enrollment** (no TLS) no requiere reiniciar el nodo, basta con que el cliente use el nuevo cert al firmar transacciones. Pero la rotación de **TLS** sí requiere reinicio del proceso del peer/orderer porque el TLS se carga al arrancar.

Usando la Fabric CA del doc 05, renovar certificados es sencillo. **Importante:** usa un directorio NUEVO para el `reenroll` (no machaques el del enrol inicial, te interesa conservarlo como referencia) y haz backup de los TLS actuales antes de reemplazarlos — si algo falla, vuelves al estado previo en segundos.

```bash
cd $HOME/red-con-ca

# 0. Backup de los TLS actuales (por si algo va mal)
ORG1_TLS_DIR=$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls
cp -r $ORG1_TLS_DIR ${ORG1_TLS_DIR}.bak.$(date +%Y%m%d)

# 1. Reenrollar el peer con nuevos certs, en una carpeta NUEVA
#    (NO uses $PWD/fabric-ca/org1/peer0/tls porque machacarías el enrol original)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/peer0-tls-reenroll

fabric-ca-client reenroll \
  -u https://localhost:7054 \
  --caname ca-org1 \
  --enrollment.profile tls \
  --csr.hosts peer0.org1.example.com,localhost \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# 2. Copiar los nuevos certs al directorio TLS del peer
cp $FABRIC_CA_CLIENT_HOME/msp/signcerts/cert.pem  $ORG1_TLS_DIR/server.crt
cp $FABRIC_CA_CLIENT_HOME/msp/keystore/*_sk       $ORG1_TLS_DIR/server.key

# 3. Reiniciar el peer para que cargue los nuevos certificados
docker restart peer0.org1.example.com

# 4. Verificar que sigue funcionando (lista canales del peer)
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_TLS_DIR/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
peer channel list
```

Si todo va bien, ya puedes borrar el backup `${ORG1_TLS_DIR}.bak.YYYYMMDD` cuando lleves unos días sin incidencias.

> **Si el peer no arranca tras el reinicio:** restaura el backup
> (`rm -rf $ORG1_TLS_DIR && mv ${ORG1_TLS_DIR}.bak.YYYYMMDD $ORG1_TLS_DIR && docker restart peer0.org1.example.com`)
> y revisa los logs del peer con `docker logs peer0.org1.example.com`. Causas habituales: el cert nuevo no incluye el SANS de `localhost` (faltó `--csr.hosts`), o el `keystore/*_sk` no se copió correctamente.

### Rotación de certificados de enrollment (no TLS)

A diferencia del TLS, los certificados de **enrollment** (los que firman transacciones) no requieren reiniciar el peer — son los que usan los clientes y administradores al firmar. Su rotación es más sencilla:

```bash
# Reenrollar al usuario user1 (cliente)
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/user1

fabric-ca-client reenroll \
  --caname ca-org1 \
  --enrollment.attrs "role,department" \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# El nuevo cert se escribe en $FABRIC_CA_CLIENT_HOME/msp/signcerts/
# La nueva clave privada en $FABRIC_CA_CLIENT_HOME/msp/keystore/
```

A partir de ese momento, las aplicaciones cliente que carguen ese MSP usarán el nuevo cert. **No hace falta reiniciar nada del lado del peer**: la próxima transacción que llegue firmada con el nuevo cert se valida normalmente porque está firmado por la misma CA.

### Rotación del cert del admin de la org

Este caso merece atención aparte porque si caduca, **nadie puede ejecutar operaciones administrativas** sobre el canal (commit de chaincode, config updates, etc).

```bash
# Reenrollar el admin de Org1
export FABRIC_CA_CLIENT_HOME=$PWD/fabric-ca/org1/org1admin

fabric-ca-client reenroll \
  --caname ca-org1 \
  --tls.certfiles $PWD/fabric-ca/org1/tls-cert.pem

# Copiar el nuevo cert y la nueva clave al MSP del admin
cp $FABRIC_CA_CLIENT_HOME/msp/signcerts/cert.pem \
   $PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/

cp $FABRIC_CA_CLIENT_HOME/msp/keystore/*_sk \
   $PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/

# Borrar el viejo (si quedó duplicado)
ls $PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/
```

> **Recomendación**: vigila la caducidad del admin con `openssl x509 -in cert.pem -noout -enddate` y rota con al menos 60 días de margen. Si caduca antes de rotarlo, no hay forma de operar el canal hasta emitir uno nuevo (que requiere otro admin, lo cual puede ser un círculo vicioso si solo había uno).

### Rotación coordinada en clúster Raft del orderer

Cuando hay varios nodos orderer formando un clúster Raft, la rotación de su certificado TLS exige coordinación: el cluster ID de cada nodo está atado a su cert, así que cambiar uno implica actualizar la configuración del canal antes de reiniciar.

Procedimiento resumido (cada nodo del clúster, uno a uno):

1. Reenrollar el cert TLS del nodo con `fabric-ca-client reenroll --enrollment.profile tls`.
2. **Antes de reiniciar el nodo**, actualizar la config del canal para sustituir el cert antiguo del consenter por el nuevo (sección 3, modificando `.channel_group.values.OrdererAddresses` y el `consenters` del config).
3. Esperar a que la config update se commitee.
4. Reiniciar el nodo orderer con el cert nuevo.
5. Verificar que sigue en el clúster: `osnadmin channel list` desde otro nodo.
6. Repetir con el siguiente nodo.

> **Importante**: no rotar nunca dos nodos a la vez si el clúster tiene 3 nodos. Perderías quórum. En clústers de 5, puedes rotar de dos en dos.

### Calendario de rotación

| Componente | Frecuencia | Impacto |
|-----------|-----------|---------|
| TLS de peers | Cada 12 meses | Reinicio del peer (segundos) |
| TLS de orderers | Cada 12 meses | Coordinar con clúster Raft (uno a uno) |
| Enrollment certs (clientes) | Según política, anual típicamente | Sin reinicio |
| Cert del admin de la org | Antes de caducidad, margen ≥ 60 días | Sin reinicio, solo copia al MSP |
| CA root cert | Cada 5-10 años | Renovación completa de la cadena |

---

## Resumen de comandos de administración

| Operación | Comando |
|-----------|---------|
| Ver canales de un peer | `peer channel list` |
| Info de un canal | `peer channel getinfo -c mychannel` |
| Fetch config | `peer channel fetch config` |
| Actualizar config | `configtxlator compute_update` + `peer channel update` |
| Ver chaincodes instalados | `peer lifecycle chaincode queryinstalled` |
| Ver chaincodes activos | `peer lifecycle chaincode querycommitted` |
| Cambiar log level en caliente | `docker exec <peer> peer node logsetlevel <modulo> <NIVEL>` |
| Health check | `curl http://localhost:9444/healthz` |
| Métricas Prometheus | `curl http://localhost:9444/metrics` |
| Listar canales del orderer | `osnadmin channel list` |
| Snapshot | `peer snapshot submitrequest` |
| Revocar certificado | `fabric-ca-client revoke` |
| Renovar certificado | `fabric-ca-client reenroll` |

---

**Anterior:** [05 - Fabric CA](05-fabric-ca.md)
