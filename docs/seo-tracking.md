# SEO Tracking — luxesmilee.com

Registro de posicionamiento orgánico y verificación de mejoras. Objetivo:
que el blog y las páginas del sitio posicionen para keywords de intención local
(Bogotá / Chapinero), pasando de "no aparece" a top 10 → top 5.

## Cómo se mide (fuentes de verdad)

1. **Google Search Console (GSC)** — autoritativo. Reporte *Rendimiento* filtrado
   por consulta: posición media, impresiones, clics. Es la forma objetiva de
   comprobar el reposicionamiento con cada cambio.
2. **Snapshot manual de SERP** — búsqueda en Google.co (`&gl=co&hl=es`), orgánico,
   **excluyendo patrocinados**. Se registra abajo con fecha.
3. **Indexación** — `site:luxesmilee.com/blog/` + *Inspección de URL* en GSC.
4. **Datos estructurados** — Rich Results Test de Google por URL.

## Baseline — 2026-07-07 (Google.co, orgánico, sin patrocinados)

| Keyword | Posición | Nota |
|---|---|---|
| `luxe smile bogotá diseño de sonrisa` (marca) | **#1** | La home rankea por marca |
| `diseño de sonrisa bogotá` | **>10 (no pág. 1)** | Compiten odverorodriguez, Marlon Becerra, DentiSalud… |
| `carillas de porcelana bogotá` | **>10 (no pág. 1)** | Rankean páginas tipo artículo (dentalexperience, draamdie) |
| `diseño de sonrisa digital bogotá` | **>10 (no pág. 1)** | Domina pack local + competidores |

**Conclusión baseline:** el sitio solo rankea por marca; invisible para keywords
"money". Los competidores que rankean lo hacen con **páginas-artículo** dedicadas
→ valida la estrategia de blog indexable.

## Keywords objetivo (por página)

| URL | Keyword principal | Secundarias |
|---|---|---|
| `/blog/diseno-sonrisa-digital/` | diseño de sonrisa digital | digital smile design, odontología estética |
| `/blog/carillas-porcelana/` | carillas de porcelana | carillas dentales, durabilidad |
| `/blog/blanqueamiento-dental/` | blanqueamiento dental | dientes blancos |
| `/blog/precio-diseno-sonrisa-bogota/` | precio diseño de sonrisa bogotá | cuánto cuesta diseño de sonrisa |
| `/blog/carillas-resina-vs-porcelana/` | carillas resina vs porcelana | diferencia carillas |
| `/blog/implantes-dentales-bogota/` | implantes dentales bogotá | implante de titanio |

## Fases y gates de verificación

- **Fase 1 (hecha, commit 083a4bd):** páginas estáticas indexables por artículo,
  `<title>`/description únicos, canonical, H1, contenido en HTML sin JS, JSON-LD
  BlogPosting+BreadcrumbList, sitemap.xml con blog.
  - Gate: `curl /blog/<slug>/` → 200 con título+contenido sin JS ✅ (verificado en prod).
- **Fase 2 (en curso):** 3 artículos nuevos de alta intención (precio, resina vs
  porcelana, implantes), home muestra 3 + "Ver todos", enlazado interno.
  - Gate: nuevas URLs 200 con schema; en GSC, subida de impresiones para sus consultas.
- **Fase 3 (pendiente, requiere cuentas Google):** Google Business Profile + citas/backlinks.

## Acciones del dueño (una vez, en GSC)

1. Propiedad `luxesmilee.com` (verificable por el TXT del DNS).
2. Sitemaps → enviar `https://luxesmilee.com/sitemap.xml`.
3. Inspección de URL → *Solicitar indexación* de cada `/blog/<slug>/`.

## Bitácora de mediciones

| Fecha | Keyword | Posición orgánica | Fuente |
|---|---|---|---|
| 2026-07-07 | diseño de sonrisa bogotá | >10 | SERP manual |
| 2026-07-07 | carillas de porcelana bogotá | >10 | SERP manual |
| 2026-07-07 | diseño de sonrisa digital bogotá | >10 | SERP manual |
| _(añadir filas con cada revisión mensual / lecturas de GSC)_ | | | |
