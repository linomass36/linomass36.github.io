# plates/ — the pictures

Drop an image file in here and the site picks it up on the next reload. There
is no CSS to edit and no list to update: `plates.js` probes this directory for
the names below, and dresses each slot with the first one it finds. Take the
file away again and the drawn engraving comes back.

The Guide (`Guide.html` → *The pictures*) shows which of these are installed
right now, probed rather than asserted.

## The names it looks for

Every one is public domain — the painters have been dead well over a century —
so Wikimedia Commons has a high-resolution scan of each, free of any licence
question.

| File | Painting | Where it lands |
|---|---|---|
| `gross-clinic.jpg` | Eakins, *The Gross Clinic*, 1875 | The Plan |
| `agnew-clinic.jpg` | Eakins, *The Agnew Clinic*, 1889 | The Guide (and The Plan's second choice) |
| `matejko-rejtan.jpg` | Matejko, *Rejtan*, 1866 | Money — a reckoning, in the room where it is refused |
| `matejko-grunwald.jpg` | Matejko, *Battle of Grunwald*, 1878 | Money, second choice |
| `matejko-stanczyk.jpg` | Matejko, *Stańczyk*, 1862 | Recalibrate — the one man who sees the problem while the party goes on |
| `chelmonski-autumn.jpg` | Chełmoński, *Indian Summer*, 1875 | Recalibrate, second choice |
| `church-andes.jpg` | Church, *The Heart of the Andes*, 1859 | The Standing — the front door asks for the long view |
| `bierstadt-rockies.jpg` | Bierstadt, *The Rocky Mountains, Lander's Peak*, 1863 | The Standing, second choice |
| `cole-oxbow.jpg` | Cole, *The Oxbow*, 1836 | The Standing, third choice |
| `chelmonski-czworka.jpg` | Chełmoński, *Czwórka*, 1881 | unassigned — available to any slot |
| `vesalius-fabrica.jpg` | Vesalius, *De humani corporis fabrica*, 1543 | The Guide, second choice |

`.jpg`, `.jpeg`, `.png` and `.webp` all work, tried in that order.

The build writes `plates/index.json` listing what is actually here, so the
deployed site knows what exists without asking for anything that does not.
Opened straight off disk before a build has run, `plates.js` falls back to
trying each name in turn — which works, and is noisier in the console.

## Sizing

About 1600px on the long edge, JPEG quality 80. A 4000px museum scan is eight
megabytes and nothing here displays wider than about 1200px.

## Why these ship as files

`verify_vault.py` allows `plates/` for the same reason it allows `fonts/` and
`icons/`: a public-domain painting is not your content, so there is nothing for
the vault to protect. Sealing them would also mean base64 in `hub.css`, which
is inlined into every page — one canvas, duplicated thirty-one times.

**This is not a place for anything of yours.** A photograph, a scan, a
screenshot of your own notes: those ship in the clear, unencrypted, to a public
repository. Paintings only.

## Adding a new slot

Give any element the classes and an ordered preference list:

```html
<div class="hub-marginal hub-plate" data-plate="cole-oxbow church-andes"></div>
```

New painting the catalogue does not know? Add it to `CATALOGUE` in
`plates.js` — that is where the caption comes from.
