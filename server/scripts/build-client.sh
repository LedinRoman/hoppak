#!/bin/bash
# Builds the game (game/build.sh) and copies the static client into server/public.
set -e
cd "$(dirname "$0")/.."
bash ../game/build.sh >/dev/null
mkdir -p public
cp ../game/index.html ../game/hoppak.js public/
echo "client -> $(pwd)/public ($(wc -c < public/hoppak.js) bytes js)"
