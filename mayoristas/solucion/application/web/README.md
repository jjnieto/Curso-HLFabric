# DistribuTech — API REST

Servidor HTTP único que expone las operaciones de las 3 organizaciones por endpoints REST, más un set público para el cliente final.

Pensado como capa de integración para el frontend web (próximo paso) y como prototipo demostrable a inversores.

## Arquitectura

- **Un solo servidor Express** que internamente mantiene 3 conexiones Gateway (una por org), abiertas al arrancar y reutilizadas en cada request.
- Endpoints agrupados por rol: `/api/fabricante/*`, `/api/mayorista/*`, `/api/minorista/*`, `/api/public/*`.
- Los endpoints `/api/public/*` usan internamente la identidad del minorista para que el cliente final consulte sin necesidad de identidad propia.

## Arrancar

```bash
cd application      # desde solucion/
npm install         # solo la primera vez
npm run api         # arranca en http://localhost:3000
```

Variables de entorno:

| Variable | Por defecto | Para qué |
|----------|-------------|----------|
| `PORT` | `3000` | Puerto HTTP |
| `DISTRIBUTECH_NETWORK_PATH` | `../../network` | Ubicación de los MSPs |

## Sanity check

Arranca el servidor como subproceso, prueba el flujo completo vía HTTP, y lo apaga al terminar:

```bash
npm run api:check
```

Si ya tienes el servidor corriendo y quieres ejecutar las pruebas contra él, usa `NO_SPAWN=1 npm run api:check`.

## Endpoints

### Health

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Status y orgs conectadas |

### Fabricante (`/api/fabricante`)

| Método | Path | Body |
|--------|------|------|
| POST | `/registrar-producto` | `{ serie, modelo, lote }` |
| POST | `/transferir-custodia` | `{ serie, destinoMSP }` |
| POST | `/aceptar-pedido` | `{ pedidoId }` |
| POST | `/registrar-envio` | `{ pedidoId, tracking }` |
| POST | `/resolver-reclamacion` | `{ reclamacionId, resolucion, aceptada }` |
| GET | `/producto/:serie` | — |
| GET | `/pedido/:id` | (canal-mayorista) |

### Mayorista (`/api/mayorista`)

| Método | Path | Body |
|--------|------|------|
| POST | `/crear-pedido-fabricante` | `{ pedidoId, lineas: [{ producto, cantidad, precio }] }` |
| POST | `/confirmar-recepcion-fabricante` | `{ pedidoId }` |
| POST | `/transferir-custodia` | `{ serie, destinoMSP }` |
| POST | `/aceptar-pedido-minorista` | `{ pedidoId }` |
| POST | `/registrar-envio-minorista` | `{ pedidoId, tracking }` |
| GET | `/producto/:serie` | — |
| GET | `/pedido-fabricante/:id` | (canal-mayorista) |
| GET | `/pedido-minorista/:id` | (canal-minorista) |

### Minorista (`/api/minorista`)

| Método | Path | Body |
|--------|------|------|
| POST | `/crear-pedido-mayorista` | `{ pedidoId, lineas }` |
| POST | `/confirmar-recepcion-mayorista` | `{ pedidoId }` |
| POST | `/activar-garantia` | `{ serie, clienteFinal, meses }` |
| POST | `/reclamar-garantia` | `{ serie, motivo }` → devuelve `reclamacionId` |
| GET | `/producto/:serie` | — |
| GET | `/garantia/:serie` | — |
| GET | `/pedido/:id` | — |

### Público (cliente final, sin auth)

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/public/producto/:serie` | Datos del producto (sin precios ni datos comerciales) |
| GET | `/api/public/garantia/:serie` | Estado de la garantía |
| GET | `/api/public/trazabilidad/:serie` | Historial completo de custodia |

## Ejemplo de uso con curl

```bash
# Health
curl http://localhost:3000/api/health

# Fabricante registra producto
curl -X POST http://localhost:3000/api/fabricante/registrar-producto \
  -H "Content-Type: application/json" \
  -d '{"serie":"SN-1234","modelo":"Laptop X","lote":"L001"}'

# Cliente final verifica autenticidad
curl http://localhost:3000/api/public/producto/SN-1234
curl http://localhost:3000/api/public/trazabilidad/SN-1234
```

## Notas

- Todos los endpoints devuelven JSON. Los errores siguen el patrón `{ "error": "mensaje" }` con status HTTP coherente (404 si no existe, 500 si fallo interno).
- El servidor abre las 3 conexiones Gateway al arrancar; si alguna falla (por ejemplo, el peer del fabricante está caído), el servidor no arranca. Esto es intencional: prefiere fallar rápido a servir con conexiones parciales.
