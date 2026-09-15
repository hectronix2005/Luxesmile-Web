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

     Las que faltan están pedidas a Zeus y NO se enrutan hasta que existan:
       - las variantes «de forma virtual» / «presencial en el consultorio»
         de /diseno-de-sonrisa/
       - el texto en inglés de /en/smile-design/
       - el de /pacientes-internacionales/
       - los tres de /wa/
     Enrutarlas hoy con la clave más parecida sería exactamente el fallo que el
     párrafo anterior describe. */
  var CLAVES = {
    'Hola, quiero agendar una valoración en Luxe-Smile.': 'valoracion',
    'Hola Dra. Angela, vengo de la web y quiero agendar mi valoración para un diseño de sonrisa.': 'web'
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
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;
    try {
      var url = new URL(a.href);
      var clave = CLAVES[url.searchParams.get('text') || ''];
      if (!clave) return;              // texto no mapeado: se deja ir a wa.me
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
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

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
    if (t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]')) {
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
