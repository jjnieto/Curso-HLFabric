# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Course materials for "Administración y desarrollo con Hyperledger Fabric V2". Everything is in **Spanish** — docs, comments, commit messages, variable names. Keep that convention.

The repo is organized by modules (currently Modulo-1 and Modulo-2; up to 6 planned). Most content is markdown guides and PDF slides. The main runnable codebase is the **SignChain practice** in `Modulo-2/practica/`.

## SignChain practice (Modulo-2/practica/)

A document-signing workflow between two Fabric organizations (**Cliente** and **Proveedor**). This is the only part of the repo with executable code.

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

## Modulo-1

Introductory blockchain content: slides (PDFs), Solidity smart contracts in `SC/` (Counter, Token, Vault, Voting), a Geth private-chain setup in `Geth/`, and markdown-based crypto/hash exercises. No build system — Solidity files are meant for Remix IDE.
