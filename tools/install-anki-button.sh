#!/bin/sh
# install-anki-button.sh — make the hub's "Sync from Anki" button work on this Mac.
#
# WHY A HELPER. A web page cannot run a command on your computer; that is the
# whole of browser security, and the hub is a web page. What a page CAN do is
# open a link, and macOS lets an app claim a kind of link. So this builds a
# tiny app that claims cthub-anki:// links and, when the hub's button opens
# one, runs:
#
#     python3 ~/tools/anki_sync.py --open
#
# which reads your Anki collection (a copy; it never writes to it) and opens
# the Almanac with the reading in the URL fragment. Nothing goes to a server.
# The first press, your browser asks once whether to open "CT Hub Anki Sync";
# tick "always allow" and it stops asking.
#
# Install (once):
#   mkdir -p ~/tools
#   curl -o ~/tools/install-anki-button.sh \
#     https://raw.githubusercontent.com/linomass36/linomass36.github.io/main/tools/install-anki-button.sh
#   sh ~/tools/install-anki-button.sh
#
# Remove: delete ~/Applications/CT Hub Anki Sync.app
#
# It also downloads the current anki_sync.py into ~/tools, because the button
# needs the version that sends the study week. Re-run this script any time to
# update both. The sync's own output goes to ~/tools/anki_sync.log, which is
# the first place to look if the button seems to do nothing.

set -eu

APP="$HOME/Applications/CT Hub Anki Sync.app"
TOOLS="$HOME/tools"
SYNC="$TOOLS/anki_sync.py"
LOG="$TOOLS/anki_sync.log"
RAW="https://raw.githubusercontent.com/linomass36/linomass36.github.io/main/tools/anki_sync.py"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

if [ "$(uname)" != "Darwin" ]; then
  echo "This helper is for macOS: it is where the Anki collection lives." >&2
  exit 1
fi

mkdir -p "$TOOLS" "$HOME/Applications"

echo "1/5  fetching anki_sync.py"
curl -fsSL -o "$SYNC" "$RAW"

# The app runs with launchd's minimal PATH, not your shell's, so the python3
# you have now is written into it rather than looked up later.
PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "python3 was not found. Install Apple's command line tools first:" >&2
  echo "  xcode-select --install" >&2
  exit 1
fi

echo "2/5  checking it reads your collection"
if ! "$PY" "$SYNC" --print >/dev/null 2>"$LOG"; then
  echo "anki_sync.py could not read your collection:" >&2
  cat "$LOG" >&2
  echo "Fix that first (several Anki profiles? pass --profile in the script below), then re-run." >&2
  exit 1
fi

echo "3/5  building $APP"
SRC="$(mktemp -t ankibutton).applescript"
cat > "$SRC" <<EOF
on open location theURL
	do shell script "'$PY' '$SYNC' --open >> '$LOG' 2>&1 &"
end open location

on run
	display dialog "CT Hub Anki Sync is installed. Press Sync from Anki on the hub to use it." buttons {"OK"} default button 1
end run
EOF
rm -rf "$APP"
osacompile -o "$APP" "$SRC"
rm -f "$SRC"

echo "4/5  claiming cthub-anki:// links"
PL="$APP/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
$PB -c "Set :CFBundleIdentifier io.github.linomass36.anki-sync" "$PL" 2>/dev/null \
  || $PB -c "Add :CFBundleIdentifier string io.github.linomass36.anki-sync" "$PL"
$PB -c "Add :LSUIElement bool true" "$PL" 2>/dev/null || true
$PB -c "Delete :CFBundleURLTypes" "$PL" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes array" "$PL"
$PB -c "Add :CFBundleURLTypes:0 dict" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string 'CT Hub Anki Sync'" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string cthub-anki" "$PL"
# Editing Info.plist breaks the signature osacompile gave the app, and Apple
# silicon refuses to launch an app with a broken one. Re-sign it locally.
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "5/5  registering with macOS"
"$LSREGISTER" -f "$APP" >/dev/null 2>&1 || true
open "$APP"

echo
echo "Done. On the hub: Almanac → anki week → sync from anki."
echo "If nothing happens, look at $LOG."
