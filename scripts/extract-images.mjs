/* =====================================================================
   Luxe-Smile · Extracción de imágenes base64 → archivos WebP
   ---------------------------------------------------------------------
   El admin guarda las imágenes como data:image base64 DENTRO de
   content.json (lo que infla el archivo a ~2.4 MB y bloquea el render).
   Este script las saca a archivos .webp en assets/img/content/ y reescribe
   SOLO los campos de imagen de content.json a rutas de archivo. El resto
   del JSON queda intacto.

   No cambia nada del admin ni del sitio: Alpine ya usa :src con rutas.
   El admin sigue subiendo base64; este script (en CI) lo convierte.

   Idempotente: el nombre incluye un hash del contenido, así que reejecutar
   sin cambios no genera archivos nuevos. Limpia .webp huérfanos.

   Uso:  node scripts/extract-images.mjs   (requiere sharp)
   ===================================================================== */
import sharp from 'sharp';
import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = join(ROOT, 'assets/data/content.json');
const IMG_DIR = join(ROOT, 'assets/img/content');
const FS_DIR = 'assets/img/content';          // ruta en disco / repo
const URL_DIR = '/assets/img/content';        // ruta root-relative que va al JSON
                                              // (funciona desde / y desde /diseno-de-sonrisa/)

const content = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });

const referenced = new Set();
let changed = false;

// Convierte un data:image a WebP en disco. Devuelve la ruta relativa, o null
// si el valor no era un data URL (ya es una ruta, o está vacío).
async function toWebp(dataUrl, name, { logo = false } = {}) {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
  const filename = `${name}-${hash}.webp`;
  referenced.add(filename);
  const outPath = join(IMG_DIR, filename);
  const rel = `${URL_DIR}/${filename}`;

  if (existsSync(outPath)) return rel; // ya generado (mismo contenido)

  let img = sharp(buf).rotate(); // respeta orientación EXIF
  if (logo) {
    // El logo se muestra pequeño (~40px de alto); 300px basta para retina.
    img = img.resize({ height: 300, withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 });
  } else {
    // Fotos: WebP con buena calidad; cap defensivo de ancho (no amplía).
    img = img.resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 });
  }
  await img.toFile(outPath);
  changed = true;
  return rel;
}

// Procesa un campo obj[key]: si es base64 lo extrae; si ya es ruta, la registra.
async function field(obj, key, name, opts) {
  const v = obj?.[key];
  if (typeof v !== 'string') return;
  if (v.startsWith('data:image')) {
    const rel = await toWebp(v, name, opts);
    if (rel) { obj[key] = rel; changed = true; }
  } else if (v.startsWith(URL_DIR + '/') || v.startsWith(FS_DIR + '/')) {
    referenced.add(v.split('/').pop());
  }
}

await field(content.brand, 'logo', 'logo', { logo: true });
await field(content.hero, 'image', 'hero');
await field(content.about, 'image', 'about');
for (let i = 0; i < (content.gallery || []).length; i++) {
  await field(content.gallery[i], 'image', `gallery-${i}`);
}

// Limpia .webp huérfanos (ya no referenciados por content.json).
for (const f of readdirSync(IMG_DIR)) {
  if (f.endsWith('.webp') && !referenced.has(f)) {
    unlinkSync(join(IMG_DIR, f));
    changed = true;
    console.log('  · huérfano eliminado:', f);
  }
}

if (changed) {
  writeFileSync(JSON_PATH, JSON.stringify(content, null, 2) + '\n');
  console.log('✓ Imágenes extraídas a WebP; content.json actualizado.');
} else {
  console.log('✓ Sin imágenes base64 nuevas; content.json sin cambios.');
}
