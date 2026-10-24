
/*
 QUARTER RPG V2.0
 Loot & Gear Update — ของดรอปมีแสงตามระดับ, การ์ดไอเทม,
 ตีบวก +10, โบนัสพิเศษ Artifact, AUTO battle
 Phaser 3 | src/main.js (+ src/gear.js, src/ui.js)
*/

import {
  RARITIES, SLOTS, DROP_TABLE, MAX_ENHANCE,
  makeItem, rollRarity, heroStats, itemPower,
  itemFullName, sellPrice, enhanceCost, drawIcon
} from "./gear.js";
import { GameUI } from "./ui.js";

const Phaser3 = window.Phaser;
if (!Phaser3) throw new Error("Phaser 3 not loaded");

const WORLD_W = 2000;
const WORLD_H = 1500;
const SAVE_KEY = "quarter-rpg-v2";
const OLD_SAVE_KEY = "quarter-rpg-v15";
const BAG_SIZE = 60;
const VILLAGE = { x: 1000, y: 750, r: 310 };

class QuarterRPG extends Phaser3.Scene {
  constructor() {
    super("QuarterRPG");
  }

  preload() {
    for (const action of ["idle", "walk", "attack"]) {
      for (const dir of ["down", "up", "left", "right"]) {
        const key = `hero_${action}_${dir}`;
        this.load.spritesheet(key, `assets/${key}.png`, {
          frameWidth: 256,
          frameHeight: 288
        });
      }
    }

    for (const [name, count] of Object.entries({
      idle: 8, walk: 8, run: 8,
      attack_1: 8, attack_2: 8,
      hurt: 4, die: 8
    })) {
      this.load.spritesheet(
        `hellhound_${name}`,
        `assets/hellhound_${name}.png`,
        { frameWidth: 176, frameHeight: 146 }
      );
    }

    for (const type of ["slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `${type}_${i}`,
          `assets/${type}_${i}.png`
        );
      }
    }

    for (const key of [
      "grass", "water", "tree", "bush",
      "rock", "flower", "stump"
    ]) {
      this.load.image(key, `assets/${key}.png`);
    }

    this.load.on("loaderror", file => {
      console.warn("Asset missing:", file.key);
    });
  }

  create() {
    this.physics.world.setBounds(
      0, 0, WORLD_W, WORLD_H
    );

    this.makeGraphics();
    this.makeLootTextures();
    this.makeAnimations();
    this.readSave();

    this.enemies = [];
    this.drops = [];
    this.loot = [];
    this.obstacles = [];
    this.npcs = [];
    this.boss = null;
    this.walls = this.physics.add.staticGroup();

    this.drawWorld();
    this.drawVillage();

    const heroKey = this.textures.exists("hero_idle_down")
      ? "hero_idle_down" : "fallback_hero";

    this.hero = this.physics.add.sprite(
      1000, 850, heroKey
    ).setOrigin(0.5, 1);

    this.hero.setDisplaySize(78, 88);
    this.hero.setCollideWorldBounds(true);
    this.hero.body.setSize(
      this.hero.width * 0.35,
      this.hero.height * 0.12
    );
    this.hero.body.setOffset(
      this.hero.width * 0.325,
      this.hero.height * 0.85
    );

    this.physics.add.collider(this.hero, this.walls);

    this.shadow = this.add.ellipse(
      this.hero.x, this.hero.y,
      45, 12, 0x10251a, 0.4
    );

    this.direction = "down";
    this.currentAnimation = "";
    this.attacking = false;
    this.combo = 0;
    this.comboUntil = 0;
    this.attackTime = 0;
    this.attackEnd = 0;
    this.attackHit = false;
    this.lastAttack = -9999;
    this.lastSkill = -9999;
    this.lastHurt = -9999;
    this.lastSpawn = 0;
    this.lastSave = 0;
    this.frenzyUntil = 0;
    this.attackCounter = 0;
    this.autoTarget = null;
    this.autoWander = null;
    this.autoStuck = { x: 0, y: 0, t: 0, until: 0, dir: null };
    this.lastAutoPotion = 0;

    this.stick = { x: 0, y: 0 };
    this.stickPointer = null;
    this.attackPointer = null;
    this.attackHeld = false;
    this.panelMode = null;

    this.cameras.main
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .startFollow(this.hero, true, 0.12, 0.12)
      .setRoundPixels(true);

    this.recalcStats();
    this.hp = Math.min(this.hp, this.maxHp);

    this.createUI();
    this.ui = new GameUI(this);
    this.ui.setAuto(this.auto);
    this.createInput();
    this.resizeUI();

    this.frenzyAura = this.add.ellipse(
      0, 0, 70, 22, 0xff8a1e, 0.55
    ).setBlendMode(Phaser3.BlendModes.ADD)
      .setVisible(false);

    this.scale.on("resize", this.resizeUI, this);

    for (let i = 0; i < 12; i++) {
      this.spawnEnemy();
    }

    this.animateHero("idle", "down");
    this.message("GREENHAVEN — หมู่บ้านเริ่มต้น");
  }

  texture(key) {
    return this.textures.exists(key)
      ? key : `fallback_${key}`;
  }

  makeGraphics() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const rect = (color, x, y, w, h) => {
      g.fillStyle(color);
      g.fillRect(x, y, w, h);
    };

    const ellipse = (color, x, y, w, h) => {
      g.fillStyle(color);
      g.fillEllipse(x, y, w, h);
    };

    const save = (key, w, h) => {
      g.generateTexture(key, w, h);
      g.clear();
    };

    // Invisible collision texture
    rect(0xffffff, 0, 0, 2, 2);
    save("collision_pixel", 2, 2);

    // Detailed grass
    rect(0x407a48, 0, 0, 64, 64);

    for (let i = 0; i < 48; i++) {
      const x = (i * 29 + 7) % 64;
      const y = (i * 37 + 13) % 64;

      rect(
        i % 3 ? 0x519457 : 0x32683b,
        x, y, 3 + i % 3, 2
      );
    }

    save("fallback_grass", 64, 64);

    // Water
    rect(0x226b95, 0, 0, 64, 64);

    for (let y = 9; y < 64; y += 18) {
      rect(0x399cbd, 8, y, 28, 3);
      rect(0x69c5d8, 39, y + 5, 15, 2);
    }

    save("fallback_water", 64, 64);

    // Tree
    rect(0x342a23, 28, 42, 15, 34);
    rect(0x855430, 33, 45, 5, 28);
    ellipse(0x173e2c, 34, 35, 64, 63);
    ellipse(0x276e3d, 30, 29, 58, 55);
    ellipse(0x429a54, 20, 20, 35, 32);
    ellipse(0x6ab96a, 44, 25, 25, 25);
    rect(0xa5d987, 20, 13, 8, 4);
    save("fallback_tree", 64, 80);

    // Bush
    ellipse(0x173e30, 32, 49, 60, 33);
    ellipse(0x267642, 22, 36, 37, 40);
    ellipse(0x419b52, 44, 35, 37, 37);
    ellipse(0x75bf68, 29, 25, 29, 20);
    save("fallback_bush", 64, 80);

    // Rock
    ellipse(0x33484b, 32, 47, 59, 35);
    ellipse(0x798c8d, 31, 35, 57, 40);
    ellipse(0xa9b6ae, 24, 28, 35, 20);
    rect(0xd0d0bd, 16, 21, 14, 5);
    save("fallback_rock", 64, 80);

    // Flower
    rect(0x236c37, 30, 30, 5, 29);
    for (const [x, y] of [
      [26, 24], [37, 24], [31, 18], [31, 32]
    ]) {
      ellipse(0xffd675, x, y, 15, 15);
    }
    ellipse(0xf08852, 31, 25, 10, 10);
    save("fallback_flower", 64, 80);

    // Stump
    ellipse(0x3b3027, 32, 48, 50, 32);
    rect(0x6d472d, 11, 25, 43, 31);
    ellipse(0xc39359, 32, 27, 49, 20);
    ellipse(0x7a5237, 32, 27, 29, 12);
    save("fallback_stump", 64, 80);

    // Monster fallbacks
    for (const [type, color] of [
      ["slime", 0x50cf70],
      ["boar", 0x996343]
    ]) {
      for (let i = 0; i < 4; i++) {
        ellipse(0x24372a, 32, 47, 59, 34);
        ellipse(color, 32, 35 + i % 2, 55, 37);
        rect(0x161c1a, 22, 29, 5, 6);
        rect(0x161c1a, 41, 29, 5, 6);
        save(`fallback_${type}_${i}`, 64, 64);
      }
    }

    // Hellhound fallback
    ellipse(0x26252b, 85, 98, 106, 60);
    ellipse(0x26252b, 125, 73, 64, 54);
    rect(0xff7426, 127, 64, 10, 7);
    rect(0xff7426, 45, 121, 16, 8);
    rect(0xff7426, 112, 121, 16, 8);
    save("fallback_hellhound", 176, 146);

    // Hero fallback
    rect(0x202b44, 23, 37, 30, 53);
    rect(0xf3c69a, 26, 13, 24, 28);
    rect(0x39251f, 23, 8, 30, 12);
    rect(0x243246, 26, 90, 10, 24);
    rect(0x243246, 42, 90, 10, 24);
    rect(0xf3e5a1, 58, 39, 5, 63);
    save("fallback_hero", 80, 120);

    // NPC sprites
    for (let i = 0; i < 3; i++) {
      const coat = [
        0x3b936a, 0x98704a, 0x526fa3
      ][i];

      const trim = [
        0xd1e5b3, 0xffcb72, 0xbac8e9
      ][i];

      rect(0x211f29, 15, 38, 38, 59);
      rect(coat, 19, 41, 30, 48);
      rect(trim, 19, 59, 30, 5);
      rect(0x1d2632, 19, 89, 12, 24);
      rect(0x1d2632, 38, 89, 12, 24);
      rect(0x382b27, 17, 107, 15, 7);
      rect(0x382b27, 38, 107, 15, 7);
      rect(0xe9b98d, 21, 19, 27, 24);
      rect(0x322824, 18, 11, 32, 13);
      rect(0x241d20, 26, 30, 3, 3);
      rect(0x241d20, 40, 30, 3, 3);
      rect(trim, 16, 43, 5, 24);
      rect(trim, 48, 43, 5, 24);

      if (i === 1) {
        rect(0x4d4037, 16, 7, 36, 10);
        rect(0xf4b34f, 20, 7, 28, 4);
      }

      save(`npc_${i}`, 68, 120);
    }

    // Detailed village houses
    for (let i = 0; i < 3; i++) {
      const roof = [
        0x9c453e, 0x446c9d, 0x74533d
      ][i];

      const highlight = [
        0xd57960, 0x729ac6, 0xac8061
      ][i];

      ellipse(0x244a36, 115, 183, 220, 27);
      rect(0x473629, 19, 77, 192, 104);
      rect(0xd6b889, 24, 81, 182, 95);

      for (let y = 89; y < 176; y += 17) {
        rect(0xbe9b73, 25, y, 180, 3);
      }

      rect(0x392e2b, 91, 126, 49, 55);
      rect(0x76523a, 96, 132, 39, 49);
      rect(0xe5bb75, 126, 151, 5, 6);

      for (const x of [37, 160]) {
        rect(0x3b342f, x - 4, 109, 41, 42);
        rect(0x75a9b7, x, 113, 33, 33);
        rect(0xd0d4b2, x + 15, 113, 3, 33);
        rect(0xd0d4b2, x, 128, 33, 3);
      }

      g.fillStyle(0x332c2d);
      g.fillPoints([
        { x: 2, y: 82 },
        { x: 115, y: 4 },
        { x: 228, y: 82 }
      ], true);

      g.fillStyle(roof);
      g.fillPoints([
        { x: 9, y: 75 },
        { x: 115, y: 10 },
        { x: 221, y: 75 }
      ], true);

      for (let row = 0; row < 5; row++) {
        const yy = 26 + row * 10;
        const half = 18 + row * 19;

        for (
          let xx = 115 - half;
          xx < 115 + half;
          xx += 17
        ) {
          rect(
            highlight,
            xx + (row % 2) * 7,
            yy, 12, 3
          );
        }
      }

      rect(0x46372e, 77, 85, 76, 21);
      rect(0xe5b968, 82, 89, 66, 13);
      save(`house_${i}`, 230, 190);
    }

    ellipse(0xf7d35a, 12, 12, 20, 20);
    save("coin", 24, 24);

    g.fillStyle(0x5bd9ff);
    g.fillPoints([
      { x: 12, y: 1 },
      { x: 23, y: 12 },
      { x: 12, y: 23 },
      { x: 1, y: 12 }
    ], true);
    save("gem", 24, 24);

    g.destroy();
  }

  makeLootTextures() {
    // Light pillar: bright core, soft edges, fades out at the top
    const w = 48, h = 256;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    const hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, "rgba(255,255,255,0)");
    hg.addColorStop(0.35, "rgba(255,255,255,0.55)");
    hg.addColorStop(0.5, "rgba(255,255,255,1)");
    hg.addColorStop(0.65, "rgba(255,255,255,0.55)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "destination-in";
    const vg = ctx.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.6, "rgba(0,0,0,0.7)");
    vg.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    this.textures.addCanvas("loot_beam", c);

    // Soft round glow
    const gc = document.createElement("canvas");
    gc.width = gc.height = 64;
    const gctx = gc.getContext("2d");
    const rg = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    gctx.fillStyle = rg;
    gctx.fillRect(0, 0, 64, 64);
    this.textures.addCanvas("loot_glow", gc);

    // Item icons for every slot × rarity
    for (const slot of SLOTS) {
      for (let r = 0; r < RARITIES.length; r++) {
        this.textures.addCanvas(
          `icon_${slot.id}_${r}`,
          drawIcon(slot.id, r, 3)
        );
      }
    }
  }

  makeAnimations() {
    for (const action of ["idle", "walk", "attack"]) {
      for (const dir of ["down", "up", "left", "right"]) {
        const key = `hero_${action}_${dir}`;
        if (!this.textures.exists(key)) continue;

        this.anims.create({
          key: `heroAnim_${action}_${dir}`,
          frames: this.anims.generateFrameNumbers(
            key, { start: 0, end: 7 }
          ),
          frameRate: action === "attack" ? 16 :
            action === "walk" ? 11 : 5,
          repeat: action === "attack" ? 0 : -1
        });
      }
    }

    const hell = {
      idle: 8, walk: 8, run: 8,
      attack_1: 8, attack_2: 8,
      hurt: 4, die: 8
    };

    for (const [action, count] of Object.entries(hell)) {
      const key = `hellhound_${action}`;
      if (!this.textures.exists(key)) continue;

      this.anims.create({
        key: `hellAnim_${action}`,
        frames: this.anims.generateFrameNumbers(
          key, { start: 0, end: count - 1 }
        ),
        frameRate: action === "idle" ? 5 : 12,
        repeat: ["idle", "walk", "run"].includes(action)
          ? -1 : 0
      });
    }
  }

  animateHero(action, dir, force = false) {
    const key = `heroAnim_${action}_${dir}`;

    if (
      !force &&
      this.currentAnimation === key &&
      this.hero.anims.isPlaying
    ) return;

    this.currentAnimation = key;
    this.direction = dir;

    if (this.anims.exists(key)) {
      this.hero.play(key, true);
    } else {
      this.hero.setTexture("fallback_hero");
    }
  }

  animateEnemy(enemy, action, force = false) {
    if (enemy.type !== "hellhound") return;

    const key = `hellAnim_${action}`;
    if (!this.anims.exists(key)) return;

    if (
      !force &&
      enemy.animation === action &&
      enemy.sprite.anims.isPlaying
    ) return;

    enemy.animation = action;
    enemy.sprite.play(key, true);
  }

  addWall(x, y, w, h) {
    this.obstacles.push({ x, y, w, h });

    const wall = this.walls.create(
      x, y, "collision_pixel"
    );

    wall.setDisplaySize(w, h);
    wall.refreshBody();
    wall.setVisible(false);
  }

  canWalk(x, y, r = 20) {
    if (
      x < r || y < r ||
      x > WORLD_W - r ||
      y > WORLD_H - r
    ) return false;

    return !this.obstacles.some(b =>
      Math.abs(x - b.x) < b.w / 2 + r &&
      Math.abs(y - b.y) < b.h / 2 + r
    );
  }

  isSafe(x, y, extra = 0) {
    return Math.hypot(
      x - VILLAGE.x,
      y - VILLAGE.y
    ) < VILLAGE.r + extra;
  }

  drawWorld() {
    this.add.tileSprite(
      WORLD_W / 2,
      WORLD_H / 2,
      WORLD_W,
      WORLD_H,
      this.texture("grass")
    ).setDepth(-10000);

    this.add.tileSprite(
      1640, 300, 300, 600,
      this.texture("water")
    ).setDepth(-9998);

    this.addWall(1640, 100, 300, 200);
    this.addWall(1640, 480, 300, 240);

    const bridge = this.add.graphics()
      .setDepth(-9997);

    bridge.fillStyle(0x705034);
    bridge.fillRect(1450, 200, 400, 120);

    for (let x = 1455; x < 1840; x += 28) {
      bridge.lineStyle(3, 0x30241e);
      bridge.lineBetween(x, 200, x, 320);
    }

    const placed = [];

    for (let i = 0; i < 160; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = Phaser3.Math.Between(
          75, WORLD_W - 75
        );
        const y = Phaser3.Math.Between(
          70, WORLD_H - 70
        );

        if (this.isSafe(x, y, 120)) continue;
        if (x > 1450 && x < 1850 && y < 610) continue;
        if (!this.canWalk(x, y, 60)) continue;

        if (placed.some(p =>
          Math.hypot(x - p.x, y - p.y) < 85
        )) continue;

        const r = Math.random();
        const type = r < 0.36 ? "tree" :
          r < 0.58 ? "bush" :
          r < 0.75 ? "rock" :
          r < 0.91 ? "flower" : "stump";

        const image = this.add.image(
          x, y, this.texture(type)
        ).setOrigin(0.5, 1);

        const height = {
          tree: 150,
          bush: 65,
          rock: 58,
          flower: 28,
          stump: 48
        }[type];

        image.setScale(height / image.height);
        image.setDepth(y);

        if (["tree", "rock", "stump"].includes(type)) {
          this.addWall(
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

  drawVillage() {
    const g = this.add.graphics().setDepth(-100);

    g.fillStyle(0x4f8e52);
    g.fillEllipse(1000, 750, 750, 620);

    g.lineStyle(5, 0x8baf71, 0.75);
    g.strokeEllipse(1000, 750, 750, 620);

    // Cobblestone plaza
    g.fillStyle(0xbba67e);
    g.fillEllipse(1000, 792, 455, 265);

    g.fillStyle(0x9f8c6d);
    g.fillRect(966, 815, 68, 440);

    for (let i = 0; i < 110; i++) {
      const x = 1000 + Math.sin(i * 19.3) * 205;
      const y = 792 + Math.cos(i * 13.7) * 117;

      if (
        Math.hypot(
          (x - 1000) / 215,
          (y - 792) / 125
        ) < 0.95
      ) {
        g.fillStyle(
          i % 3 ? 0xcfc09a : 0x9f9173,
          0.65
        );

        g.fillRoundedRect(
          x, y, 11 + i % 3 * 5,
          5 + i % 4, 2
        );
      }
    }

    // Fountain
    g.fillStyle(0x394f57);
    g.fillEllipse(1000, 738, 122, 74);

    g.fillStyle(0x859a99);
    g.fillEllipse(1000, 729, 120, 64);

    g.fillStyle(0x286c92);
    g.fillEllipse(1000, 727, 96, 43);

    g.fillStyle(0x63c4d4);
    g.fillEllipse(987, 721, 43, 10);

    const houses = [
      [760, 610, 0, "MIRA SHOP"],
      [1240, 610, 1, "BRON FORGE"],
      [1000, 470, 2, "GUILD HALL"]
    ];

    for (const [x, y, id, name] of houses) {
      this.add.image(
        x, y, `house_${id}`
      ).setOrigin(0.5, 1)
        .setDepth(y)
        .setScale(0.95);

      this.addWall(x, y - 32, 160, 48);

      this.add.text(
        x, y - 169, name,
        {
          fontFamily: "monospace",
          fontSize: "12px",
          fontStyle: "bold",
          color: "#ffe7b2",
          backgroundColor: "#303c37",
          padding: { x: 6, y: 3 }
        }
      ).setOrigin(0.5).setDepth(y + 1);
    }

    this.addNPC(0, 785, 775, "MIRA", "ร้านค้า");
    this.addNPC(1, 1215, 775, "BRON", "ช่างตีเหล็ก");
    this.addNPC(2, 1000, 950, "ELDER", "เควสต์");
  }

  addNPC(id, x, y, name, role) {
    const npc = { id, x, y, name, role };

    const sprite = this.add.image(
      x, y, `npc_${id}`
    ).setOrigin(0.5, 1)
      .setDisplaySize(52, 91)
      .setDepth(y)
      .setInteractive();

    const label = this.add.text(
      x, y - 107,
      `${name}\n${role}`,
      {
        fontFamily: "system-ui",
        fontSize: "12px",
        align: "center",
        color: "#fff0bb",
        backgroundColor: "#203b35",
        padding: { x: 5, y: 3 }
      }
    ).setOrigin(0.5).setDepth(y + 1);

    npc.sprite = sprite;
    npc.label = label;

    sprite.on("pointerdown", () => this.talk(npc));
    this.npcs.push(npc);
  }

  nearestNPC() {
    let result = null;
    let distance = 145;

    for (const npc of this.npcs) {
      const d = Math.hypot(
        this.hero.x - npc.x,
        this.hero.y - npc.y
      );

      if (d < distance) {
        distance = d;
        result = npc;
      }
    }

    return result;
  }

  talk(npc) {
    if (
      Math.hypot(
        this.hero.x - npc.x,
        this.hero.y - npc.y
      ) > 150
    ) {
      this.message("เดินเข้าใกล้ NPC ก่อน");
      return;
    }

    if (npc.id === 1) {
      this.ui.openForge();
      return;
    }

    this.openPanel(
      ["shop", "forge", "quest"][npc.id]
    );
  }

  readSave() {
    let s = {};

    let old = false;

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        s = JSON.parse(raw);
      } else {
        s = JSON.parse(
          localStorage.getItem(OLD_SAVE_KEY) || "{}"
        );
        old = true;
      }
    } catch {}

    this.level = s.level || 1;
    this.exp = s.exp || 0;
    this.gold = s.gold ?? 100;
    this.gems = s.gems || 0;
    this.kills = s.kills || 0;
    this.potions = s.potions ?? 3;
    this.auto = !!s.auto;
    this.bagSize = BAG_SIZE;
    this.inventory = Array.isArray(s.inventory) ? s.inventory : [];
    this.equipped = s.equipped || {};
    this.bossWins = s.bossWins ?? s.bossDefeated ?? 0;

    this.quest = s.quest || {
      accepted: false,
      kills: 0,
      claimed: false
    };

    // New player (or old V1.x save): starter gear.
    // Old Sword/Armor levels become enhance levels.
    if (!s.equipped) {
      const sword = makeItem(1, 0, "weapon");
      sword.name = "Rusty Sword";
      sword.enhance = Math.min(MAX_ENHANCE, old ? s.sword || 0 : 0);

      const armor = makeItem(1, 0, "armor");
      armor.name = "Worn Plate";
      armor.enhance = Math.min(MAX_ENHANCE, old ? s.armor || 0 : 0);

      this.equipped = { weapon: sword, armor };
    }

    this.maxHp = 100;
    this.hp = s.hp || 99999;
  }

  /* ---------- gear ---------- */

  recalcStats() {
    this.stats = heroStats(
      this.level,
      SLOTS.map(sl => this.equipped[sl.id])
    );

    this.maxHp = this.stats.hp;
    this.hp = Math.min(this.hp, this.maxHp);
    this.special = {};

    for (const sp of this.stats.specials) {
      const cur = this.special[sp.type];
      if (!cur || (sp.chance || sp.power) > (cur.chance || cur.power)) {
        this.special[sp.type] = sp;
      }
    }
  }

  isEquipped(item) {
    return this.equipped[item.slot]?.id === item.id;
  }

  findItem(id) {
    return Object.values(this.equipped).find(i => i && i.id === id) ||
      this.inventory.find(i => i.id === id);
  }

  addToBag(item) {
    if (this.inventory.length >= this.bagSize) {
      // Bag full: auto-sell the new item if it is weaker than Rare
      if (item.rarity < 2) {
        this.gold += sellPrice(item);
        return "sold";
      }
      const weakest = [...this.inventory]
        .filter(i => i.rarity < 2)
        .sort((a, b) => itemPower(a) - itemPower(b))[0];
      if (!weakest) return "full";
      this.sellItem(weakest);
    }

    this.inventory.push(item);
    return "ok";
  }

  canEquip(item) {
    return item.level <= this.level;
  }

  equipItem(item) {
    if (!this.canEquip(item)) {
      this.message(`ต้องการ Lv.${item.level}`);
      return false;
    }

    const old = this.equipped[item.slot];
    this.inventory = this.inventory.filter(i => i.id !== item.id);
    if (old) this.inventory.push(old);
    this.equipped[item.slot] = item;

    const hpRatio = this.hp / this.maxHp;
    this.recalcStats();
    this.hp = Math.max(1, Math.round(this.maxHp * hpRatio));
    this.message(`สวมใส่ ${itemFullName(item)}`);
    this.saveGame();
    return true;
  }

  unequipSlot(slot) {
    const item = this.equipped[slot];
    if (!item) return;
    if (this.inventory.length >= this.bagSize) {
      this.message("กระเป๋าเต็ม");
      return;
    }
    delete this.equipped[slot];
    this.inventory.push(item);
    this.recalcStats();
    this.saveGame();
  }

  sellItem(item) {
    if (this.isEquipped(item)) return;
    this.inventory = this.inventory.filter(i => i.id !== item.id);
    this.gold += sellPrice(item);
    this.saveGame();
  }

  sellBelow(rarity) {
    const sell = this.inventory.filter(i => i.rarity < rarity);
    for (const i of sell) this.gold += sellPrice(i);
    this.inventory = this.inventory.filter(i => i.rarity >= rarity);
    this.saveGame();
    return sell.length;
  }

  enhanceItem(item) {
    if (item.enhance >= MAX_ENHANCE) return "max";
    const cost = enhanceCost(item);

    if (this.gold < cost.gold || this.gems < cost.gems) {
      this.message("Gold / Gems ไม่เพียงพอ");
      return "nomoney";
    }

    this.gold -= cost.gold;
    this.gems -= cost.gems;

    const ok = Math.random() * 100 < cost.rate;
    if (ok) {
      item.enhance++;
      if (this.isEquipped(item)) this.recalcStats();
    }

    this.saveGame();
    return ok ? "ok" : "fail";
  }

  onUIOpen() {
    this.stick = { x: 0, y: 0 };
    this.stickPointer = null;
    this.attackHeld = false;
    this.joyKnob?.setPosition(this.joyBase.x, this.joyBase.y);
    if (this.scene.isActive()) this.scene.pause();
  }

  onUIClose() {
    this.input.keyboard.resetKeys();
    this.scene.resume();
  }

  toggleAuto() {
    this.auto = !this.auto;
    this.autoTarget = null;
    this.message(this.auto ? "AUTO BATTLE: เปิด" : "AUTO BATTLE: ปิด");
    this.saveGame();
  }

  saveGame() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          level: this.level,
          exp: this.exp,
          gold: this.gold,
          gems: this.gems,
          kills: this.kills,
          hp: this.hp,
          potions: this.potions,
          auto: this.auto,
          inventory: this.inventory,
          equipped: this.equipped,
          bossWins: this.bossWins,
          quest: this.quest
        })
      );
    } catch (e) {
      console.warn("Save failed", e);
    }
  }

  createUI() {
    const fixed = obj =>
      obj.setScrollFactor(0).setDepth(20000);

    this.hud = fixed(this.add.graphics());

    this.hudText = fixed(this.add.text(
      14, 10, "",
      {
        fontFamily: "system-ui",
        fontSize: "12px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ));

    this.noticeText = fixed(this.add.text(
      0, 0, "",
      {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#182d3ee8",
        padding: { x: 12, y: 7 }
      }
    ).setOrigin(0.5).setVisible(false));

    this.joyBase = fixed(this.add.circle(
      0, 0, 52, 0x152f40, 0.7
    ).setStrokeStyle(3, 0xa6cddd));

    this.joyKnob = fixed(this.add.circle(
      0, 0, 23, 0xa4d8f1
    ));

    this.attackButton = fixed(this.add.circle(
      0, 0, 40, 0x9d352e
    ).setStrokeStyle(3, 0xffc46a));

    this.attackLabel = fixed(this.add.text(
      0, 0, "⚔",
      { fontSize: "29px" }
    ).setOrigin(0.5));

    this.skillButton = fixed(this.add.circle(
      0, 0, 32, 0x315b96
    ).setStrokeStyle(3, 0xe6cb72));

    this.skillLabel = fixed(this.add.text(
      0, 0, "✦",
      { fontSize: "26px", color: "#ffffff" }
    ).setOrigin(0.5));

    this.talkButton = fixed(this.add.text(
      0, 0, "คุย",
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#346e50",
        padding: { x: 12, y: 7 }
      }
    ).setOrigin(0.5).setInteractive());

    this.talkButton.on("pointerdown", () => {
      if (this.panelMode) return;
      const npc = this.nearestNPC();

      if (npc) this.talk(npc);
      else this.message("ไม่มี NPC อยู่ใกล้");
    });

    this.potionButton = fixed(this.add.text(
      0, 0, "POTION",
      {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#754576",
        padding: { x: 9, y: 7 }
      }
    ).setOrigin(0.5).setInteractive());

    this.potionButton.on("pointerdown", () => {
      if (!this.panelMode) this.usePotion();
    });

    this.bossBar = fixed(this.add.graphics());

    this.bossLabel = fixed(this.add.text(
      0, 0, "HELLHOUND ALPHA",
      {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffbc74",
        stroke: "#24191b",
        strokeThickness: 3
      }
    ).setOrigin(0.5).setVisible(false));

    this.panel = fixed(this.add.container(0, 0));
    this.panel.setVisible(false);

    this.panelBackground = this.add.graphics();
    this.panel.add(this.panelBackground);

    this.panelTitle = this.add.text(
      0, 0, "",
      {
        fontSize: "21px",
        fontStyle: "bold",
        color: "#ffe09a"
      }
    ).setOrigin(0.5);

    this.panelInfo = this.add.text(
      0, 0, "",
      {
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 280 }
      }
    ).setOrigin(0.5);

    this.panel.add([
      this.panelTitle,
      this.panelInfo
    ]);

    this.optionButtons = [];

    for (let i = 0; i < 4; i++) {
      const button = this.add.text(
        0, 0, "",
        {
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#345f50",
          padding: { x: 10, y: 8 }
        }
      ).setOrigin(0.5).setInteractive();

      button.on("pointerdown", () => {
        this.panelAction(i);
      });

      this.optionButtons.push(button);
      this.panel.add(button);
    }

    this.closeButton = this.add.text(
      0, 0, "✕ ปิด",
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#98484b",
        padding: { x: 12, y: 8 }
      }
    ).setOrigin(0.5).setInteractive();

    this.closeButton.on("pointerdown", () => {
      this.closePanel();
    });

    this.panel.add(this.closeButton);
  }

  resizeUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    const landscape = w > h;

    const joyX = landscape ? 90 : 78;
    const joyY = h - (landscape ? 77 : 100);
    const attackX = w - (landscape ? 90 : 78);
    const attackY = joyY;

    this.joyBase.setPosition(joyX, joyY);
    this.joyKnob.setPosition(joyX, joyY);

    this.attackButton.setPosition(attackX, attackY);
    this.attackLabel.setPosition(attackX, attackY);

    this.skillButton.setPosition(
      attackX - 91, attackY - 20
    );
    this.skillLabel.setPosition(
      attackX - 91, attackY - 20
    );

    this.talkButton.setPosition(
      w / 2, h - (landscape ? 90 : 100)
    );

    this.potionButton.setPosition(
      w - 58, 30
    );

    this.noticeText.setPosition(
      w / 2, landscape ? 38 : 150
    );

    this.bossLabel.setPosition(
      w / 2, landscape ? 56 : 91
    );

    const pw = Math.min(w - 20, 360);
    const ph = Math.min(h - 16, 390);
    const cx = w / 2;
    const cy = h / 2;

    this.panelBackground.clear();
    this.panelBackground.fillStyle(0x111e2e, 0.97);
    this.panelBackground.fillRoundedRect(
      cx - pw / 2, cy - ph / 2,
      pw, ph, 12
    );

    this.panelBackground.lineStyle(3, 0xe1b96d);
    this.panelBackground.strokeRoundedRect(
      cx - pw / 2, cy - ph / 2,
      pw, ph, 12
    );

    this.panelTitle.setPosition(
      cx, cy - ph / 2 + 28
    );

    this.panelInfo.setPosition(
      cx, cy - ph / 2 + 82
    );

    this.optionButtons.forEach((b, i) => {
      b.setPosition(
        cx, cy - 30 + i * 42
      );
    });

    this.closeButton.setPosition(
      cx, cy + ph / 2 - 25
    );
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q,F"
    );

    this.input.addPointer(2);

    this.input.on("pointerdown", p => {
      if (this.panelMode) return;

      const w = this.scale.width;
      const h = this.scale.height;

      if (
        p.x < w * 0.4 &&
        p.y > h * 0.45 &&
        this.stickPointer === null
      ) {
        this.stickPointer = p.id;
        this.moveStick(p);
        return;
      }

      if (
        Math.hypot(
          p.x - this.skillButton.x,
          p.y - this.skillButton.y
        ) < 43
      ) {
        this.skill();
        return;
      }

      if (
        Math.hypot(
          p.x - this.attackButton.x,
          p.y - this.attackButton.y
        ) < 54
      ) {
        this.attackPointer = p.id;
        this.attackHeld = true;
        this.attack();
      }
    });

    this.input.on("pointermove", p => {
      if (p.id === this.stickPointer) {
        this.moveStick(p);
      }
    });

    const release = p => {
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
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
      const npc = this.nearestNPC();
      if (npc && !this.panelMode) this.talk(npc);
    });

    this.keys.Q.on("down", () => {
      if (!this.panelMode) this.usePotion();
    });

    this.keys.F.on("down", () => {
      if (!this.panelMode) this.skill();
    });
  }

  moveStick(p) {
    const dx = p.x - this.joyBase.x;
    const dy = p.y - this.joyBase.y;
    const length = Math.hypot(dx, dy);
    const power = Math.min(1, length / 50);

    this.stick = length ? {
      x: dx / length * power,
      y: dy / length * power
    } : { x: 0, y: 0 };

    this.joyKnob.setPosition(
      this.joyBase.x + this.stick.x * 36,
      this.joyBase.y + this.stick.y * 36
    );
  }

  openPanel(mode) {
    this.panelMode = mode;
    this.attackHeld = false;
    this.stick = { x: 0, y: 0 };
    this.stickPointer = null;
    this.hero.setVelocity(0);

    this.joyKnob.setPosition(
      this.joyBase.x, this.joyBase.y
    );

    this.panel.setVisible(true);
    this.refreshPanel();
  }

  closePanel() {
    this.panelMode = null;
    this.panel.setVisible(false);
  }

  refreshPanel() {
    const mode = this.panelMode;
    let title = "";
    let info = "";
    let options = [];

    if (mode === "shop") {
      title = "MIRA'S SHOP";
      info = `Gold: ${this.gold}  Gems: ${this.gems}`;

      options = [
        "ซื้อยา HP +30% — 20 Gold",
        "ซื้อยา 3 ขวด — 50 Gold",
        "ฟื้น HP เต็ม — 15 Gold",
        "🎁 หีบปริศนา (Rare+) — 10 Gems"
      ];
    }

    if (mode === "quest") {
      title = "ELDER — QUEST";

      if (!this.quest.accepted) {
        info = "กำจัด Hellhound 5 ตัว";
        options = ["รับเควสต์"];
      } else if (!this.quest.claimed) {
        info =
          `Hellhound ${Math.min(this.quest.kills, 5)}/5\n` +
          "รางวัล 300 Gold + 200 EXP";

        options = this.quest.kills >= 5
          ? ["รับรางวัล"]
          : ["กำลังทำเควสต์"];
      } else {
        info = "เควสต์สำเร็จแล้ว";
        options = ["เรียก Hellhound Alpha"];
      }
    }

    this.panelTitle.setText(title);
    this.panelInfo.setText(info);

    this.optionButtons.forEach((button, i) => {
      button.setVisible(i < options.length);
      button.setText(options[i] || "");
    });
  }

  panelAction(index) {
    const mode = this.panelMode;

    if (mode === "shop" && index === 3) {
      if (this.gems < 10) {
        this.message("Gems ไม่เพียงพอ");
        return;
      }
      if (this.inventory.length >= this.bagSize) {
        this.message("กระเป๋าเต็ม");
        return;
      }

      this.gems -= 10;
      const item = makeItem(
        this.level, rollRarity(DROP_TABLE.chest)
      );
      this.inventory.push(item);
      this.saveGame();
      this.closePanel();
      this.ui.showItemCard(item, {});
      return;
    }

    if (mode === "quest") {
      if (!this.quest.accepted) {
        this.quest.accepted = true;
        this.message("รับเควสต์แล้ว");
      } else if (
        !this.quest.claimed &&
        this.quest.kills >= 5
      ) {
        this.quest.claimed = true;
        this.gold += 300;
        this.gainExp(200);
        this.message("QUEST COMPLETE!");
      } else if (this.quest.claimed) {
        this.spawnBoss();
        this.closePanel();
        return;
      }

      this.saveGame();
      this.refreshPanel();
      return;
    }

    let cost;

    if (mode === "shop") {
      cost = [20, 50, 15][index];
    }

    if (cost === undefined) return;

    if (this.gold < cost) {
      this.message("Gold ไม่เพียงพอ");
      return;
    }

    this.gold -= cost;

    if (mode === "shop") {
      if (index === 0) this.potions++;
      if (index === 1) this.potions += 3;
      if (index === 2) this.hp = this.maxHp;
    }

    this.saveGame();
    this.refreshPanel();
    this.message("สำเร็จ!");
  }

  usePotion() {
    if (this.potions <= 0) {
      this.message("ไม่มียา");
      return;
    }

    if (this.hp >= this.maxHp) {
      this.message("HP เต็มแล้ว");
      return;
    }

    const heal = Math.max(50, Math.round(this.maxHp * 0.3));
    this.potions--;
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.saveGame();
    this.message(`HP +${heal}`);
  }

  message(text) {
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
    let x = 0;
    let y = 0;
    let found = false;

    for (let i = 0; i < 60; i++) {
      x = Phaser3.Math.Between(70, WORLD_W - 70);
      y = Phaser3.Math.Between(70, WORLD_H - 70);

      if (this.isSafe(x, y, isBoss ? 200 : 100))
        continue;

      if (!this.canWalk(x, y, isBoss ? 85 : 35))
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

    const type = isBoss || roll < 0.45
      ? "hellhound"
      : roll < 0.8 ? "slime" : "boar";

    const key = type === "hellhound"
      ? (
        this.textures.exists("hellhound_idle")
          ? "hellhound_idle"
          : "fallback_hellhound"
      )
      : this.texture(`${type}_0`);

    const sprite = this.physics.add.sprite(
      x, y, key
    ).setOrigin(0.5, 1);

    const height = isBoss ? 185 :
      type === "hellhound" ? 95 : 70;

    sprite.setDisplaySize(
      sprite.width * height / sprite.height,
      height
    );

    sprite.setCollideWorldBounds(true);

    sprite.body.setSize(
      sprite.width * 0.48,
      sprite.height * 0.16
    );

    sprite.body.setOffset(
      sprite.width * 0.26,
      sprite.height * 0.8
    );

    this.physics.add.collider(sprite, this.walls);

    const lv = isBoss
      ? this.level + 3
      : Math.max(1, this.level + Phaser3.Math.Between(-1, 1));
    const scale = 1 + (lv - 1) * 0.28;

    const hp = Math.round((isBoss ? 2200 :
      type === "hellhound" ? 125 :
      type === "boar" ? 85 : 45) * scale);

    const enemy = {
      type,
      boss: isBoss,
      lv,
      def: lv * 2,
      dmgScale: 1 + (lv - 1) * 0.18,
      sprite,
      hp,
      maxHp: hp,
      speed: isBoss ? 72 :
        type === "hellhound" ? 125 : 85,
      dead: false,
      animation: "",
      state: "idle",
      lastAttack: 0,
      attackAt: 0,
      attackEnd: 0,
      attackDone: false,
      attackCount: 0,
      stunUntil: 0,
      knockX: 0,
      knockY: 0,
      moveX: 0,
      moveY: 0,
      nextAI: 0,
      frame: 0,
      lastFrame: 0,
      shadow: this.add.ellipse(
        x, y, isBoss ? 95 : 42,
        12, 0x10251b, 0.4
      ),
      bar: this.add.graphics()
    };

    this.enemies.push(enemy);
    this.animateEnemy(enemy, "idle");

    return enemy;
  }

  spawnBoss() {
    if (this.boss && !this.boss.dead) {
      this.message("บอสยังอยู่ในแผนที่");
      return;
    }

    this.boss = this.spawnEnemy(true);

    if (this.boss) {
      this.message("HELLHOUND ALPHA ปรากฏตัว!");
      this.cameras.main.shake(180, 0.004);
    }
  }

  gainExp(amount) {
    this.exp += amount;

    while (this.exp >= this.level * 50) {
      this.exp -= this.level * 50;
      this.level++;
      this.recalcStats();
      this.hp = this.maxHp;
      this.message(`LEVEL UP! Lv.${this.level}`);
    }
  }

  floatingText(x, y, value, color, big = false) {
    const text = this.add.text(
      x, y, String(value),
      {
        fontFamily: "system-ui",
        fontSize: big ? "27px" : "21px",
        fontStyle: "bold",
        color,
        stroke: "#241a18",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: text,
      y: y - 48,
      alpha: 0,
      duration: 650,
      onComplete: () => text.destroy()
    });
  }

  sparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Phaser3.Math.Between(20, 65);

      const particle = this.add.circle(
        x, y, Phaser3.Math.Between(2, 4), color
      ).setDepth(15000);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: Phaser3.Math.Between(160, 350),
        onComplete: () => particle.destroy()
      });
    }
  }

  // Damage roll: ATK × multiplier, crit, minus (DEF - PEN)
  rollDamage(mult, enemy) {
    const s = this.stats;
    let raw = s.atk * mult * Phaser3.Math.FloatBetween(0.92, 1.08);
    const crit = Math.random() < s.critChance;
    if (crit) raw *= s.critMult;
    const reduce = Math.max(0, enemy.def - s.pen);
    return {
      damage: Math.max(1, Math.round(raw - reduce)),
      crit
    };
  }

  damageEnemy(enemy, damage, dx, dy, crit = false) {
    if (enemy.dead) return;

    enemy.hp -= damage;

    if (this.stats.lifesteal > 0) {
      this.hp = Math.min(
        this.maxHp,
        this.hp + Math.ceil(damage * this.stats.lifesteal)
      );
    }
    enemy.stunUntil = this.time.now + 180;
    enemy.knockX = dx * (enemy.boss ? 100 : 260);
    enemy.knockY = dy * (enemy.boss ? 100 : 260);

    enemy.sprite.setTintFill(0xffffff);

    this.floatingText(
      enemy.sprite.x + Phaser3.Math.Between(-12, 12),
      enemy.sprite.y - enemy.sprite.displayHeight - 10,
      crit ? `CRIT ${damage}!` : `-${damage}`,
      crit ? "#ffcf69" : "#ffffff",
      crit
    );

    this.sparks(
      enemy.sprite.x,
      enemy.sprite.y - 35,
      0xffc04a, 8
    );

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    } else {
      this.animateEnemy(enemy, "hurt", true);
    }
  }

  killEnemy(enemy) {
    if (enemy.dead) return;

    enemy.dead = true;
    enemy.sprite.setVelocity(0);
    enemy.sprite.body.enable = false;
    enemy.bar.clear();

    this.kills++;

    this.gainExp(Math.round(
      (enemy.boss ? 500 :
       enemy.type === "hellhound" ? 35 : 15) *
      (1 + (enemy.lv - 1) * 0.15)
    ));

    if (
      enemy.type === "hellhound" &&
      !enemy.boss &&
      this.quest.accepted &&
      !this.quest.claimed
    ) {
      this.quest.kills++;
    }

    if (enemy.boss) {
      this.bossWins++;
      this.gold += 500;
      this.gems += 10;
      this.message("BOSS DEFEATED! +500 Gold");
      this.cameras.main.flash(220, 255, 180, 60);
    }

    const finish = () => {
      if (!enemy.sprite.active) return;

      const x = enemy.sprite.x;
      const y = enemy.sprite.y;

      enemy.sprite.destroy();
      enemy.shadow.destroy();
      enemy.bar.destroy();

      this.enemies = this.enemies.filter(
        e => e !== enemy
      );

      const count = enemy.boss ? 14 :
        enemy.type === "hellhound" ? 5 : 3;

      for (let i = 0; i < count; i++) {
        const gem = Math.random() < 0.17;

        const obj = this.add.image(
          x + Phaser3.Math.Between(-45, 45),
          y + Phaser3.Math.Between(-25, 25),
          gem ? "gem" : "coin"
        ).setDepth(y + 2);

        this.drops.push({ obj, gem, lv: enemy.lv });
      }

      this.rollGearDrops(enemy, x, y);

      this.saveGame();
    };

    if (
      enemy.type === "hellhound" &&
      this.anims.exists("hellAnim_die")
    ) {
      this.animateEnemy(enemy, "die", true);

      enemy.sprite.once(
        Phaser3.Animations.Events.ANIMATION_COMPLETE,
        finish
      );

      this.time.delayedCall(850, finish);
    } else {
      finish();
    }
  }

  /* ---------- loot drops ---------- */

  rollGearDrops(enemy, x, y) {
    let rolls = [];

    if (enemy.boss) {
      rolls = [DROP_TABLE.boss, DROP_TABLE.boss, DROP_TABLE.elite];
    } else {
      const chance = enemy.type === "hellhound" ? 0.22 :
        enemy.type === "boar" ? 0.15 : 0.12;
      if (Math.random() < chance) {
        rolls = [enemy.type === "hellhound"
          ? DROP_TABLE.elite : DROP_TABLE.normal];
      }
    }

    rolls.forEach((table, i) => {
      const item = makeItem(enemy.lv, rollRarity(table));
      this.time.delayedCall(i * 220, () => this.spawnLoot(item, x, y));
    });
  }

  spawnLoot(item, x, y) {
    const r = RARITIES[item.rarity];
    const tx = Phaser3.Math.Clamp(x + Phaser3.Math.Between(-60, 60), 30, WORLD_W - 30);
    const ty = Phaser3.Math.Clamp(y + Phaser3.Math.Between(-30, 40), 40, WORLD_H - 20);

    const glow = this.add.image(tx, ty, "loot_glow")
      .setTint(r.hex)
      .setBlendMode(Phaser3.BlendModes.ADD)
      .setDisplaySize(item.rarity >= 3 ? 90 : 56, item.rarity >= 3 ? 34 : 22)
      .setAlpha(0.8)
      .setDepth(ty - 2);

    let beam = null;
    if (r.beam) {
      beam = this.add.image(tx, ty + 4, "loot_beam")
        .setOrigin(0.5, 1)
        .setTint(r.hex)
        .setBlendMode(Phaser3.BlendModes.ADD)
        .setDisplaySize(item.rarity >= 4 ? 46 : 30, 1)
        .setDepth(ty + 1);

      // Pillar shoots up from the ground
      this.tweens.add({
        targets: beam,
        displayHeight: r.beam,
        duration: 380,
        ease: "Back.Out"
      });
      this.tweens.add({
        targets: beam,
        alpha: { from: 1, to: 0.55 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        delay: 400
      });
    }

    const icon = this.add.image(x, y - 30, `icon_${item.slot}_${item.rarity}`)
      .setDepth(ty + 2)
      .setScale(0.85);

    // Item pops out of the monster in an arc
    this.tweens.add({ targets: icon, x: tx, duration: 420 });
    this.tweens.add({
      targets: icon,
      y: { from: y - 30, to: ty - 75 },
      duration: 210,
      ease: "Quad.Out",
      yoyo: false,
      onComplete: () => {
        this.tweens.add({
          targets: icon, y: ty - 22, duration: 210, ease: "Bounce.Out",
          onComplete: () => {
            this.tweens.add({
              targets: icon, y: ty - 30, duration: 700,
              yoyo: true, repeat: -1, ease: "Sine.InOut"
            });
          }
        });
      }
    });

    const label = this.add.text(tx, ty + 10, itemFullName(item), {
      fontFamily: "system-ui",
      fontSize: "11px",
      color: r.color,
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(ty + 3);

    this.loot.push({ item, icon, beam, glow, label, x: tx, y: ty, born: this.time.now });

    if (item.rarity >= 4) {
      this.cameras.main.flash(160, ...(item.rarity === 5 ? [255, 80, 160] : [255, 190, 60]));
      this.ui.banner(
        item.rarity === 5 ? "An {hl} item dropped!" : "A {hl} item dropped!",
        item.rarity === 5 ? "artifact-grade" : "legendary",
        item.rarity
      );
    } else if (item.rarity === 3) {
      this.sparks(tx, ty - 20, r.hex, 14);
    }
  }

  updateLoot(now) {
    const hue = (now / 6) % 360;

    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];

      if (l.item.rarity === 5) {
        const c = Phaser3.Display.Color.HSVToRGB(hue / 360, 0.75, 1).color;
        l.beam?.setTint(c);
        l.glow.setTint(c);
      }

      const d = Math.hypot(this.hero.x - l.x, this.hero.y - l.y);
      if (d < 48 && now - l.born > 450) {
        this.pickupLoot(l);
        this.loot.splice(i, 1);
        if (this.ui.isOpen) return;
      }
    }
  }

  pickupLoot(l) {
    for (const o of [l.icon, l.beam, l.glow, l.label]) {
      if (!o) continue;
      this.tweens.killTweensOf(o);
      o.destroy();
    }

    const item = l.item;
    const res = this.addToBag(item);

    if (res === "sold") {
      this.ui.toast(item, "ขายอัตโนมัติ");
      return;
    }
    if (res === "full") {
      this.message("กระเป๋าเต็ม! ขายของก่อน");
      this.inventory.push(item);
    }

    this.sparks(this.hero.x, this.hero.y - 40, RARITIES[item.rarity].hex, 12);
    this.saveGame();

    // Empty slot? equip right away (comfortable for new players)
    if (!this.equipped[item.slot] && this.canEquip(item)) {
      this.equipItem(item);
      this.ui.toast(item, "สวมใส่");
      return;
    }

    if (item.rarity >= 4) {
      this.ui.showItemCard(item, {});
    } else {
      this.ui.toast(item);
    }
  }

  /* ---------- auto battle ---------- */

  autoControl(now) {
    const hero = this.hero;

    if (
      this.hp < this.maxHp * 0.35 &&
      this.potions > 0 &&
      now - this.lastAutoPotion > 1500
    ) {
      this.lastAutoPotion = now;
      this.usePotion();
    }

    // 1) pick up loot nearby
    let goal = null;
    let best = 650;
    for (const l of this.loot) {
      const d = Math.hypot(l.x - hero.x, l.y - hero.y);
      if (d < best) { best = d; goal = { x: l.x, y: l.y, loot: true }; }
    }

    // 2) nearest monster (boss first)
    if (!goal) {
      let target = this.boss && !this.boss.dead ? this.boss : null;
      if (!target) {
        best = 900;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.sprite.x - hero.x, e.sprite.y - hero.y);
          if (d < best) { best = d; target = e; }
        }
      }

      if (target) {
        const dx = target.sprite.x - hero.x;
        const dy = target.sprite.y - hero.y;
        const d = Math.hypot(dx, dy);
        const reach = target.boss ? 110 : 70;

        if (d < reach) {
          this.direction = this.facing(dx, dy);

          const near = this.enemies.filter(e => !e.dead &&
            Math.hypot(e.sprite.x - hero.x, e.sprite.y - hero.y) < 220).length;
          if ((near >= 3 || target.boss) && now - this.lastSkill > 4000) {
            this.skill();
          }
          return { x: 0, y: 0, attack: true };
        }
        goal = { x: target.sprite.x, y: target.sprite.y };
      }
    }

    // 3) nothing around: wander out of the village
    if (!goal) {
      if (!this.autoWander || Math.hypot(this.autoWander.x - hero.x, this.autoWander.y - hero.y) < 40) {
        this.autoWander = {
          x: Phaser3.Math.Between(200, WORLD_W - 200),
          y: Phaser3.Math.Between(200, WORLD_H - 200)
        };
      }
      goal = this.autoWander;
    }

    let mx = goal.x - hero.x;
    let my = goal.y - hero.y;
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;

    // Simple unstuck: if we barely moved, side-step for a moment
    const st = this.autoStuck;
    if (now < st.until && st.dir) return { x: st.dir.x, y: st.dir.y };
    if (now - st.t > 600) {
      if (Math.hypot(hero.x - st.x, hero.y - st.y) < 12) {
        const side = Math.random() < 0.5 ? 1 : -1;
        st.dir = { x: -my * side, y: mx * side };
        st.until = now + 450;
        this.autoWander = null;
      }
      st.x = hero.x;
      st.y = hero.y;
      st.t = now;
    }

    return { x: mx, y: my };
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
      .setPosition(x, y - 35)
      .setDepth(15000);

    const angle = {
      right: 0,
      left: Math.PI,
      down: Math.PI / 2,
      up: -Math.PI / 2
    }[dir];

    const radius = combo === 3 ? 100 : 72;

    g.lineStyle(
      combo === 3 ? 16 : 11,
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

    g.lineStyle(4, 0xffffff);
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
      x, y - 35,
      combo === 3 ? 0xffa12a : 0x8feeff,
      10
    );
  }

  // Attack speed: normal bonus is capped at +100%.
  // Artifact "frenzy" breaks the cap (+300%).
  attackSpeed() {
    const frenzy = this.time.now < this.frenzyUntil
      ? (this.special.frenzy?.power || 300) / 100 : 0;
    return 1 + this.stats.aspdCapped + frenzy;
  }

  attack() {
    const now = this.time.now;
    const spd = this.attackSpeed();

    if (
      this.panelMode ||
      this.attacking ||
      now - this.lastAttack < 290 / spd
    ) return;

    const fz = this.special.frenzy;
    if (fz && now >= this.frenzyUntil && Math.random() * 100 < fz.chance) {
      this.frenzyUntil = now + 2500;
      this.floatingText(
        this.hero.x, this.hero.y - 115,
        "FRENZY!", "#ff9b2d", true
      );
    }

    this.combo = now < this.comboUntil
      ? this.combo % 3 + 1 : 1;

    this.comboUntil = now + 1050;
    this.lastAttack = now;
    this.attacking = true;
    this.attackDirection = this.direction;
    this.attackHit = false;

    const s2 = this.attackSpeed();

    this.attackTime = now +
      (this.combo === 3 ? 220 : 125) / s2;

    this.attackEnd = now +
      (this.combo === 3 ? 480 : 335) / s2;

    this.animateHero(
      "attack", this.attackDirection, true
    );
    this.hero.anims.timeScale = s2;
  }

  resolveAttack() {
    const [dx, dy] = this.vector(
      this.attackDirection
    );

    this.slash(
      this.hero.x + dx * 48,
      this.hero.y + dy * 26,
      this.attackDirection,
      this.combo
    );

    const range = this.combo === 3 ? 175 : 125;
    let hitAny = null;

    for (const enemy of [...this.enemies]) {
      if (enemy.dead) continue;

      const ex = enemy.sprite.x - this.hero.x;
      const ey = enemy.sprite.y - this.hero.y;
      const dist = Math.hypot(ex, ey);

      if (
        dist > range ||
        dist < 1 ||
        ex * dx + ey * dy < -10 ||
        Math.abs(ex * dy - ey * dx) >
          (this.combo === 3 ? 125 : 80)
      ) continue;

      const hit = this.rollDamage(
        this.combo === 3 ? 2.45 :
        this.combo === 2 ? 1.45 : 1,
        enemy
      );

      this.damageEnemy(enemy, hit.damage, dx, dy, hit.crit);
      hitAny = enemy;
    }

    if (this.combo === 3) {
      this.cameras.main.shake(90, 0.003);
    }

    this.attackCounter++;
    this.triggerSpecials(hitAny);
  }

  triggerSpecials(target) {
    const th = this.special.thunder;
    if (th && target && Math.random() * 100 < th.chance) {
      this.lightning(target.sprite.x, target.sprite.y, th.power / 100);
    }

    const qk = this.special.quake;
    if (qk && this.attackCounter % qk.every === 0) {
      this.shockwave(qk.power / 100, 0x9fe8ff, 190);
    }
  }

  lightning(x, y, mult) {
    const g = this.add.graphics().setDepth(16000);
    let px = x + Phaser3.Math.Between(-20, 20);
    let py = y - 420;
    g.lineStyle(7, 0x9fe8ff, 0.9);
    g.beginPath();
    g.moveTo(px, py);
    while (py < y - 30) {
      px = x + Phaser3.Math.Between(-24, 24);
      py += Phaser3.Math.Between(40, 70);
      g.lineTo(px, Math.min(py, y - 30));
    }
    g.strokePath();
    g.lineStyle(3, 0xffffff);
    g.strokePath();

    this.tweens.add({
      targets: g, alpha: 0, duration: 260,
      onComplete: () => g.destroy()
    });
    this.sparks(x, y - 30, 0x9fe8ff, 16);
    this.cameras.main.flash(70, 160, 220, 255);

    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      if (Math.hypot(e.sprite.x - x, e.sprite.y - y) < 95) {
        const hit = this.rollDamage(mult, e);
        this.damageEnemy(e, hit.damage, 0, 0, hit.crit);
      }
    }
  }

  shockwave(mult, color, radius) {
    const ring = this.add.circle(
      this.hero.x, this.hero.y - 20,
      20, color, 0.12
    ).setStrokeStyle(6, color).setDepth(15000);

    this.tweens.add({
      targets: ring,
      scaleX: radius / 20, scaleY: radius / 20,
      alpha: 0, duration: 330,
      onComplete: () => ring.destroy()
    });

    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      const dx = e.sprite.x - this.hero.x;
      const dy = e.sprite.y - this.hero.y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        const hit = this.rollDamage(mult, e);
        this.damageEnemy(e, hit.damage,
          d ? dx / d : 1, d ? dy / d : 0, hit.crit);
      }
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
      22, 0xff7426, 0.15
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
      0xffb13a, 24
    );

    this.cameras.main.shake(160, 0.004);

    for (const enemy of [...this.enemies]) {
      if (enemy.dead) continue;

      const dx = enemy.sprite.x - this.hero.x;
      const dy = enemy.sprite.y - this.hero.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 230) {
        const hit = this.rollDamage(3.6, enemy);
        this.damageEnemy(
          enemy,
          hit.damage,
          dist ? dx / dist : 1,
          dist ? dy / dist : 0,
          hit.crit
        );
      }
    }
  }

  hurtHero(damage) {
    const now = this.time.now;

    if (
      now - this.lastHurt < 550 ||
      this.isSafe(this.hero.x, this.hero.y)
    ) return;

    this.lastHurt = now;
    this.hp = Math.max(0, this.hp - damage);
    this.hero.setTintFill(0xff7777);

    this.time.delayedCall(140, () => {
      if (this.hero.active) this.hero.clearTint();
    });

    this.floatingText(
      this.hero.x,
      this.hero.y - 100,
      `-${damage}`,
      "#ff7a7a"
    );
  }

  updateEnemies(now) {
    for (const enemy of [...this.enemies]) {
      if (enemy.dead) continue;

      const s = enemy.sprite;
      const dx = this.hero.x - s.x;
      const dy = this.hero.y - s.y;
      const dist = Math.hypot(dx, dy);
      const safe = this.isSafe(
        this.hero.x, this.hero.y, 10
      );

      if (enemy.type === "hellhound") {
        s.setFlipX(this.hero.x < s.x);
      }

      if (now < enemy.stunUntil) {
        s.setVelocity(
          enemy.knockX, enemy.knockY
        );

        enemy.knockX *= 0.86;
        enemy.knockY *= 0.86;
      } else if (
        enemy.state === "attack" &&
        now < enemy.attackEnd
      ) {
        s.setVelocity(0);

        if (
          !enemy.attackDone &&
          now >= enemy.attackAt
        ) {
          enemy.attackDone = true;

          this.sparks(
            s.x, s.y - 35,
            0xff7426,
            enemy.boss ? 16 : 8
          );

          if (
            dist < (enemy.boss ? 150 : 83) &&
            !safe
          ) {
            this.hurtHero(Math.round(
              (enemy.boss ? 22 : 9) * enemy.dmgScale
            ));
          }
        }
      } else {
        enemy.state = "idle";

        if (now >= enemy.nextAI) {
          enemy.nextAI = now + 180;

          if (
            safe ||
            dist > 410 ||
            dist < (enemy.boss ? 115 : 65)
          ) {
            enemy.moveX = 0;
            enemy.moveY = 0;
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
                this.canWalk(tx, ty, 25) &&
                !this.isSafe(tx, ty, 15)
              ) {
                chosen = [vx, vy];
                break;
              }
            }

            enemy.moveX = chosen[0];
            enemy.moveY = chosen[1];
          }
        }

        s.setVelocity(
          enemy.moveX * enemy.speed,
          enemy.moveY * enemy.speed
        );

        if (
          !safe &&
          dist < (enemy.boss ? 140 : 78) &&
          now - enemy.lastAttack >
            (enemy.boss ? 1350 : 1800)
        ) {
          enemy.lastAttack = now;
          enemy.attackAt = now + 340;
          enemy.attackEnd = now + 690;
          enemy.attackDone = false;
          enemy.state = "attack";
          enemy.attackCount++;

          this.animateEnemy(
            enemy,
            enemy.attackCount % 2
              ? "attack_1" : "attack_2",
            true
          );
        } else {
          this.animateEnemy(
            enemy,
            dist < 400 && !safe ? "run" : "idle"
          );
        }
      }

      if (
        enemy.type !== "hellhound" &&
        now - enemy.lastFrame > 180
      ) {
        enemy.lastFrame = now;
        enemy.frame = (enemy.frame + 1) % 4;

        s.setTexture(
          this.texture(
            `${enemy.type}_${enemy.frame}`
          )
        );

        s.setDisplaySize(80, 70);
      }

      if (now > enemy.stunUntil) {
        s.clearTint();
      }

      s.setDepth(s.y);
      enemy.shadow.setPosition(s.x, s.y);
      enemy.shadow.setDepth(s.y - 1);
      enemy.bar.clear();

      if (dist < 450 || enemy.boss) {
        const width = enemy.boss ? 100 : 55;
        const barY = s.y - s.displayHeight - 12;

        enemy.bar.fillStyle(0x17221c);
        enemy.bar.fillRect(
          s.x - width / 2,
          barY, width, 9
        );

        enemy.bar.fillStyle(
          enemy.boss ? 0xff8c32 : 0xe34b48
        );

        enemy.bar.fillRect(
          s.x - width / 2 + 1,
          barY + 1,
          (width - 2) *
            Math.max(0, enemy.hp / enemy.maxHp),
          7
        );

        enemy.bar.setDepth(s.y + 1);
      }

      if (
        enemy.type !== "hellhound" &&
        !safe &&
        dist < 50 &&
        now - enemy.lastAttack > 1500
      ) {
        enemy.lastAttack = now;

        this.hurtHero(Math.round(
          (enemy.type === "boar" ? 6 : 4) * enemy.dmgScale
        ));
      }
    }
  }

  updateHUD() {
    const w = this.scale.width;
    const h = this.scale.height;
    const landscape = w > h;
    const width = landscape ? 235 : Math.min(310, w - 100);

    this.hud.clear();

    this.hud.fillStyle(0x142335, 0.92);
    this.hud.fillRoundedRect(
      8, 8, width, 79, 8
    );

    this.hud.lineStyle(2, 0xd2a35b);
    this.hud.strokeRoundedRect(
      8, 8, width, 79, 8
    );

    this.hud.fillStyle(0x512f33);
    this.hud.fillRect(15, 35, width - 16, 10);

    this.hud.fillStyle(0xe35350);
    this.hud.fillRect(
      15, 35,
      (width - 16) * this.hp / this.maxHp,
      10
    );

    this.hud.fillStyle(0x243a51);
    this.hud.fillRect(15, 52, width - 16, 6);

    this.hud.fillStyle(0x55b8f5);
    this.hud.fillRect(
      15, 52,
      (width - 16) *
        this.exp / (this.level * 50),
      6
    );

    this.hudText.setText(
      `LV.${this.level}  HP ${this.hp}/${this.maxHp}` +
      `   ⚡${this.stats.power.toLocaleString("en-US")}\n` +
      `\n\nGold ${this.gold.toLocaleString("en-US")}  Gems ${this.gems}`
    );

    this.potionButton.setText(
      `POTION ${this.potions}`
    );

    this.bossBar.clear();

    if (this.boss && !this.boss.dead) {
      this.bossLabel.setVisible(true);

      const bw = Math.min(w - 100, 350);
      const x = (w - bw) / 2;
      const y = landscape ? 73 : 112;

      this.bossBar.fillStyle(0x221b1b, 0.9);
      this.bossBar.fillRoundedRect(
        x, y, bw, 13, 4
      );

      this.bossBar.fillStyle(0xf06535);
      this.bossBar.fillRoundedRect(
        x + 2, y + 2,
        (bw - 4) * Math.max(
          0, this.boss.hp / this.boss.maxHp
        ),
        9, 3
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

    let autoAttack = false;
    if (
      this.auto && !this.panelMode &&
      Math.hypot(x, y) < 0.1
    ) {
      const a = this.autoControl(now);
      x = a.x;
      y = a.y;
      autoAttack = !!a.attack;
    }

    const magnitude = Math.hypot(x, y);

    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    const speed = (this.attacking ? 105 : 220) * (1 + this.stats.move);

    this.hero.setVelocity(
      x * speed, y * speed
    );

    if (this.attacking) {
      if (
        !this.attackHit &&
        now >= this.attackTime
      ) {
        this.attackHit = true;
        this.resolveAttack();
      }

      if (now >= this.attackEnd) {
        this.attacking = false;
        this.currentAnimation = "";
        this.hero.anims.timeScale = 1;
      }
    }

    if (!this.attacking) {
      this.animateHero(
        magnitude > 0.1 ? "walk" : "idle",
        magnitude > 0.1
          ? this.facing(x, y)
          : this.direction
      );
    }

    this.hero.setDepth(this.hero.y);

    this.shadow.setPosition(
      this.hero.x, this.hero.y
    );
    this.shadow.setDepth(this.hero.y - 1);

    if (
      !this.panelMode &&
      (this.attackHeld || this.keys.SPACE.isDown || autoAttack) &&
      !this.attacking &&
      now - this.lastAttack > 290 / this.attackSpeed()
    ) {
      this.attack();
    }

    this.updateEnemies(now);
    this.updateLoot(now);
    if (!this.scene.isActive()) return;

    const frenzy = now < this.frenzyUntil;
    this.frenzyAura.setVisible(frenzy);
    if (frenzy) {
      this.frenzyAura
        .setPosition(this.hero.x, this.hero.y)
        .setDepth(this.hero.y - 2)
        .setScale(1 + Math.sin(now / 60) * 0.12);
    }

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
        else {
          this.gold += Math.round(
            (4 + (drop.lv || 1)) * (1 + this.stats.goldFind)
          );
        }

        obj.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (
      this.enemies.filter(e => !e.boss).length < 12 &&
      now - this.lastSpawn > 1200
    ) {
      this.lastSpawn = now;
      this.spawnEnemy();
    }

    if (this.hp <= 0) {
      this.hp = this.maxHp;
      this.hero.setPosition(1000, 850);

      this.cameras.main.flash(
        250, 240, 75, 75
      );

      this.message("กลับมาที่หมู่บ้านแล้ว");
    }

    if (now - this.lastSave > 10000) {
      this.lastSave = now;
      this.saveGame();
    }

    this.talkButton.setVisible(!!this.nearestNPC());

    this.updateHUD();
  }
}

window.quarterGame = new Phaser3.Game({
  type: Phaser3.AUTO,
  parent: "game",
  backgroundColor: "#172b3a",

  scale: {
    mode: Phaser3.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser3.Scale.CENTER_BOTH
  },

  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },

  fps: {
    target: 60
  },

  physics: {
    default: "arcade",
    arcade: { debug: false }
  },

  scene: [QuarterRPG]
});
