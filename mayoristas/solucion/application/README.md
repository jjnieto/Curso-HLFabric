# DistribuTech — Apps cliente

Aplicaciones Node.js de cada organización para invocar el chaincode de la red. Una CLI por rol, con los comandos que cada organización puede ejecutar.

## Requisitos

- Node.js >= 18
- Red DistribuTech levantada (scripts 01-05 desde `solucion/`)
- Variables de entorno cargadas: `source ../env.sh`

## Instalación

```bash
cd application
npm install
```

## Sanity check

Ejecuta el ciclo completo de vida de un producto pasando por las 3 orgs (registro → pedido mayorista → transferencia → pedido minorista → garantía → verificación):

```bash
npm run check
```

Debe terminar con `PASS: N · FAIL: 0`.

## Uso por organización

Cada org tiene su propia CLI con subcomandos. Llama sin argumentos para ver la lista:

```bash
node fabricante.js
node mayorista.js
node minorista.js
```

### Fabricante

| Comando | Qué hace |
|---------|----------|
| `registrar-producto <serie> <modelo> <lote>` | Crea un producto nuevo |
| `transferir-custodia <serie> <destinoMSP>` | Transfiere la custodia (típicamente a MayoristaMSP) |
| `aceptar-pedido <pedido-id>` | Acepta un pedido del mayorista |
| `registrar-envio <pedido-id> <tracking>` | Marca el pedido como enviado |
| `resolver-reclamacion <id> <resolucion> <true\|false>` | Acepta o rechaza una reclamación |
| `consultar-producto <serie>` | Devuelve el estado del producto |
| `consultar-pedido <pedido-id>` | Consulta un pedido en canal-mayorista |
| `verificar-autenticidad <serie>` | Devuelve el historial completo de custodia |

### Mayorista

| Comando | Qué hace |
|---------|----------|
| `crear-pedido-fabricante <id> <lineas-json>` | Crea un pedido al fabricante |
| `confirmar-recepcion-fabricante <id>` | Confirma la recepción del envío del fabricante |
| `transferir-custodia <serie> <destinoMSP>` | Transfiere la custodia (típicamente a MinoristaMSP) |
| `aceptar-pedido-minorista <id>` | Acepta un pedido del minorista |
| `registrar-envio-minorista <id> <tracking>` | Marca el pedido al minorista como enviado |
| `consultar-producto <serie>` | Estado del producto |
| `consultar-pedido-fabricante <id>` | Consulta en canal-mayorista |
| `consultar-pedido-minorista <id>` | Consulta en canal-minorista |
| `verificar-autenticidad <serie>` | Historial completo de custodia |

### Minorista

| Comando | Qué hace |
|---------|----------|
| `crear-pedido-mayorista <id> <lineas-json>` | Crea un pedido al mayorista |
| `confirmar-recepcion-mayorista <id>` | Confirma la recepción del envío |
| `activar-garantia <serie> <clienteFinal> <meses>` | Activa la garantía para un cliente final |
| `reclamar-garantia <serie> <motivo>` | Abre una reclamación al fabricante |
| `verificar-autenticidad <serie>` | Historial completo de custodia |
| `consultar-producto <serie>` | Estado del producto |
| `consultar-garantia <serie>` | Estado de la garantía |
| `consultar-pedido <id>` | Consulta en canal-minorista |

## Ejemplo de flujo manual

```bash
# Fabricante crea el producto
node fabricante.js registrar-producto SN-001 "Laptop X" LOTE-001

# Mayorista pide al fabricante
node mayorista.js crear-pedido-fabricante PED-001 '[{"producto":"SN-001","cantidad":1,"precio":900}]'

# Fabricante acepta y envía
node fabricante.js aceptar-pedido PED-001
node fabricante.js registrar-envio PED-001 TRK-001

# Mayorista recibe y el fabricante transfiere la custodia
node mayorista.js confirmar-recepcion-fabricante PED-001
node fabricante.js transferir-custodia SN-001 MayoristaMSP

# Minorista pide al mayorista
node minorista.js crear-pedido-mayorista PED-002 '[{"producto":"SN-001","cantidad":1,"precio":1200}]'
node mayorista.js aceptar-pedido-minorista PED-002
node mayorista.js registrar-envio-minorista PED-002 TRK-002
node minorista.js confirmar-recepcion-mayorista PED-002
node mayorista.js transferir-custodia SN-001 MinoristaMSP

# Minorista vende al cliente final y activa garantía
node minorista.js activar-garantia SN-001 cliente-juan 24

# Cualquiera puede verificar autenticidad
node minorista.js verificar-autenticidad SN-001
```

## Rellenar la blockchain con datos de demo (`seed-demo.js`)

Para enseñar el prototipo a inversores hace falta datos realistas en la red. El script `seed-demo.js` ejecuta **36 transacciones coherentes** repartidas en 4 historias:

| Historia | Qué cuenta | Estado final |
|---|---|---|
| **Catálogo** | 8 productos registrados (laptops, monitores, GPUs) | 8 productos en `canal-trazabilidad` |
| **P1** | Pedido completo: 2 laptops vendidas al cliente, garantías activas, una reclamación abierta y resuelta | Producto vendido + reclamación cerrada |
| **P2** | 2 monitores en tránsito al minorista (mayorista ya envió, sin confirmar recepción) | Pedido `ENVIADO` |
| **P3** | 3 productos pedidos por el mayorista, ya aceptados por el fabricante pero sin envío | Pedido `ACEPTADO` |
| **P4** | Pedido recién creado, sin aceptar | Pedido `CREADO` |

```bash
npm run seed                    # genera un prefix único (D{fecha}-{rand})
SEED_PREFIX=DEMO npm run seed   # prefix fijo (para demos repetibles)
```

El script imprime al final un **resumen para el presentador**: qué números de serie tienen garantía activa (para escanear desde la vista de Cliente final), y qué pedidos están en cada estado (para enseñar transiciones en vivo).

Para resetear y empezar de cero, hay que limpiar y redesplegar la red entera desde `solucion/`:

```bash
cd ..
bash scripts/99-clean-all.sh
bash scripts/01-setup-cas.sh && bash scripts/02-build-msps.sh && \
bash scripts/03-start-network.sh && bash scripts/04-create-channels.sh && \
bash scripts/05-deploy-chaincodes.sh
cd application && npm run seed
```

> En blockchain las transacciones no se borran. Cada `npm run seed` añade datos nuevos con un prefix distinto, así puedes acumular varias "tandas" de demo sin conflicto.

## API REST + Frontend web

El directorio `web/` contiene un servidor Express que sirve **dos cosas**:

1. La **API REST** con todas las operaciones de las 3 orgs + endpoints públicos para el cliente final + endpoints agregados de dashboard (`/api/dashboard`, `/api/pedido/:id`, `/api/producto/:serie/detalle`).
2. Un **frontend visual** (`public/`) con dashboard kanban en la pantalla de inicio, drawers clickables, vistas por rol con formularios y verificación QR-style del cliente final.

```bash
npm run api          # arranca el servidor en http://localhost:3000
npm run api:check    # sanity-check end-to-end vía HTTP
```

Después abre [http://localhost:3000](http://localhost:3000) en el navegador. La página de inicio muestra el estado de toda la red en tiempo real con kanban de pedidos por estado — sin necesidad de conocer ningún identificador.

- **Documentación de la API**: [web/API.md](web/API.md) — referencia completa de endpoints, parámetros, modelos de datos y ejemplos.
- **Spec OpenAPI 3.0**: [web/openapi.yaml](web/openapi.yaml) — para Swagger UI, Postman, generadores de clientes…
- **Guía operativa y frontend**: [web/README.md](web/README.md) — cómo arrancar, configurar y probar, más descripción del frontend.

## Variables de entorno

| Variable | Por defecto | Para qué |
|----------|-------------|----------|
| `DISTRIBUTECH_NETWORK_PATH` | `../network` | Ubicación del directorio `network/` con los MSPs y certificados |
| `DEBUG` | (no) | Si está definido, imprime stack traces completos en errores |
