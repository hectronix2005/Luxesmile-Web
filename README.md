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
- Para archivos `> 1 MB` la API contents devuelve `content` vacío; el admin detecta este caso y baja el blob crudo vía `git/blobs/{sha}` con `Accept: application/vnd.github.raw`.
- El **token** de la doctora vive solo en `localStorage` de su navegador (nunca se commitea).
- **Detección de conflictos**: el admin rastrea el SHA del archivo al cargarlo y aborta si otra sesión publicó en el medio.

## Estructura de archivos

```
.
├── index.html               # Landing pública
├── admin.html               # Redirect → /admin/
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
│       └── admin.js         # Lógica Alpine del panel admin (incluye editor de imagen)
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

1. Edita cualquier pestaña (Marca, Tema, Hero, Sobre mí, Servicios, Galería, Testimonios, Stats, Contacto, Footer).
2. Aparece arriba **● Cambios sin publicar**.
3. Click **Publicar online**.
4. ~1 minuto después, el sitio público refleja los cambios.

> **Nunca compartas tu token** (chats, emails, capturas). Si se expone, ve a https://github.com/settings/tokens y **Revoke** inmediatamente. Luego genera uno nuevo.

## Editor de imagen

Cualquier campo de imagen (Hero, Sobre mí, Galería) tiene dos botones:

- **↑ Subir** — elige un archivo del equipo, abre el editor.
- **✂ Recortar** — re-edita la imagen ya cargada (data URL o URL externa) sin volver a subirla.

### Pipeline de procesamiento

```
1. Selección o re-edición
   ↓
2. Pre-compresión interna (solo si la imagen lo necesita)
   - > 4 MB           → JPEG 2400 px lado mayor, calidad 0.90
   - resto > 3500 px  → JPEG 3500 px lado mayor, calidad 0.95
   - URLs externas    → fetch + conversión a data URL (evita canvas tainted por CORS)
   ↓
3. Auto-encuadre de bordes uniformes
   - Lee las 4 esquinas; si coinciden en color (tolerancia 22),
     trata ese color como fondo y busca el bbox del contenido
     real recorriendo filas/columnas con tolerancia 24/canal.
   - Si el margen detectado es ≥ 4 % del lado mayor, fija
     zoom + offsets para mostrar solo el bbox.
   ↓
4. Edición manual (opcional)
   - Proporción: 4:5 / 3:4 / 1:1 / 16:9 / Original
   - Zoom 0.1× a 5× (debajo de 1× la imagen no cubre el recorte)
   - Drag para encuadrar (mouse + touch); rueda para zoom
   - Tamaño final: 600 / 800 / 1000 / 1200 / 1600 px de ancho
   - Calidad JPEG: 50–95 %
   - Botón ✨ Auto-encuadrar para reaplicar la detección
   ↓
5. Aplicar → compresión adaptativa
   - Si pesa > 900 KB con la calidad elegida:
     baja a 0.80 → 0.72 → 0.65 → 0.58 manteniendo el tamaño.
   - Si aún no cabe: prueba 1200 / 1000 / 800 / 700 / 600 px
     con calidad 0.70 hasta caber.
   - Toast con el resultado real ("Comprimida a 612 KB / 1000×1250").
   - Sin alertas bloqueantes.
```

### Defaults por tipo de imagen

| Campo      | Proporción | Ancho final |
|------------|-----------|-------------|
| Galería    | 4:5       | 1000 px     |
| Sobre mí   | 4:5       | 900 px      |
| Hero       | Original  | 1600 px     |

### Recomendaciones para la fuente

- Foto limpia, sin marcos ni texto baked-in.
- Si la fuente trae bordes uniformes (blanco, melocotón, etc.), el auto-encuadre los recorta solo. Si tiene marcos asimétricos o esquinas de distinto color, encuadra a mano.
- Para galería ideal: vertical, sujeto centrado, fondo limpio.

## Backup manual

Pestaña **Backup** → **Exportar JSON** descarga `luxesmile-contenido-YYYY-MM-DD.json`. Guárdalo en Google Drive de vez en cuando.

Para restaurar un backup: **Importar JSON** → revisa los campos → **Publicar online**.

## Seguridad

- La contraseña del admin es un portón básico (no cifrada). Limita el acceso casual pero no sustituye la autenticación del token.
- El token fine-grained está limitado al repo `Luxesmile-Web` con permiso solo a Contents. Aunque se filtre, el atacante solo puede editar este repo.
- El admin vive en `localStorage` por navegador: cada equipo donde entre la doctora debe reconfigurar su token una vez.

## Despliegue

Cualquier push a `main` dispara un rebuild de GitHub Pages automáticamente. No hay CI/CD que configurar.

### Cache-busting

`admin/index.html` e `index.html` referencian sus assets locales con `?v=YYYYMMDD<letra>` (p. ej. `?v=20260426d`). **Cuando publiques cambios sustantivos en `admin.js`, `content.js`, `app.js` o `styles.css`**, bumpa la letra (o la fecha) en los `<script>` / `<link>` para forzar a los navegadores a re-fetchear. Hay una constante visible al inicio de `admin.js` (`window.__LUXE_ADMIN_VERSION__`) y un `console.log` con el commit corto al cargar el panel — útil para confirmar de un vistazo qué versión corre el navegador.

### Deploy alterno

Para un deploy alterno (Netlify / Vercel / Cloudflare Pages): arrastrar la carpeta a netlify.com/drop, o conectar el repo a Vercel y deployar la raíz sin build command.

## Créditos

Diseñado y construido con [Claude Code](https://claude.com/claude-code).
