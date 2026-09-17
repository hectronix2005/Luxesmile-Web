/* =====================================================================
   Luxe-Smile · Panel de marketing
   Análisis de tráfico y etiquetado. Solo lectura: esta página no publica
   nada al repo ni edita contenido.

   Por qué vive aparte del admin: el admin edita el sitio, esto lo mide.
   Comparte la contraseña y la sesión con el admin a propósito, para no
   tener dos credenciales que recordar.
   ===================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('marketing', () => ({
    authed: false,
    passwordInput: '',
    loginError: '',
    needsSetup: !window.LuxeContent.hasAdminPassword(),
    tab: 'traffic',
    toast: '',
    toastTone: 'ok',

    tabs: [
      { id: 'traffic', label: 'Tráfico' },
      { id: 'funnel',  label: 'Embudo' },
      { id: 'pixel',   label: 'Etiquetado' },
      { id: 'pending', label: 'Qué falta' },
    ],

    // Estado de las dos fuentes que SÍ se pueden consultar desde el navegador.
    // ids arranca relleno, no en null: x-show oculta el bloque pero Alpine
    // sigue evaluando las expresiones de dentro, y `null.problems` lanzaba.
    pixel: {
      running: false, ran: false, pages: [], error: '', aviso: '',
      ids: { ga4: '', googleAds: '', metaPixel: '', whatsapp: '', agenda: '', llamada: '', problems: [] },
    },
    ga: {
      clientId: localStorage.getItem('luxesmile_ga_client_id') || '',
      propertyId: localStorage.getItem('luxesmile_ga_property_id') || '',
      days: 28,
      token: '',
      connecting: false,
      loading: false,
      error: '',
      summary: null,
      sources: [],
      pages: [],
      events: [],
      byDow: [],       // tráfico y clics de WhatsApp por día de la semana
    },

    // init nunca debe lanzar: una excepción aquí deja la página en blanco.
    // Ya pasó una vez en el sitio público (incidente del 7-jul-2026).
    init() {
      try {
        if (sessionStorage.getItem('luxesmile_admin_ok') === '1') this.authed = true;
      } catch (e) {
        console.warn('[marketing] no se pudo leer la sesión:', e);
      }
    },

    /* ------------------- Auth (misma puerta que el admin) ------------------- */

    async login() {
      const correcta = await window.LuxeContent.getAdminPassword();
      if (!correcta) {
        this.needsSetup = true;
        this.loginError = 'Este navegador todavía no tiene contraseña. Defínela en el panel admin.';
        this.passwordInput = '';
        return;
      }
      if (this.passwordInput === correcta) {
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

    /* ------------------- 1. Etiquetado (sin credenciales) ------------------- */

    // Esto era una lista escrita a mano de cinco páginas, y el sitio tiene quince:
    // fuera quedaban /privacidad/ y los nueve artículos del blog, todos con su
    // enlace a WhatsApp. El diagnóstico salía en verde sin haber mirado dos tercios
    // del sitio. Ahora sale del sitemap, que genera build-blog.mjs desde
    // content.json: una página nueva entra sola.
    //


    // La lógica vive en content.js: la tenían admin.js y marketing.js por
    // duplicado y divergieron en cuanto arreglé una sola. Aquí sólo se guarda.
    async runPixelCheck() {
      const p = this.pixel;
      p.running = true; p.error = ''; p.pages = []; p.aviso = '';
      try {
        const { ids, pages, aviso } = await window.LuxeContent.diagnosticoDePixel('../');
        p.ids = ids;          // una sola asignación: nunca hay un estado sin `problems`
        p.pages = pages;
        p.aviso = aviso;
        p.ran = true;
      } catch (e) {
        p.error = e.message || 'Error inesperado';
      } finally {
        p.running = false;
      }
    },

    /* ------------------- 2. Tráfico (GA4 Data API) ------------------- */

    saveGaConfig() {
      const g = this.ga;
      localStorage.setItem('luxesmile_ga_client_id', g.clientId.trim());
      localStorage.setItem('luxesmile_ga_property_id', g.propertyId.trim().replace(/\D/g, ''));
      this.flash('Configuración de GA4 guardada en este navegador.');
    },

    _loadGis() {
      if (window.google?.accounts?.oauth2) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar el SDK de Google.'));
        document.head.appendChild(s);
      });
    },

    async gaConnect() {
      const g = this.ga;
      g.error = '';
      if (!g.clientId.trim())   { g.error = 'Falta el Client ID de OAuth.'; return; }
      if (!g.propertyId.trim()) { g.error = 'Falta el ID de propiedad de GA4.'; return; }
      g.connecting = true;
      try {
        await this._loadGis();
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: g.clientId.trim(),
          scope: 'https://www.googleapis.com/auth/analytics.readonly',
          callback: (resp) => {
            g.connecting = false;
            if (resp.error) { g.error = 'Google rechazó el acceso: ' + resp.error; return; }
            g.token = resp.access_token;
            this.gaLoadReports();
          },
        });
        client.requestAccessToken();
      } catch (e) {
        g.connecting = false;
        g.error = e.message || 'No se pudo iniciar sesión.';
      }
    },

    gaDisconnect() {
      const g = this.ga;
      g.token = ''; g.summary = null; g.sources = []; g.pages = []; g.events = []; g.byDow = []; g.error = '';
    },

    async _gaReport(body) {
      const g = this.ga;
      const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${g.propertyId.trim().replace(/\D/g, '')}:runReport`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + g.token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      return json;
    },

    async gaLoadReports() {
      const g = this.ga;
      g.loading = true; g.error = '';
      const range = [{ startDate: `${g.days}daysAgo`, endDate: 'today' }];
      const filas = (r) => (r.rows || []).map((x) => ({
        label: x.dimensionValues[0].value,
        value: Number(x.metricValues[0].value),
      }));
      try {
        const sum = await this._gaReport({
          dateRanges: range,
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'bounceRate' }],
        });
        const v = sum.rows?.[0]?.metricValues || [];
        g.summary = {
          users: Number(v[0]?.value || 0),
          sessions: Number(v[1]?.value || 0),
          views: Number(v[2]?.value || 0),
          bounce: Math.round(Number(v[3]?.value || 0) * 100),
        };

        g.sources = filas(await this._gaReport({
          dateRanges: range,
          dimensions: [{ name: 'sessionSourceMedium' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 8,
        }));

        g.pages = filas(await this._gaReport({
          dateRanges: range,
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 8,
        }));

        const ev = await this._gaReport({
          dateRanges: range,
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 15,
        });
        const conversiones = ['whatsapp_click', 'schedule_click', 'call_click'];
        g.events = (ev.rows || []).map((r) => ({
          label: r.dimensionValues[0].value,
          value: Number(r.metricValues[0].value),
          isConversion: conversiones.includes(r.dimensionValues[0].value),
        }));

        await this._gaLoadDow(range);
      } catch (e) {
        g.error = e.message || 'No se pudieron cargar los informes.';
      } finally {
        g.loading = false;
      }
    },

    // Reparto por día de la semana. Está aquí y no en el admin porque es la
    // pregunta de marketing que tenemos abierta: si el fin de semana entra
    // tráfico pero no entran contactos, el problema no es la pauta.
    async _gaLoadDow(range) {
      const g = this.ga;
      const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const ses = await this._gaReport({
        dateRanges: range,
        dimensions: [{ name: 'dayOfWeek' }],
        metrics: [{ name: 'sessions' }],
      });
      const wa = await this._gaReport({
        dateRanges: range,
        dimensions: [{ name: 'dayOfWeek' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { value: 'whatsapp_click' } },
        },
      });
      const aMapa = (r) => Object.fromEntries(
        (r.rows || []).map((x) => [Number(x.dimensionValues[0].value), Number(x.metricValues[0].value)]),
      );
      const mSes = aMapa(ses), mWa = aMapa(wa);
      // 1..6 y luego 0, para que la semana empiece en lunes y no en domingo.
      g.byDow = [1, 2, 3, 4, 5, 6, 0].map((i) => {
        const s = mSes[i] || 0, w = mWa[i] || 0;
        return {
          label: NOMBRES[i],
          finde: i === 0 || i === 6,
          sessions: s,
          wa: w,
          rate: s ? (100 * w) / s : null,
        };
      });
    },

    /* ---- El agujero que este panel NO puede ver por sí mismo ----
       Del 14 al 17 de septiembre de 2026 el sitio dejó de registrar el clic a
       WhatsApp: el listener que dispara la conversión buscaba enlaces con 'wa.me'
       y el enrutado a Zeus los había convertido en enlaces al redirector. Los
       clics ocurrieron y llegaron a Zeus; lo que no ocurrió fue el evento.

       O sea que en esa ventana `whatsapp_click` vale cero por un fallo de
       medición, no porque nadie escribiera. Un cero sin explicación al lado se
       lee como un dato, y éste no lo es. Si el rango elegido la toca, se dice.

       Cuando la ventana quede fuera del rango que se suele mirar, esto sobra y
       se puede borrar entero. */
    get ventanaCiega() {
      const DESDE = new Date('2026-09-14T00:00:00-05:00');
      const HASTA = new Date('2026-09-17T23:59:59-05:00');
      const inicio = new Date(Date.now() - this.ga.days * 86400000);
      if (inicio > HASTA) return null;
      return 'Del 14 al 17 de septiembre el sitio no registró el clic a WhatsApp: '
        + 'el evento no se disparaba porque el enlace ya apuntaba al redirector. '
        + 'Los clics existieron y llegaron a Zeus. En esos días el cero de '
        + '«Clic a WhatsApp» es un fallo de medición, no una caída de interés.';
    },

    /* ------------------- 3. Embudo, derivado de lo anterior ------------------- */
    // No hay ningún número inventado aquí: todo sale de g.summary y g.events.
    get funnel() {
      const g = this.ga;
      if (!g.summary) return null;
      const cuenta = (n) => g.events.find((e) => e.label === n)?.value || 0;
      const sesiones = g.summary.sessions;
      const wa = cuenta('whatsapp_click');
      const agenda = cuenta('schedule_click');
      const llamada = cuenta('call_click');
      const pct = (x) => (sesiones ? (100 * x) / sesiones : null);
      return {
        sesiones,
        pasos: [
          { label: 'Sesiones en el sitio', v: sesiones, pct: 100 },
          { label: 'Clic a WhatsApp',      v: wa,      pct: pct(wa) },
          { label: 'Clic a agendar',       v: agenda,  pct: pct(agenda) },
          { label: 'Clic a llamar',        v: llamada, pct: pct(llamada) },
        ],
        // El dato que no tenemos aquí y sí importa: de esos clics, cuántos
        // acabaron en conversación. Vive en ZEUS y el navegador no lo alcanza.
        wa,
      };
    },

    get maxDowSessions() {
      return Math.max(1, ...this.ga.byDow.map((d) => d.sessions));
    },

    flash(msg, tone = 'ok', duration = 3500) {
      this.toast = msg;
      this.toastTone = tone;
      clearTimeout(this._t);
      this._t = setTimeout(() => (this.toast = ''), duration);
    },

    fmt(n) {
      return Number(n || 0).toLocaleString('es-CO');
    },
  }));
});
