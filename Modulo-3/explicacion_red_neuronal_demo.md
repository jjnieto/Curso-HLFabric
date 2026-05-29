# Entendiendo una red neuronal con una demo de reconocimiento de dígitos

## 1. ¿Qué hace esta demo?

Esta demo muestra una **red neuronal artificial** entrenada para reconocer números escritos a mano.

El usuario dibuja un número en una cuadrícula de píxeles y la red intenta decidir si ese dibujo representa un:

**0, 1, 2, 3, 4, 5, 6, 7, 8 o 9**

La idea importante es esta:

> Una red neuronal no guarda reglas escritas por una persona.  
> Guarda muchos números aprendidos durante el entrenamiento.

A esos números aprendidos los llamamos **parámetros**.

---

## 2. Visión general de la red

La red didáctica que se visualiza en la demo tiene esta estructura:

```mermaid
flowchart TB

    A["Capa de entrada<br/><b>20 × 20 píxeles</b><br/>400 valores de entrada"]

    B["Capa oculta 1<br/><b>25 neuronas</b><br/>Detecta patrones simples"]

    C["Capa oculta 2<br/><b>25 neuronas</b><br/>Combina patrones"]

    D["Capa de salida<br/><b>10 neuronas</b><br/>Una por cada dígito"]

    E["Predicción final<br/>El dígito más probable"]

    A --> B
    B --> C
    C --> D
    D --> E
```

La red tiene:

| Capa | Tamaño | Qué representa |
|---|---:|---|
| Entrada | 400 valores | Los píxeles del dibujo |
| Oculta 1 | 25 neuronas | Patrones simples |
| Oculta 2 | 25 neuronas | Combinaciones de patrones |
| Salida | 10 neuronas | Dígitos del 0 al 9 |

---

## 3. La capa de entrada: convertir un dibujo en números

La zona de dibujo es una cuadrícula de:

```text
20 × 20 = 400 píxeles
```

Cada píxel se convierte en un número.

| Color del píxel | Valor aproximado |
|---|---:|
| Blanco | 0.0 |
| Gris claro | 0.25 |
| Gris oscuro | 0.75 |
| Negro | 1.0 |

Por tanto, cuando dibujamos un número, realmente estamos dando a la red una lista de **400 valores numéricos**.

```mermaid
flowchart TB

    A["Dibujo del usuario<br/>en una cuadrícula 20 × 20"]

    B["400 píxeles"]

    C["400 números<br/>entre 0.0 y 1.0"]

    D["Capa de entrada<br/>400 valores"]

    A --> B
    B --> C
    C --> D
```

La capa de entrada **no aprende** y **no decide**.  
Solo contiene los datos que entran en la red.

---

## 4. Primera capa oculta: detectar patrones simples

La primera capa oculta tiene **25 neuronas**.

Cada una recibe información de los **400 píxeles de entrada**.

```mermaid
flowchart TB

    A["400 valores de entrada<br/>píxeles del dibujo"]

    B["Neurona oculta 1"]
    C["Neurona oculta 2"]
    D["Neurona oculta 3"]
    E["..."]
    F["Neurona oculta 25"]

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
```

Una neurona de esta capa puede aprender a activarse ante patrones como:

- una línea vertical,
- una línea horizontal,
- una curva,
- una esquina,
- una zona oscura en determinada parte del dibujo.

No se lo programamos a mano.  
La red lo aprende ajustando sus pesos durante el entrenamiento.

---

## 5. Segunda capa oculta: combinar patrones

La segunda capa oculta también tiene **25 neuronas**.

Pero ya no mira directamente los píxeles originales.  
Mira lo que ha detectado la primera capa.

```mermaid
flowchart TB

    A["Capa oculta 1<br/>patrones simples"]

    B["Líneas"]
    C["Curvas"]
    D["Esquinas"]
    E["Zonas oscuras"]

    F["Capa oculta 2<br/>patrones combinados"]

    G["Forma parecida a un 3"]
    H["Forma parecida a un 8"]
    I["Forma parecida a un 9"]

    A --> B
    A --> C
    A --> D
    A --> E

    B --> F
    C --> F
    D --> F
    E --> F

    F --> G
    F --> H
    F --> I
```

Esta segunda capa puede combinar información del tipo:

> “Hay una curva arriba, otra abajo y bastante simetría.”

Eso podría hacer que la red se incline por un **8**.

O:

> “Hay una línea vertical y una curva en la parte superior.”

Eso podría hacer que la red se incline por un **9**.

---

## 6. La capa de salida: una neurona por cada número

La última capa tiene **10 neuronas**.

Cada neurona representa una posible respuesta.

```mermaid
flowchart TB

    A["Capa oculta 2<br/>25 neuronas"]

    B["Salida 0"]
    C["Salida 1"]
    D["Salida 2"]
    E["Salida 3"]
    F["Salida 4"]
    G["Salida 5"]
    H["Salida 6"]
    I["Salida 7"]
    J["Salida 8"]
    K["Salida 9"]

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    A --> I
    A --> J
    A --> K
```

Un resultado podría ser:

| Dígito | Activación |
|---:|---:|
| 0 | 0.01 |
| 1 | 0.00 |
| 2 | 0.04 |
| 3 | 0.87 |
| 4 | 0.02 |
| 5 | 0.03 |
| 6 | 0.00 |
| 7 | 0.01 |
| 8 | 0.01 |
| 9 | 0.01 |

En este caso, la red respondería:

> Es un **3**

porque la neurona del 3 es la que tiene mayor activación.

---

## 7. ¿Qué representa una conexión?

Una conexión une una neurona con otra.

Pero lo importante no es la línea visual.  
Lo importante es que cada conexión tiene un número asociado llamado **peso**.

```mermaid
flowchart TB

    A["Neurona A"]

    B["Peso de la conexión<br/><b>0.73</b>"]

    C["Neurona B"]

    A --> B
    B --> C
```

Ese peso indica cuánto influye una neurona sobre otra.

| Peso | Efecto aproximado |
|---:|---|
| Positivo | Ayuda a activar la siguiente neurona |
| Negativo | Reduce o inhibe la siguiente neurona |
| Cercano a 0 | Tiene poca influencia |

Durante el entrenamiento, la red va ajustando esos pesos.

---

## 8. ¿Qué es un bias?

Además de los pesos de las conexiones, cada neurona suele tener otro número llamado **bias** o **sesgo**.

El bias permite que una neurona se active con más o menos facilidad.

```mermaid
flowchart TB

    A["Entradas"]

    B["Pesos"]

    C["Suma ponderada"]

    D["Bias<br/>ajuste propio de la neurona"]

    E["Activación final"]

    A --> C
    B --> C
    C --> D
    D --> E
```

Una forma sencilla de verlo:

> Los pesos dicen cuánto importan las entradas.  
> El bias dice qué tendencia inicial tiene la neurona a activarse.

Por eso, cuando contamos los parámetros de una red, contamos:

```text
Parámetros = pesos + biases
```

---

## 9. Cómo se calcula el tamaño del modelo

Para calcular los parámetros de una red densa usamos esta regla:

```text
Parámetros entre dos capas =
neuronas de la capa anterior × neuronas de la capa siguiente
+ biases de la capa siguiente
```

Es decir:

```text
Parámetros = conexiones + biases
```

---

## 10. Cálculo de parámetros de esta red

### 10.1 Entrada → Capa oculta 1

La entrada tiene **400 valores**.  
La primera capa oculta tiene **25 neuronas**.

Cada una de las 25 neuronas recibe 400 conexiones.

```mermaid
flowchart TB

    A["Entrada<br/>400 valores"]

    B["Capa oculta 1<br/>25 neuronas"]

    C["Pesos<br/>400 × 25 = 10.000"]

    D["Biases<br/>25"]

    E["Total<br/><b>10.025 parámetros</b>"]

    A --> C
    B --> C
    C --> E
    D --> E
```

Resultado:

```text
400 × 25 = 10.000 pesos
25 biases
Total = 10.025 parámetros
```

---

### 10.2 Capa oculta 1 → Capa oculta 2

La primera capa oculta tiene **25 neuronas**.  
La segunda capa oculta tiene **25 neuronas**.

```mermaid
flowchart TB

    A["Capa oculta 1<br/>25 neuronas"]

    B["Capa oculta 2<br/>25 neuronas"]

    C["Pesos<br/>25 × 25 = 625"]

    D["Biases<br/>25"]

    E["Total<br/><b>650 parámetros</b>"]

    A --> C
    B --> C
    C --> E
    D --> E
```

Resultado:

```text
25 × 25 = 625 pesos
25 biases
Total = 650 parámetros
```

---

### 10.3 Capa oculta 2 → Capa de salida

La segunda capa oculta tiene **25 neuronas**.  
La salida tiene **10 neuronas**.

```mermaid
flowchart TB

    A["Capa oculta 2<br/>25 neuronas"]

    B["Capa de salida<br/>10 neuronas"]

    C["Pesos<br/>25 × 10 = 250"]

    D["Biases<br/>10"]

    E["Total<br/><b>260 parámetros</b>"]

    A --> C
    B --> C
    C --> E
    D --> E
```

Resultado:

```text
25 × 10 = 250 pesos
10 biases
Total = 260 parámetros
```

---

## 11. Total de parámetros

Sumamos los parámetros de cada tramo de la red.

```mermaid
flowchart TB

    A["Entrada → Oculta 1<br/>10.025 parámetros"]

    B["Oculta 1 → Oculta 2<br/>650 parámetros"]

    C["Oculta 2 → Salida<br/>260 parámetros"]

    D["Total del modelo<br/><b>10.935 parámetros</b>"]

    A --> D
    B --> D
    C --> D
```

Tabla resumen:

| Tramo | Pesos | Biases | Total |
|---|---:|---:|---:|
| Entrada → Oculta 1 | 10.000 | 25 | 10.025 |
| Oculta 1 → Oculta 2 | 625 | 25 | 650 |
| Oculta 2 → Salida | 250 | 10 | 260 |
| **Total** | **10.875** | **60** | **10.935** |

Por tanto, esta red tiene:

# 10.935 parámetros

Aproximadamente:

# 11.000 parámetros

---

## 12. ¿Cuánta memoria ocupa?

Si cada parámetro se guarda como un número de 32 bits, es decir, **4 bytes**:

```text
10.935 parámetros × 4 bytes = 43.740 bytes
```

Eso son aproximadamente:

```text
43 KB
```

Es un modelo diminuto.

Cabe en menos memoria que muchas imágenes pequeñas.

---

## 13. Comparación con modelos grandes

Ahora ya podemos entender mejor lo que significa decir que un modelo tiene muchos parámetros.

| Modelo | Parámetros aproximados |
|---|---:|
| Esta demo | 11.000 |
| LeNet-5 | 60.000 |
| AlexNet | 60 millones |
| BERT Base | 110 millones |
| GPT-2 | 1.500 millones |
| GPT-3 | 175.000 millones |

```mermaid
flowchart TB

    A["Nuestra demo<br/>11.000 parámetros"]

    B["Red clásica pequeña<br/>60.000 parámetros"]

    C["Modelo de visión grande<br/>60 millones"]

    D["Modelo de lenguaje mediano<br/>1.500 millones"]

    E["Modelo de lenguaje enorme<br/>175.000 millones"]

    A --> B
    B --> C
    C --> D
    D --> E
```

La diferencia no es conceptual.

La diferencia principal es de **escala**.

---

## 14. La idea clave

Cuando alguien dice:

> Este modelo tiene 175.000 millones de parámetros.

Está diciendo:

> Este modelo almacena 175.000 millones de números aprendidos.

Nuestra demo almacena unos **11.000 números aprendidos**.

Un modelo grande puede almacenar miles de millones de patrones sobre lenguaje, imágenes, código, razonamiento y conocimiento general.

---

## 15. Importante: la visualización no dibuja todas las conexiones

En la demo se ven líneas entre neuronas, pero no se muestran todas.

Si dibujáramos todas las conexiones reales, solo entre la entrada y la primera capa oculta tendríamos:

```text
400 × 25 = 10.000 líneas
```

La pantalla quedaría completamente saturada.

Por eso la demo muestra solo una parte de las conexiones, para que el alumno pueda entender la idea sin que el dibujo se vuelva ilegible.

```mermaid
flowchart TB

    A["Conexiones reales<br/>muchísimas"]

    B["Conexiones mostradas<br/>solo una muestra visual"]

    C["Objetivo<br/>hacer comprensible la red"]

    A --> B
    B --> C
```

---

## 16. Resumen final

Una red neuronal artificial funciona transformando números de entrada en números de salida.

En esta demo:

```mermaid
flowchart TB

    A["Dibujas un número"]

    B["El dibujo se convierte en<br/>400 valores numéricos"]

    C["La red combina esos valores<br/>mediante pesos y biases"]

    D["Las capas ocultas detectan<br/>patrones cada vez más complejos"]

    E["La salida activa<br/>uno de los dígitos 0-9"]

    F["La red predice<br/>qué número has dibujado"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

La idea fundamental:

> Una red neuronal es una gran colección de números ajustables.  
> Entrenar la red significa encontrar valores útiles para esos números.  
> Cuantos más parámetros tiene un modelo, más capacidad tiene para representar patrones complejos.

Esta demo tiene unos **11.000 parámetros**.  
Los grandes modelos modernos tienen **millones, miles de millones o incluso cientos de miles de millones de parámetros**.
