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
  readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync, statSync,
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
  await medir(obj, key);
}

/* Las MEDIDAS, junto a la ruta.
   `og:image:width` y `og:image:height` le dicen al rastreador de Facebook y
   WhatsApp que puede pintar la vista previa sin bajarse antes la imagen. Sin
   ellas, la PRIMERA vez que alguien comparte un enlace la tarjeta sale sin foto
   —el rastreador la busca luego— y para esta clínica el enlace se comparte por
   WhatsApp, que es el canal por el que entra todo.
   Las diez páginas del blog no las declaraban. Aquí es donde se saben, porque
   es el único paso que ya abre los ficheros. */
async function medir(obj, key) {
  const v = obj?.[key];
  if (typeof v !== 'string' || !v.startsWith(URL_DIR + '/')) return;
  const disco = join(ROOT, v.replace(/^\//, ''));
  if (!existsSync(disco)) return;
  const { width, height } = await sharp(disco).metadata();
  if (!width || !height) return;
  if (obj[key + 'Width'] === width && obj[key + 'Height'] === height) return;
  obj[key + 'Width'] = width;
  obj[key + 'Height'] = height;
  changed = true;
}

await field(content.brand, 'logo', 'logo', { logo: true });
await field(content.hero, 'image', 'hero');
await field(content.about, 'image', 'about');
for (let i = 0; i < (content.gallery || []).length; i++) {
  await field(content.gallery[i], 'image', `gallery-${i}`);
}
for (let i = 0; i < (content.blog?.articles || []).length; i++) {
  await field(content.blog.articles[i], 'image', `blog-${i}`);
}

/* HUÉRFANO NO ES «NO ESTÁ EN content.json».

   Esta limpieza borraba todo .webp que content.json no nombrara. Pero hay DIEZ
   ficheros con el nombre escrito a mano fuera de content.json:

     diseno-de-sonrisa/index.html   las 8 figuras de la galería y la foto de la
                                    doctora, que son el respaldo estático que ve
                                    un crawler o alguien sin JS (Alpine pinta la
                                    versión viva encima con x-for / :src)
     privacidad/index.html          el logo, y esa página NO carga Alpine, así
                                    que su <img> estático es el único que hay

   Y el nombre lleva un hash del contenido dentro. O sea que la doctora cambia
   una foto en el panel, el fichero pasa a llamarse distinto, el viejo deja de
   estar en content.json y ESTO LO BORRABA — dejando a la landing de los anuncios
   pidiendo una imagen que ya no existe. Comprobado el 17-sep ejecutando este
   mismo script sobre una copia: al sustituir gallery[3] imprimió
   «huérfano eliminado: gallery-3-29840d47e206.webp», que es justo el que
   diseno-de-sonrisa/index.html tiene escrito. El build habría salido en verde.

   Ahora se mira TODO el repo antes de borrar. Perder un .webp de más pesa unos
   KB; perderlo de menos rompe la página que recibe el 100% del dinero de Ads. */
function referenciasEnElRepo(dir, acc = new Set()) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === '.github') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { referenciasEnElRepo(p, acc); continue; }
    if (!/\.(html|css|js|mjs|json|xml|md)$/.test(e)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/assets\/img\/content\/([A-Za-z0-9._-]+\.webp)/g)) {
      acc.add(m[1]);
    }
  }
  return acc;
}
const enElRepo = referenciasEnElRepo(ROOT);
for (const f of readdirSync(IMG_DIR)) {
  if (!f.endsWith('.webp') || referenced.has(f)) continue;
  if (enElRepo.has(f)) {
    console.log('  · NO borro', f, '— content.json ya no lo usa, pero hay una página con ese nombre escrito a mano');
    continue;
  }
  unlinkSync(join(IMG_DIR, f));
  changed = true;
  console.log('  · huérfano eliminado:', f);
}

if (changed) {
  writeFileSync(JSON_PATH, JSON.stringify(content, null, 2) + '\n');
  console.log('✓ Imágenes extraídas a WebP; content.json actualizado.');
} else {
  console.log('✓ Sin imágenes base64 nuevas; content.json sin cambios.');
}
