/**
 * sync-theme.mjs — una sola fuente de verdad para el color.
 *
 * El color vivía en dos sitios que nadie ataba: `assets/css/styles.css` (lo que
 * ven las páginas estáticas, /blog/** y /privacidad/) y `theme.colors` de
 * `assets/data/content.json` (lo que applyTheme() pone en caliente en las
 * páginas con Alpine). El 17-sep-2026 divergían LAS SIETE variables: el blog
 * llevaba la paleta rosa por defecto mientras el resto del sitio iba en la
 * azul-gris. A efectos de quien lo mira, otro sitio.
 *
 * Este paso copia content.json -> styles.css. content.json manda, porque es lo
 * que edita el admin.
 *
 *   node scripts/sync-theme.mjs           escribe
 *   node scripts/sync-theme.mjs --check   no escribe; sale 1 si hay diferencia
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'assets/css/styles.css');
const JSON_ = join(ROOT, 'assets/data/content.json');
const CHECK = process.argv.includes('--check');

// clave en content.json -> nombre de la variable CSS
const VARS = {
  ivory: 'ivory',
  porcelain: 'porcelain',
  rosegold: 'rosegold',
  rosegoldDark: 'rosegold-dark',
  gold: 'gold',
  charcoal: 'charcoal',
  softblack: 'softblack',
};

const colores = JSON.parse(readFileSync(JSON_, 'utf8'))?.theme?.colors;
if (!colores) { console.error('✗ content.json no tiene theme.colors'); process.exit(1); }

let css = readFileSync(CSS, 'utf8');
const cambios = [];
const fallos = [];

for (const [clave, nombre] of Object.entries(VARS)) {
  const hex = colores[clave];
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) {
    fallos.push(`theme.colors.${clave} no es un hex de 6 dígitos: ${JSON.stringify(hex)}`);
    continue;
  }
  const h = hex.toLowerCase();
  const rgb = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');

  // Una variable a la vez, no el bloque entero: así sobreviven el formato, los
  // comentarios y --gold-soft, que no existe en content.json.
  for (const [re, valor, etiqueta] of [
    [new RegExp(`(--${nombre}:\\s*)#[0-9A-Fa-f]{6}`), h, `--${nombre}`],
    [new RegExp(`(--${nombre}-rgb:\\s*)\\d+ \\d+ \\d+`), rgb, `--${nombre}-rgb`],
  ]) {
    const antes = css;
    if (!re.test(css)) { fallos.push(`no encuentro ${etiqueta} en styles.css`); continue; }
    css = css.replace(re, `$1${valor}`);
    if (css !== antes) cambios.push(`${etiqueta} -> ${valor}`);
  }
}

if (fallos.length) { fallos.forEach((f) => console.error('✗', f)); process.exit(1); }

if (CHECK) {
  if (cambios.length) {
    console.error('✗ styles.css no coincide con content.json:');
    cambios.forEach((c) => console.error('   ', c));
    process.exit(1);
  }
  console.log('✓ styles.css coincide con content.json (7 variables)');
} else {
  if (cambios.length) { writeFileSync(CSS, css); cambios.forEach((c) => console.log('  ', c)); }
  console.log(`✓ Tema sincronizado: ${cambios.length} cambio(s) sobre 14 valores`);
}
