/* =====================================================================
   Luxe-Smile · Contenido por defecto + capa de persistencia
   --------------------------------------------------------------------
   Fuente de verdad pública: assets/data/content.json (en el repo).
   El admin commitea ese archivo vía GitHub API para publicar cambios.
   DEFAULT_CONTENT actúa como fallback si el fetch falla.
   ===================================================================== */

const CACHE_KEY = 'luxesmile_cache_v2';         // snapshot del último fetch (offline fallback)
const GH_CFG_KEY = 'luxesmile_gh_config_v1';    // config de GitHub API (token + repo)
const ADMIN_PW_KEY = 'luxesmile_admin_pw_v1';   // contraseña del panel (por navegador)
const DEFAULT_PASSWORD = 'luxe2026';

// URL del JSON resuelta relativa a este script (funciona desde / y desde /admin/)
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
    name: 'Luxe-Smile',
    tagline: 'Odontología estética de alta gama',
    doctor: 'Dra. Angela Barbosa',
  },
  nav: [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Sobre mí', href: '#sobre' },
    { label: 'Servicios', href: '#servicios' },
    { label: 'Galería', href: '#galeria' },
    { label: 'Testimonios', href: '#testimonios' },
    { label: 'Contacto', href: '#contacto' },
  ],
  hero: {
    eyebrow: 'Odontología estética · Diseño de sonrisa',
    title: 'Tu sonrisa,\nnuestra obra de arte.',
    subtitle:
      'Creamos sonrisas naturales y armónicas con tecnología de vanguardia y un trato íntimo, cálido y personalizado.',
    ctaPrimary: 'Agenda tu cita',     // botón principal → calendario (contact.calendar)
    ctaSecondary: 'Contáctanos',      // botón secundario → WhatsApp
    image:
      'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1400&q=80',
  },
  about: {
    title: 'Dra. Angela Barbosa',
    subtitle: 'Directora clínica · Luxe-Smile',
    text:
      'Con más de una década transformando sonrisas, la Dra. Angela combina ciencia, arte y detalle. Cada paciente recibe un plan de tratamiento único, pensado para resaltar su rostro, cuidar su salud oral y devolverle la confianza de sonreír sin límites.',
    credentials: [
      'Odontóloga · Universidad Nacional',
      'Especialista en Estética Dental y Diseño de Sonrisa',
      'Entrenamiento avanzado en carillas de porcelana',
      'Miembro activo de la Sociedad Colombiana de Odontología Estética',
    ],
    image:
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80',
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
    whatsapp: '573001234567',
    whatsappMessage: 'Hola Dra. Angela, me gustaría agendar una cita en Luxe-Smile.',
    phone: '+57 300 123 4567',
    email: 'contacto@luxe-smile.com',
    address: 'Calle 123 #45-67, Consultorio 802, Bogotá',
    hours: 'Lun a Vie · 8:00 am – 6:00 pm\nSábados · 9:00 am – 1:00 pm',
    mapsEmbed: '', // Pega aquí el src del iframe desde Google Maps → Compartir → Insertar mapa
    calendar: 'https://calendar.app.google/xvX6k3Zy4tsACvCr7', // link público de Google Calendar appointments
    instagram: '',
    facebook: '',
    tiktok: '',
  },
  footer: {
    tagline: 'Odontología estética con alma. Sonrisas hechas a medida.',
    copyright: '© 2026 Luxe-Smile · Dra. Angela Barbosa. Todos los derechos reservados.',
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
    localStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    return deepMerge(defaults, remote);
  } catch (e) {
    console.warn('No se pudo obtener content.json remoto, intentando caché local.', e);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) return deepMerge(defaults, cached);
    } catch {}
    return defaults;
  }
}

/* --------------------- Config GitHub API --------------------- */
function getGithubConfig() {
  try {
    return JSON.parse(localStorage.getItem(GH_CFG_KEY) || '{}');
  } catch {
    return {};
  }
}
function setGithubConfig(cfg) {
  localStorage.setItem(GH_CFG_KEY, JSON.stringify(cfg));
}
function clearGithubConfig() {
  localStorage.removeItem(GH_CFG_KEY);
}

/* --------------------- Publicación vía GitHub API --------------------- */
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function githubRequest(path, opts = {}) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('Falta el token de GitHub.');
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(opts.headers || {}),
  };
  if (opts.body && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`https://api.github.com${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function testGithubConnection() {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo) throw new Error('Completa owner y repo.');
  await githubRequest(`/repos/${cfg.owner}/${cfg.repo}`);
  const branch = cfg.branch || 'main';
  const path = cfg.path || 'assets/data/content.json';
  await githubRequest(`/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${branch}`);
  return true;
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

// Lee content.json directamente del repo vía API (siempre fresco, sin pasar por el CDN de Pages).
// Devuelve { data, sha } para permitir detección de conflictos al publicar.
async function fetchContentViaAPI() {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo) throw new Error('Falta configuración de GitHub.');
  const branch = cfg.branch || 'main';
  const path = cfg.path || 'assets/data/content.json';
  const res = await githubRequest(
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`,
  );
  const json = base64ToUtf8(res.content);
  return { data: JSON.parse(json), sha: res.sha };
}

async function publishContent(data, expectedSha) {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('Configura GitHub primero (pestaña Publicación).');
  }
  const branch = cfg.branch || 'main';
  const path = cfg.path || 'assets/data/content.json';
  const apiPath = `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;

  // SHA actual en el repo
  let currentSha;
  try {
    const current = await githubRequest(`${apiPath}?ref=${branch}`);
    currentSha = current.sha;
  } catch (e) {
    if (!/not found/i.test(e.message)) throw e;
  }

  // Detección de conflicto: si cargamos el admin con sha X pero el repo ahora está en Y,
  // otra sesión cambió algo. No pisamos sin avisar.
  if (expectedSha && currentSha && currentSha !== expectedSha) {
    const err = new Error(
      'El contenido en GitHub cambió desde que abriste el panel. ' +
      'Pulsa "Recargar desde repo" para ver los cambios nuevos y vuelve a aplicar los tuyos.',
    );
    err.code = 'STALE';
    throw err;
  }

  const json = JSON.stringify(data, null, 2) + '\n';
  const body = {
    message: `admin: update content (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
    content: utf8ToBase64(json),
    branch,
  };
  if (currentSha) body.sha = currentSha;

  const result = await githubRequest(apiPath, { method: 'PUT', body });
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return { result, newSha: result?.content?.sha };
}

/* --------------------- Contraseña admin --------------------- */
function getAdminPassword() {
  return localStorage.getItem(ADMIN_PW_KEY) || DEFAULT_PASSWORD;
}
function setAdminPassword(pw) {
  localStorage.setItem(ADMIN_PW_KEY, pw);
}

/* --------------------- Export / Import JSON --------------------- */
function exportContentJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `luxesmile-contenido-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importContentJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

window.LuxeContent = {
  CONTENT_URL,
  DEFAULT_CONTENT,
  THEME_PRESETS,
  applyTheme,
  hexToRgbTriplet,
  loadContent,
  fetchContentViaAPI,
  publishContent,
  testGithubConnection,
  getGithubConfig,
  setGithubConfig,
  clearGithubConfig,
  getAdminPassword,
  setAdminPassword,
  exportContentJSON,
  importContentJSON,
  deepMerge,
};

/* Aplica tema desde cache local al instante, antes de que Alpine inicialice,
   para evitar flash de colores. Si falla, quedan los defaults del :root. */
try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached?.theme) applyTheme(cached.theme);
} catch {}
