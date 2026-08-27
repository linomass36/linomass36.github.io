/* Daily quote bank — surgeons, physicians, and the craft. One per day.

   ROTATION. Every consumer used to compute `quotes[dayOfYear % quotes.length]`
   for itself. With 42 quotes that is a bug twice over: 42 is 6 x 7, so
   dayOfYear % 42 moves in lockstep with the weekday and each quote is welded
   to one day of the week — nine appearances a year, always a Thursday — and
   dayOfYear resets to 1 on the 1st of January, jumping the cycle mid-stride.

   CTQuote.today() is the one place that decides. It counts from the epoch
   rather than the year, so there is no reset, and steps by a number coprime
   with the bank so the full cycle is walked. The bank itself is kept coprime
   with 7 — a stride cannot undo a period that is a multiple of a week.
   Pass a Date to ask about another day. */
window.CT_QUOTES = [
  { q: "The good physician treats the disease; the great physician treats the patient who has the disease.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "It is infinitely better to transplant a heart than to bury it to be devoured by worms.", by: "Christiaan Barnard", sub: "performed the first human heart transplant, 1967" },
  { q: "Medicine is a science of uncertainty and an art of probability.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "A good surgeon knows how to operate; a better one, when to operate; the best, when not to operate.", by: "Surgical proverb", sub: "taught in every operating theatre" },
  { q: "What mankind can dream, research and technology can achieve.", by: "C. Walton Lillehei", sub: "father of open-heart surgery" },
  { q: "The best interest of the patient is the only interest to be considered.", by: "William J. Mayo", sub: "co-founder, Mayo Clinic" },
  { q: "I dressed him, and God healed him.", by: "Ambroise Paré", sub: "father of modern surgery, 16th c." },
  { q: "Why think? Why not try the experiment?", by: "John Hunter", sub: "father of scientific surgery, to Edward Jenner" },
  { q: "The best preparation for tomorrow is to do today's work superbly well.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "Wherever the art of medicine is loved, there is also a love of humanity.", by: "Hippocrates", sub: "father of medicine" },
  { q: "The prime goal is to alleviate suffering, and not to prolong life.", by: "Christiaan Barnard", sub: "pioneer of heart transplantation" },
  { q: "A physician is obligated to consider more than a diseased organ, more even than the whole man — he must view the man in his world.", by: "Harvey Cushing", sub: "father of neurosurgery" },
  { q: "Only the man who is familiar with the art and science of the past is competent to aid in its progress in the future.", by: "Theodor Billroth", sub: "founder of modern abdominal surgery" },
  { q: "He who studies medicine without books sails an uncharted sea, but he who studies medicine without patients does not go to sea at all.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "The safest thing for a patient is to be in the hands of a man engaged in teaching medicine.", by: "Charles H. Mayo", sub: "co-founder, Mayo Clinic" },
  { q: "I attribute my success to this: I never gave or took any excuse.", by: "Florence Nightingale", sub: "founder of modern nursing" },
  { q: "To have striven, to have made the effort, to have been true to certain ideals — this alone is worth the struggle.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "Observation, Reason, Human Understanding, Courage; these make the physician.", by: "Martin H. Fischer", sub: "physician & aphorist" },
  { q: "In surgery, eyes first and most; fingers next and little; tongue last and least.", by: "Sir Astley Cooper", sub: "pioneering vascular surgeon, 19th c." },
  { q: "The very first requirement in a hospital is that it should do the sick no harm.", by: "Florence Nightingale", sub: "founder of modern nursing" },
  { q: "Every operation is an experiment in physiology.", by: "John Kirklin", sub: "perfected the heart-lung machine era of cardiac surgery" },
  { q: "It is not the possession of knowledge but the persistent pursuit of it that marks the student of medicine.", by: "After Osler", sub: "the Oslerian tradition" },
  { q: "Diseases desperate grown by desperate appliance are relieved, or not at all.", by: "Shakespeare, Hamlet", sub: "the oldest argument for bold surgery" },
  { q: "The trained eye sees what the untrained eye overlooks.", by: "Surgical teaching maxim", sub: "on the discipline of looking" },
  { q: "Nature is the best physician; the doctor is nature's assistant.", by: "Galen", sub: "physician to Rome, 2nd c." },
  { q: "First, the taking of a history; second, the physical examination; third, the laboratory; and last, the knife.", by: "Clinical maxim", sub: "the order of operations" },
  { q: "Do the kind thing and do it first.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "A surgeon must have the heart of a lion and the hands of a lady — not the reverse.", by: "English surgical proverb", sub: "on nerve and touch" },
  { q: "The foundation of every state is the education of its youth; of every surgeon, the anatomy lab.", by: "After Diogenes", sub: "adapted for the dissection table" },
  { q: "Care more particularly for the individual patient than for the special features of the disease.", by: "Sir William Osler", sub: "father of modern medicine" },
  { q: "Life is short, and Art long; the crisis fleeting; experience perilous, and decision difficult.", by: "Hippocrates", sub: "the first aphorism" },
  { q: "There is no better instrument than a trained mind, and no better training than responsibility.", by: "Teaching-hospital maxim", sub: "on why students get cases" },
  { q: "Half of what we know is wrong; the purpose of science is to determine which half.", by: "Attributed to C. Sidney Burwell", sub: "Dean, Harvard Medical School" },
  { q: "The operating room is the only place where the phrase 'good enough' is never good enough.", by: "Surgical maxim", sub: "on standards" },
  { q: "You can learn more from a complication honestly reviewed than from a hundred smooth cases.", by: "M&M conference tradition", sub: "morbidity & mortality, every week" },
  { q: "The heart was made to be broken — and, since 1953, to be repaired.", by: "After Oscar Wilde", sub: "amended by the heart-lung machine" },
  { q: "Prognosis: the art of foreseeing what the disease will do; the surgeon's duty: to change it.", by: "Clinical aphorism", sub: "on why intervention exists" },
  { q: "Doubt is uncomfortable; certainty is ridiculous.", by: "Voltaire", sub: "a bedside epistemology" },
  { q: "Great cases make great surgeons only when small cases were done greatly.", by: "Residency maxim", sub: "on the boring fundamentals" },
  { q: "Fortune favours the prepared mind.", by: "Louis Pasteur", sub: "founder of germ theory" },
  { q: "Rest is not idleness — the muscle that never relaxes ends in tremor.", by: "Physiology maxim", sub: "an argument for sleep" },
  { q: "Write it down. The faintest ink outlasts the strongest memory.", by: "Chinese proverb", sub: "the case for a daily log" },
  /* The forty-third. The bank was 42 = 6 x 7, so every quote recurred on a
     six-week cycle and was therefore welded to one weekday no matter what
     order they were walked in. Keeping the count coprime with 7 is the whole
     fix — if you add another, make it 44 rather than 45. */
  { q: "Healing is a matter of time, but it is sometimes also a matter of opportunity.", by: "Hippocrates", sub: "Precepts, on the moment to act" }
];

(function (w) {
  'use strict';
  var STRIDE = 17;   // coprime with 43; the guard below keeps that true if the bank grows
  function pick(when) {
    var list = w.CT_QUOTES || [];
    if (!list.length) return { q: '', by: '', sub: '' };
    var t = (when instanceof Date) ? when.getTime() : (typeof when === 'number' ? when : Date.now());
    /* Local midnights, not UTC ones: the quote should turn over with the
       reader's day. Math.floor over a negative is still the day before. */
    var d = new Date(t);
    var day = Math.floor((t - d.getTimezoneOffset() * 60000) / 86400000);
    var stride = STRIDE;
    // If the stride ever shares a factor with the bank, walk up until it does not.
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    while (stride > 1 && gcd(stride, list.length) !== 1) stride++;
    var i = ((day * stride) % list.length + list.length) % list.length;
    return list[i];
  }
  w.CTQuote = { today: pick, stride: STRIDE };
})(typeof window !== 'undefined' ? window : this);
