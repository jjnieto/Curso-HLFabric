# DistribuTech API

Documentación de referencia de la API REST de DistribuTech.

La API expone las operaciones de las tres organizaciones de la red Fabric (**Fabricante**, **Mayorista**, **Minorista**) y un set de endpoints públicos para el **cliente final**.

> **🤖 Spec OpenAPI 3.0**: [openapi.yaml](openapi.yaml). Importa este fichero en Swagger UI, Postman, Insomnia, Stoplight o cualquier herramienta compatible para generar UI interactiva, clientes en cualquier lenguaje, mocks o tests de contrato. Ver [#consumir-la-spec-openapi](#consumir-la-spec-openapi) más abajo.

---

## Tabla de contenidos

- [Visión general](#visión-general)
- [URL base](#url-base)
- [Autenticación y autorización](#autenticación-y-autorización)
- [Formato de petición y respuesta](#formato-de-petición-y-respuesta)
- [Códigos de estado](#códigos-de-estado)
- [Formato de errores](#formato-de-errores)
- [Modelo de datos](#modelo-de-datos)
- **Endpoints**
  - [Sistema](#sistema)
  - [Fabricante](#fabricante)
  - [Mayorista](#mayorista)
  - [Minorista](#minorista)
  - [Públicos (cliente final)](#públicos-cliente-final)
- [Flujo de ejemplo end-to-end](#flujo-de-ejemplo-end-to-end)
- [Idempotencia y reintentos](#idempotencia-y-reintentos)
- [Consumir la spec OpenAPI](#consumir-la-spec-openapi)
- [Versiones](#versiones)

---

## Visión general

La API es una **capa de integración HTTP** entre cualquier cliente (frontend web, app móvil, sistemas ERP de terceros) y la red blockchain Hyperledger Fabric.

- Cada endpoint encapsula una invocación al **chaincode** correspondiente sobre el **canal** adecuado.
- El servidor mantiene **3 conexiones Gateway abiertas** (una por organización) y las reutiliza por request: el coste de cada petición es solo el roundtrip al peer + endorsement.
- Las respuestas son JSON, las transacciones de escritura llegan al ledger antes de devolver `200 OK`.

```
Cliente HTTP ─────►  API REST (Express)  ─────►  Peers Fabric  ─────►  Ledger
                          │
                          ├──► identidad FabricanteMSP
                          ├──► identidad MayoristaMSP
                          └──► identidad MinoristaMSP
```

---

## URL base

```
http://localhost:3000
```

Configurable con la variable de entorno `PORT`. En producción se desplegará detrás de un proxy con TLS.

---

## Autenticación y autorización

La versión actual está pensada para el **prototipo de demostración** y simplifica la autenticación:

| Tipo de endpoint | Autenticación | Autorización |
|---|---|---|
| `/api/fabricante/*` | Confianza en la red local | El servidor firma con la identidad **FabricanteMSP** |
| `/api/mayorista/*` | Confianza en la red local | El servidor firma con la identidad **MayoristaMSP** |
| `/api/minorista/*` | Confianza en la red local | El servidor firma con la identidad **MinoristaMSP** |
| `/api/public/*` | Ninguna | Solo consultas de información pública |

> **Producción**: cada organización tendrá su propio backend con su propia identidad. La capa de autenticación (OAuth/JWT/mTLS) y la pertenencia a una org concreta determinarán qué endpoints son accesibles. El chaincode aplica además **ACL en código** (por ejemplo, solo `FabricanteMSP` puede llamar a `RegistrarProducto`), de modo que la seguridad no depende exclusivamente del API gateway.

---

## Formato de petición y respuesta

- **Content-Type**: `application/json` en todas las peticiones con cuerpo.
- **Charset**: UTF-8.
- **Body**: JSON. Los campos string que representan identificadores son sensibles a mayúsculas.
- **Respuesta exitosa**: siempre JSON, con `Content-Type: application/json; charset=utf-8`.

### Cabeceras recomendadas

```http
Content-Type: application/json
Accept: application/json
```

---

## Códigos de estado

| Código | Significado |
|---|---|
| `200 OK` | Operación completada. La transacción ya está commiteada en el ledger (en escrituras) o el dato existe (en lecturas). |
| `400 Bad Request` | JSON malformado o faltan campos obligatorios. |
| `404 Not Found` | Recurso solicitado no existe (producto, pedido, garantía…). |
| `409 Conflict` | Operación rechazada por el chaincode por estado inválido (por ejemplo, intentar `AceptarPedido` sobre uno que ya está `ENVIADO`). |
| `500 Internal Server Error` | Fallo inesperado: peer no disponible, endorsement fallido, etc. |

> Nota: el chaincode rechaza por validación lógica (estados, ACL) con errores que la API actualmente mapea a `500`. En una revisión futura se traducirán a `409` cuando el motivo sea un estado incorrecto.

---

## Formato de errores

Todos los errores devuelven un cuerpo JSON uniforme:

```json
{
  "error": "Descripción legible del error"
}
```

Ejemplo (404):

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{
  "error": "el producto SN-NO-EXISTE no existe"
}
```

---

## Modelo de datos

### `Producto`

| Campo | Tipo | Descripción |
|---|---|---|
| `numeroSerie` | string | Identificador único del producto |
| `modelo` | string | Modelo comercial |
| `lote` | string | Lote de fabricación |
| `fechaFabricacion` | string (RFC3339) | Fecha en la que el fabricante registró el producto |
| `propietarioActual` | string | MSP ID del propietario actual (`FabricanteMSP`, `MayoristaMSP`, `MinoristaMSP`) |
| `estado` | enum | `REGISTRADO`, `EN_TRANSITO` |

### `TransferenciaCustodia`

| Campo | Tipo | Descripción |
|---|---|---|
| `numeroSerie` | string | Producto al que pertenece la transferencia |
| `origen` | string | MSP ID que tenía la custodia |
| `destino` | string | MSP ID que recibe la custodia |
| `fecha` | string (RFC3339) | Momento de la transferencia |
| `txID` | string | Hash de la transacción Fabric |

### `Garantia`

| Campo | Tipo | Descripción |
|---|---|---|
| `numeroSerie` | string | Producto cubierto |
| `clienteFinal` | string | Identificador del cliente al que se vendió |
| `fechaActivacion` | string (RFC3339) | Fecha de venta |
| `fechaExpiracion` | string (RFC3339) | Fecha de fin de cobertura |
| `estado` | enum | `ACTIVA`, `RECLAMADA`, `RESUELTA` |

### `Pedido`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Identificador único del pedido |
| `comprador` | string | MSP ID del comprador |
| `vendedor` | string | MSP ID del vendedor (relleno al aceptar) |
| `lineas` | array de `LineaPedido` | Líneas del pedido |
| `estado` | enum | `CREADO`, `ACEPTADO`, `ENVIADO`, `RECIBIDO` |
| `tracking` | string | Código de tracking del envío |
| `fechaCreacion` | string (RFC3339) | Fecha de creación |
| `fechaActualizacion` | string (RFC3339) | Última transición de estado |

### `LineaPedido`

| Campo | Tipo | Descripción |
|---|---|---|
| `producto` | string | Identificador del producto pedido |
| `cantidad` | integer | Número de unidades |
| `precio` | number | Precio unitario acordado |

---

# Endpoints

## Sistema

### `GET /api/health`

Health check del servidor. Útil para load balancers y monitorización.

**Respuesta** — `200 OK`

```json
{
  "status": "ok",
  "orgs": ["fabricante", "mayorista", "minorista"]
}
```

**Ejemplo**

```bash
curl http://localhost:3000/api/health
```

---

## Fabricante

Endpoints invocados con la identidad **FabricanteMSP**.

### `POST /api/fabricante/registrar-producto`

Registra una nueva unidad de producto en el ledger. Solo el fabricante puede ejecutarla.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | string | sí | Número de serie único del producto |
| `modelo` | string | sí | Modelo comercial |
| `lote` | string | sí | Lote de fabricación |

**Respuesta** — `200 OK`

```json
{ "ok": true, "serie": "SN-1234" }
```

**Errores**

| Código | Razón |
|---|---|
| `500` | La serie ya existe en el ledger |

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/fabricante/registrar-producto \
  -H "Content-Type: application/json" \
  -d '{"serie":"SN-1234","modelo":"Laptop X","lote":"L001"}'
```

---

### `POST /api/fabricante/transferir-custodia`

Transfiere la custodia de un producto del fabricante al siguiente eslabón de la cadena (típicamente `MayoristaMSP`).

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | string | sí | Número de serie |
| `destinoMSP` | string | sí | MSP ID de destino. Debe ser una org válida del canal |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

**Errores**

| Código | Razón |
|---|---|
| `500` | El producto no existe o el invocante no es el propietario actual |

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/fabricante/transferir-custodia \
  -H "Content-Type: application/json" \
  -d '{"serie":"SN-1234","destinoMSP":"MayoristaMSP"}'
```

---

### `POST /api/fabricante/aceptar-pedido`

Acepta un pedido creado por un mayorista. Cambia el estado del pedido a `ACEPTADO`.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido en `canal-mayorista` |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/fabricante/aceptar-pedido \
  -H "Content-Type: application/json" \
  -d '{"pedidoId":"PED-001"}'
```

---

### `POST /api/fabricante/registrar-envio`

Marca un pedido aceptado como `ENVIADO` y registra el código de tracking del transporte.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido |
| `tracking` | string | sí | Código de tracking |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/fabricante/registrar-envio \
  -H "Content-Type: application/json" \
  -d '{"pedidoId":"PED-001","tracking":"TRK-ABC123"}'
```

---

### `POST /api/fabricante/resolver-reclamacion`

Acepta o rechaza una reclamación de garantía abierta por el minorista.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reclamacionId` | string | sí | Identificador devuelto por `POST /minorista/reclamar-garantia` |
| `resolucion` | string | sí | Texto explicativo de la decisión |
| `aceptada` | boolean | sí | `true` para aceptar (cubre garantía), `false` para rechazar |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/fabricante/resolver-reclamacion \
  -H "Content-Type: application/json" \
  -d '{"reclamacionId":"REC~SN-1234~abc","resolucion":"Sustituido por unidad nueva","aceptada":true}'
```

---

### `GET /api/fabricante/producto/:serie`

Consulta el estado actual de un producto.

**Parámetros de ruta**

| Nombre | Tipo | Descripción |
|---|---|---|
| `serie` | string | Número de serie |

**Respuesta** — `200 OK` (objeto [`Producto`](#producto))

```json
{
  "docType": "producto",
  "numeroSerie": "SN-1234",
  "modelo": "Laptop X",
  "lote": "L001",
  "fechaFabricacion": "2026-05-27T16:20:00+02:00",
  "propietarioActual": "MayoristaMSP",
  "estado": "EN_TRANSITO"
}
```

**Errores**

| Código | Razón |
|---|---|
| `404` | El producto no existe |

**Ejemplo**

```bash
curl http://localhost:3000/api/fabricante/producto/SN-1234
```

---

### `GET /api/fabricante/pedido/:id`

Consulta un pedido en `canal-mayorista`. Solo visible para Fabricante y Mayorista.

**Respuesta** — `200 OK` (objeto [`Pedido`](#pedido))

```json
{
  "docType": "pedido",
  "id": "PED-001",
  "comprador": "MayoristaMSP",
  "vendedor": "FabricanteMSP",
  "lineas": [{ "producto": "SN-1234", "cantidad": 1, "precio": 900 }],
  "estado": "RECIBIDO",
  "tracking": "TRK-ABC123",
  "fechaCreacion": "2026-05-27T16:20:00+02:00",
  "fechaActualizacion": "2026-05-27T16:35:12+02:00"
}
```

---

## Mayorista

Endpoints invocados con la identidad **MayoristaMSP**.

### `POST /api/mayorista/crear-pedido-fabricante`

Crea un pedido al fabricante en `canal-mayorista`.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador único del pedido |
| `lineas` | array de [`LineaPedido`](#lineapedido) | sí | Al menos una línea |

**Respuesta** — `200 OK`

```json
{ "ok": true, "pedidoId": "PED-001" }
```

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/mayorista/crear-pedido-fabricante \
  -H "Content-Type: application/json" \
  -d '{
    "pedidoId": "PED-001",
    "lineas": [
      { "producto": "SN-1234", "cantidad": 10, "precio": 850.00 }
    ]
  }'
```

---

### `POST /api/mayorista/confirmar-recepcion-fabricante`

Confirma que el mayorista ha recibido la mercancía del fabricante. Cambia el estado del pedido a `RECIBIDO`.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

---

### `POST /api/mayorista/transferir-custodia`

Transfiere la custodia de un producto al minorista. El mayorista debe ser el propietario actual.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | string | sí | Número de serie |
| `destinoMSP` | string | sí | Típicamente `MinoristaMSP` |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

---

### `POST /api/mayorista/aceptar-pedido-minorista`

Acepta un pedido del minorista en `canal-minorista`.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

---

### `POST /api/mayorista/registrar-envio-minorista`

Marca un pedido del minorista como enviado y registra el tracking.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido |
| `tracking` | string | sí | Código de tracking |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

---

### `GET /api/mayorista/producto/:serie`

Igual que `GET /api/fabricante/producto/:serie` pero invocado con la identidad del mayorista. Devuelve el mismo objeto [`Producto`](#producto).

---

### `GET /api/mayorista/pedido-fabricante/:id`

Consulta un pedido del mayorista al fabricante (en `canal-mayorista`).

**Respuesta** — `200 OK` (objeto [`Pedido`](#pedido))

---

### `GET /api/mayorista/pedido-minorista/:id`

Consulta un pedido del minorista al mayorista (en `canal-minorista`). Misma estructura.

---

## Minorista

Endpoints invocados con la identidad **MinoristaMSP**.

### `POST /api/minorista/crear-pedido-mayorista`

Crea un pedido al mayorista en `canal-minorista`.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador único del pedido |
| `lineas` | array de [`LineaPedido`](#lineapedido) | sí | Al menos una línea |

**Respuesta** — `200 OK`

```json
{ "ok": true, "pedidoId": "PED-002" }
```

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/minorista/crear-pedido-mayorista \
  -H "Content-Type: application/json" \
  -d '{
    "pedidoId": "PED-002",
    "lineas": [
      { "producto": "SN-1234", "cantidad": 1, "precio": 1200.00 }
    ]
  }'
```

---

### `POST /api/minorista/confirmar-recepcion-mayorista`

Confirma que el minorista ha recibido la mercancía del mayorista.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `pedidoId` | string | sí | Identificador del pedido |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

---

### `POST /api/minorista/activar-garantia`

Activa la garantía de un producto en el momento de la venta al cliente final.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | string | sí | Número de serie |
| `clienteFinal` | string | sí | Identificador del cliente (email, DNI, ID interno…) |
| `meses` | integer | sí | Duración de la cobertura en meses |

**Respuesta** — `200 OK`

```json
{ "ok": true }
```

**Errores**

| Código | Razón |
|---|---|
| `500` | Ya existe una garantía activa para esa serie |

**Ejemplo**

```bash
curl -X POST http://localhost:3000/api/minorista/activar-garantia \
  -H "Content-Type: application/json" \
  -d '{"serie":"SN-1234","clienteFinal":"cliente@example.com","meses":24}'
```

---

### `POST /api/minorista/reclamar-garantia`

Abre una reclamación de garantía contra el fabricante.

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | string | sí | Número de serie |
| `motivo` | string | sí | Descripción del defecto |

**Respuesta** — `200 OK`

```json
{
  "ok": true,
  "reclamacionId": "REC~SN-1234~b1623a..."
}
```

El `reclamacionId` se pasa después a `POST /api/fabricante/resolver-reclamacion`.

**Errores**

| Código | Razón |
|---|---|
| `500` | La garantía no existe o no está `ACTIVA` |

---

### `GET /api/minorista/producto/:serie`

Igual que el endpoint análogo del fabricante.

---

### `GET /api/minorista/garantia/:serie`

Consulta el estado de la garantía de un producto.

**Respuesta** — `200 OK` (objeto [`Garantia`](#garantia))

```json
{
  "docType": "garantia",
  "numeroSerie": "SN-1234",
  "clienteFinal": "cliente@example.com",
  "fechaActivacion": "2026-05-27T18:00:00+02:00",
  "fechaExpiracion": "2028-05-27T18:00:00+02:00",
  "estado": "ACTIVA"
}
```

---

### `GET /api/minorista/pedido/:id`

Consulta un pedido en `canal-minorista`.

---

## Públicos (cliente final)

Endpoints **sin autenticación**, pensados para que el cliente final escanee el QR del producto y verifique su autenticidad y garantía desde el navegador o una app móvil. Internamente usan la identidad del minorista para consultar el ledger.

### `GET /api/public/producto/:serie`

Devuelve los datos públicos de un producto: serie, modelo, lote, fecha de fabricación y estado. **No expone precios, propietarios ni datos comerciales.**

**Respuesta** — `200 OK`

```json
{
  "numeroSerie": "SN-1234",
  "modelo": "Laptop X",
  "lote": "L001",
  "fechaFabricacion": "2026-05-27T16:20:00+02:00",
  "estado": "EN_TRANSITO"
}
```

**Errores**

| Código | Razón |
|---|---|
| `404` | El producto no existe — posible falsificación |

**Ejemplo**

```bash
curl https://api.distributech.com/api/public/producto/SN-1234
```

---

### `GET /api/public/garantia/:serie`

Devuelve el estado de la garantía. Útil para que el cliente verifique cobertura.

**Respuesta** — `200 OK` (objeto [`Garantia`](#garantia))

**Errores**

| Código | Razón |
|---|---|
| `404` | No se ha activado garantía para este producto |

---

### `GET /api/public/trazabilidad/:serie`

Devuelve el historial completo de custodia del producto, demostrando su autenticidad de extremo a extremo.

**Respuesta** — `200 OK`

```json
{
  "numeroSerie": "SN-1234",
  "autenticidad": "verificada",
  "transferencias": [
    {
      "docType": "transferencia",
      "numeroSerie": "SN-1234",
      "origen": "FabricanteMSP",
      "destino": "MayoristaMSP",
      "fecha": "2026-05-27T16:25:00+02:00",
      "txID": "a1b2c3..."
    },
    {
      "docType": "transferencia",
      "numeroSerie": "SN-1234",
      "origen": "MayoristaMSP",
      "destino": "MinoristaMSP",
      "fecha": "2026-05-27T17:40:00+02:00",
      "txID": "d4e5f6..."
    }
  ]
}
```

Si el array está vacío, el producto fue registrado pero nunca transferido (algo raro a la hora de comprarlo al minorista).

---

## Flujo de ejemplo end-to-end

Ciclo completo de vida de un producto, desde fábrica hasta cliente final:

```bash
BASE=http://localhost:3000
SERIE=SN-DEMO-001
PED_MAY=PED-MAY-001
PED_MIN=PED-MIN-001
CLIENTE=cliente@demo.com

# 1. Fabricante registra el producto
curl -X POST $BASE/api/fabricante/registrar-producto \
  -H "Content-Type: application/json" \
  -d "{\"serie\":\"$SERIE\",\"modelo\":\"Laptop X\",\"lote\":\"L001\"}"

# 2. Mayorista crea un pedido al fabricante
curl -X POST $BASE/api/mayorista/crear-pedido-fabricante \
  -H "Content-Type: application/json" \
  -d "{
    \"pedidoId\":\"$PED_MAY\",
    \"lineas\":[{\"producto\":\"$SERIE\",\"cantidad\":1,\"precio\":850}]
  }"

# 3. Fabricante acepta, envía y registra tracking
curl -X POST $BASE/api/fabricante/aceptar-pedido -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MAY\"}"
curl -X POST $BASE/api/fabricante/registrar-envio -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MAY\",\"tracking\":\"TRK-001\"}"

# 4. Mayorista confirma recepción y el fabricante transfiere custodia
curl -X POST $BASE/api/mayorista/confirmar-recepcion-fabricante -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MAY\"}"
curl -X POST $BASE/api/fabricante/transferir-custodia -H "Content-Type: application/json" -d "{\"serie\":\"$SERIE\",\"destinoMSP\":\"MayoristaMSP\"}"

# 5. Minorista pide al mayorista, mayorista acepta, envía y transfiere
curl -X POST $BASE/api/minorista/crear-pedido-mayorista -H "Content-Type: application/json" \
  -d "{\"pedidoId\":\"$PED_MIN\",\"lineas\":[{\"producto\":\"$SERIE\",\"cantidad\":1,\"precio\":1200}]}"
curl -X POST $BASE/api/mayorista/aceptar-pedido-minorista -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MIN\"}"
curl -X POST $BASE/api/mayorista/registrar-envio-minorista -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MIN\",\"tracking\":\"TRK-002\"}"
curl -X POST $BASE/api/minorista/confirmar-recepcion-mayorista -H "Content-Type: application/json" -d "{\"pedidoId\":\"$PED_MIN\"}"
curl -X POST $BASE/api/mayorista/transferir-custodia -H "Content-Type: application/json" -d "{\"serie\":\"$SERIE\",\"destinoMSP\":\"MinoristaMSP\"}"

# 6. Minorista vende y activa la garantía
curl -X POST $BASE/api/minorista/activar-garantia -H "Content-Type: application/json" \
  -d "{\"serie\":\"$SERIE\",\"clienteFinal\":\"$CLIENTE\",\"meses\":24}"

# 7. Cliente final verifica autenticidad y garantía
curl $BASE/api/public/producto/$SERIE
curl $BASE/api/public/garantia/$SERIE
curl $BASE/api/public/trazabilidad/$SERIE
```

---

## Idempotencia y reintentos

- Las operaciones de **creación** (registrar producto, crear pedido, activar garantía) son **idempotentes por ID**: si reintentas con el mismo identificador, el chaincode rechaza la segunda llamada con `500`. La aplicación cliente debe tratar ese error como éxito si tiene confirmación de que la primera llegó al ledger.
- Las operaciones de **transición de estado** (aceptar pedido, registrar envío, confirmar recepción) **no son idempotentes**: aplicar dos veces falla porque el estado ya cambió. Si recibes un error tras un reintento, **consulta el estado** con el endpoint `GET` correspondiente antes de declarar fallo.
- Las consultas (`GET *`) son **siempre seguras** y se pueden reintentar sin efectos colaterales.

---

## Consumir la spec OpenAPI

El fichero [`openapi.yaml`](openapi.yaml) cumple con OpenAPI 3.0.3. Sirve para muchísimo más que documentación legible:

### Visualizarla como UI interactiva (Swagger UI)

```bash
# Opción 1 — Docker (sin instalar nada local)
docker run --rm -p 8080:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v "$(pwd):/spec" \
  swaggerapi/swagger-ui

# Abre http://localhost:8080 — UI navegable con botones "Try it out"
```

```bash
# Opción 2 — Redoc CLI (UI más limpia, estática)
npx @redocly/cli build-docs openapi.yaml -o api-docs.html
xdg-open api-docs.html
```

### Importarla en clientes habituales

| Herramienta | Cómo |
|---|---|
| **Postman** | `Import` → arrastra `openapi.yaml` → genera colección automáticamente |
| **Insomnia** | `Create` → `Import From` → `File` → `openapi.yaml` |
| **Bruno** | `Open Collection` → soporte OpenAPI nativo |
| **VSCode** | Extensión `42Crunch.vscode-openapi` (preview + linting) |
| **JetBrains** | Soporte nativo: abre el `.yaml` y pulsa "Try it" en cada endpoint |

### Generar clientes en cualquier lenguaje

Con [openapi-generator](https://openapi-generator.tech/):

```bash
# Cliente TypeScript axios
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml -g typescript-axios -o ./clients/ts

# Cliente Python
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml -g python -o ./clients/python

# Cliente Go
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml -g go -o ./clients/go
```

Soporta 50+ lenguajes y frameworks. Útil para que un cliente potencial pueda probar la integración con su stack en minutos.

### Mock server (sin red Fabric)

Si quieres enseñar la API a alguien sin levantar la red entera:

```bash
npx @stoplight/prism-cli mock openapi.yaml
# Levanta un mock en http://localhost:4010 que devuelve los `example:` de la spec
```

### Tests de contrato

Validar que el servidor real cumple con la spec:

```bash
npx @apidevtools/swagger-cli validate openapi.yaml
npx dredd openapi.yaml http://localhost:3000
```

---

## Versiones

| Versión | Fecha | Cambios |
|---|---|---|
| `0.1` (actual) | 2026-05-27 | Versión inicial — prototipo para demostraciones. Incluye spec OpenAPI 3.0.3. |

Próximas mejoras planificadas:

- Mapeo de errores de estado de chaincode a HTTP `409`.
- Autenticación JWT en endpoints de organizaciones.
- Endpoint de eventos (Server-Sent Events) para que los frontends reaccionen a transiciones en tiempo real.
