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

function cargarTracking(clic, opciones) {
  const o = opciones || {};
  const store = new Map();
  if (clic) store.set('lx_clic', JSON.stringify({ id: clic.id, tipo: clic.tipo, t: Date.now() }));
  const listeners = [];
  const enlaces = (o.enlaces || []).map((h) => ({ href: h }));
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

function cargarApp({ conRuta }) {
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
    whatsappMessage: 'Hola Dra. Angela, me gustaría agendar una cita con usted en Luxe-Smile.' } };
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
    const a = { href: `https://wa.me/573163903511?text=${encodeURIComponent('Hola, quiero agendar una valoración en Luxe-Smile.')}` };
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
    const a = { href: `https://wa.me/573163903511?text=${encodeURIComponent(DICC)}` };
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

console.log(`\n${fallos ? `FALLOS: ${fallos}` : 'todo en verde'}\n`);
process.exit(fallos ? 1 : 0);
