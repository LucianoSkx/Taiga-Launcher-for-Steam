#!/bin/sh
# Inicia o Taiga Launcher no Linux a partir de qualquer lugar.
set -eu
APP="$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")/../resources/app" && pwd)"
if [ ! -x "$APP/node_modules/.bin/electron" ]; then
  echo "Dependências faltando. Rode: cd '$APP' && npm install" >&2
  exit 1
fi
cd "$APP"
exec "$APP/node_modules/.bin/electron" . "$@"
