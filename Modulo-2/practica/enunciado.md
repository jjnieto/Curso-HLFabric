# Práctica del Módulo 2: SignChain

## Workflow de aprobación descentralizada de documentos

### El problema de negocio

Dos organizaciones, **Cliente** y **Proveedor**, intercambian documentos a diario: contratos, especificaciones técnicas, órdenes de compra, facturas. Antes de validar la entrega de un servicio o el pago de una factura, ambas partes necesitan **firmar el mismo documento** como prueba de aceptación.

El proceso actual tiene problemas serios:

- **Firma manuscrita escaneada**: trivial de falsificar y difícil de validar a posteriori.
- **Email con PDF firmado**: no hay registro centralizado, los documentos se pierden.
- **Servidor compartido**: alguien tiene que mantenerlo y ambas partes desconfían de quién controla el acceso.
- **Disputas**: si una org dice "yo firmé esto" y la otra "no, firmaste lo otro", no hay forma fiable de probar quién tiene razón.

Las dos organizaciones quieren una solución que:

1. Demuestre **criptográficamente** que ambas partes firmaron el mismo documento (sin posibilidad de manipulación).
2. Sea **descentralizada**: ninguna de las dos partes controle el sistema.
3. Sea **trazable**: que cualquiera pueda auditar el historial de aprobaciones.
4. Sea **inmutable**: una vez firmado, nadie puede borrar el registro.
5. Garantice la **privacidad del documento**: el contenido NO se publica, solo el hash.

Tu misión: diseñar y desplegar una red Hyperledger Fabric que resuelva este caso.

---

## Requisitos funcionales

El sistema debe permitir:

| Operación | Quién puede hacerla |
|-----------|---------------------|
| Registrar un documento nuevo (con su hash) | Cliente |
| Aprobar (firmar) un documento existente | Cliente o Proveedor (cada uno una vez) |
| Rechazar un documento | Cliente o Proveedor (con motivo) |
| Cancelar un documento aún no firmado completamente | Solo el que lo creó (Cliente) |
| Consultar un documento por ID | Cualquiera |
| Listar todos los documentos | Cualquiera |
| Ver el historial de cambios de un documento | Cualquiera |

### Estados posibles de un documento

```
pending → approved-by-cliente → approved-by-proveedor → fully-approved
   ↓             ↓                     ↓
cancelled    rejected              rejected
```

Un documento empieza en `pending` cuando se crea. Cada org lo aprueba o rechaza. Cuando ambas han aprobado pasa a `fully-approved`. Si alguna rechaza, queda en `rejected` (con motivo).

### Modelo de datos básico

Cada documento debería tener al menos:
- ID único (hash del documento, o un ID asignado)
- Hash SHA-256 del contenido del documento
- Título y descripción
- Quién lo creó (MSPID)
- Fecha de creación
- Estado actual
- Lista de firmas (org + cert público + firma criptográfica + timestamp)

---

## Lo que tienes que entregar

Un proyecto Fabric completo que cumpla los requisitos, organizado en estas fases:

### Fase 1: Diseño de la red

Antes de escribir código:

1. **Topología de red**: ¿Cuántas organizaciones? ¿Cuántos peers por org? ¿Cuántos orderers? ¿Cuántos canales?
2. **MSPs**: ¿Cómo se llaman los MSPIDs? ¿Qué dominios usan?
3. **Política de endorsement**: ¿`AND(Cliente, Proveedor)`, `OR`, `MAJORITY`? Justifica.
4. **Estructura del modelo de datos**: campos del documento, tipo de claves (composite keys?).
5. **Diagrama Mermaid** de la red propuesta.

### Fase 2: Material criptográfico con Fabric CA

NO uses cryptogen. Monta una **Fabric CA por organización** (incluida la del orderer):
- 3 contenedores Fabric CA (Cliente, Proveedor, OrdererOrg).
- Para cada org: enrolla el admin bootstrap, registra peer/orderer y admin de la org, enrolla cada identidad.
- Construye los MSPs en su estructura correcta (cacerts, tlscacerts, signcerts, keystore, config.yaml con NodeOUs).

### Fase 3: Levantar la red

- `configtx.yaml` con las 3 orgs (Cliente, Proveedor, OrdererOrg) y un canal `signchain-channel`.
- `docker-compose.yaml` con orderer + 2 peers + 2 CouchDB.
- Genera el bloque génesis del canal.
- Une el orderer al canal con `osnadmin`.
- Une los peers de Cliente y Proveedor al canal.

### Fase 4: Chaincode

Diseña e implementa el chaincode `signchain` en **Go o Node.js** (a elegir):

Funciones obligatorias:
- `CreateDocument(id, hash, title, description)` — solo Cliente
- `ApproveDocument(id, signatureBase64)` — Cliente o Proveedor (uno cada uno)
- `RejectDocument(id, reason)` — Cliente o Proveedor
- `CancelDocument(id)` — solo el creador
- `GetDocument(id)` — cualquiera
- `GetAllDocuments()` — cualquiera
- `GetDocumentHistory(id)` — cualquiera (usa `GetHistoryForKey`)

Validaciones obligatorias:
- Identidad del caller (MSPID)
- Estado válido para la transición (máquina de estados)
- Hash es de 64 caracteres hexadecimales (formato SHA-256)
- Una org no puede firmar dos veces el mismo documento

Eventos:
- `DocumentCreated`, `DocumentApproved`, `DocumentRejected`, `DocumentCancelled`

### Fase 5: Despliegue del chaincode

Lifecycle completo:
- Empaquetar el chaincode
- Instalar en peer Cliente y peer Proveedor
- Aprobar desde cada org (con política `AND(Cliente.peer, Proveedor.peer)`)
- Commit
- Inicializar el ledger (si aplica)

### Fase 6: Aplicación cliente y pruebas

Una pequeña app Node.js (o Go) que use Fabric Gateway SDK para:
- Crear un documento (calculando su hash SHA-256)
- Firmar el documento con la clave privada de la org y enviar la firma como aprobación
- Consultar el estado de un documento
- Verificar la cadena de firmas (que las firmas coinciden con los certs públicos del ledger)

Pruebas end-to-end del flujo:
1. Cliente crea documento → estado `pending`
2. Cliente firma → `approved-by-cliente`
3. Proveedor firma → `fully-approved`
4. Verificar que las firmas son válidas
5. Caso negativo: intento de firmar dos veces (debe fallar)
6. Caso negativo: Proveedor intenta cancelar (no es el creador, debe fallar)

---

## Preguntas guía (a responder en el informe)

Estas preguntas te ayudarán a tomar decisiones de diseño. Respóndelas en tu informe:

1. ¿Por qué necesitamos almacenar el hash del documento y NO el documento entero?
2. Si una organización pierde su clave privada, ¿qué pasa con los documentos que ya firmó?
3. ¿Cómo verificamos a posteriori que la firma `S` viene realmente del cert `C`? ¿Qué algoritmo se usa?
4. ¿Por qué la política de endorsement es `AND` y no `OR`? ¿Qué pasaría con `OR`?
5. Si el chaincode tiene un bug, ¿quién es responsable? ¿Cliente, Proveedor, o ambos?
6. ¿Qué pasa si los dos peers están en la misma máquina vs en máquinas separadas en distintos países?
7. ¿Por qué guardamos el cert público del firmante junto con la firma en el ledger?
8. ¿Cómo gestionarías la rotación de certificados sin invalidar las firmas pasadas?

---

## Criterios de evaluación

| Aspecto | Peso |
|---------|------|
| Diseño de red coherente y justificado | 15% |
| Fabric CA correctamente desplegada (no cryptogen) | 15% |
| Red Fabric levantada y canal operativo | 15% |
| Chaincode funcional con validaciones | 25% |
| Política de endorsement correcta | 5% |
| App cliente que firma y verifica | 15% |
| Documentación con diagramas Mermaid | 10% |

---

## Restricciones y entregables

- **Tiempo estimado**: 3 sesiones de 4 horas (12 horas totales).
- **Entrega**: una carpeta con:
  - `network/` — configs y certs (excepto claves privadas en producción)
  - `chaincode/` — código del chaincode
  - `application/` — app cliente
  - `scripts/` — scripts de despliegue
  - `INFORME.md` — informe con respuestas a las preguntas guía y diagramas
- **Trabajo**: en parejas o tríos.

---

## Referencias

Si te atascas, consulta:
- Documentos del Módulo 2 en este repo (01 a 06)
- [Hyperledger Fabric docs](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Gateway SDK](https://hyperledger.github.io/fabric-gateway/)

> **Nota:** la solución completa está en este mismo directorio (`solucion-01-*.md` a `solucion-05-*.md`). **No la mires hasta haberlo intentado tú primero.** Es mucho más educativo equivocarse y entender por qué.

---

## Bonus (opcional, sube nota)

Si terminas pronto, prueba estas extensiones:

- **B1**: añade un tercer rol `Auditor` (org externa con acceso de solo lectura) y verifica que NO puede firmar.
- **B2**: implementa Private Data Collections para que los términos económicos del documento solo los vean Cliente y Proveedor (no auditores).
- **B3**: añade `state-based endorsement` para que los documentos de alto valor (ej: > 100k €) requieran aprobación adicional de un endorser interno.
- **B4**: tests unitarios del chaincode con mocks (Sinon en Node.js, mockery en Go).
- **B5**: monitorización con Prometheus + Grafana del peer y el orderer.

---

¡Mucha suerte! Tu objetivo es entender **cómo se construye un sistema de confianza descentralizado paso a paso**, no solo seguir comandos. Equivócate, pregunta, experimenta.
