/* =====================================================================
   Luxe-Smile · Lógica del sitio público
   Expone un componente Alpine "site" con el contenido cargado.
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('site', () => ({
    content: window.LuxeContent.loadContent(),
    mobileOpen: false,

    init() {
      document.title = `${this.content.brand.name} · ${this.content.brand.doctor}`;
      this.$nextTick(() => this.setupReveal());
    },

    // Construye la URL de WhatsApp con mensaje pre-cargado
    waLink() {
      const num = (this.content.contact.whatsapp || '').replace(/\D/g, '');
      const msg = encodeURIComponent(this.content.contact.whatsappMessage || '');
      return `https://wa.me/${num}?text=${msg}`;
    },

    // Convierte saltos de línea en <br> para bloques como hours o hero title
    nl2br(str) {
      return (str || '').replace(/\n/g, '<br>');
    },

    // Renderiza estrellas ★/☆
    stars(n) {
      const full = '★'.repeat(n);
      const empty = '☆'.repeat(Math.max(0, 5 - n));
      return full + empty;
    },

    // Fade-in al hacer scroll
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
