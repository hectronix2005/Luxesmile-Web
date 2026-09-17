/** @type {import('tailwindcss').Config} */
// Config del Tailwind COMPILADO para el sitio público (index.html + landing).
// Replica la config inline que usaba el CDN. El admin sigue en CDN aparte.
// Los colores usan CSS vars (definidas en styles.css y actualizadas en vivo por
// applyTheme) para que los temas del admin sigan funcionando.
module.exports = {
  content: [
    './index.html',
    './blog/**/*.html',
    './diseno-de-sonrisa/**/*.html',
    './en/**/*.html',
    // Cargaba el CSS compilado sin estar aqui: 13 utilidades suyas no se
    // compilaban y la pagina se servia sin ellas, sin error de nada (10-sep-2026).
    './pacientes-internacionales/**/*.html',
    './privacidad/**/*.html',
    './assets/js/app.js',
    './scripts/prerender.mjs',
  ],
  theme: {
    extend: {
      colors: {
        ivory:        'rgb(var(--ivory-rgb) / <alpha-value>)',
        porcelain:    'rgb(var(--porcelain-rgb) / <alpha-value>)',
        rosegold:     'rgb(var(--rosegold-rgb) / <alpha-value>)',
        rosegoldDark: 'rgb(var(--rosegold-dark-rgb) / <alpha-value>)',
        gold:         'rgb(var(--gold-rgb) / <alpha-value>)',
        charcoal:     'rgb(var(--charcoal-rgb) / <alpha-value>)',
        softblack:    'rgb(var(--softblack-rgb) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
};
