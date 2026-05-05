# Práctica: Funciones hash en acción

> **Objetivo**: que el alumno *toque* un hash, no solo que lea sobre él. Al terminar entenderás por qué el hash es la herramienta básica de integridad en blockchain.

## Herramienta que vamos a usar

Todas las pruebas se hacen en este conversor online:

**https://emn178.github.io/online-tools/sha256.html**

Es un calculador en el navegador (no envía nada a ningún servidor — el cómputo ocurre en local). En el desplegable de la izquierda puedes cambiar el algoritmo: SHA-256 es el que usa Bitcoin, Hyperledger Fabric, Git, etc.

## Conceptos clave (lo que tienes que saber antes de empezar)

Una **función hash criptográfica** transforma cualquier input (un texto, un PDF, un fichero de 4 GB...) en un *digest* de tamaño fijo. Las propiedades que la hacen útil son cinco:

| Propiedad | Qué significa |
|-----------|---------------|
| **Determinista** | El mismo input siempre produce el mismo hash. Sin azar. |
| **Tamaño fijo** | SHA-256 siempre devuelve 256 bits = 64 caracteres hex, independientemente del input. |
| **Avalancha** | Cambiar **un solo bit** del input cambia ~50% de los bits del hash. No hay correlación visible. |
| **One-way** | Dado un hash, no puedes reconstruir el input. La única "vuelta atrás" es probar inputs hasta que uno coincida (fuerza bruta). |
| **Resistencia a colisiones** | Encontrar dos inputs distintos con el mismo hash es prácticamente imposible (2¹²⁸ intentos esperados para SHA-256). |

Estas cinco propiedades son las que permiten usar el hash como **huella digital** de un contenido. Si tengo el hash, puedo verificar más tarde que el contenido no ha cambiado.

---

## Ejercicio 1 — Determinismo

1. Abre la herramienta y selecciona **SHA-256** en el desplegable de algoritmos.
2. En el cuadro de input escribe: `Hyperledger Fabric`
3. Apunta el hash que sale (los primeros 12 caracteres son suficientes).
4. Borra el cuadro y vuelve a escribir **lo mismo, exactamente**.

**Pregunta**: ¿salió el mismo hash? Repítelo en otro navegador o pídele a un compañero que lo haga en su ordenador.

> Si el hash siempre coincide, la función es **determinista**. Esto es lo que permite que cualquier nodo de Fabric (en cualquier máquina, cualquier país) calcule el mismo hash sobre la misma transacción y llegue al mismo bloque.

---

## Ejercicio 2 — Tamaño fijo

Calcula el SHA-256 de cada uno de estos cuatro inputs y mide la longitud del hash en caracteres:

1. Una cadena vacía (no escribas nada, deja el input en blanco).
2. La letra `a`.
3. El primer párrafo de Don Quijote: *"En un lugar de la Mancha, de cuyo nombre no quiero acordarme..."* (cópialo entero).
4. Pega el contenido de un PDF entero (copia-pega del visor).

**Pregunta**: ¿cuántos caracteres mide cada hash?

> Todos deben tener exactamente **64 caracteres hexadecimales** (256 bits). Da igual si el input son 0 bytes o 4 GB. Esto es lo que permite que el campo "hash" en una transacción de Fabric ocupe siempre lo mismo en disco, sin importar el tamaño del documento original.

---

## Ejercicio 3 — Efecto avalancha

1. Calcula el hash de: `Contrato firmado el 5 de mayo de 2026 por 10.000 EUR`
2. Apunta el hash completo.
3. Cambia **un solo carácter**: pon `Contrato firmado el 5 de mayo de 2026 por 10.001 EUR` (un 1 más).
4. Calcula el nuevo hash y compáralo con el anterior.

**Pregunta**: ¿en cuántas posiciones se parecen los dos hashes?

> Aunque el cambio en el input es mínimo (1 carácter de ~50), el hash cambia en aproximadamente **el 50% de sus bits** y no hay forma de adivinar a partir del hash si el cambio fue grande o pequeño. Por eso un hash sirve para detectar **cualquier alteración**, por mínima que sea: si tu PDF tiene un solo bit distinto al original, el hash será completamente diferente.

---

## Ejercicio 4 — One-way (irreversible)

1. Calcula el SHA-256 de la palabra `password`.
2. Búscalo en Google entre comillas. ¿Qué encuentras?
3. Ahora calcula el SHA-256 de una frase larga y aleatoria, por ejemplo: `mi-perro-violeta-baila-tango-los-jueves-2026`
4. Búscalo en Google entre comillas.

**Pregunta**: ¿por qué uno es fácil de "revertir" y el otro no?

> El hash en sí es **one-way**: no se puede invertir matemáticamente. Pero si el input es predecible (como `password`, `123456` o cualquier diccionario común), un atacante puede haber **pre-calculado** el hash de millones de candidatos y guardarlo en una "rainbow table". Para inputs realmente aleatorios y largos, ni con todo el cómputo del mundo se puede revertir.
>
> **Consecuencia para blockchain**: el hash de un documento real es seguro. Pero si guardas el hash de "Sí" o "No", cualquiera puede deducir cuál era el voto. Por eso los sistemas serios añaden un **salt** (valor aleatorio) al input antes de hashear.

---

## Ejercicio 5 — Hash como huella de integridad

Imagina que eres notario y un cliente te pide certificar la fecha de un documento.

1. Pídele al alumno de al lado que escriba un texto de unas 5-10 líneas (cualquier cosa: un poema, una cláusula contractual...).
2. Calcula el SHA-256 de ese texto.
3. Apunta el hash en un papel y dile al compañero: "Te certifico que este texto existía hoy a las 16:30. Aquí tienes su huella."
4. **Una hora después**, el compañero te trae el texto. Tú vuelves a calcular el hash.

**Pregunta**: ¿cómo demuestras que el texto **no ha sido modificado** en esa hora?

> Si el hash actual coincide con el que apuntaste, el texto es bit a bit el mismo. Si no coincide, alguien lo cambió. **No necesitas guardar el documento entero** para certificar su integridad — basta con guardar el hash, que ocupa 64 caracteres.
>
> Este es exactamente el mecanismo que usa Fabric para los documentos en SignChain (Módulo 2): el documento real nunca sale de las orgs, solo su hash va al ledger. La verificación posterior es: recalcular el hash localmente y comparar.

---

## Ejercicio 6 (bonus) — Comparar algoritmos

En la misma herramienta, en el desplegable de algoritmos, prueba con:

- **MD5** (128 bits, roto desde 2004 — produce colisiones en segundos)
- **SHA-1** (160 bits, roto desde 2017 — Google demostró colisión)
- **SHA-256** (256 bits, vigente)
- **SHA-512** (512 bits, también vigente)
- **SHA-3-256** (familia distinta de algoritmo, también vigente)

Calcula el hash de la misma frase con cada uno y observa: longitudes distintas, valores distintos.

**Pregunta**: ¿por qué seguimos usando SHA-256 si SHA-512 da más bits y es "más seguro"?

> Compromiso entre **seguridad y coste computacional**. SHA-256 sigue siendo inviable de romper con la tecnología actual (necesitarías 2¹²⁸ operaciones para una colisión, más que átomos hay en el universo observable). SHA-512 es marginalmente más seguro pero el doble de bytes en cada hash, lo que multiplica el espacio en disco y en red para algo que ya era seguro.
>
> Bitcoin, Ethereum, Hyperledger Fabric, Git, casi todos los sistemas modernos usan SHA-256 o SHA-3-256.

---

## Preguntas de consolidación

1. **¿Por qué blockchain almacena el hash de las transacciones y no las transacciones mismas en la cabecera del bloque?**
   _(Pista: Merkle tree, eficiencia, integridad)_
2. **Si dos peers de Fabric calculan el hash del mismo bloque y obtienen valores distintos, ¿qué ha pasado?**
3. **Un atacante quiere falsificar un documento PDF que ya tiene su hash registrado en el ledger de SignChain. ¿Qué tendría que conseguir para que la falsificación pasara desapercibida? ¿Es factible?**
4. **¿Por qué `bcrypt` o `argon2` son mejores que SHA-256 para almacenar contraseñas, si SHA-256 también es one-way?**

---

## Discusión final

Los 6 ejercicios cubren las 5 propiedades:

| Ejercicio | Propiedad demostrada |
|-----------|----------------------|
| 1 | Determinismo |
| 2 | Tamaño fijo |
| 3 | Efecto avalancha |
| 4 | One-way (con matiz: predictabilidad del input) |
| 5 | Integridad como aplicación práctica |
| 6 | Trade-off entre algoritmos |

En el Módulo 2 (práctica SignChain) verás esto aplicado: el chaincode `signchain` almacena el campo `hash` (SHA-256 hex de 64 caracteres) y el cliente Node.js lo recalcula localmente para verificar que el documento no ha cambiado. Todo lo que has hecho aquí en el navegador, allí lo hace `crypto.createHash('sha256')` en JavaScript.

---

## Respuestas a las preguntas de consolidación

**1.** Por **eficiencia y verificabilidad**. Almacenar las transacciones enteras en cada bloque dispararía el espacio en disco. Pero almacenar solo su raíz Merkle (un hash que combina todos los hashes de las transacciones del bloque) basta para detectar cualquier alteración. Y permite "pruebas de inclusión" (Merkle proofs): demuestras que una transacción está en un bloque sin enviar el bloque entero.

**2.** O bien tienen versiones distintas del bloque (uno está corrupto), o bien hay un bug en el código (improbable: SHA-256 es un estándar y todas las librerías lo implementan igual). En Fabric esto rompería el consenso y los peers detectarían la inconsistencia inmediatamente.

**3.** Tendría que encontrar un PDF distinto que produzca el mismo SHA-256 que el original (una **colisión**). Para SHA-256 esto requeriría ~2¹²⁸ intentos, lo cual es computacionalmente inviable hoy y en el futuro previsible. Por eso el hash en el ledger sirve como prueba criptográfica de integridad.

**4.** SHA-256 es **rápido** — está optimizado para que un servidor pueda hashear millones de inputs por segundo. Eso es bueno para integridad pero **malo para contraseñas**, porque un atacante con tu hash puede probar millones de candidatos por segundo. `bcrypt` y `argon2` son **lentos a propósito** (cientos de milisegundos por hash) y aceptan parámetros de coste, lo que hace inviable la fuerza bruta. Además incluyen *salt* automático.
