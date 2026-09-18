/**
 * sync-fuentes.mjs — content.json manda sobre todo lo que está duplicado.
 *
 * El sitio tiene datos escritos en dos sitios que nadie ataba, y eso ya costó
 * dos fallos reales (17-sep-2026):
 *
 *   · Color: styles.css guardaba la paleta rosa por defecto y content.json la
 *     azul-gris elegida. El blog y /privacidad/ no ejecutan applyTheme(), así
 *     que llevaban SIEMPRE los colores de otra paleta.
 *   · Contacto: DEFAULT_CONTENT de content.js —el fallback de loadContent()
 *     cuando falla el fetch y no hay caché, o sea una primera visita con un
 *     tropiezo de red— tenía datos de plantilla. El botón de WhatsApp llevaba
 *     a 573001234567, que no es el número de la doctora.
 *
 *   node scripts/sync-fuentes.mjs             escribe
 *   node scripts/sync-fuentes.mjs --check     no escribe; sale 1 si hay diferencia
 *   node scripts/sync-fuentes.mjs --autotest  demuestra que sabe ponerse ROJO
 *
 * Lo de --autotest no es adorno. Auditando el sitio ese mismo día, CINCO
 * comprobadores dieron rojo por su propio fallo y no por el del sitio. Un
 * comprobador que no demuestra que sabe ponerse rojo no vale como verde.
 *
 * Y el autotest tiene que ejecutar la lógica REAL sobre el texto roto. El
 * primer intento comparaba el texto mutado consigo mismo: pasaba siempre.
 * Por eso toda la sincronización vive en sincronizar(), que recibe de dónde
 * leer — así el test le puede dar ficheros rotos sin tocar el disco.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leerDisco = (p) => readFileSync(join(ROOT, p), 'utf8');

const PAGINAS_CON_RED = ['index.html', 'diseno-de-sonrisa/index.html',
  'pacientes-internacionales/index.html', 'en/smile-design/index.html'];
const RED_RE = /  <!-- RED DE SEGURIDAD DEL FADE-IN[\s\S]*?<\/script>/;

/* El favicon: mismas lineas en todas las paginas escritas a mano. Las del blog
   las emite build-blog.mjs desde este mismo fragmento. El marcador `<!-- FAVICON`
   hace de ancla: si esta, se reemplaza; si no, se inserta detras del <title>, asi
   que una pagina nueva se cubre sola la primera vez que corre esto. */
const PAGINAS_CON_FAVICON = ['index.html', 'diseno-de-sonrisa/index.html',
  'pacientes-internacionales/index.html', 'en/smile-design/index.html',
  'privacidad/index.html', 'wa/index.html',
  /* Dra.Angela_Barbosa/ y dra-angela-barbosa/ NO van aqui: desde el 18-sep-2026
     las genera scripts/build-ficha.mjs, que ya emite este mismo fragmento. Dos
     propagadores sobre el mismo fichero se pisan el uno al otro y el build deja
     de converger. Su cobertura la sigue comprobando test-paginas.mjs §9, que
     recorre TODOS los .html del repo, no una lista. */
  'admin/index.html', 'marketing/index.html', 'admin.html'];
/* El ancla TIENE que llegar hasta la ultima linea del fragmento. La primera
   version ofrecia `-->` como alternativa y, siendo perezoso el cuantificador,
   paraba en el `-->` del propio comentario: reemplazaba solo el comentario y
   dejaba los <link> viejos debajo de los nuevos. Duplicados en las 9 paginas, y
   el sincronizador nunca convergia — la segunda pasada volvia a decir que habia
   cambios. Lo destapo comprobar la idempotencia, no leer el codigo. */
const FAVICON_RE = /  <!-- FAVICON(?:[\s\S]*?<link rel="manifest"[^>]*>|\s*-->)\n/;

const VARS = { ivory: 'ivory', porcelain: 'porcelain', rosegold: 'rosegold',
  rosegoldDark: 'rosegold-dark', gold: 'gold', charcoal: 'charcoal', softblack: 'softblack' };

/**
 * Calcula el contenido que DEBERÍA tener cada fichero.
 * @param {(ruta:string)=>string} leer  de dónde salen los ficheros
 * @returns {{cambios:string[], fallos:string[], salida:Map<string,string>}}
 */
function sincronizar(leer) {
  const cambios = [], fallos = [], salida = new Map();
  const datos = JSON.parse(leer('assets/data/content.json'));
  const colores = datos?.theme?.colors, contacto = datos?.contact;
  if (!colores || !contacto) { fallos.push('content.json no tiene theme.colors o contact'); return { cambios, fallos, salida }; }

  const editar = (ruta, fn) => {
    const antes = salida.get(ruta) ?? leer(ruta);
    salida.set(ruta, fn(antes));
  };

  /* 1) Paleta -> styles.css */
  editar('assets/css/styles.css', (css) => {
    for (const [clave, nombre] of Object.entries(VARS)) {
      const hex = colores[clave];
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) {
        fallos.push(`theme.colors.${clave} no es un hex de 6 dígitos: ${JSON.stringify(hex)}`); continue;
      }
      const h = hex.toLowerCase();
      const rgb = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
      // Una variable a la vez: sobreviven formato, comentarios y --gold-soft,
      // que no existe en content.json.
      for (const [re, valor, etiqueta] of [
        [new RegExp(`(--${nombre}:\\s*)#[0-9A-Fa-f]{6}`), h, `--${nombre}`],
        [new RegExp(`(--${nombre}-rgb:\\s*)\\d+ \\d+ \\d+`), rgb, `--${nombre}-rgb`],
      ]) {
        if (!re.test(css)) { fallos.push(`no encuentro ${etiqueta} en styles.css`); continue; }
        const nuevo = css.replace(re, `$1${valor}`);
        if (nuevo !== css) cambios.push(`assets/css/styles.css  ${etiqueta} -> ${valor}`);
        css = nuevo;
      }
    }
    return css;
  });

  /* 2) contact entero -> DEFAULT_CONTENT de content.js */
  const dig = String(contacto.whatsapp || '').replace(/\D/g, '');
  if (!/^57\d{10}$/.test(dig)) fallos.push(`contact.whatsapp no son 57 + 10 dígitos: ${JSON.stringify(contacto.whatsapp)}`);

  editar('assets/js/content.js', (js) => {
    const re = /(\n  contact: \{\n)([\s\S]*?)(\n  \},)/;
    if (!re.test(js)) { fallos.push('no encuentro el bloque contact de DEFAULT_CONTENT'); return js; }
    const cuerpo = Object.entries(contacto).map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n');
    const nota = '    // GENERADO por scripts/sync-fuentes.mjs desde content.json. No editar a mano:\n'
               + '    // es el fallback que ve quien entra si el fetch de content.json falla.\n';
    const nuevo = js.replace(re, `$1${nota}${cuerpo}$3`);
    if (nuevo !== js) cambios.push(`assets/js/content.js  DEFAULT_CONTENT.contact (${Object.keys(contacto).length} campos)`);
    return nuevo;
  });

  /* 3) El número escrito a mano */
  /* El formato visible se calcula desde los DÍGITOS, no desde cómo esté escrito
     el campo. Antes se quitaba el prefijo con una regex y se reagrupaban los
     dígitos con otra, y bastaba con que la doctora escribiera su número EN EL
     MISMO FORMATO EN QUE LA PÁGINA LO MUESTRA para romperlo — comprobado
     ejecutando la lógica real, no razonándolo:

       "+57 3163903511"    -> "+57 316 390 3511"   correcto
       "+57 316 390 3511"  -> "316 390 3511"       PIERDE el indicativo
       "316 390 3511"      -> "316 390 3511"       PIERDE el indicativo
       "(316) 390-3511"    -> "(316) 390-3511"     se cuela tal cual
       ""                  -> ""                   BORRA el teléfono de la página

     Y `phone` no se validaba: sólo `whatsapp`. El indicativo es justo lo que
     necesita quien llama desde fuera, que es el público de esa página. */
  const digPhone = String(contacto.phone || '').replace(/\D/g, '');
  if (!/^57\d{10}$/.test(digPhone)) fallos.push(`contact.phone no son 57 + 10 dígitos: ${JSON.stringify(contacto.phone)}`);
  const visible = /^57\d{10}$/.test(digPhone)
    ? `+57 ${digPhone.slice(2, 5)} ${digPhone.slice(5, 8)} ${digPhone.slice(8)}`
    : '';
  const PATRONES = [
    ['index.html',                           /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['diseno-de-sonrisa/index.html',         /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['en/smile-design/index.html',           /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['pacientes-internacionales/index.html', /("telephone":\s*")\+?57\d{10}(")/g, `$1+${dig}$2`, 'JSON-LD telephone'],
    ['privacidad/index.html',                /(wa\.me\/)57\d{10}/g,               `$1${dig}`,    'wa.me'],
    ['privacidad/index.html',                /(>)\+57 3\d{2} \d{3} \d{4}(<)/g,    `$1${visible}$2`, 'teléfono visible'],
    ['wa/index.html',                        /(wa\.me\/)57\d{10}/g,               `$1${dig}`,    'wa.me'],
    ['wa/index.html',                        /(var NUMERO = ')57\d{10}(')/g,      `$1${dig}$2`,  'NUMERO'],
  ];
  /* 4) Red de seguridad del fade-in -> las cuatro páginas con secciones ocultas.
     Tiene que ir inline en cada una (ver scripts/fragmentos/red-fade.html), así que
     son cuatro copias por diseño. Lo que no puede ser es que diverjan: la fuente es
     el fragmento y esto las reescribe. scripts/test-paginas.mjs lo comprueba además
     desde fuera, por si alguien edita las páginas sin pasar por el build. */
  {
    const fragmento = leer('scripts/fragmentos/red-fade.html').replace(/\n$/, '');
    for (const ruta of PAGINAS_CON_RED) {
      editar(ruta, (s) => {
        if (!RED_RE.test(s)) { fallos.push(`no encuentro la red del fade en ${ruta}`); return s; }
        const nuevo = s.replace(RED_RE, fragmento);
        if (nuevo !== s) cambios.push(`${ruta}  red del fade-in`);
        return nuevo;
      });
    }
  }

  /* 5) Los nombres de imagen escritos a mano -> desde content.json.

     El .webp se llama `<nombre>-<hash del contenido>.webp`, asi que cambiar una
     foto en el panel la renombra. Y hay diez de esos nombres escritos a mano
     fuera de content.json: las 8 figuras de la galeria y la foto de la doctora
     en diseno-de-sonrisa (el respaldo estatico que ve un crawler o alguien sin
     JS, porque Alpine pinta la version viva encima), y el logo de /privacidad/,
     que ni siquiera carga Alpine.

     Hasta el 17-sep nada los ataba: extract-images borraba el fichero viejo como
     huerfano y la pagina se quedaba pidiendo algo inexistente. Se dejo de borrar
     y se puso un detector, pero eso solo AVISA de la divergencia. Esto la cierra.

     OJO AL ORDEN: esto tiene que correr DESPUES de extract-images. Antes de que
     convierta el base64 en fichero no hay nombre que propagar — por eso el valor
     que no sea una ruta /assets/img/content/*.webp para el build en vez de
     colarse: una pagina con un data URL de 2 MB dentro no la quiere nadie. */
  {
    const RUTA_IMG = /^\/assets\/img\/content\/[A-Za-z0-9._-]+\.webp$/;
    const fuente = (valor, etiqueta) => {
      if (RUTA_IMG.test(valor || '')) return valor;
      fallos.push(`${etiqueta} no es una ruta a un .webp extraido: ${JSON.stringify(String(valor).slice(0, 40))}`
        + ' — ¿se ejecuto extract-images antes que esto?');
      return null;
    };
    const IMAGENES = [
      ['privacidad/index.html', /\/assets\/img\/content\/logo-[A-Za-z0-9._-]+\.webp/g,
        () => fuente(datos?.brand?.logo, 'brand.logo'), 'logo'],
      ['diseno-de-sonrisa/index.html', /\/assets\/img\/content\/about-[A-Za-z0-9._-]+\.webp/g,
        () => fuente(datos?.about?.image, 'about.image'), 'foto de la doctora'],
    ];
    for (const [ruta, re, dame, etiqueta] of IMAGENES) {
      editar(ruta, (s2) => {
        re.lastIndex = 0;
        if (!re.test(s2)) { fallos.push(`no encuentro ${etiqueta} en ${ruta}`); return s2; }
        const valor = dame();
        if (!valor) return s2;
        re.lastIndex = 0;
        const nuevo = s2.replace(re, valor);
        if (nuevo !== s2) cambios.push(`${ruta}  ${etiqueta} -> ${valor.split('/').pop()}`);
        return nuevo;
      });
    }
    // La galeria va por indice: `gallery-3-…` se resuelve con content.gallery[3],
    // no por el orden en que aparezcan en el fichero.
    editar('diseno-de-sonrisa/index.html', (s2) => {
      const galeria = datos?.gallery || [];
      let tocados = 0;
      const nuevo = s2.replace(/\/assets\/img\/content\/gallery-(\d+)-[A-Za-z0-9._-]+\.webp/g, (todo, i) => {
        const item = galeria[Number(i)];
        if (!item) { fallos.push(`la pagina pide gallery-${i} y content.gallery solo tiene ${galeria.length}`); return todo; }
        const valor = fuente(item.image, `gallery[${i}].image`);
        if (!valor) return todo;
        if (valor !== todo) tocados++;
        return valor;
      });
      if (tocados) cambios.push(`diseno-de-sonrisa/index.html  ${tocados} imagen(es) de la galeria`);
      return nuevo;
    });
  }

  /* 6) Favicon -> todas las paginas escritas a mano */
  {
    const frag = leer('scripts/fragmentos/favicon.html').replace(/\n$/, '') + '\n';
    for (const ruta of PAGINAS_CON_FAVICON) {
      editar(ruta, (s2) => {
        let nuevo;
        if (FAVICON_RE.test(s2)) {
          nuevo = s2.replace(FAVICON_RE, frag);
        } else {
          const t = s2.indexOf('</title>');
          if (t < 0) { fallos.push(`${ruta} no tiene <title>: no se donde meter el favicon`); return s2; }
          const fin = s2.indexOf('\n', t) + 1;
          nuevo = s2.slice(0, fin) + '\n' + frag + s2.slice(fin);
        }
        if (nuevo !== s2) cambios.push(`${ruta}  favicon`);
        return nuevo;
      });
    }
  }

  for (const [ruta, re, rep, etiqueta] of PATRONES) {
    editar(ruta, (s) => {
      re.lastIndex = 0;
      if (!re.test(s)) { fallos.push(`no encuentro ${etiqueta} en ${ruta}`); return s; }
      re.lastIndex = 0;
      const nuevo = s.replace(re, rep);
      if (nuevo !== s) cambios.push(`${ruta}  ${etiqueta} -> ${dig}`);
      return nuevo;
    });
  }
  return { cambios, fallos, salida };
}

/* ---------------------- control positivo ---------------------- */
/* Rompe una fuente EN MEMORIA y exige que sincronizar() lo vea. No toca disco.
   Ejecuta la lógica real: si una regex deja de casar, este test se entera. */
function autotest() {
  const casos = [
    ['paleta en styles.css',   'assets/css/styles.css', (s) => s.replace(/(--gold:\s*)#[0-9a-f]{6}/, '$1#112233')],
    ['contacto en content.js', 'assets/js/content.js',  (s) => s.replace(/(phone: ")[^"]+(")/, '$1+57 3009999999$2')],
    ['número en /wa/',         'wa/index.html',         (s) => s.replace(/(wa\.me\/)57\d{10}/, '$1573009999999')],
    ['telephone del JSON-LD',  'index.html',            (s) => s.replace(/("telephone":\s*")\+?57\d{10}(")/, '$1+573009999999$2')],
    ['red del fade en la landing EN', 'en/smile-design/index.html', (s) => s.replace('setTimeout(parar, 30000)', 'setTimeout(parar, 99999)')],
    ['teléfono visible en /privacidad/', 'privacidad/index.html', (s) => s.replace(/(>)\+57 3\d{2} \d{3} \d{4}(<)/, '$1+57 300 999 9999$2')],
    ['logo de /privacidad/', 'privacidad/index.html', (s) => s.replace(/logo-[A-Za-z0-9]+\.webp/, 'logo-000000000000.webp')],
    ['galería de la landing', 'diseno-de-sonrisa/index.html', (s) => s.replace(/gallery-3-[A-Za-z0-9]+\.webp/, 'gallery-3-000000000000.webp')],
    ['foto de la doctora', 'diseno-de-sonrisa/index.html', (s) => s.replace(/about-[A-Za-z0-9]+\.webp/, 'about-000000000000.webp')],
  ];
  // Antes de nada: en limpio NO puede haber cambios. Si los hay, el resto no prueba nada.
  const limpio = sincronizar(leerDisco);
  if (limpio.cambios.length || limpio.fallos.length) {
    console.error('✗ el disco ya está desincronizado: el control positivo no sería concluyente');
    limpio.cambios.concat(limpio.fallos).forEach((c) => console.error('   ', c));
    return 1;
  }
  let mal = 0;
  for (const [nombre, ruta, romper] of casos) {
    const roto = romper(leerDisco(ruta));
    if (roto === leerDisco(ruta)) { console.error(`  ✗ ${nombre}: la mutación no cambió nada, el caso no prueba nada`); mal++; continue; }
    const { cambios } = sincronizar((p) => (p === ruta ? roto : leerDisco(p)));
    const visto = cambios.some((c) => c.startsWith(ruta));
    if (visto) console.log(`  ✓ ${nombre}: se pone rojo`);
    else { console.error(`  ✗ ${nombre}: NO lo detecta`); mal++; }
  }
  // Y los casos que NO son «un fichero se desvía», sino «content.json trae algo
  // raro». Éstos tienen que salir por `fallos`, no por `cambios`: la diferencia
  // importa, porque `fallos` PARA el build y `cambios` lo deja escribir.
  const CONTENT = 'assets/data/content.json';
  const malos = [
    ['phone sin indicativo',        (d) => { d.contact.phone = '316 390 3511'; }],
    ['phone local, sin el 57',      (d) => { d.contact.phone = '3163903511'; }],
    ['phone con paréntesis y sin 57', (d) => { d.contact.phone = '(316) 390-3511'; }],
    ['phone vacío',                 (d) => { d.contact.phone = ''; }],
    ['phone con una cifra de menos', (d) => { d.contact.phone = '+57 316 390 351'; }],
    ['whatsapp con letras',   (d) => { d.contact.whatsapp = 'escríbeme'; }],
    // Si esto corre antes que extract-images, el valor sigue siendo base64 y no
    // hay nombre que propagar. Tiene que PARAR, no meter 2 MB en el HTML.
    ['una foto todavía en base64', (d) => { d.gallery[3].image = 'data:image/png;base64,iVBORw0KGg'; }],
    ['el logo todavía en base64',  (d) => { d.brand.logo = 'data:image/png;base64,iVBORw0KGg'; }],
    ['la galería con menos fotos que figuras tiene la página',
      (d) => { d.gallery = d.gallery.slice(0, 5); }],
  ];
  for (const [nombre, romper] of malos) {
    const datos = JSON.parse(leerDisco(CONTENT));
    romper(datos);
    const { fallos } = sincronizar((p) => (p === CONTENT ? JSON.stringify(datos) : leerDisco(p)));
    if (fallos.length) console.log(`  ✓ ${nombre}: para el build ("${fallos[0].slice(0, 46)}…")`);
    else { console.error(`  ✗ ${nombre}: NO lo detecta, el build seguiría`); mal++; }
  }

  // Y al revés: el MISMO número escrito de seis maneras tiene que producir
  // siempre el mismo texto visible. Ésta es la propiedad que se rompía —el
  // formato de salida dependía de cómo estuviera tecleada la entrada— y la que
  // ningún caso de «ponerse rojo» habría detectado, porque no hay nada roto que
  // ver: sale un teléfono, sólo que sin el indicativo del país.
  const ESPERADO = '>+57 316 390 3511<';
  // Sólo grafías que LLEVAN el indicativo: un número de 10 dígitos suelto no es
  // el mismo dato, es uno ambiguo, y va arriba entre los que paran el build.
  for (const grafia of ['+57 3163903511', '+57 316 390 3511', '+573163903511',
                        '+57-316-390-3511', '57 316 390 3511', '(+57) 316 3903511']) {
    const datos = JSON.parse(leerDisco(CONTENT));
    datos.contact.phone = grafia;
    const { fallos, salida } = sincronizar((p) => (p === CONTENT ? JSON.stringify(datos) : leerDisco(p)));
    const pag = salida.get('privacidad/index.html') || '';
    if (!fallos.length && pag.includes(ESPERADO)) console.log(`  ✓ ${JSON.stringify(grafia).padEnd(22)} -> ${ESPERADO}`);
    else { console.error(`  ✗ ${JSON.stringify(grafia)}: sale mal${fallos.length ? ` (${fallos[0]})` : ''}`); mal++; }
  }

  if (mal) { console.error(`\n✗ ${mal} caso(s) que el comprobador no ve`); return 1; }
  console.log('\n✓ control positivo: todos los casos se detectan');
  return 0;
}

/* ---------------------------- main ---------------------------- */
/* --rutas imprime los ficheros que este script PUEDE escribir, sacados de una
   ejecucion real (las claves de `salida`), no de leerse a si mismo. Lo usa
   scripts/test-paginas.mjs para comprobar que el Action los commitea todos:
   hasta el 17-sep su `git add` era una lista fija de seis rutas y se dejaba
   fuera SIETE de los ocho, asi que la sincronizacion se rehacia y se tiraba en
   cada build. */
if (process.argv.includes('--rutas')) {
  const { salida } = sincronizar(leerDisco);
  console.log([...salida.keys()].sort().join('\n'));
  process.exit(0);
}

if (process.argv.includes('--autotest')) process.exit(autotest());

const { cambios, fallos, salida } = sincronizar(leerDisco);
if (fallos.length) { fallos.forEach((f) => console.error('✗', f)); process.exit(1); }

if (process.argv.includes('--check')) {
  if (cambios.length) {
    console.error('✗ hay fuentes desincronizadas con content.json:');
    cambios.forEach((c) => console.error('   ', c));
    process.exit(1);
  }
  console.log('✓ todo coincide con content.json');
} else {
  for (const [ruta, contenido] of salida) {
    if (contenido !== leerDisco(ruta)) writeFileSync(join(ROOT, ruta), contenido);
  }
  cambios.forEach((c) => console.log('  ', c));
  console.log(`✓ Fuentes sincronizadas: ${cambios.length} cambio(s)`);
}
