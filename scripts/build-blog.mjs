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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://luxesmilee.com';
const V = '20260707i'; // cache-bust de CSS

const content = JSON.parse(readFileSync(join(ROOT, 'assets/data/content.json'), 'utf8'));
const brand = content.brand || {};
const contact = content.contact || {};
const blog = content.blog || {};
const articles = (blog.articles || []).filter((a) => a && a.slug);

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

// <head> común
function head({ title, desc, url, image, jsonld }) {
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
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/tailwind.css?v=${V}" />
  <link rel="stylesheet" href="/assets/css/styles.css?v=${V}" />
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;
}

function topbar() {
  return `<body class="blog-body">
  <header class="blog-topbar">
    <a href="/" class="blog-topbar-logo" aria-label="Luxe-Smile inicio">
      <img src="${escAttr(brand.logo)}" alt="Luxe-Smile" />
    </a>
    <a href="/#contacto" class="btn-primary">Agenda tu cita</a>
  </header>`;
}

function footer() {
  const year = String(content.footer?.copyright || '').match(/\d{4}/)?.[0] || '2026';
  return `  <footer class="blog-footer">
    <div class="blog-container">
      <p class="font-serif blog-footer-brand">Luxe-Smile</p>
      <p class="blog-footer-meta">${escText(brand.doctor || '')} · ${escText(contact.address || '')}</p>
      <p class="blog-footer-links"><a href="/">Inicio</a> · <a href="/blog/">Blog</a> · <a href="/#servicios">Servicios</a> · <a href="/#contacto">Contacto</a></p>
      <p class="blog-footer-copy">© ${year} Luxe-Smile. Todos los derechos reservados.</p>
    </div>
  </footer>
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
  const title = `${a.title} | Luxe-Smile Bogotá`;
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
      dateModified: a.date,
      keywords: a.keywords || '',
      inLanguage: 'es-CO',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
        { '@type': 'ListItem', position: 3, name: a.title, item: url },
      ],
    },
  ];

  return `${head({ title, desc, url, image: a.image, jsonld })}
${topbar()}
  <main class="blog-container blog-article">
    <nav class="blog-breadcrumb" aria-label="Ruta de navegación">
      <a href="/">Inicio</a> <span>›</span> <a href="/blog/">Blog</a> <span>›</span> <span class="current">${escText(a.title)}</span>
    </nav>
    <article>
      <p class="blog-eyebrow">${escText(a.category || '')}${a.readTime ? ' · ' + escText(a.readTime) : ''}</p>
      <h1 class="font-serif blog-h1">${escText(a.title)}</h1>
      <p class="blog-byline">${escText(a.author || brand.doctor || '')} · <time datetime="${escAttr(a.date)}">${escText(fmtDate(a.date))}</time></p>
      <img class="blog-hero-img" src="${escAttr(a.image)}" alt="${escAttr(a.title)}" width="1200" height="675" />
      <div class="article-body">${a.content || ''}</div>
      <div class="blog-cta">
        <p class="font-serif">¿Lista para tu nueva sonrisa?</p>
        <p>Agenda una valoración con la ${escText(brand.doctor || 'Dra. Angela Barbosa')} en nuestro consultorio de Chapinero, Bogotá.</p>
        <div class="blog-cta-actions">
          <a href="${escAttr(waLink)}" target="_blank" rel="noopener" class="btn-primary">Agenda por WhatsApp</a>
          <a href="/#contacto" class="btn-ghost">Ver contacto</a>
        </div>
      </div>
    </article>${relatedList(a)}
  </main>
${footer()}`;
}

function indexPage() {
  const url = `${SITE}/blog/`;
  const title = `Blog de Odontología Estética | Luxe-Smile Bogotá`;
  const desc = blog.subtitle || 'Consejos, técnicas y tendencias en diseño de sonrisa, carillas y estética dental en Bogotá.';
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
          <p class="blog-index-excerpt">${escText(a.excerpt || '')}</p>
        </a>`,
    )
    .join('\n');

  return `${head({ title, desc, url, image: articles[0]?.image, jsonld })}
${topbar()}
  <main class="blog-container blog-index">
    <nav class="blog-breadcrumb" aria-label="Ruta de navegación">
      <a href="/">Inicio</a> <span>›</span> <span class="current">Blog</span>
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
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'monthly' },
    { loc: `${SITE}/diseno-de-sonrisa/`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${SITE}/en/smile-design/`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${SITE}/blog/`, priority: '0.7', changefreq: 'weekly' },
    ...articles.map((a) => ({
      loc: `${SITE}/blog/${a.slug}/`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: a.date,
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
  const dir = join(ROOT, 'blog', a.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), articlePage(a));
}
mkdirSync(join(ROOT, 'blog'), { recursive: true });
writeFileSync(join(ROOT, 'blog', 'index.html'), indexPage());
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap());

console.log(`✓ Blog generado: ${articles.length} artículos + índice + sitemap.xml`);
articles.forEach((a) => console.log(`   /blog/${a.slug}/`));
