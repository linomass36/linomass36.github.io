/* ─────────────────────────────────────────────────────────────────────────
   grind-data.js — month 1: the four-week foundation block, frozen.

   Replaces the nine-week block. Source is "TRAINING + DIET · Four-week
   foundation block", Monday 7 September 2026 to Sunday 4 October 2026.
   Amateur gym and cardio only — combat gyms and firearms start after it.

   Every lift, every cardio set, the posture and calf work, the diet, and
   the shape of each weekday. This is content: it does not change while you
   use it, so it lives here in code and never enters the synced store.
   Grind.dc.html holds the record — which sessions you have finished, where
   the benchmarks sit — and nothing else.

   TWO THINGS CHANGED IN SHAPE, and the page follows them:

   1. The block is dated. The old board deliberately had no start date and
      advanced when the work was done. This one names weeks by their dates
      because the plan does, and because month 2 begins on 5 October whether
      or not week 4 was ticked. The advance button still moves the week — the
      dates are a label, not a lock.

   2. There is no home mode. The plan assumes a gym (barbell, rack, bench,
      dumbbells, cable stack, pull-up bar, carry handles, bike/rower/
      elliptical) and puts its substitutions under each lift instead. So the
      substitutions are in the exercise text where the plan put them, and the
      Gym/Home toggle is gone rather than left to invent a home variant the
      plan never wrote.

   The running rule is the other inversion. The old block ran a nine-week
   jog:walk progression twice a week. This one does not run at all by
   default: shins get non-impact cardio, and the Saturday walk-run is a
   gated test that only advances after two pain-free sessions.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ---------- the block ---------- */
  const BLOCK = {
    title: 'Month 1 — foundation block',
    start: '2026-09-07', end: '2026-10-04', weeks: 4,
    line: 'Amateur gym and cardio only. Combat gyms and firearms start after this block. ' +
          'This is not SWAT school and not a fight camp — it is the physical base those stand on.',
  };
  const WEEKINFO = [
    { w: 1, dates: '7–13 September 2026',
      head: 'Learn the sessions.',
      note: 'Weights should feel like you could do two more reps. No heroics.' },
    { w: 2, dates: '14–20 September 2026',
      head: 'Same days. Small progressions only.',
      note: 'If any compound feels worse, not better, keep the same weight. Joints win arguments.' },
    { w: 3, dates: '21–27 September 2026',
      head: 'The week people overdo because they feel fit.',
      note: 'Do not add a second interval day. If you stall on squat or press, stay.' },
    { w: 4, dates: '28 September – 4 October 2026',
      head: 'Consolidate. No new exercises.',
      note: 'Finish this week able to train Monday of month 2, not destroyed. ' +
            'Sunday 4 Oct: note bodyweight average, what lifts moved, shin status, sleep. ' +
            'That page is what month 2 is built on.' },
  ];

  /* ---------- the hard rules ---------- */
  const RULES = [
    ['Time', [
      'Cap real work at 90–150 minutes. Leftover time inside a three-hour window is easy walking or mobility, not extra heavy sets.',
      'If sleep drops under 7 hours or mood and joints feel wrecked, cut the Thursday intervals or the Friday shadow block. Do not cut protein or the Sunday easy day.']],
    ['Shins', [
      'No regular running this month. Bike, rower, elliptical, swim, or walk instead.',
      'Saturday walk-run only if walking 30 minutes is pain-free and the tibia is not tender to press.',
      'Sharp shin pain during or next morning: stop, stay on non-impact cardio, repeat the same walk-run step later. Do not make up missed running.',
      'Advance a walk-run step only after two pain-free sessions.']],
    ['Shoulders and back', [
      'Every strength day ends with the posture block. That is not optional accessory work.',
      'Do not add extra flat bench. You already have the chest — rows, face pulls and pec-minor stretching are the correction.']],
    ['Load', [
      'Leave two reps in reserve on compounds, RPE 7–8. This is a high-frequency month, not a max-out month.',
      'Add 2.5–5 kg when all sets are clean. If form breaks, the weight is too heavy.']],
    ['Blood', [
      'Train. Do not take NovoSeven for ordinary training soreness.',
      'Deep cuts, uncontrolled bleeding, or head impact: emergency plan, not gym advice.']],
  ];
  const SKIPORDER = 'If a session has to be skipped, skip Thursday first, then the Friday shadow, then a strength accessory. ' +
                    'Do not skip sleep to make it three hours.';

  /* ---------- exercise helper ---------- */
  const E = (n, s, d) => ({ n, s, d: d || '' });

  /* ---------- the two blocks that bracket every strength day ---------- */
  const WARMUP = [
    E('Easy bike or row', '3–5 min', 'Nothing to prove here. Just move blood.'),
    E('World’s greatest stretch', '4/side', ''),
    E('Hip airplane or bodyweight single-leg RDL', '6/side', 'Controlled. This is balance work, not a hinge set.'),
    E('Band pull-apart', '20', ''),
    E('Scapular pull-up, or hang and shrug', '8', ''),
    E('Empty-bar squat or hinge', '8–10', 'Then one light work-up set on the day’s main lift.'),
  ];
  const POSTURE = [
    E('Doorway pec stretch, elbow at 90°', '45–60s/side × 2', 'Lean until the front of the shoulder opens. Breathe.'),
    E('Thoracic extension over roller or bench', '8 slow breaths', 'Mid-back, not lumbar.'),
    E('Chin tuck', '10 × 5s hold', 'Slide the head straight back as if making a double chin. Do not look up.'),
    E('Face pull, rope or band', '3 × 15–20', 'Pause one second with hands by the ears, shoulders down.'),
    E('Y-T-W on an incline bench or standing', '2 × 8 each shape', 'Light plates or nothing.'),
    E('Couch or kneeling hip-flexor stretch', '45s/side', ''),
  ];
  const POSTURE_SHORT = [POSTURE[0], POSTURE[2], POSTURE[3]];
  const CALF = [
    E('Standing calf raise, straight knee', '3 × 6–8', 'Three seconds down, one-second pause at the bottom. Heavy enough that eight is hard.'),
    E('Seated or bent-knee calf raise', '3 × 10–15', 'Same slow lowering.'),
    E('Tibialis raise, or backward walks on the heels', '2 × 15', 'If the machine exists. If not, walk backwards on your heels.'),
  ];

  /* ---------- the OR circuit: standing endurance ---------- */
  const ORCIRCUIT = (wallsit) => [
    E('Tall standing brace', '3 long breaths', 'Feet under hips, slight glute squeeze, ribs down.'),
    E('Suitcase carry', '20–30 m each hand', ''),
    E('Side plank', '30–40s/side', ''),
    E('Bird dog', '6 slow/side', ''),
    E('Wall sit', wallsit, 'Knees around 90°, low back against the wall.'),
  ];

  /* ---------- per-week prescriptions ---------- */
  const BYWEEK = {
    strength: [
      'Leave two reps in reserve everywhere. Learn the sessions.',
      'Add 2.5 kg to lifts that were clean, or add one rep on the last set.',
      'Squat and press stay at 4 × 5 if bar speed is good. Add one set of face pulls or a second carry on Monday or Wednesday — not both.',
      'Hold, or add a small load. No new exercises.',
    ],
    deadlift: ['4 × 3–5', '4 × 3–5', '5 × 3, or keep 4 × 3–5', '5 × 3, or keep 4 × 3–5'],
    easyTue:  ['40–50 min', '45–55 min', '50–60 min', '50–60 min'],
    wallsit:  ['40–50s', '40–50s', '60s', '60s'],
    intervals: [
      '10 × 45s hard / 90s easy',
      '10 × 50s hard / 90s easy — or 8 × 60s / 90s if week 1 felt easy',
      '6 × 3 min moderately hard / 2 min easy. If that is too much, keep 10 × 45s / 90s.',
      'Repeat the week 3 set you actually recovered from',
    ],
    shadow:   ['3 min on / 1 min off × 5', '3 min on / 1 min off × 6', '3 min on / 1 min off × 6', '3 min on / 1 min off × 6–7'],
    easySat:  ['50–60 min', '55–65 min', '60–70 min', '60 min'],
    walkrun: [
      'Only if shins were quiet all week and walking is pain-free: 1 min very easy jog / 2 min walk × 6. Stop at the first sharp tibial pain — that is the whole test.',
      'Only if the week 1 test was pain-free: 1 min jog / 2 min walk × 8, or 90s / 90s × 6.',
      'If cleared: 2 min jog / 1 min walk × 6–8.',
      'If cleared and the intervals have been pain-free: 8–12 min continuous easy jog. Otherwise stay on intervals.',
    ],
  };
  const wk = (a, w) => a[Math.max(0, Math.min(a.length - 1, (w || 1) - 1))];

  /* ---------- the seven sessions ---------- */
  function SESSIONS(w) {
    w = Math.max(1, Math.min(BLOCK.weeks, +w || 1));
    const warm  = { n: 'Warm-up', m: '10–12 min', c: 'prep',   l: WARMUP };
    const post  = { n: 'Posture block — not optional', m: '12–15 min', c: 'decomp', l: POSTURE };
    const calf  = { n: 'Calf protocol — shin-splint insurance', m: '8 min', c: 'armor', l: CALF };

    return {
      mon: { t: 'Strength A — squat, hinge, pull', m: '75–90 min', b: [warm,
        { n: 'Main work', m: '45–55 min', c: 'main', l: [
          E('Back squat', '4 × 5', 'Rest 2.5–3 min. Depth you can own. Substitute: hack squat or goblet squat, 4 × 6–8.'),
          E('Romanian deadlift', '3 × 6–8', 'Soft knees, bar close. Stop when the hamstrings say so, not when the back rounds.'),
          E('Pull-up', '4 × 5–8', 'Add weight only if 8 strict is easy. Substitute: lat pulldown, 4 × 6–8.'),
          E('Farmer carry', '4 × 30–40 m', 'Heavy dumbbells you can walk tall with. Ribs down, no shrug.'),
          E('Dead bug', '3 × 8/side', 'Low back pinned to the floor. If the lumbar arches, shorten the lever.'),
        ] }, calf, post] },

      tue: { t: 'Engine + standing endurance', m: '70–90 min', b: [
        { n: 'Easy cardio', m: wk(BYWEEK.easyTue, w), c: 'main', l: [
          E('Bike, row, or elliptical — easy', wk(BYWEEK.easyTue, w),
            'You can speak in full sentences. Roughly 60–70% max heart rate if you wear a strap; if not, easy means easy.'),
        ] },
        { n: 'The OR circuit — 3 rounds, 45–60s work / 20s change', m: '15–18 min', c: 'armor', l: ORCIRCUIT(wk(BYWEEK.wallsit, w)) },
        { n: 'Optional', m: '20–30 min', c: 'decomp', l: [
          E('Walk outdoors', '20–30 min', 'Soft ground if you have it. No jogging.'),
        ] }] },

      wed: { t: 'Strength B — pull, press, upper durability', m: '75–90 min', b: [warm,
        { n: 'Main work', m: '45–55 min', c: 'main', l: [
          E('Trap-bar or conventional deadlift', wk(BYWEEK.deadlift, w),
            'Conventional only if your back position is reliable. Otherwise trap-bar, or Romanian plus hip thrust.'),
          E('Overhead press', '4 × 5', 'Standing, glutes on. If the bar drifts forward, the weight is too heavy.'),
          E('Chest-supported row or one-arm DB row', '4 × 6–8', 'Pull to the hip, pause.'),
          E('Rear-foot-elevated split squat', '3 × 6–8/leg', 'Short stance if the front knee yells.'),
          E('Push-up', '3 × 8–12', 'Hands under shoulders, body a board. Elevate the hands if you sag. Not a chest-blaster day.'),
          E('Cable external rotation', '2 × 15/side', ''),
        ] }, calf, post] },

      thu: { t: 'Non-impact work capacity', m: '45–70 min', b: [
        { n: 'Warm up', m: '8 min', c: 'prep', l: [E('Easy bike or row', '8 min', '')] },
        { n: 'Main set — bike or rower', m: '25–35 min', c: 'main', l: [
          E('Intervals', wk(BYWEEK.intervals, w),
            'Hard means strong but repeatable — the last two intervals should look like the first two. If they collapse, you went too hard.'),
          E('Easy spin down', '5 min', ''),
        ] },
        { n: 'Carries', m: '6 min', c: 'armor', l: [
          E('Farmer or suitcase carry', '3 × 30–40 m', 'Only if the grip still works.'),
        ] },
        { n: 'Mobility', m: '10 min', c: 'decomp', l: [
          E('Hips, T-spine, pecs', '10 min', 'Pick what is tight. Unhurried.'),
        ] }] },

      fri: { t: 'Strength C + shadow', m: '75–90 min + shadow', b: [warm,
        { n: 'Main work', m: '40–45 min', c: 'main', l: [
          E('Goblet or front squat', '3 × 6–8', ''),
          E('DB Romanian deadlift or 45° back extension', '3 × 8–10', ''),
          E('Row or pull-up', '3 × 8', ''),
          E('Landmine or single-arm DB press', '3 × 8/side', ''),
          E('Front carry', '3 × 30 m', 'Bear-hug a bag, or hold two dumbbells at the shoulders.'),
        ] },
        { n: 'Calf protocol', m: '5–8 min', c: 'armor', l: [
          E('Calf work', 'Full protocol, or seated only', 'If the calves are wrecked from the week, do the seated version only.'),
        ] },
        { n: 'Shadowboxing — clear space', m: '20–25 min', c: 'armor', l: [
          E('Rounds', wk(BYWEEK.shadow, w), 'Film one round on your phone.'),
          E('The material', 'stance · step-and-stick · jab-cross · slip · level change',
            'A level change to a knee or a shot posture — without shooting on anyone. Technical, not frantic.'),
        ] },
        { n: 'Short posture block', m: '6 min', c: 'decomp', l: POSTURE_SHORT }] },

      sat: { t: 'Long easy engine', m: '60–90 min', b: [
        { n: 'Easy cardio', m: wk(BYWEEK.easySat, w), c: 'main', l: [
          E('Bike, swim, or row — easy', wk(BYWEEK.easySat, w),
            'Same conversational rule. If swimming feels awful, keep it short and technical or ride the bike instead — swimming is optional this month.'),
        ] },
        { n: 'Walk-run — gated', m: '18–25 min', c: 'armor', l: [
          E('Walk-run step', wk(BYWEEK.walkrun, w),
            'Grass or track. Stop at the first sharp tibial pain. Do not finish the workout through shin pain.'),
          E('Score the shins 0–10', 'during, and again tomorrow morning',
            'Advance a step only after two pain-free sessions. Pinpoint pain on the bone: get it imaged.'),
        ] }] },
    };
  }
  const RECOVERY = { t: 'Recovery', m: '50–65 min', b: [
    { n: 'Move', m: '30–45 min', c: 'main', l: [
      E('Walk or easy swim', '30–45 min', 'Nothing that raises the breath.'),
    ] },
    { n: 'Mobility', m: '20 min', c: 'decomp', l: [
      E('Pecs', '2 × 45s', ''), E('Hip flexors', '45s/side', ''),
      E('T-spine', '8 breaths', ''), E('Neck — chin tucks', '10 × 5s', ''),
    ] },
    { n: 'The rest of it', m: '', c: 'prep', l: [
      E('Sunday calories', '2,800–2,950 kcal', 'Same protein. Not a binge day and not a fast.'),
      E('Sleep', 'the session', 'It is the only thing on the card that is not optional.'),
    ] }] };

  const GYM = SESSIONS(1);
  function session(id, w) { return id === 'sun' ? RECOVERY : SESSIONS(w)[id]; }

  /* ---------- diet ---------- */
  const DIET = {
    intro: 'Starting numbers for a 70 kg, 175 cm man doing 8–11 hours of mixed training. ' +
           'They are not lab-precise. The scale decides.',
    targets: [
      ['Calories, Mon–Sat', '3,050–3,200 kcal', 'Slight surplus while training a lot'],
      ['Calories, Sunday', '2,800–2,950 kcal', 'Less work, still not a cut'],
      ['Protein', '150 g (2.1 g/kg)', 'Repair and hypertrophy'],
      ['Carbohydrate', '380–450 g training days', 'Fills the sessions'],
      ['Fat', '70–85 g', 'Hormones, joints, food that is edible'],
      ['Fluid', '3.5–4.5 L', 'More if you sweat heavily'],
      ['Sodium', 'Do not fear salt at this volume', 'Replace sweat; do not chase low-sodium'],
      ['Alcohol', 'Skip this block if you can', 'Recovery and sleep'],
    ],
    scale: {
      head: 'Weigh on waking, after the bathroom, three mornings a week — Monday, Wednesday, Friday. Average them.',
      rules: [
        'Gaining 0.2–0.35 kg per week: hold calories.',
        'No change after 10–14 days: add 150–200 kcal — extra rice, milk, oil, or fruit.',
        'Faster than 0.4 kg per week for two weeks: subtract 150 kcal.',
        'Training feels empty and the scale is flat: add carbs first, not more protein.',
      ],
    },
    anchors: [
      ['Protein', 'Chicken thigh or breast, 5% beef, turkey, eggs, Greek yogurt, cottage cheese, whey, canned tuna or salmon, tofu or tempeh for a plant day.'],
      ['Carbs', 'Rice, potatoes, oats, bread, pasta, fruit, tortillas.'],
      ['Fat', 'Olive oil, egg yolks, nuts, cheese, avocado. Keep nuts to a measured handful or they turn the surplus sloppy.'],
      ['Veg', '400–600 g a day. Frozen mixed veg is fine.'],
      ['Around sessions', 'A banana, yogurt, or a rice cake with whey. You do not need an intra-workout potion for 90 minutes.'],
    ],
    calibrate: 'Use a cheap scale for two weeks so your eyes calibrate. After that the repeating plate below is enough. ' +
               'Protein is the number you do not miss.',
    menu: {
      head: 'Example training day — about 3,100 kcal, 150 g protein',
      note: 'Times assume a late-afternoon block. If you train in the morning, slide the same meals: the larger carb meal before and after the session.',
      rows: [
        ['Breakfast', '80 g dry oats, 250 ml milk, 1 scoop whey, 1 banana, 15 g peanut butter, coffee', '850 kcal / 50 g P'],
        ['Lunch', '200 g cooked rice, 180 g chicken, 1 tsp olive oil, large veg, fruit', '750 kcal / 45 g P'],
        ['Pre-train, 60–90 min before', '2 slices bread or a bagel, 20 g honey or jam, 150 g yogurt', '400 kcal / 15 g P'],
        ['Post-train', '1 scoop whey in water or milk, a piece of fruit', '180–250 kcal / 25 g P'],
        ['Dinner', '200 g potato or 180 g rice, 180 g beef or salmon, veg, 1 tsp oil', '700 kcal / 40 g P'],
        ['If still short', 'Greek yogurt and berries, chocolate milk, or leftover rice', '200–300 kcal'],
      ],
    },
    sunday: 'Sunday, about 2,850 kcal. Same protein. Drop the pre-train snack or shrink the rice at dinner. ' +
            'Keep the fruit and veg. Not a binge day and not a fast.',
    avoid: [
      'Do not cut carbs to stay shredded this month. Endurance plus lifting runs on glycogen.',
      'Do not jump to 4,000 kcal because three hours are available. Most of that time is not max output.',
      'Creatine monohydrate, 5 g a day, is reasonable if you already tolerate it. It is not required.',
      'No new supplement stack for clotting. That is the hematologist’s job.',
    ],
  };

  /* ---------- cardio progression ---------- */
  const RUN = WEEKINFO.map(x => ({
    w: x.w,
    a: wk(BYWEEK.easyTue, x.w) + ' easy',
    b: wk(BYWEEK.intervals, x.w),
    c: wk(BYWEEK.easySat, x.w) + ' easy',
    d: wk(BYWEEK.walkrun, x.w),
  }));

  /* ---------- benchmarks ---------- */
  const BM = [
    ['Bodyweight', 'kg — three-morning average. 70.8–71.5 on 4 Oct, not 74'],
    ['Back squat — top set', 'kg × reps, same or stronger with cleaner positions'],
    ['Deadlift or hinge — top set', 'kg × reps'],
    ['Overhead press — top set', 'kg × reps'],
    ['Wall sit', 'seconds — 60 without the low back screaming'],
    ['Farmer carry', 'kg × metres, carried tall'],
    ['Easy cardio without punishment', 'minutes — 40–60'],
    ['Shins after the last walk-run', 'quiet / mild / sore 24h+ / pain'],
    ['Shoulders and neck at rest', 'further back / same / worse'],
  ];
  const SUCCESS = [
    'Bodyweight about 70.8–71.5 kg, not 74.',
    'Squat, hinge and press a little stronger, or the same with cleaner positions.',
    'Shoulders sitting a bit further back at rest. Neck less poked forward.',
    '40–60 min of easy cardio that does not feel like punishment.',
    'Shins quiet — or running still at walk-run, and that is acceptable.',
    'A 60s wall sit and a long farmer carry without the low back screaming.',
  ];
  const NEXT = 'Then month 2: hematologist first, then BJJ or wrestling with larger people, striking, and professional ' +
               'firearms instruction. Two strength days replace four. Skill becomes the main work.';

  /* ---------- the week ---------- */
  const WEEK = [
    { id: 'mon', d: 'Mon', shift: 'Clear', off: 1, focus: 'Strength A — squat, hinge, pull',
      sub: '75–90 min · no impact on the shins', tags: [['Posture block', ''], ['Weigh-in', '']] },
    { id: 'tue', d: 'Tue', shift: '8:30–13:30', focus: 'Engine + standing endurance',
      sub: '70–90 min · walking only', tags: [['OR circuit', ''], ['Evening walk', 'run']] },
    { id: 'wed', d: 'Wed', shift: '8:00–13:30', focus: 'Strength B — pull, press, durability',
      sub: '75–90 min · no impact', tags: [['Posture block', ''], ['Weigh-in', ''], ['Gathering, 19:00', 'people']] },
    { id: 'thu', d: 'Thu', shift: '8:00–13:30', focus: 'Non-impact work capacity',
      sub: '45–70 min · the first session to cut', tags: [['Intervals', 'run'], ['Early night', '']] },
    { id: 'fri', d: 'Fri', shift: 'Clear', off: 1, focus: 'Strength C + shadowboxing',
      sub: '75–90 min plus shadow · no impact', tags: [['Shadow rounds', ''], ['Weigh-in', ''], ['People / errands', 'people']] },
    { id: 'sat', d: 'Sat', shift: '8:00–12:30', focus: 'Long easy engine',
      sub: '60–90 min · run only if cleared', tags: [['Walk-run gate', 'run'], ['Shin score', '']] },
    { id: 'sun', d: 'Sun', shift: '9:00–15:00', focus: 'Recovery',
      sub: '45–65 min · walk and mobility', tags: [['Sunday calories', ''], ['Church — unresolved', 'faith']] },
  ];

  /* ---------- days ---------- */
  const HOUSE = { mon: 'Vacuum', tue: 'Kitchen, counters', wed: 'Bathroom', thu: 'Laundry',
                  fri: 'Fridge, groceries', sat: 'Trash, floors, dishes', sun: 'Desk, papers, admin' };
  function det(title, when, blocks) { return { t: title, m: when, b: blocks }; }
  function simple(title, when, html) { return { t: title, m: when, html }; }

  /* The daily block survives the rewrite: it is a standing habit rather than
     part of the programme, and it is mobility, which the plan asks for more
     of, not less. */
  const MCGILL = [
    E('Curl-up', '3 sets — 8/6/4, 8s holds', 'One knee bent, hands under the lumbar curve. Do not flatten the low back.'),
    E('Side plank', '3 sets each side — 8/6/4, 8s', 'From the knees first, progress to the feet.'),
    E('Bird dog', '3 sets — 8/6/4, 8s holds', 'Opposite arm and leg, ribs down, no rotation through the hips.'),
  ];
  const DAILYBLK = { t: 'Daily block', m: '25 min', b: [
    { n: 'McGill big three', m: '8 min', c: 'armor', l: MCGILL },
    { n: 'Posture — morning set', m: '7 min', c: 'prep', l: [POSTURE[2], POSTURE[1], POSTURE[0]] },
    { n: 'Mobility — pick what is tight', m: '10 min', c: 'decomp', l: [POSTURE[5], POSTURE[4], CALF[2]] },
  ] };
  const RESET = { t: 'Posture reset', m: '2 min', b: [
    { n: 'Both items, every reset', m: '2 min', c: 'prep', l: [POSTURE[2], POSTURE[1]] },
  ] };

  const ANKI = simple('Anki — 200 cards', '90 min', '<p style="font-size:13.5px">Maintenance only. No new card acquisition this block — that is shelved school-year work.</p><p style="font-size:13px;color:var(--sand-dim)">Two hundred mature cards run 30–45 minutes. The block is 90 so it ends early. The leftover is margin, not capacity to refill.</p>');
  const RESEARCH = simple('Research / networking / email', '', '<p style="font-size:13.5px">One hour. Papers, outreach, registrations, the one call that is stuck.</p><p style="font-size:13px;color:var(--sand-dim)">Third on the priority ladder — first thing cut when the day collapses.</p>');
  const DEEP = simple('Deep work block', '2 hours', '<p style="font-size:13.5px">The real research windows of the week, both on clear days. Writing, reading, anything that needs an uninterrupted run.</p>');
  const FENCE = simple('Unplanned', '', '<p style="font-size:13.5px">Protected, not planned. Nothing from the list is allowed inside it — no reading target, no Anki spillover, no quick email.</p><p style="font-size:13px;color:var(--sand-dim)">You can’t fail an hour with no target. If reading happens, fine. If nothing happens, also fine. That is the point.</p>');
  const PHONE = simple('Phone out of the bedroom', '', '<p style="font-size:13.5px">Standing guardrail. Ninety days before any layer comes off, and then one at a time.</p>');
  const REVIEW = simple('Weekly review — four passes', '90 min', '<ul class="tight" style="font-size:13.5px"><li>Week recap written into Obsidian.</li><li>Pushed to the GitHub repo.</li><li>Finances: earned, spent, card balance, family loan, savings.</li><li>Documents: what moved, what is stuck, one call to make.</li></ul>');
  const LOGLINE = simple('Log the session', '2 min', '<p style="font-size:13.5px">One line is enough: date, lifts and top sets, cardio minutes and machine, shin 0–10, sleep hours, morning weight if it is a weigh day.</p><p style="font-size:13px;color:var(--sand-dim)">If you cannot say whether last week’s squat went up, the log failed.</p>');

  /* `sessionId` is which SESSION the day holds, which is not always the day
     it is named after. The week is laid onto the days the calendar left free
     — see training.js — so a Wednesday can carry Strength A. The day's shape
     (wake, shift, meals, the blocks around it) still comes from `id`, which
     is the weekday you are actually standing in; only the training slot
     moves. Called with two arguments it behaves exactly as it did. */
  function build(id, WK, sessionId) {
    const H = HOUSE[id], S = session(sessionId || id, WK);
    const house = simple('House task', '10 min', '<p style="font-size:15px"><b>' + H + '</b></p><p style="font-size:13px;color:var(--sand-dim)">Small, finished, done. One per day, that is the whole rule.</p>');
    const slot = S ? det(S.t, S.m, S.b) : null;
    const D = {
      mon: [['06:15', '06:45', 'upkeep', 'Wake + weigh-in + house task', 'Weigh on waking, after the bathroom. ' + H, house, ['Weigh-in', 'House task']],
        ['06:45', '07:10', 'train', 'Daily block', 'McGill 3, posture set, mobility.', DAILYBLK, null],
        ['07:10', '07:30', 'rest', 'Breakfast', 'Oats, milk, whey, banana, peanut butter.', null, ['Breakfast']],
        ['07:30', '09:00', 'train', 'Strength A', 'Squat, hinge, pull. Posture block before you leave.', slot, null],
        ['09:00', '09:40', 'upkeep', 'Shower, food', '', null, null],
        ['09:40', '11:10', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['11:10', '11:15', 'train', 'Posture reset 1', 'After the Anki block.', RESET, null],
        ['11:15', '13:10', 'deep', 'Deep work block', 'The real research window of the week.', DEEP, ['Deep work']],
        ['13:10', '14:00', 'rest', 'Lunch', 'Rice, chicken, oil, veg, fruit.', null, null],
        ['14:00', '15:00', 'deep', 'Research / networking', '', RESEARCH, ['Research hour']],
        ['15:00', '17:30', 'people', 'Open — errands, people, physio', 'Book the physio hour here in week 1.', null, ['Got outside / saw someone']],
        ['17:30', '18:00', 'train', 'Easy walk', 'Leftover time is walking, not extra heavy sets.', null, ['Easy walk']],
        ['18:00', '19:00', 'rest', 'Dinner', 'Protein target.', null, ['Protein target']],
        ['19:00', '19:05', 'train', 'Posture reset 2', '', RESET, null],
        ['19:05', '19:10', 'deep', 'Log the session', '', LOGLINE, ['Session logged']],
        ['19:10', '21:00', 'rest', 'Unplanned', '', FENCE, ['Unplanned hour']],
        ['22:00', '22:05', 'train', 'Posture reset 3', 'Before bed.', RESET, null],
        ['22:05', '22:30', 'upkeep', 'Phone out of the bedroom', '', PHONE, ['Phone out']]],

      tue: [['06:15', '06:45', 'upkeep', 'Wake + house task', H, house, ['House task']],
        ['06:45', '07:10', 'train', 'Daily block', '', DAILYBLK, null],
        ['07:10', '07:45', 'rest', 'Breakfast', 'Unhurried. This is what the fixed wake buys you.', null, ['Breakfast']],
        ['07:45', '08:20', 'work', 'Scooter out', '', null, null],
        ['08:30', '13:30', 'work', 'Smoothie bar', 'Audiobook.', null, null],
        ['11:00', '11:05', 'train', 'Posture reset 1', 'Mid-shift, at the bar.', RESET, null],
        ['13:45', '15:15', 'train', 'Engine + standing endurance', 'Easy cardio, then the OR circuit.', slot, null],
        ['15:15', '16:00', 'upkeep', 'Shower, food', '', null, null],
        ['16:00', '17:30', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['17:30', '17:35', 'train', 'Posture reset 2', 'After the Anki block.', RESET, null],
        ['17:35', '18:15', 'deep', 'Research / networking', '', RESEARCH, ['Research hour']],
        ['18:15', '19:00', 'rest', 'Dinner', '', null, ['Protein target']],
        ['19:30', '20:00', 'train', 'Optional walk outdoors', 'Soft ground if you have it. No jogging.', null, ['Easy walk']],
        ['20:00', '20:05', 'deep', 'Log the session', '', LOGLINE, ['Session logged']],
        ['20:05', '22:00', 'rest', 'Unplanned', '', FENCE, ['Unplanned hour']],
        ['22:00', '22:05', 'train', 'Posture reset 3', 'Before bed.', RESET, null],
        ['22:05', '22:30', 'upkeep', 'Phone out of the bedroom', '', PHONE, ['Phone out']]],

      wed: [['06:15', '06:45', 'upkeep', 'Wake + weigh-in + house task', 'Weigh before anything else. ' + H, house, ['Weigh-in', 'House task']],
        ['06:45', '07:10', 'train', 'Daily block', '', DAILYBLK, null],
        ['07:10', '07:35', 'rest', 'Breakfast', '', null, ['Breakfast']],
        ['07:35', '07:55', 'work', 'Scooter out', '', null, null],
        ['08:00', '13:30', 'work', 'Smoothie bar', 'Audiobook.', null, null],
        ['11:00', '11:05', 'train', 'Posture reset 1', 'Mid-shift, at the bar.', RESET, null],
        ['13:45', '15:15', 'train', 'Strength B', 'Deadlift, overhead press, row. Brace before the bar moves.', slot, null],
        ['15:15', '16:00', 'upkeep', 'Shower, food', '', null, null],
        ['16:00', '17:30', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['17:30', '17:35', 'train', 'Posture reset 2', '', RESET, null],
        ['17:35', '17:40', 'deep', 'Log the session', '', LOGLINE, ['Session logged']],
        ['17:40', '18:30', 'deep', 'Gathering prep + email', '', null, ['Gathering prep']],
        ['18:30', '19:00', 'rest', 'Eat before people arrive', '', null, ['Protein target']],
        ['19:00', '23:00', 'people', 'Polish community gathering', 'The load-bearing social block.', null, ['Gathering']],
        ['23:00', '23:05', 'train', 'Posture reset 3', '', RESET, null],
        ['23:05', '23:15', 'upkeep', 'Phone out of the bedroom', 'Short night. Thursday is the lightest session on purpose.', PHONE, ['Phone out']]],

      thu: [['06:15', '06:45', 'upkeep', 'Wake + house task', H, house, ['House task']],
        ['06:45', '07:10', 'train', 'Daily block', '', DAILYBLK, null],
        ['07:10', '07:35', 'rest', 'Breakfast', '', null, ['Breakfast']],
        ['07:35', '07:55', 'work', 'Scooter out', '', null, null],
        ['08:00', '13:30', 'work', 'Smoothie bar', 'Audiobook.', null, null],
        ['11:00', '11:05', 'train', 'Posture reset 1', 'Mid-shift, at the bar.', RESET, null],
        ['13:45', '15:00', 'train', 'Work capacity — intervals', 'The first session to cut if sleep or joints are wrecked.', slot, null],
        ['15:00', '15:45', 'upkeep', 'Shower, food', '', null, null],
        ['15:45', '17:15', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['17:15', '17:20', 'train', 'Posture reset 2', '', RESET, null],
        ['17:20', '18:15', 'deep', 'Research / networking', '', RESEARCH, ['Research hour']],
        ['18:15', '19:00', 'rest', 'Dinner', '', null, ['Protein target']],
        ['19:00', '19:05', 'deep', 'Log the session', '', LOGLINE, ['Session logged']],
        ['19:05', '21:15', 'rest', 'Unplanned', 'Longer tonight.', FENCE, ['Unplanned hour']],
        ['21:15', '21:20', 'train', 'Posture reset 3', '', RESET, null],
        ['21:20', '21:30', 'upkeep', 'Phone out of the bedroom', 'Early. Not optional on a Thursday.', PHONE, ['Phone out']]],

      /* Friday no longer starts at 05:15. That wake existed to get the long
         run in before the heat, and there is no long run this block — so the
         day reverts to the standing 06:15 and the session moves into the
         morning, ahead of the two-hour deep work window it used to displace. */
      fri: [['06:15', '06:40', 'upkeep', 'Wake + weigh-in + house task', 'Third weigh-in. ' + H, house, ['Weigh-in', 'House task']],
        ['06:40', '07:05', 'train', 'Daily block', '', DAILYBLK, null],
        ['07:05', '07:30', 'rest', 'Breakfast', '', null, ['Breakfast']],
        ['07:30', '09:20', 'train', 'Strength C + shadowboxing', 'Lighter full body, then the shadow rounds. Film one.', slot, null],
        ['09:20', '09:55', 'upkeep', 'Shower, food', '', null, null],
        ['09:55', '11:25', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['11:25', '11:30', 'train', 'Posture reset 1', '', RESET, null],
        ['11:30', '13:30', 'deep', 'Deep work block', 'Second real research window.', DEEP, ['Deep work']],
        ['13:30', '14:15', 'rest', 'Lunch', '', null, null],
        ['14:15', '18:00', 'people', 'People / errands', 'The afternoon with people in it on purpose.', null, ['Got outside / saw someone']],
        ['18:00', '19:00', 'rest', 'Dinner', '', null, ['Protein target']],
        ['19:00', '19:05', 'train', 'Posture reset 2', '', RESET, null],
        ['19:05', '19:10', 'deep', 'Log the session', '', LOGLINE, ['Session logged']],
        ['19:10', '21:30', 'rest', 'Unplanned', '', FENCE, ['Unplanned hour']],
        ['22:00', '22:05', 'train', 'Posture reset 3', '', RESET, null],
        ['22:05', '22:30', 'upkeep', 'Phone out of the bedroom', '', PHONE, ['Phone out']]],

      sat: [['06:15', '06:45', 'upkeep', 'Wake + house task', H, house, ['House task']],
        ['06:45', '07:10', 'train', 'Daily block', '', DAILYBLK, null],
        ['07:10', '07:35', 'rest', 'Breakfast', '', null, ['Breakfast']],
        ['07:35', '07:55', 'work', 'Scooter out', '', null, null],
        ['08:00', '12:30', 'work', 'Smoothie bar', 'Audiobook.', null, null],
        ['11:00', '11:05', 'train', 'Posture reset 1', 'Mid-shift, at the bar.', RESET, null],
        ['12:45', '14:15', 'train', 'Long easy engine', 'Conversational. Walk-run only if the shins earned it.', slot, ['Shin score logged']],
        ['14:15', '15:00', 'upkeep', 'Shower, food', '', null, null],
        ['15:00', '16:30', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['16:30', '16:35', 'train', 'Posture reset 2', '', RESET, null],
        ['16:35', '16:40', 'deep', 'Log the session', 'Shin score during, and again tomorrow morning.', LOGLINE, ['Session logged']],
        ['16:40', '17:30', 'deep', 'Research / networking', 'Short. Clear the inbox.', RESEARCH, ['Research hour']],
        ['17:30', '18:15', 'rest', 'Dinner', '', null, ['Protein target']],
        ['18:15', '22:00', 'rest', 'Open evening', 'If an invitation exists, take it.', FENCE, ['Unplanned hour']],
        ['22:00', '22:05', 'train', 'Posture reset 3', '', RESET, null],
        ['22:05', '22:30', 'upkeep', 'Phone out of the bedroom', '', PHONE, ['Phone out']]],

      sun: [['06:15', '06:45', 'upkeep', 'Wake + house task', H, house, ['House task']],
        ['06:45', '07:30', 'train', 'Daily block — long', 'Full mobility: pecs, hip flexors, T-spine, neck.',
          det('Daily block — long', '45 min', DAILYBLK.b.concat([{ n: 'Recovery mobility', m: '20 min', c: 'decomp', l: RECOVERY.b[1].l }])), null],
        ['07:30', '08:15', 'rest', 'Breakfast', 'Sunday calories — same protein, fewer carbs.', null, ['Breakfast']],
        ['08:15', '08:45', 'faith', 'Open — church if the trade lands', 'Currently unresolved. See the Open tab.', null, null],
        ['09:00', '15:00', 'work', 'Smoothie bar', 'The shift sitting on top of church.', null, null],
        ['12:00', '12:05', 'train', 'Posture reset 1', 'Mid-shift, at the bar.', RESET, null],
        ['15:15', '16:00', 'train', 'Recovery walk or easy swim', '30–45 min. Nothing that raises the breath.', RECOVERY, ['Recovery walk']],
        ['16:00', '16:30', 'upkeep', 'Home, food', '', null, ['Protein target']],
        ['16:30', '18:00', 'deep', 'Anki — 200 cards', '', ANKI, ['Anki 200']],
        ['18:00', '18:05', 'train', 'Posture reset 2', '', RESET, null],
        ['18:05', '19:30', 'deep', 'Weekly review — four passes', 'Bodyweight average, what lifts moved, shin status, sleep.', REVIEW, ['Weekly review']],
        ['19:30', '20:15', 'rest', 'Dinner', 'Sunday calories. Not a binge day and not a fast.', null, null],
        ['20:15', '22:00', 'rest', 'Unplanned', 'Week ends here.', FENCE, ['Unplanned hour']],
        ['22:00', '22:05', 'train', 'Posture reset 3', '', RESET, null],
        ['22:05', '22:30', 'upkeep', 'Phone out of the bedroom', '', PHONE, ['Phone out']]],
    };
    return D[id];
  }

  const DAYNAME = {
    mon: 'Monday — clear · strength A',
    tue: 'Tuesday — 8:30 shift · engine',
    wed: 'Wednesday — 8:00 shift · strength B · gathering',
    thu: 'Thursday — 8:00 shift · intervals · early night',
    fri: 'Friday — clear · strength C + shadow',
    sat: 'Saturday — 8:00 shift · long easy',
    sun: 'Sunday — 9:00 shift · recovery · review',
  };

  window.GRIND_DATA = {
    BLOCK: BLOCK,               // dates, title, the one-line framing
    WEEKINFO: WEEKINFO,         // the four weeks, dated, with their notes
    WEEK: WEEK,                 // the seven weekdays: shift, focus, tags
    RULES: RULES,               // the hard rules, by heading
    SKIPORDER: SKIPORDER,
    RUN: RUN,                   // the four-week cardio progression
    BM: BM,                     // the nine measures
    SUCCESS: SUCCESS,           // what 4 October looks like
    NEXT: NEXT,                 // what month 2 is
    DIET: DIET,                 // targets, scale rules, anchors, menus
    DAYNAME: DAYNAME,
    HOUSE: HOUSE,
    GYM: GYM,                   // week-1 sessions — the six that count as done
    RECOVERY: RECOVERY,
    session: session,           // (dayId, week) -> that week's session
    DAILYBLK: DAILYBLK, RESET: RESET,
    build: build,               // (dayId, week, sessionId?) -> the day's slots
    weeks: BLOCK.weeks,
    deloads: [],                // none: four weeks is short enough to run through
    testWeek: 4,
  };
})();
