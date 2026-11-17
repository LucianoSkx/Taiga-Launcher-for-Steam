#!/bin/sh
# Instala o Taiga Launcher em ~/.local/share/taiga-launcher, independente do checkout do repositório.
# Rode de novo depois de atualizar o fork para atualizar a instalação.
set -eu
REPO="$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")/.." && pwd)"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/taiga-launcher"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"

mkdir -p "$DEST" "$BIN" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
rsync -a --delete --exclude='tests/' --exclude='*.test.mjs' "$REPO/resources/app/" "$DEST/app/"

cat > "$BIN/taiga-launcher" <<EOF
#!/bin/sh
set -eu
APP='__APP_PATH__'
if [ ! -x "\$APP/node_modules/.bin/electron" ]; then
  echo "Instalação incompleta. Rode tools/install-linux.sh novamente." >&2
  exit 1
fi
cd "\$APP"
exec "\$APP/node_modules/.bin/electron" . "\$@"
EOF
sed -i "s|__APP_PATH__|$DEST/app|" "$BIN/taiga-launcher"
chmod +x "$BIN/taiga-launcher"

cp "$REPO/tools/taiga-launcher.desktop" "$HOME/.local/share/applications/taiga-launcher.desktop"
cp "$DEST/app/desktop/icon.png" "$HOME/.local/share/icons/hicolor/256x256/apps/taiga-launcher.png"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
echo "Instalado em $DEST — o repo pode ser movido ou apagado sem afetar o app."
echo "Atualizar: rode $REPO/tools/install-linux.sh"
