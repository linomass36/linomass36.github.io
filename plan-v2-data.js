/* ─────────────────────────────────────────────────────────────────────────
   plan-v2-data.js — the CT Master Plan, v2.0.

   Recalibrated 24 Aug 2026. This file supersedes the v1 content that lives
   in `hub-data.js` (PLAN_DATA / PLAN_EXTRAS) and in the five archived
   documents. v1 is not deleted — it is reachable from Archive.html — but
   nothing reads it as current any more.

   Why v2 exists: v1 was built on three assumptions that did not hold. The
   capital engine did not fire, the research spine never started, and the
   goal reordered from topic-fit to institution-brand. v2 replaces four
   parallel tracks and six dimensions with ONE forcing function at a time.

   NAMING: no third party is named in this file. The hub is served from a
   public origin and only the HTML pages carry the auth gate, so every
   collaborator appears by role. Roles are stable and unambiguous to the
   one person who reads them.

   Status vocabulary, used throughout:
     live    — worked on now
     queued  — dated, not yet started
     dormant — deliberately parked, not failed
     dead    — cut, do not revisit
     verify  — an assumption that must be checked before it is planned around
   ───────────────────────────────────────────────────────────────────────── */
window.PLAN_V2 = {
  version: '2.0',
  recalibrated: '2026-08-24',
  supersedes: 'CT Master Plan.html (v1, Jul 2026)',
  horizon: 'Aug 2026 → Match Day 2031 → attending 2038+',

  /* The single dated thing everything else serves. One at a time, on purpose. */
  forcingFunction: {
    label: 'US summer research applications close',
    date: '2027-02-15',
    why: 'Intentions do not hold; external deadlines do. Every live item either serves this date or is marked dormant.'
  },

  statusVocab: [
    { id: 'live',    label: 'LIVE',    note: 'worked on now' },
    { id: 'queued',  label: 'QUEUED',  note: 'dated, not yet started' },
    { id: 'dormant', label: 'DORMANT', note: 'deliberately parked, not failed' },
    { id: 'dead',    label: 'DEAD',    note: 'cut, do not revisit' },
    { id: 'verify',  label: 'VERIFY',  note: 'must be checked before it is planned around' }
  ],

  /* ── §00 how to read ─────────────────────────────────────────────── */
  howToRead: {
    lede: 'This is not an edit of v1 — it is a replacement of its operating logic.',
    changed: [
      'The capital engine did not fire. v1 was financed by a dollar-arbitrage summer that produced a fraction of its projection.',
      'The research spine did not execute. CAV was scoped as the summer deliverable and never started. Actual output is a gastric-cancer abstract.',
      'The goal reordered. Institution brand now outranks topic fit, which changes what a good summer looks like.'
    ]
  },

  /* ── §01 ground truth ────────────────────────────────────────────── */
  groundTruth: {
    asOf: '2026-08-24',
    rows: [
      { dim: 'Summer earnings',  v1: '~$17,400',                                  actual: '~$15.15/hr + tips, 30–45 hr/wk, ~5 weeks remaining' },
      { dim: 'Liquid capital',   v1: '~$10k by Oct',                               actual: 'Net worth ≈ −$250' },
      { dim: 'Investments',      v1: '15k PLN deployed, 2k/mo auto',               actual: 'Not deployed' },
      { dim: 'Patent fund',      v1: '5k PLN reserved',                            actual: 'Does not exist' },
      { dim: 'Research output',  v1: '2 GI papers banked + CAV analysis shipped',  actual: '1 abstract in progress (due Sep 7), 1 manuscript in mentors’ hands (~12 mo out), CAV not started' },
      { dim: 'Venture',          v1: 'Co-founder search, Wave 1 forming',          actual: 'Not started' },
      { dim: 'Specialty',        v1: 'CT, thesis-first',                           actual: 'CT primary, ortho/neuro genuinely open; brand-first' }
    ],
    fixedFacts: [
      { k: 'US citizen', v: 'The single most valuable asset in the file. Clears the citizenship gate on nearly every competitive US summer program and eliminates visa sponsorship as a residency barrier — the constraint that sinks most IMGs.', tone: 'good' },
      { k: 'Home school is ECFMG-accredited', v: 'RESOLVED 24 Aug 2026 — the pathway-ending risk is closed.', tone: 'good' },
      { k: 'Home school is FAFSA / Title IV eligible', v: 'RESOLVED — but eligibility is not capacity. See the debt page.', tone: 'warn' },
      { k: 'Enrolling in the American Track', v: 'USMLE tutoring built into the curriculum plus clinical years in NYC. Structural spine of Phases 3 and 4, and it carries a ~$350k USD price tag.', tone: 'warn' },
      { k: 'USMLE Step 1: summer 2028', v: 'Which makes summer 2027 the only clean research summer that exists before the clinical phase.', tone: 'key' },
      { k: 'Unpaid is survivable', v: 'Via family, scholarships, stipends, loans as last resort. A strategic unlock, not a footnote — most elite summer programs are unpaid or low-stipend.', tone: 'good' },
      { k: 'Letter writers exist', v: 'Two home-faculty professors (one a vice dean) plus one clinical supervisor, pending completion of the voluntary clinic internship.', tone: 'good' }
    ]
  },

  /* ── §02 corrections: what to stop displaying ────────────────────── */
  corrections: [
    { was: '"USMLE Step 1 DONE with a competitive score (250+ for I-6)"',
      fix: 'Step 1 has been pass/fail since January 2022. There is no score. The only number on a modern application is Step 2 CK, now the fourth most-considered factor by program directors. Target ≥255 for surgical subspecialties. Retire every Step 1 score target.',
      status: 'dead' },
    { was: '"Deploy 15k PLN into VWCE + 2k/mo"',
      fix: 'No capital. Reopen when liquid > $5k with a stable income floor.', status: 'dormant' },
    { was: '"5k Patent Fund"',
      fix: 'No patentable asset exists yet. Reopen at first provisional.', status: 'dormant' },
    { was: '"Wave 1 company by 30 / co-founder search"',
      fix: 'Requires capital, time, and a validated clinical problem — none present. Nothing in the 2027 goal depends on it.', status: 'dormant' },
    { was: '"Four-track research portfolio"',
      fix: 'Collapsed to one live project plus one annex. See the Pipeline page.', status: 'dead' },
    { was: '"Two GI papers banked by Oct 2026"',
      fix: 'False. One abstract pending, one manuscript stalled in co-author court.', status: 'dead' },
    { was: '"Guide / storefront product, $49"',
      fix: 'Dormant unless it can be shipped in under 20 hours. It competes directly with the application campaign.', status: 'dormant' },
    { was: 'Two drifted portfolios (Research Plan 5 tracks vs CT Master Plan 4 tracks)',
      fix: 'Reconcile to this document. Both archived.', status: 'dead' }
  ],

  /* ── §03 governing logic ─────────────────────────────────────────── */
  governingLogic: [
    { n: 1, t: 'One forcing function at a time.', d: 'Intentions do not hold; external deadlines do. The current one is mid-February 2027.' },
    { n: 2, t: 'Brand-first for 2027, thesis-first after.', d: 'Take the strongest institution that will have you, in any of CT / ortho / neuro, then bend the output toward the vascular-endothelium thesis in how you write and present it.' },
    { n: 3, t: 'Throughput beats purity.', d: 'A finished off-thesis abstract outranks an unstarted on-thesis project. Committees screen for finishes things, not thematically pure.' },
    { n: 4, t: 'The ball, not the task.', d: 'A manuscript is not a to-do; it is a position. Track whose court it is in and for how long.' },
    { n: 5, t: 'Relationships are the mechanism, not the garnish.', d: 'The NIH selects by individual PI outreach. The senior sponsor is inside the target hospital cluster. Every gate here is opened by a named human.' },
    { n: 6, t: 'Verify gates before planning around them.', d: 'Unverified assumptions could each end a phase.' },
    { n: 7, t: 'Capital is not part of the 2027 plan.', d: 'Do not let a dormant financial layer generate guilt or drag.' }
  ],

  /* ── §04 phase map ───────────────────────────────────────────────── */
  phases: [
    { id: 'p0', num: '0', label: 'Close out the summer', start: '2026-08-24', end: '2026-09-30', status: 'live',
      objective: 'Ship the abstract; secure the clinical letter; open the sponsor channel',
      failure: 'Summer ends with no CV line and no letters in motion', color: '#993C1D' },
    { id: 'p1', num: '1', label: 'Academic year 26/27 — the campaign', start: '2026-10-01', end: '2027-06-30', status: 'queued',
      objective: 'Win a US summer research position',
      failure: 'Submitting applications without PI outreach', color: '#185FA5' },
    { id: 'p2', num: '2', label: 'US research summer', start: '2027-05-15', end: '2027-08-31', status: 'queued',
      objective: 'Convert the position into an abstract + a US letter',
      failure: 'Doing good work nobody writes down', color: '#0F6E56' },
    { id: 'p3', num: '3', label: 'Academic year 27/28 + Step 1', start: '2027-10-01', end: '2028-08-31', status: 'queued',
      objective: 'Pass Step 1; bank home-faculty research',
      failure: 'Step 1 slips and collides with the US move', color: '#854F0B' },
    { id: 'p4', num: '4', label: 'NYC clinical years', start: '2028-09-01', end: '2031-05-31', status: 'queued',
      objective: 'Step 2 CK ≥255, ECFMG, US LORs, match',
      failure: 'Arriving in NYC with no plan for aways and letters', color: '#534AB7' },
    { id: 'p5', num: '5', label: 'Match', start: '2030-09-01', end: '2031-03-31', status: 'queued',
      objective: 'Dual-apply I-6 and categorical GS; match',
      failure: 'A narrow list built on preference rather than roster evidence', color: '#6E4B8A' }
  ],

  milestones: [
    { id: 'm-abs',   label: 'Abstract deadline',        date: '2026-09-07', kind: 'crit' },
    { id: 'm-sip',   label: 'NIH SIP opens',            date: '2026-11-15', kind: 'open' },
    { id: 'm-let',   label: 'Letters requested',        date: '2026-12-10', kind: 'open' },
    { id: 'm-apps',  label: 'Applications close',       date: '2027-02-15', kind: 'crit' },
    { id: 'm-st1',   label: 'USMLE Step 1',             date: '2028-07-15', kind: 'crit' },
    { id: 'm-st2',   label: 'Step 2 CK',                date: '2030-06-15', kind: 'crit' },
    { id: 'm-eras',  label: 'ERAS submission',          date: '2030-09-15', kind: 'open' },
    { id: 'm-match', label: 'Match Day',                date: '2031-03-20', kind: 'crit' }
  ],

  /* ── §05 PHASE 0 — the only items that are live ──────────────────── */
  phase0: {
    window: 'Aug 24 → Sep 30 2026',
    lede: 'Five weeks. Ten items. Nothing else.',
    items: [
      { id: 'p0-abstract', t: 'Ship the Sep 7 abstract', tag: 'P0', due: '2026-09-07',
        d: 'The only near-term CV line that will exist when applications open in November. Non-negotiable date.',
        steps: ['Finish the gastric-cancer data analysis',
                'Draft, circulate to co-authors with a 48-hour response window stated explicitly',
                'Submit by Sep 7',
                'On acceptance, log it as an accepted abstract — it goes in the NIH personal statement and on the CV'] },

      { id: 'p0-screener', t: 'Run the NIH eligibility screener', tag: 'FIRST',
        d: 'The NIH Application Center portal contains an official screener. It resolves the foreign-enrollment question definitively, for free, in ~20 minutes. Do this before anything else in the application campaign — the answer determines whether Phase 1 is built around NIH or around private institutions.',
        steps: ['Create the NIH Application Center profile (it persists for future cycles)',
                'Complete the screener',
                'Record the result in the verification queue'] },

      { id: 'p0-emails', t: 'Email the eligibility question to 3–4 non-NIH targets', tag: 'NOW',
        d: 'One paragraph, sent now, not in January. Log every answer.',
        script: 'I am a U.S. citizen currently enrolled full-time as a medical student at an accredited European medical school. Before applying to [program], could you confirm whether students enrolled at accredited medical schools outside the U.S. are eligible?',
        steps: ['Send to the four highest-value non-NIH targets', 'Log every answer against the target list'] },

      { id: 'p0-clinic', t: 'Finish the clinic weeks — treat them as letter-generating',
        d: 'The clinical letter only exists if the supervisor can describe your work specifically. Before the internship ends: ask for a 10-minute conversation, state that you are applying to US summer research programs in December, and ask whether they would be willing to write in support. Getting the yes now costs nothing; getting it in December may be impossible.' },

      { id: 'p0-sponsor', t: 'The senior sponsor call', tag: 'HIGHEST EV',
        d: 'The highest-expected-value hour of the autumn. A paediatric CT surgeon inside the hospital cluster ranked first, who has known you since childhood.',
        d2: 'Structure: relationship first, no ask in the first ten minutes. Then — I’m applying for US summer research positions for 2027, NIH and several affiliated programs. I’d value your read on which are realistic for someone at a European school, and whether there’s anyone you’d suggest I speak to.',
        d3: 'That is not asking for a job. It is asking for a map, and it lets him offer more if he wants to. A position arranged this way has a far higher probability than any open application, is more likely to be CT than ortho, and carries the same brand.' },

      { id: 'p0-debt', t: 'Clear the owed debt to the breast-surgery professor',
        d: 'Highest-reach local mentor, flagged owed, ~30 days cold, and a rec-letter source. One message, specific, no ask attached. The cheapest item on the board and prerequisite to the December letter request.' },

      { id: 'p0-income', t: 'The income stack',
        d: 'Three streams, in descending order of strategic value.',
        table: [
          { k: 'Tutoring US students', v: 'Highest', n: 'USD-denominated, flexible hours, scales, and it survives the return home. The only stream with a future — prioritise setting it up over marginal shift hours.' },
          { k: 'Hourly shift work', v: 'Immediate cash', n: 'Take the hours, but not at the cost of the Sep 7 abstract.' },
          { k: 'Volunteering internship', v: 'Non-financial', n: 'Its value is the clinical letter and the CV line, not the experience. Confirm before starting: will the supervisor write for you in December?' }
        ] },

      { id: 'p0-paper', t: 'The self-authored CTS paper from public data', tag: 'TWO JOBS',
        d: 'The right instinct and the highest-value optional item in Phase 0. But it is actually two different jobs, and conflating them is how it fails.',
        jobs: [
          { k: 'Job A — the CV line',
            v: 'A systematic review or meta-analysis on a cardiothoracic question. Fully public data (published trials), no credentialing, no data-use agreement, no gatekeeper. Established methodology (PRISMA). Your gastric-cancer partner can serve as the second screener, which the method requires anyway. Realistic: 8–12 weeks to a submittable manuscript. Highest completion probability of any option.' },
          { k: 'Job B — the proof of skill',
            v: 'A small computational analysis with a public code repository. This is what makes a cold email to an NIH PI land — not "I’m interested in your work" but "here is a clean analysis I ran; here is the code."' }
        ],
        sources: [
          { src: 'GEO (gene expression)', cost: 'Free, instant', fit: 'Cardiac transplant / CAV datasets. Directly on-thesis. Needs R or Python.', good: true },
          { src: 'MIMIC-IV (ICU)', cost: 'CITI training + credentialing, ~2–6 weeks, needs a referee', fit: 'Cardiac surgery subpopulation. Best fit for post-op deterioration questions.', good: true },
          { src: 'NHANES', cost: 'Free, instant', fit: 'Weak CT relevance. Skip.', good: false },
          { src: 'Transplant registry STAR files', cost: 'Data request, fee, usually needs institutional affiliation', fit: 'The real prize for heart transplant research — but gated. Route through a mentor, not solo.', good: false },
          { src: 'National inpatient sample', cost: 'Purchase + DUA + training', fit: 'Cost-gated. Skip for now.', good: false }
        ],
        rule: 'The one rule that decides whether this works: get a senior author. A solo-authored paper from a pre-clinical student with no supervising name reads as low quality to reviewers and to program directors, and journals reject it disproportionately. Ask a professor: I’ll do all the work — the search, the screening, the extraction, the analysis, the writing. Would you supervise and be senior author? That costs them very little and roughly doubles your odds of acceptance.',
        kill: 'If by 15 October there is no senior author and no locked question, drop Job A and keep only Job B. A code repository with a competent analysis still does the work in a PI email; a half-finished manuscript does nothing.' },

      { id: 'p0-credit', t: 'Build the US infrastructure — before you leave', tag: 'CLOCK',
        d: 'You are a US citizen with, most likely, no US credit file. In 2028 you will need to rent a NYC apartment and qualify for roughly $210,000 of private student loans. Both are priced off a credit score that takes years, not months, to build. Starting this summer is the difference between a good private rate and a bad one — and on a $210k balance, one percentage point is roughly $2,100/year.',
        table: [
          { k: 'US driver’s license', v: 'Primary US ID; required for most credit and banking applications; NYC rentals and residency interviews assume it', n: 'Do it in your state of residence this summer. Non-US licenses complicate everything downstream.' },
          { k: 'Authorized user on a family card', v: 'The single fastest credit-building move available. You inherit the account’s age and payment history — the part you cannot manufacture.', n: 'Ask for the oldest card with the cleanest history. You do not need to carry or use the card.' },
          { k: 'Own credit card', v: 'Builds an independent file. Start with a secured or student card if approval is thin.', n: 'Apply after being added as an authorized user — the boost may improve approval odds.' },
          { k: 'One small recurring autopay', v: 'Generates a monthly on-time payment record with near-zero risk of overspending', n: 'Pay in full automatically every month. Never carry a balance — utilisation above ~10% actively damages the score.' },
          { k: 'US bank account + SSN on file', v: 'Prerequisite for the above, and for loan disbursement and residency payroll later', n: '' }
        ],
        target: 'A 4–5 year old credit file with unbroken on-time history by the time private loan applications happen in spring 2028. Achievable only if the clock starts now.',
        rule: 'Build history, not debt. The card exists to be paid off in full monthly. Consumer interest at 20%+ is the one form of debt with no strategic justification anywhere in this plan.' },

      { id: 'p0-return', t: 'Return 30 September',
        d: 'Back for the first classes. Work to the last practical day — but the abstract, the sponsor call, and the credit infrastructure all have to be finished before the flight, because term time will not make room for them.' }
    ],
    exit: ['Abstract submitted', 'NIH screener result known', '4 eligibility emails sent and logged',
           'Clinical letter verbally agreed', 'Sponsor call done', 'Owed debt cleared',
           'Tutoring stream live', 'CTS paper question locked with a named senior author (or consciously deferred)',
           'US driver’s license issued', 'Authorized-user status active', 'Own card approved',
           'Recurring autopay running', 'Flight home 30 Sep']
  },

  /* ── §06 PHASE 1 — the campaign ──────────────────────────────────── */
  phase1: {
    lede: 'The year has one job: win a US summer research position. Coursework is a floor requirement, not an achievement.',
    targets: [
      { n: 1,  name: 'NIH SIP — heart/lung, neuro, musculoskeletal institutes', field: 'All three', paid: 'Yes, stipend',
        opens: 'mid-Nov 2026', closes: 'mid-Feb 2027 (+1 wk for letters)', verified: true,
        note: 'US citizen + enrolled ≥half-time at an accredited college/university. The US-institution restriction is written for permanent residents only. Strongest single target.' },
      { n: 2,  name: 'A top-tier affiliated ortho trauma programme', field: 'Ortho', paid: 'No',
        opens: '~Jan 5', closes: '~Feb 27', verified: false, note: 'US citizen ✓. "Accredited medical school" undefined — VERIFY.' },
      { n: 3,  name: 'Major cardiac institute summer internship', field: 'CT', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Most CT-specific option in the file.' },
      { n: 4,  name: 'Specialty orthopaedic hospital, NYC', field: 'Ortho', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Top ortho brand in NYC — aligns with the later NYC phase.' },
      { n: 5,  name: 'Top-tier midwest clinic summer research', field: 'CT / all', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Top-tier CT institution.' },
      { n: 6,  name: 'Major cancer centre, NYC', field: 'Onc / surgical', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Direct continuity with the gastric-cancer work.' },
      { n: 7,  name: 'Mid-atlantic academic summer surgical research', field: 'All', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: '' },
      { n: 8,  name: 'Large clinic SURF programme', field: 'All', paid: 'Yes',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Often restricted to US institutions — VERIFY early.' },
      { n: 9,  name: 'NYC academic medical centres (three)', field: 'CT + neuro', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Seeds the NYC clinical phase.' },
      { n: 10, name: 'CT surgical society summer intern scholarship', field: 'CT', paid: 'Yes',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: 'Likely restricted to North American schools — VERIFY.' },
      { n: 11, name: 'Thoracic surgery foundation student programmes', field: 'CT', paid: 'Varies',
        opens: 'VERIFY', closes: 'VERIFY', verified: false, note: '' },
      { n: 12, name: 'Sponsor-brokered position', field: 'CT', paid: '?',
        opens: 'n/a', closes: 'n/a', verified: true, note: 'Highest probability per unit effort.' }
    ],
    applyRule: 'Apply to 8–12. Breadth is the strategy for a single-shot summer. A brand-first ranking with one application is not a plan, it is a wish.',
    piProtocol: {
      lede: 'The NIH has no centralized selection. Individual PIs review applications, choose their own interns, and fund them from their own budgets. Interviews and offers begin in early January and conclude by April 1. To be considered, you are expected to email PIs directly and point them to your submitted application.',
      punch: 'Submitting and waiting is the standard way to be rejected from this program.',
      steps: [
        'Build a list of 30 PIs across the three target institutes from the intramural research database',
        'One personalized email each — 150 words maximum: who you are, one specific sentence about their paper, what you can do (data analysis, literature synthesis, the abstract as evidence), and a pointer to your submitted application',
        'Track: sent date · reply · interview · outcome',
        'Expect a 10–20% reply rate. Thirty emails is the input for three conversations.'
      ],
      note: 'This is the same skill you already run on the home network, at higher volume.'
    },
    quarters: [
      { id: 'q1', label: 'Q1 · Oct–Dec 2026 — build the machine', items: [
        'Master CV (one page, dated, with the accepted abstract on it)',
        'Master personal statement + tailored versions per program',
        'Target list completed with confirmed dates and eligibility answers',
        'NIH profile submitted the week it opens (mid-Nov) — early submission gives PIs three extra months to see you',
        'PI list of 30 built by Dec 1; first 10 emails sent in December',
        'Letters requested in the first week of December, with a packet: CV, personal statement, the list of programs and deadlines, and the exact submission mechanism for each',
        'Nudge the stalled manuscript every 3 weeks. It is not your task; it is your reminder.'
      ] },
      { id: 'q2', label: 'Q2 · Jan–Mar 2027 — the campaign', items: [
        'Remaining 20 PI emails, January',
        'All applications submitted in the first half of each window, not at the deadline',
        'Confirm every letter actually uploaded — a missing letter is the most common silent failure',
        'Interviews from early January; prepare a 3-minute version of the gastric project and a 30-second version of why CT',
        'If no offers by mid-March: activate the fallback ladder'
      ] },
      { id: 'q3', label: 'Q3 · Apr–Jun 2027 — convert', items: [
        'Accept and lock logistics: dates, housing, health insurance (NIH requires proof), travel',
        'Read into the lab’s last 3 years of output before arrival',
        'Close the academic year cleanly; do not let exams collide with departure',
        'Begin the Step 1 resource decision — not the studying, the decision'
      ] }
    ],
    fallback: [
      { n: 1, t: 'Sponsor-brokered position', d: 'Even unofficial, even unpaid, even 6 weeks.' },
      { n: 2, t: 'Home-faculty CT research summer', d: 'With the national CT surgeon or the local CT surgeon — an abstract from home still beats no summer.' },
      { n: 3, t: 'The CAV computational project, properly scoped', d: 'Public expression data, remote, no lab needed. This is the one that has been available all along and keeps not getting done. Give it a supervisor and a deadline or it will not happen a second time.' },
      { n: 4, t: 'Earn', d: 'If all research doors close, take the highest-paying summer available and stop pretending otherwise.' }
    ]
  },

  /* ── §07 PHASE 2 ─────────────────────────────────────────────────── */
  phase2: {
    lede: 'The position is the input. The output is what matters.',
    deliverables: [
      { t: 'An abstract', d: 'Submitted to a named conference — ask in week one what meeting the group targets and what deadline it carries.' },
      { t: 'A letter', d: 'The PI must be able to write specifically about your work, which means weekly written updates, not just presence.' },
      { t: 'A named next step', d: 'A continuing remote analysis, a manuscript position, or a standing invitation back.' }
    ],
    rules: [
      'Week one: agree the scope, the deadline, and the authorship expectation in writing (an email summary is enough)',
      'Weekly: one-paragraph written update to the PI. This is what a strong letter is made of.',
      'Present at the program’s poster day (the NIH runs one in early August)',
      'Do not take on a second project until the first has a submitted output'
    ],
    bend: 'Whatever the topic, write and present it toward the vascular endothelium and the immune response at the blood–tissue interface where it is honest to do so. That is how an ortho or neuro summer still builds a CT identity.'
  },

  /* ── §08 PHASE 3 ─────────────────────────────────────────────────── */
  phase3: {
    step1: {
      what: 'Pass/fail since 2022. There is no score, no percentile, nothing to optimize. The behind-the-scenes standard is ~196 with roughly 60% correct needed. IMG first-attempt pass rate sits near 72%, so it is a real exam — but it is a threshold, not a differentiator.',
      consequence: 'Do not over-invest in Step 1. Every hour past a comfortable pass is an hour stolen from Step 2 CK, which is the only number on your application. But do not under-invest either — a first-attempt fail is one of the few things that permanently damages a surgical application.',
      plan: [
        { k: 'Timing', v: 'Summer 2028, at the pre-clinical/clinical boundary' },
        { k: 'Runway', v: 'Dedicated 8–10 weeks, protected. Book the date by March 2028 so it is fixed.' },
        { k: 'Longitudinal layer', v: 'From autumn 2027, a daily question block alongside coursework. Home curriculum and USMLE blueprint do not overlap cleanly — the gap analysis is real work and belongs in autumn 2027, not June 2028.' },
        { k: 'Goal', v: 'Comfortable first-attempt pass, then immediately pivot the same content engine toward Step 2 CK.' }
      ]
    },
    parallel: [
      { t: 'The CAV computational project', s: 'queued', d: 'This is its window. Remote, public data, no lab. Scope it to one answerable question with a named supervisor.' },
      { t: 'LVAD / biomaterials', s: 'dormant', d: 'Only if lab access is real and it does not touch Step 1 time. Otherwise dormant.' },
      { t: 'Convert the summer-2027 abstract into a manuscript', s: 'queued', d: '' },
      { t: 'Begin the ECFMG process', s: 'queued', d: '' },
      { t: 'Second US summer or elective', s: 'dead', d: 'Not available — summer 2028 is Step 1.' }
    ]
  },

  /* ── §09 PHASE 4 ─────────────────────────────────────────────────── */
  phase4: {
    lede: 'Three years, one exam, one certification, and the letters that decide the match.',
    step2: [
      { k: '218',  v: 'Passing standard (raised from 214 on 1 Jul 2025)' },
      { k: '~249', v: 'Mean for first-time US/Canadian MD examinees' },
      { k: '255+', v: 'The working target for surgical subspecialties', hot: true },
      { k: '260+', v: 'First-choice-program territory' }
    ],
    step2Note: 'Take it after the core clinical year that best supports it — typically after surgery and medicine — and before ERAS opens in September 2030. Do not delay it into the application year.',
    ecfmg: 'Required before you can enter a US residency. Components: Step 1 pass, Step 2 CK pass, and a medical school that satisfies the recognized-accreditation policy — accredited by an agency recognized by WFME or NCFMEA, with a sponsor note in its World Directory listing. Also required: the English/pathways requirements as they stand at the time, and identity and credential verification, which is slow. Start the application in 2029, not 2030.',
    ecfmgVerify: 'Look up the home school in the World Directory of Medical Schools now. Check the sponsor-notes tab for both the sponsor note and recognized-accreditation status. This is a five-minute check on a requirement that, if unmet, ends the entire US pathway — and it should not be discovered in 2030.',
    letters: [
      'Hands-on beats observership. Sub-internships and acting internships in the specialty are what generate letters that carry weight.',
      'Target 3–4 letters, ideally two from US surgeons in the target specialty',
      'Away rotations / audition electives in the final clinical year at programs you intend to apply to. For surgical subspecialties, the away rotation frequently is the interview.',
      'Track every rotation: site, attending, dates, whether a letter was requested and secured'
    ],
    timeline: [
      { w: 'Sep 2028',          d: 'NYC rotations begin' },
      { w: '2029',              d: 'ECFMG application opened; core clinical rotations; first US letters' },
      { w: 'Early–mid 2030',    d: 'Step 2 CK' },
      { w: 'Spring–summer 2030',d: 'Away rotations at target programs' },
      { w: 'Sep 2030',          d: 'ERAS submitted' },
      { w: 'Oct 2030–Jan 2031', d: 'Interviews' },
      { w: 'Feb 2031',          d: 'Rank list' },
      { w: 'Mar 2031',          d: 'Match Day' }
    ]
  },

  /* ── §10 PHASE 5 — residency targets ─────────────────────────────── */
  phase5: {
    picture: 'Integrated thoracic surgery (I-6) is among the most competitive pathways in American medicine: a small number of programs, roughly 150 positions nationally per year, and IMG matches in the very low single digits annually. VERIFY against current NRMP Charting Outcomes before rank-list decisions.',
    advantages: 'US citizenship (no visa sponsorship required — this alone removes the barrier that eliminates most IMGs from surgical programs), three years of US clinical rotations, US letters, and a research record.',
    disadvantages: 'No LCME school, no US MSPE in the familiar format, no home program, no institutional advocacy.',
    tiers: [
      { id: 'A', label: 'Reach — I-6 integrated thoracic surgery', color: '#A32E27',
        d: 'Research-heavy programs where a publication record and away-rotation performance can override pedigree. Candidate list to build and verify in 2029–2030 by checking each program’s current and past resident rosters for any IMG.',
        rule: 'A program with zero IMGs in ten years of rosters is not a target, however much you want it.' },
      { id: 'B', label: 'Core — categorical General Surgery → CT fellowship', color: '#0F6E56',
        d: 'The realistic primary route for a US-citizen IMG, and not a downgrade — it is how most cardiothoracic surgeons still train. Target GS programs that have matched IMGs recently and have a strong record of placing residents into CT fellowships.',
        rule: 'Build this list from resident rosters and fellowship-match data, not from reputation.' },
      { id: 'C', label: 'Contingency — ortho and neurosurgery', color: '#854F0B',
        d: 'Be honest in the file: both are harder for IMGs than general surgery, not easier. Their value to you now is as research and brand access in 2027, not as a likely match.',
        rule: 'If genuine interest develops during the clinical years, revisit — but do not build a residency strategy on them from here.' }
    ],
    gateRule: 'Always apply broadly to categorical GS regardless of I-6 confidence. An unmatched year costs more than any application fee.'
  },

  /* ── §11 research pipeline ───────────────────────────────────────── */
  pipeline: {
    stages: ['Idea', 'Question locked', 'Access', 'Analysis', 'Draft', 'Co-author review', 'Submitted', 'Revision', 'Accepted'],
    stageNote: 'Co-author review and Revision are their own columns. That is where manuscripts die invisibly.',
    fields: ['title', 'tier', 'ball', 'days_in_stage', 'authorship_position', 'on_thesis', 'blocker'],
    redFlagDays: 21,
    ballNote: 'The ball field is the whole system. Ball in your court for 40 days is a discipline problem. Ball in a co-author’s court for 40 days is a nudge problem. Opposite interventions; most trackers conflate them.',
    wip: { inFlight: 3, offThesis: 1, note: 'Off-thesis limit suspended through Feb 2027, because throughput is currently worth more than thematic purity. Nothing new enters until something exits.' },
    tiers: [
      { t: 'Case report',                hrs: '8–15',  cyc: '2–4 mo',   use: 'The oncology professor’s standing offer. Cheapest real paper that exists' },
      { t: 'Conference abstract',        hrs: '15–30', cyc: '1–3 mo',   use: 'The current gastric work. Highest value per hour right now', hot: true },
      { t: 'Narrative review',           hrs: '30–50', cyc: '4–8 mo',   use: 'No data access needed' },
      { t: 'Retrospective on existing DB', hrs: '40–80', cyc: '6–12 mo', use: '' },
      { t: 'Original analysis',          hrs: '150+',  cyc: '12–18 mo', use: 'CAV. On-thesis only, and only in 2027/28' }
    ],
    authorshipRule: 'First-author on-thesis. Any-author off-thesis. A middle-author paper still counts on the ERAS line and costs a fraction of the hours. Chasing first authorship off-thesis is the expensive version of a cheap asset.',
    board: [
      { id: 'pipe-gastric-abs', title: 'Gastric cancer abstract',           tier: 'Abstract',   stage: 'Analysis',        ball: 'you',       onThesis: false, due: '2026-09-07', priority: 'P0' },
      { id: 'pipe-cts-meta',    title: 'CTS meta-analysis (Job A)',         tier: 'Review',     stage: 'Question locked', ball: 'you',       onThesis: true,  due: '2026-10-15', priority: 'P1', note: 'needs a senior author by Oct 15' },
      { id: 'pipe-cts-code',    title: 'CTS public-data analysis (Job B)',  tier: 'Analysis',   stage: 'Idea',            ball: 'you',       onThesis: true,  due: null,        priority: 'P1', note: 'the PI-email artifact' },
      { id: 'pipe-gastric-ms',  title: 'Gastric cancer manuscript',         tier: 'Original',   stage: 'Co-author review',ball: 'co-author', onThesis: false, due: null,        priority: 'P3', note: 'nudge every 3 weeks only', blocker: 'Collaborator' },
      { id: 'pipe-cav',         title: 'CAV computational',                 tier: 'Original',   stage: 'Idea',            ball: 'you',       onThesis: true,  due: null,        priority: 'queued', note: 'window is 2027/28; may merge into Job B' },
      { id: 'pipe-lvad',        title: 'LVAD coating',                      tier: 'Original',   stage: 'Idea',            ball: 'you',       onThesis: true,  due: null,        priority: 'dormant' },
      { id: 'pipe-onco',        title: 'Oncology annex (case report)',      tier: 'Case report',stage: 'Idea',            ball: 'you',       onThesis: false, due: null,        priority: 'optional', note: 'accept only if ≤15 hrs' }
    ]
  },

  /* ── §12 network CRM — roles only, no names ──────────────────────── */
  network: [
    { role: 'Senior sponsor — paediatric CT surgeon, inside the first-ranked hospital cluster', reach: 'Highest', owed: false, next: 'The 45-minute call: map, not ask', by: 'Sep 2026' },
    { role: 'Breast-surgery professor — home faculty',        reach: '3', owed: true,  next: 'Clear the debt; letter ask in December', by: 'Sep 2026' },
    { role: 'Oncology professor — home faculty',              reach: '2', owed: false, next: 'Case-report offer — accept only if ≤15 hrs', by: 'Optional' },
    { role: 'Vice dean + second professor — academic letters', reach: '—', owed: false, next: 'Warn in November, packet in December', by: 'Dec 2026' },
    { role: 'Clinic supervisor — clinical letter',            reach: '—', owed: false, next: 'Secure the verbal yes before the internship ends', by: 'Sep 2026' },
    { role: 'Peer CT resident in the US — ground truth on the IMG pathway', reach: '—', owed: false, next: 'One call on I-6 realism and away rotations', by: 'Winter 2026/27' },
    { role: 'National CT surgeon — research access',          reach: '—', owed: false, next: 'Reactivate only for the 2027 fallback', by: 'Mar 2027' },
    { role: 'NIH principal investigators (×30) — the actual selectors', reach: '—', owed: false, next: 'Build list November; email December–January', by: 'Jan 2027' }
  ],
  networkRule: 'Every gate in this document is opened by a named human. Cold applications are the low-probability path in all of them.',

  /* ── §13 finance ─────────────────────────────────────────────────── */
  finance: {
    position: { netWorth: -250, note: 'Remaining summer earnings at $15.15/hr + tips across 30–45 hr weeks for ~5 weeks. Realistic end-of-summer liquid: $2–3.5k before living costs.' },
    changes: 'Nothing about the 2027 goal. Every item in Phases 0–2 costs email, time, and one plane ticket. What it does change: v1’s investment, patent-fund and venture layers are dormant and should be visually greyed rather than shown as behind schedule. A plan that displays five failing metrics gets abandoned; a plan that displays two live ones gets used.',
    funding2027: ['Stipend (NIH SIP pays)', 'Program housing', 'External scholarships — apply autumn 2026', 'Family', 'Loans, last resort'],
    fundingNote: 'Add a scholarship search block to Q1. Three applications in November is a plausible $2–5k.',
    caps: [
      { k: 'Professional student, annual',    v: '$50,000' },
      { k: 'Professional student, aggregate', v: '$200,000' },
      { k: 'Lifetime federal total',          v: '$257,500' },
      { k: 'Grad PLUS',                       v: 'Eliminated for new borrowers as of 1 July 2026', bad: true }
    ],
    gapNote: 'Gap: roughly $210,000. Title IV eligibility means you can borrow. It does not mean you can borrow $350k. v1’s assumption — federal-only, cover the gap with savings, zero private debt, full forgiveness — was built on Grad PLUS covering the full cost of attendance. That instrument no longer exists.',
    grandfathering: 'RESOLVED 24 Aug 2026 — no federal loan was disbursed before 1 July 2026, so the legacy provision that would have preserved Grad PLUS access is unavailable. The caps above are binding.',
    exhaustFirst: [
      'Scholarships and grants — now materially more valuable than before. Autumn 2026 is not too early.',
      'Family contribution — needs an explicit, numbered conversation, not an assumption',
      'Earned income across 2026–2031 — tutoring in USD is the only stream that scales here',
      'Reducing the cost — is the full American Track required, or is there a cheaper route to the same NYC clinical years?',
      'Private loans — last resort. Private debt is never forgiveness-eligible. A $210k private balance is not forgiven after 120 payments; it follows you through residency at commercial interest.'
    ],
    costModel: [
      { phase: 'Pre-clinical, home faculty', years: '2026/27 – 2027/28', per: '$10,000 tuition', total: 20000 },
      { phase: 'NYC clinical',               years: '2028/29 – 2030/31', per: '$70,000 tuition + ~$60,000 living', total: 390000 }
    ],
    costTotal: 410000,
    costCorrection: 'The stated per-year figures sum to $410,000, not $380,000. The $30,000 delta is not rounding; it is an extra year of private borrowing. Plan against $410k and treat anything less as upside.',
    livingLever: 'Living costs are the only soft number here. NYC at $60,000/year is $180,000 across the clinical phase, all of it private debt at 10%. Every $10,000/year you cut — roommates, outer-borough housing, tutoring income continuing through the clinical years — removes ~$30,000 of the most expensive debt you will ever carry. This is a larger lever than any investment decision available to you.',
    sources: [
      { k: 'Federal Direct Unsubsidized', amt: 200000, pslf: true,  rate: '~8%',  note: 'annual $50k cap, $200k aggregate' },
      { k: 'Private',                     amt: 210000, pslf: false, rate: '~10% fixed', note: 'cosigner required' }
    ],
    keyMove: {
      t: 'Max out federal in the pre-clinical years',
      d: 'Federal borrowing is limited by both the $50,000 annual cap and each year’s cost of attendance. In the NYC years, COA is ~$130k, so you take the full $50k — three years = $150,000. That leaves only $50,000 of your $200,000 aggregate cap for the two pre-clinical years. Tuition is $10,000/year, but cost of attendance includes a living allowance. If you borrow only tuition, you will hit graduation having used roughly $170,000 of a $200,000 forgivable allowance — and the missing $30,000 becomes private debt instead.',
      rule: 'Borrow up to the full certified COA in each pre-clinical year, even if you do not need the cash. Hold the surplus and use it to displace private borrowing in the NYC years. Every dollar moved from private to federal is a dollar that gets forgiven in 2041 instead of repaid at 10%. Confirm your certified COA with the financial aid office in autumn 2026.'
    },
    atGraduation: { federal: 237000, private: 246000, total: 483000, interest: 73000 },
    rap: {
      note: 'For loans first disbursed on or after 1 July 2026, RAP is the only income-driven option; the tiered standard plan does not qualify for forgiveness. Payment = AGI × bracket rate ÷ 12. The rate starts at 1% and rises one point per $10,000 of AGI, capping at 10% above $100,000. Unpaid interest is waived rather than capitalised, and a government match guarantees principal falls at least $50/month.',
      rows: [
        { y: 'PGY1', agi: 64000, rate: '6%', pay: 320 }, { y: 'PGY2', agi: 67000, rate: '6%', pay: 335 },
        { y: 'PGY3', agi: 70000, rate: '6%', pay: 350 }, { y: 'PGY4', agi: 73000, rate: '7%', pay: 426 },
        { y: 'PGY5', agi: 76000, rate: '7%', pay: 443 }, { y: 'PGY6', agi: 79000, rate: '7%', pay: 461 },
        { y: 'PGY7', agi: 82000, rate: '8%', pay: 547 }
      ],
      total: 'Total federal paid across seven years: ~$34,600, for 84 qualifying payments. The balance barely moves — that is the design. You are buying forgiveness, not amortising.',
      cliff: 'Watch the bracket cliffs. The rate jumps a full point at each $10,000 line, applied to your entire AGI. At $70,000 you pay 6%; at $70,001, 7% — one dollar of moonlighting income costs ~$700/year. Use pre-tax retirement contributions to sit just under the lines.'
    },
    forgiveness: {
      steps: ['84 qualifying payments in residency (Jul 2031 – Jun 2038)',
              '36 more as an attending at a qualifying non-profit academic centre (Jul 2038 – Jun 2041), ~$4,250/mo at ~$510k AGI',
              'Forgiveness at payment 120: ~July 2041, age ~35',
              'Balance forgiven, tax-free: ~$130,000',
              'Total ever paid on the federal $200,000: ~$187,000'],
      condition: 'All 120 months must be full-time at a qualifying non-profit. Residency programmes almost always qualify. The first attending job must also be non-profit academic. Private practice in 2038 forfeits ~$130,000.'
    },
    privateHalf: {
      note: '$246,000 at graduation, no forgiveness, ever. Interest-only would be ~$2,050/month during residency, on top of RAP, on a $70k salary. Not affordable in PGY1–3.',
      strategies: [
        { s: 'Minimum (~$600/mo, refi to 6.5% in PGY3)', bal: '$347,000', payoff: '$6,780/mo × 5 yrs', clear: '2043' },
        { s: 'Aggressive (moonlight PGY4–7 → ~$32k/yr at principal)', bal: '$237,000', payoff: '$5,626/mo × 4 yrs', clear: '2042', best: true },
        { s: 'Aggressive + 3-yr crunch', bal: '$237,000', payoff: '$7,271/mo × 3 yrs', clear: '2041' }
      ],
      delta: '~$110,000 difference between the minimum and aggressive paths, and a year or two off the clock. The lever is moonlighting income in the senior residency and fellowship years, applied entirely to private principal.',
      refi: 'Refinance the private loan — never the federal. Refinancing federal debt converts it to private and destroys forgiveness permanently. Refinance private once you have an attending contract; 10% → 6.5% is worth ~$8,000/year on this balance.'
    },
    scenarios: [
      { n: 1, path: 'Forgiveness + minimum private',    free: '2043',                 paid: '~$530,000' },
      { n: 2, path: 'Forgiveness + aggressive private', free: '2041–2042, age ~35–36', paid: '~$420,000', best: true },
      { n: 3, path: 'No forgiveness (private practice attending)', free: '2043–2045', paid: '$700,000+' }
    ],
    scenarioNote: 'Scenario 3 costs roughly $280,000 more than Scenario 2. The highest-value financial decision of the next fifteen years is not an investment — it is taking a non-profit academic attending post in 2038 and holding it three years. Which is what an academic CT career looks like anyway.',
    rules: [
      'Borrow the full certified COA every pre-clinical year. Federal dollars get forgiven; private dollars never do.',
      'Never refinance federal debt. Refinance private freely.',
      'Every scholarship dollar displaces a private dollar. $10,000 won in 2027 is worth ~$25,000 by 2042.',
      'NYC living costs are the biggest controllable number in this plan. $10k/yr saved = ~$30k of 10% debt avoided.',
      'Certify qualifying employment annually. Uncertified months are how physicians lose forgiveness.',
      'Manage AGI around the bracket lines.',
      'The 2038 job decision is worth ~$130,000. Non-profit academic.',
      'No aggressive investing until the private loan is dead. Paying down 10% debt is a guaranteed 10% return.',
      'Own-occupation disability insurance before residency ends. $483,000 of non-dischargeable debt against a surgeon’s hands is the exposure that ends this plan quietly.'
    ],
    revisit: 'Assumptions to revisit annually: federal 8%, private 10%, residency 7 years (I-6 shortens it to 6 and improves everything), attending $550k, NYC living $60k/yr, RAP as legislated in 2026. Recompute when any one changes.'
  },

  /* ── §14 risk register ───────────────────────────────────────────── */
  risks: [
    { r: '$210k private debt, non-forgivable', sev: 'High, permanent', sig: 'Confirmed — not grandfathered',
      mit: 'Scholarship campaign displaces private dollars 1:1; moonlight PGY4–7 into private principal; refinance private, never federal' },
    { r: 'Losing forgiveness eligibility', sev: '~$130,000', sig: 'A non-qualifying employer month, or an uncertified year',
      mit: 'Certify employment annually; take a qualifying academic attending post in 2038 and hold 3 years' },
    { r: 'Disability before the debt clears', sev: 'Catastrophic', sig: '—',
      mit: 'Own-occupation disability insurance secured before residency ends' },
    { r: 'Foreign-enrollment ineligibility (summer programs)', sev: 'Fatal to Phase 1', sig: 'Screener or program says no',
      mit: 'Run the screener in Phase 0; pivot to sponsor-brokered + home-faculty fallback' },
    { r: 'Home school loses Title IV eligibility', sev: 'Severe', sig: 'Annual check fails',
      mit: 'Currently eligible. Reconfirm each year; build a non-federal contingency for the NYC years' },
    { r: 'No summer 2027 position', sev: 'High', sig: 'No offers by mid-March', mit: 'Fallback ladder' },
    { r: 'Letters not uploaded', sev: 'High, silent', sig: 'No confirmation email',
      mit: 'Confirm every letter individually before each deadline' },
    { r: 'Step 1 first-attempt fail', sev: 'Severe', sig: 'Practice scores below threshold at 4 weeks out',
      mit: 'Protected 8–10 week block; postpone rather than fail' },
    { r: 'I-6 match failure', sev: 'Moderate (survivable)', sig: 'Weak file at the 2030 gate',
      mit: 'Always dual-apply broadly to categorical GS' },
    { r: 'Burnout', sev: 'Structural', sig: 'Sleep <7h sustained, faith/training dropped, avoidance of the plan itself',
      mit: 'Sleep floor is a hard constraint, not an aspiration. A dormant layer is not a failure.' },
    { r: 'Plan abandonment', sev: 'Underrated', sig: 'Dashboard not opened for 3+ weeks',
      mit: 'Fewer live metrics; one forcing function at a time' }
  ],
  premortem: {
    q: 'It is March 2027 and there is no US position.',
    causes: ['Applications were submitted but no PIs were emailed, so nobody funded a position.',
             'An eligibility gate was discovered in February instead of September.',
             'The abstract slipped past Sep 7 and the CV had nothing on it in November.'],
    note: 'All three are preventable in Phase 0.'
  },

  /* ── §15 cadence ─────────────────────────────────────────────────── */
  cadence: [
    { every: 'Weekly', mins: '20 min, Sunday', t: 'The pipeline sweep',
      d: 'One question per item: whose court, how long, what is the smallest move that returns the ball? Anything stalled in someone else’s court past 21 days gets the nudge sent during the sweep, not after it.' },
    { every: 'Monthly', mins: '45 min', t: 'Network CRM pass',
      d: 'Who has gone cold, who is owed, one warm-keeping message each. Update the target-list table.' },
    { every: 'Quarterly', mins: '2 hrs', t: 'Recalibrate',
      d: 'Move items between live / queued / dormant / dead. Delete anything that has not been touched in two quarters and is not dated.' }
  ],
  metrics: [
    { id: 'throughput',  label: 'Accepted outputs / 6 mo', target: 2 },
    { id: 'medianStage', label: 'Median days in stage',    redFlag: 21 }
  ],

  /* ── §16 verification queue ──────────────────────────────────────── */
  verification: [
    { n: '1',  q: 'Home school ECFMG accreditation', how: '—', by: '—', sev: 'fatal', done: true, result: 'RESOLVED 24 Aug 2026 — accredited' },
    { n: '2',  q: 'Home school Title IV / FAFSA eligibility', how: '—', by: 'recheck annually', sev: 'fatal', done: true, result: 'RESOLVED 24 Aug 2026 — eligible' },
    { n: '3',  q: 'Grandfathering under pre-July-2026 loan rules', how: '—', by: '—', sev: 'high', done: true, result: 'RESOLVED — not grandfathered, no prior disbursement' },
    { n: '4',  q: 'Funding plan for the gap above the federal cap', how: '—', by: '—', sev: 'high', done: true, result: 'DECIDED — private loans' },
    { n: '4b', q: 'Private lender comparison: fixed rate, cosigner terms, in-school interest-only option, refinance flexibility', how: 'Four lender rate quotes', by: 'Spring 2028', sev: 'high', done: false },
    { n: '4c', q: 'Does the first attending employer in 2038 need to be a qualifying non-profit? Confirm the rules still stand', how: 'Federal student aid site, annually', by: 'Annually', sev: 'high', done: false },
    { n: '5',  q: 'Does NIH SIP accept a US citizen enrolled at a foreign accredited medical school?', how: 'NIH Application Center eligibility screener', by: '2026-09-30', sev: 'fatal-to-phase', done: false },
    { n: '6',  q: 'Does the top-tier affiliated ortho programme count a European medical school as accredited?', how: 'Email the programme office', by: '2026-09-30', sev: 'high', done: false },
    { n: '6b', q: 'Same question — cardiac institute, orthopaedic hospital, midwest clinic, SURF', how: 'Email each', by: '2026-10-31', sev: 'high', done: false },
    { n: '6c', q: 'Is the American Track’s US clinical placement contingent on anything (GPA, exam, quota)?', how: 'American Track office', by: '2026-10-31', sev: 'high', done: false },
    { n: '7',  q: 'Confirmed 2027 dates and deadlines for targets 3–11', how: 'Program sites', by: '2026-10-31', sev: 'medium', done: false },
    { n: '8',  q: 'Current NRMP Charting Outcomes: IMG match rates, I-6 and GS', how: 'NRMP publications', by: '2029', sev: 'medium', done: false }
  ],

  /* ── §18 the one-paragraph version ───────────────────────────────── */
  oneParagraph: 'You are a US citizen at a European medical school with one clean research summer left before Step 1. The only thing that matters between now and mid-February 2027 is winning a US summer research position — and the way that is won is not applications, it is thirty emails to named principal investigators plus one phone call to a surgeon who has known you since you were a toddler. Everything financial, entrepreneurial, and multi-track in the previous version of this plan is parked, not because it was wrong, but because it competes with the only gate that is currently open. Ship the abstract by 7 September, verify three eligibility questions that could each end a phase, ask for letters in December, and apply everywhere. The rest of the decade is downstream of doing that one thing well.',

  /* Everything v1 carried that is now off the board. Shown greyed, never as
     "behind schedule" — a dormant layer that reads as failure gets the whole
     dashboard abandoned. */
  dormant: [
    { id: 'vwce',      label: 'Index investing / auto-deploy', reopen: 'when liquid > $5k with a stable income floor' },
    { id: 'patent',    label: 'Patent fund',                   reopen: 'at first provisional' },
    { id: 'wave1',     label: 'Wave 1 company',                reopen: 'with capital, time, and a validated clinical problem' },
    { id: 'cofounder', label: 'Co-founder search',             reopen: 'with the company' },
    { id: 'guide',     label: 'Guide / storefront product',    reopen: 'if it can ship in under 20 hours' },
    { id: 'lvad',      label: 'LVAD coating track',            reopen: 'if lab access is real and Step 1 time is untouched' },
    { id: 'exvivo',    label: 'Ex-vivo perfusion',             reopen: 'never — cut in v1, still cut', dead: true }
  ]
};
