#!/usr/bin/env node
/* ENRUTADO A WHATSAPP: comprobación de la JUNTA, no de las piezas.
 *
 * El 14-sep-2026 el enrutado a Zeus salió a producción sin cubrir el home: sus
 * 9 enlaces no casaban con ninguna clave del diccionario. Se hicieron dos
 * comprobaciones y las dos pasaron — Zeus verificó que su diccionario responde
 * a peticiones reales; yo verifiqué que el `tracking.js` nuevo se sirve en
 * producción. Ninguna de las dos mira lo único que importaba: si algún botón
 * del sitio llama de verdad a una clave que existe.
 *
 * El fallo no se ve desde ningún extremo, porque el síntoma de la junta rota es
 * un botón que funciona: el paciente llega a WhatsApp con el mensaje correcto y
 * sólo falta la atribución, en silencio. Lo que lo causó tampoco fue un error de
 * código: fue que el home usa `app.js` —su propia copia de `waLink`, la cuarta—
 * y compone los textos al renderizar, así que no aparecen en el HTML de donde
 * salió el diccionario.
 *
 * Por eso el bloque 3 no comprueba textos: comprueba que ninguna página con
 * enlaces a WhatsApp se quede sin mecanismo declarado. Es el fallo que hubo.
 *
 *   node scripts/test-enrutado.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const R = 'https://zeus.codi.com.co/6a7aa5453a2a5ee4405a7a6c/wa';
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FALLO'}  ${m}`); if (!c) fallos++; };

// ── stubs mínimos, comunes a los dos ficheros ──────────────────────────────
function documentoFalso(listeners) {
  return {
    addEventListener: (ev, fn) => listeners.push([ev, fn]),
    readyState: 'complete', referrer: '',
    querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, parentNode: { insertBefore() {} } }),
    getElementsByTagName: () => [{ parentNode: { insertBefore() {} }, appendChild() {} }],
    body: { setAttribute() {}, appendChild() {} }, head: { appendChild() {} },
  };
}

// Doble de un <a>: además del href necesita atributos, porque tracking.js MARCA
// el enlace antes de reescribirlo (después ya no se sabe que era de WhatsApp) y
// el listener de conversiones busca esa marca. Sin setAttribute, la reescritura
// lanza dentro de su propio try y el enlace se queda en wa.me sin decir nada.
function enlaceFalso(href) {
  return {
    href,
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
  };
}

function cargarTracking(clic, opciones) {
  const o = opciones || {};
  const store = new Map();
  if (clic) store.set('lx_clic', JSON.stringify({ id: clic.id, tipo: clic.tipo, t: Date.now() }));
  const listeners = [];
  const enlaces = (o.enlaces || []).map(enlaceFalso);
  const ctx = {
    console: o.callado ? { warn() {}, log() {}, error() {} } : console,
    URL, URLSearchParams, Date, JSON, Math, setTimeout, clearTimeout, Promise,
    location: { search: '', hostname: 'luxesmilee.com', href: 'https://luxesmilee.com/' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k),
    },
    document: { ...documentoFalso(listeners), querySelectorAll: () => enlaces },
    navigator: { userAgent: 'node' },
  };
  // La sonda de salud, gobernada desde fuera para poder probar los desenlaces.
  if (o.sonda && o.sonda !== 'ausente') {
    ctx.fetch = () => {
      if (o.sonda === 'red') return Promise.reject(new Error('sin red'));
      if (o.sonda === 'http500') return Promise.resolve({ ok: false, status: 500 });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(o.sonda) });
    };
  }
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('assets/js/tracking.js', 'utf8'), ctx);
  return { ctx, listeners, enlaces };
}

/** Deja correr las microtareas de la sonda antes de mirar el resultado. */
const asentar = () => new Promise((r) => setTimeout(r, 0));

function cargarApp({ conRuta, mensaje }) {
  let comp = null, init = null;
  const ctx = {
    console, structuredClone, URLSearchParams, Date, JSON, Math, Promise, setTimeout, clearTimeout,
    Alpine: { data: (_n, f) => { comp = f(); } },
    IntersectionObserver: class { observe() {} disconnect() {} },
    location: { search: '', hostname: 'luxesmilee.com' },
    document: { ...documentoFalso([]), addEventListener: (ev, fn) => { if (ev === 'alpine:init') init = fn; } },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.window.LuxeContent = { DEFAULT_CONTENT: { contact: {} }, loadContent: async () => ({}) };
  if (conRuta) ctx.window.lxRuta = (c) => (c ? `${R}?m=${c}` : null);
  vm.createContext(ctx);
  vm.runInContext(readFileSync('assets/js/app.js', 'utf8'), ctx);
  init();
  comp.content = { contact: { whatsapp: '573163903511',
    whatsappMessage: mensaje || 'Hola Dra. Angela, me gustaría agendar una cita con usted en Luxe-Smile.' } };
  return comp;
}

// ── 1. la ruta se compone bien, y sabe NO componerse ───────────────────────
console.log('\n1. lxRuta');
{
  const { ctx } = cargarTracking(null);
  ok(typeof ctx.lxRuta === 'function', 'queda expuesta en window');
  ok(ctx.lxRuta('home_casos') === `${R}?m=home_casos`, 'clave sola -> ?m=home_casos');
  // El negativo importa tanto como el positivo: si devolviera algo para una
  // clave vacía, el llamante enrutaría a ciegas en vez de caer a wa.me.
  ok(ctx.lxRuta(null) === null && ctx.lxRuta(undefined) === null, 'sin clave -> null');

  const g = cargarTracking({ id: 'Cj0KCQ_ABC', tipo: 'g' }).ctx.lxRuta('home_virtual');
  ok(g.includes('m=home_virtual') && g.includes('g=Cj0KCQ_ABC') && g.includes('t=gclid'), 'con gclid -> clave + id + t=gclid');
  ok(cargarTracking({ id: 'x', tipo: 'w' }).ctx.lxRuta('home_info').includes('t=wbraid'), 'iOS -> t=wbraid, su propio campo');
}

// ── 2. el home enruta los seis, y degrada al wa.me de siempre ──────────────
console.log('\n2. waLink del home (app.js)');
{
  const ESPERADO = { hero: 'home_info', casos: 'home_casos', contacto: 'home_contacto',
    virtual: 'home_virtual', consultorio: 'home_consultorio', undefined: 'home_general' };
  const con = cargarApp({ conRuta: true });
  for (const [c, clave] of Object.entries(ESPERADO)) {
    const ctxArg = c === 'undefined' ? undefined : c;
    ok(con.waLink(ctxArg).includes(`m=${clave}`), `${c.padEnd(12)} -> m=${clave}`);
  }
  // Si tracking.js no cargó, el botón tiene que seguir funcionando SIN atribución.
  // Perder una atribución es barato; dejar a un paciente sin WhatsApp, no.
  const sin = cargarApp({ conRuta: false });
  ok(Object.keys(ESPERADO).every((c) => sin.waLink(c === 'undefined' ? undefined : c).startsWith('https://wa.me/')),
    'sin tracking.js: los seis caen a wa.me');
  ok(decodeURIComponent(sin.waLink('virtual').split('text=')[1])
    === 'Hola Dra. Angela, me gustaría agendar una cita de forma virtual con usted en Luxe-Smile.',
    'y con el texto de reserva intacto');

  // LA DOCTORA EDITA EL MENSAJE Y DEJA DE DECIR «una cita».
  // `whatsappMessage` es un <input> del panel, y los mensajes de virtual y
  // presencial se construían con un `.replace('una cita', …)`. Si el texto deja
  // de contener esa frase, el replace no muerde y los dos salen IDÉNTICOS al
  // genérico: ella deja de saber si el paciente pedía virtual o presencial, el
  // botón sigue abriendo WhatsApp y nada falla en voz alta.
  const texto = (c, comp) => decodeURIComponent(comp.waLink(c).split('text=')[1]);
  const otro = cargarApp({ conRuta: false, mensaje: 'Hola, quiero agendar mi valoración.' });
  const v = texto('virtual', otro), o = texto('consultorio', otro), g = texto(undefined, otro);
  ok(v !== g && o !== g, 'mensaje editado sin «una cita»: virtual y presencial NO caen en el genérico');
  ok(v !== o, 'y siguen siendo distintos entre sí');
  ok(v.includes('de forma virtual'), `virtual lo dice igual ("${v}")`);
  ok(o.includes('presencial en el consultorio'), `presencial lo dice igual ("${o}")`);
}

// ── 3. NINGUNA PÁGINA SE QUEDA SIN MECANISMO ───────────────────────────────
// Esto es lo que falló. No se rompió nada: apareció una página cuyo mecanismo
// nadie había mirado. El test no valida el mecanismo — valida que esté DICHO.
console.log('\n3. cobertura: toda página con enlaces a WhatsApp tiene mecanismo declarado');
{
  const MECANISMO = {
    'index.html': 'contexto (app.js -> lxRuta)',
    'diseno-de-sonrisa/index.html': 'texto literal -> web / web_virtual / web_consultorio',
    'pacientes-internacionales/index.html': 'texto literal -> internacional',
    'en/smile-design/index.html': 'texto literal -> smile_design_en',
    'blog/index.html': 'texto literal -> valoracion',
    // Se añadió el 17-sep-2026, cuando este test se enganchó a `npm test` y se
    // ejecutó por primera vez desde que se escribió. Sí enruta: carga tracking.js
    // y su texto casa exacto con la clave. Sólo faltaba estar declarada.
    'privacidad/index.html': 'texto literal -> valoracion',
    'wa/index.html': 'puente propio: compone el wa.me él mismo, no pasa por el diccionario',
  };
  const ES_BLOG_GENERADO = (f) => f.startsWith('blog/') && f !== 'blog/index.html';

  const htmls = [];
  (function andar(dir) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.git' || e === 'admin') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) andar(p);
      else if (e.endsWith('.html')) htmls.push(p.replace(/^\.\//, ''));
    }
  })('.');

  const conWa = htmls.filter((f) => {
    const s = readFileSync(f, 'utf8');
    return /wa\.me\/\d/.test(s) || /waLink\(/.test(s);
  });

  for (const f of conWa) {
    if (ES_BLOG_GENERADO(f)) continue;   // los genera build-blog.mjs desde una plantilla única
    ok(MECANISMO[f], `${f}${MECANISMO[f] ? `  — ${MECANISMO[f]}` : '  — SIN MECANISMO DECLARADO: ¿enruta? decláralo aquí'}`);
  }
  for (const f of Object.keys(MECANISMO)) {
    ok(conWa.includes(f), `${f} sigue teniendo enlaces${conWa.includes(f) ? '' : ': la tabla cita una página que ya no los tiene'}`);
  }
  const generadas = conWa.filter(ES_BLOG_GENERADO).length;
  console.log(`  ..    ${generadas} páginas de blog generadas, cubiertas por la plantilla de build-blog.mjs`);
}

// ── 4. LAS PÁGINAS AUTOCONTENIDAS Y EL ORIGEN ──────────────────────────────
// Estas tres llevan su propia `waLink` —cuatro copias en el repo contando la de
// app.js— y hasta el 15-sep ninguna estaba cubierta por este fichero. El caso
// que las rompía: con `utm_source` social y sin `gclid`, `detectSource()` añade
// «(Vengo de Instagram)» al mensaje, el texto deja de casar con el diccionario
// y el enlace se va a wa.me sin registrar nada. En silencio, porque el paciente
// llega igual.
console.log('\n4. páginas autocontenidas: clave + origen')
{
  // Carga el componente Alpine que vive en un <script> inline de la página.
  function cargarPagina(file, { conRuta, search }) {
    const html = readFileSync(file, 'utf8')
    const m = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find((x) => x[1].includes('waLink'))
    if (!m) throw new Error(`sin componente en ${file}`)
    let comp = null, init = null
    const ctx = {
      console, structuredClone, URLSearchParams, Date, JSON, Math, Promise, setTimeout, clearTimeout,
      Alpine: { data: (_n, f) => { comp = f() } },
      IntersectionObserver: class { observe() {} disconnect() {} },
      location: { search: search || '', hostname: 'luxesmilee.com' },
      document: { ...documentoFalso([]), addEventListener: (ev, fn) => { if (ev === 'alpine:init') init = fn } },
    }
    ctx.window = ctx; ctx.globalThis = ctx
    ctx.window.LuxeContent = { DEFAULT_CONTENT: { contact: {} }, loadContent: async () => ({}) }
    // LA `lxRuta` DE VERDAD, NO UN DOBLE. Aqui habia un stub de dos argumentos,
    // `(c, o) => ...`, y por eso este bloque no pudo ver nunca que la firma real
    // habia cambiado a `(clave, reserva, origen)`: el test declaraba el contrato
    // que queria comprobar. Con el doble, pasar `this.origen` en el segundo
    // puesto salia verde; con la funcion real, con la sonda caida, el href se
    // quedaba en la cadena "ig".
    if (conRuta) ctx.window.lxRuta = conRuta
    vm.createContext(ctx)
    vm.runInContext(m[1], ctx)
    if (init) init()
    comp.content = { contact: { whatsapp: '573163903511' } }
    if (comp.detectSource) comp.detectSource()
    return comp
  }

  const ES = 'diseno-de-sonrisa/index.html'
  const EN = 'en/smile-design/index.html'

  // Una `lxRuta` real, con la sonda verde, por cada situacion de clic.
  const SANA4 = { ok: true, numbers: 'ok', messages: 'ok' }
  const rutaReal = async (clic) => {
    const t = cargarTracking(clic || null, { sonda: SANA4, callado: true, enlaces: [] })
    await asentar()
    return t.ctx.lxRuta
  }
  const RUTA = await rutaReal(null)
  const RUTA_G = await rutaReal({ id: 'Cj0ABC', tipo: 'g' })

  // — el caso que estaba roto —
  for (const utm of ['instagram', 'ig', 'meta', 'facebook', 'fb']) {
    const c = cargarPagina(ES, { conRuta: RUTA, search: `?utm_source=${utm}` })
    ok(c.waLink().includes('m=web') && c.waLink().includes('o=ig'), `ES utm_source=${utm.padEnd(9)} -> m=web&o=ig`)
  }
  const g = cargarPagina(ES, { conRuta: RUTA, search: '?utm_source=google' })
  ok(g.waLink().includes('o=google'), 'ES utm_source=google  -> o=google')

  // Con identificador de clic NO se manda origen: el gclid ya identifica, y
  // `detectSource()` hace return antes de fijarlo. Si esto fallara, estaríamos
  // mandando dos veces el mismo dato y uno de los dos podría contradecir al otro.
  const cg = cargarPagina(ES, { conRuta: RUTA_G, search: '?gclid=Cj0ABC&utm_source=instagram' })
  ok(!cg.waLink().includes('o='), 'ES con gclid          -> sin origen (lo identifica el gclid)')

  // Sin utm: enruta igual, sin origen.
  const limpio = cargarPagina(ES, { conRuta: RUTA, search: '' })
  ok(limpio.waLink().includes('m=web') && !limpio.waLink().includes('o='), 'ES sin utm            -> m=web, sin origen')
  ok(limpio.waLink('virtual').includes('m=web_virtual'), 'ES virtual            -> m=web_virtual')
  ok(limpio.waLink('consultorio').includes('m=web_consultorio'), 'ES consultorio        -> m=web_consultorio')

  // — la página en inglés —
  const en = cargarPagina(EN, { conRuta: RUTA, search: '?utm_source=instagram' })
  ok(en.waLink().includes('m=smile_design_en') && en.waLink().includes('o=ig'), 'EN utm_source=instagram -> m=smile_design_en&o=ig')
  // Sus dos variantes NO tienen clave y NO deben enrutarse a la más parecida.
  ok(en.waLink('virtual').startsWith('https://wa.me/'), 'EN virtual            -> wa.me (sin clave, no se inventa)')
  ok(en.waLink('consultorio').startsWith('https://wa.me/'), 'EN consultorio        -> wa.me (sin clave, no se inventa)')

  // — el reserva: sin tracking.js sigue el comportamiento de hoy, coletilla incluida —
  const sin = cargarPagina(ES, { conRuta: null, search: '?utm_source=instagram' })
  const txt = decodeURIComponent(sin.waLink().split('text=')[1])
  ok(sin.waLink().startsWith('https://wa.me/573163903511?text='), 'ES sin tracking.js    -> wa.me con el número correcto')
  ok(txt.includes('(Vengo de Instagram)'), 'ES sin tracking.js    -> conserva la coletilla de hoy')

  // EL CASO QUE ESTABA INVISIBLE: con la sonda CAIDA, el boton tiene que seguir
  // siendo un `wa.me` que funciona. Es el unico dia en que el reserva sirve de
  // algo, y era el unico que no se probaba. Con el origen en el segundo puesto
  // esto devolvia la cadena "ig".
  const caida = cargarTracking(null, { sonda: 'red', callado: true, enlaces: [] })
  await asentar()
  for (const [pag, etq] of [[ES, 'ES'], [EN, 'EN']]) {
    const c = cargarPagina(pag, { conRuta: caida.ctx.lxRuta, search: '?utm_source=instagram' })
    ok(c.waLink().startsWith('https://wa.me/'), `${etq} con la sonda caida  -> wa.me, no una cadena suelta`)
  }
}

// ── 5. EL ENLACE DE RESERVA ────────────────────────────────────────────────
// La condición que puso Héctor al autorizar el enrutado: si la ruta de Zeus cae,
// el paciente tiene que llegar a WhatsApp igual.
//
// Lo que se comprueba aquí no es que funcione cuando todo va bien —eso son los
// bloques 1 y 2— sino que CUANDO ALGO FALLA el href se queda en `wa.me`. Por eso
// hay más casos rojos que verdes: el estado por defecto tiene que ser el que no
// necesita que nada funcione.
console.log('\n5. enlace de reserva');
{
  const SANA = { ok: true, numbers: 'ok', messages: 'ok' };
  const WAME = 'https://wa.me/573163903511?text=Hola';
  const RUTA = `${R}?m=home_info`;

  const prueba = async (sonda, etq, enruta) => {
    const t = cargarTracking(null, { sonda, callado: true, enlaces: [WAME] });
    await asentar();
    const dado = t.ctx.lxRuta('home_info', WAME);
    ok(dado === (enruta ? RUTA : WAME), `${etq.padEnd(33)} -> ${enruta ? 'enruta' : 'wa.me'}`);
    return t;
  };

  // EL INSTANTE QUE IMPORTA: antes de que la sonda conteste. Todos los demás
  // casos miran DESPUÉS de resolverse, y por eso ninguno distingue «empieza en
  // reserva y promueve» de «empieza enrutado y degrada» — que es la decisión de
  // diseño entera. Sin esta comprobación, invertir el valor inicial de `saludOk`
  // dejaba el fichero en verde: medido el 15-sep, 0 fallos.
  {
    const t = cargarTracking(null, { sonda: SANA, callado: true, enlaces: [WAME] });
    // sin `asentar()`: la promesa de la sonda sigue pendiente aquí
    ok(t.ctx.lxRuta('home_info', WAME) === WAME, 'sonda AÚN SIN CONTESTAR           -> wa.me');
  }

  await prueba(SANA, 'sonda sana', true);
  // `numbers: memoria` es amarillo para Zeus y VERDE para nosotros: la lista no
  // se puede releer en vivo, pero los pacientes llegan. Degradar aquí seria
  // perder atribución por un problema que no afecta al paciente.
  await prueba({ ok: true, numbers: 'memoria', messages: 'ok' }, 'numbers=memoria', true);

  // Todo lo demás degrada. `numbers: falta` es el caso que nombró Zeus: el
  // servicio responde 200 y a ESTA clínica le sirve mal.
  await prueba({ ok: true, numbers: 'falta', messages: 'ok' }, 'numbers=falta', false);
  await prueba({ ok: true, numbers: 'ok', messages: 'falta' }, 'messages=falta', false);
  await prueba({ ok: false }, 'ok=false', false);
  await prueba({}, 'cuerpo vacio', false);
  await prueba('http500', 'HTTP 500', false);
  await prueba('red', 'sin red', false);
  await prueba('ausente', 'sin fetch en el navegador', false);

  // LA PROMOCIÓN. Alpine pinta los href DESPUÉS de que corra tracking.js, así
  // que sin esto el home se quedaría en wa.me para siempre aunque la sonda
  // estuviera verde. Se simula lo que hace el observador.
  {
    const t = cargarTracking(null, { sonda: SANA, callado: true, enlaces: [WAME] });
    await asentar();                       // la sonda ya dijo que sí
    t.ctx.lxRuta('home_info', WAME);       // Alpine pinta: registra el par
    ok(t.enlaces[0].href === WAME, 'el enlace recien pintado sigue en wa.me');
    t.ctx.lxPromover();                    // lo que hace el observador
    ok(t.enlaces[0].href === RUTA, `promover() lo sustituye -> ${t.enlaces[0].href.slice(-14)}`);

    // Y NO promueve si la sonda no dijo que sí, que es la mitad que importa:
    // si promoviera igual, el reserva no serviría de nada.
    const malo = cargarTracking(null, { sonda: 'red', callado: true, enlaces: [WAME] });
    await asentar();
    malo.ctx.lxRuta('home_info', WAME);
    malo.ctx.lxPromover();
    ok(malo.enlaces[0].href === WAME, 'con la sonda caida, promover() no toca nada');
  }

  // EL OTRO EXTREMO: la rama por texto —blog y las tres autocontenidas— enruta
  // reescribiendo el href en el clic, así que degradar ahí es NO reescribir.
  for (const [sonda, etq, enruta] of [[SANA, 'sonda sana', true], ['red', 'sonda caida', false]]) {
    const t = cargarTracking({ id: 'Cj0', tipo: 'g' }, { sonda, callado: true });
    await asentar();
    const h = t.listeners.find(([ev]) => ev === 'click')[1];
    const a = enlaceFalso(`https://wa.me/573163903511?text=${encodeURIComponent('Hola, quiero agendar una valoración en Luxe-Smile.')}`);
    h({ target: { closest: (sel) => (sel.includes('wa.me') ? a : null) } });
    ok(enruta ? a.href.startsWith(R) : a.href.includes('wa.me'),
      `handler por texto, ${etq.padEnd(11)} -> ${enruta ? 'enruta' : 'deja wa.me'}`);
  }
}

console.log('\n6. la coletilla no puede salir dos veces');
{
  // Zeus pone la etiqueta de origen —«(Instagram)»— desde una tabla suya al
  // servir el texto de `m=`. Nosotros la ponemos al componer el `wa.me` del
  // reserva. Hoy no pueden coincidir porque `lxRuta` devuelve UNO de los dos,
  // nunca los dos... pero eso es una propiedad que nadie comprueba, y el dia que
  // alguien toque el reserva puede dejar de ser cierta sin hacer ruido: el
  // sintoma seria un paciente escribiendo «...(Instagram) (Instagram)».
  //
  // La invariante que lo impide, y que este bloque fija:
  //   un enlace lleva `m=` (lo redacta Zeus) O lleva `text=` (lo redactamos
  //   nosotros). NUNCA los dos. Si algun dia lleva los dos, hay dos redactores
  //   sobre el mismo mensaje y la coletilla es solo el primer sintoma.
  const SANA = { ok: true, numbers: 'ok', messages: 'ok' };
  const COLETILLA = '(Instagram)';
  const WAME = `https://wa.me/573163903511?text=${encodeURIComponent('Hola, vengo de la web. ' + COLETILLA)}`;

  const unSoloRedactor = (url, etq) => {
    const m = /[?&]m=/.test(url);
    const texto = /[?&]text=/.test(url);
    ok(m !== texto, `${etq.padEnd(38)} m=${m ? 'si' : 'no'} text=${texto ? 'si' : 'no'}`);
    // y la etiqueta, como mucho una vez en lo que se manda
    const veces = decodeURIComponent(url).split(COLETILLA).length - 1;
    ok(veces <= 1, `${etq.padEnd(38)} coletilla x${veces}`);
  };

  // enrutado: el texto lo redacta Zeus, nosotros NO mandamos ninguno
  {
    const t = cargarTracking({ id: 'Cj0', tipo: 'g' }, { sonda: SANA, callado: true, enlaces: [WAME] });
    await asentar();
    unSoloRedactor(t.ctx.lxRuta('home_info', WAME), 'sonda sana, lxRuta');
    t.ctx.lxPromover();
    unSoloRedactor(t.enlaces[0].href, 'sonda sana, tras promover');
  }

  // degradado: lo redactamos nosotros y Zeus no interviene
  {
    const t = cargarTracking({ id: 'Cj0', tipo: 'g' }, { sonda: 'red', callado: true, enlaces: [WAME] });
    await asentar();
    unSoloRedactor(t.ctx.lxRuta('home_info', WAME), 'sonda caida, lxRuta');
    t.ctx.lxPromover();
    unSoloRedactor(t.enlaces[0].href, 'sonda caida, tras promover');
  }

  // la rama por texto, que reescribe el href EN EL CLIC: al enrutar tiene que
  // QUITAR el `text=`, no aniadir el `m=` al lado. Es el sitio por donde
  // entraria la doble coletilla sin que nadie lo notase.
  //
  // OJO CON ESTE CASO. Primero lo escribi con un texto que llevaba la coletilla
  // pegada, lo etiquete «enruta», y paso en verde: no enrutaba: el diccionario
  // casa por texto EXACTO y ese texto no esta en el. `m=no text=si` cumple la
  // invariante igual de bien cuando no ha pasado nada. La etiqueta decia una
  // cosa y la asercion comprobaba otra, que es el mismo fallo que este fichero
  // existe para cazar. Por eso aqui el texto es el del diccionario y se
  // comprueba ADEMAS que enruto de verdad.
  const DICC = 'Hola, quiero agendar una valoración en Luxe-Smile.';
  {
    const t = cargarTracking({ id: 'Cj0', tipo: 'g' }, { sonda: SANA, callado: true });
    await asentar();
    const h = t.listeners.find(([ev]) => ev === 'click')[1];
    const a = enlaceFalso(`https://wa.me/573163903511?text=${encodeURIComponent(DICC)}`);
    h({ target: { closest: (sel) => (sel.includes('wa.me') ? a : null) } });
    ok(a.href.startsWith(R), 'handler por texto: enruto de verdad');
    unSoloRedactor(a.href, 'handler por texto, enrutado');
  }

  // Y EL BORDE QUE ESTO DESTAPA, fijado antes de que llegue: el dia que la
  // pagina pegue la coletilla al componer el texto —que es lo que hace la rama
  // del `o=`—, este handler DEJA DE CASAR y deja de enrutar, en silencio y sin
  // que nada se ponga rojo. No es un fallo de hoy; es la razon por la que esa
  // rama no puede limitarse a aniadir el origen al mensaje.
  {
    const t = cargarTracking({ id: 'Cj0', tipo: 'g' }, { sonda: SANA, callado: true });
    await asentar();
    const h = t.listeners.find(([ev]) => ev === 'click')[1];
    const a = { href: `https://wa.me/573163903511?text=${encodeURIComponent(DICC + ' ' + COLETILLA)}` };
    h({ target: { closest: (sel) => (sel.includes('wa.me') ? a : null) } });
    ok(!a.href.startsWith(R), 'texto + coletilla local: HOY no enruta (documentado)');
    unSoloRedactor(a.href, 'texto + coletilla local');
  }
}


console.log('\n7. la junta con la MEDICIÓN: un enlace ya enrutado sigue contando');
{
  /* El fallo que fija este bloque, encontrado el 17-sep-2026 en producción:
     el listener de conversiones buscaba `a[href*="wa.me"]`, y desde que el
     enrutado salió NINGÚN enlace contiene ya «wa.me» cuando ese listener corre.
     En el home porque `promover()` los reescribe nada más responder la sonda;
     en el blog porque el que enruta va en fase de CAPTURA y el de conversiones
     en BURBUJA, o sea después. Resultado: cero conversiones de Google Ads, cero
     `whatsapp_click` en GA4 y cero `Contact` en Meta, en todo el sitio.

     Otra vez el síntoma es un botón que funciona: el paciente llega a WhatsApp
     con su mensaje. Lo único que desaparece es la cuenta.

     Aquí no se comprueba el href: se comprueba que el enlace SIGA disparando la
     conversión después de enrutarlo. Es la junta, no las piezas. */

  const SANA = { ok: true, numbers: 'ok', messages: 'ok' };
  const WAME = 'https://wa.me/573163903511?text=Hola';

  // Stand-in de `closest` para los selectores que usa tracking.js.
  const casa = (a, sel) => sel.split(',').map((x) => x.trim()).some((parte) => {
    const porHref = /\[href\*="([^"]+)"\]/.exec(parte);
    if (porHref) return a.href.includes(porHref[1]);
    const porAtributo = /\[([a-z-]+)\]$/.exec(parte);
    if (porAtributo) return a.getAttribute(porAtributo[1]) !== null;
    return false;
  });

  const conversionesDe = (t, a) => {
    const eventos = [];
    t.ctx.gtag = (...args) => eventos.push(args[1]);          // gtag('event', nombre, …)
    t.ctx.fbq = (...args) => eventos.push('fb:' + args[1]);
    const clicks = t.listeners.filter(([ev]) => ev === 'click').map(([, fn]) => fn);
    clicks[clicks.length - 1]({ target: { closest: (sel) => (casa(a, sel) ? a : null) } });
    return eventos;
  };

  // a) enlace sin tocar: tiene que contar (control — si esto falla, el doble miente)
  {
    const t = cargarTracking(null, { sonda: 'red', callado: true });
    await asentar();
    const ev = conversionesDe(t, enlaceFalso(WAME));
    ok(ev.length > 0, `enlace en wa.me, sin enrutar        -> cuenta (${ev.join(', ') || 'NADA'})`);
  }

  // b) home: promover() ya lo mandó a Zeus. ESTE es el que estaba roto.
  {
    const t = cargarTracking(null, { sonda: SANA, callado: true, enlaces: [WAME] });
    await asentar();
    t.ctx.lxRuta('home_info', WAME);
    t.ctx.lxPromover();
    const a = t.enlaces[0];
    ok(!a.href.includes('wa.me'), '   (y ya no contiene wa.me, que es el problema)');
    const ev = conversionesDe(t, a);
    ok(ev.length > 0, `home, ya promovido a Zeus          -> cuenta (${ev.join(', ') || 'NADA'})`);
  }

  // c) blog: reescrito en el clic, por el listener de captura, antes que éste.
  {
    const t = cargarTracking(null, { sonda: SANA, callado: true });
    await asentar();
    const a = enlaceFalso(`https://wa.me/573163903511?text=${encodeURIComponent('Hola, quiero agendar una valoración en Luxe-Smile.')}`);
    const clicks = t.listeners.filter(([ev]) => ev === 'click').map(([, fn]) => fn);
    clicks[0]({ target: { closest: (sel) => (casa(a, sel) ? a : null) } });   // captura: enruta
    ok(a.href.startsWith(R), '   (el de captura lo enrutó primero)');
    const ev = conversionesDe(t, a);
    ok(ev.length > 0, `blog, reescrito en el clic         -> cuenta (${ev.join(', ') || 'NADA'})`);
  }

  // d) y un enlace que nunca fue de WhatsApp NO puede contar como tal.
  {
    const t = cargarTracking(null, { sonda: 'red', callado: true });
    await asentar();
    const ev = conversionesDe(t, enlaceFalso('https://luxesmilee.com/blog/'));
    ok(ev.length === 0, `un enlace cualquiera               -> no cuenta (${ev.join(', ') || 'nada'})`);
  }
}

console.log(`\n${fallos ? `FALLOS: ${fallos}` : 'todo en verde'}\n`);
process.exit(fallos ? 1 : 0);
