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

### 2. Levantar la red

```bash
export PATH=$HOME/practica01/bin:$PATH
export FABRIC_CFG_PATH=$HOME/practica01/config

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
    ├── sanity-check.sh
    └── 99-clean-all.sh
```
