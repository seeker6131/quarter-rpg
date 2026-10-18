
const P = window.Phaser;
const loading = document.getElementById("loading");

if (!P) {
  if (loading) loading.textContent = "Phaser unavailable";
  throw new Error("Phaser unavailable");
}

const WORLD_W = 1920;
const WORLD_H = 1440;
const SPEED = 220;
const TAU = Math.PI * 2;

class ForestRPG extends P.Scene {
  constructor() {
    super("ForestRPG");
  }

  create() {
    if (loading) loading.remove();

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor("#203f35");

    this.gold = 0;
    this.gems = 0;
    this.exp = 0;
    this.level = 1;
    this.kills = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.monsters = [];
    this.drops = [];
    this.move = { x: 0, y: 0 };
    this.facing = { x: 1, y: 0.35 };
    this.joyId = null;
    this.attackHeld = false;
    this.lastAttack = 0;
    this.lastSpawn = 0;
    this.lastHud = 0;
    this.quality = 1;
    this.fpsAverage = 60;

    this.createTextures();
    this.createWorld();

    this.player = this.createActor(920, 690, "hero");

    for (let i = 0; i < 11; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .startFollow(this.player.sprite, true, 0.12, 0.12);

    this.cameras.main.setRoundPixels(true);

    this.createUI();
    this.createControls();

    this.scale.on("resize", this.layoutUI, this);
    this.layoutUI();
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const rect = (x, y, w, h, c) => {
      g.fillStyle(c);
      g.fillRect(x * 3, y * 3, w * 3, h * 3);
    };

    const save = (name, w, h) => {
      g.generateTexture(name, w * 3, h * 3);
      g.clear();
    };

    // Hero: brown hair, blue armor, red scarf
    for (let f = 0; f < 4; f++) {
      const step = f === 1 ? 1 : f === 3 ? -1 : 0;

      // Boots
      rect(8, 25, 6, 7, 0x101e32);
      rect(17, 25, 6, 7, 0x101e32);
      rect(8, 30 + step, 7, 3, 0x253c59);
      rect(17, 30 - step, 7, 3, 0x253c59);

      // Armor
      rect(6, 14, 20, 13, 0x13243a);
      rect(8, 15, 17, 11, 0x24639b);
      rect(10, 16, 9, 5, 0x4aa4db);
      rect(8, 23, 17, 3, 0x152d4b);

      // Arms
      rect(4, 16, 5, 11, 0x293f58);
      rect(25, 16, 5, 11, 0x293f58);
      rect(4, 20, 5, 5, 0xe3ae7b);
      rect(25, 20, 5, 5, 0xe3ae7b);

      // Head
      rect(9, 4, 17, 13, 0x3c2b28);
      rect(10, 6, 15, 11, 0xf0bb89);
      rect(9, 3, 16, 6, 0x543627);
      rect(7, 6, 7, 4, 0x69412a);
      rect(19, 10, 2, 2, 0x182333);
      rect(24, 10, 2, 2, 0x182333);

      // Red scarf
      rect(7, 14, 19, 3, 0xb52d35);
      rect(3 - step, 16, 7, 3, 0xd3423e);
      rect(1 - step, 18, 6, 2, 0x8f252f);

      // Sword
      rect(29, 16, 3, 13, 0x77502b);
      rect(27, 16, 7, 2, 0xf0bf5d);
      rect(29, 3, 4, 13, 0x8dcde4);
      rect(30, 1, 2, 3, 0xffffff);

      save("hero" + f, 36, 35);
    }

    // Slime
    for (let f = 0; f < 4; f++) {
      const b = f % 2;

      rect(3, 13 + b, 20, 8, 0x183d30);
      rect(4, 10 + b, 18, 10, 0x328e52);
      rect(6, 6 + b, 14, 12, 0x5fc975);
      rect(9, 5 + b, 9, 6, 0x8be998);
      rect(8, 13 + b, 3, 3, 0x162c2b);
      rect(17, 13 + b, 3, 3, 0x162c2b);
      rect(10, 17 + b, 8, 2, 0x348b53);
      rect(7, 10 + b, 3, 2, 0xc0ffb3);

      save("slime" + f, 27, 24);
    }

    // Boar
    for (let f = 0; f < 4; f++) {
      const b = f % 2;

      rect(4, 11, 21, 13, 0x37251e);
      rect(5, 9, 19, 13, 0x825333);
      rect(7, 7, 14, 7, 0xa06a40);
      rect(2, 12, 9, 9, 0x8b5737);
      rect(1, 15, 7, 5, 0xb87951);
      rect(4, 13, 2, 2, 0x141b21);
      rect(7, 18, 3, 3, 0xf0d7a6);
      rect(19, 7, 5, 6, 0x5d3428);
      rect(9, 22, 4, 6 + b, 0x382820);
      rect(20, 22, 4, 6 - b, 0x382820);

      save("boar" + f, 29, 30);
    }

    // Coin
    rect(3, 0, 6, 2, 0xffe78a);
    rect(1, 2, 10, 8, 0xb97925);
    rect(2, 1, 8, 9, 0xffcf4c);
    rect(4, 3, 4, 5, 0xffef9d);
    save("coin", 12, 12);

    // Crystal
    rect(5, 0, 2, 2, 0xd6faff);
    rect(3, 2, 6, 3, 0x70d9ff);
    rect(1, 5, 10, 3, 0x278fd3);
    rect(3, 8, 6, 3, 0x1c5fa5);
    rect(5, 11, 2, 1, 0xa8f4ff);
    save("gem", 12, 12);

    // Tree
    rect(12, 19, 7, 17, 0x473226);
    rect(14, 19, 3, 16, 0x95603c);
    rect(5, 12, 23, 14, 0x163b2f);
    rect(3, 9, 26, 14, 0x235f3e);
    rect(6, 4, 21, 16, 0x337c4b);
    rect(10, 2, 15, 12, 0x4d995b);
    rect(8, 8, 7, 4, 0x6db16b);
    rect(20, 6, 5, 4, 0x71b96f);
    save("tree", 33, 37);

    // Stone
    rect(3, 9, 22, 9, 0x283b43);
    rect(5, 5, 18, 11, 0x60747d);
    rect(8, 3, 12, 6, 0x99a7a5);
    rect(15, 10, 8, 5, 0x40545e);
    save("rock", 29, 19);

    // Bush
    rect(2, 9, 20, 7, 0x1c4b34);
    rect(4, 5, 17, 10, 0x347e4b);
    rect(8, 2, 10, 9, 0x60a766);
    rect(5, 7, 5, 3, 0x8bc27c);
    save("bush", 25, 18);

    // Wooden chest
    rect(2, 7, 22, 14, 0x35251d);
    rect(3, 5, 20, 14, 0x84522e);
    rect(4, 7, 18, 4, 0xc18b49);
    rect(5, 13, 16, 2, 0x51321f);
    rect(11, 10, 4, 7, 0xffcf61);
    save("chest", 27, 23);

    g.destroy();
  }

  createWorld() {
    const g = this.add.graphics().setDepth(-10000);

    g.fillStyle(0x2f6348);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grass patches
    for (let i = 0; i < 1700; i++) {
      const x = P.Math.Between(0, WORLD_W);
      const y = P.Math.Between(0, WORLD_H);

      g.fillStyle(
        i % 3 === 0 ? 0x75a963 : 0x427b4b,
        0.65
      );
      g.fillRect(x, y, 4, 3);
    }

    // Main road
    g.fillStyle(0x665c40);
    g.fillEllipse(950, 750, 1540, 350);

    g.fillStyle(0x9b8355);
    g.fillEllipse(950, 745, 1480, 285);

    g.fillStyle(0xb29a68, 0.5);
    g.fillEllipse(950, 735, 1330, 210);

    // River on upper-right side
    g.fillStyle(0x173e59);
    g.fillRect(1280, 0, 330, 570);

    g.fillStyle(0x2479a5);
    g.fillRect(1295, 0, 300, 560);

    for (let i = 0; i < 130; i++) {
      const x = P.Math.Between(1300, 1590);
      const y = P.Math.Between(0, 560);

      g.fillStyle(0x91ddf4, 0.45);
      g.fillRect(x, y, P.Math.Between(8, 25), 3);
    }

    // Wooden bridge
    g.fillStyle(0x392c25);
    g.fillRect(1240, 245, 410, 115);

    for (let x = 1250; x < 1640; x += 26) {
      g.fillStyle(
        x % 3 ? 0x96623b : 0xb78048
      );
      g.fillRect(x, 255, 23, 93);

      g.fillStyle(0x503728);
      g.fillRect(x, 255, 3, 93);
    }

    // Decorative pebbles
    for (let i = 0; i < 160; i++) {
      const x = P.Math.Between(250, 1650);
      const y = P.Math.Between(660, 840);

      g.fillStyle(0x625d4d, 0.45);
      g.fillEllipse(x, y, 8, 4);
    }

    // Static scenery
    for (let i = 0; i < 105; i++) {
      const x = P.Math.Between(50, WORLD_W - 50);
      const y = P.Math.Between(55, WORLD_H - 55);

      if (Math.hypot(x - 920, y - 690) < 240) {
        continue;
      }

      if (
        x > 1270 && x < 1620 &&
        y < 570
      ) continue;

      const r = P.Math.Between(0, 9);
      const type = r < 5 ? "tree"
        : r < 8 ? "bush" : "rock";

      const shadow = this.add.ellipse(
        x, y, type === "tree" ? 65 : 40,
        13, 0x0b281f, 0.4
      ).setDepth(y - 1);

      const obj = this.add.image(x, y, type)
        .setOrigin(0.5, 1)
        .setDepth(y);

      if (type === "tree") {
        obj.setScale(P.Math.FloatBetween(0.9, 1.25));
      }

      shadow.setScale(obj.scaleX, 1);
    }

    // Treasure chest
    this.add.image(1050, 520, "chest")
      .setOrigin(0.5, 1)
      .setDepth(520);

    // Lantern posts
    this.makeLantern(1170, 510);
    this.makeLantern(1640, 380);
  }

  makeLantern(x, y) {
    const g = this.add.graphics().setDepth(y);

    g.fillStyle(0x493426);
    g.fillRect(x - 7, y - 95, 14, 95);

    g.fillStyle(0x9a693b);
    g.fillRect(x - 5, y - 95, 5, 95);

    g.fillStyle(0x382b24);
    g.fillRect(x - 20, y - 104, 40, 8);

    g.fillStyle(0xffd26b);
    g.fillRect(x - 14, y - 130, 28, 25);

    g.fillStyle(0xfff1a1);
    g.fillRect(x - 8, y - 125, 16, 15);

    g.fillStyle(0x483126);
    g.fillRect(x - 17, y - 134, 34, 6);

    this.add.circle(
      x, y - 118, 42, 0xffc65a, 0.12
    ).setDepth(y + 1);
  }

  createActor(x, y, type) {
    const hero = type === "hero";

    const shadow = this.add.ellipse(
      x, y, hero ? 46 : 50,
      13, 0x061d19, 0.4
    ).setDepth(y - 1);

    const sprite = this.physics.add.sprite(
      x, y, type + "0"
    ).setOrigin(0.5, 1);

    sprite.setDepth(y);
    sprite.setCollideWorldBounds(true);

    const bodyW = hero ? 30 : 35;
    const bodyH = 14;

    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset(
      (sprite.width - bodyW) / 2,
      sprite.height - bodyH
    );

    const bar = this.add.graphics();

    return {
      sprite,
      shadow,
      bar,
      type,
      hp: hero ? 100 : type === "boar" ? 85 : 45,
      maxHp: hero ? 100 : type === "boar" ? 85 : 45,
      lastHit: 0,
      lastFrame: 0,
      frame: 0,
      speed: type === "boar" ? 108 : 86
    };
  }

  spawnMonster() {
    const x = P.Math.Between(100, WORLD_W - 100);
    const y = P.Math.Between(100, WORLD_H - 100);

    if (
      Math.hypot(
        x - this.player.sprite.x,
        y - this.player.sprite.y
      ) < 240
    ) return;

    const type = Math.random() < 0.24
      ? "boar" : "slime";

    this.monsters.push(
      this.createActor(x, y, type)
    );
  }

  createUI() {
    const ui = d => d
      .setScrollFactor(0)
      .setDepth(20000);

    this.hudBg = ui(this.add.graphics());

    this.hud = ui(this.add.text(15, 15, "", {
      fontFamily: "system-ui",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#17202a",
      strokeThickness: 2
    }));

    this.fpsText = ui(this.add.text(0, 12, "", {
      fontFamily: "monospace",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffdb72",
      backgroundColor: "#132734dd",
      padding: { x: 8, y: 6 }
    }));

    this.miniBg = ui(this.add.graphics());

    this.base = ui(this.add.circle(
      90, 0, 61, 0x102b3d, 0.68
    ).setStrokeStyle(3, 0xc5d8e3, 0.65));

    this.knob = ui(this.add.circle(
      90, 0, 27, 0xaccfe7, 0.95
    )).setDepth(20001);

    this.attackButton = ui(this.add.circle(
      0, 0, 49, 0xb83d27, 0.95
    ).setStrokeStyle(4, 0xffc35a));

    this.attackLabel = ui(this.add.text(
      0, 0, "⚔", {
        fontFamily: "system-ui",
        fontSize: "34px",
        color: "#fff3d1"
      }
    ).setOrigin(0.5)).setDepth(20001);

    this.skillButton = ui(this.add.circle(
      0, 0, 30, 0x253b51, 0.95
    ).setStrokeStyle(3, 0xf4bd62));

    this.skillLabel = ui(this.add.text(
      0, 0, "✦", {
        fontFamily: "system-ui",
        fontSize: "27px",
        color: "#ffce66"
      }
    ).setOrigin(0.5)).setDepth(20001);

    this.lastSkill = 0;
  }

  layoutUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    const small = w < 450;

    const joyX = small ? 82 : 105;
    const joyY = h - (small ? 100 : 110);
    const atkX = w - (small ? 78 : 100);
    const atkY = h - (small ? 100 : 110);

    this.base.setPosition(joyX, joyY);
    this.knob.setPosition(joyX, joyY);

    this.attackButton.setPosition(atkX, atkY);
    this.attackLabel.setPosition(atkX, atkY);

    this.skillButton.setPosition(atkX - 30, atkY - 105);
    this.skillLabel.setPosition(atkX - 30, atkY - 105);

    this.fpsText.setPosition(w - 87, 12);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE"
    );

    this.input.addPointer(2);

    this.input.on("pointerdown", p => {
      const w = this.scale.width;
      const h = this.scale.height;

      if (
        p.x < w * 0.48 &&
        p.y > h * 0.4 &&
        this.joyId === null
      ) {
        this.joyId = p.id;
        this.moveJoystick(p);
      } else if (
        P.Math.Distance.Between(
          p.x, p.y,
          this.skillButton.x,
          this.skillButton.y
        ) < 45
      ) {
        this.useSkill(this.time.now);
      } else if (
        p.x > w * 0.52 &&
        p.y > h * 0.4
      ) {
        this.attackHeld = true;
      }
    });

    this.input.on("pointermove", p => {
      if (p.id === this.joyId) {
        this.moveJoystick(p);
      }
    });

    const release = p => {
      if (p.id === this.joyId) {
        this.joyId = null;
        this.move = { x: 0, y: 0 };
        this.knob.setPosition(
          this.base.x, this.base.y
        );
      }

      this.attackHeld = false;
    };

    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  moveJoystick(p) {
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const dist = Math.hypot(dx, dy);
    const amount = Math.min(1, dist / 55);

    this.move = dist
      ? {
          x: dx / dist * amount,
          y: dy / dist * amount
        }
      : { x: 0, y: 0 };

    this.knob.setPosition(
      this.base.x + this.move.x * 43,
      this.base.y + this.move.y * 43
    );
  }

  animateActor(a, now, moving) {
    if (now - a.lastFrame < (moving ? 110 : 240)) {
      return;
    }

    a.lastFrame = now;
    a.frame = (a.frame + 1) % 4;
    a.sprite.setTexture(a.type + a.frame);
  }

  floatingText(x, y, value, crit = false) {
    const t = this.add.text(
      x, y,
      (crit ? "CRIT " : "") + value,
      {
        fontFamily: "system-ui",
        fontSize: crit ? "23px" : "19px",
        fontStyle: "bold",
        color: crit ? "#ffcd5c" : "#ffffff",
        stroke: "#39251d",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: t,
      y: y - 55,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy()
    });
  }

  attack(now) {
    const p = this.player.sprite;

    const targets = this.monsters.filter(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 120
    );

    if (!targets.length) return;

    targets.sort((a, b) =>
      P.Math.Distance.Between(
        p.x, p.y, a.sprite.x, a.sprite.y
      ) -
      P.Math.Distance.Between(
        p.x, p.y, b.sprite.x, b.sprite.y
      )
    );

    const m = targets[0];
    const dx = m.sprite.x - p.x;
    const dy = m.sprite.y - p.y;
    const d = Math.max(1, Math.hypot(dx, dy));

    this.facing = { x: dx / d, y: dy / d };
    p.setFlipX(dx < 0);

    this.lastAttack = now;

    this.createSlash(
      p.x + this.facing.x * 55,
      p.y - 43 + this.facing.y * 30,
      Math.atan2(dy, dx)
    );

    this.hitMonster(m, false);
  }

  createSlash(x, y, angle) {
    const slash = this.add.graphics()
      .setPosition(x, y)
      .setDepth(15000);

    slash.lineStyle(11, 0x1669db, 0.55);
    slash.beginPath();
    slash.arc(0, 0, 48, -1.1, 1.1, false);
    slash.strokePath();

    slash.lineStyle(5, 0xa6f5ff, 1);
    slash.beginPath();
    slash.arc(0, 0, 48, -1.1, 1.1, false);
    slash.strokePath();

    slash.setRotation(angle);
    slash.setScale(0.6);

    this.tweens.add({
      targets: slash,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0,
      rotation: angle + 0.55,
      duration: 190,
      onComplete: () => slash.destroy()
    });
  }

  hitMonster(m, skill) {
    if (!m.sprite.active) return;

    const crit = Math.random() < 0.15;
    const dmg = skill ? 26 : crit ? 28 : 15;

    m.hp -= dmg;
    m.sprite.setTintFill(0xffffff);

    this.time.delayedCall(85, () => {
      if (m.sprite.active) m.sprite.clearTint();
    });

    this.floatingText(
      m.sprite.x,
      m.sprite.y - 80,
      "-" + dmg,
      crit
    );

    if (m.hp > 0) return;

    const x = m.sprite.x;
    const y = m.sprite.y;

    m.sprite.destroy();
    m.shadow.destroy();
    m.bar.destroy();

    const index = this.monsters.indexOf(m);
    if (index !== -1) this.monsters.splice(index, 1);

    this.kills++;
    this.exp += m.type === "boar" ? 20 : 10;

    while (this.exp >= this.level * 50) {
      this.exp -= this.level * 50;
      this.level++;
      this.hp = this.maxHp;
    }

    this.dropLoot(x, y);
  }

  useSkill(now) {
    if (now - this.lastSkill < 3500) return;

    this.lastSkill = now;

    const p = this.player.sprite;

    const circle = this.add.circle(
      p.x, p.y - 30, 25,
      0x69dfff, 0.24
    ).setStrokeStyle(5, 0xa9f6ff)
      .setDepth(15000);

    this.tweens.add({
      targets: circle,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 350,
      onComplete: () => circle.destroy()
    });

    for (const m of [...this.monsters]) {
      if (
        P.Math.Distance.Between(
          p.x, p.y, m.sprite.x, m.sprite.y
        ) < 160
      ) {
        this.hitMonster(m, true);
      }
    }
  }

  dropLoot(x, y) {
    const count = P.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const gem = Math.random() < 0.2;

      const s = this.add.image(
        x, y - 35, gem ? "gem" : "coin"
      ).setDepth(y + 2);

      const tx = x + P.Math.Between(-55, 55);
      const ty = y + P.Math.Between(-25, 25);

      this.tweens.add({
        targets: s,
        x: tx,
        duration: 350,
        ease: "Cubic.Out"
      });

      this.tweens.add({
        targets: s,
        y: y - 75,
        duration: 190,
        yoyo: true,
        onComplete: () => {
          if (s.active) s.y = ty;
        }
      });

      this.drops.push({
        sprite: s,
        gem,
        ready: this.time.now + 450
      });
    }
  }

  updateHUD(now) {
    if (now - this.lastHud < 150) return;
    this.lastHud = now;

    const w = this.scale.width;
    const compact = w < 440;

    this.hudBg.clear();

    const panelW = Math.min(w - 105, 315);

    this.hudBg.fillStyle(0x122637, 0.91);
    this.hudBg.fillRoundedRect(
      8, 8, panelW, 94, 8
    );

    this.hudBg.lineStyle(2, 0xc49a51);
    this.hudBg.strokeRoundedRect(
      8, 8, panelW, 94, 8
    );

    this.hudBg.fillStyle(0x48282b);
    this.hudBg.fillRect(16, 36, panelW - 18, 12);

    this.hudBg.fillStyle(0xd84343);
    this.hudBg.fillRect(
      16, 36,
      (panelW - 18) * this.hp / this.maxHp,
      12
    );

    this.hudBg.fillStyle(0x21324b);
    this.hudBg.fillRect(16, 57, panelW - 18, 8);

    this.hudBg.fillStyle(0x45baff);
    this.hudBg.fillRect(
      16, 57,
      (panelW - 18) * this.exp /
        (this.level * 50),
      8
    );

    this.hud.setFontSize(compact ? 13 : 15);

    this.hud.setText(
      "LV." + this.level +
      "   HP " + this.hp + "/" + this.maxHp +
      "\n\n\nGOLD " + this.gold +
      "  GEM " + this.gems +
      "  KILLS " + this.kills
    );

    this.fpsText.setText(
      "FPS " + Math.round(this.fpsAverage)
    );

    this.miniBg.clear();

    if (w >= 600) {
      const mx = w - 130;
      const my = 60;

      this.miniBg.fillStyle(0x102a29, 0.9);
      this.miniBg.fillRoundedRect(
        mx, my, 115, 90, 5
      );

      this.miniBg.lineStyle(2, 0xb59a5b);
      this.miniBg.strokeRoundedRect(
        mx, my, 115, 90, 5
      );

      const px = mx + 8 +
        this.player.sprite.x / WORLD_W * 99;

      const py = my + 8 +
        this.player.sprite.y / WORLD_H * 74;

      this.miniBg.fillStyle(0x5dd6ff);
      this.miniBg.fillCircle(px, py, 4);

      this.miniBg.fillStyle(0xff5c56);

      for (const m of this.monsters) {
        const x = mx + 8 +
          m.sprite.x / WORLD_W * 99;

        const y = my + 8 +
          m.sprite.y / WORLD_H * 74;

        this.miniBg.fillCircle(x, y, 2);
      }
    }
  }

  update(now, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const p = this.player.sprite;

    // Smoothed FPS measurement
    const currentFPS = delta > 0
      ? Math.min(120, 1000 / delta)
      : 60;

    this.fpsAverage =
      this.fpsAverage * 0.95 + currentFPS * 0.05;

    let x = this.move.x;
    let y = this.move.y;

    x += Number(
      this.keys.D.isDown || this.keys.RIGHT.isDown
    ) - Number(
      this.keys.A.isDown || this.keys.LEFT.isDown
    );

    y += Number(
      this.keys.S.isDown || this.keys.DOWN.isDown
    ) - Number(
      this.keys.W.isDown || this.keys.UP.isDown
    );

    const len = Math.hypot(x, y);

    if (len > 1) {
      x /= len;
      y /= len;
    }

    p.setVelocity(x * SPEED, y * SPEED);

    if (len > 0.1) {
      this.facing = { x, y };

      if (x !== 0) p.setFlipX(x < 0);
    }

    p.setDepth(p.y);

    this.player.shadow
      .setPosition(p.x, p.y)
      .setDepth(p.y - 1);

    this.animateActor(
      this.player, now, len > 0.1
    );

    for (const m of this.monsters) {
      const s = m.sprite;

      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy);

      if (d < 320 && d > 47) {
        s.setVelocity(
          dx / d * m.speed,
          dy / d * m.speed
        );
        s.setFlipX(dx < 0);
      } else {
        s.setVelocity(0, 0);
      }

      s.setDepth(s.y);

      m.shadow
        .setPosition(s.x, s.y)
        .setDepth(s.y - 1);

      this.animateActor(
        m, now, d < 320 && d > 47
      );

      m.bar.clear();

      if (d < 450) {
        m.bar.fillStyle(0x192724);
        m.bar.fillRect(s.x - 27, s.y - 83, 54, 8);

        m.bar.fillStyle(0xd94a42);
        m.bar.fillRect(
          s.x - 26,
          s.y - 82,
          52 * Math.max(0, m.hp / m.maxHp),
          6
        );
      }

      m.bar.setDepth(s.y + 1);

      if (d < 48 && now - m.lastHit > 1250) {
        m.lastHit = now;
        this.hp = Math.max(
          0,
          this.hp - (m.type === "boar" ? 7 : 4)
        );
        this.cameras.main.shake(55, 0.001);
      }
    }

    const nearby = this.monsters.some(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 120
    );

    if (
      now - this.lastAttack > 520 &&
      (
        nearby ||
        this.attackHeld ||
        this.keys.SPACE.isDown
      )
    ) {
      this.attack(now);
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const s = d.sprite;

      if (now < d.ready) continue;

      const dist = P.Math.Distance.Between(
        p.x, p.y, s.x, s.y
      );

      if (dist < 145) {
        const t = Math.min(1, dt * 7);

        s.x += (p.x - s.x) * t;
        s.y += (p.y - 20 - s.y) * t;
      }

      s.setDepth(s.y + 1);

      if (dist < 26) {
        if (d.gem) this.gems++;
        else this.gold++;

        s.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (
      this.monsters.length < 11 &&
      now - this.lastSpawn > 1100
    ) {
      this.lastSpawn = now;
      this.spawnMonster();
    }

    if (this.hp <= 0) {
      this.hp = this.maxHp;
      p.setPosition(920, 690);
      p.setVelocity(0, 0);
      this.cameras.main.flash(200, 255, 55, 55);
    }

    this.updateHUD(now);
  }
}

new P.Game({
  type: P.AUTO,
  parent: "game",
  backgroundColor: "#14283b",
  fps: {
    target: 60,
    forceSetTimeOut: false
  },
  scale: {
    mode: P.Scale.RESIZE,
    width: innerWidth,
    height: innerHeight,
    autoCenter: P.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scene: [ForestRPG]
});
