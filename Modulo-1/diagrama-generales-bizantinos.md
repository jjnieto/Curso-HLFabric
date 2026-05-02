# Generales Bizantinos — Diagramas con 3, 4, 5 y 6 generales

## Caso 1: El traidor es un teniente

El Comandante es leal y ordena **"Atacar"**. El Teniente 2 es el traidor.

### Ronda 1 — El Comandante envía la orden

```mermaid
graph TD
    C["🟢 COMANDANTE<br/>(leal)<br/>Orden: ATACAR"]
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🔴 Teniente 2<br/>(TRAIDOR)"]
    L3["🟢 Teniente 3<br/>(leal)"]

    C -->|"Atacar"| L1
    C -->|"Atacar"| L2
    C -->|"Atacar"| L3

    style C fill:#4CAF50,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
```

### Ronda 2 — Los tenientes intercambian lo que recibieron

```mermaid
graph LR
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🔴 Teniente 2<br/>(TRAIDOR)"]
    L3["🟢 Teniente 3<br/>(leal)"]

    L1 -->|"Yo recibí: Atacar"| L2
    L1 -->|"Yo recibí: Atacar"| L3

    L2 -->|"Yo recibí: RETIRARSE ❌"| L1
    L2 -->|"Yo recibí: RETIRARSE ❌"| L3

    L3 -->|"Yo recibí: Atacar"| L1
    L3 -->|"Yo recibí: Atacar"| L2

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
```

### Votación por mayoría

```mermaid
graph TD
    subgraph T1["Teniente 1 (leal) — DECIDE"]
        T1a["Del Comandante: Atacar"]
        T1b["Del Teniente 2: Retirarse"]
        T1c["Del Teniente 3: Atacar"]
        T1r["MAYORÍA → ✅ ATACAR<br/>(2 Atacar vs 1 Retirarse)"]
        T1a --> T1r
        T1b --> T1r
        T1c --> T1r
    end

    subgraph T3["Teniente 3 (leal) — DECIDE"]
        T3a["Del Comandante: Atacar"]
        T3b["Del Teniente 1: Atacar"]
        T3c["Del Teniente 2: Retirarse"]
        T3r["MAYORÍA → ✅ ATACAR<br/>(2 Atacar vs 1 Retirarse)"]
        T3a --> T3r
        T3b --> T3r
        T3c --> T3r
    end

    style T1r fill:#4CAF50,color:#fff
    style T3r fill:#4CAF50,color:#fff
```

**Resultado: Ambos tenientes leales deciden ATACAR. Consenso alcanzado.**

---

## Caso 2: El traidor es el Comandante

El Comandante es el traidor. Envía órdenes contradictorias. Los 3 tenientes son leales.

### Ronda 1 — El Comandante (traidor) envía órdenes distintas

```mermaid
graph TD
    C["🔴 COMANDANTE<br/>(TRAIDOR)"]
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🟢 Teniente 2<br/>(leal)"]
    L3["🟢 Teniente 3<br/>(leal)"]

    C -->|"Atacar"| L1
    C -->|"RETIRARSE ❌"| L2
    C -->|"Atacar"| L3

    style C fill:#f44336,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
    style L3 fill:#4CAF50,color:#fff
```

### Ronda 2 — Los tenientes intercambian lo que recibieron (todos dicen la verdad)

```mermaid
graph LR
    L1["🟢 Teniente 1"]
    L2["🟢 Teniente 2"]
    L3["🟢 Teniente 3"]

    L1 -->|"Yo recibí: Atacar"| L2
    L1 -->|"Yo recibí: Atacar"| L3

    L2 -->|"Yo recibí: Retirarse"| L1
    L2 -->|"Yo recibí: Retirarse"| L3

    L3 -->|"Yo recibí: Atacar"| L1
    L3 -->|"Yo recibí: Atacar"| L2

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
    style L3 fill:#4CAF50,color:#fff
```

### Votación por mayoría

```mermaid
graph TD
    subgraph T1["Teniente 1 (leal) — DECIDE"]
        T1a["Del Comandante: Atacar"]
        T1b["Del Teniente 2: Retirarse"]
        T1c["Del Teniente 3: Atacar"]
        T1r["MAYORÍA → ✅ ATACAR<br/>(2 Atacar vs 1 Retirarse)"]
        T1a --> T1r
        T1b --> T1r
        T1c --> T1r
    end

    subgraph T2["Teniente 2 (leal) — DECIDE"]
        T2a["Del Comandante: Retirarse"]
        T2b["Del Teniente 1: Atacar"]
        T2c["Del Teniente 3: Atacar"]
        T2r["MAYORÍA → ✅ ATACAR<br/>(2 Atacar vs 1 Retirarse)"]
        T2a --> T2r
        T2b --> T2r
        T2c --> T2r
    end

    subgraph T3["Teniente 3 (leal) — DECIDE"]
        T3a["Del Comandante: Atacar"]
        T3b["Del Teniente 1: Atacar"]
        T3c["Del Teniente 2: Retirarse"]
        T3r["MAYORÍA → ✅ ATACAR<br/>(2 Atacar vs 1 Retirarse)"]
        T3a --> T3r
        T3b --> T3r
        T3c --> T3r
    end

    style T1r fill:#4CAF50,color:#fff
    style T2r fill:#4CAF50,color:#fff
    style T3r fill:#4CAF50,color:#fff
```

**Resultado: Los 3 tenientes leales deciden ATACAR. Consenso alcanzado.**

El Teniente 2 recibió "Retirarse" del comandante traidor, pero al contrastar con los otros dos tenientes, descubre que la mayoría dice "Atacar" → se alinea con la mayoría.

---

## Caso 3 (fallo): Solo 3 generales con 1 traidor

Con 3 generales no se puede resolver. Ejemplo: Comandante traidor.

### Ronda 1

```mermaid
graph TD
    C["🔴 COMANDANTE<br/>(TRAIDOR)"]
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🟢 Teniente 2<br/>(leal)"]

    C -->|"Atacar"| L1
    C -->|"RETIRARSE ❌"| L2

    style C fill:#f44336,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
```

### Ronda 2

```mermaid
graph LR
    L1["🟢 Teniente 1"]
    L2["🟢 Teniente 2"]

    L1 -->|"Yo recibí: Atacar"| L2
    L2 -->|"Yo recibí: Retirarse"| L1

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
```

### Votación

```mermaid
graph TD
    subgraph T1["Teniente 1 — DECIDE"]
        T1a["Del Comandante: Atacar"]
        T1b["Del Teniente 2: Retirarse"]
        T1r["EMPATE ❌<br/>(1 Atacar vs 1 Retirarse)<br/>NO HAY MAYORÍA"]
        T1a --> T1r
        T1b --> T1r
    end

    subgraph T2["Teniente 2 — DECIDE"]
        T2a["Del Comandante: Retirarse"]
        T2b["Del Teniente 1: Atacar"]
        T2r["EMPATE ❌<br/>(1 Atacar vs 1 Retirarse)<br/>NO HAY MAYORÍA"]
        T2a --> T2r
        T2b --> T2r
    end

    style T1r fill:#FF9800,color:#fff
    style T2r fill:#FF9800,color:#fff
```

**Resultado: Empate. Cada teniente tiene 1 voto de cada tipo. No pueden distinguir quién miente. NO hay consenso posible.**

---

## 5 generales con 1 traidor — Funciona con más margen

Comandante leal, 4 tenientes (1 traidor). El margen de mayoría es aún mayor.

### Ronda 1 — El Comandante envía la orden

```mermaid
graph TD
    C["🟢 COMANDANTE<br/>(leal)<br/>Orden: ATACAR"]
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🔴 Teniente 2<br/>(TRAIDOR)"]
    L3["🟢 Teniente 3<br/>(leal)"]
    L4["🟢 Teniente 4<br/>(leal)"]

    C -->|"Atacar"| L1
    C -->|"Atacar"| L2
    C -->|"Atacar"| L3
    C -->|"Atacar"| L4

    style C fill:#4CAF50,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
    style L4 fill:#4CAF50,color:#fff
```

### Ronda 2 — Intercambio entre tenientes

```mermaid
graph LR
    L1["🟢 T1"]
    L2["🔴 T2 TRAIDOR"]
    L3["🟢 T3"]
    L4["🟢 T4"]

    L1 -->|"Atacar"| L3
    L1 -->|"Atacar"| L4
    L3 -->|"Atacar"| L1
    L3 -->|"Atacar"| L4
    L4 -->|"Atacar"| L1
    L4 -->|"Atacar"| L3
    L2 -->|"RETIRARSE ❌"| L1
    L2 -->|"RETIRARSE ❌"| L3
    L2 -->|"RETIRARSE ❌"| L4

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
    style L4 fill:#4CAF50,color:#fff
```

### Votación — Ejemplo: Teniente 1

```mermaid
graph TD
    subgraph T1["Teniente 1 (leal) — DECIDE"]
        V1["Del Comandante: Atacar"]
        V2["Del T2 traidor: Retirarse"]
        V3["Del T3: Atacar"]
        V4["Del T4: Atacar"]
        R1["MAYORÍA → ✅ ATACAR<br/>(3 Atacar vs 1 Retirarse)"]
        V1 --> R1
        V2 --> R1
        V3 --> R1
        V4 --> R1
    end

    style R1 fill:#4CAF50,color:#fff
```

**Todos los tenientes leales tienen el mismo resultado: 3 Atacar vs 1 Retirarse. Consenso fácil.**

Con 5 generales y 1 traidor, el margen es muy cómodo (3 vs 1). El sistema tolera hasta 1 traidor (necesitaría 4 para fallar, lo cual requeriría al menos 4 traidores sobre 5 — muy por encima de 1/3).

---

## 5 generales con 2 traidores — Falla (no cumple n ≥ 3f+1)

Necesitaríamos 3×2+1 = **7 generales** para tolerar 2 traidores. Con solo 5, falla.

### Ronda 1 — Comandante traidor, T2 también traidor

```mermaid
graph TD
    C["🔴 COMANDANTE<br/>(TRAIDOR)"]
    L1["🟢 Teniente 1<br/>(leal)"]
    L2["🔴 Teniente 2<br/>(TRAIDOR)"]
    L3["🟢 Teniente 3<br/>(leal)"]
    L4["🟢 Teniente 4<br/>(leal)"]

    C -->|"Atacar"| L1
    C -->|"Retirarse"| L2
    C -->|"Atacar"| L3
    C -->|"Retirarse"| L4

    style C fill:#f44336,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
    style L4 fill:#4CAF50,color:#fff
```

### Ronda 2 — Intercambio

```mermaid
graph LR
    L1["🟢 T1"]
    L2["🔴 T2 TRAIDOR"]
    L3["🟢 T3"]
    L4["🟢 T4"]

    L1 -->|"Atacar"| L3
    L1 -->|"Atacar"| L4
    L3 -->|"Atacar"| L1
    L3 -->|"Atacar"| L4
    L4 -->|"Retirarse"| L1
    L4 -->|"Retirarse"| L3
    L2 -->|"ATACAR ❌ miente"| L1
    L2 -->|"RETIRARSE ❌ miente"| L3
    L2 -->|"ATACAR ❌ miente"| L4

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#f44336,color:#fff
    style L3 fill:#4CAF50,color:#fff
    style L4 fill:#4CAF50,color:#fff
```

### Votación — Los leales NO llegan al mismo resultado

```mermaid
graph TD
    subgraph T1["Teniente 1 — DECIDE"]
        T1a["Del Comandante: Atacar"]
        T1b["Del T2 traidor: Atacar"]
        T1c["Del T3: Atacar"]
        T1d["Del T4: Retirarse"]
        T1r["MAYORÍA → ATACAR<br/>(3 Atacar vs 1 Retirarse)"]
        T1a --> T1r
        T1b --> T1r
        T1c --> T1r
        T1d --> T1r
    end

    subgraph T3["Teniente 3 — DECIDE"]
        T3a["Del Comandante: Atacar"]
        T3b["Del T1: Atacar"]
        T3c["Del T2 traidor: Retirarse"]
        T3d["Del T4: Retirarse"]
        T3r["EMPATE ❌<br/>(2 Atacar vs 2 Retirarse)<br/>NO HAY MAYORÍA"]
        T3a --> T3r
        T3b --> T3r
        T3c --> T3r
        T3d --> T3r
    end

    subgraph T4["Teniente 4 — DECIDE"]
        T4a["Del Comandante: Retirarse"]
        T4b["Del T1: Atacar"]
        T4c["Del T2 traidor: Atacar"]
        T4d["Del T3: Atacar"]
        T4r["MAYORÍA → ATACAR<br/>(3 Atacar vs 1 Retirarse)"]
        T4a --> T4r
        T4b --> T4r
        T4c --> T4r
        T4d --> T4r
    end

    style T1r fill:#4CAF50,color:#fff
    style T3r fill:#FF9800,color:#fff
    style T4r fill:#4CAF50,color:#fff
```

**Resultado: T1 y T4 deciden Atacar, pero T3 tiene empate y no puede decidir. Los traidores (Comandante + T2) han enviado mensajes diferentes a cada leal, rompiendo el consenso. FALLA.**

---

## 6 generales con 1 traidor — Funciona con margen enorme

Con 6 generales y solo 1 traidor (muy por encima de 3×1+1=4), el consenso es trivial.

### Ronda 1 — Comandante leal

```mermaid
graph TD
    C["🟢 COMANDANTE<br/>(leal)<br/>Orden: ATACAR"]
    L1["🟢 T1 (leal)"]
    L2["🟢 T2 (leal)"]
    L3["🔴 T3 (TRAIDOR)"]
    L4["🟢 T4 (leal)"]
    L5["🟢 T5 (leal)"]

    C -->|"Atacar"| L1
    C -->|"Atacar"| L2
    C -->|"Atacar"| L3
    C -->|"Atacar"| L4
    C -->|"Atacar"| L5

    style C fill:#4CAF50,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
    style L3 fill:#f44336,color:#fff
    style L4 fill:#4CAF50,color:#fff
    style L5 fill:#4CAF50,color:#fff
```

### Votación — Ejemplo: Teniente 1

```mermaid
graph TD
    subgraph T1["Teniente 1 (leal) — DECIDE"]
        V1["Del Comandante: Atacar"]
        V2["Del T2: Atacar"]
        V3["Del T3 traidor: Retirarse"]
        V4["Del T4: Atacar"]
        V5["Del T5: Atacar"]
        R1["MAYORÍA → ✅ ATACAR<br/>(4 Atacar vs 1 Retirarse)"]
        V1 --> R1
        V2 --> R1
        V3 --> R1
        V4 --> R1
        V5 --> R1
    end

    style R1 fill:#4CAF50,color:#fff
```

**4 contra 1. El traidor es irrelevante. Consenso trivial.**

---

## 6 generales con 2 traidores — NO funciona (6 < 3×2+1 = 7)

### Ronda 1 — Comandante traidor, T3 también traidor

```mermaid
graph TD
    C["🔴 COMANDANTE<br/>(TRAIDOR)"]
    L1["🟢 T1 (leal)"]
    L2["🟢 T2 (leal)"]
    L3["🔴 T3 (TRAIDOR)"]
    L4["🟢 T4 (leal)"]
    L5["🟢 T5 (leal)"]

    C -->|"Atacar"| L1
    C -->|"Retirarse"| L2
    C -->|"Retirarse"| L3
    C -->|"Atacar"| L4
    C -->|"Retirarse"| L5

    style C fill:#f44336,color:#fff
    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
    style L3 fill:#f44336,color:#fff
    style L4 fill:#4CAF50,color:#fff
    style L5 fill:#4CAF50,color:#fff
```

### Ronda 2 — Intercambio (los leales dicen la verdad, T3 miente)

```mermaid
graph LR
    L1["🟢 T1"]
    L2["🟢 T2"]
    L3["🔴 T3"]
    L4["🟢 T4"]
    L5["🟢 T5"]

    L1 -->|"Atacar"| L2
    L1 -->|"Atacar"| L4
    L1 -->|"Atacar"| L5
    L2 -->|"Retirarse"| L1
    L2 -->|"Retirarse"| L4
    L2 -->|"Retirarse"| L5
    L4 -->|"Atacar"| L1
    L4 -->|"Atacar"| L2
    L4 -->|"Atacar"| L5
    L5 -->|"Retirarse"| L1
    L5 -->|"Retirarse"| L2
    L5 -->|"Retirarse"| L4
    L3 -->|"ATACAR ❌"| L1
    L3 -->|"ATACAR ❌"| L2
    L3 -->|"RETIRARSE ❌"| L4
    L3 -->|"ATACAR ❌"| L5

    style L1 fill:#4CAF50,color:#fff
    style L2 fill:#4CAF50,color:#fff
    style L3 fill:#f44336,color:#fff
    style L4 fill:#4CAF50,color:#fff
    style L5 fill:#4CAF50,color:#fff
```

### Votación — Los 4 tenientes leales

```mermaid
graph TD
    subgraph T1["T1 (recibió Atacar del Cmd)"]
        T1a["Cmd: Atacar"]
        T1b["T2: Retirarse"]
        T1c["T3: Atacar ❌"]
        T1d["T4: Atacar"]
        T1e["T5: Retirarse"]
        T1r["3 Atacar vs 2 Retirarse<br/>→ ✅ ATACAR"]
        T1a --> T1r
        T1b --> T1r
        T1c --> T1r
        T1d --> T1r
        T1e --> T1r
    end

    subgraph T2["T2 (recibió Retirarse del Cmd)"]
        T2a["Cmd: Retirarse"]
        T2b["T1: Atacar"]
        T2c["T3: Atacar ❌"]
        T2d["T4: Atacar"]
        T2e["T5: Retirarse"]
        T2r["3 Atacar vs 2 Retirarse<br/>→ ✅ ATACAR"]
        T2a --> T2r
        T2b --> T2r
        T2c --> T2r
        T2d --> T2r
        T2e --> T2r
    end

    subgraph T4["T4 (recibió Atacar del Cmd)"]
        T4a["Cmd: Atacar"]
        T4b["T1: Atacar"]
        T4c["T2: Retirarse"]
        T4d["T3: Retirarse ❌"]
        T4e["T5: Retirarse"]
        T4r["2 Atacar vs 3 Retirarse<br/>→ ✅ RETIRARSE"]
        T4a --> T4r
        T4b --> T4r
        T4c --> T4r
        T4d --> T4r
        T4e --> T4r
    end

    subgraph T5["T5 (recibió Retirarse del Cmd)"]
        T5a["Cmd: Retirarse"]
        T5b["T1: Atacar"]
        T5c["T2: Retirarse"]
        T5d["T3: Atacar ❌"]
        T5e["T4: Atacar"]
        T5r["3 Atacar vs 2 Retirarse<br/>→ ✅ ATACAR"]
        T5a --> T5r
        T5b --> T5r
        T5c --> T5r
        T5d --> T5r
        T5e --> T5r
    end

    style T1r fill:#4CAF50,color:#fff
    style T2r fill:#4CAF50,color:#fff
    style T4r fill:#f44336,color:#fff
    style T5r fill:#4CAF50,color:#fff
```

**Resultado: T1, T2 y T5 deciden ATACAR, pero T4 decide RETIRARSE. El traidor T3 envió mensajes diferentes a cada leal, y logró que T4 viera una mayoría distinta. NO hay consenso total entre leales. FALLA.**

> **Conclusión:** 6 generales con 2 traidores **no funciona**. La regla exige n ≥ 3f+1 = **7**, y 6 < 7. Este caso demuestra que no basta con tener "más o menos" 2/3 leales — hacen falta **estrictamente más** de 2/3. Con 7 generales y 2 traidores (5 leales), sí funcionaría.

---

## Resumen visual de la regla

```mermaid
graph LR
    subgraph FALLA["❌ NO FUNCIONA"]
        F1["3 generales<br/>1 traidor"]
        F5["5 generales<br/>2 traidores"]
        F6["6 generales<br/>2 traidores"]
    end

    subgraph FUNCIONA["✅ FUNCIONA"]
        F2["4 generales<br/>1 traidor"]
        F7["5 generales<br/>1 traidor"]
        F8["6 generales<br/>1 traidor"]
        F3["7 generales<br/>2 traidores"]
        F4["10 generales<br/>3 traidores"]
    end

    R["REGLA: n ≥ 3f + 1<br/>Máximo 1/3 de traidores"]

    style FALLA fill:#ffcdd2
    style FUNCIONA fill:#c8e6c9
    style R fill:#2196F3,color:#fff
```

**Fórmula:** Para tolerar **f** traidores, necesitas al menos **3f + 1** generales.

| Traidores (f) | Generales necesarios (3f+1) | Leales mínimos |
|---|---|---|
| 1 | 4 | 3 |
| 2 | 7 | 5 |
| 3 | 10 | 7 |
| 10 | 31 | 21 |
