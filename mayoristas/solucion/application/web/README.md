# DistribuTech — API REST

Servidor HTTP único que expone las operaciones de las 3 organizaciones por endpoints REST, más un set público para el cliente final.

Pensado como capa de integración para el frontend web (próximo paso) y como prototipo demostrable a inversores.

> **📘 Documentación completa de la API**: [API.md](API.md). Este README es la guía operativa (cómo arrancar, configurar, probar). Para la referencia de endpoints, modelo de datos, ejemplos curl y formato de errores, ve a `API.md`.

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

## Resumen de endpoints

Ver [API.md](API.md) para la referencia completa con parámetros, payloads, ejemplos y modelos de datos. Resumen rápido:

| Grupo | Endpoints |
|---|---|
| Sistema | `GET /api/health` |
| Fabricante (`/api/fabricante`) | 5 POST + 2 GET |
| Mayorista (`/api/mayorista`) | 5 POST + 3 GET |
| Minorista (`/api/minorista`) | 4 POST + 3 GET |
| Público (`/api/public`, sin auth) | 3 GET (producto, garantía, trazabilidad) |

## Notas

- Todos los endpoints devuelven JSON. Los errores siguen el patrón `{ "error": "mensaje" }` con status HTTP coherente (404 si no existe, 500 si fallo interno).
- El servidor abre las 3 conexiones Gateway al arrancar; si alguna falla (por ejemplo, el peer del fabricante está caído), el servidor no arranca. Esto es intencional: prefiere fallar rápido a servir con conexiones parciales.
