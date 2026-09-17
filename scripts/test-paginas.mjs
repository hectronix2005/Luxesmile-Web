#!/usr/bin/env node
/* INVARIANTES DE PÁGINA. Hoy una sola, la que más caro sale:
 *
 * Las secciones del sitio nacen con `opacity: 0` (.reveal en styles.css) y lo
 * único que las enciende es un IntersectionObserver que monta Alpine. Son 58
 * bloques repartidos en cuatro páginas — prácticamente todo el cuerpo de cada
 * una. Si Alpine no arranca, el visitante ve una página en blanco y NADA falla
 * en voz alta. Es la segunda causa del incidente del 7-jul-2026.
 *
 * La red de seguridad va inline en cada página a propósito: si viviera en un
 * .js externo, el fallo de que ese .js no cargue la dejaría sin cubrir. El
 * precio es que hay cuatro copias, y una copia que alguien edite en un solo
 * sitio es el fallo de esta semana entera. Por eso aquí se comprueban dos
 * cosas: que TODA página con .reveal la lleve, y que las copias sean
 * idénticas carácter a carácter.
 *
 * Y no se comprueba sólo que el texto esté: se EJECUTA sobre un DOM de
 * mentira, porque una red que revele de más mata la animación del sitio y una
 * que revele de menos no sirve para nada.
 *
 * Control positivo: quita la red de una página, o cambia `if (!dentro) return`
 * por `if (false) return`, y vuelve a correrlo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

let fallos = 0;
const ok = (cond, etq) => {
  if (!cond) fallos++;
  console.log(`  ${cond ? 'ok   ' : 'FALLO'}  ${etq}`);
};

// ── 1. cobertura: toda página con .reveal lleva la red ──────────────────────
console.log('\n1. cobertura: toda página con secciones ocultas lleva la red');
const htmls = [];
(function andar(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'admin' || e === 'marketing') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) andar(p);
    else if (e.endsWith('.html')) htmls.push(p.replace(/^\.\//, ''));
  }
})('.');

const RED = /<script data-lx="red-fade">([\s\S]*?)<\/script>/;
const conReveal = htmls.filter((f) => /class="[^"]*\breveal\b/.test(readFileSync(f, 'utf8')));
const copias = new Map();
for (const f of conReveal) {
  const m = RED.exec(readFileSync(f, 'utf8'));
  ok(!!m, `${f}${m ? '' : '  — tiene secciones ocultas y NO lleva la red'}`);
  if (m) copias.set(f, m[1]);
}
console.log(`  ..    ${conReveal.length} páginas con secciones ocultas`);

// ── 2. las cuatro copias son la misma ───────────────────────────────────────
console.log('\n2. las copias no han divergido');
const textos = [...copias.values()];
ok(textos.length > 0 && textos.every((t) => t === textos[0]),
   textos.every((t) => t === textos[0]) ? 'las copias son idénticas' : 'HAY COPIAS DISTINTAS: alguien editó una sola');

// ── 3. se ejecuta de verdad, sobre un DOM de mentira ────────────────────────
console.log('\n3. la red hace lo que dice (y sólo eso)');
const codigo = textos[0];

function correr({ visible, yaRevelada, enPantalla, hayReveal = true }) {
  const clases = [];
  const hacerEl = (arriba, alto) => ({
    clases: new Set(),
    classList: { add(c) { this.__d.clases.add(c); }, __d: null },
    getBoundingClientRect: () => ({ top: arriba, bottom: arriba + alto, height: alto }),
  });
  const els = hayReveal ? [hacerEl(enPantalla ? 100 : 5000, 300), hacerEl(enPantalla ? 400 : 6000, 300)] : [];
  els.forEach((e) => { e.classList.__d = e; clases.push(e.clases); });

  let pendientes = [];
  const ctx = {
    console: { warn() {}, log() {} },
    // Sin esto, `r.top < window.innerHeight` es `100 < undefined` = false y NADA
    // se revela nunca: el caso de «todo por debajo del pliegue» pasaba en verde
    // por el motivo equivocado. El mismo fallo que perseguimos todo el día.
    innerHeight: 800,
    document: {
      visibilityState: visible ? 'visible' : 'hidden',
      querySelector: (sel) => (sel === '.reveal.in-view' && yaRevelada ? {} : null),
      querySelectorAll: () => els,
    },
    setTimeout: (fn, ms) => { pendientes.push([ms, fn]); return pendientes.length; },
    setInterval: (fn, ms) => { pendientes.push([ms, fn]); return pendientes.length; },
    clearInterval: () => {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  // Disparar lo programado, dos vueltas: la primera saca el timer de los 4 s.
  for (let v = 0; v < 2; v++) {
    const cola = pendientes; pendientes = [];
    for (const [, fn] of cola) fn();
  }
  return clases.map((c) => c.has('in-view'));
}

const todas = (r) => r.length > 0 && r.every(Boolean);
const ninguna = (r) => r.every((x) => !x);

ok(todas(correr({ visible: true, yaRevelada: false, enPantalla: true })),
   'mecanismo muerto y hay sección en pantalla -> revela TODAS');
ok(ninguna(correr({ visible: true, yaRevelada: true, enPantalla: true })),
   'ya hay una revelada (el observador vive)   -> no toca nada');
ok(ninguna(correr({ visible: false, yaRevelada: false, enPantalla: true })),
   'pestaña en segundo plano                   -> no toca nada');
ok(ninguna(correr({ visible: true, yaRevelada: false, enPantalla: false })),
   'todo por debajo del pliegue                -> no toca nada');

console.log(fallos ? `\nFALLOS: ${fallos}` : '\ntodo en verde');
process.exit(fallos ? 1 : 0);
