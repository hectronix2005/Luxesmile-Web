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
    // Título optimizado para SEO (keyword + ciudad). Se mantiene fijo aquí
    // para que coincida con el <title> del HTML y no lo pise con uno genérico.
    document.title = 'Diseño de Sonrisa en Bogotá | Dra. Angela Barbosa — Luxe-Smile';
    this.$nextTick(() => {
      this.setupReveal();
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

    waLink(context) {
      const num = (this.content.contact.whatsapp || '').replace(/\D/g, '');
      const base = this.content.contact.whatsappMessage || 'Hola, quiero información sobre Luxe-Smile.';
      let msg;
      if (context === 'hero') {
        msg = 'Hola, quiero información sobre diseño de sonrisa.';
      } else if (context === 'casos') {
        msg = 'Hola, vi los casos en su página y quiero agendar una valoración.';
      } else if (context === 'contacto') {
        msg = 'Hola, quiero agendar mi valoración con la Dra. Angela.';
      } else if (context === 'virtual') {
        msg = base.replace('una cita', 'una cita de forma virtual');
      } else if (context === 'consultorio') {
        msg = base.replace('una cita', 'una cita presencial en el consultorio');
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
      const full = '★'.repeat(n);
      const empty = '☆'.repeat(Math.max(0, 5 - n));
      return full + empty;
    },

    setupReveal() {
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
    },
  }));

  // Marcar <body> con x-data. Como esto corre en 'alpine:init' (antes del walk
  // del DOM), Alpine inicializa el componente por sí mismo durante start().
  document.body.setAttribute('x-data', 'site');
}
