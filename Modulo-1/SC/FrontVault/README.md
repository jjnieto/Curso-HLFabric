# FrontVault — DApp con React + MetaMask

DApp web para el contrato `MultiTimeLock` (`Modulo-1/SC/vault.sol`). Permite a un usuario conectado con MetaMask **bloquear ETH** durante un tiempo configurable y **retirarlo** cuando expira el bloqueo. Mientras dura, muestra el saldo y un contador en vivo del tiempo restante.

Stack: **React 18 + Vite + ethers v6**. Sin Tailwind ni librerías de UI — CSS custom, look oscuro moderno.

---

## Guía paso a paso (de cero hasta verla funcionar)

Esta guía asume que **no tienes nada instalado**. Si ya tienes Node 18+ y MetaMask, salta directo al [Paso 3](#paso-3--bajar-este-código).

### Paso 1 — Instalar Node.js (que trae `npm`)

Node.js es el motor JavaScript que necesitamos. `npm` (Node Package Manager) viene incluido — no se instala por separado.

#### Opción A: Windows

1. Abre https://nodejs.org/es/download.
2. Descarga el instalador **LTS** (Long Term Support, recomendado). Verás dos botones: "LTS" y "Current". Pulsa **LTS**.
3. Ejecuta el `.msi`. Acepta los valores por defecto en todas las pantallas — incluye `npm` y añade Node al `PATH`.
4. Al terminar, cierra cualquier terminal abierta y abre una nueva (cmd o PowerShell).

#### Opción B: macOS

Lo más sencillo es **Homebrew**. Si no lo tienes, instálalo desde https://brew.sh, luego:

```bash
brew install node
```

Alternativa sin Homebrew: descarga el instalador `.pkg` desde https://nodejs.org/es/download.

#### Opción C: Linux (Ubuntu / WSL)

```bash
# Instalar nvm (Node Version Manager) — método recomendado por nodejs.org
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Cierra y abre el terminal de nuevo, luego:
nvm install --lts
nvm use --lts
```

#### Verificar que Node y npm están instalados

En cualquier sistema, abre una terminal nueva y ejecuta:

```bash
node --version
npm --version
```

Esperado: algo como `v20.x.x` (o superior) y `10.x.x`. Si te dice "command not found" o "no se reconoce el comando", reinicia la terminal o reinicia el ordenador y vuelve a probar.

> **Versión mínima recomendada:** Node **18 o superior**. El proyecto declara `"engines": { "node": ">=18" }` en su `package.json`.

### Paso 2 — Instalar MetaMask en el navegador

MetaMask es la wallet con la que la DApp se va a comunicar.

1. Abre https://metamask.io/download/ en tu navegador (Chrome, Firefox, Brave o Edge).
2. Pulsa "Install MetaMask for [navegador]" y acepta la instalación de la extensión.
3. Al terminar, MetaMask se abre automáticamente:
    - Si es la primera vez: crea una **wallet nueva**. Te dará una **frase semilla de 12 palabras** — **anótala en papel**. Sin esa frase no podrás recuperar la wallet si pierdes acceso al navegador.
    - Si ya tienes wallet: pulsa "Importar wallet existente" e introduce tu frase semilla.
4. Crea una **contraseña** (es la que te pedirá MetaMask cada vez que abras el navegador).

> **Aviso de seguridad**: para esta práctica, **usa una wallet nueva**, no la que tengas con fondos reales en mainnet. Vamos a operar en testnets (ETH gratis sin valor real) y no queremos mezclar.

### Paso 3 — Bajar este código

Si tienes git instalado:

```bash
git clone https://github.com/jjnieto/Curso-HLFabric.git
cd Curso-HLFabric/Modulo-1/SC/FrontVault
```

Si no tienes git, descarga el ZIP desde la página del repositorio en GitHub (botón verde "Code" → "Download ZIP"), descomprímelo y entra en `Curso-HLFabric-main/Modulo-1/SC/FrontVault`.

### Paso 4 — Instalar las dependencias

Estando dentro del directorio `FrontVault`, ejecuta:

```bash
npm install
```

Esto lee `package.json`, descarga React, ethers y Vite, y los pone en `node_modules/`. Tarda 30 segundos a 2 minutos según tu conexión. Es **normal** ver algunos avisos amarillos (deprecation warnings); ignóralos a menos que veas la palabra `ERROR`.

Cuando termine sin errores, deberías ver algo como:

```
added 220 packages in 47s
```

### Paso 5 — Configurar MetaMask para una testnet

Por defecto MetaMask te conecta a **Ethereum Mainnet** (la red real, donde el ETH cuesta dinero). Para la práctica usaremos **Sepolia**, una testnet pública donde el ETH es gratis.

1. Abre la extensión de MetaMask.
2. Arriba a la izquierda, pulsa el desplegable que dice **"Ethereum Mainnet"**.
3. Activa el interruptor **"Show test networks"** si no está encendido.
4. Selecciona **"Sepolia"**. Ya estás en testnet.

### Paso 6 — Conseguir ETH de testnet

Necesitas algo de ETH (de mentira, sin valor real) para pagar el gas de las transacciones.

1. Copia tu dirección desde MetaMask (pulsa sobre el nombre de la cuenta en la parte superior y se copia automáticamente).
2. Abre un **faucet** de Sepolia. Los más fiables ahora mismo:
    - https://sepoliafaucet.com (de Alchemy, requiere registrarte gratis)
    - https://www.alchemy.com/faucets/ethereum-sepolia
    - https://cloud.google.com/application/web3/faucet/ethereum/sepolia (necesita cuenta Google)
3. Pega tu dirección y solicita los fondos. En 1–2 minutos verás ETH en MetaMask.

> Si el contrato de referencia (`0xFaEC1ce…`) no está en Sepolia sino en otra testnet (Holesky, Mumbai, una red privada…), tendrás que conectar MetaMask a esa red y conseguir su moneda de testnet. El profesor te indicará cuál es.

### Paso 7 — Arrancar la DApp

Vuelve a la terminal, dentro de `FrontVault`, y ejecuta:

```bash
npm run dev
```

Verás algo así:

```
  VITE v5.4.0  ready in 320 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

El navegador debería abrirse solo en `http://localhost:5173`. Si no, ábrelo a mano.

### Paso 8 — Usar la DApp

1. **Conectar MetaMask**: pulsa el botón grande "Conectar MetaMask". MetaMask preguntará si autorizas la conexión — acepta.
2. **Comprobar la red**: en la card "Cuenta conectada" verás el chip indicando la red activa (`Sepolia`, `Mainnet`, etc.). Si no es la que toca, cambia la red desde MetaMask y la DApp se recargará sola.
3. **Comprobar la dirección del contrato**: por defecto está la del despliegue de referencia. Si tu profesor te ha pasado otra dirección, pégala en el campo "Dirección del contrato".
4. **Bloquear**:
    - Indica una cantidad pequeña en ETH (ej. `0.01`).
    - Pulsa uno de los atajos de duración (`1 min`, `5 min`, ...) o escribe los segundos a mano.
    - Pulsa **Bloquear**. MetaMask se abrirá pidiéndote confirmar la transacción — acepta. Verás un toast con el hash de la transacción.
    - Cuando se mine (5–30 segundos en Sepolia), la UI cambiará automáticamente a la vista del depósito activo.
5. **Esperar**: el countdown corre en vivo. El botón "Retirar fondos" está deshabilitado hasta que llegue a `00:00:00`.
6. **Retirar**: cuando se habilite, púlsalo. MetaMask te pedirá confirmar otra transacción. Cuando se mine, los fondos vuelven a tu wallet y la UI vuelve al formulario de bloqueo.

¡Listo!

---

## Detener la DApp

En la terminal donde corre `npm run dev`, pulsa `Ctrl + C`. Para volver a arrancarla otro día, basta con repetir el Paso 7 (`npm run dev`). No hace falta volver a hacer `npm install`.

## Build de producción (opcional)

Si quieres servir la DApp en cualquier servidor estático (GitHub Pages, Netlify, Vercel, un nginx propio…):

```bash
npm run build
```

Genera `dist/` con HTML, CSS y JS optimizados. Sube todo eso al servidor que prefieras.

Para probar el build en local antes de desplegar:

```bash
npm run preview
```

Sirve `dist/` en `http://localhost:4173`.

---

## Estructura del proyecto

```
FrontVault/
├── package.json          # dependencias y scripts
├── vite.config.js        # configuración de Vite (puerto, plugin React)
├── index.html            # punto de entrada HTML
├── README.md             # este archivo
├── .gitignore
└── src/
    ├── main.jsx          # bootstrap de React
    ├── App.jsx           # toda la lógica de la DApp
    ├── abi.js            # ABI mínimo del contrato + dirección por defecto
    └── index.css         # estilos
```

## Cómo desplegar tu propia copia del contrato

Si quieres tu propio despliegue (recomendado en clase, para no compartir el mismo contrato entre alumnos):

1. Compila `Modulo-1/SC/vault.sol` con Remix (https://remix.ethereum.org es lo más directo, no requiere instalación).
2. En Remix, conecta MetaMask como entorno ("Injected Provider — MetaMask").
3. Despliega el contrato. Confirma la transacción de despliegue desde MetaMask.
4. Cuando se mine, Remix te muestra la dirección del nuevo contrato.
5. Cópiala y pégala en el campo "Dirección del contrato" de la DApp.

## Resolución de problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `node: command not found` | Node no instalado o no está en el PATH | Repite el Paso 1, cierra y vuelve a abrir la terminal |
| `npm install` falla con `EACCES` | Permisos en macOS/Linux | No uses `sudo` con npm. Reinstala Node con nvm (Paso 1, Opción C) |
| "MetaMask no detectado" en la DApp | Extensión no instalada o desactivada para esta página | Revisa la extensión y refresca la página |
| "No pude leer el contrato" | Dirección incorrecta o red equivocada | Comprueba que la red de MetaMask coincide con la del despliegue |
| "execution reverted: Ya tienes un deposito activo" | El contrato solo permite un depósito por dirección | Espera a que expire el actual y retira, luego puedes bloquear de nuevo |
| "execution reverted: Aun bloqueado" | Has llamado a `withdraw` antes de tiempo | Espera al countdown. El botón debería estar deshabilitado hasta entonces |
| "insufficient funds for gas" | No tienes ETH suficiente para el gas | Pide más ETH en el faucet de Sepolia (Paso 6) |
| `npm run dev` falla con "port 5173 already in use" | Hay otra instancia corriendo | Cierra la otra terminal con `Ctrl + C`, o cambia el puerto en `vite.config.js` |
| El countdown no avanza | Bug raro de React tras cambio de cuenta | Refresca la página (F5) |

## Decisiones de diseño

- **Sin Tailwind**: el CSS está en un solo archivo con variables. Facilita ver de un vistazo todo el sistema visual.
- **Sin librería de wallets** (rainbowkit, wagmi, etc.): se usa `window.ethereum` + `ethers v6` directamente. Es suficiente para una DApp pequeña y didáctica.
- **Un solo componente** (`App.jsx`): toda la lógica vive ahí. Para un proyecto de este tamaño separar añade ceremonia sin valor.
- **Polling implícito**: `now` se actualiza cada segundo con un `setInterval`, lo que hace que el countdown corra solo. El estado on-chain se relee solo tras transacciones o cambios de cuenta — sin polling constante de la cadena.
