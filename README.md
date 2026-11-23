# Luxe-Smile · Sitio web

Sitio web de **Luxe-Smile** (Dra. Angela Barbosa), clínica de odontología estética.

- **Sitio público**: https://luxesmilee.com/

> URLs alternas (mismo contenido): https://hectronix2005.github.io/Luxesmile-Web/. Útil si el dominio falla.

## Stack

Sitio estático sin backend. Se despliega con GitHub Pages.

- HTML + [Tailwind CSS](https://tailwindcss.com) (vía CDN)
- [Alpine.js](https://alpinejs.dev) para reactividad
- Tipografías Google Fonts: Cormorant Garamond (serif) + Inter (sans)
- Paleta: ivory · rose gold · charcoal

## Arquitectura

```
Usuario final  ──►  GitHub Pages  ──►  index.html  ──fetch──►  assets/data/content.json
                                                                        ▲
                                                     commit a main ─────┘
```

- **Fuente única de verdad**: `assets/data/content.json` vive en este repo.
- El sitio lo carga con `fetch()` al abrir; `DEFAULT_CONTENT` (en `content.js`) es la reserva.
- Para cambiar contenido: editar `content.json` (o el HTML) en una rama, PR y unir a `main`.
  El Action `Build` regenera lo estático y Pages publica (~1 min).
- **No hay panel admin desde el 23-nov-2026.** El de antes (`/admin/` y `/marketing/`)
  comparaba la contraseña en el navegador y guardaba en `localStorage` un token de GitHub
  con permiso de escritura. Se retiró por seguridad; `content.js` borra esas dos claves del
  navegador de quien lo tuviera configurado, y `scripts/test-paginas.mjs` §5 se pone rojo
  si vuelve. Si algún día hace falta que la doctora edite sola, tiene que ser con login en
  servidor (librería probada) y el token fuera del navegador.

## Estructura de archivos

```
.
├── index.html               # Landing pública
├── assets/
│   ├── css/
│   │   └── styles.css       # Estilos luxe custom
│   ├── data/
│   │   └── content.json     # Contenido editable (fuente de verdad)
│   └── js/
│       ├── content.js       # Defaults, carga de content.json, tema
│       └── app.js           # Lógica Alpine del sitio público
├── .gitignore
└── README.md
```

## Correr en local

```bash
python3 -m http.server 8000
```

- Sitio: http://localhost:8000/

Cualquier servidor estático sirve (`npx serve`, extensión Live Server, etc.). **No abras `index.html` con doble-clic** (`file://`): los `fetch()` de `content.json` fallan por CORS.

## Seguridad

- El sitio no tiene login ni guarda credenciales en el navegador.
- `scripts/extract-images.mjs` sigue convirtiendo a WebP cualquier imagen en base64 que
  llegue a `content.json` (lo hacía el admin; hoy no debería llegar ninguna).

## Despliegue

Cualquier push a `main` dispara un rebuild de GitHub Pages automáticamente. No hay CI/CD que configurar.

### Dominio

`luxesmilee.com` está registrado en **Name.com** y su DNS está delegado a **Netlify DNS** (cuenta `hectorn.personal@gmail.com`). El sitio se sirve desde GitHub Pages vía custom domain (archivo `CNAME` en raíz del repo + `https_enforced=true`). Los registros DNS son:

- `A` apex → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` `www` → `hectronix2005.github.io.`

GitHub redirige automáticamente `www.luxesmilee.com` → `luxesmilee.com` con 301. El certificado TLS lo emite Let's Encrypt automáticamente; renueva sin intervención.

### Cache-busting

Las páginas referencian sus assets locales con `?v=YYYYMMDD<letra>` (p. ej. `?v=20261123a`). **Cuando cambies `content.js`, `app.js` o `styles.css`**, bumpa la versión en TODOS los ficheros que lo referencian (`grep -rl "content.js?v="`), no en una lista fija.

### Deploy alterno

Para un deploy alterno (Netlify / Vercel / Cloudflare Pages): arrastrar la carpeta a netlify.com/drop, o conectar el repo a Vercel y deployar la raíz sin build command.

## Créditos

Diseñado y construido con [Claude Code](https://claude.com/claude-code).
