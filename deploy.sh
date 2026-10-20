#!/usr/bin/env bash
# Deploy de Nova Event en el servidor.
# Descarga las imágenes que construyó GitHub Actions para el commit actual y levanta los contenedores.
# No construye nada en el servidor.
#
# Uso:            bash deploy.sh
# Volver atrás:   TAG=<sha del commit> docker compose up -d --no-build

set -euo pipefail

# Todo va dentro de main() para que bash lea el script completo antes de ejecutarlo:
# así el git pull puede cambiar este archivo sin romper el deploy en curso.
main() {
  cd "$(dirname "$0")"

  local servicios=(migrate app)
  local espera_max=900  # 15 minutos
  local intervalo=30

  if [[ ! -f .env ]]; then
    echo "✗ Falta el archivo .env (cópialo de .env.example y complétalo)." >&2
    exit 1
  fi
  if ! grep -Eq '^GHCR_OWNER=[^[:space:]]+' .env; then
    echo "✗ Define GHCR_OWNER en .env (tu usuario u organización de GitHub, en minúsculas)." >&2
    exit 1
  fi

  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "✗ Hay cambios sin commitear en el servidor. Revísalos antes de desplegar:" >&2
    git status --short --untracked-files=no >&2
    exit 1
  fi

  echo "→ Bajando cambios del repositorio..."
  git pull --ff-only

  TAG="$(git rev-parse HEAD)"
  export TAG
  echo "→ Versión a desplegar: ${TAG}"

  echo "→ Descargando imágenes (${servicios[*]})..."
  local esperado=0
  until docker compose pull --quiet "${servicios[@]}"; do
    if (( esperado >= espera_max )); then
      echo "✗ Las imágenes de ${TAG} no aparecieron en ghcr.io después de $((espera_max / 60)) minutos." >&2
      echo "  Revisa GitHub → Actions. Producción sigue con la versión anterior, no se tocó nada." >&2
      exit 1
    fi
    echo "  GitHub Actions todavía no termina. Reintento en ${intervalo} s..."
    sleep "$intervalo"
    esperado=$((esperado + intervalo))
  done

  echo "→ Levantando contenedores..."
  docker compose up -d --no-build --remove-orphans

  limpiar_imagenes_viejas
  echo "✓ Deploy listo: ${TAG}"
}

# Borra solo imágenes viejas de ESTE proyecto (por su etiqueta de origen),
# sin tocar las de otros sistemas del servidor.
limpiar_imagenes_viejas() {
  local origen actuales id
  origen="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
    "$(docker compose config --images | grep nova-event-app | head -n1)" 2>/dev/null || true)"
  if [[ -z "$origen" ]]; then
    echo "· No se encontró la etiqueta de origen; no se limpian imágenes."
    return
  fi

  actuales="$(docker compose config --images | xargs -r docker image inspect --format '{{.Id}}' 2>/dev/null || true)"

  echo "→ Limpiando imágenes viejas de ${origen}..."
  for id in $(docker image ls --filter "label=org.opencontainers.image.source=${origen}" --format '{{.ID}}' | sort -u); do
    local id_completo
    id_completo="$(docker image inspect --format '{{.Id}}' "$id")"
    if ! grep -qx "$id_completo" <<<"$actuales"; then
      docker image rm -f "$id" >/dev/null 2>&1 || true
    fi
  done
}

main "$@"
