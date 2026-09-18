/* =====================================================================
   Luxe-Smile · Pre-render ligero para SEO
   ---------------------------------------------------------------------
   Hornea en index.html (contenido estático) los textos SEO-clave que hoy
   pinta Alpine en el cliente, para que TODO crawler (incluidos los que no
   ejecutan JS) los lea. Con JS, Alpine sobrescribe/limpia estos nodos y el
   usuario ve la versión dinámica de siempre.

   Rellena las regiones marcadas con <!--PR:clave--> ... <!--/PR:clave-->
   a partir de assets/data/content.json. No toca nada más del HTML.

   Uso:  node scripts/prerender.mjs
   Se ejecuta también en CI (GitHub Action) en cada cambio de content.json.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = join(ROOT, 'index.html');
const JSON_PATH = join(ROOT, 'assets/data/content.json');

const content = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
let html = readFileSync(HTML_PATH, 'utf8');

// Escapa texto para insertarlo con seguridad en HTML.
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Reemplaza el interior de una región <!--PR:key--> ... <!--/PR:key-->.
const missing = [];
const vacias = [];
const rellenadas = new Set();
/* Se mide el TEXTO VISIBLE, no la cadena: el H1 vacío sigue produciendo
   `<span class="block" data-prerendered></span>`, que no está vacío como
   cadena pero no dice nada a nadie. */
const sinTexto = (s) => !String(s).replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '');
function region(key, inner) {
  rellenadas.add(key);
  const re = new RegExp(`(<!--PR:${key}-->)[\\s\\S]*?(<!--/PR:${key}-->)`);
  if (!re.test(html)) {
    missing.push(key);
    return;
  }
  if (sinTexto(inner)) vacias.push(key);
  html = html.replace(re, `$1${inner}$2`);
}

/* ---- Textos de valor único (Alpine los sobrescribe en cliente) ---- */
region('eyebrow',      esc(content.hero?.eyebrow));
region('subtitle',     esc(content.hero?.subtitle));
region('ctaPrimary',   esc(content.hero?.ctaPrimary  || 'Agenda en Consultorio'));
region('supportLine',  esc(content.hero?.supportLine || 'Primera valoración sin costo · Cupos limitados'));
region('doctor',       esc(content.brand?.doctor));
region('aboutTitle',   esc(content.about?.title));
region('aboutSubtitle',esc(content.about?.subtitle));
region('aboutText',    esc(content.about?.text).replace(/\n/g, '<br>'));

/* ---- H1: título con saltos de línea (la línea índice 1 va en <em>, como en Alpine) ---- */
const titleLines = String(content.hero?.title || '').split('\n');
const h1 = titleLines
  .map((line, i) => {
    const inner = i === 1 ? `<em>${esc(line)}</em>` : esc(line);
    return `<span class="block" data-prerendered>${inner}</span>`;
  })
  .join('');
region('h1', h1);

/* ---- Servicios: tarjetas estáticas (data-prerendered → se limpian antes de Alpine) ---- */
const services = (content.services || [])
  .map(
    (s) =>
      `<div class="service-card" data-prerendered>` +
      `<h3 class="font-serif text-2xl mb-3">${esc(s.title)}</h3>` +
      `<p class="text-softblack/70 leading-relaxed text-sm">${esc(s.desc)}</p>` +
      (s.price ? `<p class="mt-3 text-xs font-semibold tracking-wide text-rosegoldDark uppercase">${esc(s.price)}</p>` : '') +
      `</div>`,
  )
  .join('');
region('services', services);

if (missing.length) {
  console.error('✗ Marcadores PR no encontrados en index.html:', missing.join(', '));
  process.exit(1);
}

/* Y LA DIRECCIÓN CONTRARIA, que no estaba cubierta.
   Lo de arriba pilla un `region('x')` sin marcador. Pero un `<!--PR:x-->` en el
   HTML sin su `region('x')` aquí no lo pillaba nadie: la región se queda con lo
   que hubiera dentro —normalmente nada— y el crawler, que es el único que la
   lee, encuentra un hueco. Se despliega en verde. */
const enElHtml = [...html.matchAll(/<!--PR:([^-]+)-->/g)].map((m) => m[1]);
const huerfanos = enElHtml.filter((k) => !rellenadas.has(k));
if (huerfanos.length) {
  console.error('✗ Hay marcadores PR en index.html que nadie rellena:', huerfanos.join(', '));
  console.error('  Añade su region(...) en este script, o quita el marcador del HTML.');
  process.exit(1);
}

/* QUE NO SE ESCRIBA UN HOME MUDO.

   Antes, si content.json perdía un campo —un guardado del admin a medias, una
   clave renombrada—, esto vaciaba la región, escribía el fichero y decía
   «✓ Pre-render aplicado». El home salía con el <h1> EN BLANCO, que es justo
   lo que lee Google y lo que ve quien no tiene JS, y el Action lo commiteaba.
   El éxito y el fallo tenían el mismo síntoma (17-sep-2026).

   Se falla ANTES de escribir: más vale un despliegue detenido y ruidoso que un
   titular vacío en produccion que nadie mira hasta dentro de un mes. */
if (vacias.length) {
  console.error('✗ Estas regiones quedarían vacías, así que no se escribe nada:', vacias.join(', '));
  console.error('  Revisa que content.json tenga esos campos.');
  process.exit(1);
}

writeFileSync(HTML_PATH, html);
console.log('✓ Pre-render aplicado a index.html (H1, hero, sobre, servicios).');
