# Luxe-Smile · Sitio web

Landing y panel administrativo para **Luxe-Smile** (Dra. Angela Barbosa), clínica de odontología estética.

- **Sitio público**: https://hectronix2005.github.io/Luxesmile-Web/
- **Panel admin**: https://hectronix2005.github.io/Luxesmile-Web/admin/

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
                                                                        │ PUT via GitHub Contents API
Admin (Dra.)   ──►  /admin/  ──►  edita en el navegador  ───────────────┘
```

- **Fuente única de verdad**: `assets/data/content.json` vive en este repo.
- El **sitio público** y el **admin** lo cargan con `fetch()` al abrir.
- Al pulsar **Publicar online** en el admin, se envía un `PUT /repos/.../contents/...` a la GitHub Contents API → commit automático → GitHub Pages rebuild (~1 min) → sitio actualizado.
- El **token** de la doctora vive solo en `localStorage` de su navegador (nunca se commitea).
- **Detección de conflictos**: el admin rastrea el SHA del archivo al cargarlo y aborta si otra sesión publicó en el medio.

## Estructura de archivos

```
.
├── index.html               # Landing pública
├── admin/
│   └── index.html           # Panel admin (URL limpia /admin/)
├── assets/
│   ├── css/
│   │   └── styles.css       # Estilos luxe custom
│   ├── data/
│   │   └── content.json     # Contenido editable (fuente de verdad)
│   └── js/
│       ├── content.js       # Defaults, fetch loader, GitHub API client
│       ├── app.js           # Lógica Alpine del sitio público
│       └── admin.js         # Lógica Alpine del panel admin
├── .gitignore
└── README.md
```

## Correr en local

```bash
python3 -m http.server 8000
```

- Sitio: http://localhost:8000/
- Admin: http://localhost:8000/admin/

Cualquier servidor estático sirve (`npx serve`, extensión Live Server, etc.). **No abras `index.html` con doble-clic** (`file://`): los `fetch()` de `content.json` fallan por CORS.

## Cómo editar el sitio (para la doctora)

### Setup único (2 min)

1. Abre https://hectronix2005.github.io/Luxesmile-Web/admin/
2. Login con la contraseña (default: `luxe2026` — cámbiala en pestaña **Seguridad**)
3. Pestaña **Publicación** → necesitas un **Fine-grained Personal Access Token**:
   - Entra a https://github.com/settings/personal-access-tokens/new
   - Token name: `Luxesmile-Web admin`
   - Expiration: 90 days
   - Repository access: **Only select repositories** → `Luxesmile-Web`
   - Permissions → Repository → **Contents: Read and write**
   - Generate token → **cópialo inmediatamente** (solo se muestra una vez)
4. Vuelve al admin → pégalo en el campo **Fine-grained Personal Access Token**
5. **Guardar configuración** → **Probar conexión** → debe decir "Conexión OK"

### Uso diario

1. Edita cualquier pestaña (Marca, Hero, Sobre mí, Servicios, Galería, Testimonios, Stats, Contacto, Footer).
2. Aparece arriba **● Cambios sin publicar**.
3. Click **Publicar online**.
4. ~1 minuto después, el sitio público refleja los cambios.

> **Nunca compartas tu token** (chats, emails, capturas). Si se expone, ve a https://github.com/settings/tokens y **Revoke** inmediatamente. Luego genera uno nuevo.

### Imágenes

- **URL externa** (recomendado): pega cualquier URL pública (Unsplash, Cloudinary, Imgur…).
- **Subir archivo**: botón "↑ Subir" en los campos de imagen. Se convierte a base64 y se guarda dentro del JSON. Máximo **~900 KB** por imagen para no inflar el archivo.

### Backup manual

Pestaña **Backup** → **Exportar JSON** descarga `luxesmile-contenido-YYYY-MM-DD.json`. Guárdalo en Google Drive de vez en cuando.

Para restaurar un backup: **Importar JSON** → revisa los campos → **Publicar online**.

## Seguridad

- La contraseña del admin es un portón básico (no cifrada). Limita el acceso casual pero no sustituye la autenticación del token.
- El token fine-grained está limitado al repo `Luxesmile-Web` con permiso solo a Contents. Aunque se filtre, el atacante solo puede editar este repo.
- El admin vive en `localStorage` por navegador: cada equipo donde entre la doctora debe reconfigurar su token una vez.

## Despliegue

Cualquier push a `main` dispara un rebuild de GitHub Pages automáticamente. No hay CI/CD que configurar.

Para un deploy alterno (Netlify / Vercel / Cloudflare Pages): arrastrar la carpeta a netlify.com/drop, o conectar el repo a Vercel y deployar la raíz sin build command.

## Créditos

Diseñado y construido con [Claude Code](https://claude.com/claude-code).
