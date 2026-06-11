# 04 - Despliegue de la red FidelityChain

## Visión general

En este documento levantamos la red completa desde cero y desplegamos el chaincode. Al final tendremos un sistema operativo donde podemos emitir y canjear puntos desde la terminal.

```mermaid
graph LR
    A["1. Generar certs"] --> B["2. Generar bloque genesis"]
    B --> C["3. Levantar Docker"]
    C --> D["4. Crear canal"]
    D --> E["5. Unir peers"]
    E --> F["6. Desplegar chaincode"]
    F --> G["7. Probar desde terminal"]

    style A fill:#7C3AED,color:#fff
    style B fill:#22627E,color:#fff
    style C fill:#0D9448,color:#fff
    style D fill:#B45D09,color:#fff
    style E fill:#B45D09,color:#fff
    style F fill:#EC0000,color:#fff
    style G fill:#EC0000,color:#fff
```

---

## Prerequisitos

- Docker y Docker Compose funcionando
- Binarios de Fabric en el PATH (`peer`, `orderer`, `configtxgen`, `cryptogen`, `osnadmin`)
- El proyecto `proyecto-fidelitychain/` creado con la estructura del doc 02

```bash
cd $HOME/proyecto-fidelitychain/network
```

---

## Paso 1: Generar certificados

```bash
cryptogen generate --config=crypto-config.yaml --output=crypto-config
```

Verificar:

```bash
tree crypto-config --dirsfirst -L 3
```

Deberias ver las carpetas de `hotel.fidelitychain.com`, `cafeteria.fidelitychain.com` y `fidelitychain.com` (orderer).

---

## Paso 2: Generar bloque génesis del canal

```bash
export FABRIC_CFG_PATH=$PWD

configtxgen -profile FidelityChannel \
  -outputBlock channel-artifacts/fidelity-channel.block \
  -channelID fidelity-channel
```

Verificar:

```bash
ls -la channel-artifacts/
```

---

## Paso 3: Levantar la red

```bash
docker compose -f docker/docker-compose.yaml up -d
```

Verificar que los 6 contenedores están corriendo (orderer, 2 peers, 2 couchdb, cli):

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

> Si algun contenedor no arranca, revisar logs con `docker logs <nombre> --tail 50`

---

## Paso 4: Crear el canal

### 4.1 Unir el orderer al canal

```bash
export ORDERER_CA=$PWD/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/tls/ca.crt
export ORDERER_ADMIN_TLS_CERT=$PWD/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/tls/server.crt
export ORDERER_ADMIN_TLS_KEY=$PWD/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/tls/server.key

osnadmin channel join \
  --channelID fidelity-channel \
  --config-block channel-artifacts/fidelity-channel.block \
  -o localhost:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT \
  --client-key $ORDERER_ADMIN_TLS_KEY
```

### 4.2 Verificar

```bash
osnadmin channel list \
  -o localhost:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_CERT \
  --client-key $ORDERER_ADMIN_TLS_KEY
```

---

## Paso 5: Unir los peers al canal

### 5.1 Configurar el entorno

```bash
export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config
```

### 5.2 Unir peer del Hotel (Org1)

```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=HotelMSP
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/crypto-config/peerOrganizations/hotel.fidelitychain.com/users/Admin@hotel.fidelitychain.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel join -b channel-artifacts/fidelity-channel.block
```

### 5.3 Unir peer de la Cafeteria (Org2)

```bash
export CORE_PEER_LOCALMSPID=CafeteriaMSP
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/users/Admin@cafeteria.fidelitychain.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel join -b channel-artifacts/fidelity-channel.block
```

### 5.4 Verificar

```bash
# Como Hotel
export CORE_PEER_LOCALMSPID=HotelMSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/crypto-config/peerOrganizations/hotel.fidelitychain.com/users/Admin@hotel.fidelitychain.com/msp

peer channel list
```

Debe mostrar: `fidelity-channel`

---

## Paso 6: Desplegar el chaincode

### 6.1 Empaquetar

```bash
cd $HOME/proyecto-fidelitychain

peer lifecycle chaincode package fidelitypoints.tar.gz \
  --path ./chaincode/chaincode-go/ \
  --lang golang \
  --label fidelitypoints_1.0
```

### 6.2 Instalar en el peer del Hotel

```bash
export CORE_PEER_LOCALMSPID=HotelMSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/users/Admin@hotel.fidelitychain.com/msp

peer lifecycle chaincode install fidelitypoints.tar.gz
```

### 6.3 Instalar en el peer de la Cafeteria

```bash
export CORE_PEER_LOCALMSPID=CafeteriaMSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/users/Admin@cafeteria.fidelitychain.com/msp

peer lifecycle chaincode install fidelitypoints.tar.gz
```

### 6.4 Obtener Package ID

```bash
peer lifecycle chaincode queryinstalled
```

Copiar el Package ID y exportarlo:

```bash
export CC_PACKAGE_ID=fidelitypoints_1.0:XXXX...
```

### 6.5 Aprobar como Hotel

```bash
export CORE_PEER_LOCALMSPID=HotelMSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/users/Admin@hotel.fidelitychain.com/msp

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls \
  --cafile $PWD/network/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/msp/tlscacerts/tlsca.fidelitychain.com-cert.pem \
  --channelID fidelity-channel \
  --name fidelitypoints \
  --version 1.0 \
  --package-id $CC_PACKAGE_ID \
  --sequence 1
```

### 6.6 Aprobar como Cafeteria

```bash
export CORE_PEER_LOCALMSPID=CafeteriaMSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/users/Admin@cafeteria.fidelitychain.com/msp

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls \
  --cafile $PWD/network/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/msp/tlscacerts/tlsca.fidelitychain.com-cert.pem \
  --channelID fidelity-channel \
  --name fidelitypoints \
  --version 1.0 \
  --package-id $CC_PACKAGE_ID \
  --sequence 1
```

### 6.7 Verificar aprobaciones

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID fidelity-channel \
  --name fidelitypoints \
  --version 1.0 \
  --sequence 1 \
  --output json
```

Debe mostrar: `"HotelMSP": true, "CafeteriaMSP": true`

### 6.8 Commit

```bash
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls \
  --cafile $PWD/network/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/msp/tlscacerts/tlsca.fidelitychain.com-cert.pem \
  --channelID fidelity-channel \
  --name fidelitypoints \
  --version 1.0 \
  --sequence 1 \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt
```

### 6.9 Verificar

```bash
peer lifecycle chaincode querycommitted --channelID fidelity-channel --name fidelitypoints
```

---

## Paso 7: Probar desde terminal

Estas variables se usan en todos los comandos de invocacion:

```bash
export ORDERER_CA=$PWD/network/crypto-config/ordererOrganizations/fidelitychain.com/orderers/orderer.fidelitychain.com/msp/tlscacerts/tlsca.fidelitychain.com-cert.pem
export PEER_HOTEL_TLS=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/peers/peer0.hotel.fidelitychain.com/tls/ca.crt
export PEER_CAFE_TLS=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/peers/peer0.cafeteria.fidelitychain.com/tls/ca.crt
```

### 7.1 Inicializar el token (como Hotel)

```bash
# Ponerse el sombrero del Hotel
export CORE_PEER_LOCALMSPID=HotelMSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_HOTEL_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/hotel.fidelitychain.com/users/Admin@hotel.fidelitychain.com/msp

peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls --cafile $ORDERER_CA \
  -C fidelity-channel -n fidelitypoints \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_HOTEL_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_CAFE_TLS \
  -c '{"function":"InitLedger","Args":[]}'
```

### 7.2 Registrar un cliente (como Hotel)

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls --cafile $ORDERER_CA \
  -C fidelity-channel -n fidelitypoints \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_HOTEL_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_CAFE_TLS \
  -c '{"function":"RegisterClient","Args":["12345678A","Javier Garcia"]}'
# El clientID es el DNI del cliente
```

### 7.3 Emitir 100 puntos (como Hotel)

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls --cafile $ORDERER_CA \
  -C fidelity-channel -n fidelitypoints \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_HOTEL_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_CAFE_TLS \
  -c '{"function":"Mint","Args":["12345678A","100","Estancia 2 noches"]}'
```

### 7.4 Consultar saldo

```bash
peer chaincode query -C fidelity-channel -n fidelitypoints \
  -c '{"Args":["BalanceOf","12345678A"]}'
```

Resultado esperado: `100`

### 7.5 Canjear 30 puntos por desayuno (como Cafeteria)

```bash
# Ponerse el sombrero de la Cafeteria
export CORE_PEER_LOCALMSPID=CafeteriaMSP
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER_CAFE_TLS
export CORE_PEER_MSPCONFIGPATH=$PWD/network/crypto-config/peerOrganizations/cafeteria.fidelitychain.com/users/Admin@cafeteria.fidelitychain.com/msp

peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.fidelitychain.com \
  --tls --cafile $ORDERER_CA \
  -C fidelity-channel -n fidelitypoints \
  --peerAddresses localhost:7051 --tlsRootCertFiles $PEER_HOTEL_TLS \
  --peerAddresses localhost:9051 --tlsRootCertFiles $PEER_CAFE_TLS \
  -c '{"function":"Redeem","Args":["12345678A","30","Desayuno completo"]}'
```

### 7.6 Verificar saldo y historial

```bash
peer chaincode query -C fidelity-channel -n fidelitypoints \
  -c '{"Args":["BalanceOf","12345678A"]}'
# Resultado: 70

peer chaincode query -C fidelity-channel -n fidelitypoints \
  -c '{"Args":["ClientHistory","12345678A"]}'
# Resultado: array con 2 transacciones (mint + redeem)

peer chaincode query -C fidelity-channel -n fidelitypoints \
  -c '{"Args":["GetTokenInfo"]}'
# Resultado: totalSupply=100, totalRedeemed=30
```

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `tls: failed to verify certificate` | Certificado no incluye localhost en SANS | Regenerar certs con SANS en crypto-config.yaml |
| `core config file not found` | Falta FABRIC_CFG_PATH | `export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config` |
| `access denied` en Mint | Estas como CafeteriaMSP intentando emitir | Cambia las variables al Hotel |
| `chaincode not found` | No se ha hecho commit | Verificar con `querycommitted` |
| `MVCC_READ_CONFLICT` | Dos transacciones concurrentes | Reintentar la transacción |

---

**Anterior:** [03 - Chaincode](03-chaincode.md)
**Siguiente:** [05 - Aplicación cliente](05-aplicación-cliente.md)
