/* =====================================================================
   Luxe-Smile · Panel admin
   Edita el contenido mostrado en index.html. Los cambios se persisten
   en localStorage. Usa Exportar/Importar JSON para moverlos entre
   dispositivos o hacer backup.
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('admin', () => ({
    authed: false,
    passwordInput: '',
    loginError: '',
    content: window.LuxeContent.loadContent(),
    tab: 'brand',
    saved: false,
    toast: '',

    tabs: [
      { id: 'brand', label: 'Marca' },
      { id: 'hero', label: 'Hero' },
      { id: 'about', label: 'Sobre mí' },
      { id: 'services', label: 'Servicios' },
      { id: 'gallery', label: 'Galería' },
      { id: 'testimonials', label: 'Testimonios' },
      { id: 'stats', label: 'Stats' },
      { id: 'contact', label: 'Contacto' },
      { id: 'footer', label: 'Footer' },
      { id: 'backup', label: 'Backup' },
      { id: 'security', label: 'Seguridad' },
    ],

    init() {
      // Sesión corta en sessionStorage para no volver a pedir contraseña
      // al cambiar de pestaña dentro del mismo navegador.
      if (sessionStorage.getItem('luxesmile_admin_ok') === '1') {
        this.authed = true;
      }
    },

    /* ------------------- Auth ------------------- */
    login() {
      if (this.passwordInput === (this.content.admin.password || '')) {
        this.authed = true;
        this.loginError = '';
        sessionStorage.setItem('luxesmile_admin_ok', '1');
      } else {
        this.loginError = 'Contraseña incorrecta.';
      }
      this.passwordInput = '';
    },
    logout() {
      sessionStorage.removeItem('luxesmile_admin_ok');
      this.authed = false;
    },

    /* ------------------- Guardar / reset ------------------- */
    save() {
      window.LuxeContent.saveContent(this.content);
      this.flash('Cambios guardados ✓');
    },
    resetAll() {
      if (!confirm('¿Restaurar TODO el contenido al estado original? Se perderán tus cambios.')) return;
      window.LuxeContent.resetContent();
      this.content = window.LuxeContent.loadContent();
      this.flash('Contenido restaurado');
    },

    /* ------------------- Arrays: add/remove/move ------------------- */
    addService() {
      this.content.services.push({
        icon: '✦',
        title: 'Nuevo servicio',
        desc: 'Describe aquí el tratamiento, sus beneficios y duración.',
      });
    },
    addGalleryItem() {
      this.content.gallery.push({ image: '', caption: '' });
    },
    addTestimonial() {
      this.content.testimonials.push({ name: 'Nombre', role: 'Tratamiento', text: '', rating: 5 });
    },
    addStat() {
      this.content.stats.push({ value: '+100', label: 'Descripción' });
    },
    addNavLink() {
      this.content.nav.push({ label: 'Nueva sección', href: '#' });
    },
    addCredential() {
      this.content.about.credentials.push('Nueva credencial o logro');
    },
    remove(arr, i) {
      arr.splice(i, 1);
    },
    move(arr, i, dir) {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      const [it] = arr.splice(i, 1);
      arr.splice(j, 0, it);
    },

    /* ------------------- Imágenes ------------------- */
    pickImage(callback, maxBytes = 900_000) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > maxBytes) {
          alert(
            `La imagen pesa ${(file.size / 1024).toFixed(0)} KB. Para no saturar el navegador,
            sube imágenes de máximo ${(maxBytes / 1024).toFixed(0)} KB.
            Consejo: comprime en tinypng.com o usa una URL externa.`,
          );
          return;
        }
        const reader = new FileReader();
        reader.onload = () => callback(reader.result);
        reader.readAsDataURL(file);
      };
      input.click();
    },
    uploadHero() {
      this.pickImage((b64) => (this.content.hero.image = b64));
    },
    uploadAbout() {
      this.pickImage((b64) => (this.content.about.image = b64));
    },
    uploadGallery(i) {
      this.pickImage((b64) => (this.content.gallery[i].image = b64));
    },

    /* ------------------- Backup ------------------- */
    exportJSON() {
      window.LuxeContent.saveContent(this.content);
      window.LuxeContent.exportContentJSON();
    },
    importJSON(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      window.LuxeContent.importContentJSON(file).then((data) => {
        this.content = window.LuxeContent.loadContent();
        this.flash('JSON importado correctamente');
      }).catch(() => {
        alert('Archivo inválido: no es un JSON válido.');
      });
      event.target.value = '';
    },

    /* ------------------- Contraseña ------------------- */
    changePassword(current, next, confirmNext) {
      if (current !== this.content.admin.password) {
        alert('La contraseña actual no coincide.');
        return false;
      }
      if (!next || next.length < 4) {
        alert('La nueva contraseña debe tener al menos 4 caracteres.');
        return false;
      }
      if (next !== confirmNext) {
        alert('La confirmación no coincide.');
        return false;
      }
      this.content.admin.password = next;
      this.save();
      alert('Contraseña actualizada.');
      return true;
    },

    flash(msg) {
      this.toast = msg;
      clearTimeout(this._t);
      this._t = setTimeout(() => (this.toast = ''), 2500);
    },
  }));
});
