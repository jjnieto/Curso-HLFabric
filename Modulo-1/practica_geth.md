# Práctica: Montar una red P2P de Ethereum con Geth

> **Objetivo**: cada alumno arranca su propio nodo Geth con un `genesis.json` común, los conecta a los nodos de los compañeros por enode URL, y ve en directo cómo se forma una red P2P y cómo se propagan los bloques minados. Es la versión "tangible" de la slide de redes P2P.

## Herramientas que vas a usar

- **Geth** (Go Ethereum) 1.11.6 — el binario depende de tu sistema:
    - Windows: `geth-windows-386-1.11.6-ea9e62ca.exe` (lo llamaremos `geth.exe`).
    - Linux / macOS: `geth` (sin extensión, el ejecutable de tu paquete o release).
- Un archivo **`genesis.json`** ya preparado, dentro de la carpeta `mychaindata/`. Define el bloque cero, el `chainId`, los validadores iniciales si usas Clique, etc.
- Una terminal a tu elección: **cmd** o **PowerShell** en Windows, **bash/zsh** en Linux/WSL/macOS. Cada bloque de comandos largo de esta práctica trae las tres versiones; usa la que toque.

> **Diferencias clave entre shells**:
> - Continuación de línea: `^` en cmd, backtick `` ` `` en PowerShell, `\` en bash.
> - Separador de rutas: `\` en Windows (cmd y PowerShell aceptan `/` también), `/` en Linux.
> - Binario: `geth.exe` en Windows, `./geth` en Linux/macOS si está en el directorio actual, o solo `geth` si está en el `PATH`.

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
:: cmd (Windows)
geth.exe --datadir mychaindata init mychaindata\genesis.json
```

```powershell
# PowerShell (Windows)
.\geth.exe --datadir mychaindata init mychaindata\genesis.json
```

```bash
# bash (Linux / WSL / macOS)
./geth --datadir mychaindata init mychaindata/genesis.json
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

## Parte 2 — Crear una cuenta

Una cuenta de Ethereum es un par clave privada / dirección. Vas a necesitarla para:

- Recibir las recompensas si tu nodo mina (etherbase).
- Firmar transacciones desde tu nodo.
- Ser el signer en redes Clique (si tu `genesis.json` te tiene listado).

> **Importante**: hay que crear la cuenta **antes** de arrancar el nodo. La forma fiable y portable es el subcomando `account new` de Geth (no la consola JS — el namespace `personal` está deprecado en 1.11.x y a veces no carga).

### Ejercicio 2.1 — Crear la cuenta

```bat
:: cmd (Windows)
geth.exe --datadir mychaindata account new
```

```powershell
# PowerShell (Windows)
.\geth.exe --datadir mychaindata account new
```

```bash
# bash (Linux / WSL / macOS)
./geth --datadir mychaindata account new
```

Geth te pedirá una passphrase (dos veces) y devolverá algo como:

```
Your new key was generated

Public address of the key:   0x9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a
Path of the secret key file: mychaindata\keystore\UTC--2026-05-07T08-30-00.000Z--9d3a7b...

- You can share your public address with anyone. Others need it to interact with you.
- You must NEVER share the secret key with anyone! The key controls access to your funds!
- You must BACKUP your key file! Without the key, it's impossible to access account funds!
- You must REMEMBER your password! Without the password, it's impossible to decrypt the key!
```

**Apunta tu dirección pública (la que empieza por `0x...`)**. La vas a necesitar en la Parte 5 para configurar el etherbase.

> La passphrase no la usaremos en clase salvo si haces transacciones desde el nodo. Aun así, **apúntala** — sin ella el archivo de clave es papel mojado.

### Ejercicio 2.2 — Verificar que la cuenta existe

Antes de arrancar el nodo, comprueba que la lista de cuentas no está vacía:

```bat
:: cmd (Windows)
geth.exe --datadir mychaindata account list
```

```powershell
# PowerShell (Windows)
.\geth.exe --datadir mychaindata account list
```

```bash
# bash (Linux / WSL / macOS)
./geth --datadir mychaindata account list
```

Salida esperada:

```
Account #0: {9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a} keystore://...
```

Si te aparece, perfecto. Si la lista está vacía, repite el `account new`.

> Las claves se guardan en `mychaindata/keystore/` cifradas con la passphrase. Cada llamada a `account new` añade una clave más al keystore. Lo normal en una práctica es tener una sola.

---

## Parte 3 — Arrancar el nodo

### Ejercicio 2.1 — Arranque con consola JavaScript

```bat
:: cmd (Windows)
geth.exe --datadir mychaindata ^
         --networkid 12345 ^
         --port 30303 ^
         --http --http.addr 0.0.0.0 --http.port 8545 ^
         --http.api "eth,net,web3,personal,admin,miner" ^
         --http.corsdomain "*" ^
         --allow-insecure-unlock ^
         console
```

```powershell
# PowerShell (Windows)
.\geth.exe --datadir mychaindata `
           --networkid 12345 `
           --port 30303 `
           --http --http.addr 0.0.0.0 --http.port 8545 `
           --http.api "eth,net,web3,personal,admin,miner" `
           --http.corsdomain "*" `
           --allow-insecure-unlock `
           console
```

```bash
# bash (Linux / WSL / macOS)
./geth --datadir mychaindata \
       --networkid 12345 \
       --port 30303 \
       --http --http.addr 0.0.0.0 --http.port 8545 \
       --http.api "eth,net,web3,personal,admin,miner" \
       --http.corsdomain "*" \
       --allow-insecure-unlock \
       console
```

> En **PowerShell** el backtick (`` ` ``) tiene que ser el **último carácter de la línea**, sin espacio detrás. Si copias el bloque y la línea no continúa, suele ser un espacio extra invisible.

> **Sobre `--nodiscover`**: en versiones de la práctica donde queremos aislamiento total se añade ese flag para desactivar el descubrimiento automático. Aquí lo dejamos fuera: con `--networkid 12345` no hay riesgo de conectarse a nadie de Internet (no hay nadie con ese networkid en redes públicas), y mantenerlo activo nos permitirá usar `--bootnodes` en la Parte 4 para que los alumnos se descubran entre sí.

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
| `console` | Abre la REPL JS al final. Sin esto, geth corre como demonio. |

**Pregunta**: ¿qué pasa si pones un `networkid` distinto al `chainId` del `genesis.json`?

> Tu nodo arranca pero NO acepta a otros nodos como peers, porque al hacer el handshake comprueban que ambos tienen el mismo identificador de red. Es una protección para que un nodo no se conecte por accidente a la cadena equivocada.

---

## Parte 4 — Conectar tu nodo a otros (formar red P2P)

Para esta parte necesitamos definir **dos roles** en clase:

- **Host** (1 alumno): el primero que arranca. Su nodo será el bootnode al que se conectan los demás. Va a publicar su enode URL para que el resto la copie.
- **Joiners** (resto de alumnos): arrancan después y se conectan al host con `--bootnodes`. Una vez dentro, se descubren entre sí automáticamente.

### Ejercicio 3.1 — (HOST) Componer tu enode URL "publicable"

Hay dos piezas:

**(a) Saca tu nodeID + puerto** desde la consola JS de tu geth:

```javascript
> admin.nodeInfo.enode
"enode://abc123def456...7890@127.0.0.1:30303?discport=0"
```

Casi seguro Geth te devuelve `127.0.0.1` (loopback). Eso **no sirve** a tus compañeros — desde fuera de tu máquina, `127.0.0.1` apunta al ordenador del que pregunta, no al tuyo.

**(b) Mira tu IP local en la red del aula** (la que comparten todos los alumnos). En otra terminal:

```bat
:: cmd (Windows)
ipconfig
```

```powershell
# PowerShell (Windows) — filtra solo IPv4 de tarjetas activas
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' } | Select-Object IPAddress, InterfaceAlias
```

```bash
# bash (Linux / WSL / macOS)
hostname -I              # rápida, lista todas
ip -4 -o addr show       # detallada, una línea por interfaz
```

Busca la IP de tu adaptador activo (Wi-Fi o Ethernet, según el caso). Será algo como `192.168.1.42` o `10.0.0.15`. Descarta `127.0.0.1` (loopback) y las direcciones tipo `169.254.x.x` (link-local sin DHCP).

> **Atención con WSL2**: si trabajas dentro de WSL2, `hostname -I` te devuelve la IP de la interfaz virtual de WSL, **no** la IP del host Windows en la red del aula. Soluciones: (1) lanza `geth.exe` directamente en Windows (cmd o PowerShell) para que coincida con la IP que ven tus compañeros, o (2) si insistes en WSL, usa la IP de Windows (la que da `ipconfig` en cmd) y configura port-forwarding con `netsh interface portproxy`.

**(c) Compón tu enode publicable** sustituyendo `127.0.0.1` por tu IP real, y opcionalmente quita el sufijo `?discport=0`:

```
enode://abc123def456...7890@192.168.1.42:30303
```

Esto es lo que escribes en la pizarra para que el resto te use como bootnode.

**(d) Asegúrate de que el firewall permite entrada en 30303**. Geth usa **TCP** para datos (bloques, transacciones) y **UDP** para discovery. Si no abres ambos, los joiners verán `false` al intentar conectar.

```bat
:: cmd (Windows, terminal como Administrador)
netsh advfirewall firewall add rule name="Geth P2P TCP" dir=in action=allow protocol=TCP localport=30303
netsh advfirewall firewall add rule name="Geth P2P UDP" dir=in action=allow protocol=UDP localport=30303
```

```powershell
# PowerShell (Windows, sesión como Administrador)
New-NetFirewallRule -DisplayName "Geth P2P TCP" -Direction Inbound -Protocol TCP -LocalPort 30303 -Action Allow
New-NetFirewallRule -DisplayName "Geth P2P UDP" -Direction Inbound -Protocol UDP -LocalPort 30303 -Action Allow
```

```bash
# bash (Linux con ufw — más simple)
sudo ufw allow 30303/tcp
sudo ufw allow 30303/udp

# bash (Linux con iptables — alternativa)
sudo iptables -A INPUT -p tcp --dport 30303 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 30303 -j ACCEPT
```

> En macOS el firewall por defecto es por aplicación, no por puerto: la primera vez que `geth` intente escuchar en 30303 macOS preguntará si lo permites. Acepta y listo.

### Ejercicio 3.2 — (JOINERS) Arrancar conectándose al bootnode

Pega la enode publicada por el host como `--bootnodes` al arrancar tu nodo:

```bat
:: cmd (Windows)
geth.exe --datadir mychaindata ^
         --networkid 12345 ^
         --port 30303 ^
         --bootnodes "enode://abc123def456...7890@192.168.1.42:30303" ^
         --http --http.addr 0.0.0.0 --http.port 8545 ^
         --http.api "eth,net,web3,personal,admin,miner" ^
         --http.corsdomain "*" ^
         --allow-insecure-unlock ^
         console
```

```powershell
# PowerShell (Windows)
.\geth.exe --datadir mychaindata `
           --networkid 12345 `
           --port 30303 `
           --bootnodes "enode://abc123def456...7890@192.168.1.42:30303" `
           --http --http.addr 0.0.0.0 --http.port 8545 `
           --http.api "eth,net,web3,personal,admin,miner" `
           --http.corsdomain "*" `
           --allow-insecure-unlock `
           console
```

```bash
# bash (Linux / WSL / macOS)
./geth --datadir mychaindata \
       --networkid 12345 \
       --port 30303 \
       --bootnodes "enode://abc123def456...7890@192.168.1.42:30303" \
       --http --http.addr 0.0.0.0 --http.port 8545 \
       --http.api "eth,net,web3,personal,admin,miner" \
       --http.corsdomain "*" \
       --allow-insecure-unlock \
       console
```

> **Si estáis varios alumnos en la misma máquina** (raro en aula, frecuente en pruebas en casa): cada uno necesita un `--datadir` y un `--port` distintos (`30304`, `30305`...). Si estáis en máquinas distintas, podéis usar el mismo `30303` sin conflictos.

Geth se conecta al host al arrancar y aprende de él al resto de joiners conforme van llegando. Es exactamente cómo funciona Bitcoin con sus DNS-seeds y bootnodes oficiales.

### Ejercicio 3.3 — Verifica que estáis conectados

En cualquier nodo (host o joiner), en su consola JS:

```javascript
> net.peerCount
3                    // host con 3 joiners conectados, por ejemplo

> admin.peers
[{
    enode: "enode://...",
    name: "Geth/v1.11.6-stable-ea9e62ca/windows-386/go1.20.3",
    network: {
      localAddress: "192.168.1.42:30303",
      remoteAddress: "192.168.1.99:50402"
    },
    protocols: { eth: { version: 66, head: "0x...", difficulty: 1 } }
}, ...]
```

Si tienes 4 nodos en clase (1 host + 3 joiners), todos deberían acabar con `peerCount = 3`. La red completa: cada nodo conoce a todos los demás.

**Pregunta**: si Joiner_A se conecta al host y Joiner_B también se conecta al host, ¿quién le dice a Joiner_A que existe Joiner_B?

> El propio host. En cuanto Joiner_B se conecta, el host le pasa a Joiner_A la enode de Joiner_B (gossip de peers). Joiner_A intenta entonces conectar directamente con Joiner_B. Tras unos segundos, todos los nodos se conocen entre todos sin haber tenido que hacer `admin.addPeer` ni una sola vez.

### Ejercicio 3.4 — Alternativa: añadir peers en caliente

Si el host arrancó después que tú, o si quieres añadir un peer una vez ya estás corriendo, también vale el modo caliente:

```javascript
> admin.addPeer("enode://abc123def456...7890@192.168.1.42:30303")
true
```

Devuelve `true` si la solicitud se ha registrado (no garantiza que la conexión TCP haya tenido éxito — eso lo confirmas con `admin.peers` segundos después). `false` suele indicar un error de formato en la enode.

**Pregunta**: ¿cuándo es preferible `--bootnodes` y cuándo `admin.addPeer`?

> `--bootnodes` cuando sabes el peer al que quieres conectar **antes** de arrancar (caso típico: el host ya está corriendo, los joiners arrancan después). Te ahorras estar conectado a "nadie" durante los primeros segundos. `admin.addPeer` es mejor cuando descubres un peer nuevo en caliente, sin reiniciar tu nodo. En la práctica de aula los joiners usan bootnodes y solo recurrimos a `admin.addPeer` si alguno arranca antes que el host.

---

## Parte 5 — Iniciar el minado

Hasta ahora tu nodo está conectado y al día, pero no produce bloques. Sin un nodo minando, la cadena se queda parada en el bloque 0 (génesis) y las transacciones se acumulan en el mempool sin confirmar. En la práctica de aula, lo natural es que **un alumno** (típicamente el host) sea el que mine, y los demás solo reciban los bloques.

### Ejercicio 5.1 — Configurar el etherbase y arrancar el minado

En la consola JS del nodo que vaya a minar:

```javascript
// 1. Confirma que tu cuenta está cargada (la creaste en la Parte 2)
> eth.accounts
["0x9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a"]

// 2. Configura esa cuenta como etherbase (destino de las recompensas)
> miner.setEtherbase(eth.accounts[0])
true

// 3. Verifica
> eth.coinbase
"0x9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a"

// 4. Lanza el minado con 1 thread
> miner.start(1)
null
```

> El `null` que devuelve `miner.start(1)` no es error. En Geth las llamadas que no devuelven valor explícito retornan `null`. Si fallara verías un mensaje rojo (`ERROR ... Cannot start mining ...`).

A los pocos segundos verás logs en la consola tipo:

```
INFO [05-07|...] Commit new sealing work
INFO [05-07|...] 🔨 mined potential block        number=1 hash=0xabc...
INFO [05-07|...] Successfully sealed new block   number=1 hash=0xabc...
```

Y la cadena empieza a avanzar:

```javascript
> eth.blockNumber
3

> eth.getBlock("latest")
{ number: 3, miner: "0x9d3a7b...", ... }
```

Para parar:

```javascript
> miner.stop()
true
```

### Ejercicio 5.2 — Atajo: arrancar el nodo ya minando

Para no repetir los pasos de configuración cada vez que arranques, puedes pasar al comando de la Parte 3 estos flags adicionales:

```
--miner.etherbase 0x9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a --mine
```

Si además quieres que la cuenta esté desbloqueada (para firmar transacciones automáticamente):

```
--unlock 0x9d3a7b8e2c4f1d6a0b9c8d7e6f5a4b3c2d1e0f9a --password password.txt --allow-insecure-unlock
```

Donde `password.txt` es un archivo que contiene tu passphrase en texto plano. **Solo en redes privadas de práctica**. En producción, las claves jamás se desbloquean por archivo.

### Ejercicio 5.3 — Si tu genesis usa Clique (PoA), ojo

En **Clique** (Proof of Authority) solo los signers definidos en el campo `extraData` del `genesis.json` pueden producir bloques. Si tu cuenta nueva no es signer, llamar a `miner.start()` no producirá nada. Para verificarlo:

```javascript
> clique.getSigners()
["0xf1e0d9c8b7a6...", "0x12345abcde..."]
```

Si tu dirección no aparece ahí:

- **Opción A**: usa la cuenta del signer original (la que generó el `genesis.json`). Si la passphrase está apuntada en el material de la práctica, perfecto.
- **Opción B**: regenera el `genesis.json` poniendo tu nueva dirección en `extraData` (cambia el bloque 0 → todos los nodos tienen que volver a hacer `init` con limpieza previa).

En **Ethash** (PoW) cualquier nodo puede minar siempre que la `difficulty` del genesis sea baja (`"difficulty": "0x1"` o similar para una práctica).

---

## Parte 6 — Demo: el primer bloque propagado

Esto es lo que mejor demuestra que la red P2P "está viva". Llegados a este punto cada alumno tiene su nodo arrancado, su cuenta creada y al menos uno tiene el etherbase configurado.

1. Cada alumno tiene su nodo en marcha (Partes 1 a 4 hechas).
2. Uno publica su enode en la pizarra y los demás hacen `admin.addPeer(...)` o arrancan con `--bootnodes`.
3. Verificáis que `net.peerCount` ha subido en todos.
4. El alumno con etherbase configurado (Parte 5) lanza el minado:
   ```javascript
   > miner.start(1)
   null
   > // ...esperar 10-20 segundos, mirar logs sealing...
   > miner.stop()
   ```
5. **Sin haber hecho nada**, el resto de los alumnos hacen:
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
| Mi enode dice `127.0.0.1`, los compañeros no se conectan | Geth solo conoce la IP de loopback hasta que recibe conexiones | Sustituye `127.0.0.1` por tu IP real (`ipconfig`) antes de publicar la enode |
| Los compañeros dicen "addPeer true" pero no se conecta nada | Firewall bloquea entradas TCP/UDP en 30303 | Abre TCP+UDP 30303 (ver Parte 4.1.d): `netsh` en cmd, `New-NetFirewallRule` en PowerShell, `ufw allow 30303` en Linux |
| WSL: la IP que veo en `hostname -I` no es la que ven los compañeros | WSL2 corre con su propia interfaz virtual | Lanza `geth.exe` directamente en Windows, no dentro de WSL |
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
