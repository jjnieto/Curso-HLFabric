# FidelityChain — Quick deploy (solo profesor)

Proyecto del Módulo 6: programa de fidelización descentralizado entre **Hotel** y **Cafetería**, con un token `FidelityPoints` (FP) emitido por el hotel y canjeable en la cafetería.

> Esta guía es el **camino rápido** para tener el proyecto funcionando en minutos. El alumno construye todo a mano siguiendo los `01..07` `.md` del Módulo 6 (en el directorio padre), donde se explica el **porqué** de cada decisión. Los scripts y este README son solo para **demos del profesor** o para iterar rápido sobre la app cliente sin reconstruir la red.

## Arquitectura en una frase

3 organizaciones (`Hotel`, `Cafeteria`, `Orderer`), 1 canal (`fidelity-channel`), chaincode `fidelitypoints` en Go con 6 funciones (RegisterClient, Mint, Redeem, BalanceOf, ClientHistory, GetTokenInfo, GetAllClients), política de endorsement por defecto del canal (`MAJORITY` = ambas orgs).

| Pieza | Endpoint |
|------|----------|
| Orderer | `localhost:7050` (admin: `7053`) |
| peer0.hotel | `localhost:7051` |
| peer0.cafeteria | `localhost:9051` |
| CouchDB hotel | `localhost:5984` |
| CouchDB cafeteria | `localhost:7984` |

Material crypto generado con **cryptogen** (no Fabric CA), todo on-disk en `network/crypto-config/`.

## Obtener el proyecto (sin clonar el repo entero)

> Todo lo que viene después asume que tienes esta carpeta en local. **No hace
> falta clonar el repo completo del curso** (los seis módulos, slides, PDFs…):
> con un *sparse checkout* te bajas solo `proyecto-fidelitychain`.

Solo necesitas `git` (compruébalo con `git --version`). El repo del curso es
privado, así que el `clone` te pedirá tus credenciales de GitHub.

```bash
# 1. Clona los metadatos, sin descargar archivos todavía.
#    Lo clonamos a la carpeta "fidelitychain" (no "fabric") para no chocar
#    con un posible ~/fabric donde tengas los binarios de Fabric.
git clone --filter=blob:none --sparse https://github.com/jjnieto/fabric.git fidelitychain
cd fidelitychain

# 2. Materializa SOLO la carpeta del proyecto (nada del resto de módulos)
git sparse-checkout set "docs/Modulo 6/proyecto-fidelitychain"

# 3. Sitúate dentro: desde aquí funcionan todos los comandos de esta guía
cd "docs/Modulo 6/proyecto-fidelitychain"
```

`--filter=blob:none` evita descargar el contenido del resto del repo y `--sparse`
arranca con el árbol de trabajo vacío; `git sparse-checkout set` trae al disco
únicamente el proyecto. (Si algún día quieres otra carpeta, añádela con otro
`git sparse-checkout set ...`.)

## Prerequisitos

Necesitas **Linux o WSL2** con estas cuatro herramientas:

- Docker + Docker Compose v2
- Node.js >= 18
- Go >= 1.21
- Binarios de Fabric (`peer`, `configtxgen`, `cryptogen`, `osnadmin`) en el `PATH`

### Paso 0 — Comprueba qué tienes ya

Pega este bloque en la terminal: te dice de un vistazo qué está instalado y qué falta.

```bash
echo "== Docker =="     && docker --version          || echo "  FALTA Docker"
echo "== Compose v2 ==" && docker compose version     || echo "  FALTA Docker Compose v2"
echo "== Daemon ==" && docker ps >/dev/null 2>&1 && echo "  Docker en marcha" || echo "  Docker NO responde (arráncalo)"
echo "== Node ==" && node --version || echo "  FALTA Node.js"
echo "== Go ==" && go version || echo "  FALTA Go"
echo "== Fabric ==" && peer version | head -n 2 || echo "  FALTAN los binarios de Fabric"
for b in peer configtxgen cryptogen osnadmin; do command -v $b >/dev/null && echo "  OK $b" || echo "  FALTA $b"; done
```

Salida esperada cuando está todo: `Docker version 24+`, `Docker Compose version v2+`, `Docker en marcha`, `v18` o superior en Node, `go1.21` o superior, `peer: Version: 2.5.x` y un `OK` por cada uno de los cuatro binarios de Fabric. **Solo instala lo que aparezca como `FALTA`.**

### Si falta Docker / Docker Compose v2

```bash
# Ubuntu/Debian (y WSL2 con Docker Desktop apagado)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # añade tu usuario al grupo docker
newgrp docker                   # aplica el grupo sin reabrir sesión
docker compose version          # Compose v2 ya viene como plugin
```

En WSL2 lo más cómodo es instalar **Docker Desktop** en Windows con la integración WSL activada; entonces `docker` ya está disponible dentro de WSL sin más.

### Si falta Node.js (necesitas >= 18)

```bash
# Vía nvm (recomendado: no toca el Node del sistema y fija la versión)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18 && nvm use 18
node --version    # debe imprimir v18.x
```

> `fabric-network` arrastra una dependencia nativa (`pkcs11js`); con **Node 18 LTS** compila sin sorpresas. En Node 20+ a veces falla el build, por eso fijamos la 18.

### Si falta Go (necesitas >= 1.21)

```bash
GO_VER=1.21.13
curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-amd64.tar.gz" -o /tmp/go.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf /tmp/go.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc
go version    # debe imprimir go1.21.x
```

### Si faltan los binarios de Fabric

```bash
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary
export PATH=$PWD/bin:$PATH
export FABRIC_CFG_PATH=$PWD/config
```

Para que el `PATH` y `FABRIC_CFG_PATH` persistan entre terminales, añádelos a tu `~/.bashrc` (ajustando la ruta absoluta donde se hayan descargado `bin/` y `config/`).

`FABRIC_CFG_PATH` lo detectan los scripts automáticamente si lo dejas en el entorno o si los binarios están en una ruta típica (`$HOME/fabric/fabric-samples`, `$HOME/practica01`, etc.).

### Vuelve a comprobar

Repite el bloque del **Paso 0**. Cuando no aparezca ningún `FALTA`, ya puedes seguir con el Quickstart.

## Quickstart

Desde el directorio del proyecto (donde te dejó el paso _Obtener el proyecto_:
`fidelitychain/docs/Modulo 6/proyecto-fidelitychain`):

```bash
# 1. Levantar red + canal + peers unidos
bash scripts/start-network.sh

# 2. Empaquetar, instalar, aprobar, commitear chaincode + InitLedger
bash scripts/deploy-chaincode.sh

# 3. Arrancar la app cliente del Hotel
cd application
npm install
node hotel-app.js                # crea cliente y emite puntos

# 4. Arrancar la app cliente de la Cafetería
node cafeteria-app.js            # canjea puntos
```

Si todo va bien, el `deploy-chaincode.sh` acaba con un `peer lifecycle chaincode querycommitted` mostrando `fidelitypoints v1.0` aprobado por las dos orgs y un evento `InitLedger` exitoso.

## Estructura

```
proyecto-fidelitychain/
├── network/
│   ├── crypto-config.yaml           # config para cryptogen
│   ├── configtx.yaml                # canal fidelity-channel
│   ├── docker/
│   │   └── docker-compose.yaml      # orderer + 2 peers + 2 CouchDBs + cli
│   ├── crypto-config/               # (generado) MSPs y TLS
│   └── channel-artifacts/           # (generado) bloque génesis
│
├── chaincode/
│   └── chaincode-go/
│       ├── go.mod
│       └── fidelitypoints.go        # 6 funciones + InitLedger
│
├── scripts/
│   ├── common.sh                    # variables y helpers compartidos
│   ├── start-network.sh             # red + canal + peer join (idempotente)
│   ├── deploy-chaincode.sh          # lifecycle completo + InitLedger
│   ├── stop-network.sh              # pausa, mantiene estado
│   ├── restart-network.sh           # reanuda tras stop
│   └── clean-all.sh                 # tear-down total
│
└── application/
    ├── hotel-app.js                 # registra cliente + Mint
    ├── cafeteria-app.js             # Redeem
    ├── utils/
    │   └── fabric-connection.js
    └── package.json                 # (no incluido — créalo si npm install no encuentra)
```

## Re-deploy del chaincode

Si tocas `fidelitypoints.go` y quieres redesplegar sin tirar la red:

```bash
CHAINCODE_VERSION=1.1 CHAINCODE_SEQUENCE=2 bash scripts/deploy-chaincode.sh
```

Las variables `CHAINCODE_VERSION` y `CHAINCODE_SEQUENCE` se respetan desde el entorno (default `1.0` y `1`). Para re-deploys posteriores incrementa `CHAINCODE_SEQUENCE` (`3`, `4`, ...) y la versión por convención.

El script omite `InitLedger` automáticamente cuando `CHAINCODE_SEQUENCE > 1`, así que no se reinicia el `TokenInfo`.

## Parar, reanudar y limpiar

Tres niveles, de menos a más destructivo:

### Nivel 1 — Pausa rápida (mantiene todo el estado)

```bash
bash scripts/stop-network.sh    # docker compose stop
# ...más tarde:
bash scripts/restart-network.sh # docker compose start
```

Documentos, balances, transacciones y chaincode commiteado se conservan tal cual.

### Nivel 2 — Borrar contenedores y volúmenes pero guardar el material crypto

```bash
docker compose -f network/docker/docker-compose.yaml down -v
# ...para volver:
bash scripts/start-network.sh   # detecta certs existentes, no los regenera
bash scripts/deploy-chaincode.sh
```

Pierdes el ledger pero conservas `network/crypto-config/`. `start-network.sh` es idempotente: si la carpeta `crypto-config/` ya existe, no la regenera, así que las identidades (MSPs, certs TLS) son las mismas.

### Nivel 3 — Tear-down total

```bash
bash scripts/clean-all.sh
# ...para reconstruir todo:
bash scripts/start-network.sh
bash scripts/deploy-chaincode.sh
```

Tira contenedores, volúmenes Docker, contenedores efímeros del chaincode (`dev-peer0.*`), `crypto-config/`, bloque génesis y `vendor/` del chaincode.

### Resumen

| Quieres... | Comando |
|------------|---------|
| Apagar y seguir mañana | `bash scripts/stop-network.sh` (nivel 1) |
| Reanudar tras stop | `bash scripts/restart-network.sh` |
| Liberar disco sin perder identidades | `docker compose ... down -v` (nivel 2) |
| Empezar de cero | `bash scripts/clean-all.sh` (nivel 3) |

## Troubleshooting

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `cryptogen: command not found` | Binarios de Fabric no en el PATH | Sigue Prerequisitos arriba |
| `Orderer admin no responde tras 30 intentos` | El contenedor del orderer crashea al arrancar | `docker logs orderer.fidelitychain.com` para ver el error real |
| `peer channel join: TLS handshake failed: EOF` (los primeros segundos) | Peer aún arrancando | Es esperado: el script reintenta hasta 30 s |
| `peer channel join: x509: certificate signed by unknown authority` | `CORE_PEER_TLS_ROOTCERT_FILE` mal | Re-ejecuta `start-network.sh` (las variables las setea él) |
| `chaincode "fidelitypoints" not found` al hacer invoke | El chaincode no se ha commiteado | `bash scripts/deploy-chaincode.sh` |
| `endorsement policy failure` | Una de las peers está caída | `docker ps` y revisa que las dos orgs están arriba |
| `InitLedger` se queja de `tokenInfo already exists` | Ya estaba inicializado | Es seguro ignorar — el chaincode usa `PutState` que sobrescribe |
| `npm install` en application/ no encuentra `package.json` | Falta crear el package.json para las apps | Ver instrucciones en `application/utils/fabric-connection.js` o `05-aplicacion-cliente.md` |
| Todo está en un estado raro y no sé qué tocar | — | `bash scripts/clean-all.sh` y vuelve a empezar |

## Diferencia con el material didáctico

| Material | Para quién | Qué hace |
|----------|-----------|----------|
| `01..07-*.md` (en `docs/Modulo 6/`) | Alumno | Explica decisiones paso a paso. El alumno construye los archivos a mano. |
| Este `proyecto-fidelitychain/` con scripts y este README | Profesor (demo, iteración rápida) | Todo el código real listo para arrancar de un tirón. |

Los `.md` siguen siendo la **referencia canónica del porqué**; este directorio es el **cómo automatizado**. No tocar los `.md` salvo para corregir errores conceptuales.
