# Actividades — Módulo 4 (Tokenización, Stablecoins, CBDCs)

> Cinco actividades prácticas (no son tests) basadas en el contenido de `Modulo_4.pptx`. Cada actividad tiene un formato distinto — diseño de solución, debate estructurado, treasure hunt, post-mortem y simulación — para no aburrir al grupo y cubrir todos los bloques del módulo.
>
> Las actividades son INDEPENDIENTES: puedes hacerlas todas, escoger 2-3 o usarlas en sesiones distintas.

---

## Índice rápido

| # | Actividad                                          | Formato            | Tiempo  | Tamaño grupo |
|---|----------------------------------------------------|--------------------|---------|--------------|
| 1 | Treasure Hunt: la geografía real del dinero digital| Búsqueda guiada    | 45 min  | 2-3 personas |
| 2 | Diseña la stablecoin europea ideal                 | Pitch + jurado     | 60 min  | 3-4 personas |
| 3 | Debate: los 4 modelos del Euro Digital             | Defensa de postura | 60 min  | 3-4 personas |
| 4 | Post-mortem del ataque a Terra/Luna                | Kill-chain         | 50 min  | 2-3 personas |
| 5 | Tokeniza un bono para una PYME real                | Diseño funcional   | 75 min  | 3-4 personas |

---

## Actividad 1 — Treasure Hunt: la geografía real del dinero digital

**Objetivo**: que cada alumno construya, con datos verificables, un mapa mental de qué hay realmente desplegado en 2026 entre stablecoins y CBDCs. La slide 53 del módulo ya proponía una caza rápida de CBDCs; aquí ampliamos a los dos mundos y obligamos a contrastar fuentes.

**Formato**: parejas o tríos. 45 minutos cronometrados.

**Reglas**:
- Solo se puede usar internet abierto. Anotad LA URL de cada fuente.
- Si dos fuentes contradicen un dato, lo anotáis y lo razonáis (¿cuál es más fiable y por qué?).
- Prohibido usar IA conversacional para responder directamente. Sí se permite para entender un término.

**Tablero de búsqueda** (un alumno del grupo lleva el conteo; cada hallazgo correcto suma puntos):

| Misión                                                                                            | Pts |
|---------------------------------------------------------------------------------------------------|-----|
| ¿Cuántas CBDCs hay LANZADAS (no piloto) en 2026? Listar las 4 primeras                            |  2  |
| Sand Dollar (Bahamas): año de lanzamiento, tecnología subyacente, motivo declarado                |  2  |
| eNaira (Nigeria): adopción real, ratio sobre la población, problemas reportados                    |  3  |
| JAM-DEX (Jamaica): operador, % de comerciantes adheridos                                          |  2  |
| Yuan Digital: nº de usuarios, nº de ciudades, ¿usa blockchain públicamente?                       |  2  |
| Euro Digital: fase actual del proyecto del BCE, fecha objetivo de lanzamiento                     |  2  |
| Capitalización combinada de USDT + USDC (snapshot del día de la actividad)                        |  2  |
| ¿Cuál es hoy la stablecoin algorítmica más grande y cuánto vale 1 unidad (debería ser ≈ 1 USD)?  |  3  |
| Estado regulatorio de USDT en la UE (¿afectada por MiCA? ¿cómo?)                                 |  3  |
| Encuentra una stablecoin que haya colapsado en los últimos 18 meses y nombra el motivo            |  3  |
| Una stablecoin europea respaldada por euros: nombre, emisor, licencia                             |  2  |
| Diferencia operativa real entre Fnality eUSD y USDC (qué dinero subyace y dónde se custodia)      |  3  |
| **Bonus**: una CBDC que se ha CERRADO o pausado oficialmente — cuál y por qué                      |  +4 |

**Entregable**: una hoja con las 12 respuestas, cada una con su URL fuente y, si procede, una segunda URL de contraste.

**Pista**:
- Atlantic Council CBDC Tracker: https://www.atlanticcouncil.org/cbdctracker/
- CoinGecko / CoinMarketCap para capitalización y precio
- Reglamento MiCA en el DOUE para el bloque regulatorio europeo

**Cierre (10 min adicionales)**: pasamos al pizarrón las respuestas. Sorpresas más jugosas: cuántas CBDCs hay realmente "vivas" (suelen ser 3-4, no 30), y la diferencia abismal entre Yuan Digital y eNaira en adopción.

---

## Actividad 2 — Diseña la stablecoin europea ideal

**Objetivo**: que el grupo tome decisiones de diseño REALES — emisor, colateral, fungibilidad, redes, regulación — y las defienda. Aterrizar la tabla de criterios de la slide 55-57 en un producto concreto.

**Formato**: grupos de 3-4. 45 minutos de diseño + 15 minutos de pitchs (3 minutos por grupo).

**Restricciones del producto**:
- Tiene que poder usarla un ciudadano europeo medio para pagar el café, una transferencia internacional y una compra online.
- Tiene que ser COMPATIBLE con MiCA.
- Tiene que poder coexistir con el Euro Digital del BCE (que probablemente saldrá en 2028-2029).

**Lienzo de diseño** (cada grupo rellena las 8 casillas):

```
┌─────────────────────────────────────────────────────────────────┐
│ NOMBRE de la stablecoin: __________                              │
│ TICKER: __________  (ej. EURx, sEUR, eEUR…)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. EMISOR                                                        │
│    □ Banco comercial   □ Consorcio de bancos                     │
│    □ FMI (CSD/CSP)     □ Empresa tecnológica regulada            │
│    Justificación:                                                │
├─────────────────────────────────────────────────────────────────┤
│ 2. COLATERAL                                                     │
│    □ 100% depósitos en banco central                             │
│    □ 100% depósitos en banco comercial                           │
│    □ Cesta diversificada (qué porcentajes)                       │
│    □ Cripto sobre-colateralizada                                 │
│    Auditoría de reservas: ¿quién y cada cuánto?                  │
├─────────────────────────────────────────────────────────────────┤
│ 3. RED                                                           │
│    □ Pública (Ethereum, Polygon, Solana…)                        │
│    □ Privada permissioned (Fabric, Corda…)                       │
│    □ Híbrida                                                     │
│    KYC: ¿obligatorio para tener wallet o solo para fundear?      │
├─────────────────────────────────────────────────────────────────┤
│ 4. FUNGIBILIDAD                                                  │
│    □ Global (1 EURx = 1 EURx siempre)                            │
│    □ Por emisor (los EURx de A ≠ los EURx de B pero convertibles)│
│    Mecanismo de conversión:                                      │
├─────────────────────────────────────────────────────────────────┤
│ 5. PROGRAMABILIDAD                                               │
│    Indica 2 funciones programables que añades (límites diarios,  │
│    pagos a futuro, freezing por orden judicial, etc.)            │
├─────────────────────────────────────────────────────────────────┤
│ 6. OFFLINE PAYMENTS — ¿Sí o no? Cómo se gestionaría              │
├─────────────────────────────────────────────────────────────────┤
│ 7. MODELO DE INGRESOS — ¿Cómo gana dinero el emisor?             │
│    □ Intereses sobre el colateral                                │
│    □ Comisión por transacción (cuánto)                           │
│    □ Suscripción                                                 │
│    □ Otro                                                        │
├─────────────────────────────────────────────────────────────────┤
│ 8. DIFERENCIACIÓN frente al Euro Digital del BCE                 │
│    ¿Por qué la usaría alguien teniendo el €D del BCE disponible? │
└─────────────────────────────────────────────────────────────────┘
```

**Pitch (3 min por grupo)**:
- 30 s — qué problema resuelve
- 60 s — decisiones clave (las 8 casillas)
- 60 s — diferenciación
- 30 s — modelo de ingresos

**Jurado (el resto de los grupos)**: cada grupo vota a OTRO grupo distinto al suyo. Criterios: viabilidad regulatoria, claridad del modelo de ingresos, encaje real con MiCA, originalidad. Premio honorífico al ganador.

**Cierre**: el profe destapa qué stablecoins europeas reales se parecen a cada propuesta (EURC de Circle, EURI de Banking Circle, EURØP de Société Générale, etc.) y comparamos decisiones.

---

## Actividad 3 — Debate estructurado: los 4 modelos del Euro Digital

**Objetivo**: que cada grupo defienda ARGUMENTADAMENTE un modelo arquitectónico distinto del Euro Digital. Las slides 31-34 presentan 4 modelos; aquí cada grupo se convierte en abogado defensor de uno.

**Formato**: 4 grupos de 3-4 personas + (opcional) 1 grupo "jurado neutral". 60 minutos.

**Asignación de roles** (sorteo o reparto del profe):

| Grupo | Modelo a defender                       | Slide ref |
|-------|-----------------------------------------|-----------|
| A     | Modelo directo basado en cuentas        | 31        |
| B     | Modelo intermediado basado en cuentas   | 32        |
| C     | Modelo directo basado en tokens         | 33        |
| D     | Modelo intermediado basado en tokens    | 34        |

**Fase 1 — Preparación (20 min)**:

Cada grupo prepara su defensa contestando explícitamente a:

1. ¿Por qué nuestro modelo es el MEJOR para el ciudadano europeo?
2. ¿Quién custodia los fondos en nuestro modelo? ¿Por qué es buena idea?
3. ¿Qué pasa con la privacidad? ¿Quién ve qué?
4. ¿Quién hace el KYC y quién el AML? ¿Es eficiente?
5. ¿Es viable la programabilidad? ¿Y los pagos offline?
6. ¿Qué pasa con los bancos comerciales en nuestro modelo? ¿Se cargan el negocio bancario?
7. ¿Cómo de difícil es escalarlo a 350 millones de usuarios?

Pueden buscar en internet (papers del BCE, opiniones de banqueros centrales, etc.) — máximo 20 min.

**Fase 2 — Ronda de defensas (20 min)**:

Cada grupo tiene 3 minutos para exponer su tesis. Sin interrupciones. Tras los 4 grupos, 4 minutos de preguntas cruzadas (un grupo pregunta a otro, encadenado).

**Fase 3 — Rebatir (10 min)**:

Cada grupo elige UN modelo distinto al suyo y argumenta en 90 segundos por qué ESE modelo es peor. El grupo aludido tiene 30 segundos para contestar.

**Fase 4 — Voto y veredicto (10 min)**:

Cada persona vota un modelo, EXCEPTO el suyo. Conteo en la pizarra. El profe revela cuál ha elegido el BCE de facto (modelo intermediado en cuentas, el más "blando" para los bancos comerciales) y compara con el resultado del aula.

**Output del aula**: la pizarra con la tabla "ventaja/desventaja" cruzada por los 4 modelos × 7 criterios.

---

## Actividad 4 — Post-mortem: reproduce el ataque a Terra/Luna

**Objetivo**: que el grupo SEPA explicar el colapso de Terra/Luna paso a paso y proponga puntos donde el ataque podría haberse cortado. Las slides 13-20 dan el material; aquí el alumno tiene que ordenar la cadena y proponer defensas.

**Formato**: parejas o tríos. 50 minutos.

**Material de partida**:
- Slides 13-20 del Módulo 4.
- Búsqueda libre en internet (artículos de Chainalysis, Elliptic, CoinDesk, papers académicos sobre el colapso).

**Fase 1 — Kill-chain (25 min)**:

Reconstruid la cadena del ataque en al menos 6 pasos, cronológicamente, con FECHAS reales. Plantilla:

```
PASO 1 — [fecha] — [evento]
   Actores involucrados:
   Efecto en UST:
   Efecto en LUNA:
   Mecanismo del algoritmo que se gatilla:

PASO 2 — ...
...
PASO N — [fecha] — colapso terminal
```

Mínimo 6 pasos, máximo 10. Cada paso tiene que ser FALSABLE — si alguien afirma "los atacantes vendieron X millones" tiene que poder citarlo.

**Fase 2 — Diagrama de palancas (10 min)**:

Por cada paso de la kill-chain, identificad qué "palanca" del sistema se está apretando:

```
Paso N → palanca: [retirada masiva | venta OTC | apertura corta | quema | mint | ...]
```

**Fase 3 — Defensas (15 min)**:

Para CADA palanca, proponed UNA defensa que habría cortado el ataque en ese punto:

- ¿Una medida técnica? (límites de mint por día, oráculos de precio descentralizados, circuit breakers…)
- ¿Una medida regulatoria? (auditoría obligatoria de reservas, restricción de yields > X %…)
- ¿Una medida de gobernanza? (multisig en el mint masivo, veto del staking…)

Resaltad cuáles habrían exigido CAMBIOS DE PROTOCOLO (no eran posibles ese día) y cuáles habrían sido alcanzables sin tocar el smart contract.

**Entregable**: una hoja con la kill-chain de 6-10 pasos + tabla de palancas + tabla de defensas con la columna "viable sin redeploy: sí/no".

**Cierre (5 min)**: discutimos en clase si Terra/Luna era REALMENTE rescatable o si su diseño era un fallo estructural. Provocación del profe: "¿es posible una stablecoin algorítmica viable, o es un oxímoron?".

---

## Actividad 5 — Tokeniza un bono para una PYME real

**Objetivo**: aplicar lo aprendido con los bonos de Santander 2019 y EIB 2021 a un caso concreto. Pasar de la teoría al diseño funcional de una emisión.

**Formato**: grupos de 3-4 personas. 75 minutos (60 de diseño + 15 de presentación).

**Punto de partida**:

Cada grupo elige UNA PYME real (puede ser inventada pero verosímil) que quiere emitir deuda por **2 M €** para financiar una compra de maquinaria, una expansión geográfica o un proyecto de I+D. El grupo decide los detalles del negocio (nombre, sector, facturación, etc.).

**Restricciones**:
- Es una PYME real, no un gigante: la emisión tiene que tener sentido a esa escala.
- Hay que poder cerrar la operación en **menos de 1 semana** (vs los meses del proceso tradicional).
- Los cupones se pagan en efectivo tokenizado (no fiat).
- La emisión tiene que ser legalmente válida bajo derecho español o irlandés (a elegir).

**Bloques del diseño** (cada grupo entrega una hoja con los 6 bloques rellenos):

### Bloque 1 — Estructura del bono
- Valor nominal por token
- Número total de tokens emitidos
- Cupón (% anual, frecuencia)
- Vencimiento
- ¿Convertible? ¿Subordinado?

### Bloque 2 — Actores
Diagrama con: emisor, inversores, custodio, settlement agent, asesor legal. Quién hace qué EN BLOCKCHAIN (registra, firma, valida) y quién FUERA (legal, comercial).

### Bloque 3 — Tecnología
- Red elegida: pública (Ethereum L1, L2…) vs privada (Fabric, Corda…). Justificar.
- Estándar del token: ¿ERC-20? ¿ERC-1400 (security token)? ¿Token nativo de Fabric?
- Wallet del inversor: ¿custodial o non-custodial?
- ¿Hay KYC on-chain o se delega a un actor regulado?

### Bloque 4 — Pagos
- Cómo se paga el principal en la emisión inicial (DvP atómico, T+0…)
- Cómo se pagan los cupones (smart contract que distribuye automáticamente, o disparador manual)
- Qué pasa si un inversor pierde su clave privada

### Bloque 5 — Cumplimiento normativo
- ¿Se considera valor mobiliario? ¿Folleto CNMV / Central Bank of Ireland?
- ¿Cómo se publican los hechos relevantes (resultados trimestrales, eventos corporativos)?
- ¿Qué pasa con MiCA? ¿Y con el reglamento de mercados piloto DLT?

### Bloque 6 — Métricas de éxito
- Coste total de la emisión (vs estimación tradicional)
- Tiempo total desde idea a cierre (días)
- 3 KPIs operativos durante la vida del bono

**Presentación (3 min por grupo)**:
- 30 s — la PYME y por qué emite
- 90 s — las 3 decisiones más arriesgadas del diseño (no las más obvias: las que el grupo cree que son discutibles)
- 60 s — cuánto cuesta y cuánto tarda comparado con el bono tradicional

**Cierre (10 min)**: discusión cruzada — ¿en cuál de las 5 propuestas invertiríais con vuestro propio dinero? ¿Qué grupo se ha pasado de optimista? El profe contrasta cada decisión con lo que hicieron Santander 2019 y EIB 2021.

---

## Cómo encadenar las actividades en el día

Sugerencia de orden si se hacen todas:

| Tramo del día | Actividad | Cambio de energía                          |
|---------------|-----------|---------------------------------------------|
| Tras lección  | 1 (Treasure Hunt) | Suelta la mente, exploración libre  |
| Antes de comer| 4 (Post-mortem)   | Concentración profunda              |
| Tras comer    | 3 (Debate)        | Activar voz, contrastar             |
| Tarde         | 2 (Stablecoin)    | Creatividad + síntesis              |
| Cierre        | 5 (Bono PYME)     | Aterrizaje real, conexión negocio   |

Si solo se hacen 2: 1 + 2 (descubrir + diseñar) son las más versátiles. Si solo se hace 1: la 3 (debate) es la que genera más participación.

---

## Notas para el instructor

- En las actividades de pitch (2 y 5), **temporizar SIEMPRE** con cronómetro visible. El alumno que se pasa de tiempo aprende menos.
- En el debate (3), evita que el profe tome partido — solo modera. La gracia es que los alumnos descubran solos que el modelo del BCE no es trivialmente el mejor.
- En el post-mortem (4), el alumno tiende a culpar exclusivamente al "atacante". Empujar a que vean también las decisiones de diseño previas (Anchor 20%, mint sin límites…) como parte del fallo.
- En el treasure hunt (1), advertir al inicio que **los datos cambian rápido**: una stablecoin que era top 5 hace 6 meses puede haber colapsado. Eso es parte del aprendizaje.
- Todas las actividades aceptan SCALE-OUT: si tienes muchos alumnos, multiplicas el nº de grupos; los pitchs se hacen más cortos.

---

## Referencias

- Slides del módulo: `docs/Modulo 4/Modulo_4.pptx`
- Atlantic Council CBDC Tracker: https://www.atlanticcouncil.org/cbdctracker/
- Caso Terra/Luna — análisis de Chainalysis y CoinDesk (búsqueda libre)
- MiCA (Reglamento UE 2023/1114) — DOUE
