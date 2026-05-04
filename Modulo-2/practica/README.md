# Práctica del Módulo 2: SignChain

Sistema de firma de documentos entre dos organizaciones (Cliente y Proveedor) sobre Hyperledger Fabric.

Este directorio contiene **dos cosas**:

1. **Material didáctico** (`enunciado.md` + `solucion-01..05.md`): el caso, las decisiones de diseño y el porqué de cada paso. Es donde se aprende.
2. **Código ejecutable** (`network/`, `chaincode/`, `scripts/`, `application/`): la práctica resuelta lista para arrancar de un tirón. Útil para demos, para trastear con el chaincode o para ahorrar tiempo cuando ya conoces la teoría.

> Si vas a hacer la práctica como ejercicio formativo, **no copies el código**. Lee primero `enunciado.md`, intenta diseñarla tú, y usa los `solucion-XX.md` y este código solo como referencia al final.

## Quickstart (B): arrancar todo de un tirón

Requisitos previos:

- Linux o WSL2
- Docker y Docker Compose v2
- Node.js >= 18
- Go >= 1.21
- Binarios de Fabric (`peer`, `configtxgen`, `cryptogen`, `osnadmin`, `fabric-ca-client`) en el `PATH`

Pasos:

```bash
# 1. Clonar y entrar
git clone https://github.com/jjnieto/Curso-HLFabric.git
cd Curso-HLFabric/Modulo-2/practica

# 2. Asegurar que los binarios de Fabric están en el PATH
#    (si los descargaste con install-fabric.sh en otra ruta, ajusta esto)
export PATH=$HOME/practica01/bin:$PATH
export FABRIC_CFG_PATH=$HOME/practica01/config

# 3. Arrancar la red (CAs -> MSPs -> red -> chaincode)
bash scripts/01-setup-cas.sh
bash scripts/02-build-msps.sh
bash scripts/03-start-network.sh
bash scripts/04-deploy-chaincode.sh

# 4. App cliente
cd application
npm install
export SIGNCHAIN_NETWORK_PATH="$(cd .. && pwd)/network"
npm run check     # sanity check: 0 errores y 0 avisos = todo bien
```

Si todo va bien, ya puedes crear, firmar y consultar documentos:

```bash
echo "Contrato de prueba" > docs/contrato.pdf
node crear-documento.js DOC-001 ./docs/contrato.pdf "Contrato 2026" "Servicios"
node firmar-documento.js cliente   DOC-001 ./docs/contrato.pdf
node firmar-documento.js proveedor DOC-001 ./docs/contrato.pdf
node consultar-documento.js DOC-001 ./docs/contrato.pdf
```

## Estructura

```
practica/
├── enunciado.md
├── solucion-01-arquitectura.md
├── solucion-02-fabric-ca.md
├── solucion-03-red-y-canal.md
├── solucion-04-chaincode.md
├── solucion-05-cliente-y-pruebas.md
│
├── network/
│   ├── configtx.yaml                       # Definición del canal
│   ├── docker/
│   │   ├── docker-compose-ca.yaml          # 3 Fabric CAs
│   │   └── docker-compose-net.yaml         # orderer + 2 peers + 2 CouchDBs
│   ├── fabric-ca/                          # (generado) datos de las CAs
│   ├── organizations/                      # (generado) MSPs construidos
│   └── channel-artifacts/                  # (generado) bloque génesis
│
├── chaincode/
│   └── signchain/
│       ├── go.mod
│       └── signchain.go                    # ~7 funciones, validaciones, eventos
│
├── scripts/
│   ├── common.sh                           # variables y helpers compartidos
│   ├── 01-setup-cas.sh                     # CAs + register/enroll
│   ├── 02-build-msps.sh                    # construye organizations/
│   ├── 03-start-network.sh                 # red + canal + peer join
│   ├── 04-deploy-chaincode.sh              # lifecycle completo
│   └── 99-clean-all.sh                     # tear-down + rm
│
└── application/
    ├── package.json
    ├── sanity-check.js                     # diagnóstico end-to-end
    ├── crear-documento.js / firmar-... / consultar-...
    ├── utils/
    └── README.md                           # guía detallada de la app cliente
```

## Limpiar todo

```bash
bash scripts/99-clean-all.sh
```

Para los contenedores (CAs y red), borra volúmenes Docker, MSPs construidos, bloques génesis y vendor del chaincode. La estructura del repo (los archivos versionados) **no** se toca.

## Camino A (didáctico)

Si prefieres construir la práctica paso a paso en lugar de usar los scripts, los `solucion-XX.md` te guían comando a comando. Esos documentos siguen siendo la referencia canónica del **porqué** de cada decisión; este quickstart es solo el **cómo** condensado.

## Troubleshooting rápido

| Síntoma | Probablemente |
|---------|---------------|
| `01-setup-cas.sh` falla con `connection refused` | Docker no está corriendo, o las CAs no han terminado de arrancar |
| `02-build-msps.sh` falla con `ls: cannot access ...` | El paso 1 no terminó: faltan archivos en `network/fabric-ca/<org>/<id>/msp` |
| `03-start-network.sh` falla con `BAD_CERTIFICATE` u `osnadmin: tls` | El cert TLS del orderer no incluye `localhost` en SANs. Re-ejecuta `01` con la red limpia |
| `04-deploy-chaincode.sh`: `cannot find FABRIC_CFG_PATH` | Exporta `FABRIC_CFG_PATH` apuntando al directorio `config/` de los binarios de Fabric |
| `npm run check` en application/: errores de TLS o "no such file" | Exporta `SIGNCHAIN_NETWORK_PATH=$(pwd)/../network` desde `application/` |

Para resetear y volver a empezar de cero: `bash scripts/99-clean-all.sh && bash scripts/01-setup-cas.sh`.
