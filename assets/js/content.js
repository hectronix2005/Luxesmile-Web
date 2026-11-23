/* =====================================================================
   Luxe Smile · Contenido por defecto + capa de persistencia
   --------------------------------------------------------------------
   Fuente de verdad pública: assets/data/content.json (en el repo).
   Se cambia con commits a main (el panel admin se retiró el 23-nov-2026).
   DEFAULT_CONTENT actúa como fallback si el fetch falla.
   ===================================================================== */

const CACHE_KEY = 'luxesmile_cache_v2';         // snapshot del último fetch (offline fallback)

/* El panel admin (retirado el 23-nov-2026) guardaba en el localStorage de cada
   navegador un token de GitHub con permiso de escritura y la contraseña del
   panel. Borrar el código no los borra de los navegadores donde se configuró:
   esto los quita en cuanto ese navegador vuelve a abrir cualquier página. */
try {
  localStorage.removeItem('luxesmile_gh_config_v1');
  localStorage.removeItem('luxesmile_admin_pw_v1');
  localStorage.removeItem('luxesmile_ga_client_id');
  localStorage.removeItem('luxesmile_ga_property_id');
  sessionStorage.removeItem('luxesmile_admin_ok');
} catch (e) {}

// URL del JSON resuelta relativa a este script (funciona desde cualquier carpeta)
const SCRIPT_URL = document.currentScript ? document.currentScript.src : null;
const CONTENT_URL = SCRIPT_URL
  ? new URL('../data/content.json', SCRIPT_URL).href
  : 'assets/data/content.json';

/* =========================================================
   Temas (presets de color)
   Cada preset guarda colores en hex. applyTheme() los inyecta
   como CSS vars (hex + triplet RGB) para que tanto las reglas
   de styles.css como las clases Tailwind con opacidad (/50,
   /80, etc.) se actualicen en vivo.
   ========================================================= */
const THEME_PRESETS = [
  {
    id: 'rosegold',
    name: 'Rosé Doré',
    description: 'El clásico luxe: rose gold sobre marfil.',
    colors: {
      ivory: '#FAF7F2', porcelain: '#F5EFE7',
      rosegold: '#B76E79', rosegoldDark: '#8F4F5A',
      gold: '#C9A770', charcoal: '#1F1B1A', softblack: '#2B2523',
    },
  },
  {
    id: 'nude',
    name: 'Nude Minimal',
    description: 'Terracota y beige, cálido y moderno.',
    colors: {
      ivory: '#FCF8F2', porcelain: '#F2EADE',
      rosegold: '#C77F64', rosegoldDark: '#96583E',
      gold: '#D4AF8B', charcoal: '#2D231E', softblack: '#3C2D26',
    },
  },
  {
    id: 'emerald',
    name: 'Esmeralda Lujo',
    description: 'Verde esmeralda con acentos bronce.',
    colors: {
      ivory: '#F9F6F0', porcelain: '#EDE7DA',
      rosegold: '#24634D', rosegoldDark: '#164433',
      gold: '#C09546', charcoal: '#151A17', softblack: '#1F2420',
    },
  },
  {
    id: 'pearl',
    name: 'Azul Perla',
    description: 'Azul profundo, silver y perla. Fresco y clínico.',
    colors: {
      ivory: '#F7F8FA', porcelain: '#E7ECF2',
      rosegold: '#2E5476', rosegoldDark: '#1F3A57',
      gold: '#9CA9B7', charcoal: '#161C26', softblack: '#202630',
    },
  },
  {
    id: 'noir',
    name: 'Noir Doré',
    description: 'Negro mate con dorado vivo. Alta gama.',
    colors: {
      ivory: '#F8F4EC', porcelain: '#EAE4D7',
      rosegold: '#B68D40', rosegoldDark: '#8C6C2F',
      gold: '#D9B773', charcoal: '#0F0F0F', softblack: '#1C1C1C',
    },
  },
  {
    id: 'blush',
    name: 'Blush Romance',
    description: 'Rosas suaves y mauve. Muy femenino.',
    colors: {
      ivory: '#FDF9F7', porcelain: '#F7EAE8',
      rosegold: '#C08491', rosegoldDark: '#945A69',
      gold: '#D4AF9B', charcoal: '#2D1E26', softblack: '#3C2A34',
    },
  },
];

function hexToRgbTriplet(hex) {
  const h = (hex || '').replace('#', '').trim();
  if (h.length !== 6) return '0 0 0';
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return '0 0 0';
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function applyTheme(theme) {
  if (!theme || !theme.colors) return;
  const root = document.documentElement;
  const c = theme.colors;
  const set = (name, hex) => {
    if (!hex) return;
    root.style.setProperty(`--${name}`, hex);
    root.style.setProperty(`--${name}-rgb`, hexToRgbTriplet(hex));
  };
  set('ivory', c.ivory);
  set('porcelain', c.porcelain);
  set('rosegold', c.rosegold);
  set('rosegold-dark', c.rosegoldDark);
  set('gold', c.gold);
  set('charcoal', c.charcoal);
  set('softblack', c.softblack);
}

const DEFAULT_CONTENT = {
  theme: {
    presetId: 'rosegold',
    colors: { ...THEME_PRESETS[0].colors },
  },
  brand: {
    // GENERADO por scripts/sync-fuentes.mjs desde content.json. No editar a mano:
    // Alpine pinta esto ANTES de cargar content.json; si difiere, la página salta.
    name: "Luxe Smile",
    tagline: "Odontología estética de alta gama !!",
    doctor: "Dra. Angela Barbosa Gómez",
    logo: "/assets/img/content/logo-90f38edf4736.webp",
    logoWidth: 1399,
    logoHeight: 300,
  },
  reviews: {
    // URL para que el visitante deje reseña en Google (se obtiene desde Google Business Profile
    // o construyendo "https://search.google.com/local/writereview?placeid=PLACE_ID").
    googleReviewUrl: '',
    // ID del widget de Elfsight (Google Reviews) — solo el UUID, sin el div completo.
    elfsightWidgetId: '',
  },
  nav: [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Sobre mí', href: '#sobre' },
    { label: 'Servicios', href: '#servicios' },
    { label: 'Galería', href: '#galeria' },
    { label: 'Testimonios', href: '#testimonios' },
    { label: 'Internacionales', href: '/pacientes-internacionales/' },
    { label: 'Contacto', href: '#contacto' },
  ],
  hero: {
    // GENERADO por scripts/sync-fuentes.mjs: content.json fusionado sobre lo que había.
    // Alpine pinta esto ANTES de cargar content.json; no editar a mano.
    "eyebrow": "Odontología estética · Diseño de sonrisa",
    "title": "La sonrisa que imaginas, \ncomienza aqui. ",
    "subtitle": "Creamos sonrisas naturales y armónicas con tecnología de vanguardia y un trato íntimo, cálido y personalizado.",
    "ctaPrimary": "Agenda tu cita",
    "ctaSecondary": "Contáctanos",
    "supportLine": "Primera valoración sin costo · Cupos limitados",
    "image": "/assets/img/content/hero-1b766ff0825b.webp",
    "imageWidth": 1280,
    "imageHeight": 817,
  },
  about: {
    // GENERADO por scripts/sync-fuentes.mjs: content.json fusionado sobre lo que había.
    // Alpine pinta esto ANTES de cargar content.json; no editar a mano.
    "title": "Dra. Angela Barbosa Gómez",
    "subtitle": "Especialista en Rehabilitación Oral y Estética · +10 años",
    "text": "Con más de una década transformando sonrisas, la Dra. Angela combina ciencia, arte y detalle. Cada paciente recibe un plan de tratamiento único, pensado para resaltar su rostro, cuidar su salud oral y devolverle la confianza de sonreír sin límites.",
    "credentials": ["Odontóloga Especialista en Prostodoncia Colegio Odontológico Colombiano","Entrenamiento avanzado en carillas de porcelana","Miembro activo de la Sociedad Colombiana de Prostodoncia ","Docente Universitario Colegio Odontologico Colombiano Unicoc "],
    "image": "/assets/img/content/about-48c2420dd2ec.webp",
    "imageWidth": 732,
    "imageHeight": 823,
  },
  services: [
    { icon: '✦', title: 'Diseño de Sonrisa', desc: 'Planificación digital personalizada para lograr una sonrisa natural.' },
    { icon: '◈', title: 'Carillas de Porcelana', desc: 'Carillas ultrafinas que corrigen forma, color y alineación.' },
    { icon: '❋', title: 'Blanqueamiento Premium', desc: 'Tratamiento en consultorio con geles de última generación.' },
    { icon: '◇', title: 'Ortodoncia Invisible', desc: 'Alineadores transparentes removibles.' },
    { icon: '✧', title: 'Implantes Dentales', desc: 'Implantes de titanio de grado médico.' },
    { icon: '❖', title: 'Odontología Preventiva', desc: 'Profilaxis, detartraje y control periódico.' },
  ],
  gallery: [],
  testimonials: [],
  stats: [
    { value: '+1.200', label: 'Sonrisas transformadas' },
    { value: '+10', label: 'Años de experiencia' },
    { value: '100%', label: 'Casos planificados digitalmente' },
    { value: '5.0', label: 'Calificación promedio' },
  ],
  contact: {
    // GENERADO por scripts/sync-fuentes.mjs desde content.json. No editar a mano:
    // es el fallback que ve quien entra si el fetch de content.json falla.
    whatsapp: "+57 3163903511",
    whatsappMessage: "Hola Dra. Angela, me gustaría agendar una cita con usted en Luxe Smile.",
    phone: "+57 3163903511",
    email: "consultoriosespecialistasinspi@gmail.com",
    address: "Cl. 90 #14-16, Consultorio 508 · Chico, Chapinero · Bogotá",
    hours: "Lun a Vie · 8:00 am – 6:00 pm\nSábados · 9:00 am – 1:00 pm",
    mapsEmbed: "https://maps.google.com/maps?q=Dra%20Angela%20Barbosa%20Rehabilitaci%C3%B3n%20oral%20y%20Est%C3%A9tica&ll=4.6742261,-74.0524029&z=17&hl=es&output=embed",
    calendar: "https://calendly.com/consultoriosespecialistasinspi/1-hora",
    calendarOffice: "https://calendar.app.google/Cbrw5xtAuiNHf63S7",
    instagram: "https://www.instagram.com/luxesmilee_?igsh=YTIyZ2Uwb3prOW9x",
    facebook: "",
    tiktok: "",
  },
  footer: {
    tagline: 'Odontología estética con alma. Sonrisas hechas a medida.',
    copyright: '© 2026 Luxe Smile · Dra. Angela Barbosa. Todos los derechos reservados.',
  },
  // El admin enlaza content.blog.title con x-model, y x-show no impide que Alpine
  // evalúe la expresión: sin esta clave, si el fetch de content.json falla, la
  // pestaña de blog lanza en cada render. Mismas claves que content.json.
  blog: {
    title: 'Blog de Odontología Estética',
    subtitle: 'Consejos, técnicas y tendencias en diseño de sonrisa',
    articles: [],
  },
};

/* --------------------- Merge profundo --------------------- */
function deepMerge(base, override) {
  if (Array.isArray(override)) return override.slice();
  if (override && typeof override === 'object') {
    const out = { ...base };
    for (const k of Object.keys(override)) {
      out[k] = deepMerge(base ? base[k] : undefined, override[k]);
    }
    return out;
  }
  return override !== undefined ? override : base;
}

/* --------------------- Fade-in de secciones --------------------- */
/* Vivía copiada cuatro veces —app.js y las tres páginas autocontenidas— byte a
   byte idéntica. Cuatro copias de la misma lógica son cuatro sitios donde
   arreglar el mismo fallo, y el cuarto siempre se olvida. Aquí sólo hay una.
   La RED de seguridad sigue inline en cada página a propósito, porque tiene que
   sobrevivir a que este fichero no cargue; esto no: sin content.js la página no
   tiene contenido que revelar. */
function revelarAlEntrar() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
}

/* --------------------- Reseñas de Google (Elfsight) --------------------- */
/* El inicio y las cuatro landings de servicio muestran el mismo carrusel de
   Elfsight. Hasta el 22-nov-2026 las landings pintaban una lista fija de
   content.json que nadie actualizaba desde abril —la doctora veía «los mismos
   comentarios de siempre»—, con una reseña que ni siquiera estaba en Google.
   platform.js se inyecta solo cuando la sección se acerca a la pantalla: cada
   carga del widget gasta vistas del plan gratuito, y si se agotan el widget
   deja de verse en TODAS las páginas. */
function cargarResenas(content, seccion) {
  if (!content?.reviews?.elfsightWidgetId) return;
  const inject = () => {
    if (document.querySelector('script[data-elfsight-platform]')) return;
    const s = document.createElement('script');
    s.src = 'https://static.elfsight.com/platform/platform.js';
    s.defer = true;
    s.setAttribute('data-elfsight-platform', '');
    document.head.appendChild(s);
  };
  if (!seccion || !('IntersectionObserver' in window)) { inject(); return; }
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { obs.disconnect(); inject(); }
  }, { rootMargin: '200px' });
  obs.observe(seccion);
}

/* --------------------- Carga de contenido --------------------- */
async function fetchRemoteContent() {
  const url = `${CONTENT_URL}?v=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function loadContent() {
  const defaults = structuredClone(DEFAULT_CONTENT);
  try {
    const remote = await fetchRemoteContent();
    // Guardar en caché es una comodidad, no un requisito. Estaba dentro del try
    // grande: si localStorage se quedaba sin sitio —y se queda, porque entre que
    // el admin publica y el Action convierte las imágenes, content.json lleva los
    // base64 dentro— el setItem lanzaba, lo cazaba el catch de abajo y una
    // descarga que había ido PERFECTA acababa sirviendo la copia vieja.
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(remote)); }
    catch (e) { avisar('cache_no_cabe', String(e && e.name || e)); }
    return deepMerge(defaults, remote);
  } catch (e) {
    console.warn('No se pudo obtener content.json remoto, intentando caché local.', e);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) { avisar('contenido_desde_cache', String(e && e.message || e)); return deepMerge(defaults, cached); }
    } catch {}
    // Éste es el caso malo: ni red ni caché, o sea primera visita con un
    // tropiezo. Hasta el 17-sep-2026 aquí se servían datos de plantilla y el
    // botón de WhatsApp llevaba a un número que no era el de la doctora. Ya
    // no, pero que ocurra sigue siendo un fallo y hasta hoy NO SE REGISTRABA
    // EN NINGUNA PARTE: sólo un console.warn que no sale del navegador. Un
    // fallo que no deja rastro es un fallo que nadie descubre.
    avisar('contenido_fallback', String(e && e.message || e));
    return defaults;
  }
}

/* Mismo patrón que `degradar()` en tracking.js: si gtag no está —porque el
   fichero no cargó, o lo bloqueó una extensión, o esto corre en el admin— no
   pasa nada. Perder el aviso no puede costar la carga de la página. */
function avisar(evento, motivo) {
  try { console.warn('[luxe] ' + evento + ': ' + motivo); } catch (e) {}
  try { if (window.gtag) window.gtag('event', evento, { motivo: motivo }); } catch (e) {}
}

window.LuxeContent = {
  CONTENT_URL,
  DEFAULT_CONTENT,
  THEME_PRESETS,
  applyTheme,
  hexToRgbTriplet,
  loadContent,
  deepMerge,
  revelarAlEntrar,
  cargarResenas,
};

/* Aplica tema desde cache local al instante, antes de que Alpine inicialice,
   para evitar flash de colores. Si falla, quedan los defaults del :root. */
try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached?.theme) applyTheme(cached.theme);
} catch {}
