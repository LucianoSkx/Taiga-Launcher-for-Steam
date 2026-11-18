#!/bin/sh
# Inicia o Taiga Launcher no Linux a partir de qualquer lugar.
set -eu
APP="$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")/../resources/app" && pwd)"
ELECTRON="$APP/node_modules/electron/dist/electron"
if [ ! -x "$ELECTRON" ]; then
  echo "Dependências faltando. Rode: cd '$APP' && npm install" >&2
  exit 1
fi
cd "$APP"
exec "$ELECTRON" "$APP" "$@"
