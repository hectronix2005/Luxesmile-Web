#!/usr/bin/env node
/* LA FECHA QUE LE CONTAMOS A GOOGLE.
 *
 * `date` es cuándo se PUBLICÓ un artículo. Hasta el 17-sep-2026 el sitemap y el
 * `dateModified` del JSON-LD salían de ahí, así que reescribir un artículo entero
 * no movía ninguno de los dos: Google leía «sin cambios desde mayo» y no tenía
 * motivo para volver a rastrearlo. Se descubrió justo el día en que los 9
 * artículos se reescribieron de arriba abajo y el sitemap seguía declarando
 * mayo-julio — la página que está en posición 4 para una consulta de precio
 * acababa de estrenar su sección de precio y lo anunciaba como contenido viejo.
 *
 * El fallo no se ve: un sitemap con fechas viejas está igual de bien formado que
 * uno con fechas buenas, y el sitio se genera sin una sola queja.
 *
 * Lo que se comprueba aquí es que lo PUBLICADO coincide con lo que dice
 * `content.json`, no que el generador se parezca a sí mismo. Si alguien vuelve a
 * poner `lastmod: a.date`, estas tres secciones se ponen rojas.
 *
 * Control positivo: en scripts/build-blog.mjs cambia `a.updated || a.date` por
 * `a.date` (en cualquiera de los dos sitios), corre `npm run build:blog` y
 * vuelve aquí.
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (cond, etq) => {
  if (!cond) fallos++;
  console.log(`  ${cond ? 'ok   ' : 'FALLO'}  ${etq}`);
};

const content = JSON.parse(readFileSync('assets/data/content.json', 'utf8'));
const articulos = (content.blog && content.blog.articles) || [];
const esperada = (a) => a.updated || a.date;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ── 1. `updated` bien formado y nunca anterior a la publicación ─────────────
console.log('\n1. `updated` es una fecha válida y no precede a `date`');
for (const a of articulos) {
  if (a.updated === undefined) { ok(true, `${a.slug}: sin updated (permitido)`); continue; }
  ok(ISO.test(a.updated), `${a.slug}: updated «${a.updated}» con formato AAAA-MM-DD`);
  ok(a.updated >= a.date, `${a.slug}: updated ${a.updated} >= date ${a.date}`);
}

// ── 2. el sitemap declara la fecha de la última edición, no la de estreno ───
console.log('\n2. el sitemap publicado usa updated, no date');
const sitemap = readFileSync('sitemap.xml', 'utf8');
const enSitemap = new Map();
for (const m of sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)) {
  const loc = /<loc>(.*?)<\/loc>/.exec(m[0]);
  const lm = /<lastmod>(.*?)<\/lastmod>/.exec(m[0]);
  if (loc && lm) enSitemap.set(loc[1], lm[1]);
}
for (const a of articulos) {
  const url = `https://luxesmilee.com/blog/${a.slug}/`;
  const visto = enSitemap.get(url);
  ok(visto !== undefined, `${a.slug}: está en el sitemap`);
  if (visto !== undefined) ok(visto === esperada(a), `${a.slug}: lastmod ${visto} === ${esperada(a)}`);
}

// ── 3. el JSON-LD de cada artículo dice lo mismo ────────────────────────────
console.log('\n3. dateModified del artículo publicado');
for (const a of articulos) {
  let html;
  try { html = readFileSync(`blog/${a.slug}/index.html`, 'utf8'); }
  catch { ok(false, `${a.slug}: no existe blog/${a.slug}/index.html`); continue; }
  const dm = /"dateModified"\s*:\s*"([^"]+)"/.exec(html);
  ok(dm !== null, `${a.slug}: el JSON-LD lleva dateModified`);
  if (dm) {
    ok(dm[1] === esperada(a), `${a.slug}: dateModified ${dm[1]} === ${esperada(a)}`);
    const dp = /"datePublished"\s*:\s*"([^"]+)"/.exec(html);
    if (dp) ok(dm[1] >= dp[1], `${a.slug}: dateModified no precede a datePublished`);
  }
}

console.log(fallos === 0 ? '\n✓ fechas correctas\n' : `\n✗ ${fallos} fallo(s)\n`);
process.exit(fallos ? 1 : 0);
