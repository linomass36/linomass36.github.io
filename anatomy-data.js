/* ─────────────────────────────────────────────────────────────────────────
   anatomy-data.js — the syllabus, frozen.

   Regions and blocks, and the relationships each block has to be able to
   derive rather than recite. This is content, not record: it never changes
   while you use the system, so it lives here in code and never enters the
   synced store. Anatomy.dc.html holds the records — what you studied, when
   it retests, how each day ran — and nothing else.

   Lifted verbatim from the standalone closure log so the block ids match:
   a record written by that file still finds its block here.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const THORAX_GATE = "2026-09-08";
  const REPAIR_TOTAL = 332;

  const TIERS={
   full:{label:"Full",desc:"Phase 0 plus two blocks — one construction, one closure-track. About three and a half hours plus reviews."},
   half:{label:"Half",desc:"Phase 0 plus one block at reduced depth: skip orient, 20 min read, 20 min generate, no card work."},
   core:{label:"Core",desc:"Phase 0 plus mature reviews. About 35 minutes. This is the floor and it counts as a day run."},
   rest:{label:"Rest",desc:"Declared, deliberate, protected. Costs nothing. Undeclared absence is what triggers re-entry."}
  };

  const DATA=[
  {id:"neck",name:"Neck",note:"Seven blocks. The first is a thoracic block: without the inlet and the arch, the recurrent laryngeal asymmetry is a fact you memorise instead of a consequence you derive.",blocks:[
  {id:"nk1",name:"Root of the neck & thoracic inlet",rel:"Inlet boundaries · arch of aorta and its three branches · subclavian artery in three parts with branches · apex of lung and suprapleural membrane · thoracic duct arching behind the left IJV · both recurrent laryngeals with their loops and why they differ · phrenic on scalenus anterior · stellate ganglion."},
  {id:"nk2",name:"Fascial layers & the prevertebral plane",rel:"Investing, pretracheal, prevertebral, carotid sheath · what lies deep versus superficial to prevertebral fascia · retropharyngeal and danger spaces · routes of infection spread."},
  {id:"nk3",name:"Triangles of the neck",rel:"Anterior and posterior subdivisions with boundaries and contents · sternocleidomastoid · accessory nerve course and its surgical vulnerability · cervical plexus cutaneous branches at Erb's point."},
  {id:"nk4",name:"Carotid sheath & carotid triangle",rel:"Common, internal and external carotid · ECA branches in order of origin · IJV · vagus between them · ansa cervicalis · hypoglossal crossing · carotid body and sinus with their innervation."},
  {id:"nk5",name:"Thyroid, parathyroid & their nerves",rel:"Lobes and isthmus, capsules · superior and inferior thyroid arteries · external laryngeal nerve with the superior artery, recurrent laryngeal with the inferior · ligament of Berry · venous drainage · parathyroid blood supply."},
  {id:"nk6",name:"Larynx",rel:"Cartilages and membranes · intrinsic muscles with actions — posterior cricoarytenoid is the only abductor, cricothyroid is a tensor · recurrent versus superior laryngeal supply, internal and external · cavity levels and lymphatic watershed."},
  {id:"nk7",name:"Pharynx, cervical oesophagus & C6 axial section",rel:"Three constrictors and the four gaps with what passes through each · Killian's dehiscence · tonsillar bed · pharyngeal plexus · oesophageal constrictions and their levels · then draw C6 in axial section."}]},
  {id:"head",name:"Head",note:"Ten blocks. Skull base foramina first, because everything else indexes against it.",blocks:[
  {id:"hd1",name:"Skull base foramina matrix",rel:"Anterior, middle and posterior fossae · every foramen with everything passing through it, in one table · which nerve accompanies which vessel."},
  {id:"hd2",name:"Scalp & face",rel:"Scalp layers and why the aponeurotic plane bleeds and spreads · supply from both ICA and ECA · danger area and the ophthalmic venous route · motor (VII) versus sensory (V) territories · facial branches, marginal mandibular against cervical."},
  {id:"hd3",name:"Parotid & infratemporal fossa",rel:"Parotid contents in layers — VII, retromandibular vein, ECA · muscles of mastication with actions · V3 anterior and posterior trunks · maxillary artery in three parts · pterygoid venous plexus · otic ganglion · chorda tympani joining lingual."},
  {id:"hd4",name:"Orbit",rel:"Bony walls and their thin points · optic canal versus superior orbital fissure, inside versus outside the common tendinous ring · extraocular muscles with actions and innervation · ciliary ganglion and its three roots · ophthalmic artery branches."},
  {id:"hd5",name:"Nasal cavity & paranasal sinuses",rel:"Lateral wall and the three meatus with what drains into each · Kiesselbach's plexus and its five contributors · sphenopalatine artery · pterygopalatine fossa and its communications · sinus drainage and clinical consequence."},
  {id:"hd6",name:"Oral cavity, tongue & palate",rel:"Intrinsic and extrinsic tongue muscles · XII for all but palatoglossus · taste and general sensation split across VII, IX and X · floor of mouth · submandibular and sublingual glands with the lingual nerve looping the duct · tensor veli palatini as the V3 exception."},
  {id:"hd7",name:"Ear",rel:"External, middle and inner · ossicular chain · walls of the tympanic cavity and what lies beyond each · facial canal course and geniculate ganglion · Eustachian tube · sensory supply of the auricle across four nerves."},
  {id:"hd8",name:"Cranial nerves I–XII",rel:"Nucleus, exit from brainstem, exit from skull, course, territory · motor, sensory and autonomic components separated · one lesion consequence for each."},
  {id:"hd9",name:"Cranial parasympathetics matrix",rel:"All four in one table: nucleus → preganglionic nerve → ganglion → postganglionic route → target. III/ciliary, VII/pterygopalatine, VII/submandibular, IX/otic."},
  {id:"hd10",name:"Dural venous sinuses & cerebral arterial supply",rel:"Sinuses and their connections · cavernous sinus contents and walls, and what a lesion there produces · circle of Willis · ACA, MCA, PCA territories · bridging veins and the subdural mechanism."}]},
  {id:"cns",name:"CNS",note:"Twelve blocks. Brainstem levels are axial sections, not paragraphs — that is why this tag runs 2.37 lapses per card. Draw each level; repair the cards afterwards, never before. Fitzgerald for mechanism, a section atlas for the levels.",blocks:[
  {id:"cn1",name:"Spinal cord cross-sectional organisation",rel:"Grey matter laminae and horns · funiculi · cervical, thoracic and lumbar levels compared by shape · anterior and posterior spinal arteries with segmental supply · meninges, epidural space, lumbar cistern."},
  {id:"cn2",name:"Ascending tracts",rel:"Dorsal column–medial lemniscus · anterolateral/spinothalamic · spinocerebellar · where each decussates and what a hemisection produces at each level."},
  {id:"cn3",name:"Descending tracts",rel:"Corticospinal with its decussation · corticobulbar and the facial nucleus exception · vestibulospinal, reticulospinal, rubrospinal · upper versus lower motor neuron signs."},
  {id:"cn4",name:"Lower medulla — axial section",rel:"Pyramidal decussation · gracile and cuneate nuclei appearing · spinal nucleus of V · central canal."},
  {id:"cn5",name:"Mid medulla — axial section",rel:"Sensory decussation · internal arcuate fibres · medial lemniscus forming · inferior olivary nucleus · hypoglossal and vagal nuclei · medial versus lateral medullary syndromes from the same picture."},
  {id:"cn6",name:"Pontomedullary junction — axial section",rel:"Cochlear and vestibular nuclei · trapezoid body · abducens and facial nerves emerging · all four lemnisci present together."},
  {id:"cn7",name:"Mid-pons — axial section",rel:"Abducens nucleus with the genu of VII looping around it · PPRF and horizontal gaze · pontine nuclei · middle cerebellar peduncle."},
  {id:"cn8",name:"Upper pons — axial section",rel:"Principal sensory and motor nuclei of V · mesencephalic nucleus · superior cerebellar peduncle · locus coeruleus · lemnisci continuing."},
  {id:"cn9",name:"Midbrain — both colliculus levels",rel:"Cerebral peduncle · substantia nigra · red nucleus at the superior level · III and IV with their differing exits · periaqueductal grey · MLF · Weber and Benedikt from the same section."},
  {id:"cn10",name:"Cerebellum",rel:"Three peduncles and what runs in each · vermis, paravermis, hemisphere zones · deep nuclei · ipsilateral signs and why."},
  {id:"cn11",name:"Basal ganglia & internal capsule",rel:"Direct and indirect pathways with their transmitters · capsule limbs and what occupies each · lenticulostriate supply · Parkinson, Huntington, hemiballism mapped onto the circuit."},
  {id:"cn12",name:"Ventricles, CSF & cortical localisation",rel:"Ventricular system and CSF route · cortical areas and homunculus · arterial territories mapped onto the cortex · which deficit localises where."}]},
  {id:"thorax",name:"Thorax",note:"Ten blocks. 4.9% of your deck against a career spent inside the chest. Construction begins 8 September whatever state the first three regions are in.",blocks:[
  {id:"tx1",name:"Thoracic wall & intercostal space",rel:"Layers from skin inward · VAN order in the costal groove · the collateral branch and what it means for needle placement · anterior versus posterior intercostal supply · typical rib and its articulations."},
  {id:"tx2",name:"Diaphragm",rel:"Attachments and crura · three openings with vertebral levels and full contents · phrenic supply and referred pain · the four embryological contributions and where hernias occur."},
  {id:"tx3",name:"Pleura & lung surface anatomy",rel:"Reflections and recesses · the 6–8–10 / 8–10–12 schema · fissure surface markings · where to place a chest drain and why."},
  {id:"tx4",name:"Bronchopulmonary segments & hilar relations",rel:"Segment names and numbers on both sides · hilar arrangement left versus right · bronchial tree branching · why aspiration goes right."},
  {id:"tx5",name:"Pericardium & heart chambers",rel:"Fibrous and serous layers · transverse and oblique sinuses and their surgical use · internal features of each chamber · valve positions versus auscultation points."},
  {id:"tx6",name:"Coronary vessels & conducting system",rel:"Origins from the sinuses · courses of LAD, circumflex, RCA · dominance · cardiac veins and the coronary sinus · SA and AV nodes with their supply · what an occlusion at each point infarcts."},
  {id:"tx7",name:"Superior mediastinum & great vessels · T4 axial",rel:"Thymus · brachiocephalic veins and SVC · arch and its branches · trachea and oesophagus · vagus, phrenic and recurrent laryngeal courses · then draw T4 in axial section."},
  {id:"tx8",name:"Mediastinum from the right",rel:"Every structure visible on the right mediastinal pleura, superior to inferior, in order, with every crossing named. Drawn, not read."},
  {id:"tx9",name:"Mediastinum from the left",rel:"The same from the left. The asymmetries are the point."},
  {id:"tx10",name:"Posterior mediastinum · T8 axial",rel:"Descending aorta · oesophagus and its relations along its course · thoracic duct and its crossing level · azygos and hemiazygos · sympathetic chain and splanchnic nerves · then draw T8 in axial section."}]},
  {id:"back",name:"Back",note:"Five blocks. Your deck contains zero cards on this region — a genuine hole, and it supplies the vertebral-level schema every other region indexes against.",blocks:[
  {id:"bk1",name:"Vertebral levels C6–S2",rel:"One table: level, structure, clinical use."},
  {id:"bk2",name:"Vertebrae, joints, discs & ligaments",rel:"Typical and atypical vertebrae · zygapophysial joint orientation by level · disc structure and herniation direction · the five ligaments and what each resists."},
  {id:"bk3",name:"Back musculature in layers",rel:"Superficial, intermediate and deep groups · erector spinae and transversospinalis · thoracolumbar fascia layers · innervation by ramus."},
  {id:"bk4",name:"Suboccipital triangle & craniovertebral junction",rel:"Boundaries and contents · vertebral artery course and its vulnerable segment · atlanto-occipital and atlantoaxial movement · greater occipital nerve."},
  {id:"bk5",name:"Spinal meninges, blood supply & lumbar cistern",rel:"Epidural contents · where the cord ends and where the sac ends · lumbar puncture layers in order · anterior and posterior spinal arteries · segmental reinforcement and Adamkiewicz."}]},
  {id:"abpel",name:"Abdomen & Pelvis",note:"Fourteen blocks. Your documented weak clusters live here: inguinal canal, sciatic foramina, pelvic autonomics, perineal pouches.",blocks:[
  {id:"ap1",name:"Anterior abdominal wall & rectus sheath",rel:"Layers by region · rectus sheath above and below the arcuate line · segmental nerve supply · epigastric anastomosis."},
  {id:"ap2",name:"Inguinal canal",rel:"Four walls, then cord coverings, then contents — three separate lists, never merged · deep and superficial rings · direct versus indirect against the inferior epigastric."},
  {id:"ap3",name:"Peritoneum, mesenteries & lesser sac",rel:"Reflections and folds · omental foramen boundaries on all four sides · intraperitoneal versus retroperitoneal versus secondarily retroperitoneal."},
  {id:"ap4",name:"Foregut",rel:"Stomach, duodenum, liver, gallbladder, pancreas, spleen · coeliac trunk and branches · biliary tree and Calot's triangle."},
  {id:"ap5",name:"Midgut & hindgut",rel:"SMA and IMA territories · the splenic flexure watershed · appendix positions · marginal artery."},
  {id:"ap6",name:"Portal system & portosystemic anastomoses",rel:"Portal vein formation · the four classic sites · direction of flow in portal hypertension."},
  {id:"ap7",name:"Posterior abdominal wall, kidneys & suprarenals",rel:"Perirenal fascial layers · renal relations anterior and posterior · ureter course and its three constrictions · what crosses the ureter · suprarenal venous asymmetry."},
  {id:"ap8",name:"Lumbar plexus",rel:"Roots and branches · emergence relative to psoas · femoral nerve territory and fascia iliaca · obturator nerve and its two divisions."},
  {id:"ap9",name:"Bony pelvis & pelvic floor",rel:"Inlet and outlet · levator ani parts and attachments · perineal body and what converges on it · sex differences that matter clinically."},
  {id:"ap10",name:"Pelvic viscera & peritoneal coverings",rel:"Bladder, rectum, reproductive organs · what peritoneum covers and where it reflects · rectouterine and rectovesical pouches · ureter crossings in the pelvis."},
  {id:"ap11",name:"Sciatic foramina matrix",rel:"Greater and lesser foramina · everything through each, in a table · relation to piriformis above and below · which structure exits then re-enters."},
  {id:"ap12",name:"Pelvic autonomics & the pain line",rel:"Superior and inferior hypogastric plexuses · pelvic splanchnics as the parasympathetic exception · above and below the pain line, and where each viscus refers."},
  {id:"ap13",name:"Perineum",rel:"Urogenital and anal triangles · perineal membrane · deep and superficial pouches with contents · ischio-anal fossa and pudendal canal."},
  {id:"ap14",name:"Perineal vessels & nerves",rel:"Internal pudendal artery and its branches in the pudendal canal · pudendal nerve, its three branches and its block · drainage split at the pectinate line."}]},
  {id:"ul",name:"Upper Limb — partial",note:"Three blocks only. Lowest lapse intensity in your deck at 0.93 and 66% on the QBank; the exception is the shoulder, which your first error autopsy named as your worst content area.",blocks:[
  {id:"ul1",name:"Shoulder joint & rotator cuff",rel:"Attachments and action of each cuff muscle, precisely · capsule, bursae and their communications · static and dynamic stabilisers · impingement and the tear pattern that follows · expect two sessions."},
  {id:"ul2",name:"Brachial plexus in full",rel:"Roots to terminal branches with root values · which branch leaves at which level · one lesion-to-deficit for every terminal nerve · Erb and Klumpke."},
  {id:"ul3",name:"Axilla & mid-forearm axial section",rel:"Axillary boundaries and contents · axillary artery in three parts against pectoralis minor · cords named for their relation to it · then draw mid-forearm in axial section."}]}
  ];

  window.ANATOMY_DATA = {
    regions: DATA,
    thoraxGate: THORAX_GATE,   // the date the thorax block has to be closed by
    repairTotal: REPAIR_TOTAL, // cards in the repair queue
    tiers: TIERS,
  };
})();
