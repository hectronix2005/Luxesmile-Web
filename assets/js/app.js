/* =====================================================================
   Luxe-Smile · Lógica del sitio público
   Carga el contenido desde assets/data/content.json (vía LuxeContent).
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('site', () => ({
    content: structuredClone(window.LuxeContent.DEFAULT_CONTENT),
    mobileOpen: false,

    async init() {
      this.content = await window.LuxeContent.loadContent();
      window.LuxeContent.applyTheme(this.content.theme);
      document.title = `${this.content.brand.name} · ${this.content.brand.doctor}`;
      this.$nextTick(() => this.setupReveal());
    },

    waLink() {
      const num = (this.content.contact.whatsapp || '').replace(/\D/g, '');
      const msg = encodeURIComponent(this.content.contact.whatsappMessage || '');
      return `https://wa.me/${num}?text=${msg}`;
    },

    bookingLink() {
      return this.content.contact.calendar || this.waLink();
    },

    bookingOfficeLink() {
      return this.content.contact.calendarOffice || this.content.contact.calendar || this.waLink();
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
});
