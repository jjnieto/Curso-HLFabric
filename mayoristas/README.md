# DistribuTech — Red de distribución de tecnología sobre Hyperledger Fabric

Propuesta de red blockchain permisionada para la cadena de distribución de tecnología: **fabricantes**, **mayoristas**, **minoristas** y **cliente final**.

Este directorio tiene dos partes:

1. **Documentos de diseño y comunicación** (este nivel) — propuesta técnica, elevator pitch y aclaraciones para entender el proyecto.
2. **Solución ejecutable** ([`solucion/`](solucion/)) — la red Fabric real con 3 organizaciones, chaincodes en Go, apps cliente, API REST, frontend web visual y scripts de despliegue.

## Documentos

| Documento | Contenido |
|-----------|-----------|
| [Propuesta técnica](propuesta-tecnica.md) | Arquitectura de la red, diagramas, canales, chaincodes y modelo de datos |
| [Elevator pitch](elevator-pitch.md) | Propuesta comercial con ventajas competitivas para presentar a clientes |
| [Aclaraciones](aclaraciones.md) | Apps cliente por organización, clúster orderer, acceso del cliente final y política OR de garantías |

## Implementación

[`solucion/`](solucion/) contiene todo el código y los scripts para levantar la red de cero, desplegar los chaincodes, ejecutar las apps cliente y el frontend visual con datos de demo precargados.

- [Guía de instalación y operación](solucion/README.md) — pasos desde "qué instalar" hasta "abrir el navegador y ver el dashboard".
- [Apps cliente y frontend](solucion/application/README.md) — CLI por rol, API REST, frontend web, sanity-checks.
- [Documentación de la API](solucion/application/web/API.md) y [spec OpenAPI 3.0](solucion/application/web/openapi.yaml).
