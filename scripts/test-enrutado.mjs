#!/usr/bin/env node
/* ENRUTADO A WHATSAPP: comprobación de la JUNTA, no de las piezas.
 *
 * El 14-sep-2026 el enrutado a Zeus salió a producción sin cubrir el home: sus
 * 9 enlaces no casaban con ninguna clave del diccionario. Se hicieron dos
 * comprobaciones y las dos pasaron — Zeus verificó que su diccionario responde
 * a peticiones reales; yo verifiqué que el `tracking.js` nuevo se sirve en
 * producción. Ninguna de las dos mira lo único que importaba: si algún botón
 * del sitio llama de verdad a una clave que existe.
 *
 * El fallo no se ve desde ningún extremo, porque el síntoma de la junta rota es
 * un botón que funciona: el paciente llega a WhatsApp con el mensaje correcto y
 * sólo falta la atribución, en silencio. Lo que lo causó tampoco fue un error de
 * código: fue que el home usa `app.js` —su propia copia de `waLink`, la cuarta—
 * y compone los textos al renderizar, así que no aparecen en el HTML de donde
 * salió el diccionario.
 *
 * Por eso el bloque 3 no comprueba textos: comprueba que ninguna página con
 * enlaces a WhatsApp se quede sin mecanismo declarado. Es el fallo que hubo.
 *
 *   node scripts/test-enrutado.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const R = 'https://zeus.codi.com.co/6a7aa5453a2a5ee4405a7a6c/wa';
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FALLO'}  ${m}`); if (!c) fallos++; };

// ── stubs mínimos, comunes a los dos ficheros ──────────────────────────────
function documentoFalso(listeners) {
  return {
    addEventListener: (ev, fn) => listeners.push([ev, fn]),
    readyState: 'complete', referrer: '',
    querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, parentNode: { insertBefore() {} } }),
    getElementsByTagName: () => [{ parentNode: { insertBefore() {} }, appendChild() {} }],
    body: { setAttribute() {}, appendChild() {} }, head: { appendChild() {} },
  };
}

function cargarTracking(clic) {
  const store = new Map();
  if (clic) store.set('lx_clic', JSON.stringify({ id: clic.id, tipo: clic.tipo, t: Date.now() }));
  const listeners = [];
  const ctx = {
    console, URL, URLSearchParams, Date, JSON, Math, setTimeout, clearTimeout,
    location: { search: '', hostname: 'luxesmilee.com', href: 'https://luxesmilee.com/' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k),
    },
    document: documentoFalso(listeners),
    navigator: { userAgent: 'node' },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('assets/js/tracking.js', 'utf8'), ctx);
  return { ctx, listeners };
}

function cargarApp({ conRuta }) {
  let comp = null, init = null;
  const ctx = {
    console, structuredClone, URLSearchParams, Date, JSON, Math, Promise, setTimeout, clearTimeout,
    Alpine: { data: (_n, f) => { comp = f(); } },
    IntersectionObserver: class { observe() {} disconnect() {} },
    location: { search: '', hostname: 'luxesmilee.com' },
    document: { ...documentoFalso([]), addEventListener: (ev, fn) => { if (ev === 'alpine:init') init = fn; } },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.window.LuxeContent = { DEFAULT_CONTENT: { contact: {} }, loadContent: async () => ({}) };
  if (conRuta) ctx.window.lxRuta = (c) => (c ? `${R}?m=${c}` : null);
  vm.createContext(ctx);
  vm.runInContext(readFileSync('assets/js/app.js', 'utf8'), ctx);
  init();
  comp.content = { contact: { whatsapp: '573163903511',
    whatsappMessage: 'Hola Dra. Angela, me gustaría agendar una cita con usted en Luxe-Smile.' } };
  return comp;
}

// ── 1. la ruta se compone bien, y sabe NO componerse ───────────────────────
console.log('\n1. lxRuta');
{
  const { ctx } = cargarTracking(null);
  ok(typeof ctx.lxRuta === 'function', 'queda expuesta en window');
  ok(ctx.lxRuta('home_casos') === `${R}?m=home_casos`, 'clave sola -> ?m=home_casos');
  // El negativo importa tanto como el positivo: si devolviera algo para una
  // clave vacía, el llamante enrutaría a ciegas en vez de caer a wa.me.
  ok(ctx.lxRuta(null) === null && ctx.lxRuta(undefined) === null, 'sin clave -> null');

  const g = cargarTracking({ id: 'Cj0KCQ_ABC', tipo: 'g' }).ctx.lxRuta('home_virtual');
  ok(g.includes('m=home_virtual') && g.includes('g=Cj0KCQ_ABC') && g.includes('t=gclid'), 'con gclid -> clave + id + t=gclid');
  ok(cargarTracking({ id: 'x', tipo: 'w' }).ctx.lxRuta('home_info').includes('t=wbraid'), 'iOS -> t=wbraid, su propio campo');
}

// ── 2. el home enruta los seis, y degrada al wa.me de siempre ──────────────
console.log('\n2. waLink del home (app.js)');
{
  const ESPERADO = { hero: 'home_info', casos: 'home_casos', contacto: 'home_contacto',
    virtual: 'home_virtual', consultorio: 'home_consultorio', undefined: 'home_general' };
  const con = cargarApp({ conRuta: true });
  for (const [c, clave] of Object.entries(ESPERADO)) {
    const ctxArg = c === 'undefined' ? undefined : c;
    ok(con.waLink(ctxArg).includes(`m=${clave}`), `${c.padEnd(12)} -> m=${clave}`);
  }
  // Si tracking.js no cargó, el botón tiene que seguir funcionando SIN atribución.
  // Perder una atribución es barato; dejar a un paciente sin WhatsApp, no.
  const sin = cargarApp({ conRuta: false });
  ok(Object.keys(ESPERADO).every((c) => sin.waLink(c === 'undefined' ? undefined : c).startsWith('https://wa.me/')),
    'sin tracking.js: los seis caen a wa.me');
  ok(decodeURIComponent(sin.waLink('virtual').split('text=')[1])
    === 'Hola Dra. Angela, me gustaría agendar una cita de forma virtual con usted en Luxe-Smile.',
    'y con el texto de reserva intacto');
}

// ── 3. NINGUNA PÁGINA SE QUEDA SIN MECANISMO ───────────────────────────────
// Esto es lo que falló. No se rompió nada: apareció una página cuyo mecanismo
// nadie había mirado. El test no valida el mecanismo — valida que esté DICHO.
console.log('\n3. cobertura: toda página con enlaces a WhatsApp tiene mecanismo declarado');
{
  const MECANISMO = {
    'index.html': 'contexto (app.js -> lxRuta)',
    'diseno-de-sonrisa/index.html': 'texto literal -> web / web_virtual / web_consultorio',
    'pacientes-internacionales/index.html': 'texto literal -> internacional',
    'en/smile-design/index.html': 'texto literal -> smile_design_en',
    'blog/index.html': 'texto literal -> valoracion',
    'wa/index.html': 'puente propio: compone el wa.me él mismo, no pasa por el diccionario',
  };
  const ES_BLOG_GENERADO = (f) => f.startsWith('blog/') && f !== 'blog/index.html';

  const htmls = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.git' || e === 'admin') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) andar(p);
      else if (e.endsWith('.html')) htmls.push(p.replace(/^\.\//, ''));
    }
  })('.');

  const conWa = htmls.filter((f) => {
    const s = readFileSync(f, 'utf8');
    return /wa\.me\/\d/.test(s) || /waLink\(/.test(s);
  });

  for (const f of conWa) {
    if (ES_BLOG_GENERADO(f)) continue;   // los genera build-blog.mjs desde una plantilla única
    ok(MECANISMO[f], `${f}${MECANISMO[f] ? `  — ${MECANISMO[f]}` : '  — SIN MECANISMO DECLARADO: ¿enruta? decláralo aquí'}`);
  }
  for (const f of Object.keys(MECANISMO)) {
    ok(conWa.includes(f), `${f} sigue teniendo enlaces${conWa.includes(f) ? '' : ': la tabla cita una página que ya no los tiene'}`);
  }
  const generadas = conWa.filter(ES_BLOG_GENERADO).length;
  console.log(`  ..    ${generadas} páginas de blog generadas, cubiertas por la plantilla de build-blog.mjs`);
}

console.log(`\n${fallos ? `FALLOS: ${fallos}` : 'todo en verde'}\n`);
process.exit(fallos ? 1 : 0);
