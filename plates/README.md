# plates/ — the pictures

Drop image files here and they ship as files (verify_vault.py allows this
directory, like `icons/` and `fonts/`). They are NOT sealed by the vault:
a public-domain painting is not personal content, and hub.css is inlined
into every page, so a base64 canvas would be duplicated thirty-one times.

## Using one

```css
.hub-figure { --plate-figure: url('./plates/gross-clinic.jpg'); }
```

`.hub-figure` frames and captions whatever it is given. Nothing else changes.

## What to put here

Public domain, so no licence problem:

| File | Painting | Why |
|---|---|---|
| `gross-clinic.jpg` | Eakins, *The Gross Clinic* (1875) | An operating theatre. The hinge between the painting brief and the surgical one. |
| `agnew-clinic.jpg` | Eakins, *The Agnew Clinic* (1889) | The same subject, fourteen years on and antiseptic. |
| `matejko-*.jpg` | Matejko — *Battle of Grunwald*, *Rejtan*, *Stańczyk* | Where the crimson and gilt come from. |
| `chelmonski-*.jpg` | Chełmoński — *Czwórka*, *Indian Summer* | The umbers. |
| `hudson-*.jpg` | Church, Bierstadt, Cole | The tannin greens and the Prussian sky. |
| `vesalius-*.jpg` | *De humani corporis fabrica* (1543) plates | The atlas the whole look is built on. |

Wikimedia Commons has high-resolution scans of all of them.

## Sizing

Resize to about 1600px on the long edge and save as JPEG q80 — a 4000px
museum scan is 8 MB and nothing here displays wider than ~1200px.
