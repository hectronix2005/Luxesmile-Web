/* =====================================================================
   Luxe-Smile · La direccion de la ficha de Google sirve el sitio entero
   ---------------------------------------------------------------------
   /Dra.Angela_Barbosa/ es la direccion que se reparte junto a la ficha de
   Google. Hasta el 18-sep-2026 era un puente: una pagina delgada que
   rebotaba al inicio. Rebotar tiene un efecto que se ve enseguida — quien
   entraba por ahi terminaba mirando `luxesmilee.com/#inicio` en la barra,
   que es justo la direccion que no se queria repartir.

   Asi que deja de rebotar: esa ruta SIRVE el inicio, y la URL se queda.

   No es una copia a mano. Se genera desde index.html en cada build, porque
   dos ficheros con el mismo contenido mantenidos por separado divergen —
   es la forma de fallo que mas veces ha aparecido en este repo. Si alguien
   edita el inicio y no vuelve a correr esto, test-paginas.mjs lo para.

   LA TRAMPA QUE HACE FALTA ESQUIVAR
   El inicio pide siete de sus ficheros en RELATIVO (`assets/js/app.js`).
   Desde /Dra.Angela_Barbosa/ eso apunta a /Dra.Angela_Barbosa/assets/... ,
   que no existe: los cuatro <script> darian 404, Alpine no arrancaria y la
   pagina saldria EN BLANCO — los 58 bloques nacen con opacity:0 y es Alpine
   quien los enciende. Por eso se reescriben a absoluto.
   No vale con una lista de los siete: la regla mira todos los href/src
   literales, para que uno nuevo quede cubierto sin que nadie se acuerde.

   Uso:  node scripts/build-ficha.mjs           genera
         node scripts/build-ficha.mjs --check   falla si el disco no coincide
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** La ruta que va en la ficha de Google. Las mayusculas importan: GitHub
 *  Pages distingue, y /dra.angela_barbosa dio 404 comprobado en produccion. */
export const RUTA_FICHA = 'Dra.Angela_Barbosa';
/** La grafia que teclearia una persona. Alias, no copia: rebota a la de arriba. */
export const RUTA_ALIAS = 'dra-angela-barbosa';

const MARCA = '<!-- GENERADO por scripts/build-ficha.mjs desde index.html — no editar a mano -->';

/* El mismo fragmento que propaga sync-fuentes.mjs y emite build-blog.mjs. Se lee
   en vez de copiarse porque test-paginas.mjs exige que las 21 paginas lleven el
   bloque IDENTICO, y una copia pegada aqui divergiria en cuanto alguien tocara
   el original. Estas dos paginas ya NO estan en la lista de sync-fuentes: las
   genera este script, y dos propagadores sobre el mismo fichero se pisan. */
const FAVICON = readFileSync(join(ROOT, 'scripts/fragmentos/favicon.html'), 'utf8').replace(/\n$/, '');

/**
 * Pasa a absolutas las direcciones relativas de un HTML pensado para la raiz.
 * Deja en paz:
 *   - las expresiones de Alpine (`:href`, `x-bind:href`), que no son rutas
 *   - anclas, protocolos y lo que ya es absoluto
 */
export function aAbsoluto(html) {
  return html.replace(
    /(^|[\s])((?::|x-bind:)?)(href|src)="([^"]*)"/g,
    (todo, antes, bind, attr, val) => {
      if (bind) return todo;
      if (/^(#|\/|https?:|mailto:|tel:|data:|javascript:)/.test(val)) return todo;
      return `${antes}${attr}="/${val}"`;
    },
  );
}

/** El HTML que le toca a /Dra.Angela_Barbosa/index.html. */
export function paginaFicha(inicio) {
  const html = aAbsoluto(inicio);
  /* El canonical sigue apuntando al inicio a proposito: dos direcciones
     sirven lo mismo y solo una puede ser la indexada. Consolidar en la raiz
     mantiene donde ya estan las senales. Cambiarlo es una linea, pero es una
     decision de posicionamiento, no de codigo. */
  return html.replace('<html lang="es">', `<html lang="es">\n${MARCA}`);
}

/** El HTML del alias: no repite el sitio, lleva a la direccion buena. */
export function paginaAlias() {
  const destino = `/${RUTA_FICHA}/`;
  return `<!DOCTYPE html>
<html lang="es">
${MARCA}
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dra. Angela Barbosa — Luxe-Smile</title>
  <!-- Alias en la grafia que teclearia una persona: minusculas y guion.
       /dra.angela_barbosa daria 404 (GitHub Pages distingue mayusculas) y
       Google lee «Angela_Barbosa» como un termino unico, no como dos.
       No repite el sitio: lleva a la direccion que va en la ficha. -->
  <link rel="canonical" href="https://luxesmilee.com${destino}" />
  <meta http-equiv="refresh" content="0; url=${destino}" />
${FAVICON}
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #F7F8FA; color: #202630; }
    @media (prefers-color-scheme: dark) { body { background: #161C26; color: #E7ECF2; } }
    .caja { text-align: center; padding: 2rem 1.5rem; max-width: 24rem; }
    p { margin: 0 0 1.25rem; font-size: 1rem; line-height: 1.5; }
    a { display: inline-block; padding: .7rem 1.35rem; background: #1F3A57; color: #fff;
      text-decoration: none; border-radius: 999px; font-weight: 600; font-size: .95rem; }
  </style>
</head>
<body>
  <div class="caja">
    <p>Dra. Angela Barbosa — Luxe-Smile, Chicó, Bogotá.</p>
    <a href="${destino}">Ir al sitio</a>
  </div>
  <script>location.replace('${destino}');</script>
</body>
</html>
`;
}

/** Lo que DEBERIA haber en disco, por ruta. Lo usa tambien test-paginas.mjs. */
export function salidaEsperada() {
  const inicio = readFileSync(join(ROOT, 'index.html'), 'utf8');
  return new Map([
    [`${RUTA_FICHA}/index.html`, paginaFicha(inicio)],
    [`${RUTA_ALIAS}/index.html`, paginaAlias()],
  ]);
}

if (process.argv[1] && process.argv[1].endsWith('build-ficha.mjs')) {
  const comprobar = process.argv.includes('--check');
  const esperado = salidaEsperada();
  const distintos = [];

  for (const [rel, quieroQue] of esperado) {
    let hay = null;
    try { hay = readFileSync(join(ROOT, rel), 'utf8'); } catch { /* no existe aun */ }
    if (hay === quieroQue) continue;
    distintos.push(rel);
    if (!comprobar) {
      mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
      writeFileSync(join(ROOT, rel), quieroQue);
    }
  }

  if (comprobar) {
    if (distintos.length) {
      console.error('✗ La direccion de la ficha no coincide con index.html:');
      for (const r of distintos) console.error(`    ${r}`);
      console.error('  Arreglo:  node scripts/build-ficha.mjs');
      process.exit(1);
    }
    console.log('✓ /Dra.Angela_Barbosa/ al dia con el inicio');
  } else {
    console.log(distintos.length
      ? `✓ Ficha regenerada (${distintos.length}): ${distintos.join(', ')}`
      : '✓ Ficha ya estaba al dia');
  }
}
