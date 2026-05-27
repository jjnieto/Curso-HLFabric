# DistribuTech — Solución

Red Hyperledger Fabric con 3 organizaciones (Fabricante, Mayorista, Minorista), 3 canales y 3 chaincodes.

## Requisitos

- Linux o WSL2
- Docker y Docker Compose v2
- Go >= 1.21
- Binarios de Fabric (`peer`, `configtxgen`, `osnadmin`, `fabric-ca-client`) en el `PATH`

## Quickstart

### 1. Obtener solo esta carpeta

Si no quieres clonar el repo entero, tienes dos opciones:

**Opción A — tarball (rápido, sin `.git`):**

```bash
curl -L https://github.com/jjnieto/Curso-HLFabric/archive/refs/heads/main.tar.gz \
  | tar xz --strip-components=1 Curso-HLFabric-main/mayoristas/solucion
cd mayoristas/solucion
chmod +x scripts/*.sh
```

**Opción B — sparse checkout (mantiene `git pull`):**

```bash
git clone --no-checkout --depth 1 --filter=blob:none \
  https://github.com/jjnieto/Curso-HLFabric.git
cd Curso-HLFabric
git sparse-checkout init --cone
git sparse-checkout set mayoristas/solucion
git checkout main
cd mayoristas/solucion
```

### 2. Instalar Docker

Necesitas Docker Engine + Docker Compose v2. Comprueba primero si ya lo tienes:

```bash
docker --version && docker compose version
```

Si los dos comandos devuelven una versión, salta al paso 3. Si no, instala según tu sistema:

#### Linux (Ubuntu / Debian)

Usa el repositorio oficial de Docker:

```bash
# 1. Quitar versiones viejas (por si acaso)
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $pkg 2>/dev/null
done

# 2. Añadir el repositorio oficial
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# 3. Instalar
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Permitir uso sin sudo (los scripts de Fabric lo necesitan)
sudo usermod -aG docker $USER
newgrp docker

# 5. Verificar
docker run hello-world
```

> En Debian sustituye `ubuntu` por `debian` en las dos URLs de arriba. Para Fedora/RHEL/CentOS y otras distros, sigue las [instrucciones oficiales](https://docs.docker.com/engine/install/).

#### macOS

Instala **Docker Desktop for Mac** (incluye Compose v2):

- **Apple Silicon (M1/M2/M3)**: [Docker Desktop for Mac with Apple Silicon](https://desktop.docker.com/mac/main/arm64/Docker.dmg)
- **Intel**: [Docker Desktop for Mac with Intel chip](https://desktop.docker.com/mac/main/amd64/Docker.dmg)

O con Homebrew:

```bash
brew install --cask docker
open /Applications/Docker.app
```

Asegúrate de abrir Docker Desktop al menos una vez para que arranque el daemon.

#### Windows

**Importante**: en Windows, los scripts de Fabric **deben ejecutarse desde WSL2** (Ubuntu), no desde PowerShell ni cmd.

1. Activar WSL2 con Ubuntu (PowerShell como administrador):
   ```powershell
   wsl --install -d Ubuntu
   ```
   Reinicia y abre la terminal de Ubuntu que aparece en el menú de inicio.

2. Instalar **Docker Desktop for Windows** (incluye Compose v2): [Docker Desktop installer](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe).

3. En Docker Desktop → Settings → Resources → WSL Integration, **activa la integración con tu Ubuntu**.

4. Reinicia la terminal de Ubuntu y comprueba:
   ```bash
   docker --version && docker compose version
   ```

A partir de aquí, todos los comandos del README los ejecutas dentro de la terminal de **Ubuntu (WSL2)**.

### 3. Tener los binarios de Fabric disponibles

Comprueba primero si ya los tienes en el PATH:

```bash
which peer configtxgen osnadmin fabric-ca-client
```

- **Si los cuatro comandos devuelven una ruta**, ya estás listo. Asegúrate también de tener `FABRIC_CFG_PATH` apuntando al directorio `config/` (donde vive `core.yaml`):
  ```bash
  # Busca core.yaml cerca de los binarios
  find / -name core.yaml 2>/dev/null | head -5
  export FABRIC_CFG_PATH=/ruta/al/directorio/config
  ```

- **Si no los tienes**, descárgalos con el instalador oficial de Fabric:
  ```bash
  curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
  chmod +x install-fabric.sh
  # 'binary' descarga peer/configtxgen/osnadmin/fabric-ca-client
  # 'docker' descarga las imágenes (peer, orderer, ca, ccenv, baseos)
  ./install-fabric.sh --fabric-version 2.5.9 --ca-version 1.5.7 binary docker
  # Esto crea ./bin y ./config en el directorio actual

  export PATH="$(pwd)/bin:$PATH"
  export FABRIC_CFG_PATH="$(pwd)/config"
  ```

  Si ya lo ejecutaste con solo `binary`, descarga las imágenes ahora:
  ```bash
  docker pull hyperledger/fabric-peer:2.5
  docker pull hyperledger/fabric-orderer:2.5
  docker pull hyperledger/fabric-ca:1.5
  docker pull hyperledger/fabric-ccenv:2.5       # build env de chaincodes
  docker pull hyperledger/fabric-baseos:2.5      # runtime de chaincodes
  docker pull couchdb:3.3
  ```

Verifica que todo está en su sitio:

```bash
peer version           # debe imprimir 2.5.x
fabric-ca-client version
ls "$FABRIC_CFG_PATH/core.yaml"
```

### 4. Instalar Go

El script de despliegue de chaincodes hace `go mod tidy && go mod vendor` localmente, así que necesitas Go >= 1.21. Comprueba si lo tienes:

```bash
go version
```

Si no:

#### Linux (Ubuntu / Debian)

```bash
sudo apt-get update
sudo apt-get install -y golang-go
```

Ubuntu 24.04 trae Go 1.22 en sus repos (compatible). Si necesitas una versión más nueva, descarga el tarball oficial de [go.dev/dl](https://go.dev/dl/).

#### macOS

```bash
brew install go
```

#### Windows (WSL2)

Lo mismo que Linux, ejecutado en la terminal de Ubuntu (WSL2):

```bash
sudo apt-get update
sudo apt-get install -y golang-go
```

### 5. Levantar la red

```bash
bash scripts/01-setup-cas.sh          # 4 CAs + identidades
bash scripts/02-build-msps.sh         # Construye organizations/
bash scripts/03-start-network.sh      # Orderer + 3 peers + 3 CouchDBs
bash scripts/04-create-channels.sh    # 3 canales + peer join
bash scripts/05-deploy-chaincodes.sh  # 3 chaincodes (4 despliegues)

# Verificar que todo funciona
bash scripts/sanity-check.sh          # 9 fases de comprobación
```

## Canales y chaincodes

| Canal | Organizaciones | Chaincode | Política de endoso |
|-------|----------------|-----------|-------------------|
| canal-trazabilidad | Fabricante, Mayorista, Minorista | cc-producto | OR (+ ACL en chaincode) |
| canal-trazabilidad | Fabricante, Mayorista, Minorista | cc-garantia | OR (+ ACL en chaincode) |
| canal-mayorista | Fabricante, Mayorista | cc-pedido | AND bilateral |
| canal-minorista | Mayorista, Minorista | cc-pedido | AND bilateral |

## Puertos

| Servicio | Puerto |
|----------|--------|
| peer0.fabricante | 7051 |
| peer0.mayorista | 9051 |
| peer0.minorista | 11051 |
| orderer | 7050 (admin: 7053) |
| CA fabricante | 7054 |
| CA mayorista | 8054 |
| CA minorista | 9054 |
| CA orderer | 10054 |
| CouchDB fabricante | 5984 |
| CouchDB mayorista | 7984 |
| CouchDB minorista | 9984 |

## Verificación (sanity check)

Tras ejecutar los scripts 01 a 05, comprueba que todo está operativo:

```bash
bash scripts/sanity-check.sh
```

El script ejecuta 9 fases:

1. Contenedores Docker (11 esperados) en estado `running`
2. 12 puertos TCP accesibles
3. Las 4 CAs responden por HTTPS
4. Los 3 CouchDB responden
5. Material criptográfico: certs TLS, claves y MSPs de peers, orderer y admins
6. Orderer unido a los 3 canales
7. Cada peer está en sus canales correctos
8. Los 4 despliegues de chaincode están commiteados
9. Test end-to-end: registrar producto, consultar desde otra org, transferir custodia, verificar trazabilidad y test de control de acceso (ACL)

Salida: contadores PASS / WARN / FAIL. Exit code 0 si 0 errores.

## Actualizar un chaincode

Fabric soporta upgrade de chaincodes en caliente vía el lifecycle. Para actualizar **un solo chaincode** sin tocar los demás:

```bash
bash scripts/upgrade-chaincode.sh cc-producto
```

El script:
1. Consulta la versión y secuencia actuales en el canal con `peer lifecycle chaincode querycommitted`.
2. Bumpa la versión minor (1.0 → 1.1) y la secuencia (+1).
3. Empaqueta, instala en los 3 peers, aprueba con cada org del canal y commitea.
4. Para `cc-pedido` lo hace en sus dos canales (mayorista y minorista).

Puedes forzar versión o secuencia concretas:

```bash
NEW_VERSION=2.0 NEW_SEQUENCE=5 bash scripts/upgrade-chaincode.sh cc-garantia
```

## Limpiar todo

```bash
bash scripts/99-clean-all.sh
```

## Estructura

```
solucion/
├── network/
│   ├── configtx.yaml                    # 3 perfiles de canal
│   ├── docker/
│   │   ├── docker-compose-ca.yaml       # 4 Fabric CAs
│   │   └── docker-compose-net.yaml      # orderer + 3 peers + 3 CouchDBs
│   ├── fabric-ca/{fabricante,mayorista,minorista,orderer}/
│   ├── organizations/                   # (generado)
│   └── channel-artifacts/               # (generado)
├── chaincode/
│   ├── cc-producto/producto.go          # Registro y trazabilidad
│   ├── cc-garantia/garantia.go          # Garantías y reclamaciones
│   └── cc-pedido/pedido.go              # Pedidos (genérico, 2 despliegues)
└── scripts/
    ├── common.sh
    ├── 01-setup-cas.sh
    ├── 02-build-msps.sh
    ├── 03-start-network.sh
    ├── 04-create-channels.sh
    ├── 05-deploy-chaincodes.sh
    ├── upgrade-chaincode.sh
    ├── sanity-check.sh
    └── 99-clean-all.sh
```
