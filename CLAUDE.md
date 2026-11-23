# Luxe Web — notas para las sesiones

Sitio estático de Luxe-Smile (https://luxesmilee.com). El detalle de arquitectura, panel
admin y dominio está en `README.md`.

## Despliegue

- Producción es **GitHub Pages en modo «legacy»** desde `main` (raíz). **Unir a `main`
  despliega solo**; no hay comando de despliegue.
- **No hay panel admin desde el 23-nov-2026** (retirado por seguridad: login en el navegador
  y token de GitHub en `localStorage`). El contenido (`assets/data/content.json`) se cambia
  con commits. `scripts/test-paginas.mjs` §5 se pone rojo si vuelve un login en el navegador o
  una escritura a la API de GitHub desde el JS servido.
- El flujo `Build` (`.github/workflows/prerender.yml`) puede añadir un commit del bot detrás
  del tuyo; Pages publica el último.
- No hay base de datos: todo el contenido vive en el repo.

## Versiones y rollback

- **Etiquetas.** Tras cada publicación, `.github/workflows/versiones.yml` corre `bin/sonda`
  (espera a que Pages construya la cabeza de `main` y pide `/`, `/Dra.Angela_Barbosa/` y
  `content.json`). En verde, `bin/etiquetar` crea la etiqueta anotada `vAAAA.MM.DD-N` (fecha
  de Bogotá) y su Release de GitHub. Si el etiquetado falla, solo avisa. Los commits
  `rollback: …` no se etiquetan.
- **Artefactos.** Cada versión es su etiqueta de git (Pages no guarda despliegues viejos);
  no hay imágenes Docker ni copias de base.
- **Ver qué haría:** `bin/rollback --seco` (o `bin/rollback --seco v2026.11.22-1`): dice
  qué sirve producción, a qué versión volvería, qué ficheros cambian y comprueba que la
  etiqueta existe en origin. No toca nada.
- **Volver atrás:** `bin/rollback` (a la versión anterior a la desplegada) o
  `bin/rollback vAAAA.MM.DD-N`. Hace un commit nuevo `rollback: vuelta a …` cuyo sitio es
  idéntico al de esa versión y lo sube a `main` **sin forzar** (es el mismo camino que un
  despliegue normal); `.github/`, `bin/` y este fichero se quedan como en `main`. Luego
  espera a Pages, pasa la sonda y avisa a Ultron (carta por la bandeja; si falla,
  `wt_push.py` en el Air).
- **Automático.** Si Pages publicó y la sonda falla (y vuelve a fallar 2 minutos después),
  el workflow llama a `bin/rollback --auto` una sola vez y termina en rojo. No actúa si
  `main` cambió desde el commit que falló, si ese commit sirve un sitio que ya pasó la sonda
  (el fallo no es del contenido) ni si ya es un rollback. La sonda espera a que termine
  `Build` antes de juzgar la cabeza de `main`. Si Pages no llegó a publicar (`errored` o tiempo agotado), sigue servida la
  versión anterior y solo se marca en rojo.
- **Qué NO hace.** No restaura nada fuera del repo (DNS en Netlify, ajustes de Pages). El
  contenido cambiado después de esa versión desaparece del sitio con el rollback (sigue en
  el historial de git).
- Nunca se prueba con un rollback real: solo `bin/rollback --seco`.
