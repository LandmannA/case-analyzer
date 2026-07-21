// Generates two waves of synthetic consumer-electronics support cases so the demo
// can show month-over-month evolution:
//   public/demo-cases-month1.csv        (baseline period)
//   public/demo-cases-month2-delta.csv  (a later period, loaded on top of month 1)
// All names/emails are obviously fictional. Run with: npm run generate-demo-data
//
// Each case carries a ground-truth `Topic` column that is NOT sent to the AI
// classifier — it's only used by our own dashboard code to compute the
// evolution story deterministically (no LLM guesswork about whether two
// differently-worded root causes are "the same issue").
//
// Planted story:
//  - battery-drain    (AeroSnap X200): heavy in month 1, nearly disappears in
//                      month 2 — the "a knowledge article deflected this" case.
//  - firmware-freeze  (Lumina OLED v3.2): a few early whispers in month 1,
//                      a hard spike in month 2 — "emerging issue, no article yet".
//  - shipping-delay   (Rotterdam warehouse): a March cluster in month 1, zero
//                      in month 2 — resolved operationally, not via an article.
//  - pairing-failure  (SoundWave Bar app update): zero in month 1, appears
//                      only in month 2 — a brand-new topic.
//  - noise: everything else, steady background rate in both periods.

import fs from "node:fs";
import path from "node:path";

// Seeded RNG so the dataset is reproducible
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

const MONTH1_START = new Date("2026-01-12");
const MONTH1_END = new Date("2026-05-31");
const MONTH2_START = new Date("2026-06-01");
const MONTH2_END = new Date("2026-07-15");

function randomDate(from, to) {
  const t = from.getTime() + rand() * (to.getTime() - from.getTime());
  return new Date(t).toISOString().slice(0, 10);
}

const countries = ["Germany", "France", "Netherlands", "United Kingdom", "Spain", "Italy", "Sweden", "Poland"];

// Obviously fictional customers (surnames are literally "Example", "Sample", etc.)
const fakePeople = [
  ["Anna Example", "anna.example@fakemail.test"],
  ["Bob Sample", "bob.sample@demo-inbox.test"],
  ["Carla Placeholder", "carla.placeholder@notreal.test"],
  ["David Demo", "david.demo@fakemail.test"],
  ["Erika Fiktiv", "erika.fiktiv@beispiel.test"],
  ["Frank Fictional", "frank.fictional@notreal.test"],
  ["Greta Testcase", "greta.testcase@demo-inbox.test"],
  ["Henk Voorbeeld", "henk.voorbeeld@fakemail.test"],
];

function fakePhone() {
  return `+49-555-01${randInt(10, 99)}-${randInt(1000, 9999)}`;
}
function serial() {
  return `SN-${randInt(100000, 999999)}`;
}
function order() {
  return `ORD-2026-${randInt(10000, 99999)}`;
}

const politeOpeners = [
  "Hello support team,",
  "Hi there,",
  "Good morning,",
  "Dear customer service,",
];
const angryOpeners = [
  "This is the third time I am contacting you and still no answer.",
  "I am extremely frustrated with this product.",
  "Honestly unacceptable for a product at this price point.",
  "I have been a loyal customer for years and this is how I am treated?",
];

function person() {
  return pick(fakePeople);
}

// --- Case builders -------------------------------------------------------

let caseCounter = 5001;
function makeCase({ subject, description, product, country, priority, status, date, topic }) {
  return {
    CaseNumber: String(caseCounter++).padStart(8, "0"),
    Subject: subject,
    Description: description,
    Product: product,
    Country: country ?? pick(countries),
    Priority: priority,
    Status: status ?? pick(["New", "In Progress", "In Progress", "Escalated", "Closed", "Closed"]),
    CreatedDate: date,
    Topic: topic,
  };
}

// --- Trend definitions -----------------------------------------------------

const firmwareSubjects = [
  "TV frozen after firmware update",
  "Lumina OLED unresponsive since update 3.2",
  "Software update 3.2 broke my TV",
  "TV stuck on logo screen after latest update",
  "Firmware 3.2 causes constant reboots",
];
const firmwareBodies = [
  (p) => `${pick(politeOpeners)} My Lumina 55 OLED installed firmware update v3.2 automatically last night and now it freezes on the home screen every few minutes. I have tried unplugging it for 10 minutes as suggested in the manual but the problem persists. Serial number ${serial()}. Please advise. Regards, ${p[0]}`,
  (p) => `${pick(angryOpeners)} Ever since the v3.2 firmware update my TV reboots itself constantly, sometimes in the middle of a film. Nothing I do fixes it. I paid a lot of money for this television and it worked perfectly before your update. ${p[0]}, ${p[1]}`,
  (p) => `${pick(politeOpeners)} After the automatic software update (version 3.2) my TV gets stuck on the startup logo and never reaches the menu. A factory reset did not help. Is there a way to roll back to the previous firmware? My serial is ${serial()}. Thank you, ${p[0]}`,
  (p) => `${pick(angryOpeners)} Update 3.2 has effectively bricked my Lumina OLED. The screen freezes within minutes of turning it on. I want a fix or a replacement immediately. You can reach me at ${fakePhone()}. ${p[0]}`,
];
function makeFirmwareCase(date) {
  const p = person();
  return makeCase({
    subject: pick(firmwareSubjects),
    description: pick(firmwareBodies)(p),
    product: pick(['Lumina 55" OLED TV', 'Lumina 65" OLED TV']),
    priority: pick(["High", "High", "Medium"]),
    date,
    topic: "firmware-freeze",
  });
}

const batterySubjects = [
  "X200 battery drains overnight",
  "Camera battery life much worse than advertised",
  "AeroSnap X200 shuts down at 40% battery",
  "Battery drains even when camera is off",
];
const batteryBodies = [
  (p) => `${pick(politeOpeners)} I bought the AeroSnap X200 a few months ago and the battery drains from full to empty overnight even when the camera is switched off. I already bought a second battery and it does the same. Is this a known issue? Best, ${p[0]}`,
  (p) => `${pick(politeOpeners)} The spec sheet promises 400 shots per charge but I barely get 120 before the X200 dies. Firmware is up to date. Order ${order()}. Could this be a hardware fault? Kind regards, ${p[0]} (${p[1]})`,
  (p) => `${pick(angryOpeners)} My X200 shuts itself down claiming empty battery while the indicator still shows 40%. This has ruined two family events already. I expect a proper solution, not another troubleshooting checklist. ${p[0]}`,
];
function makeBatteryCase(date) {
  const p = person();
  return makeCase({
    subject: pick(batterySubjects),
    description: pick(batteryBodies)(p),
    product: "AeroSnap X200 Camera",
    priority: pick(["Medium", "Medium", "High", "Low"]),
    date,
    topic: "battery-drain",
  });
}

const shippingSubjects = [
  "Order not delivered after 3 weeks",
  "Where is my order?",
  "Delivery delayed with no updates",
  "Package stuck at Rotterdam warehouse",
];
const shippingBodies = [
  (p) => `${pick(politeOpeners)} I placed order ${order()} over three weeks ago and tracking still shows it sitting at the Rotterdam distribution centre. Could you tell me when it will actually ship? Thank you, ${p[0]}`,
  (p) => `${pick(angryOpeners)} Order ${order()} was promised in 3-5 working days. It has now been 19 days and the tracking has not moved from your Rotterdam warehouse. Either ship it this week or refund me. ${p[0]}, ${p[1]}`,
  (p) => `${pick(politeOpeners)} My delivery keeps getting postponed — the app has changed the delivery date four times now. The parcel appears stuck in Rotterdam. Please investigate order ${order()}. Regards, ${p[0]}`,
];
function makeShippingCase(date) {
  const p = person();
  return makeCase({
    subject: pick(shippingSubjects),
    description: pick(shippingBodies)(p),
    product: pick(["FrostCore Fridge-Freezer", "SoundWave Bar 300", 'Lumina 43" LED TV', "CycloneVac V8"]),
    country: pick(["Netherlands", "Germany", "France", "Belgium"]),
    priority: pick(["Medium", "High"]),
    date,
    topic: "shipping-delay",
  });
}

const pairingSubjects = [
  "SoundWave Bar loses Bluetooth pairing after app update",
  "Soundbar disconnects every few minutes since app update 2.4",
  "Cannot re-pair SoundWave Bar after updating the companion app",
  "Bluetooth connection drops constantly since latest app version",
];
const pairingBodies = [
  (p) => `${pick(politeOpeners)} Since updating the SoundWave companion app to version 2.4 last week, my SoundWave Bar 300 disconnects from Bluetooth every few minutes and I have to re-pair it manually. It worked fine before the update. Any idea what's going on? Regards, ${p[0]}`,
  (p) => `${pick(angryOpeners)} The app update 2.4 has completely broken Bluetooth pairing on my soundbar. It connects for a minute then drops, over and over. I have tried deleting and reinstalling the app twice. ${p[0]}, ${p[1]}`,
  (p) => `${pick(politeOpeners)} After the recent app update my SoundWave Bar 300 no longer stays paired with my phone — it shows "connected" then immediately disconnects. Is this a known issue with app version 2.4? Thanks, ${p[0]}`,
];
function makePairingCase(date) {
  const p = person();
  return makeCase({
    subject: pick(pairingSubjects),
    description: pick(pairingBodies)(p),
    product: "SoundWave Bar 300",
    priority: pick(["Medium", "Low"]),
    date,
    topic: "pairing-failure",
  });
}

const compressorSubjects = [
  "Loud grinding noise from fridge compressor",
  "FrostCore making clicking noise every few minutes",
  "New buzzing sound from fridge motor",
];
const compressorBodies = [
  (p) => `${pick(politeOpeners)} My FrostCore fridge-freezer started making a loud grinding noise from the back of the unit about a week ago. It happens every few minutes and is loud enough to hear from another room. The unit is only 3 months old. Is this a known compressor issue? ${p[0]}`,
  (p) => `${pick(politeOpeners)} There is a new clicking/buzzing noise coming from my FrostCore's compressor that started this week — it wasn't there before. The fridge still cools normally. Should I be worried? Serial ${serial()}. Regards, ${p[0]}`,
  (p) => `${pick(angryOpeners)} My brand new FrostCore fridge-freezer has developed a loud grinding compressor noise out of nowhere. This is unacceptable for a unit I bought recently. ${p[0]}, ${p[1]}`,
];
function makeCompressorCase(date) {
  const p = person();
  return makeCase({
    subject: pick(compressorSubjects),
    description: pick(compressorBodies)(p),
    product: "FrostCore Fridge-Freezer",
    priority: pick(["Medium", "Low"]),
    date,
    topic: "compressor-noise",
  });
}

// --- Background noise ------------------------------------------------------

const noiseTemplates = [
  // how-to questions
  () => {
    const p = person();
    return {
      subject: pick(["How do I connect the soundbar to my TV?", "Cannot find HDMI ARC setting", "Question about wall mounting"]),
      description: `${pick(politeOpeners)} I recently purchased the SoundWave Bar 300 and cannot figure out how to connect it to my TV via HDMI ARC. The manual mentions a settings menu I cannot find. Could you walk me through it? Many thanks, ${p[0]}`,
      product: "SoundWave Bar 300",
      priority: "Low",
    };
  },
  () => {
    const p = person();
    return {
      subject: pick(["How to descale the coffee machine", "Descaling light stays on", "Which water filter do I need?"]),
      description: `${pick(politeOpeners)} The descaling light on my BrewMaster stays on even after I ran the descaling program twice. Am I doing something wrong, or do I need a different descaling solution? Best regards, ${p[0]}`,
      product: "BrewMaster Coffee Machine",
      priority: "Low",
    };
  },
  () => {
    const p = person();
    return {
      subject: pick(["App cannot find my camera", "How to transfer photos via WiFi", "Bluetooth pairing help"]),
      description: `${pick(politeOpeners)} I am trying to pair the AeroSnap Mini with the companion app on my phone but it never appears in the device list. Both Bluetooth and WiFi are on. What am I missing? Thanks, ${p[0]} (${p[1]})`,
      product: "AeroSnap Mini",
      priority: "Low",
    };
  },
  // billing
  () => {
    const p = person();
    return {
      subject: pick(["Charged twice for one order", "Refund not received", "Invoice needed for my order"]),
      description: `${pick(rand() < 0.4 ? angryOpeners : politeOpeners)} I was charged twice for order ${order()} — two identical debits on my statement. Please refund the duplicate charge. You can reach me at ${fakePhone()}. ${p[0]}`,
      product: pick(["FrostCore Fridge-Freezer", "CycloneVac V8", 'Lumina 43" LED TV']),
      priority: pick(["Medium", "High"]),
    };
  },
  () => {
    const p = person();
    return {
      subject: "Refund still not processed",
      description: `${pick(politeOpeners)} I returned my ${pick(["CycloneVac V8", "AeroSnap Mini"])} on the 2nd and the return was confirmed as received, but 15 days later I still have no refund for order ${order()}. Could you check the status? Regards, ${p[0]}, ${p[1]}`,
      product: "CycloneVac V8",
      priority: "Medium",
    };
  },
  // warranty
  () => {
    const p = person();
    return {
      subject: pick(["Warranty claim — fridge not cooling", "Is my repair covered by warranty?", "Warranty registration problem"]),
      description: `${pick(politeOpeners)} My FrostCore fridge-freezer (serial ${serial()}) has stopped cooling in the fridge compartment after 14 months. The freezer still works. Is this covered under the 2-year warranty, and how do I arrange a repair? Thank you, ${p[0]}`,
      product: "FrostCore Fridge-Freezer",
      priority: pick(["High", "Medium"]),
    };
  },
  // product defects (misc)
  () => {
    const p = person();
    return {
      subject: pick(["Vacuum loses suction after 10 minutes", "Burning smell from vacuum motor", "Brush roller stopped spinning"]),
      description: `${pick(rand() < 0.3 ? angryOpeners : politeOpeners)} My CycloneVac V8 loses almost all suction after about ten minutes of use. I have cleaned the filters as described in the manual. Serial ${serial()}, purchased in January. What are my options? ${p[0]}`,
      product: "CycloneVac V8",
      priority: "Medium",
    };
  },
  () => {
    const p = person();
    return {
      subject: pick(["Dead pixels on new TV", "Screen has a vertical line", "Backlight bleeding on Lumina 43"]),
      description: `${pick(politeOpeners)} My new Lumina 43 LED has a cluster of dead pixels in the top-right corner, visible on bright scenes. It was delivered two weeks ago, order ${order()}. I would like an exchange. Best, ${p[0]} (${p[1]})`,
      product: 'Lumina 43" LED TV',
      priority: pick(["Medium", "High"]),
    };
  },
  () => {
    const p = person();
    return {
      subject: pick(["Coffee machine leaks water", "BrewMaster makes loud grinding noise", "Milk frother stopped working"]),
      description: `${pick(politeOpeners)} After about six months my BrewMaster has started leaking water from underneath every time it brews. There is a small puddle on the counter each morning. Serial ${serial()}. Can this be repaired? Regards, ${p[0]}`,
      product: "BrewMaster Coffee Machine",
      priority: "Medium",
    };
  },
  // positive / neutral
  () => {
    const p = person();
    return {
      subject: pick(["Thank you + one small question", "Great product, quick question about accessories"]),
      description: `${pick(politeOpeners)} First of all, I love my new ${pick(["SoundWave Bar 300", "AeroSnap X200 Camera"])} — great sound and easy setup. One question: which subwoofer models are compatible? Keep up the good work! ${p[0]}`,
      product: "SoundWave Bar 300",
      priority: "Low",
    };
  },
];

function makeNoiseCase(date) {
  const t = pick(noiseTemplates)();
  return makeCase({ ...t, date, topic: "noise" });
}

// --- Build Month 1 -----------------------------------------------------

const month1 = [];

// battery-drain: 18 cases, growing across the period
for (let i = 0; i < 18; i++) {
  const d = rand() < 0.35 ? randomDate(MONTH1_START, new Date("2026-03-31")) : randomDate(new Date("2026-04-01"), MONTH1_END);
  month1.push(makeBatteryCase(d));
}

// firmware-freeze: 4 early whispers
for (let i = 0; i < 4; i++) {
  month1.push(makeFirmwareCase(randomDate(new Date("2026-05-10"), MONTH1_END)));
}

// shipping-delay: 15 cases clustered in March
for (let i = 0; i < 15; i++) {
  month1.push(makeShippingCase(randomDate(new Date("2026-03-01"), new Date("2026-03-31"))));
}

// noise: 70 cases spread across the whole period
for (let i = 0; i < 70; i++) {
  month1.push(makeNoiseCase(randomDate(MONTH1_START, MONTH1_END)));
}

// --- Build Month 2 delta -------------------------------------------------

const month2 = [];

// battery-drain: nearly stopped (2 cases) — the KB article deflection story
for (let i = 0; i < 2; i++) {
  month2.push(makeBatteryCase(randomDate(MONTH2_START, MONTH2_END)));
}

// firmware-freeze: hard spike (26 cases)
for (let i = 0; i < 26; i++) {
  month2.push(makeFirmwareCase(randomDate(MONTH2_START, MONTH2_END)));
}

// shipping-delay: none — resolved operationally

// pairing-failure: brand-new topic (10 cases)
for (let i = 0; i < 10; i++) {
  month2.push(makePairingCase(randomDate(MONTH2_START, MONTH2_END)));
}

// compressor-noise: just-emerging early signal — 5 cases, all in July only (zero before)
for (let i = 0; i < 5; i++) {
  month2.push(makeCompressorCase(randomDate(new Date("2026-07-01"), MONTH2_END)));
}

// noise: 25 cases
for (let i = 0; i < 25; i++) {
  month2.push(makeNoiseCase(randomDate(MONTH2_START, MONTH2_END)));
}

// --- Write CSVs -----------------------------------------------------------

const headers = ["CaseNumber", "Subject", "Description", "Product", "Country", "Priority", "Status", "CreatedDate", "Topic"];
function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCases(cases, outPath) {
  // Sort by date for realism, then re-number so case numbers roughly follow dates.
  cases.sort((a, b) => (a.CreatedDate < b.CreatedDate ? -1 : 1));
  let n = caseCounter;
  for (const c of cases) c.CaseNumber = String(n++).padStart(8, "0");
  caseCounter = n;

  const lines = [headers.join(",")];
  for (const c of cases) lines.push(headers.map((h) => csvEscape(c[h])).join(","));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${cases.length} cases to ${outPath}`);
}

writeCases(month1, path.join(process.cwd(), "public", "demo-cases-month1.csv"));
writeCases(month2, path.join(process.cwd(), "public", "demo-cases-month2-delta.csv"));
