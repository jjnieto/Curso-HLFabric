# Práctica: Clave pública y privada en acción

> **Objetivo**: que el alumno *use* claves de verdad y vea con sus propios ojos las dos operaciones que sostienen toda la criptografía moderna: **cifrado asimétrico** y **firma digital**. Al terminar entenderás por qué blockchain puede demostrar quién hizo cada transacción sin pedir DNI.

## Herramientas que vamos a usar

Dos generadores online, los dos en navegador (no envían las claves a ningún servidor):

| Para... | Herramienta |
|---------|-------------|
| Generar pares RSA, **cifrar y descifrar** mensajes | https://www.devglan.com/online-tools/rsa-encryption-decryption |
| **Firmar y verificar** con curvas elípticas (ECDSA) | https://8gwifi.org/ecsignverify.jsp |

> Nunca uses claves generadas en webs públicas para cosas reales. Para esta práctica son suficientes; en producción las claves se generan en hardware seguro (HSM, smartcards, módulos TPM).

## Conceptos clave

La **criptografía asimétrica** se basa en pares de claves matemáticamente relacionadas:

- La **clave privada** la guardas en secreto. Solo tú la tienes.
- La **clave pública** la repartes libremente. Cualquiera puede tenerla.

Las dos operaciones distintas que se pueden hacer con un par son:

| Operación | Quién usa qué | Para qué sirve |
|-----------|---------------|----------------|
| **Cifrar / Descifrar** | Cualquiera cifra con tu **pública**, solo tú puedes descifrar con tu **privada** | Confidencialidad: enviarte un mensaje secreto |
| **Firmar / Verificar** | Tú firmas con tu **privada**, cualquiera verifica con tu **pública** | Autenticación + integridad: demostrar que fuiste tú y que el mensaje no se alteró |

Las dos son aplicaciones de la misma matemática, pero **resuelven problemas distintos**. En blockchain se usan sobre todo las firmas (no el cifrado), porque el problema típico no es esconder lo que se hizo sino demostrar quién lo hizo.

> **Aviso de algoritmos**: RSA y ECDSA son dos familias distintas. RSA usa números primos enormes; ECDSA usa curvas elípticas, da claves más cortas para la misma seguridad y es lo que usa Hyperledger Fabric (curva P-256). En esta práctica generamos pares RSA en una herramienta y firmas ECDSA en la otra. **Las claves de una no sirven para la otra** — son sistemas distintos.

---

## Parte 1 — Cifrado asimétrico (RSA)

### Ejercicio 1.1 — Generar un par de claves

1. Abre **https://www.devglan.com/online-tools/rsa-encryption-decryption**.
2. Baja a la sección "RSA Key Pair Generator".
3. Selecciona **2048 bits** y formato **PEM**.
4. Pulsa **Generate RSA Key Pair**.
5. Verás dos bloques:
   - `-----BEGIN PUBLIC KEY-----` ... `-----END PUBLIC KEY-----`
   - `-----BEGIN PRIVATE KEY-----` ... `-----END PRIVATE KEY-----`

Cópialos en un editor de texto local. Vas a usarlos en los ejercicios siguientes.

**Pregunta**: ¿qué pasa si pierdes la clave privada? ¿Y si la filtras?

> Si pierdes la privada, **no hay forma matemática de recuperarla** a partir de la pública. Cualquier mensaje cifrado con esa pública es irrecuperable. Si la filtras, quien la tenga puede descifrar todos tus mensajes pasados y futuros — y firmar como si fueras tú. Por eso en Fabric (y en banca, identidad digital, etc.) las privadas viven en hardware seguro o cifradas con frase de paso.

### Ejercicio 1.2 — Cifrar con la pública

En la misma página, busca el panel **RSA Encryption / Decryption**:

1. En el campo **Plain Text** escribe: `El precio del contrato es 50.000 EUR`
2. En **Public Key** pega tu clave pública del ejercicio anterior.
3. Pulsa **Encrypt**.
4. Te aparece el resultado en **Encrypted Text** — un blob largo en base64.

Pega ese blob cifrado en un editor de texto. Es lo que enviarías por un canal público (email, WhatsApp, lo que sea).

**Pregunta**: ¿podría alguien con solo este blob y la clave pública leer el mensaje?

> No. La pública sirve **solo para cifrar**, no para descifrar. Esto es lo que hace seguro el sistema: puedes pegar tu pública en tu firma de email y publicarla en LinkedIn — nadie podrá descifrar lo que te envíen.

### Ejercicio 1.3 — Descifrar con la privada

1. En el panel de **Decryption**, pega el **Encrypted Text** del paso anterior.
2. En **Private Key** pega tu clave privada.
3. Pulsa **Decrypt**.

Recuperas el mensaje original.

### Ejercicio 1.4 — Probar con una privada que no es pareja

1. Genera **otro par de claves** (vuelve al generador).
2. Coge el blob cifrado del ejercicio 1.2.
3. Intenta descifrarlo con la **privada del nuevo par** (que no corresponde a la pública con la que cifraste).

**Pregunta**: ¿qué pasa?

> Falla. Solo la privada que es **matemáticamente pareja** de la pública usada para cifrar puede descifrar. Esta es la garantía: si has cifrado para Alicia con la pública de Alicia, ni Bob ni nadie más puede leerlo, aunque tengan otras claves RSA válidas.

### Ejercicio 1.5 — Tamaño del cifrado

1. Cifra el mensaje `Hola` (4 caracteres).
2. Cifra ahora `El precio del contrato es 50.000 EUR` (38 caracteres).
3. Compara la longitud de los dos blobs cifrados.

**Pregunta**: ¿por qué el cifrado de `Hola` ocupa lo mismo que el de la frase larga?

> Porque RSA cifra **bloques** de tamaño fijo (256 bytes para una clave de 2048 bits). Mensajes más cortos se rellenan con padding. RSA es ineficiente para mensajes largos, por eso en la práctica se hace **cifrado híbrido**: se cifra el mensaje con AES (rápido y simétrico) y solo la clave AES se cifra con RSA. Así RSA solo lleva 256 bytes y AES carga con todo el contenido.

---

## Parte 2 — Firma digital (ECDSA)

Cambiamos de herramienta y de algoritmo. Ahora vamos a **firmar** y **verificar**, que es exactamente lo que hace un peer de Fabric con cada transacción.

### Ejercicio 2.1 — Generar par ECDSA

1. Abre **https://8gwifi.org/ecsignverify.jsp**.
2. En **Key Generation**, selecciona la curva **secp256r1** (también llamada P-256, NIST P-256 o prime256v1 — son sinónimos). Es la que usa Hyperledger Fabric.
3. Pulsa **Generate Keys**.
4. Te da dos PEMs: pública (`-----BEGIN PUBLIC KEY-----`) y privada (`-----BEGIN EC PRIVATE KEY-----`).

Cópialos en local.

**Pregunta**: compara la longitud de esta clave pública ECDSA con la pública RSA de 2048 bits del ejercicio 1.1. ¿Cuál ocupa más?

> La RSA es mucho más larga (~450 caracteres en PEM) que la ECDSA (~180). Para nivel de seguridad equivalente, ECDSA P-256 (256 bits) se considera comparable a RSA-3072. Por eso Fabric, Bitcoin y Ethereum usan curvas elípticas: claves más pequeñas, firmas más pequeñas, mismo nivel de seguridad.

### Ejercicio 2.2 — Firmar un mensaje

En el panel **Sign**:

1. En **Message** escribe: `Apruebo el documento DOC-001 con hash abc123def456`
2. En **Private Key** pega la privada del ejercicio anterior.
3. Selecciona **SHA256withECDSA** como algoritmo.
4. Pulsa **Sign**.

El resultado es la **firma**, un blob en base64. Cópialo a un editor.

> Lo que ha pasado por dentro: la herramienta calcula `SHA-256` del mensaje, y luego usa la clave privada para firmar **ese hash** (no el mensaje entero). La firma siempre tiene el mismo tamaño aunque el mensaje sea de 4 GB.

### Ejercicio 2.3 — Verificar la firma

En el panel **Verify**:

1. En **Message** pega exactamente el mismo mensaje del paso 2.2.
2. En **Signature** pega la firma generada.
3. En **Public Key** pega la **pública** del par.
4. Pulsa **Verify**.

Resultado: `Signature is valid`.

**Pregunta**: ¿qué demuestra esa verificación?

> Demuestra **dos cosas a la vez**:
>
> 1. **Autenticación**: la firma solo pudo generarla quien tenga la privada. Si confías que esa privada es de Alicia, sabes que firmó Alicia.
> 2. **Integridad**: el mensaje no ha cambiado. Si alguien lo modifica aunque sea un bit, la verificación fallará.
>
> Esto es exactamente lo que valida un peer de Fabric cuando recibe una transacción endorsada: usa el cert público del firmante para verificar que la firma es válida, lo que prueba origen + integridad.

### Ejercicio 2.4 — Modificar el mensaje (avalancha de firma)

1. Cambia el mensaje añadiendo un punto al final: `Apruebo el documento DOC-001 con hash abc123def456.`
2. Mantén la firma del 2.2 y la misma pública.
3. Pulsa **Verify**.

**Pregunta**: ¿qué resultado da?

> `Signature is invalid`. La firma se hizo sobre un hash concreto del mensaje original; al cambiar el mensaje cambia su hash y la firma deja de cuadrar. **No hay forma de "ajustar" la firma** sin la privada. Por eso un atacante no puede modificar una transacción ya firmada y mantenerla válida.

### Ejercicio 2.5 — Firmar con otra privada

1. Genera un **segundo par** ECDSA en la misma página.
2. Firma el mensaje original del 2.2 con la **privada nueva**.
3. Verifica esa nueva firma con la **pública del primer par**.

**Pregunta**: ¿qué pasa?

> Falla. Una firma generada con la privada B solo verifica con la pública B. Esto es lo que ata la firma a una identidad concreta: si la cert de Cliente está asociada a una pública, solo el dueño de la privada correspondiente puede generar firmas válidas para Cliente.

### Ejercicio 2.6 — Determinismo (o no) de las firmas ECDSA

1. Firma el mismo mensaje del 2.2 **dos veces seguidas** con la misma privada.
2. Compara las dos firmas.

**Pregunta**: ¿son idénticas?

> ECDSA "estándar" introduce **aleatoriedad** (un valor `k`) en cada firma, así que dos firmas del mismo mensaje normalmente NO coinciden. Sin embargo, **ambas verifican correctamente** con la misma pública. La aleatoriedad es por seguridad: si `k` se repitiera, la privada se podría calcular con álgebra simple (este bug famoso le costó a Sony romper la seguridad de la PS3). Existe una variante "determinista" (RFC 6979) donde `k` se deriva del mensaje + privada, dando siempre la misma firma; Bitcoin y muchos sistemas modernos la usan.

---

## Parte 3 — Juntando piezas

### Ejercicio 3.1 — Hash + firma (lo que hace Fabric)

Esto reproduce lo que pasa en SignChain (Módulo 2) cuando una org firma un documento:

1. Coge un texto largo (un párrafo de Wikipedia, lo que sea).
2. Calcula su SHA-256 con https://emn178.github.io/online-tools/sha256.html.
3. **Firma el hash** (no el texto entero) con tu privada ECDSA en https://8gwifi.org/ecsignverify.jsp.
4. Para verificar: el receptor recalcula el hash del texto y verifica la firma del hash con tu pública.

**Pregunta**: ¿qué ventaja tiene firmar el hash en lugar del documento entero?

> Tres ventajas:
>
> 1. **Velocidad**: firmar un hash de 32 bytes es instantáneo. Firmar un PDF de 100 MB sería lento.
> 2. **Tamaño**: la firma del hash ocupa lo mismo que la firma del PDF entero (200-512 bits según algoritmo). Pero el documento original no tiene que viajar firmado.
> 3. **Privacidad**: puedes publicar el hash y la firma sin revelar el documento. Cualquiera con el documento puede verificar; quien no lo tenga, no aprende nada de él.
>
> Por eso en SignChain las firmas en el ledger son sobre el hash del documento, no sobre el documento. Cliente y Proveedor mantienen sus copias; el ledger solo guarda las pruebas criptográficas.

### Ejercicio 3.2 — ¿Y si quiero confidencialidad además de autenticación?

Los dos sistemas se combinan así, en el orden correcto:

```
1. Yo (Alicia) firmo el mensaje con MI privada    → demuestra que soy yo
2. Cifro [mensaje + firma] con la pública de TI   → solo tú puedes leerlo
                              ↓
3. Tú descifras con tu privada                    → recuperas mensaje + firma
4. Verificas la firma con MI pública              → confirmas que fui yo
```

**Pregunta**: ¿por qué no al revés (cifrar primero, firmar después)?

> Si firmaras el cifrado, demostrarías solo que viste el blob cifrado pasar — no necesariamente que conoces el contenido. Y si interceptan, podrían quitar tu firma y poner la suya sobre el mismo blob. Firmar primero ata tu identidad al **contenido real**, lo cual es lo que importa.

---

## Preguntas de consolidación

1. En SignChain (Módulo 2) la transacción `ApproveDocument` lleva como argumento la firma del hash del documento, no del documento entero. **¿Qué tendría que pasar para que un atacante pudiera "robar" una aprobación de Cliente y reusarla para otro documento distinto?** ¿Es factible?
2. **¿Por qué Hyperledger Fabric no cifra las transacciones por defecto?** ¿En qué casos sí necesitarías cifrarlas?
3. Una org del consorcio quiere que su clave privada **no esté en el sistema de archivos del peer**. ¿Qué opciones tiene?
4. **¿Por qué no se puede usar el mismo par de claves para cifrar y para firmar en muchos sistemas?** _(Pista: tipo de algoritmo, RSA puede pero ECDSA no)_

---

## Discusión final

Con las dos herramientas online has visto lo mismo que hace Fabric por debajo:

| En la herramienta | En Fabric |
|-------------------|-----------|
| Generar par RSA o ECDSA | El Fabric CA emite el cert con la pública; la privada queda en el peer |
| Pegar la pública para cifrar/verificar | El cert público está en el MSP de cada org, accesible por todos los peers del canal |
| Mantener la privada en local | La privada vive en `keystore/` del MSP, nunca se transmite |
| Firmar un mensaje | Cada peer endorsa transacciones firmando con su privada |
| Verificar una firma | El validation phase de cada peer verifica firmas usando los certs públicos del MSP |

La diferencia principal es que en Fabric todo esto está **automatizado** y **integrado**: no haces copy-paste, lo gestiona el peer y el SDK. Pero el trasfondo matemático es el que has visto en estos ejercicios.

---

## Respuestas a las preguntas de consolidación

**1.** El atacante necesitaría una firma sobre el hash del *otro* documento, no sobre el original. Como el chaincode `ApproveDocument` valida que la firma es sobre `doc.hash` (el hash del documento ya registrado), una firma robada no encajaría. **Para reusarla**, tendría que conseguir que dos documentos distintos produjeran el mismo SHA-256 (colisión, ~2¹²⁸ intentos: inviable) o robar la privada de la org (lo cual es el riesgo real, no la firma en sí).

**2.** Porque Fabric prioriza **trazabilidad y consenso** sobre confidencialidad. Todos los miembros del canal ven todas las transacciones del canal — esto es lo que permite que cualquiera pueda re-validar el ledger y detectar fraude. Cuando hace falta confidencialidad parcial se usan **canales privados** (subconjunto de orgs ven el subcanal) o **Private Data Collections** (los datos sensibles viven solo en algunos peers; en el ledger compartido va solo el hash).

**3.** Tres opciones, en orden creciente de seguridad y coste:
- **Cifrar la privada con frase de paso** (sigue en disco pero protegida).
- **HSM** (Hardware Security Module): la privada vive en hardware dedicado, la firma se hace dentro del HSM y la privada nunca sale. Fabric soporta PKCS#11 nativo.
- **Cloud KMS** (AWS KMS, Google Cloud KMS, Azure Key Vault): equivalente HSM gestionado.

**4.** RSA es **multi-uso**: las matemáticas permiten usar el mismo par para cifrado y firma, aunque por buenas prácticas se generan claves separadas. ECDSA solo sirve para firma — para cifrado en curva elíptica se usa ECDH (intercambio de claves), que es otro algoritmo. **Razón conceptual**: separar usos minimiza el daño si una clave se compromete. Por eso en certificados X.509 hay un campo `Key Usage` que declara para qué sirve cada cert (`digitalSignature`, `keyEncipherment`, etc.).
