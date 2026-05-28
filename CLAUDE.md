# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Course materials for "Administración y desarrollo con Hyperledger Fabric V2". Everything is in **Spanish** — docs, comments, commit messages, variable names. Keep that convention.

The repo is organized by modules (currently Modulo-1 and Modulo-2; up to 6 planned). Most content is markdown guides and PDF slides. There are **two runnable codebases**:

1. **SignChain practice** (`Modulo-2/practica/`) — didactic exercise of the course
2. **DistribuTech prototype** (`mayoristas/solucion/`) — investor-demo prototype, the **active project** that gets most attention in current sessions

## SignChain practice (Modulo-2/practica/)

A document-signing workflow between two Fabric organizations (**Cliente** and **Proveedor**). Didactic, smaller in scope than DistribuTech.

### Architecture

- **Chaincode** (`chaincode/signchain/signchain.go`): Go, uses `fabric-contract-api-go v1.2.2`. Handles document creation, signing, and querying.
- **Client app** (`application/`): Node.js (>=18), uses `@hyperledger/fabric-gateway`. CLI scripts: `crear-documento.js`, `firmar-documento.js`, `consultar-documento.js`, plus `sanity-check.js` for end-to-end diagnostics.
- **Web frontend** (`application/web/`): Express server (`server.js`) serving static files from `public/`. Provides a browser UI for the same operations.
- **Network** (`network/`): Docker Compose files for 3 Fabric CAs + 1 orderer + 2 peers + 2 CouchDBs. Channel config in `configtx.yaml`.
- **Scripts** (`scripts/`): Numbered bash scripts that must run in order. Shared config in `common.sh`.

### Key identifiers

- Channel: `signchain-channel`
- Chaincode: `signchain`
- Orgs: `ClienteMSP` (peer at `localhost:7051`), `ProveedorMSP` (peer at `localhost:9051`)
- Endorsement policy: `AND('ClienteMSP.peer','ProveedorMSP.peer')`
- Domains: `cliente.signchain.com`, `proveedor.signchain.com`, `signchain.com` (orderer)

### Commands

```bash
# Prerequisites: Docker, Node.js >=18, Go >=1.21, Fabric binaries in PATH
export PATH=$HOME/practica01/bin:$PATH
export FABRIC_CFG_PATH=$HOME/practica01/config

# Stand up the full network (run from Modulo-2/practica/)
bash scripts/01-setup-cas.sh        # Fabric CAs + register/enroll identities
bash scripts/02-build-msps.sh       # Build organization MSP trees
bash scripts/03-start-network.sh    # Orderer + peers + channel join
bash scripts/04-deploy-chaincode.sh # Full chaincode lifecycle

# Re-deploy chaincode with new version
CHAINCODE_VERSION=1.1 CHAINCODE_SEQUENCE=2 bash scripts/04-deploy-chaincode.sh

# Client app (from Modulo-2/practica/application/)
npm install
export SIGNCHAIN_NETWORK_PATH="$(cd .. && pwd)/network"
npm run check   # end-to-end sanity check

# Web UI (from Modulo-2/practica/application/web/)
npm install
npm start

# Tear down everything
bash scripts/99-clean-all.sh
```

## DistribuTech prototype (mayoristas/solucion/)

Blockchain prototype for a tech distribution network: **Fabricante → Mayorista → Minorista → Cliente final**. Designed to be demoed live to investors. Includes a visual frontend, REST API, OpenAPI spec, seed script, and detailed docs.

### Architecture

- **3 peer orgs + 1 orderer**: `FabricanteMSP`, `MayoristaMSP`, `MinoristaMSP`, `OrdererMSP`.
- **3 channels** (privacy by separation):
  - `canal-trazabilidad` — all 3 orgs, hosts `cc-producto` and `cc-garantia`.
  - `canal-mayorista` — Fabricante + Mayorista, hosts `cc-pedido`. Hides wholesale prices from the retailer.
  - `canal-minorista` — Mayorista + Minorista, hosts `cc-pedido` (same code). Hides retail margins from the manufacturer.
- **3 chaincodes** (Go, `fabric-contract-api-go v1.2.2`):
  - `cc-producto`: registro, transferencia de custodia, trazabilidad. Uses `CreateCompositeKey("transferencia", [serie, txID])` for history.
  - `cc-garantia`: activación, reclamación, resolución.
  - `cc-pedido`: ciclo de vida bilateral (CREADO → ACEPTADO → ENVIADO → RECIBIDO). Deployed in 2 channels.
- **Endorsement policies**: `cc-producto`/`cc-garantia` use `OR` + ACL en chaincode (verifica `GetMSPID()`); `cc-pedido` usa `AND` bilateral en cada canal.
- **Client app** (`application/`):
  - CLI por rol: `fabricante.js`, `mayorista.js`, `minorista.js`.
  - Express server `web/server.js` con API REST + frontend estático en `web/public/`.
  - Frontend vanilla JS (sin build, sin React/Babel CDN) con vista dashboard kanban + drawer.
  - Sanity-checks: `sanity-check.js` (CLI) y `web/sanity-check.js` (HTTP).
  - Seed script: `seed-demo.js` → 36 transacciones realistas para demos.
- **Docs**: `web/API.md` (referencia profesional), `web/openapi.yaml` (OpenAPI 3.0).

### Key identifiers

- Domains: `fabricante.distributech.com`, `mayorista.distributech.com`, `minorista.distributech.com`, `distributech.com` (orderer).
- Ports: peers 7051/9051/11051, orderer 7050 (admin 7053), CAs 7054/8054/9054/10054, CouchDBs 5984/7984/9984, API+frontend 3000.
- `docType` values en el ledger: `producto`, `transferencia`, `garantia`, `reclamacion`, `pedido`.

### Commands

```bash
# Desde mayoristas/solucion/
source env.sh    # exporta PATH y FABRIC_CFG_PATH apuntando a ./bin y ./config

# Stand up
bash scripts/01-setup-cas.sh
bash scripts/02-build-msps.sh
bash scripts/03-start-network.sh
bash scripts/04-create-channels.sh
bash scripts/05-deploy-chaincodes.sh
bash scripts/sanity-check.sh

# Upgrade individual de un chaincode (auto-bumps version + sequence)
bash scripts/upgrade-chaincode.sh cc-producto
NEW_VERSION=2.0 NEW_SEQUENCE=5 bash scripts/upgrade-chaincode.sh cc-garantia

# App + frontend (desde mayoristas/solucion/application/)
npm install
npm run api          # arranca API+frontend en :3000
npm run api:check    # sanity-check end-to-end vía HTTP
npm run check        # sanity-check vía CLI/SDK
npm run seed         # rellena con datos de demo (36 transacciones)
SEED_PREFIX=DEMO npm run seed   # IDs predecibles

# Tear down everything
bash scripts/99-clean-all.sh
```

### Gotchas y convenciones

- **Re-enrolls dejan claves stale**: cuando `01-setup-cas.sh` se ejecuta más de una vez, `fabric-ca-client enroll` añade nuevas claves a `keystore/` sin borrar las anteriores. Tanto `02-build-msps.sh` (con `cp_matching_key_to_dir`) como `application/utils/fabric-connection.js` (con `readMatchingPrivateKey`) seleccionan **la clave cuya pubkey coincide con el cert**, no la más reciente por mtime.
- **Bytes 0xFF rompen gRPC**: el chaincode `cc-producto` usa `CompositeKey` en lugar de range queries con `\xff` como sentinel — el byte 0xFF no es UTF-8 válido y el contenedor del chaincode crashea silenciosamente.
- **`((PASS++))` con `set -e`**: el postincremento bash devuelve 0 la primera vez y `set -e` lo trata como fallo. Usar `PASS=$((PASS+1))`.
- **Upgrades de chaincode son irreversibles**: una vez commiteada una secuencia en el ledger no se puede deshacer, solo rodar hacia adelante con otra versión. **Pedir confirmación explícita al usuario** antes de invocar `upgrade-chaincode.sh` o cualquier acción del lifecycle (install/approve/commit), aunque ya se haya hablado del plan general.
- **CouchDB rich queries**: las funciones `Listar*` de cada chaincode filtran por `docType` con `GetQueryResult` — requiere que el state DB sea CouchDB (lo es en `docker-compose-net.yaml`).
- **Tres puertos por servicio**: cuando levantas la red, recuerda los CouchDBs en 5984/7984/9984 además de los peers — si un puerto está ocupado, el `up -d` falla en silencio.

## Modulo-1

Introductory blockchain content: slides (PDFs), Solidity smart contracts in `SC/` (Counter, Token, Vault, Voting), a Geth private-chain setup in `Geth/`, and markdown-based crypto/hash exercises. No build system — Solidity files are meant for Remix IDE.
