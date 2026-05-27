# DistribuTech — API REST + Frontend

Servidor HTTP único que expone:

- **API REST** con las operaciones de las 3 organizaciones, más un set público para el cliente final.
- **Frontend web** (`public/`) que demuestra visualmente el flujo: registro, pedidos, custodia, garantías y verificación del cliente final.

Pensado como prototipo demostrable a inversores.

> **📘 Documentación completa de la API**: [API.md](API.md). Este README es la guía operativa (cómo arrancar, configurar, probar). Para la referencia de endpoints, modelo de datos, ejemplos curl y formato de errores, ve a `API.md`.
>
> **🤖 Spec OpenAPI 3.0**: [openapi.yaml](openapi.yaml). Compatible con Swagger UI, Postman, Insomnia, openapi-generator (clientes en 50+ lenguajes), Prism (mock server), etc. Instrucciones en [API.md → Consumir la spec OpenAPI](API.md#consumir-la-spec-openapi).

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

Después abre [http://localhost:3000](http://localhost:3000) en el navegador para usar el **frontend web** (selector de rol y vista del cliente final con timeline de trazabilidad).

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

## Frontend

El servidor también sirve un frontend en `public/` (vanilla JS sin build):

- **Selector de rol** arriba a la derecha: Fabricante / Mayorista / Minorista / Cliente final.
- Cada rol tiene su panel con formularios para sus operaciones (color coded), un log de actividad y resultados inline.
- La vista de **Cliente final** es la "killer demo": el usuario introduce un número de serie y ve en pantalla 3 tarjetas (autenticidad ✓, garantía con fechas, trayectoria como timeline vertical con cada transferencia).

Estructura del frontend:

```
public/
├── index.html      # Estructura
├── styles.css      # Diseño moderno con variables CSS por rol
└── app.js          # Lógica de vistas, fetch() a la API y verificación pública
```

## Notas

- Todos los endpoints devuelven JSON. Los errores siguen el patrón `{ "error": "mensaje" }` con status HTTP coherente (404 si no existe, 500 si fallo interno).
- El servidor abre las 3 conexiones Gateway al arrancar; si alguna falla (por ejemplo, el peer del fabricante está caído), el servidor no arranca. Esto es intencional: prefiere fallar rápido a servir con conexiones parciales.
