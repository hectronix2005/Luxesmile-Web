/* =====================================================================
   Luxe-Smile · Lógica del sitio público
   Carga el contenido desde assets/data/content.json (vía LuxeContent).
   ===================================================================== */

// app.js corre sin defer (antes que Alpine), así que este listener queda
// registrado a tiempo.
document.addEventListener('alpine:init', registerAndInitialize);

function registerAndInitialize() {
  Alpine.data('site', () => ({
  content: structuredClone(window.LuxeContent.DEFAULT_CONTENT),
  mobileOpen: false,
  bookingModalOpen: false,
  officeModalOpen: false,
  diagnosticReminderOpen: false,
  diagnosticReminderType: null,

  async init() {
    this.content = await window.LuxeContent.loadContent();
    window.LuxeContent.applyTheme(this.content.theme);
    // Aquí había un `document.title = '…'` con un título fijo. Nació en 12b0d01
    // como EL título de SEO del home, y el comentario decía que se mantenía
    // «para que coincida con el <title> del HTML». El 17-sep-2026 ya no coincidía:
    // el HTML declara «Luxe-Smile · Diseño de Sonrisa y Carillas en el Chico» (53)
    // y esta línea lo pisaba con uno de 62 — por encima del corte de 60 que la
    // rama de títulos acababa de arreglar en las otras 15 páginas.
    //
    // Nadie más escribe `document.title` en todo el repo, así que el miedo del
    // comentario («que no lo pise uno genérico») no tenía a quién temer. El
    // título del HTML es la única fuente.
    this.$nextTick(() => {
      window.LuxeContent.revelarAlEntrar();
      this.loadElfsightIfNeeded();
    });
  },

    loadElfsightIfNeeded() {
      if (!this.content?.reviews?.elfsightWidgetId) return;
      const inject = () => {
        if (document.querySelector('script[data-elfsight-platform]')) return;
        const s = document.createElement('script');
        s.src = 'https://static.elfsight.com/platform/platform.js';
        s.defer = true;
        s.setAttribute('data-elfsight-platform', '');
        document.head.appendChild(s);
      };
      const target = document.getElementById('testimonios');
      if (!target || !('IntersectionObserver' in window)) { inject(); return; }
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { obs.disconnect(); inject(); }
      }, { rootMargin: '200px' });
      obs.observe(target);
    },

    // LA CLAVE ES EL CONTEXTO, NO EL TEXTO.
    //
    // Antes esto devolvía siempre un `wa.me` con el mensaje dentro, y
    // tracking.js lo reescribía DESPUÉS buscando ese mensaje en su diccionario.
    // Medido el 14-sep-2026: de los 9 enlaces del home no casaba ninguno. Los
    // otros sitios sí —blog y las tres páginas autocontenidas— porque su texto
    // es literal; aquí tres de los seis salen de `whatsappMessage`, que tiene un
    // `<input>` en el panel de la doctora, con un `.replace()` encima.
    //
    // Emparejar por texto un campo que se edita desde el admin significa que una
    // edición rompe la atribución sin que nada falle: el botón sigue abriendo
    // WhatsApp con el mensaje correcto. El fallo y el acierto se ven igual.
    //
    // Ahora se manda la clave, que esta función ya conoce, y el texto lo sirve
    // Zeus. Si tracking.js no cargó, `lxRuta` no existe y se cae al `wa.me` de
    // siempre: sin atribución, con el mensaje bueno. Ése es el lado correcto por
    // el que fallar.
    waLink(context) {
      const CLAVES = {
        hero: 'home_info',
        casos: 'home_casos',
        contacto: 'home_contacto',
        virtual: 'home_virtual',
        consultorio: 'home_consultorio',
      };
      // LA RESERVA SE CALCULA PRIMERO, y se le pasa a `lxRuta`. Mientras la
      // sonda de salud no confirme, `lxRuta` devuelve esta misma reserva y el
      // enlace se queda en `wa.me`: el paciente llega aunque nuestra ruta esté
      // caída. Cuando la sonda dice que sí, tracking.js sustituye el href.
      const reserva = this.waMe(context);
      return (window.lxRuta && window.lxRuta(CLAVES[context] || 'home_general', reserva)) || reserva;
    },

    // El enlace de siempre, sin enrutar. Es la reserva, y también lo que se
    // sirve si tracking.js no llegó a cargar.
    waMe(context) {
      const num = (this.content.contact.whatsapp || '').replace(/\D/g, '');
      const base = this.content.contact.whatsappMessage || 'Hola, quiero información sobre Luxe-Smile.';
      let msg;
      if (context === 'hero') {
        msg = 'Hola, quiero información sobre diseño de sonrisa.';
      } else if (context === 'casos') {
        msg = 'Hola, vi los casos en su página y quiero agendar una valoración.';
      } else if (context === 'contacto') {
        msg = 'Hola, quiero agendar mi valoración con la Dra. Angela.';
      } else if (context === 'virtual' || context === 'consultorio') {
        const como = context === 'virtual' ? 'de forma virtual' : 'presencial en el consultorio';
        msg = base.replace('una cita', `una cita ${como}`);
        // `base` sale de `whatsappMessage`, que es un <input> del panel. Si la
        // doctora lo reescribe y deja de contener «una cita», el replace no hace
        // nada y los dos mensajes salen IDÉNTICOS al genérico: deja de saber si
        // el paciente pedía virtual o presencial, y nada falla en voz alta. Es
        // exactamente el fallo que este mismo fichero documenta doce líneas más
        // arriba, emparejar por texto un campo editable, sobrevivido en el sitio
        // donde no se miró. Si el replace no mordió, se dice aparte.
        if (msg === base) msg = `${base} Me gustaría que fuera ${como}.`;
      } else {
        msg = base;
      }
      return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    },

    bookingLink() {
      return this.content.contact.calendar || this.waLink('virtual');
    },

    bookingOfficeLink() {
      return this.content.contact.calendarOffice || this.waLink('consultorio');
    },

    showDiagnosticReminder(type) {
      this.diagnosticReminderType = type;
      this.diagnosticReminderOpen = true;
    },

    proceedToBooking() {
      if (this.diagnosticReminderType === 'virtual') {
        this.bookingModalOpen = true;
      } else if (this.diagnosticReminderType === 'office') {
        this.officeModalOpen = true;
      }
      this.diagnosticReminderOpen = false;
      this.diagnosticReminderType = null;
    },

    nl2br(str) {
      return (str || '').replace(/\n/g, '<br>');
    },

    stars(n) {
      // `n` viene de content.json, o sea de un campo del panel. Un valor
      // negativo hace que `repeat` lance RangeError, y lanzar aquí revienta el
      // render del componente entero de Alpine: la página se queda con los 58
      // bloques en opacity:0. Una estrella mal puesta no puede tumbar la página.
      const v = Math.min(5, Math.max(0, Math.round(Number(n) || 0)));
      return '★'.repeat(v) + '☆'.repeat(5 - v);
    },

  }));

  // Marcar <body> con x-data. Como esto corre en 'alpine:init' (antes del walk
  // del DOM), Alpine inicializa el componente por sí mismo durante start().
  document.body.setAttribute('x-data', 'site');
}
