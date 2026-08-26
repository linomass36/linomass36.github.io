# Cancer Research — Status & Publication Pipeline

*Audit of the oncology/GI thread across the CT Hub, plus a proposed publication pipeline.*
Compiled 2026-08-24 from the hub's own plan and network data.

---

## 1. Headline

**There is no cancer research plan in the system.** There are three checklist items and two relationships. That is the entire footprint.

For scale: the CAV biomarker track has 21 sequenced steps across five phases with named gates, owners, and dependency classes. The GI cancer thread has two tasks and a talking point.

---

## 2. The complete cancer footprint, verbatim

| Location | Item ID | Content |
|---|---|---|
| Research Horizons → H1 · Before leaving for the States | `hz-h1-4` | **GI cancer paper #1 — finalize & submit before departure**<br>*"Existing work, credibility in the bank. Far easier to close from the home faculty than from abroad."*<br>Badge: **Bank GI credibility** |
| same | `hz-h1-5` | **GI cancer paper #2 — finalize & submit before departure** *(no note text)*<br>Badge: **Bank GI credibility** |
| same | `hz-h1-6` | **Resolve all coauthor / revision threads now**<br>*"Don't carry manuscript edits into 13-hour shifts."* |
| Checkpoints → CP1 · Oct 2026 | `cp-cp1-research-2` | *"Both GI-cancer papers in hand — proof you can execute and publish, even if off-thesis."* |
| `PLAN_EXTRAS.storyBank` | `st-papers` | *"Published two GI-cancer papers off-thesis — proof I can execute and publish under load."*<br>Uses: **essay, grant** · Theme: **Research capability** |
| `PLAN_EXTRAS.portraits` → CP1 | — | *"Two GI-cancer papers are in hand: proof I can execute even off-thesis."* |

### What is *not* specified anywhere

- No research question
- No cancer type beyond "GI"
- No dataset, cohort, or data source
- No target journal
- No named co-author or PI
- No target date beyond "before departure"
- No decision gate, kill criterion, or plan-B

### The framing is a deliberate demotion

Every single mention pairs the papers with the words **off-thesis** and **credibility in the bank**. In the plan's own logic these are not research — they are **evidence you can finish things**, to be banked, cited in application essays, and never extended.

That is a defensible strategic choice. It is worth being explicit that it *was* a choice, because the artifacts read like an oversight.

---

## 3. Current status

`hub-data.js` seeds only three completed items:

```js
defaultChecked: ['hz-h1-1', 'hz-h1-2', 'hz-h1-3']
// biophysics exam, chemistry exam, biology exam
```

**Both GI papers (`hz-h1-4`, `hz-h1-5`) and the coauthor-threads item (`hz-h1-6`) are unchecked in the committed baseline.**

Two caveats:

1. **Live progress lives in `localStorage`, not the repo.** Whatever you have actually ticked in the browser is invisible from here. The committed seed is the only ground truth available.
2. **The window has passed.** These sit in Horizon 1, scoped as *"~3 weeks · gate: exams come first"* — the pre-departure window. If they are still open, they are overdue, and the plan's own instruction was to close them **from the home faculty**, which is precisely the access lost once abroad.

---

## 4. Adjacent oncology assets (currently unwired)

Both relationships are warm; neither is connected to the paper thread.

### The oncology professor — surgical oncology, home faculty
- Type: mentor · Strength: **warm** · Reach: **2** · Last contact: **~40 days** · Owed: **no**
- Relationship: long-standing, warm; low-frequency check-ins keep it alive
- **Standing opportunities:**
  - **"Ask to co-author a case report"**
  - **National oncology society meeting · ~Sep 15–16 2026** — logged as *"From the oncology professor's opener — a co-authoring relationship trip."* (date approximate)

### The breast-surgery professor — home faculty
- Type: mentor · Strength: **warm** · Reach: **3** *(highest-reach Polish mentor in the map)* · Last contact: **~30 days** · Owed: **YES**
- Relationship: introduced through family; high willingness to help
- Notes: high reach, limited time — a light, specific ask lands best
- **Standing opportunities:**
  - Ask for a rec letter for CT electives
  - Shadow invitation — a day in his OR · home faculty
  - Intro to the home surgical faculty · Sep 2026 · home faculty

> **An unpaid social debt (`owed: true`) to your highest-reach local mentor is the most actionable item in this entire audit — and it sits in the oncology corner of the network map.**

---

## 5. Document drift (flagged)

`Research Plan.dc.html` (updated **Jul 5 2026**) describes a **different five-track portfolio** from the CT Master Plan's four:

| Track | Status | Target output |
|---|---|---|
| CAV Biomarker Panel | Advancing | Journal pub · Q3 2027 |
| LVAD Anti-thrombotic Coating | On track | Device stage · Q2 2028 |
| Redo-Sternotomy Outcomes | Advancing | Abstract Q4 '26 → pub Q2 '27 |
| Decellularized Valve Scaffold | At risk | Pilot → grant · Q2 2028 |
| AI Surgical Risk Model | Paused | Held — gate triggered |

Neither portfolio includes oncology. The two planning documents have drifted apart and should be reconciled.

---

## 6. Proposed publication pipeline

### 6.1 The diagnosis

The GI papers did not stall for lack of a plan. They stalled because a two-item checklist cannot model the thing that actually kills manuscripts. The plan already names the failure mode in passing — *"resolve all coauthor / revision threads"* — but gives it no structure.

> **The bottleneck is not ideas and not data. It is manuscripts sitting in someone else's inbox.**

### 6.2 The core mechanic: `ball` + `days_in_stage`

Every pipeline item carries two fields above all others:

- **`ball`** — whose court is it in? `you` / `co-author` / `PI` / `journal`
- **`days_in_stage`** — how long has it been there?

Nothing else predicts a stalled paper half as well. A manuscript with the ball in **your** court for 40 days is a *discipline* problem. One with the ball in a **co-author's** court for 40 days is a *nudge* problem. These need opposite interventions, and most trackers never separate them — which is why papers die quietly.

### 6.3 Stages

Extends the existing `Data → Analysis → Writeup → Submit → Pub` vocabulary from `Research Plan.dc.html`, split where work genuinely sticks:

```
Idea → Question locked → Access (data/IRB/DUA) → Analysis →
Draft → Co-author review → Submitted → Revision → Accepted
```

`Co-author review` and `Revision` get **their own columns**. Both GI papers are presumably sitting in one of them right now. Hiding these inside "Writeup" is exactly what made them invisible.

### 6.4 WIP limits

- **Max 3 items in flight**
- **Max 1 off-thesis item**
- Nothing new enters until something exits

The whole plan's thesis is focus — the ex-vivo perfusion track was cut on exactly this reasoning. The publication side currently has no equivalent governor.

### 6.5 Tier by *your* hours to output

Off-thesis work must be cheap or it is not worth its cost to the thesis.

| Tier | Your hours | Cycle time | Use for |
|---|---|---|---|
| **Case report** | 8–15 | 2–4 mo | the oncology professor's standing offer. Cheapest real paper that exists |
| **Narrative review** | 30–50 | 4–8 mo | No data access needed — the pediatric valve review's shape |
| **Retrospective on existing DB** | 40–80 | 6–12 mo | Redo-sternotomy pattern |
| **Original analysis** | 150+ | 12–18 mo | CAV. **On-thesis only** |

### 6.6 The authorship rule

> **First-author on-thesis. Any-author off-thesis.**

A middle-author GI or oncology paper still counts on the ERAS line, still proves throughput, and costs a fraction of the hours. Chasing first authorship off-thesis is the trap — it is the expensive version of a cheap asset.

### 6.7 Forcing functions

Conference abstract deadlines are the only **externally enforced** dates in this system. Intentions do not hold; deadlines do.

**the national oncology meeting (~Sep 15–16 2026)** is already logged as a relationship trip. Make it an **abstract** trip instead:
- An accepted abstract converts to a manuscript *with a deadline attached*
- It gives the the oncology professor relationship a concrete artifact rather than a coffee
- It satisfies the "co-author a case report" opportunity already sitting in the network map

### 6.8 Instrumentation — `Pipeline.dc.html`

A new hub page, built to existing conventions:

- **Columns:** the nine stages above
- **Per-item fields:** `title`, `tier`, `ball`, `days_in_stage`, `authorship position`, `on-thesis` flag, `blocker`
- **Blocker classes:** reuse the four already defined in `Research Plan.dc.html` — `Collaborator` / `Data-IRB` / `Materials` / `Funding`
- **Red flag** at **21 days** in any single stage
- **Two derived metrics:**
  - **Throughput** — accepted papers per 6 months
  - **Median days-in-stage** — so you learn where *your* papers die, not where papers die in general

### 6.9 Cadence

A **20-minute weekly sweep**, bolted onto `Weekly Review.dc.html`.

One question per item:
> *Whose court, how long, and what is the smallest move that returns the ball?*

For anything stalled in a co-author's court past **21 days**: send the nudge **during** the sweep, not after it.

### 6.10 Where oncology sits

A **capped annex**:

- **One** active item maximum
- Tier **≤ case report**
- Hard stop: the moment an oncology item costs more than **~15 of your hours**, it is competing with CAV — and CAV is the thesis

What the annex buys: the breast-surgery professor (whom you owe), the oncology professor, and a conference trip with a purpose. It buys nothing else, and it should not try to.

---

## 7. Open questions

1. **Are the GI papers actually still open?**
   `localStorage` is not visible from the repo. If submitted, most of this document is retrospective and the pipeline starts clean with CAV. If not, they are pipeline items #1 and #2 — and closing them is the highest-value move available, because they are nearly free and they are the *only completed proof* in the story bank.

2. **Did "cancer research plan" mean something outside this repo?**
   If a real GI project exists — a cohort, a named co-author, a target journal — none of it is committed anywhere in `linomass36.github.io`, and nothing suggests it ever was. If it lives in the Obsidian vault or in email, it needs to be folded in.

---

## 8. Immediate next actions

| # | Action | Cost | Why |
|---|---|---|---|
| 1 | Establish true status of GI papers #1 and #2 | 10 min | Everything else depends on it |
| 2 | Clear the `owed: true` debt to the breast-surgery professor | 1 message | Highest-reach mentor, 30 days cold |
| 3 | Convert the national oncology meeting into an abstract deadline | 1 email to the oncology professor | The only external forcing function on the board |
| 4 | Build `Pipeline.dc.html` + wire into `nav.js` | ~half a day | Makes the co-author-inbox failure mode visible |
| 5 | Reconcile `Research Plan.dc.html` against `CT Master Plan.html` | ~1 hour | Two portfolios have drifted apart |
