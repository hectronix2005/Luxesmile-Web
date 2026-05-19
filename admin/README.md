# Panel admin · Luxe-Smile

Editor del contenido del sitio. Carga y guarda `assets/data/content.json` vía GitHub Contents API.

- **Sitio público**: https://luxesmilee.com/
- **Admin producción**: https://luxesmilee.com/admin/
- **Sitio local**: http://localhost:8000/ (`python3 -m http.server 8000` desde la raíz del repo)
- **Admin local**: http://localhost:8000/admin/

## Login

1. Contraseña del admin (default `luxe2026`, cambiable en pestaña **Seguridad**).
2. Fine-grained Personal Access Token con permiso `Contents: Read and write` sobre el repo `Luxesmile-Web`. Se pega en pestaña **Publicación** y vive solo en `localStorage` del navegador.

Setup detallado y pipeline de imágenes: ver [README raíz](../README.md).

## Flujo

Editar pestañas → **Publicar online** → `PUT` a GitHub Contents API → commit → GitHub Pages rebuild (~1 min) → sitio actualizado.
