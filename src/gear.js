/*
 QUARTER RPG — Gear / Loot system
 ระบบอุปกรณ์: ระดับความหายาก, ค่าสเตตัส, โบนัส, ตีบวก +1..+10
*/

export const RARITIES = [
  { id: "common",    name: "Common",    th: "ธรรมดา",   color: "#cfd6dc", hex: 0xcfd6dc, mult: 1.0,  bonus: 0, beam: 0 },
  { id: "uncommon",  name: "Uncommon",  th: "ดี",        color: "#5ee06a", hex: 0x5ee06a, mult: 1.35, bonus: 0, beam: 70 },
  { id: "rare",      name: "Rare",      th: "หายาก",     color: "#4aa8ff", hex: 0x4aa8ff, mult: 1.8,  bonus: 1, beam: 120 },
  { id: "epic",      name: "Epic",      th: "มหากาพย์",  color: "#c46bff", hex: 0xc46bff, mult: 2.5,  bonus: 2, beam: 170 },
  { id: "legendary", name: "Legendary", th: "ตำนาน",     color: "#ffb02e", hex: 0xffb02e, mult: 3.5,  bonus: 3, beam: 230 },
  { id: "artifact",  name: "Artifact",  th: "อาร์ติแฟกต์", color: "#ff3b6b", hex: 0xff3b6b, mult: 5.0,  bonus: 3, beam: 300 }
];

export const SLOTS = [
  { id: "weapon", th: "อาวุธ",   stats: { atk: 1.0, pen: 0.45, crit: 0.35 } },
  { id: "helmet", th: "หมวก",   stats: { hp: 0.7, crit: 0.4 } },
  { id: "armor",  th: "เกราะ",   stats: { hp: 1.0, atk: 0.2 } },
  { id: "gloves", th: "ถุงมือ",  stats: { atk: 0.55, crit: 0.55 } },
  { id: "boots",  th: "รองเท้า", stats: { hp: 0.6, pen: 0.3 } },
  { id: "ring",   th: "แหวน",   stats: { atk: 0.4, pen: 0.4, crit: 0.45 } }
];

const BASE_NAMES = {
  weapon: ["Sword", "Blade", "Saber", "Cleaver"],
  helmet: ["Helm", "Crown", "Visor"],
  armor: ["Plate", "Cuirass", "Mail"],
  gloves: ["Gauntlets", "Grips"],
  boots: ["Greaves", "Boots", "Treads"],
  ring: ["Ring", "Band", "Signet"]
};

const PREFIX = [
  ["Rusty", "Worn", "Plain"],
  ["Sturdy", "Hunter's", "Iron"],
  ["Azure", "Knight's", "Frost"],
  ["Shadow", "Arcane", "Phantom"],
  ["Dragon", "Solar", "Titan"]
];

const ARTIFACT_NAMES = {
  weapon: ["Stormbreaker", "Doomcaller"],
  helmet: ["Eclipse Crown", "Starseer"],
  armor: ["Dragonheart Plate", "Stormbreaker Mail"],
  gloves: ["Titan's Grasp", "Thunderfist"],
  boots: ["Windwalker", "Voidstride"],
  ring: ["Ring of Eternity", "Phoenix Seal"]
};

// โบนัสสุ่ม (ค่าเป็นเศษส่วน เช่น 0.1 = 10%)
export const BONUSES = {
  atkPct:    { label: "ATK",            min: 0.04, max: 0.10, pct: true },
  hpPct:     { label: "HP",             min: 0.05, max: 0.12, pct: true },
  critDmg:   { label: "Crit Damage",    min: 0.12, max: 0.30, pct: true },
  lifesteal: { label: "Lifesteal",      min: 0.01, max: 0.03, pct: true },
  aspd:      { label: "Attack Speed",   min: 0.06, max: 0.14, pct: true },
  move:      { label: "Move Speed",     min: 0.04, max: 0.09, pct: true },
  goldFind:  { label: "Gold Find",      min: 0.08, max: 0.20, pct: true }
};

// ความสามารถพิเศษ (เฉพาะ Artifact)
export const SPECIALS = {
  frenzy: {
    roll: () => ({ chance: rint(40, 70), power: 300 }),
    lines: s => [
      `มีโอกาส ${s.chance}% ทะลุขีดจำกัดความเร็วโจมตีเมื่อโจมตี`,
      `เพิ่มความเร็วโจมตี ${s.power}%`
    ]
  },
  thunder: {
    roll: () => ({ chance: rint(15, 30), power: rint(220, 300) }),
    lines: s => [
      `มีโอกาส ${s.chance}% เรียกสายฟ้าฟาดเมื่อตีโดน`,
      `สร้างความเสียหาย ${s.power}% ของ ATK เป็นวงกว้าง`
    ]
  },
  quake: {
    roll: () => ({ every: rint(3, 4), power: rint(160, 220) }),
    lines: s => [
      `ทุกการโจมตีครั้งที่ ${s.every} ปล่อยคลื่นกระแทกรอบตัว`,
      `สร้างความเสียหาย ${s.power}% ของ ATK`
    ]
  }
};

export const ENHANCE_RATE = [100, 100, 100, 85, 75, 65, 55, 45, 35, 25];
export const MAX_ENHANCE = 10;

function rint(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollRarity(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

// น้ำหนักการดรอปตามประเภทศัตรู
export const DROP_TABLE = {
  normal: [50, 28, 14, 6, 1.6, 0.4],
  elite:  [30, 32, 22, 11, 3.8, 1.2],
  boss:   [0, 0, 40, 35, 18, 7],
  chest:  [0, 0, 60, 30, 8, 2]
};

let idCounter = Date.now() % 100000;

export function makeItem(level, rarity, slot) {
  slot = slot || pick(SLOTS).id;
  const r = RARITIES[rarity];
  const slotDef = SLOTS.find(s => s.id === slot);
  const lvScale = 6 + level * 2.2;

  const base = {};
  for (const [stat, w] of Object.entries(slotDef.stats)) {
    const statMul = stat === "hp" ? 5 : stat === "crit" ? 0.9 : 1;
    const roll = 0.85 + Math.random() * 0.3;
    base[stat] = Math.max(1, Math.round(lvScale * w * statMul * r.mult * roll));
  }

  const keys = Object.keys(BONUSES);
  const bonuses = [];
  for (let i = 0; i < r.bonus; i++) {
    const key = pick(keys.filter(k => !bonuses.some(b => b.key === k)));
    const def = BONUSES[key];
    const scale = 0.7 + rarity * 0.12;
    const v = (def.min + Math.random() * (def.max - def.min)) * scale;
    bonuses.push({ key, value: Math.round(v * 1000) / 1000 });
  }

  let special = null;
  if (rarity === 5) {
    const type = slot === "weapon" || slot === "gloves"
      ? pick(["frenzy", "frenzy", "thunder"])
      : pick(["frenzy", "thunder", "quake"]);
    special = { type, ...SPECIALS[type].roll() };
  }

  const name = rarity === 5
    ? pick(ARTIFACT_NAMES[slot])
    : `${pick(PREFIX[rarity])} ${pick(BASE_NAMES[slot])}`;

  return {
    id: `i${++idCounter}${Math.floor(Math.random() * 1000)}`,
    slot, rarity, level, name, base, bonuses, special,
    enhance: 0
  };
}

// ค่าสเตตัสรวมการตีบวก (+10% ของค่าพื้นฐานต่อ 1 ขั้น)
export function itemStats(item) {
  const out = {};
  const extra = {};
  for (const [k, v] of Object.entries(item.base)) {
    extra[k] = Math.ceil(v * 0.1 * item.enhance);
    out[k] = v + extra[k];
  }
  return { stats: out, extra };
}

export function statPower(s) {
  return Math.round(
    (s.atk || 0) * 5 + (s.pen || 0) * 4 +
    (s.hp || 0) * 0.8 + (s.crit || 0) * 4
  );
}

export function itemPower(item) {
  const { stats } = itemStats(item);
  const lvf = 1 + item.level * 0.2;
  return statPower(stats) +
    Math.round(item.bonuses.length * 25 * lvf) +
    (item.special ? Math.round(300 * lvf) : 0);
}

export function itemFullName(item) {
  return (item.enhance ? `+${item.enhance} ` : "") + item.name;
}

export function bonusText(b) {
  const d = BONUSES[b.key];
  return `${d.label} +${(b.value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export function specialLines(sp) {
  return sp ? SPECIALS[sp.type].lines(sp) : [];
}

export function sellPrice(item) {
  const r = RARITIES[item.rarity];
  return Math.round((5 + item.level * 2) * Math.pow(r.mult, 1.5) * (1 + item.enhance * 0.2));
}

export function enhanceCost(item) {
  const r = RARITIES[item.rarity];
  return {
    gold: Math.round((30 + item.level * 8) * r.mult * (item.enhance + 1)),
    gems: item.enhance >= 6 ? (item.enhance - 5) * 2 : 0,
    rate: ENHANCE_RATE[item.enhance] ?? 0
  };
}

// ค่าสเตตัสฮีโร่รวมอุปกรณ์ทั้งหมด
export function heroStats(level, equippedItems) {
  const s = {
    atk: 18 + (level - 1) * 2,
    pen: 0,
    hp: 100 + (level - 1) * 15,
    crit: 5,
    atkPct: 0, hpPct: 0, critDmg: 0,
    lifesteal: 0, aspd: 0, move: 0, goldFind: 0,
    specials: []
  };

  for (const item of equippedItems) {
    if (!item) continue;
    const { stats } = itemStats(item);
    for (const [k, v] of Object.entries(stats)) s[k] += v;
    for (const b of item.bonuses) s[b.key] += b.value;
    if (item.special) s.specials.push(item.special);
  }

  s.atk = Math.round(s.atk * (1 + s.atkPct));
  s.hp = Math.round(s.hp * (1 + s.hpPct));
  s.critChance = Math.min(0.75, s.crit / (s.crit + 120 + level * 8));
  s.critMult = 1.6 + s.critDmg;
  s.aspdCapped = Math.min(1, s.aspd);
  s.power = statPower(s) +
    equippedItems.reduce((a, it) => a + (it ? itemPower(it) - statPower(itemStats(it).stats) : 0), 0);
  return s;
}

/* ---------- Pixel icons ---------- */

const ICONS = {
  weapon: [
    "..............oo",
    ".............olo",
    "............olmo",
    "...........olmo.",
    "..........olmo..",
    ".........olmo...",
    "........olmo....",
    ".oo....olmo.....",
    ".oyo..olmo......",
    "..oyoolmo.......",
    "...oyymo........",
    "....oyyo........",
    "...obooyo.......",
    "..obo..oyo......",
    ".ogo....oo......",
    "..o............."
  ],
  helmet: [
    "................",
    ".....oooooo.....",
    "....ommmmllo....",
    "...ommmmmmllo...",
    "..ommmmggmmmlo..",
    "..ommmmggmmmmo..",
    "..odmmmmmmmmmo..",
    "..oyyyyyyyyyyo..",
    "..odmooooooomo..",
    "..odmo.....omo..",
    "..odmo.....omo..",
    "..oddo.....odo..",
    "...oo.......oo..",
    "................"
  ],
  armor: [
    "................",
    "..ooo......ooo..",
    ".ommmo....ommmo.",
    ".ommmmooooommmo.",
    ".odmmmmyymmmmdo.",
    "..oommmggmmmoo..",
    "...ommmggmmmo...",
    "...odmmyymmdo...",
    "...odmmmmmmdo...",
    "...oyyyyyyyyo...",
    "...odmmmmmmdo...",
    "....odmmmmdo....",
    ".....oooooo....."
  ],
  gloves: [
    "................",
    ".....o.o.o......",
    "....omomomo.....",
    "....omomomoo....",
    "....ommmmmomo...",
    "....ommmmmmmo...",
    "....ommmmmmo....",
    "....odmmmmmo....",
    "....oyyyyyyo....",
    "....odgmmmdo....",
    "....oddddddo....",
    ".....oooooo....."
  ],
  boots: [
    "................",
    ".....oooooo.....",
    ".....ommmlo.....",
    ".....ommmlo.....",
    ".....oyyyyo.....",
    ".....ommmmo.....",
    ".....ommmmo.....",
    ".....ommmmmooo..",
    ".....ommmmmmmmo.",
    "....oddmmmgmmmmo",
    "....oddddddddddo",
    ".....oooooooooo."
  ],
  ring: [
    "................",
    ".......ogo......",
    "......oglgo.....",
    ".......ogo......",
    "......oyyyo.....",
    ".....oy...yo....",
    "....oy.....yo...",
    "....oy.....yo...",
    "....oy.....yo...",
    ".....oy...yo....",
    "......oyyyo....."
  ]
};

const PALETTES = [
  { m: "#9aa3aa", l: "#d8dee2", d: "#646c72", g: "#ffffff", y: "#8a7a5a", b: "#6b4a2f" },
  { m: "#a9b8c0", l: "#e6f0f3", d: "#5f7480", g: "#5ee06a", y: "#b99a4f", b: "#6b4a2f" },
  { m: "#5c8fd6", l: "#bfe0ff", d: "#2f4f8a", g: "#7fe8ff", y: "#d6c06a", b: "#4a3424" },
  { m: "#8b56d6", l: "#e0c4ff", d: "#4b2a85", g: "#ff7af0", y: "#e3c46a", b: "#3d2a3a" },
  { m: "#e39a2a", l: "#ffe6a3", d: "#99551a", g: "#ff4a4a", y: "#fff07a", b: "#5a321a" },
  { m: "#d8283f", l: "#ff9aa6", d: "#7a1028", g: "#34c8ff", y: "#ffd24a", b: "#2a1830" }
];

export function drawIcon(slot, rarity, px = 4) {
  const rows = ICONS[slot];
  const pal = PALETTES[rarity];
  const size = 16;
  const c = document.createElement("canvas");
  c.width = size * px;
  c.height = size * px;
  const ctx = c.getContext("2d");
  const offY = Math.floor((size - rows.length) / 2);

  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = ch === "o" ? "#140f18" : pal[ch] || "#ff00ff";
      ctx.fillRect(x * px, (y + offY) * px, px, px);
    });
  });
  return c;
}

const iconCache = {};
export function iconURL(slot, rarity) {
  const k = `${slot}_${rarity}`;
  if (!iconCache[k]) iconCache[k] = drawIcon(slot, rarity, 4).toDataURL();
  return iconCache[k];
}
