
/*
 QUARTER RPG V1.5
 Phaser 3 | Mobile | GitHub Pages
 Full replacement for src/main.js
*/

const P = window.Phaser;
if (!P) throw Error("Load Phaser 3 first");

const WORLD = { w: 2000, h: 1500 };
const HOME = { x: 1000, y: 750, r: 300 };
const SAVE = "quarter-rpg-v15";
const DIRS = ["down", "up", "left", "right"];
const ACTIONS = ["idle", "walk", "attack"];

const HELL = {
  idle: 8,
  walk: 8,
  run: 8,
  attack_1: 8,
  attack_2: 8,
  hurt: 4,
  die: 8
};

class Game extends P.Scene {
  constructor() {
    super("Game");
  }

  preload() {
    for (const a of ACTIONS) {
      for (const d of DIRS) {
        const k = `hero_${a}_${d}`;
        this.load.spritesheet(
          k, `assets/${k}.png`,
          { frameWidth: 256, frameHeight: 288 }
        );
      }
    }

    for (const a in HELL) {
      this.load.spritesheet(
        `hellhound_${a}`,
        `assets/hellhound_${a}.png`,
        { frameWidth: 176, frameHeight: 146 }
      );
    }

    for (const t of ["slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `${t}_${i}`,
          `assets/${t}_${i}.png`
        );
      }
    }

    for (const t of [
      "grass", "water", "tree",
      "bush", "rock", "flower", "stump"
    ]) {
      this.load.image(t, `assets/${t}.png`);
    }

    this.load.on("loaderror", f => {
      console.warn("Missing:", f.key);
    });
  }

  create() {
    this.physics.world.setBounds(
      0, 0, WORLD.w, WORLD.h
    );

    this.makeTextures();
    this.makeAnimations();
    this.loadSave();

    this.enemies = [];
    this.drops = [];
    this.blocks = [];
    this.npcs = [];
    this.boss = null;

    this.walls = this.physics.add.staticGroup();

    this.buildMap();
    this.buildVillage();

    const heroKey = this.textures.exists(
      "hero_idle_down"
    ) ? "hero_idle_down" : "fallback_hero";

    this.hero = this.physics.add.sprite(
      HOME.x, HOME.y + 95, heroKey
    ).setOrigin(0.5, 1);

    this.hero.setDisplaySize(96, 108);
    this.hero.setCollideWorldBounds(true);
    this.hero.body.setSize(
      this.hero.width * 0.36,
      this.hero.height * 0.12
    );
    this.hero.body.setOffset(
      this.hero.width * 0.32,
      this.hero.height * 0.85
    );

    this.physics.add.collider(
      this.hero, this.walls
    );

    this.shadow = this.add.ellipse(
      this.hero.x, this.hero.y,
      48, 13, 0x102a20, 0.4
    );

    this.dir = "down";
    this.heroAction = "";
    this.combo = 0;
    this.comboExpire = 0;
    this.attacking = false;
    this.attackAt = 0;
    this.attackEnd = 0;
    this.hitDone = false;
    this.lastAttack = -9999;
    this.lastSkill = -9999;
    this.lastHurt = -9999;
    this.lastSpawn = 0;
    this.lastSave = 0;

    this.stick = { x: 0, y: 0 };
    this.joyPointer = null;
    this.attackPointer = null;
    this.attackHeld = false;
    this.panelMode = "";

    this.cameras.main
      .setBounds(0, 0, WORLD.w, WORLD.h)
      .startFollow(this.hero, true, 0.12, 0.12)
      .setRoundPixels(true);

    this.makeUI();
    this.bindInput();
    this.layout();

    this.scale.on("resize", this.layout, this);

    for (let i = 0; i < 14; i++) {
      this.spawnEnemy();
    }

    this.playHero("idle", "down");
    this.notice("GREENHAVEN - คุยกับ ELDER เพื่อรับเควสต์");
  }

  loadSave() {
    let s = {};

    try {
      s = JSON.parse(
        localStorage.getItem(SAVE) || "{}"
      );
    } catch {}

    this.level = s.level || 1;
    this.exp = s.exp || 0;
    this.gold = s.gold ?? 100;
    this.gems = s.gems || 0;
    this.kills = s.kills || 0;
    this.sword = s.sword || 0;
    this.armor = s.armor || 0;
    this.potions = s.potions ?? 3;
    this.quest = s.quest || {
      accepted: false,
      kills: 0,
      claimed: false
    };
    this.bossWins = s.bossWins || 0;
    this.maxHp = 100 + this.armor * 25;
    this.hp = this.maxHp;
  }

  saveGame() {
    try {
      localStorage.setItem(
        SAVE,
        JSON.stringify({
          level: this.level,
          exp: this.exp,
          gold: this.gold,
          gems: this.gems,
          kills: this.kills,
          sword: this.sword,
          armor: this.armor,
          potions: this.potions,
          quest: this.quest,
          bossWins: this.bossWins
        })
      );
    } catch (e) {
      console.warn("Save unavailable", e);
    }
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const save = (key, w, h) => {
      g.generateTexture(key, w, h);
      g.clear();
    };

    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 2, 2);
    save("blank", 2, 2);

    for (const [name, color] of [
      ["grass", 0x478b52],
      ["water", 0x2889b4],
      ["tree", 0x337d45],
      ["bush", 0x55a35a],
      ["rock", 0x858e92],
      ["flower", 0xf4c95c],
      ["stump", 0x80512f]
    ]) {
      g.fillStyle(color);
      g.fillRect(0, 0, 64, 64);
      save(`fallback_${name}`, 64, 64);
    }

    for (const [type, color] of [
      ["slime", 0x4ed36d],
      ["boar", 0x986444]
    ]) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle(color);
        g.fillEllipse(32, 35 + i % 2, 54, 40);
        g.fillStyle(0x202020);
        g.fillRect(21, 28, 5, 6);
        g.fillRect(40, 28, 5, 6);
        save(`fallback_${type}_${i}`, 64, 64);
      }
    }

    g.fillStyle(0x28252d);
    g.fillEllipse(82, 96, 105, 62);
    g.fillEllipse(125, 70, 65, 57);
    g.fillStyle(0xff7528);
    g.fillRect(126, 63, 10, 7);
    g.fillRect(45, 119, 16, 9);
    g.fillRect(112, 119, 16, 9);
    save("fallback_hell", 176, 146);

    g.fillStyle(0x283a56);
    g.fillRect(22, 39, 36, 52);
    g.fillStyle(0xf0bb91);
    g.fillRect(26, 15, 28, 28);
    g.fillStyle(0x342522);
    g.fillRect(23, 8, 34, 13);
    g.fillStyle(0x283047);
    g.fillRect(25, 90, 12, 24);
    g.fillRect(43, 90, 12, 24);
    g.fillStyle(0xffdf80);
    g.fillRect(63, 35, 5, 70);
    save("fallback_hero", 80, 120);

    for (let i = 0; i < 3; i++) {
      g.fillStyle([
        0x4b9a68, 0x956748, 0x5279b0
      ][i]);
      g.fillRect(16, 42, 36, 50);
      g.fillStyle(0xf0c092);
      g.fillRect(21, 17, 26, 28);
      g.fillStyle(0x392c2a);
      g.fillRect(18, 8, 32, 13);
      g.fillStyle(0x26344b);
      g.fillRect(19, 92, 12, 23);
      g.fillRect(38, 92, 12, 23);
      save(`npc_${i}`, 68, 120);
    }

    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x3a2d29);
      g.fillRect(10, 72, 210, 112);
      g.fillStyle(0xd1b58b);
      g.fillRect(15, 77, 200, 102);

      g.fillStyle([
        0xa54c3a, 0x5276a4, 0x896642
      ][i]);

      g.fillPoints([
        { x: 0, y: 78 },
        { x: 115, y: 5 },
        { x: 230, y: 78 }
      ], true);

      g.fillStyle(0x52382a);
      g.fillRect(96, 126, 39, 53);
      g.fillStyle(0x46768c);
      g.fillRect(39, 111, 35, 32);
      g.fillRect(158, 111, 35, 32);

      save(`house_${i}`, 230, 190);
    }

    g.fillStyle(0xffd45c);
    g.fillCircle(12, 12, 10);
    save("coin", 24, 24);

    g.fillStyle(0x61d9ff);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 23, y: 12 },
      { x: 12, y: 24 },
      { x: 1, y: 12 }
    ], true);
    save("gem", 24, 24);

    g.destroy();
  }

  tex(name) {
    return this.textures.exists(name)
      ? name
      : `fallback_${name}`;
  }

  makeAnimations() {
    for (const a of ACTIONS) {
      for (const d of DIRS) {
        const k = `hero_${a}_${d}`;
        if (!this.textures.exists(k)) continue;

        this.anims.create({
          key: `h_${a}_${d}`,
          frames: this.anims.generateFrameNumbers(
            k, { start: 0, end: 7 }
          ),
          frameRate: a === "attack" ? 16 :
            a === "walk" ? 11 : 5,
          repeat: a === "attack" ? 0 : -1
        });
      }
    }

    for (const [a, n] of Object.entries(HELL)) {
      const k = `hellhound_${a}`;
      if (!this.textures.exists(k)) continue;

      this.anims.create({
        key: `e_${a}`,
        frames: this.anims.generateFrameNumbers(
          k, { start: 0, end: n - 1 }
        ),
        frameRate: a === "idle" ? 5 : 12,
        repeat: ["idle", "walk", "run"].includes(a)
          ? -1 : 0
      });
    }
  }

  playHero(a, d, force = false) {
    const key = `h_${a}_${d}`;

    if (
      !force &&
      this.heroAction === key &&
      this.hero.anims.isPlaying
    ) return;

    this.heroAction = key;
    this.dir = d;

    if (this.anims.exists(key)) {
      this.hero.play(key, true);
    } else {
      this.hero.setTexture("fallback_hero");
    }
  }

  playEnemy(m, a, force = false) {
    const key = `e_${a}`;

    if (
      m.type !== "hellhound" ||
      !this.anims.exists(key)
    ) return;

    if (
      !force &&
      m.anim === a &&
      m.s.anims.isPlaying
    ) return;

    m.anim = a;
    m.s.play(key, true);
  }

  block(x, y, w, h) {
    this.blocks.push({ x, y, w, h });

    const b = this.walls.create(x, y, "blank");
    b.setDisplaySize(w, h);
    b.refreshBody();
    b.setVisible(false);
  }

  walkable(x, y, r = 20) {
    if (
      x < r || y < r ||
      x > WORLD.w - r ||
      y > WORLD.h - r
    ) return false;

    return !this.blocks.some(b =>
      Math.abs(x - b.x) < b.w / 2 + r &&
      Math.abs(y - b.y) < b.h / 2 + r
    );
  }

  safe(x, y, extra = 0) {
    return Math.hypot(
      x - HOME.x,
      y - HOME.y
    ) < HOME.r + extra;
  }

  buildMap() {
    this.add.tileSprite(
      WORLD.w / 2,
      WORLD.h / 2,
      WORLD.w,
      WORLD.h,
      this.tex("grass")
    ).setDepth(-10000);

    this.add.tileSprite(
      1640, 300, 300, 600,
      this.tex("water")
    ).setDepth(-9998);

    this.block(1640, 100, 300, 200);
    this.block(1640, 480, 300, 240);

    const bridge = this.add.graphics()
      .setDepth(-9997);

    bridge.fillStyle(0x775237);
    bridge.fillRect(1450, 200, 400, 120);

    for (let x = 1455; x < 1840; x += 28) {
      bridge.lineStyle(3, 0x30241e);
      bridge.lineBetween(x, 200, x, 320);
    }

    const placed = [];

    for (let i = 0; i < 180; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = P.Math.Between(75, WORLD.w - 75);
        const y = P.Math.Between(70, WORLD.h - 70);

        if (this.safe(x, y, 120)) continue;

        if (
          x > 1450 && x < 1850 &&
          y < 610
        ) continue;

        if (!this.walkable(x, y, 60)) continue;

        if (placed.some(p =>
          Math.hypot(x - p.x, y - p.y) < 85
        )) continue;

        const r = Math.random();

        const type = r < 0.36 ? "tree" :
          r < 0.58 ? "bush" :
          r < 0.75 ? "rock" :
          r < 0.91 ? "flower" : "stump";

        const img = this.add.image(
          x, y, this.tex(type)
        ).setOrigin(0.5, 1);

        const heights = {
          tree: 150,
          bush: 65,
          rock: 58,
          flower: 28,
          stump: 48
        };

        img.setScale(heights[type] / img.height);
        img.setDepth(y);

        if (["tree", "rock", "stump"].includes(type)) {
          this.block(
            x, y - 12,
            type === "tree" ? 40 : 34,
            25
          );
        }

        placed.push({ x, y });
        break;
      }
    }
  }

  buildVillage() {
    const g = this.add.graphics().setDepth(-100);

    g.fillStyle(0x7aaf67);
    g.fillEllipse(
      HOME.x, HOME.y, 690, 600
    );

    g.lineStyle(7, 0xd4b17d);
    g.strokeEllipse(
      HOME.x, HOME.y, 690, 600
    );

    g.fillStyle(0xc9ac7f);
    g.fillEllipse(
      HOME.x, HOME.y + 35, 430, 230
    );
    g.fillRect(HOME.x - 35, HOME.y + 40, 70, 390);

    g.fillStyle(0x5e6d72);
    g.fillEllipse(HOME.x, HOME.y - 20, 94, 48);

    g.fillStyle(0x4396ba);
    g.fillEllipse(HOME.x, HOME.y - 22, 65, 27);

    const houses = [
      [760, 610, 0, "SHOP"],
      [1240, 610, 1, "FORGE"],
      [1000, 470, 2, "HALL"]
    ];

    for (const [x, y, id, name] of houses) {
      this.add.image(
        x, y, `house_${id}`
      ).setOrigin(0.5, 1)
        .setScale(0.95)
        .setDepth(y);

      this.block(x, y - 32, 160, 48);

      this.add.text(x, y - 194, name, {
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#ffe6a1",
        stroke: "#2a211b",
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(y + 1);
    }

    this.addNPC(0, 785, 775, "MIRA", "ร้านค้า");
    this.addNPC(1, 1215, 775, "BRON", "ช่างตีเหล็ก");
    this.addNPC(2, 1000, 930, "ELDER", "เควสต์");

    this.add.text(
      HOME.x, HOME.y + 290,
      "GREENHAVEN - SAFE ZONE",
      {
        fontFamily: "monospace",
        fontSize: "21px",
        color: "#fff2bb",
        stroke: "#173a26",
        strokeThickness: 5
      }
    ).setOrigin(0.5).setDepth(1100);
  }

  addNPC(id, x, y, name, role) {
    const sprite = this.add.image(
      x, y, `npc_${id}`
    ).setOrigin(0.5, 1)
      .setDisplaySize(61, 108)
      .setDepth(y)
      .setInteractive();

    this.add.text(
      x, y - 125,
      `${name}\n${role}`,
      {
        fontFamily: "system-ui",
        fontSize: "15px",
        align: "center",
        color: "#ffe9b1",
        stroke: "#162b1d",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(y + 1);

    const npc = { id, x, y, name, role };
    this.npcs.push(npc);

    sprite.on("pointerdown", () => {
      this.talk(npc);
    });
  }

  nearestNPC() {
    let best = null;
    let distance = 145;

    for (const npc of this.npcs) {
      const d = Math.hypot(
        this.hero.x - npc.x,
        this.hero.y - npc.y
      );

      if (d < distance) {
        best = npc;
        distance = d;
      }
    }

    return best;
  }

  talk(npc) {
    if (
      Math.hypot(
        this.hero.x - npc.x,
        this.hero.y - npc.y
      ) > 150
    ) {
      this.notice("เดินเข้าใกล้ NPC ก่อน");
      return;
    }

    if (npc.id === 0) this.openPanel("shop");
    if (npc.id === 1) this.openPanel("forge");
    if (npc.id === 2) this.openPanel("quest");
  }

  makeUI() {
    const fixed = obj =>
      obj.setScrollFactor(0).setDepth(20000);

    this.hud = fixed(this.add.graphics());

    this.hudText = fixed(this.add.text(
      15, 14, "",
      {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ));

    this.noticeText = fixed(this.add.text(
      0, 150, "",
      {
        fontFamily: "system-ui",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#182d3ee8",
        padding: { x: 12, y: 8 },
        align: "center"
      }
    ).setOrigin(0.5)).setVisible(false);

    this.joyBase = fixed(this.add.circle(
      90, 0, 61, 0x163349, 0.72
    ).setStrokeStyle(3, 0xb6d9ec));

    this.joyKnob = fixed(this.add.circle(
      90, 0, 26, 0xa8d8f1
    ));

    this.attackBtn = fixed(this.add.circle(
      0, 0, 48, 0xa83d2d
    ).setStrokeStyle(4, 0xffc569));

    this.attackLabel = fixed(this.add.text(
      0, 0, "⚔",
      { fontSize: "32px" }
    ).setOrigin(0.5));

    this.skillBtn = fixed(this.add.circle(
      0, 0, 35, 0x30518b
    ).setStrokeStyle(3, 0xe3d36e));

    this.skillLabel = fixed(this.add.text(
      0, 0, "✦",
      {
        fontSize: "28px",
        color: "#ffffff"
      }
    ).setOrigin(0.5));

    this.talkBtn = fixed(this.add.text(
      0, 0, "💬 คุย",
      {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#346e50",
        padding: { x: 12, y: 10 }
      }
    ).setOrigin(0.5).setInteractive());

    this.talkBtn.on("pointerdown", () => {
      if (this.panelMode) return;

      const npc = this.nearestNPC();
      if (npc) this.talk(npc);
      else this.notice("ไม่มี NPC อยู่ใกล้");
    });

    this.bagBtn = fixed(this.add.text(
      0, 0, "🎒 BAG",
      {
        fontSize: "15px",
        color: "#ffffff",
        backgroundColor: "#394f72",
        padding: { x: 10, y: 8 }
      }
    ).setOrigin(0.5).setInteractive());

    this.bagBtn.on("pointerdown", () => {
      this.openPanel("bag");
    });

    this.potionBtn = fixed(this.add.text(
      0, 0, "🧪",
      {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#794577",
        padding: { x: 12, y: 8 }
      }
    ).setOrigin(0.5).setInteractive());

    this.potionBtn.on("pointerdown", () => {
      if (!this.panelMode) this.usePotion();
    });

    this.bossBar = fixed(this.add.graphics());

    this.bossLabel = fixed(this.add.text(
      0, 91, "HELLHOUND ALPHA",
      {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffbc74",
        stroke: "#24191b",
        strokeThickness: 4
      }
    ).setOrigin(0.5)).setVisible(false);

    this.panel = fixed(this.add.container(0, 0));
    this.panel.setVisible(false);

    this.panelBg = this.add.graphics();
    this.panel.add(this.panelBg);

    this.panelTitle = this.add.text(
      0, 0, "",
      {
        fontFamily: "system-ui",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffe09a"
      }
    ).setOrigin(0.5);

    this.panel.add(this.panelTitle);

    this.panelInfo = this.add.text(
      0, 0, "",
      {
        fontFamily: "system-ui",
        fontSize: "15px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 285 }
      }
    ).setOrigin(0.5);

    this.panel.add(this.panelInfo);

    this.options = [];

    for (let i = 0; i < 4; i++) {
      const btn = this.add.text(
        0, 0, "",
        {
          fontFamily: "system-ui",
          fontSize: "15px",
          color: "#ffffff",
          backgroundColor: "#345f50",
          padding: { x: 12, y: 10 },
          align: "center"
        }
      ).setOrigin(0.5).setInteractive();

      btn.on("pointerdown", () => {
        this.panelAction(i);
      });

      this.options.push(btn);
      this.panel.add(btn);
    }

    this.closeBtn = this.add.text(
      0, 0, "✕ ปิด",
      {
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#98484b",
        padding: { x: 18, y: 10 }
      }
    ).setOrigin(0.5).setInteractive();

    this.closeBtn.on("pointerdown", () => {
      this.closePanel();
    });

    this.panel.add(this.closeBtn);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    const jx = w < 450 ? 85 : 105;
    const ax = w - (w < 450 ? 80 : 105);
    const by = h - 105;

    this.joyBase.setPosition(jx, by);
    this.joyKnob.setPosition(jx, by);
    this.attackBtn.setPosition(ax, by);
    this.attackLabel.setPosition(ax, by);

    this.skillBtn.setPosition(ax - 28, by - 103);
    this.skillLabel.setPosition(ax - 28, by - 103);

    this.talkBtn.setPosition(w / 2, h - 75);
    this.bagBtn.setPosition(w - 68, 150);
    this.potionBtn.setPosition(ax, by - 185);

    this.noticeText.setPosition(w / 2, 175);
    this.bossLabel.setPosition(w / 2, 91);

    const pw = Math.min(w - 24, 380);
    const ph = Math.min(h - 24, 470);
    const cx = w / 2;
    const cy = h / 2;

    this.panelBg.clear();
    this.panelBg.fillStyle(0x111e2e, 0.97);
    this.panelBg.fillRoundedRect(
      cx - pw / 2,
      cy - ph / 2,
      pw, ph, 12
    );

    this.panelBg.lineStyle(3, 0xe1b96d);
    this.panelBg.strokeRoundedRect(
      cx - pw / 2,
      cy - ph / 2,
      pw, ph, 12
    );

    this.panelTitle.setPosition(
      cx, cy - ph / 2 + 36
    );

    this.panelInfo.setPosition(
      cx, cy - ph / 2 + 100
    );

    this.options.forEach((b, i) => {
      b.setPosition(
        cx,
        cy - 48 + i * 58
      );
    });

    this.closeBtn.setPosition(
      cx, cy + ph / 2 - 34
    );
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q,I,F"
    );

    this.input.addPointer(2);

    this.input.on("pointerdown", p => {
      if (this.panelMode) return;

      const w = this.scale.width;
      const h = this.scale.height;

      if (
        p.x < w * 0.47 &&
        p.y > h * 0.45 &&
        this.joyPointer === null
      ) {
        this.joyPointer = p.id;
        this.moveStick(p);
        return;
      }

      if (
        Math.hypot(
          p.x - this.skillBtn.x,
          p.y - this.skillBtn.y
        ) < 44
      ) {
        this.skill();
        return;
      }

      if (
        Math.hypot(
          p.x - this.attackBtn.x,
          p.y - this.attackBtn.y
        ) < 65
      ) {
        this.attackPointer = p.id;
        this.attackHeld = true;
        this.attack();
      }
    });

    this.input.on("pointermove", p => {
      if (p.id === this.joyPointer) {
        this.moveStick(p);
      }
    });

    const release = p => {
      if (p.id === this.joyPointer) {
        this.joyPointer = null;
        this.stick = { x: 0, y: 0 };
        this.joyKnob.setPosition(
          this.joyBase.x, this.joyBase.y
        );
      }

      if (p.id === this.attackPointer) {
        this.attackPointer = null;
        this.attackHeld = false;
      }
    };

    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);

    this.keys.E.on("down", () => {
      if (this.panelMode) return;
      const npc = this.nearestNPC();
      if (npc) this.talk(npc);
    });

    this.keys.Q.on("down", () => {
      if (!this.panelMode) this.usePotion();
    });

    this.keys.I.on("down", () => {
      if (this.panelMode) this.closePanel();
      else this.openPanel("bag");
    });

    this.keys.F.on("down", () => {
      if (!this.panelMode) this.skill();
    });
  }

  moveStick(p) {
    const dx = p.x - this.joyBase.x;
    const dy = p.y - this.joyBase.y;
    const len = Math.hypot(dx, dy);
    const power = Math.min(1, len / 55);

    this.stick = len ? {
      x: dx / len * power,
      y: dy / len * power
    } : { x: 0, y: 0 };

    this.joyKnob.setPosition(
      this.joyBase.x + this.stick.x * 43,
      this.joyBase.y + this.stick.y * 43
    );
  }

  openPanel(mode) {
    this.panelMode = mode;
    this.attackHeld = false;
    this.stick = { x: 0, y: 0 };
    this.joyPointer = null;

    this.joyKnob.setPosition(
      this.joyBase.x, this.joyBase.y
    );

    this.hero.setVelocity(0, 0);
    this.panel.setVisible(true);
    this.refreshPanel();
  }

  closePanel() {
    this.panelMode = "";
    this.panel.setVisible(false);
    this.attackHeld = false;
  }

  refreshPanel() {
    const mode = this.panelMode;
    let title = "";
    let info = "";
    let buttons = [];

    if (mode === "shop") {
      title = "MIRA'S SHOP";
      info = `Gold: ${this.gold}`;

      buttons = [
        "🧪 ยาฟื้น HP +50 - 20 Gold",
        "🧪 ยา 3 ขวด - 50 Gold",
        "❤️ ฟื้น HP เต็ม - 15 Gold"
      ];
    }

    if (mode === "forge") {
      title = "BRON'S FORGE";
      info = `Gold: ${this.gold}\n` +
        `Sword Lv.${this.sword} | Armor Lv.${this.armor}`;

      buttons = [
        `⚔ อัปเกรดดาบ - ${60 * (this.sword + 1)} Gold`,
        `🛡 อัปเกรดเกราะ - ${50 * (this.armor + 1)} Gold`,
        "🔧 ฟื้น HP เต็ม - 10 Gold"
      ];
    }

    if (mode === "quest") {
      title = "ELDER - QUEST";

      if (!this.quest.accepted) {
        info = "ภารกิจ: กำจัด Hellhound 5 ตัว";
        buttons = ["รับภารกิจ"];
      } else if (!this.quest.claimed) {
        info = `กำจัด Hellhound ${Math.min(
          this.quest.kills, 5
        )}/5\nรางวัล: 300 Gold + 200 EXP`;

        buttons = this.quest.kills >= 5
          ? ["รับรางวัล"]
          : ["กำลังทำภารกิจ"];
      } else {
        info = "ทำภารกิจสำเร็จแล้ว!\nมีบอสอยู่ในป่า";
        buttons = ["เรียก Hellhound Alpha"];
      }
    }

    if (mode === "bag") {
      title = "INVENTORY";

      info =
        `LEVEL ${this.level}\n` +
        `HP ${this.hp}/${this.maxHp}\n` +
        `ATK ${18 + this.sword * 8}\n` +
        `ARMOR Lv.${this.armor}\n` +
        `SWORD Lv.${this.sword}\n` +
        `GOLD ${this.gold} | GEMS ${this.gems}\n` +
        `POTIONS ${this.potions}\n` +
        `BOSS WINS ${this.bossWins}`;

      buttons = ["🧪 ใช้ยาฟื้น HP"];
    }

    this.panelTitle.setText(title);
    this.panelInfo.setText(info);

    this.options.forEach((b, i) => {
      b.setVisible(i < buttons.length);
      b.setText(buttons[i] || "");
    });
  }

  panelAction(i) {
    const mode = this.panelMode;

    if (mode === "bag") {
      if (i === 0) this.usePotion();
      this.refreshPanel();
      return;
    }

    if (mode === "quest") {
      if (!this.quest.accepted) {
        this.quest.accepted = true;
        this.notice("รับเควสต์แล้ว!");
      } else if (
        !this.quest.claimed &&
        this.quest.kills >= 5
      ) {
        this.quest.claimed = true;
        this.gold += 300;
        this.gainExp(200);
        this.notice("QUEST COMPLETE!");
      } else if (this.quest.claimed) {
        this.spawnBoss();
        this.closePanel();
        return;
      }

      this.saveGame();
      this.refreshPanel();
      return;
    }

    let cost = 0;

    if (mode === "shop") {
      cost = [20, 50, 15][i];
    } else if (mode === "forge") {
      cost = [
        60 * (this.sword + 1),
        50 * (this.armor + 1),
        10
      ][i];
    }

    if (cost === undefined) return;

    if (this.gold < cost) {
      this.notice("Gold ไม่เพียงพอ");
      return;
    }

    if (
      mode === "forge" &&
      ((i === 0 && this.sword >= 10) ||
       (i === 1 && this.armor >= 10))
    ) {
      this.notice("อัปเกรดสูงสุดแล้ว");
      return;
    }

    this.gold -= cost;

    if (mode === "shop") {
      if (i === 0) this.potions++;
      if (i === 1) this.potions += 3;
      if (i === 2) this.hp = this.maxHp;
    } else {
      if (i === 0) this.sword++;

      if (i === 1) {
        this.armor++;
        this.maxHp += 25;
        this.hp += 25;
      }

      if (i === 2) this.hp = this.maxHp;
    }

    this.saveGame();
    this.refreshPanel();
    this.notice("สำเร็จ!");
  }

  usePotion() {
    if (this.potions <= 0) {
      this.notice("ไม่มียา");
      return;
    }

    if (this.hp >= this.maxHp) {
      this.notice("HP เต็มแล้ว");
      return;
    }

    this.potions--;
    this.hp = Math.min(this.maxHp, this.hp + 50);
    this.saveGame();
    this.notice("ฟื้น HP +50");
  }

  notice(text) {
    this.noticeText.setText(text);
    this.noticeText.setVisible(true);
    this.noticeText.setAlpha(1);

    this.tweens.killTweensOf(this.noticeText);

    this.tweens.add({
      targets: this.noticeText,
      alpha: 0,
      delay: 1300,
      duration: 350,
      onComplete: () => {
        this.noticeText.setVisible(false);
      }
    });
  }

  spawnEnemy(isBoss = false) {
    let x, y;
    let found = false;

    for (let i = 0; i < 60; i++) {
      x = P.Math.Between(70, WORLD.w - 70);
      y = P.Math.Between(70, WORLD.h - 70);

      if (this.safe(x, y, isBoss ? 200 : 100))
        continue;

      if (!this.walkable(x, y, isBoss ? 85 : 35))
        continue;

      if (
        Math.hypot(
          x - this.hero.x,
          y - this.hero.y
        ) < 250
      ) continue;

      found = true;
      break;
    }

    if (!found) return null;

    const roll = Math.random();

    const type = isBoss || roll < 0.35
      ? "hellhound"
      : roll < 0.8 ? "slime" : "boar";

    const texture = type === "hellhound"
      ? (
        this.textures.exists("hellhound_idle")
          ? "hellhound_idle"
          : "fallback_hell"
      )
      : this.tex(`${type}_0`);

    const s = this.physics.add.sprite(
      x, y, texture
    ).setOrigin(0.5, 1);

    const height = isBoss ? 210 :
      type === "hellhound" ? 100 :
      type === "boar" ? 90 : 76;

    s.setDisplaySize(
      s.width * height / s.height,
      height
    );

    s.setCollideWorldBounds(true);

    s.body.setSize(
      s.width * 0.48,
      s.height * 0.16
    );

    s.body.setOffset(
      s.width * 0.26,
      s.height * 0.80
    );

    this.physics.add.collider(s, this.walls);

    const hp = isBoss ? 2200 :
      type === "hellhound" ? 125 :
      type === "boar" ? 85 : 45;

    const m = {
      type,
      boss: isBoss,
      s,
      hp,
      maxHp: hp,
      speed: isBoss ? 72 :
        type === "hellhound" ? 125 : 85,
      dead: false,
      state: "idle",
      anim: "",
      lastAttack: 0,
      attackAt: 0,
      attackEnd: 0,
      attackDone: false,
      attackCount: 0,
      stun: 0,
      knockX: 0,
      knockY: 0,
      steerX: 0,
      steerY: 0,
      nextAI: 0,
      frame: 0,
      lastFrame: 0,
      shadow: this.add.ellipse(
        x, y, isBoss ? 100 : 45,
        13, 0x10251b, 0.4
      ),
      bar: this.add.graphics()
    };

    this.enemies.push(m);

    if (type === "hellhound") {
      this.playEnemy(m, "idle");
    }

    return m;
  }

  spawnBoss() {
    if (this.boss && !this.boss.dead) {
      this.notice("บอสยังอยู่ในแผนที่");
      return;
    }

    this.boss = this.spawnEnemy(true);

    if (this.boss) {
      this.notice("HELLHOUND ALPHA ปรากฏตัว!");
      this.cameras.main.shake(180, 0.004);
    }
  }

  gainExp(amount) {
    this.exp += amount;

    while (this.exp >= this.level * 50) {
      this.exp -= this.level * 50;
      this.level++;
      this.hp = Math.min(
        this.maxHp, this.hp + 30
      );
      this.notice(`LEVEL UP! Lv.${this.level}`);
    }
  }

  floatText(x, y, text, color) {
    const t = this.add.text(
      x, y, text,
      {
        fontFamily: "system-ui",
        fontSize: "23px",
        fontStyle: "bold",
        color,
        stroke: "#241a18",
        strokeThickness: 5
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: t,
      y: y - 54,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy()
    });
  }

  sparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = P.Math.Between(24, 75);

      const p = this.add.circle(
        x, y, P.Math.Between(2, 5), color
      ).setDepth(15000);

      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: P.Math.Between(170, 380),
        onComplete: () => p.destroy()
      });
    }
  }

  hitEnemy(m, damage, dx, dy) {
    if (m.dead) return;

    m.hp -= damage;
    m.stun = this.time.now + 180;
    m.knockX = dx * (m.boss ? 100 : 260);
    m.knockY = dy * (m.boss ? 100 : 260);

    m.s.setTintFill(0xffffff);

    this.floatText(
      m.s.x,
      m.s.y - m.s.displayHeight - 12,
      `-${damage}`,
      damage >= 45 ? "#ffcf69" : "#ffffff"
    );

    this.sparks(
      m.s.x, m.s.y - 35,
      0xffc04a, 8
    );

    if (m.hp <= 0) {
      this.killEnemy(m);
    } else if (m.type === "hellhound") {
      this.playEnemy(m, "hurt", true);
    }
  }

  killEnemy(m) {
    if (m.dead) return;

    m.dead = true;
    m.state = "dead";
    m.s.setVelocity(0, 0);
    m.s.body.enable = false;
    m.bar.clear();

    this.kills++;

    this.gainExp(
      m.boss ? 500 :
      m.type === "hellhound" ? 35 : 15
    );

    if (
      m.type === "hellhound" &&
      !m.boss &&
      this.quest.accepted &&
      !this.quest.claimed
    ) {
      this.quest.kills++;
    }

    if (m.boss) {
      this.bossWins++;
      this.gold += 500;
      this.gems += 10;
      this.notice("BOSS DEFEATED! +500 Gold");
      this.cameras.main.flash(
        220, 255, 180, 60
      );
    }

    const finish = () => {
      if (!m.s.active) return;

      const x = m.s.x;
      const y = m.s.y;

      m.s.destroy();
      m.shadow.destroy();
      m.bar.destroy();

      this.enemies = this.enemies.filter(
        e => e !== m
      );

      const count = m.boss ? 14 :
        m.type === "hellhound" ? 5 : 3;

      for (let i = 0; i < count; i++) {
        const gem = Math.random() < 0.17;

        const obj = this.add.image(
          x + P.Math.Between(-45, 45),
          y + P.Math.Between(-25, 25),
          gem ? "gem" : "coin"
        ).setDepth(y + 2);

        this.drops.push({ obj, gem });
      }

      this.saveGame();
    };

    if (
      m.type === "hellhound" &&
      this.anims.exists("e_die")
    ) {
      this.playEnemy(m, "die", true);

      m.s.once(
        P.Animations.Events.ANIMATION_COMPLETE,
        finish
      );

      this.time.delayedCall(850, finish);
    } else {
      finish();
    }
  }

  facing(x, y) {
    return Math.abs(x) > Math.abs(y)
      ? (x < 0 ? "left" : "right")
      : (y < 0 ? "up" : "down");
  }

  vector(dir) {
    return {
      down: [0, 1],
      up: [0, -1],
      left: [-1, 0],
      right: [1, 0]
    }[dir];
  }

  slash(x, y, dir, combo) {
    const g = this.add.graphics()
      .setPosition(x, y - 40)
      .setDepth(15000);

    const angle = {
      right: 0,
      left: Math.PI,
      down: Math.PI / 2,
      up: -Math.PI / 2
    }[dir];

    const radius = combo === 3 ? 105 : 76;

    g.lineStyle(
      combo === 3 ? 17 : 12,
      combo === 3 ? 0xff9b2d : 0x7cddff,
      0.85
    );

    g.beginPath();
    g.arc(
      0, 0, radius,
      angle - 1.15,
      angle + 1.15
    );
    g.strokePath();

    g.lineStyle(5, 0xffffff);
    g.beginPath();
    g.arc(
      0, 0, radius,
      angle - 1.15,
      angle + 1.15
    );
    g.strokePath();

    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 220,
      onComplete: () => g.destroy()
    });

    this.sparks(
      x, y - 40,
      combo === 3 ? 0xffa12a : 0x8feeff,
      10
    );
  }

  attack() {
    const now = this.time.now;

    if (
      this.panelMode ||
      this.attacking ||
      now - this.lastAttack < 290
    ) return;

    this.combo = now < this.comboExpire
      ? this.combo % 3 + 1 : 1;

    this.comboExpire = now + 1050;
    this.lastAttack = now;
    this.attacking = true;
    this.attackDir = this.dir;
    this.hitDone = false;

    this.attackAt = now +
      (this.combo === 3 ? 220 : 125);

    this.attackEnd = now +
      (this.combo === 3 ? 480 : 335);

    this.playHero(
      "attack", this.attackDir, true
    );
  }

  resolveAttack() {
    const [dx, dy] = this.vector(
      this.attackDir
    );

    this.slash(
      this.hero.x + dx * 48,
      this.hero.y + dy * 26,
      this.attackDir,
      this.combo
    );

    const range = this.combo === 3 ? 175 : 125;

    for (const m of [...this.enemies]) {
      if (m.dead) continue;

      const ex = m.s.x - this.hero.x;
      const ey = m.s.y - this.hero.y;
      const dist = Math.hypot(ex, ey);

      if (
        dist > range ||
        dist < 1 ||
        ex * dx + ey * dy < -10 ||
        Math.abs(ex * dy - ey * dx) >
          (this.combo === 3 ? 125 : 80)
      ) continue;

      const damage = (
        this.combo === 3 ? 44 :
        this.combo === 2 ? 26 : 18
      ) + this.sword * 8;

      this.hitEnemy(m, damage, dx, dy);
    }

    if (this.combo === 3) {
      this.cameras.main.shake(90, 0.003);
    }
  }

  skill() {
    const now = this.time.now;

    if (
      this.panelMode ||
      now - this.lastSkill < 4000
    ) return;

    this.lastSkill = now;

    const ring = this.add.circle(
      this.hero.x,
      this.hero.y - 28,
      22,
      0xff7426,
      0.15
    ).setStrokeStyle(9, 0xffbd4e)
      .setDepth(15000);

    this.tweens.add({
      targets: ring,
      scaleX: 10,
      scaleY: 10,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy()
    });

    this.sparks(
      this.hero.x,
      this.hero.y - 30,
      0xffb13a,
      30
    );

    this.cameras.main.shake(160, 0.004);

    for (const m of [...this.enemies]) {
      if (m.dead) continue;

      const dx = m.s.x - this.hero.x;
      const dy = m.s.y - this.hero.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 230) {
        this.hitEnemy(
          m,
          65 + this.sword * 12,
          dist ? dx / dist : 1,
          dist ? dy / dist : 0
        );
      }
    }
  }

  hurtHero(damage) {
    const now = this.time.now;

    if (
      now - this.lastHurt < 550 ||
      this.safe(this.hero.x, this.hero.y)
    ) return;

    this.lastHurt = now;
    this.hp = Math.max(0, this.hp - damage);
    this.hero.setTintFill(0xff7777);

    this.time.delayedCall(140, () => {
      if (this.hero.active) {
        this.hero.clearTint();
      }
    });

    this.floatText(
      this.hero.x,
      this.hero.y - 120,
      `-${damage}`,
      "#ff7a7a"
    );
  }

  updateEnemies(now) {
    for (const m of [...this.enemies]) {
      if (m.dead) continue;

      const s = m.s;
      const dx = this.hero.x - s.x;
      const dy = this.hero.y - s.y;
      const dist = Math.hypot(dx, dy);

      const heroSafe = this.safe(
        this.hero.x, this.hero.y, 10
      );

      if (m.type === "hellhound") {
        s.setFlipX(this.hero.x < s.x);
      }

      if (now < m.stun) {
        s.setVelocity(m.knockX, m.knockY);
        m.knockX *= 0.86;
        m.knockY *= 0.86;
      } else if (
        m.state === "attack" &&
        now < m.attackEnd
      ) {
        s.setVelocity(0, 0);

        if (
          !m.attackDone &&
          now >= m.attackAt
        ) {
          m.attackDone = true;

          this.sparks(
            s.x, s.y - 35,
            0xff7426,
            m.boss ? 20 : 9
          );

          if (
            dist < (m.boss ? 150 : 83) &&
            !heroSafe
          ) {
            this.hurtHero(
              m.boss ? 22 : 9
            );
          }
        }
      } else {
        m.state = "idle";

        if (now >= m.nextAI) {
          m.nextAI = now + 180;

          if (
            heroSafe ||
            dist > 410 ||
            dist < (m.boss ? 115 : 65)
          ) {
            m.steerX = 0;
            m.steerY = 0;
          } else {
            const ux = dx / dist;
            const uy = dy / dist;

            const options = [
              [ux, uy],
              [-uy, ux],
              [uy, -ux],
              [-ux, -uy]
            ];

            let chosen = [0, 0];

            for (const [vx, vy] of options) {
              const tx = s.x + vx * 65;
              const ty = s.y + vy * 65;

              if (
                this.walkable(tx, ty, 25) &&
                !this.safe(tx, ty, 15)
              ) {
                chosen = [vx, vy];
                break;
              }
            }

            m.steerX = chosen[0];
            m.steerY = chosen[1];
          }
        }

        s.setVelocity(
          m.steerX * m.speed,
          m.steerY * m.speed
        );

        if (
          !heroSafe &&
          dist < (m.boss ? 140 : 78) &&
          now - m.lastAttack >
            (m.boss ? 1350 : 1800)
        ) {
          m.lastAttack = now;
          m.attackAt = now + 340;
          m.attackEnd = now + 690;
          m.attackDone = false;
          m.state = "attack";
          m.attackCount++;

          this.playEnemy(
            m,
            m.attackCount % 2
              ? "attack_1"
              : "attack_2",
            true
          );
        } else if (m.type === "hellhound") {
          this.playEnemy(
            m,
            dist < 400 && !heroSafe
              ? "run" : "idle"
          );
        }
      }

      if (
        m.type !== "hellhound" &&
        now - m.lastFrame > 180
      ) {
        m.lastFrame = now;
        m.frame = (m.frame + 1) % 4;

        s.setTexture(
          this.tex(`${m.type}_${m.frame}`)
        );
        s.setDisplaySize(82, 74);
      }

      if (now > m.stun) {
        s.clearTint();
      }

      s.setDepth(s.y);

      m.shadow.setPosition(s.x, s.y);
      m.shadow.setDepth(s.y - 1);

      m.bar.clear();

      if (dist < 450 || m.boss) {
        const bw = m.boss ? 100 : 55;
        const by = s.y - s.displayHeight - 12;

        m.bar.fillStyle(0x17221c);
        m.bar.fillRect(
          s.x - bw / 2, by, bw, 9
        );

        m.bar.fillStyle(
          m.boss ? 0xff8c32 : 0xe34b48
        );

        m.bar.fillRect(
          s.x - bw / 2 + 1,
          by + 1,
          (bw - 2) * Math.max(0, m.hp / m.maxHp),
          7
        );

        m.bar.setDepth(s.y + 1);
      }

      if (
        m.type !== "hellhound" &&
        !heroSafe &&
        dist < 50 &&
        now - m.lastAttack > 1500
      ) {
        m.lastAttack = now;

        this.hurtHero(
          m.type === "boar" ? 6 : 4
        );
      }
    }
  }

  updateHUD() {
    const w = this.scale.width;
    const bw = Math.min(
      310, Math.max(145, w - 120)
    );

    this.hud.clear();

    this.hud.fillStyle(0x142335, 0.93);
    this.hud.fillRoundedRect(
      8, 8, bw, 94, 8
    );

    this.hud.lineStyle(2, 0xd2a35b);
    this.hud.strokeRoundedRect(
      8, 8, bw, 94, 8
    );

    this.hud.fillStyle(0x512f33);
    this.hud.fillRect(15, 40, bw - 15, 12);

    this.hud.fillStyle(0xe35350);
    this.hud.fillRect(
      15, 40,
      (bw - 15) * this.hp / this.maxHp,
      12
    );

    this.hud.fillStyle(0x243a51);
    this.hud.fillRect(15, 61, bw - 15, 7);

    this.hud.fillStyle(0x55b8f5);
    this.hud.fillRect(
      15, 61,
      (bw - 15) * this.exp /
        (this.level * 50),
      7
    );

    this.hudText.setText(
      `LV.${this.level} HP ${this.hp}/${this.maxHp}\n` +
      `\n\nGold ${this.gold} Gem ${this.gems}` +
      ` ATK ${18 + this.sword * 8}`
    );

    this.potionBtn.setText(
      `🧪 ${this.potions}`
    );

    this.bossBar.clear();

    if (this.boss && !this.boss.dead) {
      this.bossLabel.setVisible(true);

      const width = Math.min(w - 70, 430);
      const x = (w - width) / 2;

      this.bossBar.fillStyle(0x221b1b, 0.9);
      this.bossBar.fillRoundedRect(
        x, 112, width, 16, 5
      );

      this.bossBar.fillStyle(0xf06535);
      this.bossBar.fillRoundedRect(
        x + 2, 114,
        (width - 4) * Math.max(
          0,
          this.boss.hp / this.boss.maxHp
        ),
        12, 4
      );
    } else {
      this.bossLabel.setVisible(false);
    }
  }

  update(now, delta) {
    const dt = Math.min(delta / 1000, 0.05);

    let x = this.stick.x;
    let y = this.stick.y;

    if (!this.panelMode) {
      x += Number(
        this.keys.D.isDown ||
        this.keys.RIGHT.isDown
      ) - Number(
        this.keys.A.isDown ||
        this.keys.LEFT.isDown
      );

      y += Number(
        this.keys.S.isDown ||
        this.keys.DOWN.isDown
      ) - Number(
        this.keys.W.isDown ||
        this.keys.UP.isDown
      );
    } else {
      x = 0;
      y = 0;
    }

    const length = Math.hypot(x, y);

    if (length > 1) {
      x /= length;
      y /= length;
    }

    const speed = this.attacking ? 105 : 220;

    this.hero.setVelocity(
      x * speed,
      y * speed
    );

    if (this.attacking) {
      if (
        !this.hitDone &&
        now >= this.attackAt
      ) {
        this.hitDone = true;
        this.resolveAttack();
      }

      if (now >= this.attackEnd) {
        this.attacking = false;
        this.heroAction = "";
      }
    }

    if (!this.attacking) {
      this.playHero(
        length > 0.1 ? "walk" : "idle",
        length > 0.1
          ? this.facing(x, y)
          : this.dir
      );
    }

    this.hero.setDepth(this.hero.y);

    this.shadow.setPosition(
      this.hero.x, this.hero.y
    );
    this.shadow.setDepth(this.hero.y - 1);

    if (
      !this.panelMode &&
      (this.attackHeld || this.keys.SPACE.isDown) &&
      !this.attacking &&
      now - this.lastAttack > 290
    ) {
      this.attack();
    }

    this.updateEnemies(now);

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const obj = drop.obj;

      const dx = this.hero.x - obj.x;
      const dy = this.hero.y - obj.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 140) {
        obj.x += dx * Math.min(1, dt * 8);
        obj.y += dy * Math.min(1, dt * 8);
      }

      if (dist < 25) {
        if (drop.gem) this.gems++;
        else this.gold += 5;

        obj.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (
      this.enemies.filter(m => !m.boss).length < 14 &&
      now - this.lastSpawn > 1200
    ) {
      this.lastSpawn = now;
      this.spawnEnemy();
    }

    if (this.hp <= 0) {
      this.hp = this.maxHp;

      this.hero.setPosition(
        HOME.x, HOME.y + 95
      );

      this.cameras.main.flash(
        250, 240, 75, 75
      );

      this.notice("กลับมาที่หมู่บ้านแล้ว");
    }

    if (now - this.lastSave > 10000) {
      this.lastSave = now;
      this.saveGame();
    }

    this.updateHUD();
  }
}

new P.Game({
  type: P.AUTO,
  parent: "game",
  backgroundColor: "#172b3a",

  scale: {
    mode: P.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: P.Scale.CENTER_BOTH
  },

  render: {
    pixelArt: true,
    antialias: false,
    roundPixels true
  },

  fps: {
    target: 60
  },

  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },

  scene: [Game]
});
