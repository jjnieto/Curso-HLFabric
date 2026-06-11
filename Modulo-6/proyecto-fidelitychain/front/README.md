# FidelityChain — Frontal web

Interfaz web (React + Tailwind) con las mismas funciones que las apps de
consola: registrar clientes y emitir puntos (hotel), canjear puntos
(cafetería), ver saldos, historial, información del token y la lista de
clientes.

## Arquitectura

El navegador **no puede** hablar gRPC con Fabric directamente (el SDK
`fabric-network` es de Node), así que hay dos piezas:

```
Navegador ──HTTP──> front/server (Express + fabric-network) ──gRPC──> Red Fabric
   React/Tailwind        API REST en :3000                      peers + orderer
   en :5173
```

- **`server/`** — API REST en Node. Reutiliza el mismo connection profile que
  las apps de consola (los dos peers como avaladores, sin discovery) y mantiene
  una conexión por organización (HotelMSP y CafeteriaMSP).
- **`client/`** — SPA de React (Vite + Tailwind). En desarrollo, Vite reenvía
  `/api` al backend, así que no hay líos de CORS.

## Requisitos previos

La red **tiene que estar levantada y con el chaincode desplegado** (desde el
directorio del proyecto, `..`):

```bash
bash scripts/start-network.sh
bash scripts/deploy-chaincode.sh
```

Y necesitas Node.js >= 18 (el mismo de las apps de consola).

## Arranque (dos terminales)

**Terminal 1 — backend (API):**

```bash
cd front/server
npm install
npm start          # API en http://localhost:3000
```

Cuando veas `Conectado a la red Fabric (HotelMSP y CafeteriaMSP).` está listo.

**Terminal 2 — frontend (web):**

```bash
cd front/client
npm install
npm run dev        # web en http://localhost:5173
```

Abre **http://localhost:5173** en el navegador.

## Cómo usarlo

- Pestaña **Hotel**: registrar un cliente por DNI y emitir puntos.
- Pestaña **Cafetería**: elegir un producto del catálogo y canjear puntos.
- Abajo, la tabla de **clientes** con sus saldos; el botón *Ver* abre el
  historial de movimientos de cada cliente.
- Arriba, las cifras globales del token (emitido, canjeado, en circulación) se
  actualizan tras cada operación.

> Igual que en el chaincode: el hotel solo puede **emitir** y la cafetería solo
> **canjear**. Si la red no está arriba, la web lo avisa con un mensaje en rojo.

## Notas

- Puertos: API `3000`, web `5173`. Si cambias el de la API, ajusta también el
  `proxy` de `client/vite.config.js`.
- Para producción real se serviría el `client` ya compilado (`npm run build`)
  detrás del propio backend o de un servidor web, y la identidad no sería el
  Admin de la org. Aquí, al ser material docente, usamos el Admin como en las
  apps de consola.
