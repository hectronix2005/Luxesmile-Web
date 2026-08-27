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
| `politica-tratamiento-datos.md` | borrador en markdown, **superado** — el trabajo vivo está en la rama, ver abajo |

## El trabajo vivo está en una rama, no aquí (24-ago-2026)

    git checkout wip/politica-privacidad     # commit 9c9e160

Ahí está `privacidad/index.html` con **5 de 6 campos diligenciados**. Falta solo la
fecha de entrada en vigencia, que se pone el día de publicar.

**NO FUSIONAR A MAIN.** Fusionar publica la página, y el texto afirma que existe un
contrato de transmisión de datos con ZEUS **que no existe**.

## Qué falta antes de fusionar

1. **Ubicación real del servidor de base de datos de ZEUS.** Verificado que la
   aplicación está en Ashburn (Virginia) y los adjuntos en Nueva York; la base,
   donde vive el contenido de las conversaciones, sigue sin verificar.
2. **Si el número de la clínica usa la ruta de ZEUS o la de Meta.** Lo decide cómo
   se enlace el WhatsApp el 26 de agosto.
3. **El contrato de transmisión**, escalado por ZEUS sin dueño ni plazo.
4. **Revisión de un abogado** con criterio en protección de datos. Son datos
   sensibles de salud, Ley 1581 de 2012.

## Al publicar, además

Añadir `/privacidad/` al sitemap (lista fija en `scripts/build-blog.mjs`),
enlazarla desde el pie de página, y quitar los estilos y marcas `.pendiente`.
