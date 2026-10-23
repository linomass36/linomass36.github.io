# Year 2 Hub (Anki add-on)

The add-on's source. Version 3.2 adds `bridge.py`: it syncs with the website (the Almanac's checklist is this add-on's
day, ticks and moved dates go both ways, the website's results show on each subject page) and exports all study data.
See the Guide card "The Year 2 Hub add-on and the website are one plan" for what it does and how to connect it.

Build the installable file from the repo root:

    cd tools/anki-addon/year2_hub && zip -r ../year2-hub.ankiaddon . -x '__pycache__/*' 'user_files/*' && cd -

Then in Anki: Tools > Add-ons > Install from file…, choose `tools/anki-addon/year2-hub.ankiaddon`, restart Anki.
Installing over 3.1 keeps everything: the plan's state lives in the collection, and the website sign-in (once made)
in the add-on's `user_files`, which Anki keeps across updates.

Tests: `python3 tools/anki-addon.test.py` (the add-on's side) and `node tools/anki-bridge.test.js` (the website's side,
fed a payload made by this add-on's own code). Both run in the deploy.
