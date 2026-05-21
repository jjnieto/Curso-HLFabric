# CouchDB en Fabric: ¿qué demonios estoy viendo?

Esta guía resuelve la pregunta que toca cuando entras por primera vez en
`http://localhost:5984/_utils`: **"vale, ¿y dónde está mi ledger?"**.
Vamos por partes — primero el porqué de CouchDB, después un paseo por
todo lo que ves en la interfaz, y al final qué guarda y qué NO guarda.

---

## 1. Recordatorio rápido: ¿por qué CouchDB y no LevelDB?

Fabric guarda el **world state** (el estado ACTUAL de las claves del
chaincode) en una base de datos clave→valor. Tienes dos opciones:

| Aspecto              | LevelDB (por defecto)                | CouchDB (opcional)                          |
|----------------------|--------------------------------------|---------------------------------------------|
| Tipo                 | Clave-valor pura, embebida           | Documental (JSON), servidor separado        |
| Velocidad            | Más rápida (vive dentro del peer)    | Algo más lenta (es un proceso externo)      |
| Consultas ricas      | Solo por clave o por rango de claves | Queries JSON (Mango), filtrado por campos   |
| Inspección visual    | No tiene UI — binario en disco       | Fauxton: navegador web cómodo               |
| Cuándo usarla        | Por defecto, redes pequeñas / KV     | Cuando guardas JSONs y quieres filtrar      |

Por eso para enseñar arrancamos con `-s couchdb`: nos interesa **poder
mirar dentro**. Para producción real con clave-valor simple, LevelDB es
más eficiente.

---

## 2. Llegar a Fauxton

Fauxton es el panel web de CouchDB. Una vez arrancada la red con
`./network.sh up createChannel -s couchdb`, abre en el navegador:

```
http://localhost:5984/_utils
```

Pide usuario y contraseña — en la test network son `admin` / `adminpw`
(definidos en el `docker-compose-couch.yaml`).

> ⚠ Si tienes varios peers (Org1, Org2…) cada uno tiene SU propio
> CouchDB en un puerto distinto: 5984, 7984, etc. Comprueba el
> `docker ps` para ver qué puertos están mapeados. Cada peer guarda
> SU PROPIA copia del world state — son réplicas, no compartidas.

---

## 3. Mapa del paisaje: ¿qué bases veo al entrar?

Al hacer login te aparecen varias databases. Las puedes agrupar en
tres familias:

### 3.1 Las del sistema (las puedes ignorar)

Empiezan con guion bajo. Las pone CouchDB para funcionar:

- `_users` — usuarios de CouchDB (no de Fabric).
- `_replicator` — configuración de replicación entre nodos CouchDB.
- `_global_changes` — feed de cambios global.

No las toques. **No tienen nada que ver con tu ledger**.

### 3.2 Las internas de Fabric (también las ignoras)

El peer crea algunas databases para su gestión interna:

- `_lifecycle_` — metadatos del chaincode lifecycle.
- `<canal>_lifecycle` — info de aprobaciones de chaincode por canal.

Mejor curiosearlas pero no modificarlas.

### 3.3 Las que TE INTERESAN — el world state

Aquí está lo que has venido a ver. Una database por cada combinación
**canal + chaincode**, con la nomenclatura:

```
<nombre-canal>_<nombre-chaincode>
```

Si has desplegado el chaincode `basic` en el canal `mychannel`, verás
una database llamada **`mychannel_basic`**.

Si despliegas el mismo chaincode `basic` en otro canal `canal2`,
aparecerá `canal2_basic` — TOTALMENTE INDEPENDIENTE. Recuerda: en
Fabric el ledger es por canal.

Si en el mismo canal despliegas dos chaincodes (`basic` y `tokens`),
verás `mychannel_basic` y `mychannel_tokens` — el world state está
particionado por chaincode.

> 💡 **Idea clave:** las databases de CouchDB son el world state de
> cada chaincode en cada canal. Una database = un (canal, chaincode).

---

## 4. Abriendo una database del world state

Pincha en `mychannel_basic`. Verás una lista de documentos JSON. Cada
documento es **una clave** del world state de ese chaincode.

Por ejemplo, si tu chaincode `basic` creó un activo con
`PutState("asset1", ...)`, encontrarás un documento con `_id: "asset1"`.

Pincha sobre él. Verás algo como:

```json
{
  "_id": "asset1",
  "_rev": "1-7d4c...",
  "AppraisedValue": 300,
  "Color": "blue",
  "ID": "asset1",
  "Owner": "Tomoko",
  "Size": 5,
  "~version": "0:0"
}
```

Vamos campo por campo, que aquí está el secreto:

### `_id` — la clave del world state

Es **EXACTAMENTE** la string que el chaincode usó como clave en
`PutState(key, value)`. Aquí: `asset1`. Si tu chaincode hizo
`PutState("MX:CONT2024-001", ...)`, ese sería el `_id`.

### `_rev` — la versión interna de CouchDB

No tiene nada que ver con Fabric. Es el mecanismo de control de
concurrencia optimista de CouchDB: cada actualización incrementa
`_rev`. Lo gestiona CouchDB en automático — tú nunca tocas esto.

### `~version` — la versión del peer (Fabric)

Esto SÍ es de Fabric. Formato `<blockHeight>:<txIndex>`. Te dice qué
bloque y qué transacción dentro de ese bloque dejó la clave en este
estado. **Es la pieza que Fabric usa para MVCC** (recuerda: detectar
si una simulación leyó un estado que entretanto ha cambiado).

### El resto de campos

Son **literalmente el JSON que tu chaincode pasó como valor**. Si tu
struct en Go era:

```go
type Asset struct {
    ID             string `json:"ID"`
    Color          string `json:"Color"`
    Size           int    `json:"Size"`
    Owner          string `json:"Owner"`
    AppraisedValue int    `json:"AppraisedValue"`
}
```

Y guardaste con `PutState("asset1", assetJSON)`, esos campos aparecen
tal cual. Por eso CouchDB es interesante: el valor NO es un blob
opaco como en LevelDB — son campos consultables.

---

## 5. ¿Y la blockchain? ¿Dónde están los bloques?

**No están en CouchDB.** Y esto es lo que más confunde.

Recuerda la dicotomía del ledger en Fabric:

```
Ledger = Blockchain (histórico inmutable)  +  World State (estado actual)
```

- **World State** → vive en CouchDB (o LevelDB). Es lo que VES en Fauxton.
- **Blockchain** → vive como ficheros binarios dentro del peer, en
  `/var/hyperledger/production/ledgersData/chains/chains/<canal>/`.
  Es la cadena de bloques propiamente dicha, y NO es accesible desde
  CouchDB ni Fauxton.

¿Por qué esta separación?

- La blockchain tiene que ser inmutable y ordenada → estructura tipo
  log de bloques, optimizada para append y verificación de hashes.
- El world state tiene que responder rápido a "dame el valor actual
  de la clave X" → estructura clave-valor o documental, optimizada
  para lookup.

CouchDB es solo el **caché consultable del estado actual**, derivado
de aplicar la cadena de bloques en orden. Si lo borras, el peer lo
reconstruye desde la blockchain. Si borras la blockchain, no hay vuelta
atrás.

Para ver bloques de verdad usa `peer channel fetch` o el Hyperledger
Explorer — no Fauxton.

---

## 6. La interfaz de Fauxton — qué botones importan

Dentro de una database verás varias pestañas:

- **All Documents** — lista de todas las claves del chaincode. Es lo
  que más usarás para inspeccionar.
- **Run a Query** — ejecuta queries Mango (JSON) para filtrar
  documentos por sus campos. Aquí está la potencia que LevelDB no
  tiene.
- **Permissions / Design Documents** — para usuario avanzado, no las
  necesitas en este nivel.

Ejemplo de Mango query desde Fauxton (botón "Run a Query"):

```json
{
  "selector": {
    "Owner": "Tomoko"
  }
}
```

Devuelve todos los activos cuyo `Owner` sea `"Tomoko"`. Esto es lo
que justifica usar CouchDB: en LevelDB tendrías que recorrer TODAS las
claves a mano.

> 💡 Para que el chaincode pueda hacer este tipo de queries en runtime
> (no solo desde Fauxton), conviene crear índices en
> `chaincode/META-INF/statedb/couchdb/indexes/`. Si los hay, Fabric
> los despliega solo al instalar el chaincode.

---

## 7. Tabla resumen para el alumno

| Lo que ves                  | Qué es                                            | Lo tocas tú? |
|-----------------------------|---------------------------------------------------|--------------|
| `_users`, `_replicator`…    | Internas de CouchDB                               | No           |
| `_lifecycle_`, `*_lifecycle`| Lifecycle de chaincode (Fabric)                   | No           |
| `mychannel_basic`           | World state del chaincode `basic` en `mychannel`  | **SÍ — aquí está tu ledger** |
| Documento con `_id: asset1` | Una clave guardada por `PutState("asset1", ...)`  | Solo lectura |
| `_id`                       | La clave (igual que pasaste a `PutState`)         | -            |
| `_rev`                      | Versión interna de CouchDB (concurrencia)         | Ignorar      |
| `~version`                  | Versión Fabric (bloque:tx). Usada por MVCC        | Ignorar      |
| Resto de campos             | El JSON que pasó tu chaincode como valor          | -            |

---

## 8. Errores típicos al explorar

- **"No veo mi activo recién creado"** → Refresca Fauxton. CouchDB
  no manda websockets a la UI; cada vista es una foto.
- **"La database de mi canal no existe"** → Espera a que el peer haga
  el primer `Init` o la primera transacción de escritura. Las
  databases de world state se crean **al ejecutar el primer PutState**,
  no al desplegar el chaincode.
- **"Veo `_id: 'asset1'` y `ID: 'asset1'` ¿son lo mismo?"** → Son dos
  cosas distintas que casualmente coinciden. `_id` es la clave de
  CouchDB (la que pasaste a `PutState`). `ID` es un CAMPO del JSON
  que tu chaincode decidió guardar dentro del valor. Si tu struct no
  tuviera campo `ID`, no aparecería — y `_id` seguiría ahí.
- **"Modifico un documento desde Fauxton y el chaincode no lo ve"**
  → No deberías hacer eso jamás. Si tocas el world state por debajo,
  rompes la coherencia con la blockchain. La próxima validación
  detectará la inconsistencia. Para cambiar el estado, INVOCA tu
  chaincode.

---

## 9. En una frase

CouchDB en Fabric es **el escaparate del world state**: te deja ver
y consultar el estado actual de cada chaincode en cada canal como
JSONs navegables. **No es** la blockchain — esa vive como ficheros
binarios dentro del peer y solo se ve con herramientas Fabric.

Si entiendes esa frase, sabes para qué sirve Fauxton y para qué no.
