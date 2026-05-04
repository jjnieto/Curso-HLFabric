# SignChain — Frontend web

UI de una sola página sobre los scripts CLI de `application/`. **No los reemplaza**: reusa `utils/fabric-connection.js` y `utils/crypto.js` para hablar con la red, y los CLI siguen funcionando exactamente igual.

## Lo que puedes hacer

- Cambiar de rol (Cliente / Proveedor) desde el desplegable de la cabecera. La elección se guarda en `localStorage`.
- **Cliente**: crear documentos arrastrando un archivo (el navegador calcula su SHA-256, solo el hash sube al ledger).
- **Cliente o Proveedor**: firmar un documento subiendo el archivo original (la app verifica que el hash coincide con el del ledger antes de pedir la firma).
- Ver el estado de cada documento con un badge coloreado (`pending`, `approved-by-cliente`, `approved-by-proveedor`, `fully-approved`, `rejected`, `cancelled`).
- Ver detalle de un documento en una modal: hash completo, firmantes, cert ID de quien firmó, timestamps.
- Rechazar un documento (con motivo) o cancelarlo (solo el creador, antes de `fully-approved`).

La lista se refresca sola cada 10 s. Los toasts en la esquina inferior derecha confirman cada acción.

## Requisitos previos

Antes de levantar la web tienes que haber ejecutado los pasos `01..04` de la red y tener `application/node_modules` instalado (la web reusa esas dependencias para Fabric).

```bash
cd Modulo-2/practica
bash scripts/01-setup-cas.sh
bash scripts/02-build-msps.sh
bash scripts/03-start-network.sh
bash scripts/04-deploy-chaincode.sh
```

## Instalación

```bash
cd Modulo-2/practica/application/web
npm install
```

Esto baja `express`, `multer` y vuelve a referenciar `@hyperledger/fabric-gateway` y `@grpc/grpc-js` (idénticos a los del CLI).

## Ejecución

```bash
# Asegúrate de que el server sabe dónde está la red
export SIGNCHAIN_NETWORK_PATH="$(cd ../.. && pwd)/network"

npm start
# o:  PORT=8080 npm start
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

Por defecto el servidor escucha en `:3000`. Variable `PORT` para cambiarlo.

## Cómo se relaciona con los CLI

```
practica/application/
├── crear-documento.js       \
├── firmar-documento.js       > scripts CLI (intactos)
├── consultar-documento.js   /
├── utils/
│   ├── crypto.js             ← compartido por CLI y web
│   └── fabric-connection.js  ← compartido por CLI y web
└── web/                       ← este directorio
    ├── server.js              ← API REST que llama al Gateway
    └── public/                ← HTML + CSS + JS (sin build step)
```

Si haces una transacción desde la web, los CLI la ven y viceversa: ambos hablan con el mismo chaincode `signchain` en el mismo canal `signchain-channel`.

## Endpoints de la API (por si quieres llamarlos desde curl)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/health`                           | Comprobación rápida |
| `GET`  | `/api/documents?role=cliente`           | Lista todos los documentos |
| `GET`  | `/api/documents/:id?role=cliente`       | Detalle de un documento |
| `GET`  | `/api/documents/:id/history?role=...`   | Historial de cambios on-chain |
| `POST` | `/api/documents`                        | Crear (multipart: `file`, `id`, `title`, `description`). Cliente only. |
| `POST` | `/api/documents/:id/sign`               | Firmar (multipart: `file`, `role`). |
| `POST` | `/api/documents/:id/reject`             | Rechazar (JSON: `role`, `reason`). |
| `POST` | `/api/documents/:id/cancel`             | Cancelar (JSON: `role`). |

Ejemplo:

```bash
curl -F file=@./contrato.pdf -F id=DOC-9 -F title=Contrato \
  http://localhost:3000/api/documents
```

## Resolución de problemas

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `Error: ENOENT ... users/Admin@.../msp/signcerts` al arrancar | `SIGNCHAIN_NETWORK_PATH` mal o sin exportar | `export SIGNCHAIN_NETWORK_PATH="$(cd ../.. && pwd)/network"` |
| Pantalla en blanco con error en la consola del navegador | Servidor no arrancó. Mira el terminal donde corre `npm start` |
| Toast "endorsement policy failure" al firmar | Una de las peers está caída — la política es `AND(Cliente,Proveedor)` |
| Toast "el hash del archivo no coincide" | Has subido un archivo distinto al que se registró | Vuelve a subir el archivo original |
| "documento ya está totalmente aprobado" al firmar | Ya tiene las dos firmas | Acción esperada: estado `fully-approved` |

## Limpieza

```bash
rm -rf node_modules
```
