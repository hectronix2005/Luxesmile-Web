/* =====================================================================
   Luxe-Smile · Panel admin
   Edita el contenido y publica directo al repo vía GitHub API.
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  // Estado del editor de imagen mantenido fuera de Alpine para no observar
  // el HTMLImageElement ni el estado transitorio de arrastre.
  let editorImg = null;
  let editorDrag = null;

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

    // Editor de imagen (modal con zoom, recorte y compresión)
    editor: {
      open: false,
      natW: 0, natH: 0,
      aspect: '4:5',
      outputW: 1000,
      quality: 0.85,
      zoom: 1,
      offsetX: 0, offsetY: 0,
      estimateKB: 0,
      callback: null,
    },

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

    /* ------------------- Imágenes (editor con zoom, recorte y compresión) ------------------- */
    pickImage(callback, opts = {}) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.openEditor(reader.result, opts, callback);
        reader.readAsDataURL(file);
      };
      input.click();
    },
    uploadHero() {
      this.pickImage(
        (b64) => (this.content.hero.image = b64),
        { defaultAspect: 'free', defaultOutputW: 1600 },
      );
    },
    uploadAbout() {
      this.pickImage(
        (b64) => (this.content.about.image = b64),
        { defaultAspect: '4:5', defaultOutputW: 900 },
      );
    },
    uploadGallery(i) {
      this.pickImage(
        (b64) => (this.content.gallery[i].image = b64),
        { defaultAspect: '4:5', defaultOutputW: 1000 },
      );
    },

    /* ------- Re-edición de imágenes ya cargadas ------- */
    async editHero() {
      const src = await this.fetchEditableSrc(this.content.hero.image);
      if (!src) return;
      this.openEditor(src, { defaultAspect: 'free', defaultOutputW: 1600 },
        (b64) => (this.content.hero.image = b64));
    },
    async editAbout() {
      const src = await this.fetchEditableSrc(this.content.about.image);
      if (!src) return;
      this.openEditor(src, { defaultAspect: '4:5', defaultOutputW: 900 },
        (b64) => (this.content.about.image = b64));
    },
    async editGallery(i) {
      const src = await this.fetchEditableSrc(this.content.gallery[i].image);
      if (!src) return;
      this.openEditor(src, { defaultAspect: '4:5', defaultOutputW: 1000 },
        (b64) => (this.content.gallery[i].image = b64));
    },
    // Convierte URLs externas a data URL para evitar canvas tainting (CORS).
    // Las imágenes data: o blob: pasan tal cual.
    async fetchEditableSrc(src) {
      if (!src) { this.flash('No hay imagen para editar', 'err'); return null; }
      if (src.startsWith('data:') || src.startsWith('blob:')) return src;
      try {
        const r = await fetch(src, { mode: 'cors' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        return await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
      } catch (e) {
        this.flash(`No se pudo cargar la imagen externa para editarla: ${e.message}`, 'err');
        return null;
      }
    },

    /* ------- Editor de imagen ------- */
    openEditor(src, opts, callback) {
      const img = new Image();
      img.onload = () => {
        editorImg = img;
        this.editor.natW = img.naturalWidth;
        this.editor.natH = img.naturalHeight;
        this.editor.aspect = opts.defaultAspect ?? '4:5';
        this.editor.outputW = opts.defaultOutputW ?? 1000;
        this.editor.quality = 0.85;
        this.editor.zoom = 1;
        this.editor.offsetX = 0;
        this.editor.offsetY = 0;
        this.editor.callback = callback;
        this.editor.open = true;
        this.$nextTick(() => {
          this.editorCenter();
          this.editorRender();
        });
      };
      img.onerror = () => this.flash('No se pudo leer la imagen', 'err');
      img.src = src;
    },
    editorAspectRatio() {
      switch (this.editor.aspect) {
        case '1:1': return [1, 1];
        case '16:9': return [16, 9];
        case '3:4': return [3, 4];
        case '4:5': return [4, 5];
        case 'free': return [this.editor.natW || 1, this.editor.natH || 1];
        default: return [4, 5];
      }
    },
    editorCropSize() {
      const maxW = 380, maxH = 480;
      const [aw, ah] = this.editorAspectRatio();
      let cw = maxW, ch = (cw * ah) / aw;
      if (ch > maxH) { ch = maxH; cw = (ch * aw) / ah; }
      return { w: Math.round(cw), h: Math.round(ch) };
    },
    editorOutputSize() {
      const [aw, ah] = this.editorAspectRatio();
      const w = this.editor.outputW;
      const h = Math.round((w * ah) / aw);
      return { w, h };
    },
    editorBaseScale() {
      const { w: cw, h: ch } = this.editorCropSize();
      return Math.max(cw / this.editor.natW, ch / this.editor.natH);
    },
    editorEffScale() {
      return this.editorBaseScale() * this.editor.zoom;
    },
    editorCenter() {
      const { w: cw, h: ch } = this.editorCropSize();
      const eff = this.editorEffScale();
      this.editor.offsetX = (cw - this.editor.natW * eff) / 2;
      this.editor.offsetY = (ch - this.editor.natH * eff) / 2;
    },
    editorClamp() {
      const { w: cw, h: ch } = this.editorCropSize();
      const eff = this.editorEffScale();
      const dispW = this.editor.natW * eff;
      const dispH = this.editor.natH * eff;
      const minX = cw - dispW;
      const minY = ch - dispH;
      if (this.editor.offsetX > 0) this.editor.offsetX = 0;
      if (this.editor.offsetX < minX) this.editor.offsetX = minX;
      if (this.editor.offsetY > 0) this.editor.offsetY = 0;
      if (this.editor.offsetY < minY) this.editor.offsetY = minY;
    },
    editorRender() {
      if (!editorImg) return;
      const cnv = this.$refs.editorCanvas;
      if (!cnv) return;
      const { w: cw, h: ch } = this.editorCropSize();
      cnv.width = cw; cnv.height = ch;
      cnv.style.width = cw + 'px';
      cnv.style.height = ch + 'px';
      this.editorClamp();
      const eff = this.editorEffScale();
      const ctx = cnv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(
        editorImg,
        this.editor.offsetX,
        this.editor.offsetY,
        this.editor.natW * eff,
        this.editor.natH * eff,
      );
      this.editorEstimate();
    },
    editorEstimate() {
      // Heurística de tamaño JPEG ≈ ancho × alto × bytes/píxel
      const { w, h } = this.editorOutputSize();
      const bpp = 0.04 + (this.editor.quality - 0.5) * 0.4;
      this.editor.estimateKB = Math.max(15, Math.round((w * h * bpp) / 1024));
    },
    editorOutputUpscale() {
      // >1 cuando el resultado es mayor que el área fuente recortada (pierde nitidez)
      const eff = this.editorEffScale();
      const { w: cw } = this.editorCropSize();
      const { w: ow } = this.editorOutputSize();
      return (ow * eff) / cw;
    },
    editorChangeAspect(a) {
      this.editor.aspect = a;
      this.editor.zoom = 1;
      this.$nextTick(() => { this.editorCenter(); this.editorRender(); });
    },
    editorChangeZoom(v) {
      this.editor.zoom = +v;
      this.editorRender();
    },
    editorMouseDown(e) {
      editorDrag = { x: e.clientX, y: e.clientY, ox: this.editor.offsetX, oy: this.editor.offsetY };
      e.preventDefault();
    },
    editorMouseMove(e) {
      if (!editorDrag) return;
      this.editor.offsetX = editorDrag.ox + (e.clientX - editorDrag.x);
      this.editor.offsetY = editorDrag.oy + (e.clientY - editorDrag.y);
      this.editorRender();
    },
    editorMouseUp() { editorDrag = null; },
    editorTouchStart(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      editorDrag = { x: t.clientX, y: t.clientY, ox: this.editor.offsetX, oy: this.editor.offsetY };
    },
    editorTouchMove(e) {
      if (!editorDrag || e.touches.length !== 1) return;
      const t = e.touches[0];
      this.editor.offsetX = editorDrag.ox + (t.clientX - editorDrag.x);
      this.editor.offsetY = editorDrag.oy + (t.clientY - editorDrag.y);
      this.editorRender();
    },
    editorTouchEnd() { editorDrag = null; },
    editorWheel(e) {
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const z = Math.max(1, Math.min(5, this.editor.zoom * factor));
      this.editor.zoom = +z.toFixed(3);
      this.editorRender();
    },
    editorApply() {
      if (!editorImg) return;
      const { w: cw } = this.editorCropSize();
      const { w: ow, h: oh } = this.editorOutputSize();
      const k = ow / cw;
      const eff = this.editorEffScale();
      const out = document.createElement('canvas');
      out.width = ow; out.height = oh;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ow, oh);
      ctx.drawImage(
        editorImg,
        this.editor.offsetX * k,
        this.editor.offsetY * k,
        this.editor.natW * eff * k,
        this.editor.natH * eff * k,
      );
      const dataURL = out.toDataURL('image/jpeg', this.editor.quality);
      const realKB = Math.round((dataURL.length * 0.75) / 1024);
      if (realKB > 900) {
        if (!confirm(`La imagen final pesa ${realKB} KB y supera el límite recomendado (900 KB). ¿Aplicarla igualmente? Sugerencia: baja la calidad o reduce el tamaño final.`)) {
          this.editor.estimateKB = realKB;
          return;
        }
      }
      const cb = this.editor.callback;
      this.editorClose();
      if (cb) cb(dataURL);
    },
    editorCancel() { this.editorClose(); },
    editorClose() {
      this.editor.open = false;
      this.editor.callback = null;
      editorImg = null;
      editorDrag = null;
    },

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
