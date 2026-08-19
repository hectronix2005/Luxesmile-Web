# Borradores — no se publican

Esta carpeta empieza por guion bajo **a propósito**: Jekyll excluye del sitio
generado cualquier directorio que empiece por `_`, así que nada de aquí llega a
`luxesmilee.com`. Git sí lo versiona.

No la renombres sin quitar antes lo que no deba ser público.

## Por qué no vale `docs/`

`docs/` se sirve. Comprobado el 2026-08-18:

    https://luxesmilee.com/docs/seo-tracking.md   ->  HTTP 200

Un borrador con datos de la titular sin diligenciar no debe quedar accesible.

## Contenido

| Archivo | Estado |
|---|---|
| `politica-tratamiento-datos.md` | borrador, **10 marcas `[[ ]]` sin diligenciar**, pendiente de revisión de abogado |

## La política, en concreto

Bloquea la creación de las acciones de conversión «Valoración agendada» y
«Tratamiento aceptado» en Google Ads, que a su vez bloquean que el CRM empiece a
registrar pacientes atribuidos.

Antes de publicarla hay que:

1. Diligenciar los campos abiertos (razón social, NIT/CC, correo de habeas data,
   cargo designado, fecha de entrada en vigor).
2. Pasarla por un abogado con criterio en protección de datos — son **datos
   sensibles de salud**, Ley 1581 de 2012.
3. Volcarla a `privacidad/index.html`, que hoy existe **sin rastrear en git** y
   sin publicar, con los campos resaltados con `<mark class="pendiente">`.
4. Al publicar: añadir `/privacidad/` al sitemap (lista fija en
   `scripts/build-blog.mjs`), enlazarla desde el pie de página y quitar los
   estilos y marcas `.pendiente`.
