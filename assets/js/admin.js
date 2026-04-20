/* =====================================================================
   Luxe-Smile · Panel admin
   Edita el contenido y publica directo al repo vía GitHub API.
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('admin', () => ({
    authed: false,
    loading: true,
    passwordInput: '',
    loginError: '',
    content: structuredClone(window.LuxeContent.DEFAULT_CONTENT),
    snapshot: '',                          // JSON del último estado publicado/cargado (para detectar dirty)
    tab: 'brand',
    toast: '',
    toastTone: 'ok',                       // 'ok' | 'err'
    publishing: false,

    tabs: [
      { id: 'brand', label: 'Marca' },
      { id: 'theme', label: 'Tema' },
      { id: 'hero', label: 'Hero' },
      { id: 'about', label: 'Sobre mí' },
      { id: 'services', label: 'Servicios' },
      { id: 'gallery', label: 'Galería' },
      { id: 'testimonials', label: 'Testimonios' },
      { id: 'stats', label: 'Stats' },
      { id: 'contact', label: 'Contacto' },
      { id: 'footer', label: 'Footer' },
      { id: 'publish', label: 'Publicación' },
      { id: 'backup', label: 'Backup' },
      { id: 'security', label: 'Seguridad' },
    ],

    presets: window.LuxeContent.THEME_PRESETS,

    // Config GitHub (en memoria, espejada a localStorage)
    gh: { owner: 'hectronix2005', repo: 'Luxesmile-Web', branch: 'main', path: 'assets/data/content.json', token: '' },

    // SHA del content.json en el momento en que cargamos (para detectar conflictos).
    loadedSha: null,

    async init() {
      if (sessionStorage.getItem('luxesmile_admin_ok') === '1') {
        this.authed = true;
      }
      const cfg = window.LuxeContent.getGithubConfig();
      this.gh = { ...this.gh, ...cfg };
      await this.loadFreshContent();
      this.loading = false;
    },

    // Carga content.json directamente del repo vía API (sin CDN cache).
    // Si no hay token, cae al fetch público (que puede estar cacheado en Pages CDN).
    async loadFreshContent() {
      const defaults = structuredClone(window.LuxeContent.DEFAULT_CONTENT);
      if (this.gh.token && this.gh.owner && this.gh.repo) {
        try {
          const { data, sha } = await window.LuxeContent.fetchContentViaAPI();
          this.content = window.LuxeContent.deepMerge(defaults, data);
          this.loadedSha = sha;
          this.snapshot = JSON.stringify(this.content);
          window.LuxeContent.applyTheme(this.content.theme);
          return;
        } catch (e) {
          console.warn('API load failed, falling back to public fetch:', e.message);
        }
      }
      this.content = await window.LuxeContent.loadContent();
      this.loadedSha = null;
      this.snapshot = JSON.stringify(this.content);
      window.LuxeContent.applyTheme(this.content.theme);
    },

    /* ------------------- Tema ------------------- */
    applyPreset(preset) {
      this.content.theme = {
        presetId: preset.id,
        colors: { ...preset.colors },
      };
      window.LuxeContent.applyTheme(this.content.theme);
    },
    applyCustomColor(key, hex) {
      if (!this.content.theme) this.content.theme = { presetId: 'custom', colors: {} };
      this.content.theme.colors[key] = hex;
      this.content.theme.presetId = 'custom';
      window.LuxeContent.applyTheme(this.content.theme);
    },

    get dirty() {
      return JSON.stringify(this.content) !== this.snapshot;
    },

    /* ------------------- Auth ------------------- */
    login() {
      if (this.passwordInput === window.LuxeContent.getAdminPassword()) {
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

    /* ------------------- Recarga desde remoto ------------------- */
    async reloadFromRemote() {
      if (this.dirty && !confirm('Tienes cambios sin publicar. ¿Descartar y recargar desde GitHub?')) return;
      this.loading = true;
      await this.loadFreshContent();
      this.loading = false;
      this.flash('Contenido recargado desde el repo');
    },

    /* ------------------- Publicar ------------------- */
    async publish() {
      if (!this.gh.owner || !this.gh.repo || !this.gh.token) {
        this.tab = 'publish';
        this.flash('Completa la configuración de GitHub antes de publicar', 'err');
        return;
      }
      if (!this.dirty) {
        this.flash('No hay cambios nuevos para publicar');
        return;
      }
      this.publishing = true;
      try {
        window.LuxeContent.setGithubConfig(this.gh);
        const { newSha } = await window.LuxeContent.publishContent(this.content, this.loadedSha);
        this.loadedSha = newSha || null;
        this.snapshot = JSON.stringify(this.content);
        this.flash('Publicado ✓ GitHub Pages actualizará el sitio en ~1 minuto');
      } catch (e) {
        if (e.code === 'STALE') {
          this.flash(e.message, 'err');
        } else {
          this.flash('Error al publicar: ' + e.message, 'err');
        }
      } finally {
        this.publishing = false;
      }
    },

    async testConnection() {
      window.LuxeContent.setGithubConfig(this.gh);
      try {
        await window.LuxeContent.testGithubConnection();
        this.flash('Conexión OK — token y repo válidos');
      } catch (e) {
        this.flash('Conexión falló: ' + e.message, 'err');
      }
    },

    saveGithubConfig() {
      window.LuxeContent.setGithubConfig(this.gh);
      this.flash('Configuración guardada en este navegador');
    },

    clearToken() {
      this.gh.token = '';
      window.LuxeContent.setGithubConfig(this.gh);
      this.flash('Token borrado');
    },

    /* ------------------- Arrays: add/remove/move ------------------- */
    addService() {
      this.content.services.push({ icon: '✦', title: 'Nuevo servicio', desc: 'Describe el tratamiento.' });
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
      this.content.about.credentials.push('Nueva credencial');
    },
    remove(arr, i) { arr.splice(i, 1); },
    move(arr, i, dir) {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      const [it] = arr.splice(i, 1);
      arr.splice(j, 0, it);
    },

    /* ------------------- Imágenes (base64, máx 900 KB) ------------------- */
    pickImage(callback, maxBytes = 900_000) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > maxBytes) {
          alert(
            `La imagen pesa ${(file.size / 1024).toFixed(0)} KB. Máximo recomendado: ${(maxBytes / 1024).toFixed(0)} KB. Comprímela en tinypng.com o usa una URL externa.`,
          );
          return;
        }
        const reader = new FileReader();
        reader.onload = () => callback(reader.result);
        reader.readAsDataURL(file);
      };
      input.click();
    },
    uploadHero() { this.pickImage((b64) => (this.content.hero.image = b64)); },
    uploadAbout() { this.pickImage((b64) => (this.content.about.image = b64)); },
    uploadGallery(i) { this.pickImage((b64) => (this.content.gallery[i].image = b64)); },

    /* ------------------- Backup JSON ------------------- */
    exportJSON() { window.LuxeContent.exportContentJSON(this.content); },
    async importJSON(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const data = await window.LuxeContent.importContentJSON(file);
        this.content = data;
        this.flash('JSON importado — revisa y pulsa Publicar para subirlo');
      } catch {
        this.flash('Archivo inválido: no es un JSON válido', 'err');
      }
      event.target.value = '';
    },

    /* ------------------- Contraseña admin ------------------- */
    changePassword(current, next, confirmNext) {
      if (current !== window.LuxeContent.getAdminPassword()) { alert('Contraseña actual incorrecta.'); return false; }
      if (!next || next.length < 4) { alert('La nueva contraseña debe tener al menos 4 caracteres.'); return false; }
      if (next !== confirmNext) { alert('La confirmación no coincide.'); return false; }
      window.LuxeContent.setAdminPassword(next);
      alert('Contraseña actualizada en este navegador.');
      return true;
    },

    flash(msg, tone = 'ok') {
      this.toast = msg;
      this.toastTone = tone;
      clearTimeout(this._t);
      this._t = setTimeout(() => (this.toast = ''), 3500);
    },
  }));
});
