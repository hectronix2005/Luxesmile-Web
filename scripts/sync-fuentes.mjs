/**
 * sync-fuentes.mjs — content.json manda sobre todo lo que está duplicado.
 *
 * El sitio tiene datos escritos en dos sitios que nadie ataba, y eso ya ha
 * costado dos fallos reales (17-sep-2026):
 *
 *   · Color: styles.css guardaba la paleta rosa por defecto y content.json la
 *     azul-gris elegida. El blog y /privacidad/ no ejecutan applyTheme(), así
 *     que llevaban SIEMPRE los colores de otra paleta.
 *   · Contacto: DEFAULT_CONTENT de content.js —el fallback de loadContent()
 *     cuando falla el fetch y no hay caché, o sea una primera visita con un
 *     tropiezo de red— tenía datos de plantilla. El botón de WhatsApp llevaba
 *     a 573001234567, que no es el número de la doctora.
 *
 * content.json manda porque es lo que edita el admin.
 *
 *   node scripts/sync-fuentes.mjs           escribe
 *   node scripts/sync-fuentes.mjs --check   no escribe; sale 1 si hay diferencia
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');

const datos = JSON.parse(leer('assets/data/content.json'));
const colores = datos?.theme?.colors;
const contacto = datos?.contact;
if (!colores || !contacto) { console.error('✗ content.json no tiene theme.colors o contact'); process.exit(1); }

const cambios = [];
const fallos = [];
const pendientes = new Map();   // ruta -> contenido nuevo

function editar(ruta, fn) {
  const antes = pendientes.get(ruta) ?? leer(ruta);
  const despues = fn(antes);
  if (despues !== antes) pendientes.set(ruta, despues);
  else if (!pendientes.has(ruta)) pendientes.set(ruta, antes);
}

/* ---------- 1) Paleta -> styles.css ---------- */
const VARS = { ivory: 'ivory', porcelain: 'porcelain', rosegold: 'rosegold',
  rosegoldDark: 'rosegold-dark', gold: 'gold', charcoal: 'charcoal', softblack: 'softblack' };

editar('assets/css/styles.css', (css) => {
  for (const [clave, nombre] of Object.entries(VARS)) {
    const hex = colores[clave];
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) {
      fallos.push(`theme.colors.${clave} no es un hex de 6 dígitos: ${JSON.stringify(hex)}`);
      continue;
    }
    const h = hex.toLowerCase();
    const rgb = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
    // Una variable a la vez: así sobreviven formato, comentarios y --gold-soft,
    // que no existe en content.json.
    for (const [re, valor, etiqueta] of [
      [new RegExp(`(--${nombre}:\\s*)#[0-9A-Fa-f]{6}`), h, `--${nombre}`],
      [new RegExp(`(--${nombre}-rgb:\\s*)\\d+ \\d+ \\d+`), rgb, `--${nombre}-rgb`],
    ]) {
      if (!re.test(css)) { fallos.push(`no encuentro ${etiqueta} en styles.css`); continue; }
      const nuevo = css.replace(re, `$1${valor}`);
      if (nuevo !== css) cambios.push(`styles.css  ${etiqueta} -> ${valor}`);
      css = nuevo;
    }
  }
  return css;
});

/* ---------- 2) Contacto -> DEFAULT_CONTENT de content.js ---------- */
const dig = String(contacto.whatsapp || '').replace(/\D/g, '');
if (!/^57\d{10}$/.test(dig)) { fallos.push(`contact.whatsapp no son 57 + 10 dígitos: ${JSON.stringify(contacto.whatsapp)}`); }

editar('assets/js/content.js', (js) => {
  const re = /(\n  contact: \{\n)([\s\S]*?)(\n  \},)/;
  const m = js.match(re);
  if (!m) { fallos.push('no encuentro el bloque contact de DEFAULT_CONTENT'); return js; }
  const cuerpo = Object.entries(contacto)
    .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n');
  const nota = '    // GENERADO por scripts/sync-fuentes.mjs desde content.json. No editar a mano:\n'
             + '    // es el fallback que ve quien entra si el fetch de content.json falla.\n';
  const nuevo = js.replace(re, `$1${nota}${cuerpo}$3`);
  if (nuevo !== js) cambios.push(`content.js  DEFAULT_CONTENT.contact (${Object.keys(contacto).length} campos)`);
  return nuevo;
});

/* ---------- 3) El número escrito a mano ---------- */
const tel = contacto.phone;
const PATRONES = [
  ['index.html',                          /("telephone":\s*")\+?57\d{10}(")/g,        `$1+${dig}$2`, 'JSON-LD telephone'],
  ['diseno-de-sonrisa/index.html',        /("telephone":\s*")\+?57\d{10}(")/g,        `$1+${dig}$2`, 'JSON-LD telephone'],
  ['en/smile-design/index.html',          /("telephone":\s*")\+?57\d{10}(")/g,        `$1+${dig}$2`, 'JSON-LD telephone'],
  ['pacientes-internacionales/index.html',/("telephone":\s*")\+?57\d{10}(")/g,        `$1+${dig}$2`, 'JSON-LD telephone'],
  ['privacidad/index.html',               /(wa\.me\/)57\d{10}/g,                      `$1${dig}`,    'wa.me'],
  ['privacidad/index.html',               /(>)\+57 3\d{2} \d{3} \d{4}(<)/g,           `$1${tel.replace(/^\+?57\s*/, '+57 ').replace(/(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')}$2`, 'teléfono visible'],
  ['wa/index.html',                       /(wa\.me\/)57\d{10}/g,                      `$1${dig}`,    'wa.me'],
  ['wa/index.html',                       /(var NUMERO = ')57\d{10}(')/g,             `$1${dig}$2`,  'NUMERO'],
];
for (const [ruta, re, rep, etiqueta] of PATRONES) {
  editar(ruta, (s) => {
    if (!re.test(s)) { fallos.push(`no encuentro ${etiqueta} en ${ruta}`); return s; }
    re.lastIndex = 0;
    const nuevo = s.replace(re, rep);
    if (nuevo !== s) cambios.push(`${ruta}  ${etiqueta} -> ${dig}`);
    return nuevo;
  });
}

/* ---------- salida ---------- */
if (fallos.length) { fallos.forEach((f) => console.error('✗', f)); process.exit(1); }

if (CHECK) {
  if (cambios.length) {
    console.error('✗ hay fuentes desincronizadas con content.json:');
    cambios.forEach((c) => console.error('   ', c));
    process.exit(1);
  }
  console.log('✓ todo coincide con content.json');
} else {
  for (const [ruta, contenido] of pendientes) {
    if (contenido !== leer(ruta)) writeFileSync(join(ROOT, ruta), contenido);
  }
  cambios.forEach((c) => console.log('  ', c));
  console.log(`✓ Fuentes sincronizadas: ${cambios.length} cambio(s)`);
}
