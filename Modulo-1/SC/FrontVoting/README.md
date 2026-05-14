# FrontVoting — DApp de Votación Ponderada

DApp en React + ethers v6 para interactuar con el contrato `TokenWeightedVoting.sol` usando un token ERC-20 (por ejemplo `MyToken.sol`) como peso de voto.

## Funcionalidades

- 🔌 Conexión con MetaMask
- 🚦 Detección de red (avisa si no estás en Sepolia)
- 👑 Detecta automáticamente si tu wallet es el owner del contrato
- 🗳 Ver propuesta activa con barras de resultados en vivo (Sí/No) y cuenta atrás
- ✓ / ✕ Votar Sí o No (el peso se calcula con tu saldo del token de gobernanza)
- 📜 Historial de propuestas pasadas leyendo los eventos `ProposalCreated` + `ProposalClosed`
- 👑 Panel del owner: crear nueva propuesta y cerrar la actual cuando vence

## Requisitos

- Node 18+
- MetaMask en Sepolia

El contrato de votación ya está hardcodeado en `src/abi.js`:

```
0x8cBb5F9413db45E2699606BBdB18F0FAfA5f79cc
```

La dirección del token ERC-20 de gobernanza se **autodetecta** llamando a `governanceToken()` del contrato de votación — no hace falta configurar nada.

## Setup

### Si todavía NO tienes el repositorio (primera vez)

Necesitas tener [Git](https://git-scm.com/downloads) instalado. Abre una terminal y ejecuta:

```bash
git clone https://github.com/jjnieto/Curso-HLFabric.git
cd Curso-HLFabric/Modulo-1/SC/FrontVoting
npm install
npm run dev
```

### Si ya clonaste el repo antes (actualizar)

Entra en la carpeta del repo y baja los últimos cambios:

```bash
cd Curso-HLFabric
git pull
cd Modulo-1/SC/FrontVoting
npm install
npm run dev
```

> Si `git pull` se queja de cambios locales, haz `git stash` antes (guarda tus cambios) o `git reset --hard origin/main` (los descarta).

### Acceder a la dApp

Abre [http://localhost:5174](http://localhost:5174) (configurable en `vite.config.js`).

Conecta MetaMask en Sepolia y listo: ya puedes ver la propuesta activa y votar.

## Flujo en clase

1. **Reparte tokens** entre los alumnos desde el contrato MyToken (`transfer`) — desigualmente para que se note el peso.
2. Como owner, **crea una propuesta** desde la dApp ("¿Pausa a las 10:30 o a las 11:00?", duración 5 minutos).
3. Los alumnos **votan** Sí o No desde sus wallets. Las barras se actualizan en vivo.
4. Cuando vence el deadline, el owner **cierra** la propuesta y se publica el resultado.

## Cambiar de contrato

Si quieres apuntar a otro despliegue de `TokenWeightedVoting`:

- Edita `DEFAULT_VOTING_ADDRESS` en `src/abi.js`, o
- Desde la dApp pulsa **Cambiar** en la sección "Contratos en uso" para sobrescribirlo (se guarda en localStorage)

## Vulnerabilidad didáctica (a propósito)

El contrato es vulnerable al **doble voto por transferencia**:

1. Alice vota con 100 MTK
2. Alice transfiere los 100 MTK a Bob
3. Bob vota desde su wallet con esos mismos 100 MTK

Esto se evita con **snapshot voting** (Compound, Uniswap, Aave): el peso se calcula con el balance en el bloque donde se creó la propuesta. En esta versión didáctica el bug queda expuesto para discutirlo en clase.

## Ideas de mejora para el alumno

Estas son propuestas concretas para extender el ejercicio. Algunas tocan el contrato, otras la dApp, otras ambos:

### Sobre el contrato

- 🛡️ **Evitar el doble voto por transferencia** (la vulnerabilidad descrita arriba). Implementar snapshot voting: guardar el balance de cada wallet en el bloque en que se creó la propuesta y usar ese valor como peso de voto, no el balance actual.
- 🗂️ **Soportar varias propuestas activas a la vez** en lugar de solo una. Almacenarlas en un mapping con ID incremental.
- ⏱️ **Permitir que cualquiera pueda cerrar una propuesta vencida** (ahora solo el owner). Si el owner desaparece, las propuestas pueden quedar abiertas para siempre.
- 🔥 **Cobrar un fee en MyToken al crear propuesta** para evitar spam.
- 📊 **Añadir opciones múltiples** (no solo Sí/No), con un array de opciones y votos por cada una.

### Sobre la dApp

- 📜 **Ampliar el rango de búsqueda del historial** más allá de los 50.000 bloques actuales (~7 días en Sepolia). Idea: usar un indexador como The Graph o paginar la búsqueda hacia atrás.
- ⏳ **Mostrar propuestas vencidas pero aún no cerradas** en una sección aparte para que cualquiera vea que están listas para cerrarse.
- 🔗 **Enlace a Etherscan** en cada propuesta del historial (a la transacción del cierre).
- 📈 **Gráfica temporal de votos** dentro de una propuesta activa: cuántos votos se han ido acumulando en el tiempo.
- 🔔 **Notificación push del navegador** cuando el owner abre una nueva propuesta o cuando vence el deadline.
- 👥 **Lista de votantes** en cada propuesta (leyendo los eventos `Voted`) con su peso y elección.
- 🌐 **Soporte multidioma** (es / en).
- 🎨 **Modo claro** además del oscuro actual.

### Ambición alta (proyecto fin de módulo)

- 🏛️ **Sistema completo de DAO**: añadir mecanismos como votación cuadrática, delegación de votos, timelock antes de ejecutar resultados, integración con Snapshot.
- 🔐 **Resistencia a flash loans**: estudia el ataque del Beanstalk DAO (2022) y añade la protección correspondiente.

## Stack

- Vite 5
- React 18
- ethers 6
- Tipografías: Inter + JetBrains Mono
- Sin frameworks UI — CSS puro con glassmorphism y dark mode

## Estructura

```
FrontVoting/
├── package.json
├── vite.config.js
├── index.html
├── .gitignore
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx       ← toda la lógica de la DApp
    ├── abi.js        ← ABIs de TokenWeightedVoting + ERC-20
    └── index.css     ← estilo modern dark con glassmorphism
```
