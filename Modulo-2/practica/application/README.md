# SignChain — Aplicación cliente

App Node.js que usa el Fabric Gateway SDK para crear, firmar y verificar documentos contra el chaincode `signchain`.

> El **diseño detallado**, la teoría y las **respuestas a las preguntas guía** están en [`../solucion-05-cliente-y-pruebas.md`](../solucion-05-cliente-y-pruebas.md). Este README es solo la guía rápida para **compilar, configurar y ejecutar** el código.

## Requisitos previos

| | Mínimo |
|---|---|
| Node.js | 18 LTS |
| npm | 9+ |
| Red SignChain levantada | Sí (ver `solucion-02..04`) |
| Chaincode `signchain` desplegado y commiteado | Sí (ver `solucion-04-chaincode.md`) |

Comprueba que tienes la red en marcha antes de ejecutar nada:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'orderer|peer|couchdb|ca\.'
```

Debes ver: `orderer.signchain.com`, `peer0.cliente.signchain.com`, `peer0.proveedor.signchain.com`, dos CouchDB y las tres CAs.

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

Por defecto, los scripts buscan el material criptográfico de la red en:

```
$HOME/signchain/network/organizations/peerOrganizations/...
```

Si tu red está en otra ruta, exporta la variable de entorno **`SIGNCHAIN_NETWORK_PATH`**:

```bash
# Linux / WSL / macOS
export SIGNCHAIN_NETWORK_PATH=/ruta/absoluta/a/signchain/network

# PowerShell
$env:SIGNCHAIN_NETWORK_PATH = "C:\ruta\a\signchain\network"
```

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
| `[FAIL] signcert del admin — directorio vacío` | El MSP no se construyó del todo | Repite los pasos de `solucion-02-fabric-ca.md` |
| `[FAIL] orderer.signchain.com (localhost:7050)` | Contenedor caído o red sin levantar | `docker ps`, luego `docker compose -f network/docker/docker-compose-net.yaml up -d` |
| `[FAIL] peer0.cliente (localhost:7051)` | Peer no arrancado o usando otro puerto | `docker logs peer0.cliente.signchain.com` |
| `[WARN] CouchDB Cliente` | Estás usando LevelDB o el contenedor está parado | Solo es WARN: la app funciona igual |
| `[WARN] CA Cliente` | CAs paradas tras el setup inicial | Solo es WARN: las CAs no se necesitan en runtime |
| `[FAIL] Query GetAllDocuments — chaincode "signchain" not found` | Chaincode no commiteado | Repite `solucion-04-chaincode.md` (approve + commit) |
| `[FAIL] Query GetAllDocuments — endorsement policy failure` | Una de las dos peers no firma (caída o MSP roto) | Verifica que las DOS peers están arriba |
| `[WARN] Saltando la conexión Fabric porque hay errores previos` | Hay fallos en bloques 1-3 | Arregla esos primero |

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

```bash
rm -rf node_modules package-lock.json
```

El estado on-chain se reinicia parando la red y borrando volúmenes (ver `solucion-03-red-y-canal.md`, sección de limpieza).
