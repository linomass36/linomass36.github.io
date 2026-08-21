#!/bin/sh
# anki — open Anki, and update the hub the moment you quit it.
#
# `open -W` blocks until the application exits, and that is the whole trick.
# No daemon watching for a process to vanish, no launchd job polling a file
# Anki rewrites constantly while it is open, and no credential anywhere. You
# quit Anki; the numbers land in the hub; the hub opens showing them.
#
# --if-studied keeps a browser window from arriving unbidden on a day you
# opened Anki and answered nothing.
#
# Install:
#   curl -o ~/tools/anki-wrap.sh \
#     https://raw.githubusercontent.com/linomass36/linomass36.github.io/main/tools/anki-wrap.sh
#   chmod +x ~/tools/anki-wrap.sh
#   echo 'alias anki="$HOME/tools/anki-wrap.sh"' >> ~/.zshrc && . ~/.zshrc
#
# Then: anki

set -u
SYNC="${ANKI_SYNC:-$HOME/tools/anki_sync.py}"

if [ ! -f "$SYNC" ]; then
  echo "anki: no sync script at $SYNC" >&2
  echo "      set ANKI_SYNC, or put anki_sync.py there" >&2
  exit 1
fi

# -R resolves the app without launching it, so a missing Anki fails here
# rather than half-way through.
if ! open -Ra Anki >/dev/null 2>&1; then
  echo "anki: Anki does not appear to be installed" >&2
  exit 1
fi

echo "opening Anki — the hub updates when you quit it"

# -W waits for quit, -a names the app. If Anki is already running this brings
# it forward and still waits, so the alias behaves the same either way.
open -W -a Anki

echo "Anki closed, reading the collection…"
exec python3 "$SYNC" --open --if-studied "$@"
