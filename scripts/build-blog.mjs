/* =====================================================================
   Luxe-Smile · Generador de páginas estáticas del blog (SEO)
   ---------------------------------------------------------------------
   A partir de assets/data/content.json genera, en HTML 100% estático:
     - /blog/<slug>/index.html   una página indexable por artículo
     - /blog/index.html          índice del blog
     - /sitemap.xml              home + landings + blog + artículos
   Cada página de artículo lleva <title>/description únicos, canonical,
   Open Graph, H1, el contenido completo y datos estructurados BlogPosting
   + BreadcrumbList. NO depende de JS: el crawler lo lee tal cual.

   Uso:  node scripts/build-blog.mjs   (corre también en CI)
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
/* La ruta que el sitio canoniza como inicio. Se importa en vez de repetirse:
   si un dia cambia, el sitemap y la miga de pan la siguen solas. */
import { RUTA_FICHA } from './build-ficha.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* `LX_OUT`, como `LX_CONTENT`, existe solo para el detector: le deja correr este
   build entero contra datos rotos y mirar lo que sale, sin escribir en el repo. */
const SALIDA = process.env.LX_OUT || ROOT;
const SITE = 'https://luxesmilee.com';
/* El inicio, tal y como el sitio lo canoniza desde el 18-sep-2026. Los enlaces
   internos apuntan aqui y no a la raiz a proposito: enlazar a una direccion que
   luego canoniza en otra es la contradiccion que hace que Google ignore el
   canonical. La raiz sigue sirviendo lo mismo, no se rompe ningun enlace viejo. */
const INICIO = `/${RUTA_FICHA}/`;
const V = '20260925b'; // cache-bust de CSS
const VJS = '20260918a'; // cache-bust de tracking.js (mantener en sync con index/landings)

/* `LX_CONTENT` existe SOLO para que el detector pueda correr este build de verdad
   —el CLI entero, no una funcion suelta— contra un content.json roto sin tocar el
   repo. Sin la variable, la ruta es la de siempre. La alternativa era que el test
   llamara a la validacion a mano, y eso ya fallo antes en este repo: comprobaba
   que la funcion funciona, no que el build la llame. */
const content = JSON.parse(readFileSync(process.env.LX_CONTENT || join(ROOT, 'assets/data/content.json'), 'utf8'));
const brand = content.brand || {};
const contact = content.contact || {};
const blog = content.blog || {};
/* AQUI SE PERDIAN. Esta linea era `.filter((a) => a && a.slug)`, y ese filtro
   corria ANTES de la validacion: un articulo sin `slug` desaparecia sin que
   nadie lo mirase, y el build terminaba diciendo que todo fue bien. Anadirlo a
   OBLIGATORIOS no bastaba —la validacion no llegaba a verlo nunca—, que es por
   lo que el detector siguio en rojo despues de «arreglarlo».
   Ahora NO se filtra nada: se valida la lista cruda y quien no cumpla para el
   build. Descartar en silencio y avisar son cosas distintas. */
const articles = blog.articles || [];

/* QUE PERDER EL BLOG ENTERO NO REPORTE EXITO.

   Medido el 17-sep-2026: con `articles: []` este script borraba el indice y
   dejaba el sitemap sin articulos, y terminaba diciendo
   «✓ Blog generado: 0 articulos». Salida 0, el Action lo commiteaba.

   Los nueve articulos vienen de content.json, que lo escribe el admin: un
   guardado a medias o un merge malo bastan. Se falla ANTES de escribir nada. */
if (!articles.length) {
  console.error('✗ content.json no trae ni un articulo con slug. No se escribe nada.');
  console.error('  Si de verdad quieres dejar el blog vacio, hay que hacerlo a mano.');
  process.exit(1);
}

/* CAMPOS OBLIGATORIOS, Y QUE FALLEN TODOS IGUAL.

   Medido el 17-sep-2026, con content.json degradado: faltaba `title` y esto
   reventaba con una traza cruda de Node que no decia ni que articulo era;
   faltaba `image` y generaba la pagina con src="" tan contento; faltaba
   `date` y la generaba sin datePublished. Tres formas distintas de fallar
   para el mismo tipo de problema, y dos de ellas en silencio.

   Se revisan TODOS antes de escribir y se listan todos los problemas de una
   vez: quien lo arregle quiere verlos juntos, no descubrirlos de uno en uno
   en tres despliegues fallidos.

   `slug` SI entra, desde el 18-sep-2026. No estaba, y era el peor de todos: sin
   el, el build terminaba con exito y el articulo desaparecia del disco, del
   sitemap y del indice. Medido: 14 entradas en el sitemap en vez de 15 y 8
   enlaces en el indice en vez de 9, con exit 0.

   `excerpt` NO entra, y ahora es verdad: cae a `blog.subtitle`. Hasta hoy caia
   solo en la meta descripcion, y la tarjeta del indice se quedaba en blanco —un
   mismo campo ausente con dos comportamientos, que es la incoherencia de la que
   iba todo esto. Hacerlo obligatorio habria parado un despliegue por un campo
   decorativo que ya tenia caida disenada. */
const OBLIGATORIOS = ['slug', 'title', 'content', 'image', 'date'];
/* Un slug con forma valida: es un NOMBRE DE CARPETA. Sin esta comprobacion, un
   `../algo` escribiria fuera de /blog/ y un slug con barra crearia un nivel que
   nadie espera. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const problemas = [];
/* El articulo se nombra SIN usar el campo que puede faltar. La version anterior
   componia `/blog/${a.slug}/ · falta «slug»` y escribia «/blog/undefined/»: el
   mensaje de un campo ausente no puede construirse con ese campo. */
const nombrar = (a, i) => (a && a.slug) || (a && a.title) || `articulo ${i + 1} (sin slug ni title)`;
articles.forEach((a, i) => {
  if (!a || typeof a !== 'object') { problemas.push(`entrada ${i + 1} de blog.articles no es un articulo`); return; }
  for (const campo of OBLIGATORIOS) {
    const v = a[campo];
    if (typeof v !== 'string' || !v.trim()) {
      problemas.push(`${nombrar(a, i)} · falta «${campo}»`);
    }
  }
  if (typeof a.slug === 'string' && a.slug.trim() && !SLUG_RE.test(a.slug)) {
    problemas.push(`${nombrar(a, i)} · el «slug» no es un nombre de carpeta valido`);
  }
});
/* Y dos articulos no pueden compartir slug: el segundo pisaria al primero y el
   build diria que fueron bien los dos. */
{
  const vistos = new Map();
  articles.forEach((a, i) => {
    if (!a || typeof a.slug !== 'string' || !a.slug.trim()) return;
    if (vistos.has(a.slug)) problemas.push(`${nombrar(a, i)} · repite el «slug» de ${vistos.get(a.slug)}`);
    else vistos.set(a.slug, nombrar(a, i));
  });
}
if (problemas.length) {
  console.error('✗ Articulos incompletos en content.json. No se escribe nada:');
  problemas.forEach((p) => console.error('   ' + p));
  process.exit(1);
}

// --- helpers ---
const escAttr = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const escText = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const abs = (u) => {
  if (!u) return SITE + '/';
  if (/^https?:\/\//.test(u)) return u;
  return SITE + (u.startsWith('/') ? u : '/' + u);
};

const waDigits = String(contact.whatsapp || '').replace(/\D/g, '');
const waLink = `https://wa.me/${waDigits}?text=${encodeURIComponent(
  'Hola, quiero agendar una valoración en Luxe-Smile.',
)}`;

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fmtDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return String(iso || '');
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

const logoAbs = abs(brand.logo);

/* El favicon sale del MISMO fragmento que sync-fuentes propaga a las paginas
   escritas a mano. Si se copiara aqui, las 10 paginas del blog divergirian del
   resto del sitio en cuanto alguien tocara uno de los dos sitios, y nadie lo
   veria: un favicon viejo se ve igual de bien que uno nuevo. */
const FAVICON = readFileSync(join(ROOT, 'scripts/fragmentos/favicon.html'), 'utf8').replace(/\n$/, '');
/* Mismo fragmento que sync-fuentes.mjs propaga a las paginas escritas a mano.
   Se lee, no se copia: dos copias del mismo <link> divergen en cuanto alguien
   cambia el host del redirector en una sola de ellas. */
const PRECONNECT = readFileSync(join(ROOT, 'scripts/fragmentos/preconnect-zeus.html'), 'utf8').replace(/\n$/, '');

// <head> común
function head({ title, desc, url, image, imgW, imgH, imgAlt, jsonld }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escText(title)}</title>
  <meta name="description" content="${escAttr(desc)}" />
  <link rel="canonical" href="${escAttr(url)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="${url.includes('/blog/') && url !== SITE + '/blog/' ? 'article' : 'website'}" />
  <meta property="og:site_name" content="Luxe-Smile" />
  <meta property="og:locale" content="es_CO" />
  <meta property="og:title" content="${escAttr(title)}" />
  <meta property="og:description" content="${escAttr(desc)}" />
  <meta property="og:url" content="${escAttr(url)}" />
  <meta property="og:image" content="${escAttr(abs(image))}" />
${[
    // Sin width/height el rastreador de Facebook y WhatsApp no puede pintar la
    // tarjeta hasta bajarse la imagen, asi que la PRIMERA vez que se comparte un
    // enlace sale sin foto. Las diez paginas del blog no las declaraban. Salen de
    // content.json, donde las guarda extract-images: es el unico paso que ya abre
    // los ficheros y sabe cuanto miden. Si faltan —un articulo recien creado en el
    // panel, antes de que corra la extraccion— no se emiten en vez de mentir.
    imgW && imgH ? `  <meta property="og:image:width" content="${imgW}" />` : null,
    imgW && imgH ? `  <meta property="og:image:height" content="${imgH}" />` : null,
    imgAlt ? `  <meta property="og:image:alt" content="${escAttr(imgAlt)}" />` : null,
  ].filter(Boolean).join('\n')}
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
${FAVICON}
  <link rel="stylesheet" href="/assets/css/tailwind.css?v=${V}" />
  <link rel="stylesheet" href="/assets/css/styles.css?v=${V}" />
  <!-- Seguimiento de conversiones (GA4 + Google Ads + Meta Pixel). Editar los IDs en assets/js/tracking.js -->
${PRECONNECT}
  <script src="/assets/js/tracking.js?v=${VJS}"></script>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;
}

function topbar() {
  return `<body class="blog-body">
  <header class="blog-topbar">
    <a href="${INICIO}" class="blog-topbar-logo" aria-label="Luxe-Smile inicio">
      <img src="${escAttr(brand.logo)}" alt="Luxe-Smile" />
    </a>
    <a href="${INICIO}#contacto" class="btn-primary">Agenda tu cita</a>
  </header>`;
}

function footer() {
  const year = String(content.footer?.copyright || '').match(/\d{4}/)?.[0] || '2026';
  return `  <footer class="blog-footer">
    <div class="blog-container">
      <p class="font-serif blog-footer-brand">Luxe-Smile</p>
      <p class="blog-footer-meta">${escText(brand.doctor || '')} · ${escText(contact.address || '')}</p>
      <p class="blog-footer-links"><a href="${INICIO}">Inicio</a> · <a href="/blog/">Blog</a> · <a href="${INICIO}#servicios">Servicios</a> · <a href="${INICIO}#contacto">Contacto</a></p>
      <p class="blog-footer-copy">© ${year} Luxe-Smile. Todos los derechos reservados.</p>
    </div>
  </footer>
  <a href="${escAttr(waLink)}" target="_blank" rel="noopener" class="wa-float" aria-label="Chatear por WhatsApp">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.49 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.94L0 24l6.34-1.66a11.84 11.84 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.33 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.77.99 1-3.67-.23-.38a9.85 9.85 0 0 1-1.51-5.25c0-5.46 4.44-9.9 9.91-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.47-4.44 9.9-9.9 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.41-1.48a9.1 9.1 0 0 1-1.68-2.09c-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.22 5.1 4.51.71.31 1.27.5 1.7.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
    </svg>
  </a>
</body>
</html>`;
}

function relatedList(current) {
  const others = articles.filter((a) => a.slug !== current.slug).slice(0, 3);
  if (!others.length) return '';
  return `
      <aside class="blog-related">
        <h2 class="font-serif">Otros artículos</h2>
        <ul>
          ${others
            .map((a) => `<li><a href="/blog/${escAttr(a.slug)}/">${escText(a.title)}</a></li>`)
            .join('\n          ')}
        </ul>
      </aside>`;
}

function articlePage(a) {
  const url = `${SITE}/blog/${a.slug}/`;
  // El sufijo de marca SOLO si cabe. Google corta el <title> sobre los 60
  // caracteres y lo que pierde es el final, que es justo la parte util; 7 de
  // los 9 articulos se estaban cortando por culpa de estos 20 caracteres. Y la
  // marca «luxe smile» trae 50 impresiones en 3 meses, asi que no vale su
  // espacio a cualquier precio (Search Console, 17-sep-2026).
  const SUFIJO = ' | Luxe-Smile Bogotá';
  const title = (a.title.length + SUFIJO.length) <= 60 ? `${a.title}${SUFIJO}` : a.title;
  const desc = a.excerpt || blog.subtitle || '';
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      headline: a.title,
      description: desc,
      image: abs(a.image),
      author: { '@type': 'Person', name: brand.doctor || 'Luxe-Smile' },
      publisher: {
        '@type': 'Organization',
        name: 'Luxe-Smile',
        logo: { '@type': 'ImageObject', url: logoAbs },
      },
      datePublished: a.date,
      // `a.date` es cuando se PUBLICO. Decir que tambien es cuando se modifico
      // hace que Google no vea nunca una reescritura: el 17-sep se reescribieron
      // los 9 articulos enteros y el sitemap seguia declarando mayo-julio.
      dateModified: a.updated || a.date,
      keywords: a.keywords || '',
      inLanguage: 'es-CO',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/${RUTA_FICHA}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
        { '@type': 'ListItem', position: 3, name: a.title, item: url },
      ],
    },
  ];

  return `${head({ title, desc, url, image: a.image, imgW: a.imageWidth, imgH: a.imageHeight, imgAlt: a.title, jsonld })}
${topbar()}
  <main class="blog-container">
    <nav class="blog-breadcrumb" aria-label="Ruta de navegación">
      <a href="${INICIO}">Inicio</a> <span>›</span> <a href="/blog/">Blog</a> <span>›</span> <span class="current">${escText(a.title)}</span>
    </nav>
    <article>
      <p class="blog-eyebrow">${escText(a.category || '')}${a.readTime ? ' · ' + escText(a.readTime) : ''}</p>
      <h1 class="font-serif blog-h1">${escText(a.title)}</h1>
      <p class="blog-byline">${escText(a.author || brand.doctor || '')} · <time datetime="${escAttr(a.date)}">${escText(fmtDate(a.date))}</time></p>
      <img class="blog-hero-img" src="${escAttr(a.image)}" alt="${escAttr(a.title)}" width="1200" height="675" />
      <div class="article-body">${a.content || ''}</div>
      <div class="blog-cta">
        <p class="font-serif">¿Lista para tu nueva sonrisa?</p>
        <p>Agenda una valoración con la ${escText(brand.doctor || 'Dra. Angela Barbosa')} en nuestro consultorio de Chico, Bogotá.</p>
        <div class="blog-cta-actions">
          <a href="${escAttr(waLink)}" target="_blank" rel="noopener" class="btn-primary">Agenda por WhatsApp</a>
          <a href="${INICIO}#contacto" class="btn-ghost">Ver contacto</a>
        </div>
      </div>
    </article>${relatedList(a)}
  </main>
${footer()}`;
}

function indexPage() {
  const url = `${SITE}/blog/`;
  const title = blog.indexTitle || `Blog de Odontología Estética | Luxe-Smile Bogotá`;
  const desc = blog.metaDescription || blog.subtitle || 'Consejos, técnicas y tendencias en diseño de sonrisa, carillas y estética dental en Bogotá.';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: blog.title || 'Blog Luxe-Smile',
    description: desc,
    url,
    publisher: { '@type': 'Organization', name: 'Luxe-Smile', logo: { '@type': 'ImageObject', url: logoAbs } },
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `${SITE}/blog/${a.slug}/`,
      datePublished: a.date,
      image: abs(a.image),
    })),
  };

  const cards = articles
    .map(
      (a) => `
        <a class="blog-index-card" href="/blog/${escAttr(a.slug)}/">
          <div class="blog-index-thumb"><img src="${escAttr(a.image)}" alt="${escAttr(a.title)}" loading="lazy" /></div>
          <p class="blog-eyebrow">${escText(a.category || '')}${a.readTime ? ' · ' + escText(a.readTime) : ''}</p>
          <h2 class="font-serif">${escText(a.title)}</h2>
          <p class="blog-index-excerpt">${escText(a.excerpt || blog.subtitle || '')}</p>
        </a>`,
    )
    .join('\n');

  return `${head({ title, desc, url, image: articles[0]?.image, imgW: articles[0]?.imageWidth, imgH: articles[0]?.imageHeight, imgAlt: articles[0]?.title, jsonld })}
${topbar()}
  <main class="blog-container">
    <nav class="blog-breadcrumb" aria-label="Ruta de navegación">
      <a href="${INICIO}">Inicio</a> <span>›</span> <span class="current">Blog</span>
    </nav>
    <header class="blog-index-head">
      <p class="blog-eyebrow">Blog</p>
      <h1 class="font-serif blog-h1">${escText(blog.title || 'Blog de Odontología Estética')}</h1>
      <p class="blog-index-sub">${escText(desc)}</p>
    </header>
    <div class="blog-index-grid">
${cards}
    </div>
  </main>
${footer()}`;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    // El inicio se declara en la direccion que va en la ficha de Google, que
    // es la que el sitio canoniza desde el 18-sep-2026. La raiz sigue sirviendo
    // lo mismo, pero solo una de las dos puede ser la indexada.
    { loc: `${SITE}/${RUTA_FICHA}/`, priority: '1.0', changefreq: 'monthly' },
    { loc: `${SITE}/diseno-de-sonrisa/`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${SITE}/pacientes-internacionales/`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${SITE}/en/smile-design/`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${SITE}/blog/`, priority: '0.7', changefreq: 'weekly' },
    // Publicada el 17-sep-2026 y se habia quedado fuera del sitemap.
    { loc: `${SITE}/privacidad/`, priority: '0.3', changefreq: 'yearly' },
    ...articles.map((a) => ({
      loc: `${SITE}/blog/${a.slug}/`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: a.updated || a.date,
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod || today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// --- escribir archivos ---
for (const a of articles) {
  const dir = join(SALIDA, 'blog', a.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), articlePage(a));
}
mkdirSync(join(SALIDA, 'blog'), { recursive: true });
writeFileSync(join(SALIDA, 'blog', 'index.html'), indexPage());
writeFileSync(join(SALIDA, 'sitemap.xml'), sitemap());

/* CARPETAS HUERFANAS.

   Este script generaba paginas y no borraba ninguna: si un articulo se
   eliminaba o se le cambiaba el slug desde el admin, su carpeta se quedaba y
   su pagina seguia VIVA en su URL, huerfana del indice y del sitemap, y
   Google la conservaba indexada. extract-images.mjs si limpia sus huerfanos;
   aqui no se limpiaba nada, y esa diferencia no la decidio nadie.

   Conservador a proposito: solo se borra una carpeta si contiene UNICAMENTE
   un index.html. Si alguien puso algo mas ahi dentro, se avisa y no se toca. */
const vivos = new Set(articles.map((a) => a.slug));
const huerfanas = [];
for (const d of readdirSync(join(SALIDA, 'blog'), { withFileTypes: true })) {
  if (!d.isDirectory() || vivos.has(d.name)) continue;
  const dir = join(SALIDA, 'blog', d.name);
  if (!existsSync(join(dir, 'index.html'))) continue;
  const dentro = readdirSync(dir);
  if (dentro.length === 1 && dentro[0] === 'index.html') {
    rmSync(dir, { recursive: true });
    huerfanas.push(d.name);
  } else {
    console.warn(`  ! /blog/${d.name}/ sobra pero tiene mas ficheros (${dentro.join(', ')}): no se toca`);
  }
}
if (huerfanas.length) huerfanas.forEach((h) => console.log(`   · huerfana eliminada: /blog/${h}/`));

console.log(`✓ Blog generado: ${articles.length} artículos + índice + sitemap.xml`);
articles.forEach((a) => console.log(`   /blog/${a.slug}/`));
