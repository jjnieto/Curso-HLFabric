# 01 - Requisitos previos e instalación de Hyperledger Fabric

## Sistemas operativos soportados

- **Linux** (Ubuntu/Debian recomendado)
- **macOS**
- **Windows** (mediante WSL2 — Windows Subsystem for Linux 2)

> **Nota para Windows:** Todo el desarrollo en Fabric se realiza dentro de WSL2.
> No se ejecutan binarios de Fabric nativamente en Windows.

---

## 1. Habilitar WSL2 e instalar Ubuntu (solo Windows)

### 1.1 Instalar WSL2

Abrir PowerShell como administrador:

```powershell
wsl --install
```

Esto instala el subsistema WSL2 y habilita la virtualización. **Reinicia el equipo** cuando se te solicite.

> **Si `wsl --install` falla o no se reconoce el comando**, es posible que necesites habilitar
> primero la característica de Windows manualmente. Ve a **Panel de control → Programas →
> Activar o desactivar las características de Windows** y marca:
> - **Subsistema de Windows para Linux**
> - **Plataforma de máquina virtual**
>
> Reinicia el equipo y vuelve a ejecutar `wsl --install`.

### 1.2 Verificar que WSL2 está listo

Después de reiniciar, abre PowerShell como administrador y ejecuta:

```powershell
wsl --status
```

Debes ver `Versión predeterminada: 2`. Si aparece un error indicando que la **"Plataforma de máquina virtual"** no está habilitada, ejecuta:

```powershell
wsl --install --no-distribution
```

Reinicia de nuevo y vuelve a verificar con `wsl --status`.

### 1.3 Instalar Ubuntu

```powershell
wsl --install -d Ubuntu
```

> **Nota:** En algunas versiones de Windows `wsl --install` instalaba Ubuntu automáticamente.
> En versiones recientes de Windows 11 solo instala el subsistema, por lo que es necesario
> instalar la distribución de forma explícita.

Se te pedirá crear un **usuario y contraseña** para Linux.

Si ya tienes WSL1, asegúrate de usar la versión 2:

```powershell
wsl --set-default-version 2
```

### 1.4 Verificar la instalación

```powershell
wsl --list --verbose
```

Debes ver tu distribución con `VERSION 2`.

---

## 2. Instalar VS Code (solo Windows)

Descarga e instala Visual Studio Code desde [code.visualstudio.com](https://code.visualstudio.com/).

### Verificar la integración con WSL

Abre una terminal de Ubuntu (ejecuta `wsl` desde PowerShell) y ejecuta:

```bash
code .
```

VS Code se abrirá con la extensión **WSL** conectada. Verás abajo a la izquierda `WSL: Ubuntu`. Si la extensión no se instala automáticamente, búscala en el marketplace de extensiones de VS Code (Ctrl+Shift+X) como **WSL**.

---

## 3. Instalar Docker Desktop (solo Windows)

Descarga e instala Docker Desktop desde [docker.com](https://www.docker.com/products/docker-desktop/). Selecciona la versión **Windows AMD64** (la opción correcta para procesadores Intel y AMD).

Docker es **imprescindible**. Fabric ejecuta todos sus componentes (peers, orderers, CAs) como contenedores Docker.

### 3.1 Integrar Docker Desktop con WSL2

Para evitar errores de permisos entre Docker Desktop y WSL2, sigue estos pasos en orden:

1. **Cierra la terminal de Ubuntu** si la tienes abierta.

2. **Apaga WSL** desde PowerShell:

   ```powershell
   wsl --shutdown
   ```

3. **Abre Docker Desktop** y espera a que termine de arrancar.

4. Habilita la integración con Ubuntu en Docker Desktop:

   **Settings → Resources → WSL Integration → Activa el toggle de tu distribución Ubuntu → Apply & Restart**

5. **Abre Ubuntu de nuevo** desde PowerShell:

   ```powershell
   wsl
   ```

### 3.2 Verificar Docker en Ubuntu

Desde la terminal de Ubuntu:

```bash
docker --version
docker compose version
docker run hello-world
```

> **Nota:** Con Docker Desktop integrado en WSL2, no necesitas instalar Docker Engine
> dentro de Linux. Docker Desktop proporciona el comando `docker` directamente.

---

## 4. Instalar prerequisitos del sistema

**A partir de aquí, todos los comandos se ejecutan dentro de la terminal de Linux (WSL2 o nativa).**

### Ubuntu / Debian (o WSL2 con Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y git curl wget jq tree
```

### macOS

```bash
brew install git curl wget jq tree
```

### Verificar versiones

```bash
git --version
curl --version
jq --version
```

---

## 5. Instalar Docker (macOS / Linux nativo)

> **Usuarios de Windows con WSL2:** Si ya instalaste Docker Desktop en el paso 3 y habilitaste
> la integración con WSL2, **salta este paso**. Docker ya está disponible en tu terminal de Ubuntu.

### Ubuntu / Debian (sin Docker Desktop)

```bash
# Eliminar versiones antiguas
sudo apt-get remove -y docker docker-engine docker.io containerd runc

# Instalar dependencias
sudo apt-get update
sudo apt-get install -y ca-certificates gnupg lsb-release

# Añadir clave GPG oficial de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Añadir repositorio
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### macOS

Instalar Docker Desktop desde [docker.com](https://www.docker.com/products/docker-desktop/) o:

```bash
brew install --cask docker
```

### Configurar Docker sin sudo (Linux nativo, sin Docker Desktop)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Verificar Docker

```bash
docker --version
docker compose version
docker run hello-world
```

---

## 6. Instalar Go (opcional pero recomendado)

Necesario si vas a desarrollar chaincodes en Go (el lenguaje más usado en Fabric).

```bash
# Descargar Go (verificar última versión en https://go.dev/dl/)
wget https://go.dev/dl/go1.22.5.linux-amd64.tar.gz

# Instalar
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz

# Configurar PATH (añadir al final de ~/.bashrc o ~/.zshrc)
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### Verificar

```bash
go version
```

---

## 7. Instalar Node.js (opcional)

Necesario si vas a desarrollar chaincodes en JavaScript/TypeScript o usar el SDK de Fabric para aplicaciones cliente.

```bash
# Instalar nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Instalar Node.js LTS
nvm install --lts
nvm use --lts
```

### Verificar

```bash
node --version
npm --version
```

---

## 8. Descargar Hyperledger Fabric

### 8.1 Crear directorio de trabajo

```bash
mkdir -p $HOME/fabric
cd $HOME/fabric
```

### 8.2 Descargar el script de instalación

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
```

### 8.3 Ver opciones disponibles

```bash
./install-fabric.sh -h
```

### 8.4 Instalar todo: imágenes Docker + binarios + samples

```bash
./install-fabric.sh docker samples binary
```

Esto descarga:

| Componente | Descripción |
|---|---|
| **fabric-samples/** | Repositorio con ejemplos y la test-network |
| **bin/** | Binarios CLI: `peer`, `orderer`, `configtxgen`, `configtxlator`, `osnadmin`, `cryptogen`, `fabric-ca-client`, `fabric-ca-server` |
| **config/** | Archivos de configuración base: `core.yaml`, `orderer.yaml`, `configtx.yaml` |
| **Imágenes Docker** | `hyperledger/fabric-peer`, `fabric-orderer`, `fabric-ca`, `fabric-tools`, `fabric-ccenv`, `fabric-baseos` |

### 8.5 Especificar versiones (opcional)

```bash
# Versión específica de Fabric y CA
./install-fabric.sh -f 2.5.15 -c 1.5.17 docker samples binary
```

### 8.6 Configurar PATH de los binarios

```bash
# Añadir al final de ~/.bashrc o ~/.zshrc
echo 'export PATH=$HOME/fabric/fabric-samples/bin:$PATH' >> ~/.bashrc
echo 'export FABRIC_CFG_PATH=$HOME/fabric/fabric-samples/config' >> ~/.bashrc
source ~/.bashrc
```

### 8.7 Verificar la instalación

```bash
peer version
orderer version
configtxgen -version
fabric-ca-client version
```

---

## 9. Verificar imágenes Docker descargadas

```bash
docker images | grep hyperledger
```

Deberías ver algo similar a:

```
hyperledger/fabric-tools      2.5
hyperledger/fabric-peer        2.5
hyperledger/fabric-orderer     2.5
hyperledger/fabric-ccenv       2.5
hyperledger/fabric-baseos      2.5
hyperledger/fabric-ca          1.5
```

---

## 10. Resumen de lo instalado

```
$HOME/fabric/
├── install-fabric.sh          # Script de instalación
└── fabric-samples/            # Repositorio de ejemplos
    ├── bin/                   # Binarios de Fabric
    │   ├── peer
    │   ├── orderer
    │   ├── configtxgen
    │   ├── configtxlator
    │   ├── osnadmin
    │   ├── cryptogen
    │   ├── fabric-ca-client
    │   └── fabric-ca-server
    ├── config/                # Configuración base
    │   ├── configtx.yaml
    │   ├── core.yaml
    │   └── orderer.yaml
    ├── test-network/          # Red de pruebas
    ├── asset-transfer-basic/  # Chaincode de ejemplo
    └── ...                    # Más ejemplos
```

---

## Checklist final

- [ ] WSL2 + Ubuntu funcionando (solo Windows)
- [ ] VS Code con extensión WSL (solo Windows)
- [ ] Docker Desktop instalado con integración WSL2 (solo Windows)
- [ ] Git, curl, jq instalados
- [ ] Docker funcionando (`docker run hello-world`)
- [ ] Docker Compose disponible
- [ ] Go instalado (si vas a escribir chaincodes en Go)
- [ ] Node.js instalado (si vas a usar SDK o chaincodes JS/TS)
- [ ] Binarios de Fabric en el PATH (`peer version` funciona)
- [ ] Imágenes Docker de Fabric descargadas
- [ ] `fabric-samples` clonado

---

**Siguiente:** [02 - Test Network: tu primera red Fabric](02-test-network.md)
