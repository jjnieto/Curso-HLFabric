# Práctica: Montar una red P2P de Ethereum con Geth

> **Objetivo**: cada alumno arranca su propio nodo Geth con un `genesis.json` común, los conecta a los nodos de los compañeros por enode URL, y ve en directo cómo se forma una red P2P y cómo se propagan los bloques minados. Es la versión "tangible" de la slide de redes P2P.

## Herramientas que vas a usar

- **Geth** (Go Ethereum) 1.11.6 para Windows 386 — `geth-windows-386-1.11.6-ea9e62ca.exe`. En lo que sigue lo llamamos `geth.exe`.
- Un archivo **`genesis.json`** ya preparado, dentro de la carpeta `mychaindata/`. Define el bloque cero, el `chainId`, los validadores iniciales si usas Clique, etc.
- Una terminal de Windows (`cmd` o PowerShell). Si usas WSL/Linux, los comandos son idénticos cambiando `geth.exe` por `geth` y los `^` finales por `\`.

## Conceptos clave

| Concepto | Qué es |
|----------|--------|
| **Genesis block** | El bloque cero. Lo describe `genesis.json`. Todos los nodos de tu red tienen que arrancar con el mismo, o no se entenderán. |
| **`--datadir`** | Carpeta donde Geth guarda la blockchain, las cuentas (keystore), los peers conocidos y los logs. |
| **`networkid`** | Identificador numérico de tu red privada. Si dos nodos no coinciden en `networkid`, ni siquiera intentan hablar. |
| **enode URL** | Dirección única de un nodo: `enode://<nodeID>@<ip>:<puerto>`. Es como su "número de teléfono" en la red P2P. |
| **Bootnodes** | Nodos conocidos a los que un nuevo nodo se conecta para entrar en la red. |
| **Consenso (Clique / Ethash)** | Cómo se acuerdan los bloques. En redes privadas con Geth 1.11.6 lo más simple es **Clique** (PoA), que ya estará configurado en tu `genesis.json`. |

---

## Parte 1 — Inicializar la BBDD

### Ejercicio 1.1 — Init con `genesis.json`

Antes de arrancar el nodo hay que crear las estructuras internas a partir del bloque génesis. Esto se hace **una sola vez** por cada `--datadir`.

```bat
geth.exe --datadir mychaindata init mychaindata\genesis.json
```

Salida esperada (algo así):

```
INFO [...] Maximum peer count                         ETH=50 LES=0 total=50
INFO [...] Set global gas cap                         cap=50000000
INFO [...] Allocated cache and file handles           database=...\chaindata
INFO [...] Writing custom genesis block
INFO [...] Persisted trie from memory database        nodes=1 size=...
INFO [...] Successfully wrote genesis state           database=chaindata hash=0x...
```

Y dentro de `mychaindata/` aparecen ahora dos carpetas nuevas:

```
mychaindata/
├── genesis.json
├── geth/
│   └── chaindata/    ← la blockchain en sí (LevelDB)
└── keystore/         ← las claves privadas de las cuentas que crees
```

**Pregunta**: ¿qué pasa si lanzas `init` dos veces sobre el mismo `--datadir`?

> La segunda vez Geth detecta que la chaindata ya existe y se queja, **a menos que el genesis.json sea exactamente el mismo**. No te dejará "cambiar" el genesis sobre una base de datos ya inicializada — eso protege la cadena contra hard-forks accidentales.

---

## Parte 2 — Arrancar el nodo

### Ejercicio 2.1 — Arranque con consola JavaScript

```bat
geth.exe --datadir mychaindata ^
         --networkid 12345 ^
         --port 30303 ^
         --http --http.addr 0.0.0.0 --http.port 8545 ^
         --http.api "eth,net,web3,personal,admin,miner" ^
         --http.corsdomain "*" ^
         --allow-insecure-unlock ^
         --nodiscover ^
         console
```

> En PowerShell el carácter de continuación de línea es el backtick `` ` `` en lugar de `^`. En Linux/WSL es `\`.

Cuando arranque, te queda una **REPL JavaScript** donde puedes escribir comandos contra el nodo:

```
Welcome to the Geth JavaScript console!
instance: Geth/v1.11.6-stable-ea9e62ca/windows-386/go1.20.3
at block: 0 (Mon May 06 2026 ...)
 datadir: ...\mychaindata
 modules: admin:1.0 debug:1.0 eth:1.0 miner:1.0 net:1.0 personal:1.0 rpc:1.0 web3:1.0
>
```

### Ejercicio 2.2 — Entender cada flag

| Flag | Para qué sirve |
|------|----------------|
| `--datadir mychaindata` | Le dice a geth qué carpeta usar. |
| `--networkid 12345` | El identificador de la red privada. **Debe coincidir con el `chainId` del genesis.json**. |
| `--port 30303` | Puerto P2P. Es el que abren otros nodos para conectarse a ti. |
| `--http` | Habilita el endpoint JSON-RPC sobre HTTP. Necesario para MetaMask, web3.js, etc. |
| `--http.addr 0.0.0.0` | Escucha en todas las interfaces. En producción usarías `127.0.0.1`. |
| `--http.port 8545` | Puerto JSON-RPC, el estándar de facto en Ethereum. |
| `--http.api "eth,net,web3,personal,admin,miner"` | Qué módulos se exponen por RPC. `admin` es necesario para añadir peers en remoto. |
| `--http.corsdomain "*"` | Acepta llamadas RPC desde cualquier origen (entornos de aprendizaje). |
| `--allow-insecure-unlock` | Permite `personal.unlockAccount` por RPC. **Solo para redes privadas**, jamás en mainnet. |
| `--nodiscover` | Desactiva el descubrimiento automático de peers. Aquí lo haremos a mano para no acabar conectándonos a nodos desconocidos. |
| `console` | Abre la REPL JS al final. Sin esto, geth corre como demonio. |

**Pregunta**: ¿qué pasa si pones un `networkid` distinto al `chainId` del `genesis.json`?

> Tu nodo arranca pero NO acepta a otros nodos como peers, porque al hacer el handshake comprueban que ambos tienen el mismo identificador de red. Es una protección para que un nodo no se conecte por accidente a la cadena equivocada.

---

## Parte 3 — Conectar tu nodo a otros (formar red P2P)

Cada nodo está aislado por defecto. Hay dos formas de conectarlos: en caliente (`admin.addPeer`) o al arrancar (`--bootnodes`).

### Ejercicio 3.1 — Saca tu enode URL

En la consola JavaScript de tu nodo, escribe:

```javascript
> admin.nodeInfo.enode
"enode://abc123def456...7890@192.168.1.42:30303?discport=0"
```

Esa cadena es tu **identidad pública en la red P2P**. La parte de antes del `@` es tu nodeID (deriva de tu clave pública). La parte de después es tu IP + puerto P2P.

Apúntala. Vas a compartirla con los compañeros.

### Ejercicio 3.2 — Añadir un peer (modo caliente)

Tu compañero, en SU consola, ejecuta lo siguiente con TU enode:

```javascript
> admin.addPeer("enode://abc123def456...7890@192.168.1.42:30303")
true
```

Si todo va bien, `true`. Si te devuelve `false`, normalmente es porque ya estaba o porque la enode tiene algún error de copia.

### Ejercicio 3.3 — Verifica que estáis conectados

En cualquiera de los dos nodos:

```javascript
> net.peerCount
1

> admin.peers
[{
    enode: "enode://abc123...",
    name: "Geth/v1.11.6-stable-ea9e62ca/windows-386/go1.20.3",
    network: {
      localAddress: "192.168.1.42:30303",
      remoteAddress: "192.168.1.99:50402"
    },
    protocols: { eth: { version: 66, head: "0x...", difficulty: 1 } }
}]
```

`peerCount` debe ser `1` en cada nodo (el otro). Si tienes varios alumnos en clase, será `N-1`.

**Pregunta**: ¿hace falta que los DOS hagan `admin.addPeer`, o basta con que uno solo lo haga?

> Basta con uno solo. Cuando el peer A añade al peer B, el handshake es bidireccional: B aprende sobre A automáticamente. El otro lo verá en su `admin.peers` aunque nunca haya hecho `addPeer`.

### Ejercicio 3.4 — Alternativa: pasar bootnodes al arrancar

En lugar de añadir peers en caliente, puedes pasarlos al arrancar:

```bat
geth.exe --datadir mychaindata --networkid 12345 ^
         --port 30303 ^
         --bootnodes "enode://abc123...@192.168.1.42:30303" ^
         console
```

Geth se conecta automáticamente al bootnode al arrancar y a partir de ahí descubre el resto de la red.

**Pregunta**: ¿qué ventaja tiene `--bootnodes` frente a `admin.addPeer` cuando arrancas un nodo nuevo?

> Que el peer ya está conectado **antes** de que abras la consola. Si arrancas con `admin.addPeer`, durante los primeros segundos tu nodo está aislado. Con bootnodes, está conectado desde el segundo cero. En redes reales (Bitcoin, Ethereum mainnet) los bootnodes son los puntos de entrada estándar.

---

## Parte 4 — Demo: el primer bloque propagado

Esto es lo que mejor demuestra que la red P2P "está viva".

1. Cada alumno arranca su nodo (`init` + arranque, partes 1 y 2).
2. Uno publica su enode en la pizarra.
3. Los demás hacen `admin.addPeer("enode://...")`.
4. Verificáis que `net.peerCount` ha subido en todos.
5. Un alumno arranca el minado en su nodo:
   ```javascript
   > miner.start(1)
   > // ...esperar 10-20 segundos...
   > miner.stop()
   ```
6. **Sin haber hecho nada**, el resto de los alumnos hacen:
   ```javascript
   > eth.blockNumber
   3   // o el número que sea, pero > 0
   ```

El bloque que minó UN alumno aparece en TODOS los demás. Eso es el **gossip de bloques** sobre la red P2P. Cada nodo recibe el bloque, lo valida, lo añade a su cadena, y lo retransmite a sus peers.

**Pregunta**: ¿qué pasa si ahora un alumno apaga su geth (Ctrl+C) y luego lo vuelve a arrancar?

> Cuando vuelve, Geth recuerda los peers (los guarda en `mychaindata/geth/nodes/`) y se reconecta automáticamente. Sincroniza los bloques que se ha perdido durante su ausencia (catch-up por gossip) y vuelve al ritmo. La red ha seguido funcionando sin él.

---

## Preguntas de consolidación

1. ¿Por qué tienen que tener todos los nodos exactamente el mismo `genesis.json`?
2. Cita dos diferencias entre el puerto P2P (30303) y el puerto JSON-RPC (8545).
3. Si dos alumnos ponen `networkid` distintos, ¿qué pasa al intentar conectarse?
4. ¿Por qué en clase ponemos `--nodiscover` y en producción no?
5. Tu enode URL contiene tu IP. ¿Qué problema tiene esto en una red real con NAT, y cómo se resuelve?
6. Una vez minado un bloque por un nodo, ¿qué hacen los demás nodos cuando lo reciben?

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Fatal: invalid genesis file: not found` | Ruta del genesis incorrecta | Comprueba la ruta; en Windows usa `\` y entre comillas si tiene espacios |
| `Error: account is locked` al hacer transacciones | La cuenta no está desbloqueada | `personal.unlockAccount(eth.accounts[0])` y la passphrase |
| `admin is not defined` en la consola | El módulo `admin` no está habilitado | Añade `admin` a `--http.api` o reinicia con la consola IPC en lugar de RPC |
| `peerCount` se queda en 0 tras `addPeer` | IP / puerto mal, o el otro nodo no escucha | `telnet <ip> 30303` para verificar; comprueba firewall de Windows |
| `chain id mismatch` al añadir peer | `networkid` o `chainId` distintos | Asegúrate de que ambos arrancan con el MISMO `genesis.json` y el mismo `--networkid` |
| `miner.start(1)` no produce bloques | Si usas Clique, tu cuenta no es signer; si usas Ethash, la dificultad puede ser muy alta | Revisa `extraData` en `genesis.json`; prueba con `miner.start()` sin argumento |
| Cierras geth y al reabrir tarda mucho | Está re-validando la cadena tras un cierre sucio | Cierra siempre con `> exit` desde la consola, no con Ctrl+C |

---

## Respuestas a las preguntas de consolidación

**1.** Porque el genesis define el bloque cero, y dos cadenas con bloque cero distinto son **dos cadenas distintas**. Si dos alumnos arrancan con `genesis.json` diferentes (aunque sea por un campo), sus hashes del bloque 0 difieren y al hacer el handshake P2P se ven como redes incompatibles. No se conectan.

**2.** El puerto **30303 es P2P**: por ahí los nodos se comunican entre sí (gossip de bloques, transacciones, descubrimiento). Es UDP y TCP. El puerto **8545 es JSON-RPC**: por ahí las **aplicaciones cliente** (MetaMask, scripts web3.js, exploradores) hablan con tu nodo. Si abres 8545 al exterior sin proteger, cualquiera puede consultar tu nodo y, si dejaste `--allow-insecure-unlock`, robar tus claves.

**3.** No se conectan. El handshake P2P incluye el `networkid`; si no coincide, el otro nodo rechaza la conexión. Es una protección importante: evita que tu nodo de la red privada se conecte por error a Ropsten, Sepolia o mainnet.

**4.** `--nodiscover` desactiva el descubrimiento automático de peers vía DHT. En clase no queremos que tu nodo se conecte a peers desconocidos por Internet — la red privada tiene que mantenerse aislada y controlada. En producción, sí queremos que el nodo descubra peers automáticamente, porque eso es lo que hace que la red sea robusta a caídas.

**5.** Si tu IP es privada (192.168.x.x) o estás detrás de NAT, otros nodos en Internet no pueden alcanzarte aunque conozcan tu enode. Soluciones: **port forwarding** en el router, **UPnP** (Geth lo soporta con `--nat upnp`), **STUN/TURN** o exponer el nodo detrás de una IP pública. En entornos cloud (AWS, GCP) se asigna IP pública directamente.

**6.** Los demás nodos: (1) reciben el bloque por gossip, (2) verifican que el padre coincide con su última cabecera, (3) re-ejecutan las transacciones y comprueban que los hashes y las firmas son válidos, (4) si todo cuadra, lo añaden a su cadena y actualizan `eth.blockNumber`, (5) lo retransmiten a sus propios peers. Si la verificación falla, descartan el bloque y opcionalmente penalizan al peer que lo envió.
