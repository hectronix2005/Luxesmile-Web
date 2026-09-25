#!/usr/bin/env node
/* INVARIANTES DE PÁGINA. Hoy una sola, la que más caro sale:
 *
 * Las secciones del sitio nacen con `opacity: 0` (.reveal en styles.css) y lo
 * único que las enciende es un IntersectionObserver que monta Alpine. Son 58
 * bloques repartidos en cuatro páginas — prácticamente todo el cuerpo de cada
 * una. Si Alpine no arranca, el visitante ve una página en blanco y NADA falla
 * en voz alta. Es la segunda causa del incidente del 7-jul-2026.
 *
 * La red de seguridad va inline en cada página a propósito: si viviera en un
 * .js externo, el fallo de que ese .js no cargue la dejaría sin cubrir. El
 * precio es que hay cuatro copias, y una copia que alguien edite en un solo
 * sitio es el fallo de esta semana entera. Por eso aquí se comprueban dos
 * cosas: que TODA página con .reveal la lleve, y que las copias sean
 * idénticas carácter a carácter.
 *
 * Y no se comprueba sólo que el texto esté: se EJECUTA sobre un DOM de
 * mentira, porque una red que revele de más mata la animación del sitio y una
 * que revele de menos no sirve para nada.
 *
 * Control positivo: quita la red de una página, o cambia `if (!dentro) return`
 * por `if (false) return`, y vuelve a correrlo.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, unlinkSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

let fallos = 0;
const ok = (cond, etq) => {
  if (!cond) fallos++;
  console.log(`  ${cond ? 'ok   ' : 'FALLO'}  ${etq}`);
};

// ── 1. cobertura: toda página con .reveal lleva la red ──────────────────────
console.log('\n1. cobertura: toda página con secciones ocultas lleva la red');
const htmls = [];
(function andar(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'admin' || e === 'marketing') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) andar(p);
    else if (e.endsWith('.html')) htmls.push(p.replace(/^\.\//, ''));
  }
})('.');

const RED = /<script data-lx="red-fade">([\s\S]*?)<\/script>/;
const conReveal = htmls.filter((f) => /class="[^"]*\breveal\b/.test(readFileSync(f, 'utf8')));
const copias = new Map();
for (const f of conReveal) {
  const m = RED.exec(readFileSync(f, 'utf8'));
  ok(!!m, `${f}${m ? '' : '  — tiene secciones ocultas y NO lleva la red'}`);
  if (m) copias.set(f, m[1]);
}
console.log(`  ..    ${conReveal.length} páginas con secciones ocultas`);

// ── 2. las cuatro copias son la misma ───────────────────────────────────────
console.log('\n2. las copias no han divergido');
const textos = [...copias.values()];
ok(textos.length > 0 && textos.every((t) => t === textos[0]),
   textos.every((t) => t === textos[0]) ? 'las copias son idénticas' : 'HAY COPIAS DISTINTAS: alguien editó una sola');

// ── 3. se ejecuta de verdad, sobre un DOM de mentira ────────────────────────
console.log('\n3. la red hace lo que dice (y sólo eso)');
const codigo = textos[0];

function correr({ visible, yaRevelada, enPantalla, hayReveal = true }) {
  const clases = [];
  const hacerEl = (arriba, alto) => ({
    clases: new Set(),
    classList: { add(c) { this.__d.clases.add(c); }, __d: null },
    getBoundingClientRect: () => ({ top: arriba, bottom: arriba + alto, height: alto }),
  });
  const els = hayReveal ? [hacerEl(enPantalla ? 100 : 5000, 300), hacerEl(enPantalla ? 400 : 6000, 300)] : [];
  els.forEach((e) => { e.classList.__d = e; clases.push(e.clases); });

  let pendientes = [];
  const ctx = {
    console: { warn() {}, log() {} },
    // Sin esto, `r.top < window.innerHeight` es `100 < undefined` = false y NADA
    // se revela nunca: el caso de «todo por debajo del pliegue» pasaba en verde
    // por el motivo equivocado. El mismo fallo que perseguimos todo el día.
    innerHeight: 800,
    document: {
      visibilityState: visible ? 'visible' : 'hidden',
      querySelector: (sel) => (sel === '.reveal.in-view' && yaRevelada ? {} : null),
      querySelectorAll: () => els,
    },
    setTimeout: (fn, ms) => { pendientes.push([ms, fn]); return pendientes.length; },
    setInterval: (fn, ms) => { pendientes.push([ms, fn]); return pendientes.length; },
    clearInterval: () => {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  // Disparar lo programado, dos vueltas: la primera saca el timer de los 4 s.
  for (let v = 0; v < 2; v++) {
    const cola = pendientes; pendientes = [];
    for (const [, fn] of cola) fn();
  }
  return clases.map((c) => c.has('in-view'));
}

const todas = (r) => r.length > 0 && r.every(Boolean);
const ninguna = (r) => r.every((x) => !x);

ok(todas(correr({ visible: true, yaRevelada: false, enPantalla: true })),
   'mecanismo muerto y hay sección en pantalla -> revela TODAS');
ok(ninguna(correr({ visible: true, yaRevelada: true, enPantalla: true })),
   'ya hay una revelada (el observador vive)   -> no toca nada');
ok(ninguna(correr({ visible: false, yaRevelada: false, enPantalla: true })),
   'pestaña en segundo plano                   -> no toca nada');
ok(ninguna(correr({ visible: true, yaRevelada: false, enPantalla: false })),
   'todo por debajo del pliegue                -> no toca nada');

// ── 4. el JS inline parsea, y el JSON-LD es JSON ────────────────────────────
// Una errata en un <script> inline no da error en ningun sitio hasta que un
// visitante abre la pagina: el HTML se sirve igual y el navegador se calla. Y un
// JSON-LD roto no rompe nada visible — solo deja de existir para Google.
//
// OJO: la primera version de esto daba 6 fallos que no eran fallos. Metia los
// bloques `application/ld+json` por `node --check` como si fueran JavaScript.
// El comprobador estaba mal, no las paginas.
console.log('\n4. el JavaScript inline parsea y el JSON-LD es JSON');
{
  let jsOk = 0, ldOk = 0;
  for (const f of htmls) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1], cuerpo = m[2];
      if (/\bsrc=/.test(attrs) || !cuerpo.trim()) continue;
      if (/ld\+json/.test(attrs)) {
        try { JSON.parse(cuerpo); ldOk++; }
        catch (e) { ok(false, `${f}: JSON-LD no parsea — ${e.message.slice(0, 60)}`); }
      } else {
        try { new vm.Script(cuerpo); jsOk++; }
        catch (e) { ok(false, `${f}: JS inline no parsea — ${e.message.slice(0, 60)}`); }
      }
    }
  }
  ok(jsOk > 0, `${jsOk} bloques de JavaScript inline parsean`);
  ok(ldOk > 0, `${ldOk} bloques de JSON-LD son JSON válido`);
}

// ── 5. el diagnostico de etiquetado ─────────────────────────────────────────
// Es el detector del que salen las respuestas a «¿esta el sitio bien etiquetado?».
// Vivia copiado en admin.js y marketing.js; el 17-sep arregle la lista de paginas
// en uno de los dos y el otro se quedo mirando 5 paginas de 15, en verde. Ahora es
// uno solo, en content.js, y se puede ejecutar de verdad con un fetch de mentira.
console.log('\n5. el diagnostico de etiquetado ve lo que debe');
{
  const codigo = readFileSync('assets/js/content.js', 'utf8');
  const SITEMAP = ['/', '/blog/', '/privacidad/'].map((u) => `<loc>https://luxesmilee.com${u}</loc>`).join('');
  // La home lleva tracking y WhatsApp; el blog lleva tracking pero NINGUN enlace;
  // privacidad no lleva tracking. Cada una falla de una forma distinta.
  const PAGS = {
    '../': '<script src="/assets/js/tracking.js"></script><a href="https://wa.me/57300">x</a>',
    '../blog/': '<script src="/assets/js/tracking.js"></script><p>sin enlaces</p>',
    '../privacidad/': '<a href="https://wa.me/57300">x</a>',
  };
  const TRACKING = "ga4: 'G-REAL', googleAds: 'AW-XXX', metaPixel: 'TU_PIXEL_ID', whatsapp: 'a', agenda: 'b', llamada: 'c'";

  const ctx = {
    console: { warn() {}, log() {} }, JSON, Date, Promise, RegExp, Object, Array, String, Number, Error,
    URL, URLSearchParams, structuredClone, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {} }), head: { appendChild() {} }, querySelectorAll: () => [] },
    location: { hostname: 'luxesmilee.com', search: '' },
    fetch: (u) => {
      const limpia = String(u).split('?')[0];
      if (limpia.endsWith('sitemap.xml')) return Promise.resolve({ ok: true, text: () => Promise.resolve(`<urlset>${SITEMAP}</urlset>`) });
      if (limpia.endsWith('tracking.js')) return Promise.resolve({ ok: true, text: () => Promise.resolve(TRACKING) });
      if (limpia in PAGS) return Promise.resolve({ ok: true, text: () => Promise.resolve(PAGS[limpia]) });
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);

  const r = await ctx.window.LuxeContent.diagnosticoDePixel('../');
  const fila = (l) => r.pages.find((x) => x.label === l);

  ok(r.pages.length === 3, `mira las ${r.pages.length} paginas del sitemap, no una lista a mano`);
  ok(!r.aviso, 'sin aviso cuando el sitemap se lee bien');
  ok(fila('Home') && fila('Home').ok, 'Home: con tracking y con enlace -> ok');
  ok(fila('/blog/') && !fila('/blog/').ok && fila('/blog/').tracking, '/blog/: tracking pero sin enlaces -> NO ok');
  ok(fila('/privacidad/') && !fila('/privacidad/').ok && !fila('/privacidad/').tracking, '/privacidad/: sin tracking -> NO ok');
  ok(r.ids.ga4 === 'G-REAL', 'lee el ID real de GA4 de tracking.js');
  ok(r.ids.problems.includes('googleAds') && r.ids.problems.includes('metaPixel'),
     `senala los IDs sin configurar (${r.ids.problems.join(', ')})`);
  ok(!r.ids.problems.includes('ga4'), 'y no senala el que si esta puesto');

  // Y si el sitemap no se puede leer, que lo DIGA en vez de mirar cinco y callarse.
  ctx.fetch = (u) => (String(u).includes('sitemap') ? Promise.resolve({ ok: false, status: 500 })
    : Promise.resolve({ ok: true, text: () => Promise.resolve(TRACKING) }));
  const caido = await ctx.window.LuxeContent.diagnosticoDePixel('../');
  ok(!!caido.aviso, `sitemap caido -> lo dice ("${(caido.aviso || 'NADA').slice(0, 40)}...")`);
}

// ── 6. el titulo que se ve es el que declara el HTML ───────────────────────
// `app.js` llevaba un `document.title = '…'` fijo, nacido en 12b0d01 como EL
// titulo de SEO del home. El 17-sep la rama de titulos reescribio los 15 <title>
// del sitio para que ninguno pasara de 60 caracteres, y esa linea siguio pisando
// el del home con uno de 62 en cuanto arrancaba Alpine. Comprobado en produccion:
// el HTML servia 53 caracteres y el navegador acababa mostrando 62 distintos.
//
// El fallo no se ve en ningun sitio: la pagina carga, el titulo es razonable, y
// solo comparando las dos fuentes aparece. Un `<title>` corregido en el HTML y
// reescrito por JS se ve exactamente igual que uno corregido de verdad.
console.log('\n6. ningun JS reescribe el <title> declarado en el HTML');
{
  const jsDir = 'assets/js';
  const sospechosos = [];
  for (const f of readdirSync(jsDir)) {
    if (!f.endsWith('.js') || f === 'alpine.min.js') continue;
    const bruto = readFileSync(join(jsDir, f), 'utf8');
    // Los comentarios fuera ANTES de buscar, pero sustituidos por el mismo
    // numero de saltos de linea para que el numero de linea siga siendo el de
    // verdad. La primera version de este detector se puso roja por el comentario
    // que explica el fallo, escrito tres lineas mas arriba de donde estaba el
    // codigo que se acababa de borrar: un detector que se dispara con la prosa
    // que lo documenta no distingue nada.
    const src = bruto
      .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (c) => ' '.repeat(c.length));
    // Solo las asignaciones; leer document.title es inofensivo.
    for (const m of src.matchAll(/document\s*\.\s*title\s*=(?!=)/g)) {
      const linea = src.slice(0, m.index).split('\n').length;
      sospechosos.push(`${f}:${linea}`);
    }
  }
  ok(sospechosos.length === 0,
     sospechosos.length ? `hay JS escribiendo document.title: ${sospechosos.join(', ')}`
                        : 'ninguno de los 4 ficheros de assets/js escribe document.title');

  // Y de paso, que los titulos que SI se sirven sigan cabiendo. Solo paginas
  // de verdad: `googleaf…html` es el fichero de verificacion de Search Console
  // —NO borrar, ver la ficha de Search Console— y `red-fade.html` es el
  // fragmento fuente de la red del fade. Ninguno de los dos es una pagina ni
  // lleva <head>.
  for (const f of htmls) {
    const bruto = readFileSync(f, 'utf8');
    if (!/<head[\s>]/i.test(bruto)) continue;
    const m = /<title>([\s\S]*?)<\/title>/.exec(bruto);
    if (!m) { ok(false, `${f}: sin <title>`); continue; }
    const t = m[1].trim();
    ok(t.length <= 60, `${f}: titulo de ${t.length} caracteres (<=60)`);
  }
}

// ── 7. las imagenes que pide una pagina existen Y son las actuales ─────────
// El nombre de cada .webp lleva un hash del contenido, asi que cambiar una foto
// en el panel la renombra. Diez de esos nombres estan escritos A MANO fuera de
// content.json: las 8 figuras de la galeria y la foto de la doctora en
// diseno-de-sonrisa (el respaldo que ve un crawler o alguien sin JS), y el logo
// de /privacidad/, que ni siquiera carga Alpine.
//
// Hasta el 17-sep extract-images borraba como huerfano todo lo que content.json
// no nombrara, asi que un cambio de foto dejaba a la landing de los anuncios
// pidiendo un fichero inexistente. Comprobado ejecutando el script real sobre
// una copia. Ya no borra, pero queda la otra mitad: la pagina seguiria enseñando
// la foto VIEJA mientras content.json tiene la nueva, y eso no lo ve nadie.
console.log('\n7. imagenes: las que se piden existen y son las de content.json');
{
  const contenido = JSON.parse(readFileSync('assets/data/content.json', 'utf8'));
  const actuales = new Set(
    [...readFileSync('assets/data/content.json', 'utf8')
      .matchAll(/assets\/img\/content\/([A-Za-z0-9._-]+\.webp)/g)].map((m) => m[1]),
  );
  ok(actuales.size > 0, `content.json referencia ${actuales.size} imagenes`);

  const pedidas = new Map();   // fichero -> paginas que lo piden
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.git' || e === '.github') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { andar(p); continue; }
      if (!e.endsWith('.html')) continue;
      for (const m of readFileSync(p, 'utf8').matchAll(/assets\/img\/content\/([A-Za-z0-9._-]+\.webp)/g)) {
        if (!pedidas.has(m[1])) pedidas.set(m[1], new Set());
        pedidas.get(m[1]).add(p);
      }
    }
  })('.');

  for (const [f, donde] of [...pedidas].sort()) {
    const quien = [...donde].sort().join(', ');
    ok(existsSync(join('assets/img/content', f)), `${f} existe en disco (lo pide ${quien})`);
    ok(actuales.has(f), `${f} sigue siendo la de content.json (si no, ${quien} enseña la foto vieja)`);
  }
}

// ── 8. el Action commitea TODO lo que sus pasos escriben ───────────────────
// El paso de commit tenia un `git add` con seis rutas a mano. `sync-fuentes`
// escribe OCHO ficheros y solo `index.html` estaba en esa lista: el paso corria,
// imprimia sus cambios en el log, y el commit se dejaba fuera la paleta de
// styles.css, el bloque de contacto del fallback y el telefono de cinco paginas.
// Comprobado en el historial: el bot NUNCA habia commiteado ninguno de los siete.
// Cada build rehacia la misma sincronizacion y la tiraba, con el flujo en verde.
//
// La lista de ficheros NO se saca leyendo sync-fuentes: se le pregunta a el
// (`--rutas`), que la produce ejecutando su logica de verdad.
console.log('\n8. el Action commitea lo que el sincronizador escribe');
{
  const wf = '.github/workflows/prerender.yml';
  const yml = readFileSync(wf, 'utf8');
  const m = /^\s*git add (.+)$/m.exec(yml);
  ok(m !== null, `${wf} tiene un paso que hace git add`);
  if (m) {
    const arg = m[1].trim();
    const rutas = execFileSync('node', ['scripts/sync-fuentes.mjs', '--rutas'], { encoding: 'utf8' })
      .split('\n').map((x) => x.trim()).filter(Boolean);
    ok(rutas.length > 0, `sync-fuentes declara ${rutas.length} ficheros que escribe`);
    if (/(^|\s)-A(\s|$)/.test(arg) || /(^|\s)--all(\s|$)/.test(arg)) {
      ok(true, `git add ${arg} — los cubre todos por construccion`);
    } else {
      const specs = arg.split(/\s+/).filter((x) => !x.startsWith('-'));
      for (const r of rutas) {
        ok(specs.some((sp) => r === sp || r.startsWith(sp.replace(/\/$/, '') + '/')),
           `${r} esta en el git add del Action`);
      }
    }
  }
}

// ── 9. el favicon: en TODAS las paginas y con la MISMA copia ───────────────
// Hasta el 18-sep-2026 el sitio no tenia favicon: ninguna de las 21 paginas
// declaraba uno y /favicon.ico daba 404, asi que cada pestaña salia con el icono
// generico. Ahora hay 21 copias del mismo bloque —9 propagadas por sync-fuentes
// y 10 emitidas por build-blog—, y una copia que alguien edite en un solo sitio
// no se ve: un favicon viejo se ve igual de bien que uno nuevo.
//
// Se comprueba tambien que los FICHEROS existan. Un <link> a un icono que no
// esta no da error en ningun sitio: el navegador se calla y enseña el generico,
// que es exactamente el estado del que veniamos.
console.log('\n9. favicon: cobertura, copias identicas y ficheros presentes');
{
  // El fichero de verificacion de Search Console no es una pagina y NO se toca.
  // Ver la ficha de Search Console: borrarlo o editarlo tumba la verificacion.
  const FUERA = new Set(['googleaf18a76309de9be5.html']);
  const frag = readFileSync('scripts/fragmentos/favicon.html', 'utf8').replace(/\n$/, '');
  const enlaces = [...frag.matchAll(/(?:href)="([^"?]+)"/g)].map((m) => m[1]);
  ok(enlaces.length >= 4, `el fragmento declara ${enlaces.length} enlaces`);

  for (const f of enlaces) {
    ok(existsSync(f.replace(/^\//, '')), `existe el fichero ${f}`);
  }

  const paginas = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', '.github', 'scripts'].includes(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { andar(p); continue; }
      if (e.endsWith('.html') && !FUERA.has(e)) paginas.push(p.replace(/^\.\//, ''));
    }
  })('.');

  let copias = 0;
  for (const p of paginas.sort()) {
    const html = readFileSync(p, 'utf8');
    const m = /  <!-- FAVICON[\s\S]*?<link rel="manifest"[^>]*>/.exec(html);
    if (!m) { ok(false, `${p}: sin el bloque del favicon`); continue; }
    ok(m[0] === frag.replace(/\n$/, ''), `${p}: copia identica al fragmento`);
    // Y una sola: la primera version del propagador dejaba los enlaces viejos
    // debajo de los nuevos, y el navegador se queda con el ultimo que lee.
    const veces = (html.match(/<link rel="manifest"/g) || []).length;
    ok(veces === 1, `${p}: ${veces} bloque(s), no ${veces === 1 ? '' : 'mas de uno'}`.trim());
    copias++;
  }
  ok(copias >= 20, `${copias} paginas con favicon`);
}

// ── 10. la tarjeta que se ve al compartir el enlace ────────────────────────
// Todo lo del sitio entra por WhatsApp, asi que la vista previa del enlace es
// la primera impresion. Tres cosas la rompen y ninguna se nota desde el repo:
//   · una og:image RELATIVA — el rastreador no la resuelve y la tarjeta sale sin
//     foto. Hoy las 15 son absolutas; nada lo sujetaba.
//   · una og:image que no existe — mismo resultado, y un <link> roto no se queja.
//   · sin og:image:width/height el rastreador no puede pintar la tarjeta hasta
//     bajarse la imagen, asi que la PRIMERA vez que se comparte sale sin foto.
//     Las diez del blog no las declaraban (18-sep-2026).
// Y si las medidas declaradas MIENTEN, el recorte sale torcido: se comparan
// contra el fichero de verdad, no contra content.json.
console.log('\n10. vista previa al compartir: og:image');
{
  const sharp = (await import('sharp')).default;
  const FUERA = new Set(['googleaf18a76309de9be5.html']);
  const paginas = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', '.github', 'scripts'].includes(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { andar(p); continue; }
      if (e.endsWith('.html') && !FUERA.has(e)) paginas.push(p.replace(/^\.\//, ''));
    }
  })('.');

  const SITIO = 'https://luxesmilee.com';
  let conImagen = 0;
  for (const p of paginas.sort()) {
    const html = readFileSync(p, 'utf8');
    const m = /<meta property="og:image" content="([^"]+)"/.exec(html);
    if (!m) continue;                       // no todas las paginas la declaran
    conImagen++;
    const src = m[1];
    ok(src.startsWith('https://'), `${p}: og:image absoluta (${src.slice(0, 48)})`);
    const disco = src.startsWith(SITIO) ? src.slice(SITIO.length).replace(/^\//, '') : null;
    if (!disco) { ok(false, `${p}: og:image apunta fuera del sitio`); continue; }
    if (!existsSync(disco)) { ok(false, `${p}: og:image no existe en disco (${disco})`); continue; }
    ok(true, `${p}: el fichero existe`);

    const w = /<meta property="og:image:width" content="(\d+)"/.exec(html);
    const h = /<meta property="og:image:height" content="(\d+)"/.exec(html);
    ok(!!(w && h), `${p}: declara width y height`);
    if (w && h) {
      const real = await sharp(disco).metadata();
      ok(Number(w[1]) === real.width && Number(h[1]) === real.height,
         `${p}: ${w[1]}x${h[1]} coincide con el fichero (${real.width}x${real.height})`);
      // Facebook y WhatsApp piden 200x200 minimo y recomiendan 1200 de ancho.
      ok(real.width >= 600, `${p}: ${real.width}px de ancho (>=600)`);
    }
  }
  ok(conImagen >= 15, `${conImagen} paginas declaran og:image`);
}

// ── 11. la direccion de la ficha SIRVE el sitio, no rebota ────────────────
// Hasta el 18-sep-2026 /Dra.Angela_Barbosa/ era un puente que rebotaba al
// inicio. Funcionaba, pero quien entraba por ahi terminaba mirando
// `luxesmilee.com/#inicio` en la barra: la direccion que se reparte junto a la
// ficha de Google no aguantaba ni un segundo en pantalla.
//
// Ahora sirve el inicio entero. Eso abre una trampa que NO se ve en el repo:
// el inicio pide sus ficheros en relativo, y desde una subcarpeta esas rutas
// apuntan a sitios que no existen. Los cuatro <script> darian 404, Alpine no
// arrancaria, y como los 58 bloques nacen con `opacity: 0` la pagina saldria
// EN BLANCO — no rota a medias: blanca. Y un 404 de <script> no se queja.
console.log('\n11. la direccion de la ficha sirve el sitio y no rebota');
{
  const P = 'Dra.Angela_Barbosa/index.html';
  ok(existsSync(P), `${P} existe`);
  if (existsSync(P)) {
    const html = readFileSync(P, 'utf8');

    ok(!/http-equiv="refresh"/i.test(html), 'no rebota: sin meta refresh');
    ok(!/location\.replace\(/.test(html), 'no rebota: sin location.replace');

    // Que sea el sitio de verdad, no una pagina delgada con el mismo nombre.
    ok(/id="inicio"/.test(html) && html.length > 40000,
       `lleva el inicio entero (${Math.round(html.length / 1024)} KB)`);

    // Ninguna ruta relativa: la trampa de la pagina en blanco.
    const sueltas = [];
    const re = /(^|[\s])((?::|x-bind:)?)(href|src)="([^"]*)"/g;
    let m;
    while ((m = re.exec(html))) {
      const [, , bind, attr, val] = m;
      if (bind) continue;                                   // expresion de Alpine
      if (/^(#|\/|https?:|mailto:|tel:|data:|javascript:)/.test(val)) continue;
      sueltas.push(`${attr}="${val}"`);
    }
    ok(sueltas.length === 0,
       sueltas.length ? `rutas relativas que darian 404: ${sueltas.join(', ')}` : 'todas las rutas son absolutas');

    // Y que los ficheros que pide existan de verdad.
    const pedidos = [...html.matchAll(/(?:href|src)="(\/assets\/[^"?]+)/g)].map((x) => x[1]);
    const faltan = [...new Set(pedidos)].filter((f) => !existsSync(f.replace(/^\//, '')));
    ok(faltan.length === 0,
       faltan.length ? `pide ficheros que no existen: ${faltan.join(', ')}` : `los ${new Set(pedidos).size} ficheros que pide existen`);
  }

  // El alias en la grafia que teclearia una persona SI rebota, a proposito:
  // es un alias, no una segunda portada.
  const A = 'dra-angela-barbosa/index.html';
  ok(existsSync(A), `${A} existe`);
  if (existsSync(A)) {
    const html = readFileSync(A, 'utf8');
    ok(/url=\/Dra\.Angela_Barbosa\//.test(html), 'el alias lleva a la direccion de la ficha');
  }
}

// ── 12. una sola direccion de inicio, dicha en ocho sitios ────────────────
// El 18-sep-2026 el sitio dejo de canonizar en la raiz y paso a canonizar en
// /Dra.Angela_Barbosa/, la direccion que se reparte junto a la ficha de Google.
// Eso se declara en OCHO sitios distintos —canonical, og:url, el JSON-LD del
// negocio, el x-default de las tres landings, el sitemap y la miga de pan del
// blog— y cambiar uno solo no rompe nada visible: la pagina sigue abriendo.
// Lo unico que pasa es que Google recibe dos respuestas a la misma pregunta y
// se queda con la que quiere. Por eso esto se comprueba: no para que funcione,
// sino para que no haya DOS verdades.
console.log('\n12. la direccion del inicio: una sola, en todos los sitios');
{
  const BASE = 'https://luxesmilee.com/Dra.Angela_Barbosa/';
  const dicho = [];
  const mira = (p, re, etiqueta) => {
    if (!existsSync(p)) { ok(false, `${p}: no existe`); return; }
    const m = re.exec(readFileSync(p, 'utf8'));
    if (!m) { ok(false, `${p}: no declara ${etiqueta}`); return; }
    dicho.push([`${p} · ${etiqueta}`, m[1]]);
  };

  mira('index.html', /<link rel="canonical" href="([^"]+)"/, 'canonical');
  mira('index.html', /<meta property="og:url" content="([^"]+)"/, 'og:url');
  mira('index.html', /"url": "(https:\/\/luxesmilee\.com[^"]*)"/, 'url del JSON-LD');
  mira('Dra.Angela_Barbosa/index.html', /<link rel="canonical" href="([^"]+)"/, 'canonical');
  mira('dra-angela-barbosa/index.html', /<link rel="canonical" href="([^"]+)"/, 'canonical del alias');
  mira('sitemap.xml', /<loc>([^<]+)<\/loc>/, 'primera entrada');
  for (const l of ['diseno-de-sonrisa', 'pacientes-internacionales', 'en/smile-design']) {
    mira(`${l}/index.html`, /hreflang="x-default" href="([^"]+)"/, 'x-default');
  }
  // El indice del blog no lleva BreadcrumbList (solo los articulos), asi que la
  // miga de pan se mira en uno de ellos.
  mira('blog/carillas-porcelana/index.html', /"position":1,"name":"Inicio","item":"([^"]+)"/, 'miga de pan');
  // El enlace visible es relativo, asi que no entra en la comparacion de arriba:
  // lo cubre el barrido de «nada enlaza a la raiz» que viene despues.
  ok(/<a href="\/Dra\.Angela_Barbosa\/">Inicio<\/a>/.test(readFileSync('blog/carillas-porcelana/index.html', 'utf8')),
     'el «Inicio» visible del blog lleva al inicio canonico');

  for (const [donde, valor] of dicho) {
    ok(valor === BASE, `${donde}: ${valor}${valor === BASE ? '' : `  — deberia ser ${BASE}`}`);
  }
  ok(dicho.length >= 10, `${dicho.length} declaraciones comprobadas`);

  // Y que nada enlace a la raiz: enlazar a una direccion que luego canoniza en
  // otra es la contradiccion que hace que Google se salte el canonical.
  const publicas = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', '.github', 'scripts', 'admin', 'marketing'].includes(e)) continue;
      const q = join(dir, e);
      if (statSync(q).isDirectory()) { andar(q); continue; }
      if (e.endsWith('.html') && e !== 'googleaf18a76309de9be5.html' && e !== 'admin.html') publicas.push(q.replace(/^\.\//, ''));
    }
  })('.');
  const culpables = publicas.filter((f) => /href="\/(?:#|")/.test(readFileSync(f, 'utf8')));
  ok(culpables.length === 0,
     culpables.length ? `enlazan a la raiz: ${culpables.join(', ')}` : `las ${publicas.length} paginas publicas enlazan al inicio canonico`);
}

// ── 13. el preconnect al host de Zeus ─────────────────────────────────────
// tracking.js pregunta a ese host si el redirector responde, y hasta que
// contesta los botones de WhatsApp son un `wa.me` directo: el paciente llega,
// pero su clic no pasa por Zeus y no queda registrado. Medido el 18-sep-2026:
// 350-500 ms, de los cuales 240 son el handshake TLS con un origen que el
// navegador aun no conoce. En movil lento eso son segundos, y hay un corte a
// los 2.500 ms que apaga el enrutado para toda la pagina.
//
// Lo que se comprueba no es que el <link> este —eso lo pone el propagador—
// sino DOS cosas que el propagador no puede saber:
//   · que lo lleva toda pagina que mide, y solo esas
//   · que el host precalentado es el MISMO al que llama tracking.js. Cambiar el
//     redirector y dejar el preconnect viejo no rompe nada visible: el sitio
//     funciona, sólo que precalienta una conexion que nadie usa y paga entera
//     la que si. Un fallo que no se ve es justo el que necesita detector.
console.log('\n13. preconnect: cubre a quien mide, y apunta a donde llama');
{
  const frag = readFileSync('scripts/fragmentos/preconnect-zeus.html', 'utf8').replace(/\n$/, '');
  const hostFrag = (/<link rel="preconnect" href="(https:\/\/[^"/]+)"/.exec(frag) || [])[1];
  ok(!!hostFrag, `el fragmento declara un host (${hostFrag})`);
  ok(/crossorigin/.test(frag), 'el fragmento lleva crossorigin (la sonda va anonima)');

  const tracking = readFileSync('assets/js/tracking.js', 'utf8');
  const redir = (/var REDIRECTOR = '(https:\/\/[^"'/]+)/.exec(tracking) || [])[1];
  ok(!!redir, `tracking.js llama a (${redir})`);
  ok(hostFrag === redir, `el preconnect apunta al host del redirector${hostFrag === redir ? '' : `  — ${hostFrag} != ${redir}`}`);

  const publicas = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', '.github', 'scripts'].includes(e)) continue;
      const q = join(dir, e);
      if (statSync(q).isDirectory()) { andar(q); continue; }
      if (e.endsWith('.html')) publicas.push(q.replace(/^\.\//, ''));
    }
  })('.');

  let miden = 0, sinMedir = 0;
  for (const f of publicas.sort()) {
    const html = readFileSync(f, 'utf8');
    const mide = /<script src="[^"]*tracking\.js/.test(html);
    const veces = (html.match(/rel="preconnect" href="https:\/\/zeus/g) || []).length;
    if (mide) {
      miden++;
      ok(veces === 1, `${f}: ${veces} preconnect${veces === 1 ? '' : ' — deberia ser exactamente 1'}`);
      const m = /  <!-- PRECONNECT ZEUS[\s\S]*?<link rel="preconnect"[^>]*>/.exec(html);
      ok(m && m[0] === frag, `${f}: copia identica al fragmento`);
    } else {
      sinMedir++;
      ok(veces === 0, `${f}: no mide, y no precalienta${veces ? ' — sobra el preconnect' : ''}`);
    }
  }
  ok(miden >= 16, `${miden} paginas miden y precalientan, ${sinMedir} no hacen ninguna de las dos`);
}

// ── 14. un articulo incompleto no puede pasar en silencio ────────────────
// El 17-sep se hizo que faltar `title`, `image`, `date` o `content` parase el
// build con un mensaje limpio y sin escribir nada. Faltaba el peor: `slug`.
// Sin el, el build TERMINABA CON EXITO y el articulo desaparecia del disco, del
// sitemap y del indice — medido el 18-sep: 14 entradas en el sitemap en vez de
// 15 y 8 enlaces en el indice en vez de 9, con exit 0.
//
// Esto corre el CLI DE VERDAD contra un content.json roto (via LX_CONTENT), no
// la funcion de validacion por su cuenta. La diferencia importa y ya costo una
// vez en este repo: un detector que llama a la funcion comprueba que la funcion
// va, no que el build la llame.
console.log('\n14. articulos incompletos: el build para y lo dice');
{
  const base = JSON.parse(readFileSync('assets/data/content.json', 'utf8'));
  const tmp = join(tmpdir(), `lx-blog-${process.pid}.json`);
  /* La salida tambien va fuera del repo. Sin esto, el unico caso que NO para el
     build —el de `excerpt`— escribia de verdad en blog/ y en sitemap.xml: un
     detector que ensucia lo que vigila. */
  const fuera = mkdtempSync(join(tmpdir(), 'lx-out-'));
  mkdirSync(join(fuera, 'blog'), { recursive: true });

  /* Huella de blog/ y sitemap.xml ANTES de correr nada. Antes se exigia que
     `git status` saliera vacio, y eso no distingue «el banco toco el repo» de
     «hay cambios sin commitear en el blog»: se ponia rojo justo en el flujo
     normal —tocar el blog y pasar los tests antes del commit—. Medido el
     25-sep-2026: rojo con el banco sin tocar nada (hashes identicos). */
  const huella = () => {
    const h = createHash('sha256');
    const recorrer = (dir) => {
      for (const n of readdirSync(dir).sort()) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) recorrer(p);
        else { h.update(p); h.update(readFileSync(p)); }
      }
    };
    recorrer('blog');
    h.update('sitemap.xml'); h.update(readFileSync('sitemap.xml'));
    return h.digest('hex');
  };
  const huellaAntes = huella();

  const correr = (mutar) => {
    const d = JSON.parse(JSON.stringify(base));
    mutar(d.blog.articles);
    writeFileSync(tmp, JSON.stringify(d));
    try {
      execFileSync('node', ['scripts/build-blog.mjs'], {
        env: { ...process.env, LX_CONTENT: tmp, LX_OUT: fuera }, stdio: 'pipe',
      });
      return { code: 0, salida: '' };
    } catch (e) {
      return { code: e.status, salida: String(e.stderr || '') + String(e.stdout || '') };
    }
  };

  for (const campo of ['slug', 'title', 'content', 'image', 'date']) {
    const r = correr((arts) => { delete arts[0][campo]; });
    ok(r.code === 1, `falta «${campo}»${r.code === 1 ? ' -> para el build' : `  — exit ${r.code}, NO para`}`);
    if (r.code === 1) ok(r.salida.includes(`falta «${campo}»`), `falta «${campo}» -> lo dice por su nombre`);
  }

  // El mensaje de un campo ausente no puede construirse CON ese campo.
  {
    const r = correr((arts) => { delete arts[0].slug; });
    ok(!/undefined/.test(r.salida), `sin slug, el aviso no dice «undefined»${/undefined/.test(r.salida) ? `: ${r.salida.split('\n').find((l) => l.includes('undefined'))}` : ''}`);
  }

  // Un slug es un nombre de carpeta: `../x` escribiria fuera de /blog/.
  for (const malo of ['../fuera', 'con/barra', 'Con Mayusculas']) {
    const r = correr((arts) => { arts[0].slug = malo; });
    ok(r.code === 1, `slug «${malo}» -> para el build${r.code === 1 ? '' : `  — exit ${r.code}`}`);
  }

  // Dos articulos con el mismo slug: el segundo pisa al primero y los dos «van bien».
  {
    const r = correr((arts) => { arts[1].slug = arts[0].slug; });
    ok(r.code === 1, `dos articulos con el mismo slug -> para el build${r.code === 1 ? '' : `  — exit ${r.code}`}`);
  }

  // `excerpt` NO es obligatorio a proposito: cae a blog.subtitle. Se fija aqui
  // para que quede dicho que la ausencia es una decision, no un olvido.
  {
    const r = correr((arts) => { delete arts[0].excerpt; });
    ok(r.code === 0, `sin «excerpt» -> el build sigue (cae a blog.subtitle)${r.code === 0 ? '' : `  — exit ${r.code}`}`);
  }

  try { unlinkSync(tmp); rmSync(fuera, { recursive: true, force: true }); } catch { /* da igual */ }

  // Y nada de lo anterior puede haber tocado el repo: misma huella que al empezar.
  const intacto = huella() === huellaAntes;
  ok(intacto, intacto ? 'el repo quedo intacto'
    : `el banco de pruebas dejo el repo tocado:\n${execFileSync('git', ['status', '--porcelain', '--', 'blog', 'sitemap.xml'], { encoding: 'utf8' }).trim()}`);
}

// ── 15. el build esta escrito DOS veces y nadie compara las copias ───────
// `npm run build` encadena los pasos; el Action los corre sueltos, uno por uno.
// Hacian falta los dos —el Action no llama a `npm run build`— y por eso la misma
// lista vive en dos sitios. Esa es la forma de fallo que mas veces ha aparecido
// en este repo: quien hace el trabajo y quien lo guarda no comparten la lista.
//
// Ha costado ya cuatro veces: los filtros de ruta del CI, el `git add` con lista
// fija, un `--autotest` que no estaba enganchado, y un `document.title` escrito
// fuera del HTML. Las cuatro se arreglaron a mano. Esto es lo que impide la
// quinta.
//
// Se comprueban tres cosas, y ninguna necesita que nadie declare nada: la lista
// se deduce de los dos ficheros y se comparan entre si.
console.log('\n15. `npm run build` y el Action corren lo mismo, en el mismo orden');
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const yml = readFileSync('.github/workflows/prerender.yml', 'utf8');

  // a) la cadena de `npm run build`, resuelta y en orden
  const enBuild = [];
  for (const m of (pkg.scripts.build || '').matchAll(/npm run ([a-z:@-]+)/g)) {
    const cuerpo = pkg.scripts[m[1]] || '';
    for (const s2 of cuerpo.matchAll(/scripts\/([a-z-]+\.mjs)/g)) enBuild.push(s2[1]);
  }

  // b) los pasos del Action, en orden
  const enAction = [...yml.matchAll(/run: node scripts\/([a-z-]+\.mjs)/g)].map((m) => m[1]);

  const soloBuild = enBuild.filter((x) => !enAction.includes(x));
  const soloAction = enAction.filter((x) => !enBuild.includes(x));
  ok(soloBuild.length === 0, soloBuild.length ? `en npm run build y NO en el Action: ${soloBuild.join(', ')}` : 'todo lo del build esta en el Action');
  ok(soloAction.length === 0, soloAction.length ? `en el Action y NO en npm run build: ${soloAction.join(', ')}` : 'todo lo del Action esta en el build');

  // c) y en el MISMO ORDEN. El orden no es cosmetico: extract-images tiene que ir
  //    antes que sync-fuentes —hasta que no hay fichero no hay nombre que
  //    propagar— y prerender antes que build-ficha, que copia el index ya
  //    rellenado. Una lista correcta en mal orden produce paginas mudas.
  ok(enBuild.join('>') === enAction.join('>'),
     enBuild.join('>') === enAction.join('>')
       ? `mismo orden en los dos (${enBuild.length} pasos)`
       : `el orden difiere:\n     build : ${enBuild.join(' > ')}\n     action: ${enAction.join(' > ')}`);

  // d) y cada uno tiene que disparar el Action. Sin esto, editar un script no
  //    lanzaba el build que lo ejecuta: pasado el 17-sep-2026 con dos de ellos.
  const filtros = (/paths:\n([\s\S]*?)\n  workflow_dispatch/.exec(yml) || [, ''])[1];
  const sinFiltro = [...new Set(enBuild)].filter((x) => !filtros.includes(x));
  ok(sinFiltro.length === 0, sinFiltro.length ? `no disparan el Action al editarse: ${sinFiltro.join(', ')}` : `los ${new Set(enBuild).size} scripts disparan el Action al editarse`);

  // e) los detectores existen y corren en los dos flujos
  const enTest = [...new Set([...(pkg.scripts.test || '').matchAll(/scripts\/([a-z-]+\.mjs)/g)].map((m) => m[1]))];
  for (const t of enTest) ok(existsSync(join('scripts', t)), `npm test cita ${t}${existsSync(join('scripts', t)) ? '' : ' — y no existe'}`);
  ok(/run: npm test/.test(yml), 'el Action del build corre `npm test`');
  const otro = readFileSync('.github/workflows/test.yml', 'utf8');
  ok(/run: npm test/.test(otro), '`test.yml` corre `npm test`');
  ok(!/paths:/.test(otro), '`test.yml` NO lleva filtros de ruta: corre en cada push');
}

console.log(fallos ? `\nFALLOS: ${fallos}` : '\ntodo en verde');
process.exit(fallos ? 1 : 0);
