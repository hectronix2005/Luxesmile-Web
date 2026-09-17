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

const codigo = fs.readFileSync(RUTA, 'utf8');
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
for (const [nombre, opts, esperado] of casos) {
  const real = await correr({ codigo, ...opts });
  const ok = real === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${nombre} · publicó=${real} esperado=${esperado}`);
}
process.exit(fallos ? 1 : 0);
