#!/usr/bin/env node
/* PUBLICAR DESDE EL ADMIN: comprobación de las dos guardas que impiden perder
 * trabajo. No compara texto del fichero — monta el componente de Alpine de
 * verdad, le pone delante un doble de la API de GitHub y mira lo único que
 * importa: si se llegó a ESCRIBIR en el repo.
 *
 * Los dos fallos que cubre, ambos del 17-sep-2026 y ambos silenciosos:
 *
 * 1. Si al abrir el panel la lectura por API fallaba, se caía a la copia del
 *    sitio público —que va por detrás— y se guardaba `loadedSha = null`. Y la
 *    detección de conflictos de publishContent empieza por `if (expectedSha …)`,
 *    o sea que con null NO SE COMPROBABA NADA: el PUT borraba en silencio todo
 *    lo cambiado desde esa copia. En pantalla no aparecía ni un aviso.
 *
 * 2. build-blog.mjs aborta si un artículo no trae título, contenido, imagen o
 *    fecha. Aborta el paso, y con él los siguientes: no se hace commit de nada.
 *    Un artículo a medio escribir no rompía el blog, rompía el build entero, y
 *    el error salía en un log de CI, no donde se podía arreglar.
 *
 * Cómo se comprueba que este test sirve para algo: rompe una guarda a mano
 * (quita la línea del `loadedSha`, o cambia el forEach por slice(0,1)) y
 * vuelve a correrlo. Si sigue en verde, el que está roto es el test.
 * Los casos malos van a propósito también en SEGUNDA posición: con todos en
 * la primera, una validación que sólo mirase un artículo aprobaba igual.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// El argumento existe para poder apuntarlo a una copia mutada del admin y
// verificar que este test se pone rojo. Sin argumento, mira el fichero real.
const RUTA = process.argv[2] || fileURLToPath(new URL('../assets/js/admin.js', import.meta.url));

let ctxConfirm = () => true;   // lo cambia cada caso

function cargarComponente(codigo) {
  let fabrica = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, structuredClone, JSON, Promise, Date, Math, Object, Array, String, Number, Error,
    document: { addEventListener: (_e, fn) => fn() },
    Alpine: { data: (_n, f) => { fabrica = f; } },
    window: {}, sessionStorage: { getItem: () => null, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    FileReader: function () {}, Image: function () {},
    confirm: () => ctxConfirm(),
  };
  ctx.window.LuxeContent = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  if (!fabrica) throw new Error('no se capturó el componente Alpine');
  return { fabrica, ctx };
}

// Monta un panel en el estado "cargado sin sha" y devuelve si publicó.
async function correr({ codigo, repoIgualAlBaseline, apiRota, blog, conSha }) {
  const { fabrica, ctx } = cargarComponente(codigo);

  const BASE = { brand: { doctor: 'Dra. Angela Barbosa' }, contact: { whatsapp: '+57 3163903511' } };
  const EN_REPO = repoIgualAlBaseline ? BASE : { ...BASE, brand: { doctor: 'OTRA PERSONA' } };

  let escrituras = 0;
  ctx.window.LuxeContent = {
    DEFAULT_CONTENT: { brand: {}, contact: {} },
    deepMerge: (b, o) => ({ ...b, ...o }),
    fetchContentViaAPI: async () => {
      if (apiRota) throw new Error('HTTP 502');
      return { data: EN_REPO, sha: 'sha-del-repo' };
    },
    setGithubConfig() {},
    publishContent: async () => { escrituras++; return { newSha: 'nuevo', publishedAt: 1 }; },
    applyTheme() {}, waitForPublished: async () => ({ ok: true }),
    hasAdminPassword: () => true,
  };

  const app = fabrica();

  // Estado exacto tras una lectura degradada: contenido del CDN, sin sha.
  app.gh = { owner: 'o', repo: 'r', token: 't', branch: 'main', path: 'p' };
  app.content = structuredClone(BASE);
  if (blog) app.content.blog = { articles: blog };
  app.snapshot = JSON.stringify(ctx.window.LuxeContent.deepMerge({ brand: {}, contact: {} }, app.content));
  app.loadedSha = conSha ? 'sha-cargado' : null;
  app.lecturaDegradada = true;
  app.content.brand.doctor = 'Dra. Angela Barbosa Pérez';   // la doctora edita algo
  app.verifyPublishedOnSite = async () => {};
  app.flash = () => {};

  await app.publish();
  return escrituras > 0;
}

// ── Borrar sin querer ───────────────────────────────────────────────────────
// La ✕ de cada lista llamaba a remove() directo: un clic se llevaba un artículo
// entero, sin confirmar y sin deshacer.
async function borrar({ codigo, respuesta }) {
  const { fabrica, ctx } = cargarComponente(codigo);
  ctx.window.LuxeContent = { DEFAULT_CONTENT: {}, hasAdminPassword: () => true, deepMerge: (b, o) => ({ ...b, ...o }) };
  const app = fabrica();
  let pregunta = '';
  ctxConfirm = () => { pregunta = 'preguntó'; return respuesta; };
  const lista = [{ title: 'Carillas de Porcelana' }, { title: 'Otro' }];
  app.remove(lista, 0, 'este artículo');
  return { quedan: lista.length, pregunta };
}

// ── Cerrar la pestaña con cambios sin publicar ──────────────────────────────
async function alCerrar({ codigo, sucio }) {
  const { fabrica, ctx } = cargarComponente(codigo);
  const oyentes = [];
  ctx.window.addEventListener = (ev, fn) => oyentes.push([ev, fn]);
  ctx.window.LuxeContent = {
    DEFAULT_CONTENT: {}, hasAdminPassword: () => true, deepMerge: (b, o) => ({ ...b, ...o }),
    getGithubConfig: async () => ({ owner: '', repo: '', token: '' }),
    loadContent: async () => ({ brand: {} }),
    applyTheme() {}, fetchContentViaAPI: async () => { throw new Error('sin token'); },
  };
  const app = fabrica();
  await app.init();
  const oyente = oyentes.find(([ev]) => ev === 'beforeunload');
  if (!oyente) return { registrado: false, avisa: false };
  if (sucio) app.content = { brand: { doctor: 'cambiado' } };
  let avisado = false;
  oyente[1]({ preventDefault: () => { avisado = true; }, set returnValue(v) { avisado = true; } });
  return { registrado: true, avisa: avisado };
}

const codigo = fs.readFileSync(RUTA, 'utf8');
// ── Sellar la fecha de edición ──────────────────────────────────────────────
// `date` es cuándo se PUBLICÓ. Si al reescribir un artículo nadie mueve
// `updated`, el sitemap y el `dateModified` siguen anunciando la fecha de
// estreno y Google no tiene motivo para volver a rastrear la página. Pasó con
// los 9 artículos del 17-sep-2026, que declaraban mayo-julio recién reescritos.
// Aquí se ejecuta el sellado de verdad sobre un artículo editado y otro intacto.
async function sellar({ codigo, cambio }) {
  const { fabrica, ctx } = cargarComponente(codigo);
  ctx.window.LuxeContent = { DEFAULT_CONTENT: {}, hasAdminPassword: () => true, deepMerge: (b, o) => ({ ...b, ...o }) };
  const app = fabrica();
  const previos = [
    { slug: 'tocado',  title: 'T', excerpt: 'e', content: '<p>a</p>', image: 'x.webp', date: '2026-05-01', updated: '2026-05-01' },
    { slug: 'intacto', title: 'U', excerpt: 'f', content: '<p>b</p>', image: 'y.webp', date: '2026-05-02', updated: '2026-05-02' },
  ];
  app.content = { blog: { articles: structuredClone(previos) } };
  app.snapshot = JSON.stringify({ blog: { articles: previos } });
  Object.assign(app.content.blog.articles[0], cambio);
  app.sellarArticulosEditados();
  const hoy = new Date().toISOString().slice(0, 10);
  const [t, i] = app.content.blog.articles;
  return { tocado: t.updated === hoy ? 'hoy' : t.updated, intacto: i.updated };
}

// Y por el camino de verdad: que `publish()` LLAME al sellado. Comprobar la
// función suelta no vale — la primera versión de este test la llamaba a mano y
// quitar la llamada de publish() seguía dando verde. El detector medía la pieza,
// no el circuito.
async function sellarAlPublicar({ codigo }) {
  const { fabrica, ctx } = cargarComponente(codigo);
  let enviado = null;
  ctx.window.LuxeContent = {
    DEFAULT_CONTENT: {}, deepMerge: (b, o) => ({ ...b, ...o }), hasAdminPassword: () => true,
    fetchContentViaAPI: async () => ({ data: {}, sha: 's' }),
    setGithubConfig() {}, applyTheme() {}, waitForPublished: async () => ({ ok: true }),
    publishContent: async (c) => { enviado = structuredClone(c); return { newSha: 'n', publishedAt: 1 }; },
  };
  const app = fabrica();
  const previos = [
    { id: 1, slug: 'tocado',  title: 'T', excerpt: 'e', content: '<p>a</p>', image: 'x.webp', date: '2026-05-01', updated: '2026-05-01' },
    { id: 2, slug: 'intacto', title: 'U', excerpt: 'f', content: '<p>b</p>', image: 'y.webp', date: '2026-05-02', updated: '2026-05-02' },
  ];
  app.gh = { owner: 'o', repo: 'r', token: 't', branch: 'main', path: 'p' };
  app.content = { blog: { articles: structuredClone(previos) } };
  app.snapshot = JSON.stringify({ blog: { articles: previos } });
  app.loadedSha = 'sha-cargado';
  app.content.blog.articles[0].content = '<p>reescrito entero</p>';
  app.verifyPublishedOnSite = async () => {};
  app.flash = () => {};
  await app.publish();
  if (!enviado) return { publico: false };
  const hoy = new Date().toISOString().slice(0, 10);
  const [t, i] = enviado.blog.articles;
  return { publico: true, tocado: t.updated === hoy ? 'hoy' : t.updated, intacto: i.updated };
}

const ok = (extra) => ({ id: 1, title: 'T', slug: 'uno', image: 'x.webp', date: '2026-09-17', content: '<p>a</p>', ...extra });

const casos = [
  // --- la guarda del sha ---
  ['sha: repo intacto → publica',                { repoIgualAlBaseline: true,  apiRota: false }, true],
  ['sha: repo cambiado por otro → NO publica',   { repoIgualAlBaseline: false, apiRota: false }, false],
  ['sha: relectura rota → NO publica',           { repoIgualAlBaseline: true,  apiRota: true  }, false],
  // --- la guarda del blog (con sha válido, para aislarla) ---
  ['blog: artículos correctos → publica',        { conSha: true, blog: [ok(), ok({ id: 2, slug: 'dos' })] }, true],
  ['blog: sin imagen → NO publica',              { conSha: true, blog: [ok({ image: '' })] }, false],
  ['blog: sin contenido → NO publica',           { conSha: true, blog: [ok({ content: '   ' })] }, false],
  ['blog: sin fecha → NO publica',               { conSha: true, blog: [ok({ date: '' })] }, false],
  ['blog: slug repetido → NO publica',           { conSha: true, blog: [ok(), ok({ id: 2 })] }, false],
  ['blog: slug con mayúsculas → NO publica',     { conSha: true, blog: [ok({ slug: 'Mi-Articulo' })] }, false],
  ['blog: slug vacío → NO publica',              { conSha: true, blog: [ok({ slug: '' })] }, false],
  // El malo va el SEGUNDO a propósito: con todos los casos malos en primera
  // posición, una validación que sólo mirase el primer artículo pasaba el examen.
  ['blog: el 2º sin imagen → NO publica',        { conSha: true, blog: [ok(), ok({ id: 2, slug: 'dos', image: '' })] }, false],
  ['blog: el 2º con slug raro → NO publica',     { conSha: true, blog: [ok(), ok({ id: 2, slug: 'con espacio' })] }, false],
];

let fallos = 0;
const comprobar = (nombre, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${nombre} · ${JSON.stringify(real)}${ok ? '' : ` esperado ${JSON.stringify(esperado)}`}`);
};

for (const [nombre, opts, esperado] of casos) {
  comprobar(`${nombre} · publicó`, await correr({ codigo, ...opts }), esperado);
}

comprobar('borrar: si se dice que no, no borra',
  await borrar({ codigo, respuesta: false }), { quedan: 2, pregunta: 'preguntó' });
comprobar('borrar: si se dice que sí, borra',
  await borrar({ codigo, respuesta: true }), { quedan: 1, pregunta: 'preguntó' });
comprobar('cerrar: con cambios sin publicar, avisa',
  await alCerrar({ codigo, sucio: true }), { registrado: true, avisa: true });
comprobar('cerrar: sin cambios, no molesta',
  await alCerrar({ codigo, sucio: false }), { registrado: true, avisa: false });

// El artículo intacto NO se sella: mover su fecha sin haberlo tocado le miente a
// Google igual que no moverla nunca, y de paso tira el sitemap entero a hoy.
comprobar('sellar: cambia el contenido → sella sólo ese',
  await sellar({ codigo, cambio: { content: '<p>reescrito entero</p>' } }), { tocado: 'hoy', intacto: '2026-05-02' });
comprobar('sellar: cambia el título → sella sólo ese',
  await sellar({ codigo, cambio: { title: 'Otro titular' } }), { tocado: 'hoy', intacto: '2026-05-02' });
comprobar('sellar: cambia la descripción → sella sólo ese',
  await sellar({ codigo, cambio: { excerpt: 'otra descripción' } }), { tocado: 'hoy', intacto: '2026-05-02' });
comprobar('sellar: sólo se marca destacado → NO sella',
  await sellar({ codigo, cambio: { featured: true } }), { tocado: '2026-05-01', intacto: '2026-05-02' });
comprobar('sellar: no se toca nada → NO sella',
  await sellar({ codigo, cambio: {} }), { tocado: '2026-05-01', intacto: '2026-05-02' });
comprobar('sellar: publish() sella lo que ENVÍA al repo',
  await sellarAlPublicar({ codigo }), { publico: true, tocado: 'hoy', intacto: '2026-05-02' });

process.exit(fallos ? 1 : 0);
