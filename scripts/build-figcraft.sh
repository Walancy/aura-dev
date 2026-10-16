#!/bin/sh
# Compila o FigCraft (https://github.com/storytold/figcraft) para wasm e copia para public/figcraft.
# Requer rustup (target wasm32-unknown-unknown) e trunk. Uso: scripts/build-figcraft.sh [dir-do-figcraft]
set -e
SRC="${1:-../figcraft}"
(cd "$SRC/apps/figcraft-web" && trunk build --release)
rm -rf public/figcraft && mkdir -p public/figcraft && cp "$SRC"/dist/web/* public/figcraft/
