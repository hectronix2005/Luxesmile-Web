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

const DEFAULT_CONTENT = {
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
    ctaPrimary: 'Agendar mi cita',
    ctaSecondary: 'Conocer servicios',
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
    mapsEmbed: '',
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
  // repo access
  await githubRequest(`/repos/${cfg.owner}/${cfg.repo}`);
  // contents access
  const branch = cfg.branch || 'main';
  const path = cfg.path || 'assets/data/content.json';
  await githubRequest(`/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${branch}`);
  return true;
}

async function publishContent(data) {
  const cfg = getGithubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('Configura GitHub primero (pestaña Publicación).');
  }
  const branch = cfg.branch || 'main';
  const path = cfg.path || 'assets/data/content.json';
  const apiPath = `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;

  // 1. obtener SHA actual (si existe)
  let sha;
  try {
    const current = await githubRequest(`${apiPath}?ref=${branch}`);
    sha = current.sha;
  } catch (e) {
    if (!/not found/i.test(e.message)) throw e;
  }

  // 2. PUT con contenido nuevo
  const json = JSON.stringify(data, null, 2) + '\n';
  const body = {
    message: `admin: update content (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
    content: utf8ToBase64(json),
    branch,
  };
  if (sha) body.sha = sha;

  const result = await githubRequest(apiPath, { method: 'PUT', body });
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return result;
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
  loadContent,
  publishContent,
  testGithubConnection,
  getGithubConfig,
  setGithubConfig,
  clearGithubConfig,
  getAdminPassword,
  setAdminPassword,
  exportContentJSON,
  importContentJSON,
};
