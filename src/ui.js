/*
 QUARTER RPG — HTML UI
 การ์ดไอเทมแบบเรืองแสง, กระเป๋า, หน้าตีบวก, เมนูล่าง
*/

import {
  RARITIES, SLOTS, MAX_ENHANCE,
  itemStats, itemPower, itemFullName, bonusText,
  specialLines, sellPrice, enhanceCost, iconURL
} from "./gear.js";

const STAT_ORDER = ["atk", "pen", "hp", "crit"];
const isTouch = matchMedia("(pointer: coarse)").matches;

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}

export class GameUI {
  constructor(scene) {
    this.scene = scene;
    this.root = el(`<div id="ui-root" class="${isTouch ? "touch" : ""}"></div>`);
    document.body.appendChild(this.root);

    this.menu = el(`
      <div class="menu-bar">
        <button class="menu-btn" data-a="bag"><span class="ico">🎒</span>กระเป๋า<br><span class="key">[I]</span></button>
        <button class="menu-btn" data-a="forge"><span class="ico">⚒️</span>ตีบวก<br><span class="key">[G]</span></button>
        <button class="menu-btn" data-a="auto"><span class="ico">▶</span>AUTO<br><span class="key">[R]</span></button>
      </div>`);
    this.root.appendChild(this.menu);
    this.menu.addEventListener("pointerdown", e => {
      const b = e.target.closest("button");
      if (!b) return;
      e.stopPropagation();
      this.menuAction(b.dataset.a);
    });

    this.bannerEl = el(`<div class="banner"></div>`);
    this.root.appendChild(this.bannerEl);

    this.toastBox = el(`<div class="toasts"></div>`);
    this.root.appendChild(this.toastBox);

    this.modal = el(`<div class="modal"></div>`);
    this.root.appendChild(this.modal);
    this.modal.addEventListener("pointerdown", e => {
      if (e.target === this.modal) this.close();
    });

    this.view = null;
    this.forgeSel = null;

    window.addEventListener("keydown", e => this.onKey(e));
  }

  get isOpen() {
    return this.view !== null;
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (k === "escape") {
      if (this.isOpen) this.close();
      return;
    }
    if (this.view === "card" && (k === "enter" || k === " ")) {
      e.preventDefault();
      this.modal.querySelector("[data-a=equip]")?.click();
      return;
    }
    if (this.view === "forge" && k === "enter") {
      this.modal.querySelector("[data-a=enhance]")?.click();
      return;
    }
    if (k === "i" || k === "b" || k === "c") this.toggle("bag");
    if (k === "g") this.toggle("forge");
    if (k === "r" && !this.isOpen) this.menuAction("auto");
  }

  toggle(view) {
    if (this.view === view) this.close();
    else this.menuAction(view);
  }

  menuAction(a) {
    if (a === "bag") this.openBag();
    if (a === "forge") this.openForge();
    if (a === "auto") {
      this.scene.toggleAuto();
      this.setAuto(this.scene.auto);
    }
  }

  setAuto(on) {
    const b = this.menu.querySelector("[data-a=auto]");
    b.classList.toggle("auto-on", on);
    b.querySelector(".ico").textContent = on ? "⏸" : "▶";
  }

  /* ---------- open / close ---------- */

  show(view, node) {
    this.view = view;
    this.modal.innerHTML = "";
    this.modal.appendChild(node);
    this.modal.classList.add("open");
    this.scene.onUIOpen();
  }

  close() {
    if (!this.isOpen) return;
    const after = this.afterClose;
    this.afterClose = null;
    this.view = null;
    this.modal.classList.remove("open");
    this.modal.innerHTML = "";
    this.scene.onUIClose();
    if (after) after();
  }

  /* ---------- banner + toast ---------- */

  banner(text, highlight, rarity) {
    const r = RARITIES[rarity];
    this.bannerEl.className = "banner" + (rarity === 5 ? " artifact" : "");
    this.bannerEl.style.setProperty("--rc", r.color);
    this.bannerEl.innerHTML = text.replace("{hl}", `<span class="hl">${highlight}</span>`);
    requestAnimationFrame(() => this.bannerEl.classList.add("show"));
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove("show"), 2200);
  }

  toast(item, prefix = "ได้รับ") {
    const r = RARITIES[item.rarity];
    const t = el(`<div class="toast" style="--rc:${r.color}">
      <img src="${iconURL(item.slot, item.rarity)}">${prefix} ${itemFullName(item)}</div>`);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 5) this.toastBox.firstChild.remove();
    setTimeout(() => t.remove(), 2900);
  }

  /* ---------- item card ---------- */

  cardHTML(item, compareWith) {
    const r = RARITIES[item.rarity];
    const { stats, extra } = itemStats(item);
    const power = itemPower(item);
    const stars = "★".repeat(item.rarity + 1);

    const rows = STAT_ORDER.filter(k => stats[k] !== undefined).map(k => `
      <div class="row"><span class="k">${k.toUpperCase()}:</span><span class="v">${fmt(stats[k])}</span>
      <span class="e">${extra[k] ? `(Enhance+${fmt(extra[k])})` : ""}</span></div>`).join("");

    const bonuses = item.bonuses.length ? `
      <div class="sec"><div class="sec-t">Bonus Stats</div>
      ${item.bonuses.map(b => `<div class="bonus">${bonusText(b)}</div>`).join("")}</div>` : "";

    const sp = specialLines(item.special);
    const special = sp.length ? `
      <div class="special"><div class="l1">${sp[0]}</div><div class="l2">${sp[1]}</div></div>` : "";

    let compare = "";
    if (compareWith !== undefined) {
      if (item.level > this.scene.level) {
        compare = `<div class="compare down">ต้องเลเวล ${item.level} ก่อนจึงจะใส่ได้</div>`;
      } else if (!compareWith) {
        compare = `<div class="compare">ช่อง${SLOTS.find(s => s.id === item.slot).th}ว่างอยู่ — <span class="up">ใส่ได้เลย!</span></div>`;
      } else if (compareWith.id !== item.id) {
        const diff = power - itemPower(compareWith);
        compare = `<div class="compare">เทียบกับที่ใส่อยู่: Power
          <span class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${fmt(Math.abs(diff))}</span></div>`;
      }
    }

    return `
      <div class="card r${item.rarity}" style="--rc:${r.color}">
        <div class="head">
          <div class="icon-box"><img src="${iconURL(item.slot, item.rarity)}"></div>
          <div>
            <div class="name">${itemFullName(item)}</div>
            <div class="meta">Power: <b>${fmt(power)}</b></div>
            <div class="meta">Req. Lv: <b class="${item.level > this.scene.level ? "down" : ""}">Lv.${item.level}</b> · ${SLOTS.find(s => s.id === item.slot).th}</div>
          </div>
        </div>
        <div class="body2">
          <div><div class="sec"><div class="sec-t">Base Stats</div>${rows}</div>${bonuses}</div>
          <div>${special}</div>
        </div>
        ${compare}
        <div class="foot">${r.name} · T${Math.max(1, Math.ceil(item.level / 10))} · ${stars}</div>
        <div class="btns"></div>
      </div>`;
  }

  showItemCard(item, opts = {}) {
    const g = this.scene;
    const equipped = g.equipped[item.slot];
    const isEquipped = equipped && equipped.id === item.id;
    const r = RARITIES[item.rarity];

    const wrap = el(`<div class="card-wrap r${item.rarity}" style="--rc:${r.color}">
      ${this.cardHTML(item, isEquipped ? undefined : (equipped || null))}</div>`);

    const btns = wrap.querySelector(".btns");
    const add = (label, cls, a, fn) => {
      const b = el(`<button class="btn ${cls}" data-a="${a}">${label}</button>`);
      b.addEventListener("click", fn);
      btns.appendChild(b);
    };

    if (!isEquipped && !g.canEquip(item)) {
      add(`ต้องการ Lv.${item.level}`, "gold", "noequip", () => {});
      btns.lastChild.disabled = true;
    } else if (!isEquipped) {
      add(isTouch ? "สวมใส่" : "สวมใส่ [Enter]", "gold", "equip", () => {
        if (g.equipItem(item)) this.back(opts);
      });
    } else {
      add("ถอดออก", "blue", "unequip", () => {
        g.unequipSlot(item.slot);
        this.back(opts);
      });
    }

    add("ตีบวก", "blue", "forge", () => this.openForge(item));

    if (!isEquipped) {
      add(`ขาย ${fmt(sellPrice(item))}G`, "red", "sell", () => {
        g.sellItem(item);
        this.back(opts);
      });
    }

    add(isTouch ? "ปิด" : "ปิด [Esc]", "", "close", () => this.back(opts));

    this.show("card", wrap);
  }

  back(opts) {
    if (opts.from === "bag") this.openBag();
    else if (opts.from === "forge") this.openForge();
    else this.close();
  }

  /* ---------- bag + character ---------- */

  slotHTML(item, extraClass = "") {
    if (!item) return "";
    const r = RARITIES[item.rarity];
    return `<div class="slot r${item.rarity} ${extraClass}" data-id="${item.id}" style="--rc:${r.color}">
      <img src="${iconURL(item.slot, item.rarity)}">
      ${item.enhance ? `<span class="plus">+${item.enhance}</span>` : ""}</div>`;
  }

  openBag() {
    const g = this.scene;
    const s = g.stats;
    const inv = [...g.inventory].sort((a, b) => b.rarity - a.rarity || itemPower(b) - itemPower(a));

    const equipSlots = SLOTS.map(sl => {
      const it = g.equipped[sl.id];
      return it ? this.slotHTML(it, "equipped")
        : `<div class="slot"><span class="empty">${sl.th}</span></div>`;
    }).join("");

    const pct = v => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const frenzy = s.specials.some(x => x.type === "frenzy");

    const node = el(`
      <div class="window">
        <button class="x-btn">✕</button>
        <h2>ตัวละคร & กระเป๋า</h2>
        <div class="bag-grid-wrap">
          <div class="equip-panel">
            <div class="equip-slots">${equipSlots}</div>
            <div class="stats-list">
              <div class="power">⚡ Power ${fmt(s.power)}</div>
              <span class="k">LEVEL</span><span>${g.level}</span>
              <span class="k">ATK</span><span>${fmt(s.atk)}</span>
              <span class="k">PEN</span><span>${fmt(s.pen)}</span>
              <span class="k">HP</span><span>${fmt(g.hp)}/${fmt(s.hp)}</span>
              <span class="k">CRIT</span><span>${fmt(s.crit)} (${pct(s.critChance)})</span>
              <span class="k">Crit DMG</span><span>${pct(s.critMult)}</span>
              <span class="k">Atk Speed</span><span>+${pct(s.aspdCapped)}${frenzy ? " <span class='up'>(+300%)</span>" : ""}</span>
              ${s.lifesteal ? `<span class="k">Lifesteal</span><span>${pct(s.lifesteal)}</span>` : ""}
              ${s.move ? `<span class="k">Move</span><span>+${pct(s.move)}</span>` : ""}
              ${s.goldFind ? `<span class="k">Gold Find</span><span>+${pct(s.goldFind)}</span>` : ""}
              <span class="k">Gold</span><span>${fmt(g.gold)}</span>
              <span class="k">Gems</span><span>${fmt(g.gems)}</span>
            </div>
          </div>
          <div>
            <div class="inv-head">
              <span>กระเป๋า ${inv.length}/${g.bagSize}</span>
              <button class="btn red" data-a="sellLow">ขายของต่ำกว่า Rare ทั้งหมด</button>
            </div>
            <div class="inv-grid">${inv.map(it => this.slotHTML(it)).join("") ||
              "<span style='color:#6c809a;font-size:13px'>ยังไม่มีของ — ออกไปล่ามอนสเตอร์!</span>"}</div>
          </div>
        </div>
      </div>`);

    node.querySelector(".x-btn").addEventListener("click", () => this.close());
    node.querySelector("[data-a=sellLow]").addEventListener("click", () => {
      const n = g.sellBelow(2);
      g.message(n ? `ขายไป ${n} ชิ้น` : "ไม่มีของให้ขาย");
      this.openBag();
    });

    node.querySelectorAll(".slot[data-id]").forEach(sl => {
      sl.addEventListener("click", () => {
        const it = g.findItem(sl.dataset.id);
        if (it) this.showItemCard(it, { from: "bag" });
      });
    });

    this.show("bag", node);
  }

  /* ---------- forge ---------- */

  openForge(preselect) {
    const g = this.scene;
    const all = [
      ...SLOTS.map(s => g.equipped[s.id]).filter(Boolean),
      ...[...g.inventory].sort((a, b) => b.rarity - a.rarity || itemPower(b) - itemPower(a))
    ];

    if (preselect) this.forgeSel = preselect.id;
    let item = all.find(i => i.id === this.forgeSel) || all[0];
    this.forgeSel = item?.id;

    const node = el(`
      <div class="window">
        <button class="x-btn">✕</button>
        <h2>⚒️ BRON'S FORGE — ตีบวก</h2>
        <div class="forge">
          <div class="forge-list">${all.map(it =>
            this.slotHTML(it, (g.isEquipped(it) ? "equipped " : "") + (it.id === this.forgeSel ? "sel" : ""))).join("")}</div>
          <div class="forge-main"></div>
        </div>
      </div>`);

    node.querySelector(".x-btn").addEventListener("click", () => this.close());
    node.querySelectorAll(".forge-list .slot").forEach(sl => {
      sl.addEventListener("click", () => {
        this.forgeSel = sl.dataset.id;
        this.openForge();
      });
    });

    const main = node.querySelector(".forge-main");
    this.renderForgeMain(main, item);
    this.show("forge", node);
  }

  renderForgeMain(main, item, result) {
    const g = this.scene;
    if (!item) {
      main.innerHTML = "<p>ยังไม่มีอุปกรณ์</p>";
      return;
    }

    const r = RARITIES[item.rarity];
    const { stats } = itemStats(item);
    const maxed = item.enhance >= MAX_ENHANCE;
    const cost = enhanceCost(item);
    const next = maxed ? null : itemStats({ ...item, enhance: item.enhance + 1 }).stats;
    const canPay = g.gold >= cost.gold && g.gems >= cost.gems;

    const rows = STAT_ORDER.filter(k => stats[k] !== undefined).map(k =>
      `<div>${k.toUpperCase()} ${fmt(stats[k])}${next ? ` → <span class="up">${fmt(next[k])}</span>` : ""}</div>`).join("");

    main.innerHTML = `
      <div class="slot big r${item.rarity}" style="--rc:${r.color}"><img src="${iconURL(item.slot, item.rarity)}"></div>
      <div style="color:${r.color}">${item.name}</div>
      <div class="forge-arrow">+${item.enhance}${maxed ? " (MAX)" : ` → <span class="to">+${item.enhance + 1}</span>`}</div>
      <div class="forge-rows">${rows}</div>
      ${maxed ? "" : `
        <div class="forge-rate">โอกาสสำเร็จ <b class="${cost.rate >= 70 ? "up" : "down"}">${cost.rate}%</b></div>
        <div class="forge-cost">ใช้ ${fmt(cost.gold)} Gold${cost.gems ? ` + ${cost.gems} Gems` : ""}
          <br><span style="color:#9fb2c9">(มี ${fmt(g.gold)} Gold · ${fmt(g.gems)} Gems)</span></div>`}
      <div class="forge-result ${result || ""}">${result === "ok" ? "SUCCESS!" : result === "fail" ? "FAILED..." : ""}</div>
      <div class="btns" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
        ${maxed ? "" : `<button class="btn gold" data-a="enhance" ${canPay ? "" : "disabled"}>ตีบวก${isTouch ? "" : " [Enter]"}</button>`}
        <button class="btn blue" data-a="info">ดูการ์ด</button>
      </div>`;

    main.querySelector("[data-a=info]").addEventListener("click", () =>
      this.showItemCard(item, { from: "forge" }));

    const btn = main.querySelector("[data-a=enhance]");
    if (btn) {
      btn.addEventListener("click", () => {
        const res = g.enhanceItem(item);
        if (res === "nomoney") return;
        // refresh list (plus badges) then show result
        this.openForge();
        const m = this.modal.querySelector(".forge-main");
        this.renderForgeMain(m, item, res);
        if (res === "ok") m.classList.add("flash");
      });
    }
  }
}
