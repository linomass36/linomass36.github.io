# plates/ — the pictures

Seventeen public-domain works, in three groups, and the site picks each of them
up by itself. There is no CSS to edit and no list to maintain: `plates.js`
holds the catalogue, each slot names the pictures it wants in order of
preference, and the build writes `index.json` from whatever is actually here.

The Guide (`Guide.html` → *The pictures*) shows the whole set and which are
installed, probed rather than asserted.

## What is here

### Cardiothoracic and anatomy — Joseph Maclise, *Surgical Anatomy* (1859)

Hand-tinted lithographs of the opened thorax, drawn from dissection at a time
when nobody could yet operate inside one.

| File | Plate |
|---|---|
| `maclise-thorax.jpg` | I — the thorax opened: the heart, the lungs and the great vessels |
| `maclise-thorax-ii.jpg` | II — the form of the thorax |
| `maclise-aortic-arch.jpg` | IX — the arch of the aorta and its branches |
| `maclise-heart-deep.jpg` | XXIII — the deeper organs of the thorax, the heart in situ |
| `maclise-great-vessels.jpg` | XXIV — the great vessels |
| `maclise-vessels-skeleton.jpg` | XXV — the vessels in relation to the skeleton |
| `maclise-pericardium.jpg` | XXVI — pleura and pericardium referred to the surface |

### Polish

| File | Painting |
|---|---|
| `matejko-grunwald.jpg` | Jan Matejko, *The Battle of Grunwald*, 1878 |
| `chelmonski-autumn.jpg` | Józef Chełmoński, *Babie Lato*, 1875 |
| `boznanska-chrysanthemums.jpg` | Olga Boznańska, *Girl with Chrysanthemums*, 1894 |
| `wyspianski-god-father.jpg` | Stanisław Wyspiański, *God the Father: Let It Be*, 1904 |

### American — the Hudson River School

| File | Painting |
|---|---|
| `cole-oxbow.jpg` | Thomas Cole, *The Oxbow*, 1836 |
| `cole-kaaterskill.jpg` | Thomas Cole, *Kaaterskill Falls*, 1826 |
| `church-andes.jpg` | Frederic Edwin Church, *The Heart of the Andes*, 1859 |
| `church-twilight.jpg` | Frederic Edwin Church, *Twilight in the Wilderness*, 1860 |
| `bierstadt-rockies.jpg` | Albert Bierstadt, *The Rocky Mountains, Lander's Peak*, 1863 |
| `durand-kindred-spirits.jpg` | Asher Brown Durand, *Kindred Spirits*, 1849 |

## Where they came from, and why it is worth writing down

Wikimedia Commons and every museum's open-access API answer 403 at this
machine's egress gateway. These are all Commons scans, but they were taken
from public GitHub repositories that had already committed them — the one
image source the policy allows.

**Every file was opened and looked at before it was kept.** That is not
ceremony: one promising candidate set — a repository of Polish history
textbooks — turned out to hold AI-generated illustrations captioned as
Matejko. It was thrown away. If you add to this directory, look at the file
first.

## Adding one

Put the file here and name it in a slot:

```html
<div class="hub-marginal hub-plate" data-plate="cole-oxbow church-andes"></div>
```

`.jpg`, `.jpeg`, `.png` and `.webp` all work, tried in that order. A new
painting the catalogue does not know needs an entry in `CATALOGUE` in
`plates.js` — that is where the caption comes from.

About 1500px on the long edge, JPEG quality 82. A 6400px museum scan is eight
megabytes and nothing here displays wider than about 1200px.

## Why these ship as files

`verify_vault.py` and `vault.py` both allow `plates/` for the same reason they
allow `fonts/` and `icons/`: a public-domain painting is not your content, so
there is nothing for the vault to protect. Sealing them would also mean base64
inside `hub.css`, which is inlined into every page — one canvas, repeated
thirty-one times.

**This is not a place for anything of yours.** A photograph, a scan, a
screenshot of your own notes: those would ship in the clear, unencrypted, to a
public repository. Paintings only — and `tools/vault-dirs.test.js` fails the
build if a file appears here that the catalogue does not name.
