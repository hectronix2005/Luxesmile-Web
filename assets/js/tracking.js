/* =====================================================================
   Luxe-Smile · Seguimiento de conversiones
   ---------------------------------------------------------------------
   GA4 + Google Ads + Meta Pixel (Instagram) + 3 eventos de conversión
   (WhatsApp / agenda / llamada) por EVENT DELEGATION en `document`,
   porque el contenido (incl. los botones) lo inyecta Alpine en el cliente.

   DÓNDE MIDE: solo en luxesmilee.com y www.luxesmilee.com (ver HOSTS_MEDIDOS).
   En cualquier otro host el script sale sin cargar nada.

   A QUIÉN NO MIDE: quien haya abierto una vez luxesmilee.com/?notrack=1 en ese
   navegador (visitas internas). Se revierte con ?notrack=0.

   ATRIBUCIÓN: captura el gclid del anuncio al aterrizar y lo adjunta al mensaje
   de WhatsApp, para que el CRM pueda devolverle a Google el paciente real.
   Ver CLIC_KEY más abajo y la página /wa/.

   CÓMO ACTIVAR: reemplaza los placeholders de TRACKING por los IDs reales.
   Mientras un ID conserve 'XXX' o 'TU_PIXEL_ID', ese proveedor NO se carga
   (así no hay requests rotos en producción antes de tener las cuentas).

   - ga4:       lo entrega Google Analytics 4  → G-XXXXXXX
   - googleAds: lo entrega la cuenta de Google Ads → AW-XXXXXXXXX
   - metaPixel: lo entrega el Administrador de eventos de Meta
   - labels:    etiquetas de conversión de Google Ads (se crean al definir
                cada acción de conversión en la cuenta de Ads).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Guarda de dominio ----------------
     Las etiquetas solo se cargan en el dominio canónico. Cualquier otra copia
     del sitio —un despliegue huérfano, una preview, un staging o el servidor
     local— se queda sin medir y no contamina GA4 ni las conversiones de Ads.

     Motivo: luxe-smilee.netlify.app servía una copia vieja del sitio con estos
     mismos IDs dentro, y Google la detectó como dominio adicional de la
     etiqueta. La guarda evita que vuelva a pasar con cualquier host futuro. */
  var HOSTS_MEDIDOS = ['luxesmilee.com', 'www.luxesmilee.com'];
  if (HOSTS_MEDIDOS.indexOf(location.hostname) === -1) {
    console.info('[tracking] Host no canónico (' + location.hostname + '): etiquetas desactivadas.');
    return;
  }

  /* ---------------- Interruptor de visita interna ----------------
     Quien trabaja en el sitio —la doctora, la agencia, nosotros— no debería
     contar como visita. Basta abrir una vez, en cada navegador:

       luxesmilee.com/?notrack=1   deja de medir en ese navegador
       luxesmilee.com/?notrack=0   vuelve a medir

     La marca vive en localStorage: sobrevive a cerrar el navegador, pero es
     por dispositivo y por navegador (el móvil hay que marcarlo aparte).

     En incógnito o con el almacenamiento bloqueado, localStorage lanza. Ahí
     se sigue midiendo a propósito: es preferible un dato de más que apagar
     la medición de un visitante real por un fallo de almacenamiento. */
  var MARCA_INTERNA = 'lx_no_track';
  try {
    var pedido = new URLSearchParams(location.search).get('notrack');
    if (pedido === '1') localStorage.setItem(MARCA_INTERNA, '1');
    if (pedido === '0') localStorage.removeItem(MARCA_INTERNA);
    if (localStorage.getItem(MARCA_INTERNA) === '1') {
      console.info('[tracking] Visita interna: etiquetas desactivadas. Reactivar con ?notrack=0');
      return;
    }
  } catch (e) { /* sin localStorage: se mide con normalidad */ }

  /* ---------------- Atribución del clic de Google Ads ----------------
     Google marca cada clic de anuncio con `gclid` (o `wbraid`/`gbraid` cuando
     iOS impide las cookies). Ese identificador es lo ÚNICO que permite decirle
     después a Google «este paciente vino de este clic».

     El problema: la conversación ocurre en WhatsApp, fuera del sitio. Si el
     identificador no viaja hasta allí, Google nunca sabe qué campaña trajo al
     paciente y acaba optimizando hacia clics en botón en vez de hacia gente que
     agenda. Es exactamente lo que pasa hoy.

     Solución: capturarlo al aterrizar, guardarlo 90 días (la ventana de
     conversión de Ads) y adjuntarlo al mensaje prellenado de WhatsApp. El CRM
     lo lee de ahí y se lo devuelve a Google cuando el paciente agenda.

     No hace falta página intermedia: los anuncios aterrizan en el sitio, no en
     wa.me. Para el caso de un anuncio que sí apunte directo a WhatsApp existe
     /wa/, que hace lo mismo y redirige. */
  var CLIC_KEY = 'lx_clic';
  var CLIC_DIAS = 90;

  /* EL MENSAJE YA NO LLEVA MARCA. Antes viajaba `Ref:<tipo>.<id>` dentro del
     texto prellenado: 91 caracteres que el paciente VE y puede borrar antes de
     enviar, porque parecen un error. Cuando los borraba se perdía la atribución
     de ese clic.

     Ahora el enlace pasa por el redirector de Zeus, que registra el traspaso y
     compone el texto desde su propio diccionario. El mensaje llega LIMPIO.

     Y lo que gana no es sólo estética. Hoy un mensaje sin marca es ambiguo por
     construcción —puede ser tráfico orgánico o puede ser una marca perdida— y
     las dos cosas se ven igual. El redirector registra el paso de TODO el que
     pulsa, lleve identificador o no, así que:

        hay traspaso y no hay gclid  ->  orgánico, correcto, nada que hacer
        no hay traspaso              ->  el mecanismo se rompió

     Ésa es la razón de fondo del cambio, no la limpieza del texto. */
  var REDIRECTOR = 'https://zeus.codi.com.co/6a7aa5453a2a5ee4405a7a6c/wa';

  /* DICCIONARIO CERRADO Y COINCIDENCIA EXACTA, A PROPÓSITO.

     La clave `m` no es el mensaje: es un índice al diccionario de Zeus. Si
     mandamos una clave que no existe, Zeus NO falla — sirve su texto por
     defecto. O sea que un error de mapeo no daría error: daría un mensaje
     distinto del que la página prometió, sin avisar a nadie.

     Por eso aquí se compara el texto ENTERO y literal. Lo que no esté en esta
     tabla no se reescribe: el enlace sigue yendo a wa.me tal cual, sin
     atribución pero con el mensaje correcto. Perder una atribución es barato;
     servirle a un paciente un mensaje que no es el suyo, no.

     Lo que sigue SIN enrutar, porque no tiene clave y pedirla no compensa hoy:
       - los tres mensajes de /wa/, que son suyos y distintos de todos éstos
       - las dos variantes en inglés («via virtual consultation» y «and would
         like an in-office appointment»): esa página tiene tráfico marginal y no
         quiero multiplicar el diccionario antes de ver si la base funciona
     Enrutarlas con la clave más parecida sería exactamente el fallo que el
     párrafo anterior describe. */
  var CLAVES = {
    'Hola, quiero agendar una valoración en Luxe-Smile.': 'valoracion',
    'Hola Dra. Angela, vengo de la web y quiero agendar mi valoración para un diseño de sonrisa.': 'web',
    'Hola Dra. Angela, vengo de la web y quiero agendar mi valoración para un diseño de sonrisa de forma virtual.': 'web_virtual',
    'Hola Dra. Angela, vengo de la web y quiero agendar mi valoración para un diseño de sonrisa presencial en el consultorio.': 'web_consultorio',
    'Hola Dra. Angela, soy paciente internacional y me gustaría agendar una consulta virtual para planificar mi tratamiento dental en Bogotá.': 'internacional',
    "Hi Dr. Angela, I'm interested in a smile design consultation and I'm traveling from abroad.": 'smile_design_en'
  };

  /* Google usa tres parámetros distintos según el caso, y la API de conversiones
     offline los espera en CAMPOS DISTINTOS. Si solo enviamos el identificador sin
     decir de cuál se trata, el CRM tiene que adivinar —y las conversiones de iOS
     se pierden—. Por eso el prefijo de una letra. */
  var FUENTES = [
    ['gclid', 'g'],   // el habitual
    ['wbraid', 'w'],  // iOS, tráfico web
    ['gbraid', 'b'],  // iOS, app-a-web
  ];

  try {
    var q = new URLSearchParams(location.search);
    for (var i = 0; i < FUENTES.length; i++) {
      var v = q.get(FUENTES[i][0]);
      if (v) {
        localStorage.setItem(CLIC_KEY, JSON.stringify({ id: v, tipo: FUENTES[i][1], t: Date.now() }));
        break;
      }
    }
  } catch (e) { /* sin localStorage: se pierde la atribución, no el sitio */ }

  function clicVigente() {
    try {
      var o = JSON.parse(localStorage.getItem(CLIC_KEY) || 'null');
      if (!o || !o.id) return null;
      if (Date.now() - o.t > CLIC_DIAS * 864e5) { localStorage.removeItem(CLIC_KEY); return null; }
      // 'tipo' se añadió después: lo guardado antes del cambio es siempre gclid.
      return { id: o.id, tipo: o.tipo || 'g' };
    } catch (e) { return null; }
  }

  /* Se reescribe el href en fase de captura, antes de que el navegador navegue
     y antes del listener de conversiones.

     Nótese que aquí NO se exige que haya un clic de anuncio vigente. Antes sí:
     sin identificador no había nada que adjuntar y se dejaba el enlace intacto.
     Ahora el traspaso se registra AUNQUE no haya identificador, y ése es
     justamente el caso que distingue «vino de orgánico» de «se rompió algo».
     Si se filtrara por `clicVigente()` volveríamos a no poder distinguirlos. */
  /* La ruta, expuesta. El emparejamiento por texto de aquí abajo NO sirve para
     el home: sus enlaces los compone Alpine al renderizar, con seis textos
     propios que no están en HTML, y tres de ellos se derivan de
     `content.contact.whatsappMessage` — un campo con `<input>` en el panel de la
     doctora. Emparejar por texto ahí significa que una edición desde el admin
     rompe la atribución EN SILENCIO: el botón sigue llevando a WhatsApp y nadie
     ve nada.

     Medido el 14-sep-2026: de los 9 enlaces del home, 0 casaban. El blog y las
     tres páginas autocontenidas sí, porque su texto es literal y está en el
     código. O sea que el mecanismo llevaba desde el despliegue cubriendo cuatro
     de cinco páginas, y las dos comprobaciones que hicimos —Zeus, que el
     diccionario responde; yo, que el fichero se sirve— pasaron las dos.

     Por eso el home no empareja: llama a `lxRuta(clave)` y manda la clave que ya
     conoce. El texto deja de ser la llave. Si este fichero no cargó, `lxRuta` no
     existe y quien llama se queda con su `wa.me` de siempre. */
  /* ENLACE DE RESERVA. Condición que puso Héctor al autorizar el enrutado: si
     nuestra ruta cae, el paciente tiene que llegar a WhatsApp igual. La
     atribución vale menos que un paciente que llega.

     SE EMPIEZA DEGRADADO Y SE PROMUEVE, no al revés. Es la decisión que manda
     en todo este bloque:

       · Si la sonda no contesta, tarda, la bloquea una extensión, o este código
         tiene un fallo que no previmos, el href se queda en `wa.me` y el
         paciente llega. Perdemos la atribución, que es barato.
       · Al revés —empezar enrutado y degradar si falla— cualquiera de esos
         mismos casos deja al paciente sin WhatsApp mientras la sonda decide.

     O sea: el estado por defecto es el que no necesita que nada funcione.

     Zeus avisó del modo de fallo contrario: una sonda que diera «rojo» siempre
     degradaría el sitio de forma permanente y en silencio. Por eso el degradado
     GRITA —`console.warn` y evento a GA4— y por eso la sonda mira su CUERPO y no
     sólo el código: un 200 de «el servicio está en pie» con el diccionario de
     esta clínica caído es el canario que no puede ponerse rojo. */
  var SALUD = REDIRECTOR + '/salud';
  /* Marca que ponen los DOS sitios que reescriben un enlace de WhatsApp para
     mandarlo por Zeus. Existe porque el enlace deja de contener «wa.me», y el
     listener de conversiones buscaba exactamente eso: desde que el enrutado
     salió a producción, ningún clic en WhatsApp disparaba ya la conversión de
     Google Ads, ni `whatsapp_click` en GA4, ni `Contact` en Meta. Comprobado en
     producción el 17-sep-2026: los 7 enlaces del home apuntaban a Zeus y
     ninguno casaba con el selector.

     El síntoma de este fallo es un botón que funciona: el paciente llega a
     WhatsApp con el mensaje correcto. Lo único que desaparece es la cuenta. */
  var MARCA_WA = 'data-lx-wa';

  var SONDA_MS = 2500;
  var promocion = [];      // [[enlaceWaMe, rutaZeus], ...]
  var saludOk = false;     // falso A PROPÓSITO: ver arriba

  /* EL ORDEN DE LOS ARGUMENTOS NO ES CASUAL: `reserva` SEGUNDO.
     Esta rama y `main` divergieron aqui y las dos firmas eran correctas por
     separado: la rama tenia `(clave, origen)` y `main` `(clave, reserva)`.
     Mezcladas sin mirar, las paginas pasaban `this.origen` donde `main` espera
     el enlace de reserva, y con la sonda caida el boton se quedaba con el href
     literal "ig". Comprobado ejecutandolo el 15-sep, no leyendo las firmas.

     Lo que lo hacia invisible: con la sonda VERDE no se nota nada, y con la
     sonda verde es como se prueba todo. El fallo solo aparecia el dia que Zeus
     se cayera — el unico dia para el que existe el reserva.

     Por eso `reserva` conserva el segundo puesto, que es el que ya usan las
     llamadas de `main`, y `origen` va tercero. */
  function lxRuta(clave, reserva, origen) {
    if (!clave) return null;
    var destino = REDIRECTOR + '?m=' + encodeURIComponent(clave);
    var clic = clicVigente();
    if (clic && clic.id) {
      destino += '&g=' + encodeURIComponent(clic.id);
      // Zeus espera el nombre completo del parámetro de Google (`t=gclid`), no
      // la inicial que guardamos nosotros. Si no está en la tabla no se manda
      // `t` en absoluto: mejor que Zeus lo anote como desconocido a que lo
      // anote como algo concreto y equivocado.
      var LARGO = { g: 'gclid', w: 'wbraid', b: 'gbraid' };
      if (LARGO[clic.tipo]) destino += '&t=' + LARGO[clic.tipo];
    }
    /* ORIGEN, sólo cuando NO hay identificador de clic.
       Google ya viene identificado por el `gclid`; el tráfico social no trae
       nada, así que su traspaso es hoy indistinguible de uno directo. Este
       parámetro es lo único que los separa.

       Valores: 'ig' | 'google'. Códigos cortos y estables, NO el texto legible
       —«Vengo de Instagram»—, que se redacta para que lo lea una persona y por
       tanto puede cambiar sin avisar. Un índice que se puede reescribir no es
       un índice.

       Zeus TOLERA el parámetro hoy (comprobado: sirve el 302 correcto) pero no
       lo registra ni lo refleja. Hasta que lo haga, esto no desplegado. */
    if (origen) destino += '&o=' + encodeURIComponent(origen);

    /* Sin reserva se devuelve la ruta tal cual: es lo que hacen las pruebas y
       cualquier llamada que no tenga a dónde caer. Con reserva se anota el par
       y se devuelve LA RESERVA hasta que la sonda diga que sí. */
    if (!reserva) return destino;
    promocion.push([reserva, destino]);
    return saludOk ? destino : reserva;
  }
  window.lxRuta = lxRuta;

  /* Promueve los href que ya estén pintados. Se vuelve a llamar desde el
     observador porque Alpine pinta DESPUÉS de que corra este fichero, y vuelve
     a poner la reserva en cada re-render. */
  function promover() {
    if (!saludOk || !promocion.length) return;
    var enlaces = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    for (var i = 0; i < enlaces.length; i++) {
      for (var j = 0; j < promocion.length; j++) {
        if (enlaces[i].href === promocion[j][0]) {
          enlaces[i].setAttribute(MARCA_WA, '1');
          enlaces[i].href = promocion[j][1];
          break;
        }
      }
    }
  }

  /* La cola de `gtag` se declara AQUÍ, no junto a la carga de la etiqueta, porque
     `degradar()` se llama de forma síncrona desde el catch de la sonda —el caso
     en que la sonda ni siquiera se puede lanzar— y allí `window.gtag` todavía no
     existía: el aviso a GA4 se perdía justo en el fallo más grave, mientras que
     los leves sí llegaban. Declararla antes no carga nada: sólo encola. */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  function degradar(motivo) {
    saludOk = false;
    // QUE SE OIGA. Un sitio que pierde toda la atribución y sigue funcionando
    // perfectamente es el fallo que no se descubre hasta que alguien va a mirar
    // un número que lleva semanas en cero.
    try { console.warn('[luxe] enrutado degradado a wa.me: ' + motivo); } catch (e) {}
    try { if (window.gtag) window.gtag('event', 'enrutado_degradado', { motivo: motivo }); } catch (e) {}
  }
  // Expuestas para las pruebas y para poder diagnosticar desde la consola:
  // `lxPromover()` aplica la sustitución que hace el observador, y `lxDegradar()`
  // fuerza el modo reserva.
  window.lxDegradar = degradar;
  window.lxPromover = promover;

  try {
    var cortado = false;
    var reloj = setTimeout(function () {
      cortado = true; degradar('la sonda no contestó en ' + SONDA_MS + ' ms');
    }, SONDA_MS);
    fetch(SALUD, { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject('HTTP ' + r.status); })
      .then(function (j) {
        if (cortado) return;
        clearTimeout(reloj);
        // EL CUERPO, NO SÓLO EL CÓDIGO. `numbers` es la lista blanca y
        // `messages` el diccionario: si falta cualquiera, el servicio responde
        // pero a esta clínica le sirve mal. `numbers: "memoria"` cuenta como
        // bueno —los pacientes llegan—; es amarillo para Zeus, no para nosotros.
        if (j && j.ok === true && j.messages === 'ok' && j.numbers !== 'falta') {
          saludOk = true;
          promover();
        } else {
          degradar('la sonda respondió ' + JSON.stringify(j));
        }
      })
      .catch(function (e) { if (!cortado) { clearTimeout(reloj); degradar('la sonda falló: ' + e); } });
  } catch (e) { degradar('no se pudo lanzar la sonda: ' + e); }

  /* Sin esto la promoción sólo alcanzaría a los enlaces ya pintados — hoy,
     ninguno de los del home. */
  try {
    if (window.MutationObserver) {
      new MutationObserver(function () { promover(); })
        .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    }
  } catch (e) { /* sin observador: sólo lo ya pintado */ }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;
    // El otro extremo del reserva. Esta rama —blog y las tres páginas
    // autocontenidas— enruta reescribiendo el href en el momento del clic, así
    // que aquí degradar es simplemente NO reescribir: el enlace ya lleva su
    // `wa.me` con el mensaje correcto puesto por la página.
    if (!saludOk) return;
    try {
      var url = new URL(a.href);
      var destino = lxRuta(CLAVES[url.searchParams.get('text') || '']);
      if (!destino) return;            // texto no mapeado: se deja ir a wa.me
      a.setAttribute(MARCA_WA, '1');   // antes de tocar el href: después ya no se sabe que lo era
      a.href = destino;
    } catch (err) { /* href raro: se deja intacto */ }
  }, true);

  var TRACKING = {
    ga4: 'G-4CPWLE6HFM',            // GA4
    googleAds: 'AW-18224708687',   // Google Ads
    metaPixel: '4446128538988992', // Meta Pixel (Instagram / Facebook)
    labels: {
      whatsapp: 'A2slCKTB-cocEM_4m_JD',    // Clic WhatsApp
      agenda: 'icl7CKfB-cocEM_4m_JD',      // Clic Agendar
      llamada: 'uX22CKrB-cocEM_4m_JD',     // Clic Llamada
    },
  };

  // Un ID/etiqueta se considera configurado si no contiene el placeholder.
  function isSet(v) {
    return !!v && !/XXX|TU_PIXEL_ID/i.test(v);
  }

  /* ---------------- Google tag (GA4 + Google Ads) ---------------- */
  if (isSet(TRACKING.ga4) || isSet(TRACKING.googleAds)) {
    var loaderId = isSet(TRACKING.ga4) ? TRACKING.ga4 : TRACKING.googleAds;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + loaderId;
    document.head.appendChild(s);

    gtag('js', new Date());
    if (isSet(TRACKING.ga4)) gtag('config', TRACKING.ga4);
    if (isSet(TRACKING.googleAds)) gtag('config', TRACKING.googleAds);
  }

  /* ---------------- Meta Pixel (Instagram / Facebook) ---------------- */
  if (isSet(TRACKING.metaPixel)) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', TRACKING.metaPixel);
    window.fbq('track', 'PageView');
  }

  /* ---------------- Helpers de disparo ---------------- */
  // Conversión de Google Ads (solo si Ads + la etiqueta están configurados).
  function adsConversion(label) {
    if (window.gtag && isSet(TRACKING.googleAds) && isSet(label)) {
      window.gtag('event', 'conversion', {
        send_to: TRACKING.googleAds + '/' + label,
      });
    }
  }
  // Evento GA4 (funciona en cuanto exista el GA4 ID, aunque Ads aún no).
  // `params` es opcional: sirve para segmentar el evento en los informes.
  function ga4Event(name, params) {
    if (window.gtag && isSet(TRACKING.ga4)) {
      window.gtag('event', name, params || {});
    }
  }

  /* Distingue las dos modalidades de cita a partir del destino del enlace.
     El sitio ya las separa —calendarOffice para el consultorio, Calendly para
     la virtual— pero ambas comparten la misma etiqueta de conversión en Ads.
     Aquí se conserva la diferencia en GA4, que es gratis y no toca la puja.

     Nota: 'calendly' NO contiene la cadena 'calendar'. Por eso los enlaces
     virtuales dependen de data-cta="agendar" para ser detectados. */
  function modalidadCita(el) {
    var href = (el && el.href) || '';
    if (href.indexOf('calendar.app.google') !== -1) return 'presencial';
    if (href.indexOf('calendly.com') !== -1) return 'virtual';
    return 'sin_determinar';
  }
  // Evento estándar de Meta Pixel.
  function metaEvent(name) {
    if (window.fbq) window.fbq('track', name);
  }

  /* ---------------- Eventos de conversión (event delegation) ----------------
     El listener vive en `document` para funcionar aunque Alpine cree los
     enlaces después de cargar la página. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // 1) WhatsApp — conversión PRINCIPAL
    // La marca es imprescindible: este listener va en fase de BURBUJA y el que
    // enruta va en CAPTURA, o sea que cuando llegamos aquí el href ya es el de
    // Zeus y «wa.me» ya no está. Los enlaces del home ni siquiera llegan con él.
    if (t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[' + MARCA_WA + ']')) {
      adsConversion(TRACKING.labels.whatsapp);
      ga4Event('whatsapp_click');
      metaEvent('Contact');
      return;
    }

    // 2) Agendar (consultorio o virtual)
    var agenda = t.closest('a[href*="calendar.app.google"], a[href*="calendar"], [data-cta="agendar"]');
    if (agenda) {
      adsConversion(TRACKING.labels.agenda);
      ga4Event('schedule_click', { modalidad: modalidadCita(agenda) });
      metaEvent('Schedule');
      return;
    }

    // 3) Llamada telefónica (hoy no hay enlaces tel: en el sitio; queda listo)
    if (t.closest('a[href^="tel:"]')) {
      adsConversion(TRACKING.labels.llamada);
      ga4Event('call_click');
      metaEvent('Contact');
    }
  });
})();
