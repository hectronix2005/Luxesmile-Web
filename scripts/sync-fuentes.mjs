/**
 * sync-fuentes.mjs — content.json manda sobre todo lo que está duplicado.
 *
 * El sitio tiene datos escritos en dos sitios que nadie ataba, y eso ya costó
 * dos fallos reales (17-sep-2026):
 *
 *   · Color: styles.css guardaba la paleta rosa por defecto y content.json la
 *     azul-gris elegida. El blog y /privacidad/ no ejecutan applyTheme(), así
 *     que llevaban SIEMPRE los colores de otra paleta.
 *   · Contacto: DEFAULT_CONTENT de content.js —el fallback de loadContent()
 *     cuando falla el fetch y no hay caché, o sea una primera visita con un
 *     tropiezo de red— tenía datos de plantilla. El botón de WhatsApp llevaba
 *     a 573001234567, que no es el número de la doctora.
 *
 *   node scripts/sync-fuentes.mjs             escribe
 *   node scripts/sync-fuentes.mjs --check     no escribe; sale 1 si hay diferencia
 *   node scripts/sync-fuentes.mjs --autotest  demuestra que sabe ponerse ROJO
 *
 * Lo de --autotest no es adorno. Auditando el sitio ese mismo día, CINCO
 * comprobadores dieron rojo por su propio fallo y no por el del sitio. Un
 * comprobador que no demuestra que sabe ponerse rojo no vale como verde.
 *
 * Y el autotest tiene que ejecutar la lógica REAL sobre el texto roto. El
 * primer intento comparaba el texto mutado consigo mismo: pasaba siempre.
 * Por eso toda la sincronización vive en sincronizar(), que recibe de dónde
 * leer — así el test le puede dar ficheros rotos sin tocar el disco.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leerDisco = (p) => readFileSync(join(ROOT, p), 'utf8');

const PAGINAS_CON_RED = ['index.html', 'diseno-de-sonrisa/index.html',
  'pacientes-internacionales/index.html', 'en/smile-design/index.html'];
const RED_RE = /  <!-- RED DE SEGURIDAD DEL FADE-IN[\s\S]*?<\/script>/;

const VARS = { ivory: 'ivory', porcelain: 'porcelain', rosegold: 'rosegold',
  rosegoldDark: 'rosegold-dark', gold: 'gold', charcoal: 'charcoal', softblack: 'softblack' };

/**
 * Calcula el contenido que DEBERÍA tener cada fichero.
 * @param {(ruta:string)=>string} leer  de dónde salen los ficheros
 * @returns {{cambios:string[], fallos:string[], salida:Map<string,string>}}
 */
function sincronizar(leer) {
  const cambios = [], fallos = [], salida = new Map();
  const datos = JSON.parse(leer('assets/data/content.json'));
  const colores = datos?.theme?.colors, contacto = datos?.contact;
  if (!colores || !contacto) { fallos.push('content.json no tiene theme.colors o contact'); return { cambios, fallos, salida }; }

  const editar = (ruta, fn) => {
    const antes = salida.get(ruta) ?? leer(ruta);
    salida.set(ruta, fn(antes));
  };

  /* 1) Paleta -> styles.css */
  editar('assets/css/styles.css', (css) => {
    for (const [clave, nombre] of Object.entries(VARS)) {
      const hex = colores[clave];
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) {
        fallos.push(`theme.colors.${clave} no es un hex de 6 dígitos: ${JSON.stringify(hex)}`); continue;
      }
      const h = hex.toLowerCase();
      const rgb = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
      // Una variable a la vez: sobreviven formato, comentarios y --gold-soft,
      // que no existe en content.json.
      for (const [re, valor, etiqueta] of [
        [new RegExp(`(--${nombre}:\\s*)#[0-9A-Fa-f]{6}`), h, `--${nombre}`],
        [new RegExp(`(--${nombre}-rgb:\\s*)\\d+ \\d+ \\d+`), rgb, `--${nombre}-rgb`],
      ]) {
        if (!re.test(css)) { fallos.push(`no encuentro ${etiqueta} en styles.css`); continue; }
        const nuevo = css.replace(re, `$1${valor}`);
        if (nuevo !== css) cambios.push(`assets/css/styles.css  ${etiqueta} -> ${valor}`);
        css = nuevo;
      }
    }
    return css;
  });

  /* 2) contact entero -> DEFAULT_CONTENT de content.js */
  const dig = String(contacto.whatsapp || '').replace(/\D/g, '');
  if (!/^57\d{10}$/.test(dig)) fallos.push(`contact.whatsapp no son 57 + 10 dígitos: ${JSON.stringify(contacto.whatsapp)}`);

  editar('assets/js/content.js', (js) => {
    const re = /(\n  contact: \{\n)([\s\S]*?)(\n  \},)/;
    if (!re.test(js)) { fallos.push('no encuentro el bloque contact de DEFAULT_CONTENT'); return js; }
    const cuerpo = Object.entries(contacto).map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n');
    const nota = '    // GENERADO por scripts/sync-fuentes.mjs desde content.json. No editar a mano:\n'
               + '    // es el fallback que ve quien entra si el fetch de content.json falla.\n';
    const nuevo = js.replace(re, `$1${nota}${cuerpo}$3`);
    if (nuevo !== js) cambios.push(`assets/js/content.js  DEFAULT_CONTENT.contact (${Object.keys(contacto).length} campos)`);
    return nuevo;
  });

  /* 3) El número escrito a mano */
  const visible = (contacto.phone || '').replace(/^\+?57\s*/, '').replace(/(\d{3})(\d{3})(\d{4})/, '+57 $1 $2 $3');
  const PATRONES = [
    ['index.html',                           /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['diseno-de-sonrisa/index.html',         /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['en/smile-design/index.html',           /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['pacientes-internacionales/index.html', /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['privacidad/index.html',                /(wa\.me\/)57\d{10}/g,               `$1${dig}`,    'wa.me'],
    ['privacidad/index.html',                /(>)\+57 3\d{2} \d{3} \d{4}(<)/g,    `$1${visible}$2`, 'teléfono visible'],
    ['wa/index.html',                        /(wa\.me\/)57\d{10}/g,               `$1${dig}`,    'wa.me'],
    ['wa/index.html',                        /(var NUMERO = ')57\d{10}(')/g,      `$1${dig}$2`,  'NUMERO'],
  ];
  /* 4) Red de seguridad del fade-in -> las cuatro páginas con secciones ocultas.
     Tiene que ir inline en cada una (ver scripts/fragmentos/red-fade.html), así que
     son cuatro copias por diseño. Lo que no puede ser es que diverjan: la fuente es
     el fragmento y esto las reescribe. scripts/test-paginas.mjs lo comprueba además
     desde fuera, por si alguien edita las páginas sin pasar por el build. */
  {
    const fragmento = leer('scripts/fragmentos/red-fade.html').replace(/\n$/, '');
    for (const ruta of PAGINAS_CON_RED) {
      editar(ruta, (s) => {
        if (!RED_RE.test(s)) { fallos.push(`no encuentro la red del fade en ${ruta}`); return s; }
        const nuevo = s.replace(RED_RE, fragmento);
        if (nuevo !== s) cambios.push(`${ruta}  red del fade-in`);
        return nuevo;
      });
    }
  }

  for (const [ruta, re, rep, etiqueta] of PATRONES) {
    editar(ruta, (s) => {
      re.lastIndex = 0;
      if (!re.test(s)) { fallos.push(`no encuentro ${etiqueta} en ${ruta}`); return s; }
      re.lastIndex = 0;
      const nuevo = s.replace(re, rep);
      if (nuevo !== s) cambios.push(`${ruta}  ${etiqueta} -> ${dig}`);
      return nuevo;
    });
  }
  return { cambios, fallos, salida };
}

/* ---------------------- control positivo ---------------------- */
/* Rompe una fuente EN MEMORIA y exige que sincronizar() lo vea. No toca disco.
   Ejecuta la lógica real: si una regex deja de casar, este test se entera. */
function autotest() {
  const casos = [
    ['paleta en styles.css',   'assets/css/styles.css', (s) => s.replace(/(--gold:\s*)#[0-9a-f]{6}/, '$1#112233')],
    ['contacto en content.js', 'assets/js/content.js',  (s) => s.replace(/(phone: ")[^"]+(")/, '$1+57 3009999999$2')],
    ['número en /wa/',         'wa/index.html',         (s) => s.replace(/(wa\.me\/)57\d{10}/, '$1573009999999')],
    ['telephone del JSON-LD',  'index.html',            (s) => s.replace(/("telephone":\s*")\+?57\d{10}(")/, '$1+573009999999$2')],
    ['red del fade en la landing EN', 'en/smile-design/index.html', (s) => s.replace('setTimeout(parar, 30000)', 'setTimeout(parar, 99999)')],
  ];
  // Antes de nada: en limpio NO puede haber cambios. Si los hay, el resto no prueba nada.
  const limpio = sincronizar(leerDisco);
  if (limpio.cambios.length || limpio.fallos.length) {
    console.error('✗ el disco ya está desincronizado: el control positivo no sería concluyente');
    limpio.cambios.concat(limpio.fallos).forEach((c) => console.error('   ', c));
    return 1;
  }
  let mal = 0;
  for (const [nombre, ruta, romper] of casos) {
    const roto = romper(leerDisco(ruta));
    if (roto === leerDisco(ruta)) { console.error(`  ✗ ${nombre}: la mutación no cambió nada, el caso no prueba nada`); mal++; continue; }
    const { cambios } = sincronizar((p) => (p === ruta ? roto : leerDisco(p)));
    const visto = cambios.some((c) => c.startsWith(ruta));
    if (visto) console.log(`  ✓ ${nombre}: se pone rojo`);
    else { console.error(`  ✗ ${nombre}: NO lo detecta`); mal++; }
  }
  if (mal) { console.error(`\n✗ ${mal} caso(s) que el comprobador no ve`); return 1; }
  console.log(`\n✓ control positivo: los ${casos.length} casos se detectan`);
  return 0;
}

/* ---------------------------- main ---------------------------- */
if (process.argv.includes('--autotest')) process.exit(autotest());

const { cambios, fallos, salida } = sincronizar(leerDisco);
if (fallos.length) { fallos.forEach((f) => console.error('✗', f)); process.exit(1); }

if (process.argv.includes('--check')) {
  if (cambios.length) {
    console.error('✗ hay fuentes desincronizadas con content.json:');
    cambios.forEach((c) => console.error('   ', c));
    process.exit(1);
  }
  console.log('✓ todo coincide con content.json');
} else {
  for (const [ruta, contenido] of salida) {
    if (contenido !== leerDisco(ruta)) writeFileSync(join(ROOT, ruta), contenido);
  }
  cambios.forEach((c) => console.log('  ', c));
  console.log(`✓ Fuentes sincronizadas: ${cambios.length} cambio(s)`);
}
