# shellcheck shell=bash
# bin/_versiones.sh — piezas comunes de bin/etiquetar y bin/rollback (se carga con «source»).
# Compatible con el bash 3.2 de macOS.

# Lo que NO forma parte de la «versión del sitio»: las herramientas y su documentación.
# Un rollback no las devuelve atrás (con GITHUB_TOKEN ni siquiera se puede: tocar
# .github/workflows exige otro permiso) y comparar versiones las ignora.
FUERA_DEL_SITIO='^(\.github/|bin/|CLAUDE\.md$)'

# Etiquetas vAAAA.MM.DD-N, de la más nueva a la más vieja (N con orden numérico).
etiquetas_ordenadas() {
  git tag -l 'v[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]-*' \
    | awk -F'[v.-]' '$5 ~ /^[0-9]+$/ { printf "%s%s%s %06d %s\n", $2, $3, $4, $5, $0 }' \
    | sort -r | cut -d' ' -f3
}

# Huella del sitio servido por un commit: su árbol sin las herramientas.
huella_sitio() { # huella_sitio <rev>
  git ls-tree -r --full-tree "$1" | awk -F'\t' -v fuera="$FUERA_DEL_SITIO" '$2 !~ fuera' \
    | git hash-object --stdin
}

# La versión que corresponde a un commit: la etiqueta más nueva con su misma huella.
# Un commit de rollback no se etiqueta, pero tiene la huella de la versión a la que volvió.
version_de() { # version_de <rev>  → imprime la etiqueta o nada
  local h t
  h="$(huella_sitio "$1")"
  for t in $(etiquetas_ordenadas); do
    if [ "$(huella_sitio "$t^{commit}")" = "$h" ]; then echo "$t"; return 0; fi
  done
  return 1
}

# La versión anterior a la desplegada: la primera etiqueta más vieja que la versión
# actual y con OTRO contenido. Si lo desplegado no tiene etiqueta (un despliegue que
# acaba de fallar la sonda), la anterior es la etiqueta más nueva.
version_anterior() { # version_anterior <rev>
  local actual h_actual t pasada=0
  actual="$(version_de "$1" || true)"
  h_actual="$(huella_sitio "$1")"
  for t in $(etiquetas_ordenadas); do
    if [ -n "$actual" ] && [ "$pasada" = 0 ]; then
      [ "$t" = "$actual" ] && pasada=1
      continue
    fi
    if [ "$(huella_sitio "$t^{commit}")" != "$h_actual" ]; then echo "$t"; return 0; fi
  done
  return 1
}
