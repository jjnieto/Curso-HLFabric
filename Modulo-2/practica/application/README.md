# SignChain — Aplicación cliente

App Node.js que usa el Fabric Gateway SDK para crear, firmar y verificar documentos contra el chaincode `signchain`.

> El **diseño detallado**, la teoría y las **respuestas a las preguntas guía** están en [`../solucion-05-cliente-y-pruebas.md`](../solucion-05-cliente-y-pruebas.md). Este README es solo la guía rápida para **compilar, configurar y ejecutar** el código.

---

## Guía rápida de instalación (con scripts)

La app cliente es el **último paso** de la práctica. Esta guía te lleva de un repo recién clonado a la app funcionando usando los **scripts automatizados** de `practica/scripts/`. Si prefieres montar la red **a mano** comando por comando, sigue los `solucion-XX.md` en lugar de esta guía.

> Todos los `bash scripts/...` se ejecutan **desde `Modulo-2/practica/`** (un nivel por encima de este directorio), no desde `application/`.

### Paso 0 — Prerequisitos del sistema

Necesitas en el host:

- **Docker** (>= 20) y **Docker Compose v2** corriendo
- **Node.js >= 18** y **npm >= 9**
- **Go** (>= 1.21)
- Binarios de Fabric (`peer`, `configtxgen`, `osnadmin`, `fabric-ca-client`) en el `PATH`

Si todavía no los tienes, descárgalos con el script oficial:

```bash
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary
export PATH=$PWD/bin:$PATH
export FABRIC_CFG_PATH=$PWD/config
```

Verifica:

```bash
peer version
configtxgen --version
fabric-ca-client version
```

### Paso 1 — Clonar y entrar en `practica/`

```bash
git clone https://github.com/jjnieto/Curso-HLFabric.git
cd Curso-HLFabric/Modulo-2/practica
```

Todos los scripts (`01..04`, `99`) se invocan desde aquí.

### Paso 2 — CAs e identidades

```bash
bash scripts/01-setup-cas.sh
```

Levanta las 3 Fabric CAs (Cliente, Proveedor, Orderer), enrolla el admin bootstrap de cada una y registra/enrolla `peer0` + admin de cada org. Genera todo el material crypto en `network/fabric-ca/`.

### Paso 3 — Construir los MSPs

```bash
bash scripts/02-build-msps.sh
```

Reorganiza los certificados de las CAs en la estructura que Fabric espera: `network/organizations/{peer,orderer}Organizations/...` con MSPs locales del peer/orderer y del admin, más TLS de cada peer.

### Paso 4 — Red, canal y unión de peers

```bash
bash scripts/03-start-network.sh
```

Genera el bloque génesis con `configtxgen`, levanta orderer + 2 peers + 2 CouchDBs con `docker compose`, llama a `osnadmin channel join` en el orderer y hace `peer channel join` con los dos peers. Al terminar tienes el canal `signchain-channel` operativo.

Comprueba que están los 8 contenedores (3 CAs + orderer + 2 peers + 2 CouchDBs):

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' \
  | grep -E 'orderer|peer|couchdb|ca\.'
```

### Paso 5 — Chaincode `signchain`

```bash
bash scripts/04-deploy-chaincode.sh
```

Hace el lifecycle completo: `go mod vendor` → `package` → `install` en cada peer → `approveformyorg` por cada org → `checkcommitreadiness` → `commit` con política `AND('ClienteMSP.peer','ProveedorMSP.peer')`.

### Paso 6 — App cliente (estás aquí)

```bash
cd application
npm install

# Apunta a la red del repo (no a $HOME/signchain)
export SIGNCHAIN_NETWORK_PATH="$(cd .. && pwd)/network"

npm run check        # sanity check: te dice si todo lo anterior está bien
```

Si el sanity check sale en verde, salta a la sección **Uso** más abajo para crear, firmar y consultar documentos.

### Resumen visual

```
[ Paso 0 ] Docker + Node + Go + binarios de Fabric en el PATH
    |
[ Paso 1 ] git clone && cd Modulo-2/practica
    |
[ Paso 2 ] bash scripts/01-setup-cas.sh        --> 3 CAs + identidades enrolladas
    |
[ Paso 3 ] bash scripts/02-build-msps.sh       --> organizations/ con MSPs
    |
[ Paso 4 ] bash scripts/03-start-network.sh    --> red + canal + peer join
    |
[ Paso 5 ] bash scripts/04-deploy-chaincode.sh --> signchain commiteado
    |
[ Paso 6 ] cd application && npm install       --> APP LISTA
           export SIGNCHAIN_NETWORK_PATH=...
           npm run check
```

Si algo falla a medias, `npm run check` del paso 6 te dirá dónde — los bloques 2, 3 y 4 del sanity check se corresponden con los pasos 3, 4 y 5 de esta guía.

### Empezar de cero

Si te has equivocado o quieres reiniciar:

```bash
cd Modulo-2/practica
bash scripts/99-clean-all.sh    # baja contenedores, borra volúmenes y MSPs generados
bash scripts/01-setup-cas.sh    # ...y vuelve a empezar
```

### Frontend web (opcional)

Si prefieres operar desde el navegador (selector de rol, drag-and-drop, badges de estado), hay un frontend en [`web/`](web/):

```bash
cd web
npm install
export SIGNCHAIN_NETWORK_PATH="$(cd ../.. && pwd)/network"
npm start                       # http://localhost:3000
```

Reusa los mismos `utils/` que los CLI, así que las transacciones que lances desde la web son indistinguibles de las que lances con `node crear-documento.js`. Detalle en [`web/README.md`](web/README.md).

---

## Requisitos previos (resumen)

| | Mínimo |
|---|---|
| Node.js | 18 LTS |
| npm | 9+ |
| Red SignChain levantada | Sí (paso 3 arriba) |
| Chaincode `signchain` desplegado y commiteado | Sí (paso 4 arriba) |

## Estructura

```
application/
├── package.json
├── sanity-check.js             # Comprueba todo el entorno antes de empezar
├── crear-documento.js          # Cliente crea un documento nuevo
├── firmar-documento.js         # Cliente o Proveedor firman un documento
├── consultar-documento.js      # Lee + verifica hash y firmas
├── utils/
│   ├── fabric-connection.js    # Conexión al Gateway (lee cert+key del MSP)
│   └── crypto.js               # SHA-256, ECDSA sign/verify, certID
├── docs/                       # PDFs u otros documentos a firmar (vacío en git)
└── README.md
```

## Instalación

```bash
cd Modulo-2/practica/application
npm install
```

Esto baja `@hyperledger/fabric-gateway` y `@grpc/grpc-js`. No genera lockfile en git (cada alumno regenera el suyo).

## Configuración

La app necesita saber dónde están los certificados de la red para conectar al Gateway. Lo controla la variable **`SIGNCHAIN_NETWORK_PATH`**.

Si has seguido la guía rápida y la red vive en este mismo repo:

```bash
# Desde practica/application/
export SIGNCHAIN_NETWORK_PATH="$(cd .. && pwd)/network"
```

Si tienes la red en otra ruta (p. ej. la montaste a mano siguiendo los `.md` en `$HOME/signchain`):

```bash
# Linux / WSL / macOS
export SIGNCHAIN_NETWORK_PATH=$HOME/signchain/network

# PowerShell
$env:SIGNCHAIN_NETWORK_PATH = "C:\ruta\a\signchain\network"
```

Si no defines la variable, la app cae al default `$HOME/signchain/network`.

La conexión usa, para cada org:

| Org | MSP ID | Endpoint peer | TLS host alias |
|-----|--------|---------------|----------------|
| Cliente   | `ClienteMSP`   | `localhost:7051` | `peer0.cliente.signchain.com`   |
| Proveedor | `ProveedorMSP` | `localhost:9051` | `peer0.proveedor.signchain.com` |

Si cambias puertos o dominios en tu red, edita `utils/fabric-connection.js` (objeto `ORG_CONFIG`).

## Sanity check (úsalo siempre lo primero)

Antes de crear o firmar nada, ejecuta el chequeo. Comprueba en orden:

1. **Requisitos locales**: versión de Node, `node_modules` instalado, paquetes de Fabric.
2. **Material criptográfico**: signcert + clave privada del Admin de cada org y `tls/ca.crt` del peer.
3. **Conectividad TCP**: orderer y peers (obligatorios), CouchDBs y CAs (opcionales).
4. **Conexión Fabric real**: abre el Gateway con cada org y ejecuta `GetAllDocuments`. Esto valida en una sola llamada que el TLS funciona, que el MSP es correcto y que el chaincode `signchain` está commiteado en `signchain-channel`.

### Ejecución

```bash
npm run check
# o, con más detalle (rutas absolutas de cada archivo verificado)
node sanity-check.js --verbose
# si quieres saltar el bloque 4 (p. ej. el chaincode aún no se ha desplegado)
node sanity-check.js --skip-fabric
```

Códigos de salida: `0` OK (con o sin avisos), `1` errores, `2` excepción no controlada.

### Salida esperada — todo correcto

```
SignChain — sanity check
  [INFO]  Network root: /home/alumno/signchain/network
  [INFO]  SIGNCHAIN_NETWORK_PATH no definido, usando ruta por defecto.

1. Requisitos locales
  [OK]    Node.js 20.11.0
  [OK]    node_modules instalado
  [OK]    package.json
  [OK]    @hyperledger/fabric-gateway
  [OK]    @grpc/grpc-js

2. Material criptográfico de las orgs
  cliente (ClienteMSP)
  [OK]      carpeta de la org
  [OK]      signcert del admin
  [OK]      keystore del admin
  [OK]      TLS root cert del peer
  proveedor (ProveedorMSP)
  [OK]      carpeta de la org
  [OK]      signcert del admin
  [OK]      keystore del admin
  [OK]      TLS root cert del peer

3. Conectividad TCP a los servicios
  [OK]    orderer.signchain.com (localhost:7050)
  [OK]    peer0.cliente   (localhost:7051)
  [OK]    peer0.proveedor (localhost:9051)
  [OK]    CouchDB Cliente   (localhost:5984)
  [OK]    CouchDB Proveedor (localhost:7984)
  [OK]    CA Cliente   (localhost:7054)
  [OK]    CA Proveedor (localhost:8054)
  [OK]    CA Orderer   (localhost:9054)

4. Conexión Fabric (gRPC + TLS + endorsement read-only)
  [OK]    Query GetAllDocuments como cliente (0 documento(s) en el ledger)
  [OK]    Query GetAllDocuments como proveedor (0 documento(s) en el ledger)

Resumen
  Errores: 0
  Avisos:  0

Resultado: OK — todo listo para ejecutar la práctica.
```

### Cómo interpretar fallos típicos

| Salida | Causa probable | Cómo arreglarlo |
|--------|----------------|-----------------|
| `[FAIL] node_modules instalado` | No has corrido `npm install` | `npm install` |
| `[FAIL] signcert del admin — directorio vacío` | El MSP no se construyó del todo | Re-ejecuta `bash ../scripts/01-setup-cas.sh && bash ../scripts/02-build-msps.sh` |
| `[FAIL] orderer.signchain.com (localhost:7050)` | Contenedor caído o red sin levantar | `bash ../scripts/03-start-network.sh` (o `docker compose -f ../network/docker/docker-compose-net.yaml up -d` si la red ya está creada) |
| `[FAIL] peer0.cliente (localhost:7051)` | Peer no arrancado o usando otro puerto | `docker logs peer0.cliente.signchain.com` |
| `[WARN] CouchDB Cliente` | Estás usando LevelDB o el contenedor está parado | Solo es WARN: la app funciona igual |
| `[WARN] CA Cliente` | CAs paradas tras el setup inicial | Solo es WARN: las CAs no se necesitan en runtime |
| `[FAIL] Query GetAllDocuments — chaincode "signchain" not found` | Chaincode no commiteado | `bash ../scripts/04-deploy-chaincode.sh` |
| `[FAIL] Query GetAllDocuments — endorsement policy failure` | Una de las dos peers no firma (caída o MSP roto) | Verifica que las DOS peers están arriba con `docker ps` |
| `[WARN] Saltando la conexión Fabric porque hay errores previos` | Hay fallos en bloques 1-3 | Arregla esos primero |
| Todo falla y no sabes por dónde tirar | Red en estado inconsistente | `bash ../scripts/99-clean-all.sh` y vuelve a empezar desde `01-setup-cas.sh` |

## Uso

### 1. Preparar un documento de prueba

```bash
echo "Este es el contrato de prueba versión 1" > docs/contrato.pdf
```

Sirve cualquier archivo (PDF, txt, lo que sea): solo nos interesa su hash.

### 2. Crear el documento (Cliente)

```bash
npm run create -- DOC-001 ./docs/contrato.pdf "Contrato 2026" "Servicios profesionales"
```

Equivale a:

```bash
node crear-documento.js DOC-001 ./docs/contrato.pdf "Contrato 2026" "Servicios profesionales"
```

### 3. Firmar (Cliente, después Proveedor)

```bash
node firmar-documento.js cliente   DOC-001 ./docs/contrato.pdf
node firmar-documento.js proveedor DOC-001 ./docs/contrato.pdf
```

### 4. Consultar y verificar

```bash
node consultar-documento.js DOC-001 ./docs/contrato.pdf
```

Salida esperada con dos firmas válidas:

```
Documento:
  ID:          DOC-001
  Estado:      fully-approved
  Firmas:      2

Verificación de hash:
  Coinciden:   SÍ

Verificación de firmas:
  ClienteMSP: VÁLIDA   (firmado en 2026-...)
  ProveedorMSP: VÁLIDA (firmado en 2026-...)
```

## Casos de error útiles para probar

| Caso | Cómo provocarlo | Error esperado |
|------|-----------------|----------------|
| Doble firma | Firmar dos veces con la misma org | `la organización X ya ha firmado este documento` |
| Documento manipulado | Modificar `contrato.pdf` y firmar | `el hash del ledger NO coincide con el local` |
| Crear con Proveedor | Cambiar `'cliente'` por `'proveedor'` en `crear-documento.js` | rechazo del chaincode (solo Cliente crea) |
| Cancelar tras `fully-approved` | Invocar `CancelDocument` desde un script propio | `el documento ya está aprobado totalmente` |

## Resolución de problemas

**`ENOENT: no such file or directory, .../users/Admin@.../msp/signcerts`**
Tu red no está montada o `SIGNCHAIN_NETWORK_PATH` apunta a una ruta incorrecta. Comprueba `ls $SIGNCHAIN_NETWORK_PATH/organizations/peerOrganizations`.

**`Failed to connect before the deadline`**
El peer no responde. Verifica con `docker logs peer0.cliente.signchain.com` que está arrancado y escuchando en `7051`.

**`DESCRIPTOR_VERIFY_FAILED` o errores de TLS**
El cert TLS del peer no incluye el host con el que conectas. Lo que firma la práctica es `peer0.cliente.signchain.com` con SAN `localhost`. Si cambiaste el dominio, regenera con esos SANs (ver `solucion-02-fabric-ca.md`).

**`endorsement policy failure`**
La política es `AND(Cliente, Proveedor)`. Las dos peers tienen que estar arriba durante el `submitTransaction`. Si tiras una, el endorsement falla.

## Limpieza

Solo dependencias de Node:

```bash
rm -rf node_modules package-lock.json
```

Tear-down completo (red + MSPs + estado on-chain):

```bash
cd ..                          # a practica/
bash scripts/99-clean-all.sh
```

Esto baja todos los contenedores (CAs y red), borra volúmenes Docker, MSPs construidos, bloque génesis y vendor del chaincode. La estructura del repo queda intacta y puedes volver a empezar con `bash scripts/01-setup-cas.sh`.
