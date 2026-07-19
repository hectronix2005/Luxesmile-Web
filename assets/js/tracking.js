/* =====================================================================
   Luxe-Smile · Seguimiento de conversiones
   ---------------------------------------------------------------------
   GA4 + Google Ads + Meta Pixel (Instagram) + 3 eventos de conversión
   (WhatsApp / agenda / llamada) por EVENT DELEGATION en `document`,
   porque el contenido (incl. los botones) lo inyecta Alpine en el cliente.

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
  function ga4Event(name) {
    if (window.gtag && isSet(TRACKING.ga4)) {
      window.gtag('event', name);
    }
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

    // 2) Agendar (Google Calendar: consultorio o virtual)
    if (t.closest('a[href*="calendar.app.google"], a[href*="calendar"], [data-cta="agendar"]')) {
      adsConversion(TRACKING.labels.agenda);
      ga4Event('schedule_click');
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
