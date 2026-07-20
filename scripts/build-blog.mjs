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
const V = '20260707j'; // cache-bust de CSS
const VJS = '20260718a'; // cache-bust de tracking.js (mantener en sync con index/landings)

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
  <!-- Seguimiento de conversiones (GA4 + Google Ads + Meta Pixel). Editar los IDs en assets/js/tracking.js -->
  <script src="/assets/js/tracking.js?v=${VJS}"></script>
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
    { loc: `${SITE}/pacientes-internacionales/`, priority: '0.8', changefreq: 'monthly' },
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
