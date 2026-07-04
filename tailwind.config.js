/** @type {import('tailwindcss').Config} */
// Config del Tailwind COMPILADO para el sitio público (index.html + landing).
// Replica la config inline que usaba el CDN. El admin sigue en CDN aparte.
// Los colores usan CSS vars (definidas en styles.css y actualizadas en vivo por
// applyTheme) para que los temas del admin sigan funcionando.
module.exports = {
  content: [
    './index.html',
    './diseno-de-sonrisa/**/*.html',
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
