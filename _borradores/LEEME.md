# Borradores — fuera del sitio, PERO el repositorio es público

Dos cosas distintas, y la segunda es la que importa:

| Canal | ¿Se ve? | Comprobado |
|---|---|---|
| El sitio, `luxesmilee.com/_borradores/…` | **No** | 2026-08-19, HTTP 404 |
| El repositorio, `raw.githubusercontent.com/…` | **SÍ, sin autenticar** | 2026-08-20, HTTP 200 |

El guion bajo hace que Jekyll excluya la carpeta del sitio generado. **No la
oculta de GitHub.** Este repositorio es público: cualquiera puede leer lo que hay
aquí, y una vez subido queda en el historial de git aunque después se borre.

## Consecuencia práctica

**No diligencies datos personales reales en estos archivos mientras el
repositorio siga siendo público.** La razón social, el NIT o la cédula de la
titular y el correo de habeas data **no deben commitearse aquí**.

Un borrador con marcas `[[ ]]` sin rellenar es inofensivo. El mismo archivo con
los datos puestos, no.

Si hace falta trabajar con los datos reales, hay tres salidas:

1. Poner el repositorio en privado.
2. Rellenar los campos directamente en `privacidad/index.html` justo antes de
   publicarlo, sin pasar por aquí. Esa página va a ser pública de todos modos, y
   lo que se publica en una política de tratamiento de datos es información que
   la ley obliga a divulgar.
3. Mantener la versión diligenciada fuera de git.

## Por qué tampoco vale `docs/`

`docs/` se sirve en el sitio. Comprobado el 2026-08-18:

    https://luxesmilee.com/docs/seo-tracking.md   ->  HTTP 200

Así que `docs/` es peor: público por los dos canales.

## Contenido

| Archivo | Estado |
|---|---|
| `politica-tratamiento-datos.md` | borrador, **10 marcas `[[ ]]` sin diligenciar**, pendiente de revisión de abogado |

## Qué falta para publicar la política

1. Diligenciar los campos abiertos — leyendo antes la advertencia de arriba.
2. Pasarla por un abogado con criterio en protección de datos. Son **datos
   sensibles de salud**, Ley 1581 de 2012.
3. Volcarla a `privacidad/index.html`, que hoy existe **sin rastrear en git** y
   sin publicar, con los campos resaltados con `<mark class="pendiente">`.
4. Al publicar: añadir `/privacidad/` al sitemap (lista fija en
   `scripts/build-blog.mjs`), enlazarla desde el pie de página y quitar los
   estilos y marcas `.pendiente`.
