#!/usr/bin/env node
/* =====================================================================
   Luxe-Smile · Favicon derivado del logo
   ---------------------------------------------------------------------
   Hasta el 18-sep-2026 el sitio NO tenía favicon: ninguna de las 21
   páginas declaraba uno y no existía /favicon.ico, así que cada pestaña
   salía con el icono genérico del navegador y la petición a /favicon.ico
   daba 404.

   Por qué se genera y no se dibuja a mano: el logo vive en content.json
   y la doctora puede cambiarlo desde el panel. Un .ico suelto en el repo
   se quedaría con el logo viejo para siempre, y nadie lo notaría — es el
   mismo fallo que [[project_imagenes_nombres_a_mano]]. Aquí el favicon
   sale SIEMPRE del logo actual.

   Qué hace:
     1. Recorta el ISOTIPO (el monograma de la izquierda). El logo mide
        1399x300, relación 4,66:1: metido entero en un cuadrado de 32 px
        sería un borrón. El isotipo es 308x261, casi cuadrado.
        Se localiza por el hueco vertical en blanco que lo separa del
        texto, no por coordenadas fijas: si cambia el logo, se recalcula.
     2. Saca la tinta a canal alfa conservando el antialias del original.
        Binarizar una línea tan fina la deja con dientes de sierra a 16 px.
     3. Compone sobre el azul de la paleta con la marca en blanco. Es la
        única de las cuatro variantes que se lee igual sobre pestaña clara
        y oscura, y el recuadro le da silueta propia.
     4. Escribe el .ico (16/32/48 en un solo fichero), los PNG y el
        manifiesto.

   Uso:  node scripts/build-favicon.mjs
         node scripts/build-favicon.mjs --check   no escribe; sale 1 si algo no coincide
   ===================================================================== */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(ROOT, 'assets/img/favicon');
const FONDO = { r: 0x1F, g: 0x3A, b: 0x57 };   // theme.colors.rosegoldDark
const soloComprobar = process.argv.includes('--check');

const contenido = JSON.parse(readFileSync(join(ROOT, 'assets/data/content.json'), 'utf8'));
const logoRel = contenido?.brand?.logo || '';
if (!/^\/assets\/img\/content\/[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/.test(logoRel)) {
  console.error('✗ brand.logo no es una ruta a un fichero extraído:', JSON.stringify(logoRel));
  console.error('  ¿se ejecutó extract-images antes que esto?');
  process.exit(1);
}
const LOGO = join(ROOT, logoRel.replace(/^\//, ''));

/* ── 1. localizar el isotipo ────────────────────────────────────────── */
async function recortarIsotipo() {
  const base = sharp(LOGO).flatten({ background: '#ffffff' });
  const { width, height } = await base.metadata();
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const oscuro = (x, y) => {
    const i = (y * width + x) * ch;
    return 765 - (data[i] + data[i + 1] + data[i + 2]) > 60;
  };

  const conTinta = [];
  for (let x = 0; x < width; x++) {
    let hay = false;
    for (let y = 0; y < height && !hay; y++) hay = oscuro(x, y);
    conTinta.push(hay);
  }
  const x0 = conTinta.indexOf(true);
  if (x0 < 0) { console.error('✗ el logo no tiene tinta: ¿está en blanco?'); process.exit(1); }

  // primer hueco en blanco ancho después de que empiece la tinta
  const HUECO = Math.max(20, Math.round(width * 0.02));
  let fin = -1, vacio = 0;
  for (let x = x0; x < width; x++) {
    if (!conTinta[x]) { vacio++; if (vacio >= HUECO) { fin = x - vacio + 1; break; } }
    else vacio = 0;
  }
  if (fin < 0) {
    console.error(`✗ no encuentro un hueco de ${HUECO}px que separe el isotipo del texto.`);
    console.error('  El logo debe de haber cambiado de forma. Revísalo antes de publicar un favicon ilegible.');
    process.exit(1);
  }

  // caja exacta dentro de esa franja
  let ax = 1e9, bx = -1, ay = 1e9, by = -1;
  for (let y = 0; y < height; y++) for (let x = x0; x < fin; x++) {
    if (!oscuro(x, y)) continue;
    if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y;
  }
  const w = bx - ax + 1, h = by - ay + 1;
  const razon = w / h;
  if (razon < 0.5 || razon > 2) {
    console.error(`✗ el isotipo sale ${w}x${h} (${razon.toFixed(2)}:1), demasiado alargado para un favicon.`);
    process.exit(1);
  }

  // tinta -> alfa, conservando el antialias
  const tira = await sharp(LOGO).flatten({ background: '#ffffff' })
    .extract({ left: ax, top: ay, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  const px = tira.data, c = tira.info.channels;
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * c;
    const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    rgba[p * 4] = 255; rgba[p * 4 + 1] = 255; rgba[p * 4 + 2] = 255;   // marca en blanco
    rgba[p * 4 + 3] = Math.max(0, Math.min(255, Math.round((255 - lum) * 255 / 156)));
  }
  return { buf: await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(), w, h, ax, ay };
}

/* ── 2. componer un cuadrado de N px ─────────────────────────────────── */
async function icono(marca, lado) {
  const margen = Math.round(lado * 0.12);
  const dentro = lado - margen * 2;
  const capa = await sharp(marca)
    .resize({ width: dentro, height: dentro, fit: 'contain', background: { ...FONDO, alpha: 0 } })
    .toBuffer();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: { ...FONDO, alpha: 1 } } })
    .composite([{ input: capa, left: margen, top: margen }]).png().toBuffer();
}

/* ── 3. contenedor .ico, a mano ──────────────────────────────────────── */
/* Un .ico es una cabecera de 6 bytes, una entrada de 16 por imagen y los
   PNG pegados detrás. Escribirlo aquí evita una dependencia mas por seis
   lineas de aritmetica. El .ico importa porque el navegador pide
   /favicon.ico aunque ninguna pagina lo declare. */
function ico(pngs) {
  const n = pngs.length;
  const cab = Buffer.alloc(6 + 16 * n);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(n, 4);
  let off = 6 + 16 * n;
  pngs.forEach(({ lado, buf }, i) => {
    const e = 6 + 16 * i;
    cab.writeUInt8(lado >= 256 ? 0 : lado, e);        // 0 significa 256
    cab.writeUInt8(lado >= 256 ? 0 : lado, e + 1);
    cab.writeUInt8(0, e + 2); cab.writeUInt8(0, e + 3);
    cab.writeUInt16LE(1, e + 4); cab.writeUInt16LE(32, e + 6);
    cab.writeUInt32LE(buf.length, e + 8);
    cab.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([cab, ...pngs.map((p) => p.buf)]);
}

/* ── 4. escribir ─────────────────────────────────────────────────────── */
const marca = await recortarIsotipo();
console.log(`  isotipo: ${marca.w}x${marca.h} en (${marca.ax},${marca.ay}) de ${logoRel.split('/').pop()}`);

const PNGS = [
  ['assets/img/favicon/icon-32.png', 32],
  ['assets/img/favicon/icon-96.png', 96],
  ['assets/img/favicon/apple-touch-icon.png', 180],
  ['assets/img/favicon/icon-192.png', 192],
  ['assets/img/favicon/icon-512.png', 512],
];
const salida = new Map();
for (const [ruta, lado] of PNGS) salida.set(ruta, await icono(marca.buf, lado));
salida.set('favicon.ico', ico(await Promise.all(
  [16, 32, 48].map(async (lado) => ({ lado, buf: await icono(marca.buf, lado) })),
)));
salida.set('site.webmanifest', Buffer.from(JSON.stringify({
  name: contenido?.brand?.name || 'Luxe-Smile',
  short_name: contenido?.brand?.name || 'Luxe-Smile',
  icons: [
    { src: '/assets/img/favicon/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/img/favicon/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
  theme_color: contenido?.theme?.colors?.rosegoldDark || '#1F3A57',
  background_color: contenido?.theme?.colors?.ivory || '#F7F8FA',
  display: 'browser',
}, null, 2) + '\n'));

if (!existsSync(SALIDA)) mkdirSync(SALIDA, { recursive: true });
let distintos = 0;
for (const [ruta, buf] of salida) {
  const p = join(ROOT, ruta);
  const igual = existsSync(p) && readFileSync(p).equals(buf);
  if (igual) continue;
  distintos++;
  if (soloComprobar) console.error('  ✗ no coincide con el logo actual:', ruta);
  else { writeFileSync(p, buf); console.log('  ·', ruta, `(${buf.length} B)`); }
}

if (soloComprobar) {
  if (distintos) {
    console.error(`✗ ${distintos} fichero(s) del favicon no salen del logo que hay en content.json.`);
    console.error('  Ejecuta: node scripts/build-favicon.mjs');
    process.exit(1);
  }
  console.log('✓ el favicon coincide con el logo actual');
} else {
  console.log(distintos ? `✓ Favicon generado: ${distintos} fichero(s)` : '✓ Favicon ya al día');
}
