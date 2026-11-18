#!/bin/sh
# Gera uma pasta portátil do Taiga Launcher para Linux: app + dados (config/jogos) juntos.
# A pasta pode ser movida/copiada para qualquer PC/pendrive Linux; nada depende do checkout nem do HOME.
# Uso: tools/build-portable-linux.sh [pasta-de-saida]
set -eu
REPO="$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")/.." && pwd)"
OUT="${1:-$REPO/dist/Taiga-Launcher-Portable}"
DEST="$OUT/Taiga-Launcher"
mkdir -p "$DEST"

# App Electron (sem testes; com node_modules). Se a instalação já existir, reaproveita o node_modules dela.
rsync -a --delete --exclude='tests/' --exclude='*.test.mjs' --exclude='node_modules/' "$REPO/resources/app/" "$DEST/app/"
if [ -d "$REPO/resources/app/node_modules" ]; then
  rsync -a "$REPO/resources/app/node_modules/" "$DEST/app/node_modules/"
elif [ -d "${XDG_DATA_HOME:-$HOME/.local/share}/taiga-launcher/app/node_modules" ]; then
  rsync -a "${XDG_DATA_HOME:-$HOME/.local/share}/taiga-launcher/app/node_modules/" "$DEST/app/node_modules/"
else
  echo "node_modules não encontrado. Rode: cd '$REPO/resources/app' && npm install" >&2
  exit 1
fi

# Dados do usuário: copiados da instalação atual (se houver) para a pasta portátil.
DATA_SRC="${TAIGA_DATA:-${XDG_DATA_HOME:-$HOME/.local/share}/Taiga Launcher}"
mkdir -p "$DEST/data"
if [ -d "$DATA_SRC" ]; then
  cp -a "$DATA_SRC/." "$DEST/data/"
fi

cat > "$OUT/iniciar-taiga.sh" <<EOF
#!/bin/sh
# Taiga Launcher portátil — inicia de onde a pasta estiver, com dados locais.
set -eu
HERE="\$(CDPATH= cd -- "\$(dirname -- "\$(readlink -f -- "\$0")")" && pwd)"
export TAIGA_DATA="\$HERE/Taiga-Launcher/data"
mkdir -p "\$TAIGA_DATA"
APP="\$HERE/Taiga-Launcher/app"
ELECTRON="\$APP/node_modules/electron/dist/electron"
if [ ! -x "\$ELECTRON" ]; then
  echo "Instalação incompleta: rode build-portable-linux.sh novamente." >&2
  exit 1
fi
cd "\$APP"
exec "\$ELECTRON" "\$APP" "\$@"
EOF
chmod +x "$OUT/iniciar-taiga.sh"
cat > "$OUT/LEIA-ME.txt" <<'EOF'
Taiga Launcher — versão portátil para Linux
-------------------------------------------
Duas vezes em "iniciar-taiga.sh" (ou no terminal: ./iniciar-taiga.sh).

Tudo (programa, configuração, jogos cadastrados, artes) fica dentro desta pasta.
Pode mover/copiar para outro PC Linux ou pendrive; não instala nada no sistema.

Ao abrir em outro PC, configure novamente a pasta da Steam (ela não viaja junto).
Para atualizar: rode tools/build-portable-linux.sh no repo e substitua esta pasta.
EOF
echo "Pasta portátil pronta em $OUT"
