/* ─────────────────────────────────────────────────────────────────────────
   grind-data.js — the nine-week programme, frozen.

   Every lift, every run, every armor menu and the shape of each weekday.
   This is content: it does not change while you use it, so it lives here in
   code and never enters the synced store. Grind.dc.html holds the record —
   which sessions you have finished, where the benchmarks sit — and nothing
   else.

   Lifted verbatim from the standalone board, with one change: build() and
   runDetail() used to read the page's current mode and week off globals, so
   they take them as arguments now. Nothing else was touched, and the exercise
   text is character for character what it was.

   There is deliberately no start date. The week advances when its work is
   done, not when the calendar moves — so a week away costs you nothing and
   the board is always where you left it.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const RUN=[
   {w:1,a:'2:1 × 6 — 18 min',b:'2:1 × 8 — 24 min',d:'~3–4 km'},
   {w:2,a:'3:1 × 6 — 24 min',b:'3:1 × 7 — 28 min',d:'~4 km'},
   {w:3,a:'4:1 × 5 — 25 min',b:'4:1 × 6 — 30 min',d:'~4.5 km'},
   {w:4,a:'5:1 × 3 — 18 min easy',b:'5:1 × 4 — 24 min easy',d:'deload',dl:1},
   {w:5,a:'25 min continuous, easy',b:'8:1 × 4 — 36 min',d:'~5 km'},
   {w:6,a:'30 min continuous',b:'10:1 × 4 — 44 min',d:'~6 km'},
   {w:7,a:'30 min + 4 × 30s strides',b:'45 min continuous',d:'~7 km'},
   {w:8,a:'22 min easy',b:'32 min easy',d:'deload',dl:1},
   {w:9,a:'30 min + 5 × 30s strides',b:'55–60 min continuous',d:'~8–9 km'}];
  const E=(n,s,d,p,m)=>({n,s,d,p,m});
  const SHIN=[
   E('Seated calf raise — bent knee','4 × 12–15','The soleus builder. Heavy, slow, full range, pause at the bottom. Single highest-value item on the page.',1),
   E('Standing calf raise — straight leg','3 × 10–12','Gastrocnemius. Load it properly, don\'t bounce.',1),
   E('Tibialis raise against wall','3 × 20–25','Heels at the wall base, lean back, lift the toes. Burns fast. Builds the front of the shin, which almost nobody trains.',1),
   E('Banded dorsiflexion, slow eccentric','3 × 15','Three seconds lowering. Eccentric load is what remodels tendon.'),
   E('Toe walk / heel walk','3 × 30s each','Down the hallway and back. Cheap, effective, barefoot.'),
   E('Single-leg balance, eyes closed','3 × 30s','Foot and ankle stabilisers plus proprioception. Harder than it sounds.'),
   E('Short foot / towel scrunch','2 × 20','Arch intrinsics. A collapsed arch changes tibial loading upstream.'),
   E('Calf and soleus soft tissue','3–4 min','End of session only. Tight calves increase the pull on the tibial insertion — a supporting act, not the treatment.',0,1)];
  const WRIST=[
   E('Wrist roller','3 × 2 passes','Up and down is one pass. Slow on the way down. Best single forearm builder there is.',1),
   E('Reverse wrist curl','3 × 15–20','Extensors. These hold the wrist neutral at impact, and they are almost always the weak side.',1),
   E('Radial / ulnar deviation','3 × 15 each','Hammer or DB held at the end of the handle, tilt side to side. Trains the deviation the wrist fails into on a hook.',1),
   E('Pronation / supination','3 × 15 each','Same grip, rotate slowly through full range. Trains rotational deceleration.'),
   E('Kneeling wrist push-up','3 × 8','On a mat, fingers forward then fingers back. Progress the surface before the load.'),
   E('Dead hang','3 × 30–45s','Grip, wrist and shoulder decompression in one. Counts for shoulders too.'),
   E('Farmer carry','3 × 40m','Heavy. Builds the whole forearm-shoulder chain isometrically.'),
   E('Bottoms-up carry','3 × 30s/side','Reflexive stability rather than raw strength. Boxing gold. DB works if you have no kettlebell — hold it vertically.'),
   E('Wrist CARs and prayer stretch','2 min','Full slow circles both directions, then prayer and reverse prayer, 30s each.',0,1)];
  const SHOULDER=[
   E('Thoracic extension over roller','2 × 10','Roller across the mid-back, extend over it segment by segment. Do this first — everything else moves better after.',1),
   E('Band dislocates','2 × 12–15','Widest grip that keeps the elbows locked. Narrow by a couple of centimetres every week or two. This is the progression that fixes the clasp.',1),
   E('Towel behind-back slide','3 × 30s each side','The direct progression toward clasping. Walk the hands one thumb-width closer per session.',1),
   E('Face pull','3 × 15','External rotators and lower traps. Pull to the forehead, elbows high. Band works.'),
   E('Prone Y-T-W','2 × 8 each letter','Light or bodyweight. Scapular control, which is what actually stabilises the shoulder.'),
   E('Wall slides','2 × 10','Back and forearms flat on the wall, slide up without the ribs flaring. Brutal honesty test.'),
   E('Band external rotation','3 × 15','Elbow tucked at the side. Rotator cuff endurance.'),
   E('Scapular pull-up','3 × 8','Hang, pull the shoulders down without bending the elbows.'),
   E('Doorway pec and lat stretch','3 × 30s','Tight pec minor and lats are usually what is actually blocking the behind-the-back clasp.',0,1)];
  const MCGILL=[
   E('Curl-up','3 sets — 8/6/4, 8s holds','One knee bent, hands under the lumbar curve, lift only the head and shoulders a few centimetres. Do not flatten the low back.',1),
   E('Side plank','3 sets each side — 8/6/4, 8s','From the knees first, progress to the feet. Builds the lateral stability the spine relies on under a loaded bar.',1),
   E('Bird dog','3 sets — 8/6/4, 8s holds','Opposite arm and leg, ribs down, no rotation through the hips. Sweep back to the start rather than dropping.',1)];
  const BACK=[
   E('Hip hinge with dowel','3 × 10','Dowel touching head, mid-back and sacrum throughout. If it leaves the back, that is your fault line — this is the drill that fixes the squat and deadlift pain.',1),
   E('Hip thrust','3 × 10–12','Glutes. Weak glutes mean the lumbar erectors take over the hinge, which is where the pain comes from.',1),
   E('Single-leg RDL','3 × 8 each','Light. Trains hinge control and hip stability at the same time.'),
   E('Dead bug','3 × 10 each side','Low back pressed to the floor the entire time. Anti-extension control.'),
   E('Suitcase carry','3 × 30m/side','Loaded, upright, one-sided. Direct carryover to the deadlift brace.'),
   E('90/90 breathing','2 × 6 breaths','Feet on a wall, exhale fully, ribs down. Resets the rib-pelvis position the brace depends on.',0,1),
   E('Couch stretch — hip flexors','2 × 45s each','Tight hip flexors tilt the pelvis forward and load the lumbar spine all day.',0,1),
   E('Hamstring floss / Jefferson curl (unloaded)','2 × 8','Only unloaded, only slowly. Restores segmental flexion without adding load to it.',0,1)];
  const POSTURE=[
   E('Chin tuck','10 reps','Back of the neck long, chin straight back not down. Counteracts the phone.',1),
   E('Standing thoracic extension','30s','Hands behind the head, extend over the upper back.'),
   E('Wall angels','2 × 10','Heels, sacrum, mid-back and hands on the wall. Slow. Anything that lifts off the wall is the target.',1),
   E('Scapular retraction hold','3 × 15s','Squeeze and hold without shrugging or flaring ribs.'),
   E('Hip flexor stretch','45s each side','Anterior pelvic tilt is half of what makes a posture look collapsed.',0,1),
   E('Dead hang','30–45s','Decompresses the spine and opens the shoulders. Doubles with the wrist work.')];
  const CORE=[
   E('Cable crunch','4 × 10–12','Weighted, spine flexing through the reps, hips fixed. The primary rectus hypertrophy movement — progress load every week or two.',1),
   E('Hanging leg raise','3 × 8–12','Legs straight if you can, knees if not. Curl the pelvis at the top or it becomes a hip flexor exercise.',1),
   E('Ab wheel rollout','3 × 6–10','From the knees. Anti-extension under stretch — also protects the lumbar under the bar.',1),
   E('Weighted decline sit-up','3 × 10','Plate or DB on the chest. Add weight before adding reps.'),
   E('Pallof press','3 × 12 each side','Anti-rotation. Carries straight over to boxing next year.'),
   E('Side plank with reach-through','2 × 10 each','Enough direct oblique work. More than this thickens the waist.')];
  const MOBILITY=[].concat(BACK.filter(x=>x.m),SHOULDER.filter(x=>x.m),WRIST.filter(x=>x.m),SHIN.filter(x=>x.m),POSTURE.filter(x=>x.m));
  function exHTML(l){return l.map(e=>'<div class="exi '+(e.p?'pri ':'')+(e.m?'mob':'')+'"><div class="n"><b>'+e.n+'</b><span class="sets">'+e.s+'</span></div><div class="d">'+e.d+'</div></div>').join('')}
  
  /* ---------- gym + home sessions ---------- */
  const R=(n,s,d)=>E(n,s,d);
  const GYM={
   mon:{t:'Lower A — Squat',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:[R('Ankle rocks to wall','2 × 10/side','Knee over toe, heel down.'),R('90/90 hip switches','2 × 10','Slow, no hands if you can.'),R('Glute bridge','2 × 12','Wake the chain before it defends your back.'),R('Bird dog','2 × 8/side','5s hold. The lumbar insurance policy.')]},
    {n:'Main lift',m:'25 min',c:'main',l:[R('Back squat','4 × 5','RPE 7–8. Three-second lowering, no bounce. Rest 3 min.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Bulgarian split squat','3 × 8/leg','Single-leg loading builds what running demands.'),R('Leg press or hack squat','3 × 10','Volume without spinal load.'),R('Seated leg curl','3 × 12','Hamstring at long length. Underdone in most squat programmes.'),R('Standing calf raise','3 × 15','2s pause at top, 3s down. Full stretch at bottom.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:[R('Couch stretch','2 × 45s/side','Hip flexor length is half the back problem.'),R('Kneeling shin stretch','2 × 30s/side',''),R('Supine hamstring, band','45s/side','')]}]},
   tue:{t:'Upper A — Horizontal',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:[R('Band pull-apart','3 × 15',''),R('Scap push-up','2 × 10','Elbows locked. Only the blades move.'),R('Wall slides','2 × 10','Low back flat to the wall.'),R('Thoracic extension over foam','10 breaths','Mid-back, not lumbar.')]},
    {n:'Main lift',m:'25 min',c:'main',l:[R('Bench press','4 × 5','3s lowering. Wrists stacked straight over the elbow — not bent back.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Chest-supported row','4 × 8','Rows outnumber presses here. Deliberate.'),R('Incline DB press','3 × 10',''),R('Single-arm DB row','3 × 10/side',''),R('Face pull','3 × 15','External rotation at the top.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:[R('Doorway pec stretch','2 × 45s/side','High and low arm position.'),R('Forearm flexor stretch','45s/side','Palm up, fingers back.'),R('Lat stretch on rack','45s/side','')]}]},
   wed:{t:'Lower B — Hinge',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:[R('Dowel hip hinge','2 × 10','Three points of contact. Groove it before you load it.'),R('McGill curl-up','3 × 8','Hands under lumbar. No sit-ups, ever.'),R('Glute bridge march','2 × 10/side',''),R('Bird dog','2 × 8/side','')]},
    {n:'Main lift',m:'25 min',c:'main',l:[R('Trap-bar deadlift or RDL','4 × 5','Same posterior chain, far less shear. Brace before the bar moves.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Hip thrust','3 × 10','Glutes before spine.'),R('Single-leg RDL','3 × 8/side','Light. Pattern over load.'),R('Reverse lunge','3 × 10/leg',''),R('Farmer carry','3 × 40m','Ribs down the whole way.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:[R('90/90 hip stretch','2 × 45s/side',''),R('Cat-cow','10 slow',''),R('Standing toe touch hold','3 × 30s','Log the distance monthly.')]}]},
   thu:{t:'Upper B — Vertical + shoulder',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:[R('Shoulder CARs','3/side','Slowest circle you can make. Find the catch points.'),R('Band dislocates','3 × 10','Narrow the grip one thumb-width per week.'),R('Wall slide with lift-off','2 × 8','')]},
    {n:'Main lift',m:'25 min',c:'main',l:[R('Standing overhead press','4 × 6','Strict. Ribs down, glutes tight — no lumbar arch to cheat the lockout.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Weighted pull-up or lat pulldown','4 × 8',''),R('Landmine press','3 × 10/side','Shoulder-friendly angle for cranky days.'),R('Incline DB Y-raise','3 × 12','Light. Lower traps.'),R('Rear delt fly','3 × 15','')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:[R('Sleeper stretch','2 × 30s/side','Gentle. Internal rotation.'),R('Child\'s pose, thoracic reach','60s',''),R('Wall angel hold','2 × 30s','')]}]},
   sat:{t:'Weak points + core',m:'95 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:[R('Full-body flow','8 min','Cat-cow, dislocates, ankle rocks, scap circles, hip openers. Unhurried.')]},
    {n:'Main (light)',m:'15 min',c:'main',l:[R('Front squat or Zercher','3 × 8','Moderate load. Upper-back and bracing more than a leg day.')]},
    {n:'Accessories — arms & delts',m:'25 min',c:'',l:[R('Incline DB curl','3 × 12',''),R('Reverse curl','3 × 15','Doubles as wrist extensor work.'),R('Skull crusher','3 × 12',''),R('Lateral raise','4 × 15','The shoulder width you wanted lives here, not in pressing.')]},
    {n:'Core block — the long one',m:'30 min',c:'armor',l:[R('Cable crunch','4 × 12','Weighted, 3s eccentric. This builds thickness.'),R('Hanging leg raise','4 × 10','Curl the pelvis at the top.'),R('Ab wheel','3 × 8','From knees. Back never arches.'),R('Weighted side bend or suitcase hold','3 × 12/side','Obliques. Low volume.'),R('Farmer carry','3 × 40m','Finisher.')]},
    {n:'Decompress — the weekly stretch',m:'15 min',c:'decomp',l:[R('Toe-touch progression','5 × 30s','Jefferson curl with a light dowel, then standing pike holds. Measure fingertip-to-floor.'),R('Shoulder circuit','5 min','Towel clasp, dislocates, doorway holds. Measure the gap.'),R('Deep squat hold','2 × 60s','Heels down.')]}]}
  };
  const HOME={
   mon:{t:'Lower A — Squat pattern (home)',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:GYM.mon.b[0].l},
    {n:'Main lift',m:'25 min',c:'main',l:[R('DB Bulgarian split squat','4 × 8/leg','3s lowering. 2×30kg through one leg beats the back squat you\'d have programmed. Rear foot on the couch.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Goblet squat','3 × 12','One DB at the chest, 2s pause at the bottom. Heels down.'),R('DB step-up','3 × 10/leg','Controlled on the way down — that is the whole exercise.'),R('DB single-leg RDL','3 × 10/leg','Hamstring at long length. Replaces the leg curl.'),R('Single-leg calf raise, DB in hand','3 × 15','Off a step if you have one. 2s pause top, 3s down.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:GYM.mon.b[3].l}]},
   tue:{t:'Upper A — Horizontal (home)',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:GYM.tue.b[0].l},
    {n:'Main lift',m:'25 min',c:'main',l:[R('DB floor press','4 × 6','3s lowering, pause when the triceps touch the floor. Kinder to the wrist than a barbell.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Single-arm DB row off a chair','4 × 8/side','Ribs down, no twisting. Rows still outnumber presses.'),R('DB incline press (floor, feet planted, torso on cushions)','3 × 10',''),R('DB pullover','3 × 12','Lat and serratus. Slow through the stretch.'),R('Bent-over rear delt fly','3 × 15','Light. Replaces the face pull.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:[R('Doorway pec stretch','2 × 45s/side','High and low arm position.'),R('Forearm flexor stretch','45s/side','Palm up, fingers back.'),R('Lat stretch hanging from the bar','45s/side','')]}]},
   wed:{t:'Lower B — Hinge (home)',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:GYM.wed.b[0].l},
    {n:'Main lift',m:'25 min',c:'main',l:[R('DB Romanian deadlift','4 × 8','4s lowering. DBs tracking the shins, ribs down. Slow eccentric is how you get stimulus from 60kg.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('DB hip thrust off the couch','3 × 12','DB across the hips, pad it with a towel. 2s squeeze at the top.'),R('DB single-leg RDL','3 × 8/side','Light. Hinge control and hip stability together.'),R('DB reverse lunge','3 × 10/leg',''),R('DB suitcase carry','3 × 40m','Upright, one-sided. Direct carryover to the brace.')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:GYM.wed.b[3].l}]},
   thu:{t:'Upper B — Vertical (home)',m:'70 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:GYM.thu.b[0].l},
    {n:'Main lift',m:'25 min',c:'main',l:[R('DB standing overhead press','4 × 6','Strict. Ribs down, glutes tight. Essentially unchanged from the barbell version.')]},
    {n:'Accessories',m:'27 min',c:'',l:[R('Weighted pull-up','4 × 8','DB between the feet or a loaded pack. Your best lift of the week — home does this better than most gyms.'),R('Half-kneeling single-arm DB press','3 × 10/side','Kills the lumbar arch. Replaces the landmine.'),R('DB Y-raise, chest on cushions','3 × 12','Light. Lower traps.'),R('Rear delt fly','3 × 15','')]},
    {n:'Decompress',m:'10 min',c:'decomp',l:GYM.thu.b[3].l}]},
   sat:{t:'Weak points + core (home)',m:'95 min',b:[
    {n:'Prep',m:'8 min',c:'prep',l:GYM.sat.b[0].l},
    {n:'Main (light)',m:'15 min',c:'main',l:[R('Goblet squat','3 × 10','2s pause at the bottom, upright torso. Bracing work more than a leg day.')]},
    {n:'Accessories — arms & delts',m:'25 min',c:'',l:[R('Incline DB curl','3 × 12','Chest on cushions or seated, leaning back.'),R('Reverse curl','3 × 15','Doubles as wrist extensor work.'),R('DB overhead triceps extension','3 × 12',''),R('Lateral raise','4 × 15','')]},
    {n:'Core block — the long one',m:'30 min',c:'armor',l:[R('DB decline or incline sit-up','4 × 12','DB at the chest, 3s eccentric. The cable crunch substitute — progress the DB, not the reps.'),R('Hanging leg raise','4 × 10','On the pull-up bar. Curl the pelvis at the top.'),R('Ab wheel or DB rollout','3 × 8','From knees. Back never arches.'),R('DB suitcase hold','3 × 45s/side','Obliques, low volume.'),R('DB farmer carry','3 × 40m','Finisher.')]},
    {n:'Decompress — the weekly stretch',m:'15 min',c:'decomp',l:GYM.sat.b[4].l}]}
  };
  const ARMOR={
   mon:{t:'Armor — shins',m:'30 min',l:[SHIN[0],SHIN[1],SHIN[2],SHIN[3],SHIN[5],CORE[4]]},
   tue:{t:'Armor — wrists & forearms',m:'30 min',l:[WRIST[0],WRIST[1],WRIST[2],WRIST[3],WRIST[4],WRIST[8]]},
   wed:{t:'Armor — lumbar 15 + soleus 15',m:'30 min',l:[BACK[0],BACK[1],BACK[3],BACK[4],SHIN[0],SHIN[4]]},
   thu:{t:'Armor — shoulders + wrist carryover',m:'30 min',l:[SHOULDER[0],SHOULDER[1],SHOULDER[2],SHOULDER[6],SHOULDER[7],WRIST[7]]},
   fri:{t:'Decompress — long run day',m:'20 min',l:[BACK[6],BACK[5],SHIN[7],SHOULDER[8]]},
   sat:{t:'Armor — shins 15 + core 15',m:'30 min',l:[SHIN[0],SHIN[2],SHIN[6],CORE[0],CORE[1],CORE[2]]},
   sun:{t:'Shoulder towel progression + full mobility',m:'in the long daily block',l:[SHOULDER[2],SHOULDER[1],SHOULDER[8],WRIST[8]]}
  };
  const DAILYBLK={t:'Daily block',m:'25 min',b:[
   {n:'McGill big three',m:'8 min',c:'armor',l:MCGILL},
   {n:'Posture — morning set',m:'7 min',c:'prep',l:[POSTURE[2],POSTURE[3],POSTURE[5]]},
   {n:'Mobility — rotate, pick what is tight',m:'10 min',c:'decomp',l:MOBILITY}]};
  const RESET={t:'Posture reset',m:'2 min',b:[{n:'Both items, every reset',m:'2 min',c:'prep',l:[POSTURE[0],POSTURE[1]]}]};
  
  /* ---------- week ---------- */
  const WEEK=[
   {id:'mon',d:'Mon',shift:'Clear',off:1,focus:'Lower A — Squat',sub:'Deep work. Errands. Physio.',tags:[['Shin armor','']]},
   {id:'tue',d:'Tue',shift:'8:30–13:30',focus:'Upper A — Horizontal',sub:'Press · rows · rear delt',tags:[['Wrist armor',''],['Short run, evening','run']]},
   {id:'wed',d:'Wed',shift:'8:00–13:30',focus:'Lower B — Hinge',sub:'RDL · hip thrust · carries',tags:[['Lumbar + soleus',''],['Gathering, 19:00','people']]},
   {id:'thu',d:'Thu',shift:'8:00–13:30',focus:'Upper B — Vertical',sub:'Overhead press · weighted pull-up',tags:[['Shoulder + wrist',''],['Early night','']]},
   {id:'fri',d:'Fri',shift:'Clear',off:1,focus:'Long run + mobility',sub:'No lifting. Decompress only.',tags:[['Long run, 05:30','run'],['People / errands','people']]},
   {id:'sat',d:'Sat',shift:'8:00–12:30',focus:'Weak points + core',sub:'Squat pattern · arms · long core block',tags:[['Shins + core',''],['Weekly stretch','']]},
   {id:'sun',d:'Sun',shift:'9:00–15:00',focus:'Rest',sub:'Full mobility. Weekly review.',tags:[['Shoulder towel',''],['Church — unresolved','faith']]}
  ];
  
  /* ---------- days ---------- */
  const HOUSE={mon:'Vacuum',tue:'Kitchen, counters',wed:'Bathroom',thu:'Laundry',fri:'Fridge, groceries',sat:'Trash, floors, dishes',sun:'Desk, papers, admin'};
  function det(title,when,blocks){return{t:title,m:when,b:blocks}}
  function simple(title,when,html){return{t:title,m:when,html}}
  const ANKI=simple('Anki — 200 cards','90 min','<p style="font-size:13.5px">Maintenance only. No new card acquisition this block — that is shelved school-year work.</p><p style="font-size:13px;color:var(--sand-dim)">Two hundred mature cards run 30–45 minutes. The block is 90 so it ends early. The leftover is margin, not capacity to refill.</p>');
  const RESEARCH=simple('Research / networking / email','','<p style="font-size:13.5px">One hour. Papers, outreach, registrations, the one call that is stuck.</p><p style="font-size:13px;color:var(--sand-dim)">Third on the priority ladder — first thing cut when the day collapses.</p>');
  const DEEP=simple('Deep work block','2 hours','<p style="font-size:13.5px">The real research windows of the week, both on clear days. Writing, reading, anything that needs an uninterrupted run.</p>');
  const FENCE=simple('Unplanned','','<p style="font-size:13.5px">Protected, not planned. Nothing from the list is allowed inside it — no reading target, no Anki spillover, no quick email.</p><p style="font-size:13px;color:var(--sand-dim)">You can\'t fail an hour with no target. If reading happens, fine. If nothing happens, also fine. That is the point.</p>');
  const PHONE=simple('Phone out of the bedroom','','<p style="font-size:13.5px">Standing guardrail. Ninety days before any layer comes off, and then one at a time.</p>');
  const REVIEW=simple('Weekly review — four passes','90 min','<ul class="tight" style="font-size:13.5px"><li>Week recap written into Obsidian.</li><li>Pushed to the GitHub repo.</li><li>Finances: earned, spent, card balance, family loan, savings.</li><li>Documents: what moved, what is stuck, one call to make.</li></ul>');
  
  function runDetail(which, WK){
    const r=RUN[WK-1];
    return simple(which==='long'?'Long run':'Short run', which==='long'?'Friday 05:30':'Tuesday evening',
     '<p style="font-size:15px;margin-bottom:10px"><b>Week '+r.w+' — '+(which==='long'?r.b:r.a)+'</b>'+(r.dl?' <span style="color:var(--ochre)">· deload</span>':'')+'</p>'+
     '<p style="font-size:13px;color:var(--sand-dim)">Ratios are jog:walk in minutes. Flat surface, ~175 cadence, conversational pace.</p>'+
     '<p style="font-size:13.5px;margin-top:12px"><b>Score the shins 0–10 during the run, and again tomorrow morning.</b> Log both in day notes. 0–3 gone by morning, advance. 4–5 or lingering at 24h, repeat this week. 6+, stop running for a week. Pinpoint pain on the bone, get it imaged.</p>');
  }
  function build(id, MODE, WK){
    const H=HOUSE[id], S=(MODE==='home'?HOME:GYM)[id], A=ARMOR[id];
    const house=simple('House task','10 min','<p style="font-size:15px"><b>'+H+'</b></p><p style="font-size:13px;color:var(--sand-dim)">Small, finished, done. One per day, that is the whole rule.</p>');
    const gymSlot=S?det(S.t,S.m,S.b):null;
    const D={
     mon:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:10','train','Daily block','McGill 3, posture set, mobility.',DAILYBLK,null],
      ['07:10','07:30','rest','Breakfast','',null,['Breakfast']],
      ['07:30','09:00','train',(MODE==='home'?'Home session':'Gym')+' — Lower A','Squat pattern.',gymSlot,null],
      ['09:00','09:40','upkeep','Shower, food','',null,null],
      ['09:40','11:10','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['11:10','11:15','train','Posture reset 1','After the Anki block.',RESET,null],
      ['11:15','13:10','deep','Deep work block','The real research window of the week.',DEEP,['Deep work']],
      ['13:10','14:00','rest','Lunch','',null,null],
      ['14:00','15:00','deep','Research / networking','',RESEARCH,['Research hour']],
      ['15:00','17:30','people','Open — errands, people, physio','Book the physio hour here in week 1.',null,['Got outside / saw someone']],
      ['17:30','18:00','train','Armor — shins','',det(A.t,A.m,[{n:'Full block',m:A.m,c:'armor',l:A.l}]),null],
      ['18:00','19:00','rest','Dinner','Protein target.',null,['Protein target']],
      ['19:00','19:05','train','Posture reset 2','',RESET,null],
      ['19:05','21:00','rest','Unplanned','',FENCE,['Unplanned hour']],
      ['22:00','22:05','train','Posture reset 3','Before bed.',RESET,null],
      ['22:05','22:30','upkeep','Phone out of the bedroom','',PHONE,['Phone out']]],
     tue:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:10','train','Daily block','',DAILYBLK,null],
      ['07:10','07:45','rest','Breakfast','Unhurried. This is what the fixed wake buys you.',null,['Breakfast']],
      ['07:45','08:20','work','Scooter out','',null,null],
      ['08:30','13:30','work','Smoothie bar','Audiobook.',null,null],
      ['11:00','11:05','train','Posture reset 1','Mid-shift, at the bar.',RESET,null],
      ['13:45','15:00','train',(MODE==='home'?'Home session':'Gym')+' — Upper A','Horizontal push and pull.',gymSlot,null],
      ['15:00','15:45','upkeep','Shower, food','',null,null],
      ['15:45','17:15','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['17:15','17:20','train','Posture reset 2','After the Anki block.',RESET,null],
      ['17:20','18:00','deep','Research / networking','',RESEARCH,['Research hour']],
      ['18:00','18:45','rest','Dinner','Light. There is a run in ninety minutes.',null,['Protein target']],
      ['19:30','20:15','train','Short run','Heat off. Conversational pace.',runDetail('short', WK),['Short run','Shin score logged']],
      ['20:15','20:45','train','Armor — wrists','',det(A.t,A.m,[{n:'Full block',m:A.m,c:'armor',l:A.l}]),null],
      ['20:45','22:00','rest','Unplanned','',FENCE,['Unplanned hour']],
      ['22:00','22:05','train','Posture reset 3','Before bed.',RESET,null],
      ['22:05','22:30','upkeep','Phone out of the bedroom','',PHONE,['Phone out']]],
     wed:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:10','train','Daily block','',DAILYBLK,null],
      ['07:10','07:35','rest','Breakfast','',null,['Breakfast']],
      ['07:35','07:55','work','Scooter out','',null,null],
      ['08:00','13:30','work','Smoothie bar','Audiobook.',null,null],
      ['11:00','11:05','train','Posture reset 1','Mid-shift, at the bar.',RESET,null],
      ['13:45','15:00','train',(MODE==='home'?'Home session':'Gym')+' — Lower B','Hinge. Brace before the bar moves.',gymSlot,null],
      ['15:00','15:45','upkeep','Shower, food','',null,null],
      ['15:45','17:15','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['17:15','17:20','train','Posture reset 2','',RESET,null],
      ['17:20','17:50','train','Armor — lumbar + soleus','36h clear of Friday.',det(A.t,A.m,[{n:'Full block',m:A.m,c:'armor',l:A.l}]),null],
      ['17:50','18:30','deep','Gathering prep + email','',null,['Gathering prep']],
      ['18:30','19:00','rest','Eat before people arrive','',null,['Protein target']],
      ['19:00','23:00','people','Polish community gathering','The load-bearing social block.',null,['Gathering']],
      ['23:00','23:05','train','Posture reset 3','',RESET,null],
      ['23:05','23:15','upkeep','Phone out of the bedroom','Short night. Thursday is the lightest lift on purpose.',PHONE,['Phone out']]],
     thu:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:10','train','Daily block','',DAILYBLK,null],
      ['07:10','07:35','rest','Breakfast','',null,['Breakfast']],
      ['07:35','07:55','work','Scooter out','',null,null],
      ['08:00','13:30','work','Smoothie bar','Audiobook.',null,null],
      ['11:00','11:05','train','Posture reset 1','Mid-shift, at the bar.',RESET,null],
      ['13:45','15:00','train',(MODE==='home'?'Home session':'Gym')+' — Upper B','Vertical. Ribs down, glutes tight.',gymSlot,null],
      ['15:00','15:45','upkeep','Shower, food','',null,null],
      ['15:45','17:15','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['17:15','17:20','train','Posture reset 2','',RESET,null],
      ['17:20','18:15','deep','Research / networking','',RESEARCH,['Research hour']],
      ['18:15','19:00','rest','Dinner','',null,['Protein target']],
      ['19:00','19:30','train','Armor — shoulders','Towel gap measured weekly.',det(A.t,A.m,[{n:'Full block',m:A.m,c:'armor',l:A.l}]),null],
      ['19:30','21:15','rest','Unplanned','Longer tonight. Tomorrow starts at 05:15.',FENCE,['Unplanned hour']],
      ['21:15','21:20','train','Posture reset 3','',RESET,null],
      ['21:20','21:30','upkeep','Phone out of the bedroom','Early. Not optional on a Thursday.',PHONE,['Phone out']]],
     fri:[['05:15','05:30','train','Up and out','Kit laid out the night before.',null,null],
      ['05:30','06:45','train','Long run','Before the heat.',runDetail('long', WK),['Long run','Shin score logged']],
      ['06:45','07:45','upkeep','Shower, breakfast, house task',H,house,['House task','Breakfast']],
      ['07:45','08:15','train','Daily block + decompress','No lifting today. Calf soft tissue last.',det('Daily block + decompress','30 min',DAILYBLK.b.concat([{n:'Post-run decompress',m:'15 min',c:'decomp',l:ARMOR.fri.l}])),null],
      ['08:15','09:45','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['09:45','09:50','train','Posture reset 1','',RESET,null],
      ['09:50','11:45','deep','Deep work block','Second real research window.',DEEP,['Deep work']],
      ['11:45','12:45','rest','Lunch','',null,null],
      ['13:00','18:00','people','People / errands','The afternoon with people in it on purpose.',null,['Got outside / saw someone']],
      ['18:00','19:00','rest','Dinner','',null,['Protein target']],
      ['19:00','19:05','train','Posture reset 2','',RESET,null],
      ['19:05','21:30','rest','Unplanned','',FENCE,['Unplanned hour']],
      ['22:00','22:05','train','Posture reset 3','',RESET,null],
      ['22:05','22:30','upkeep','Phone out of the bedroom','',PHONE,['Phone out']]],
     sat:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:10','train','Daily block','',DAILYBLK,null],
      ['07:10','07:35','rest','Breakfast','',null,['Breakfast']],
      ['07:35','07:55','work','Scooter out','',null,null],
      ['08:00','12:30','work','Smoothie bar','Audiobook.',null,null],
      ['11:00','11:05','train','Posture reset 1','Mid-shift, at the bar.',RESET,null],
      ['12:45','14:30','train',(MODE==='home'?'Home session':'Gym')+' — Weak points + core','The long one. Core block and the weekly stretch.',gymSlot,null],
      ['14:30','15:15','upkeep','Shower, food','',null,null],
      ['15:15','16:45','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['16:45','16:50','train','Posture reset 2','',RESET,null],
      ['16:50','17:20','train','Armor — shins + core','',det(A.t,A.m,[{n:'Full block',m:A.m,c:'armor',l:A.l}]),null],
      ['17:20','18:00','deep','Research / networking','Short. Clear the inbox.',RESEARCH,['Research hour']],
      ['18:00','18:45','rest','Dinner','',null,['Protein target']],
      ['18:45','22:00','rest','Open evening','If an invitation exists, take it.',FENCE,['Unplanned hour']],
      ['22:00','22:05','train','Posture reset 3','',RESET,null],
      ['22:05','22:30','upkeep','Phone out of the bedroom','',PHONE,['Phone out']]],
     sun:[['06:15','06:45','upkeep','Wake + house task',H,house,['House task']],
      ['06:45','07:30','train','Daily block — long','Full mobility. Towel progression measured. Re-test if due.',det('Daily block — long','45 min',DAILYBLK.b.concat([{n:'Shoulder + mobility extension',m:'20 min',c:'decomp',l:ARMOR.sun.l}])),null],
      ['07:30','08:15','rest','Breakfast','',null,['Breakfast']],
      ['08:15','08:45','faith','Open — church if the trade lands','Currently unresolved. See the Open tab.',null,null],
      ['09:00','15:00','work','Smoothie bar','The shift sitting on top of church.',null,null],
      ['12:00','12:05','train','Posture reset 1','Mid-shift, at the bar.',RESET,null],
      ['15:15','16:00','upkeep','Home, food','',null,['Protein target']],
      ['16:00','17:30','deep','Anki — 200 cards','',ANKI,['Anki 200']],
      ['17:30','17:35','train','Posture reset 2','',RESET,null],
      ['17:35','19:00','deep','Weekly review — four passes','',REVIEW,['Weekly review']],
      ['19:00','20:00','rest','Dinner','',null,null],
      ['20:00','22:00','rest','Unplanned','Week ends here.',FENCE,['Unplanned hour']],
      ['22:00','22:05','train','Posture reset 3','',RESET,null],
      ['22:05','22:30','upkeep','Phone out of the bedroom','',PHONE,['Phone out']]]
    };
    return D[id];
  }
  const DAYNAME={mon:'Monday — clear',tue:'Tuesday — 8:30 shift',wed:'Wednesday — 8:00 shift · gathering',thu:'Thursday — 8:00 shift · early night',fri:'Friday — clear · long run',sat:'Saturday — 8:00 shift',sun:'Sunday — 9:00 shift · review'};
  
  
  const BM=[['Toe touch','cm to floor, knees locked'],['Behind-back clasp — right over','cm gap'],['Behind-back clasp — left over','cm gap'],['Dead hang','seconds to failure'],['Single-leg balance, eyes closed','seconds, weaker side'],['Single-leg calf raise','clean reps, weaker side'],['Shin status after last long run','none / mild / sore 24h+ / pain'],['Bodyweight','kg']];

  window.GRIND_DATA = {
    WEEK: WEEK,                 // the seven weekdays: shift, focus, tags
    RUN: RUN,                   // the nine-week run progression
    BM: BM,                     // the eight benchmarks
    DAYNAME: DAYNAME,
    HOUSE: HOUSE,
    ARMOR: ARMOR,
    GYM: GYM, HOME: HOME,
    DAILYBLK: DAILYBLK, RESET: RESET,
    build: build,               // (dayId, mode, week) -> the day's slots
    weeks: 9,
    deloads: [4, 8],
    testWeek: 9,
  };
})();
