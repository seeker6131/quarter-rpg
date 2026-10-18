
const P = window.Phaser;
if (!P) throw new Error("Phaser 3 is required");

const VERSION = "V0.8";
const WORLD_W = 1800;
const WORLD_H = 1300;
const HERO_SPEED = 215;
const DIRS = ["down", "up", "left", "right"];
const ACTIONS = ["idle", "walk", "attack"];

class QuarterRPG extends P.Scene {
  constructor() {
    super("QuarterRPG");
  }

  preload() {
    for (const action of ACTIONS) {
      for (const dir of DIRS) {
        const key = `hero_${action}_${dir}`;
        this.load.spritesheet(
          key,
          `assets/${key}.png`,
          { frameWidth: 256, frameHeight: 288 }
        );
      }
    }

    for (const type of ["slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `${type}_${i}`,
          `assets/${type}_${i}.png`
        );
      }
    }

    for (const name of [
      "tree", "bush", "rock",
      "flower", "stump", "grass", "water"
    ]) {
      this.load.image(
        `forest_${name}`,
        `assets/${name}.png`
      );
    }

    this.load.on("loaderror", file => {
      console.warn("Missing:", file.key);
    });
  }

  create() {
    document.getElementById("loading")?.remove();

    this.physics.world.setBounds(
      0, 0, WORLD_W, WORLD_H
    );

    this.cameras.main.setBackgroundColor("#315c42");

    this.hp = 100;
    this.maxHp = 100;
    this.level = 1;
    this.exp = 0;
    this.gold = 0;
    this.gems = 0;
    this.kills = 0;

    this.monsters = [];
    this.drops = [];

    this.joy = { x: 0, y: 0 };
    this.joyId = null;
    this.attackId = null;
    this.attackHeld = false;

    this.direction = "down";
    this.action = "";
    this.attacking = false;

    this.combo = 0;
    this.comboUntil = 0;
    this.lastAttack = -1000;
    this.attackEnd = 0;
    this.attackImpact = 0;
    this.attackHitDone = false;
    this.attackDir = "down";

    this.lastSkill = -5000;
    this.lastSpawn = 0;
    this.lastHud = 0;
    this.lastDamage = -1000;
    this.fps = 60;

    this.makeFallbacks();
    this.makeAnimations();
    this.makeMap();

    this.hero = this.physics.add.sprite(
      900, 650,
      this.heroTexture("idle", "down")
    ).setOrigin(0.5, 1);

    this.hero.setDisplaySize(104, 117);
    this.hero.setCollideWorldBounds(true);

    this.hero.body.setSize(70, 24);
    this.hero.body.setOffset(93, 255);

    this.heroShadow = this.add.ellipse(
      900, 650, 48, 13,
      0x102c21, 0.42
    );

    this.playHero("idle", "down");

    for (let i = 0; i < 12; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .startFollow(this.hero, true, 0.12, 0.12)
      .setRoundPixels(true);

    this.makeUI();
    this.makeControls();
    this.layout();

    this.scale.on("resize", this.layout, this);
  }

  makeFallbacks() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const save = (key, w, h) => {
      g.generateTexture(key, w, h);
      g.clear();
    };

    // Missing character frames
    for (const type of ["slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        if (type === "slime") {
          g.fillStyle(0x42b967);
          g.fillEllipse(32, 34 + i % 2, 54, 42);
          g.fillStyle(0x19372c);
          g.fillRect(19, 31, 6, 7);
          g.fillRect(40, 31, 6, 7);
          save(`fallback_${type}_${i}`, 64, 56);
        } else {
          g.fillStyle(0x95623f);
          g.fillEllipse(37, 31, 61, 43);
          g.fillStyle(0x493025);
          g.fillRect(17, 45, 8, 15);
          g.fillRect(48, 45, 8, 15);
          save(`fallback_${type}_${i}`, 76, 64);
        }
      }
    }

    g.fillStyle(0xffd35b);
    g.fillCircle(12, 12, 10);
    save("loot_coin", 24, 24);

    g.fillStyle(0x69d9ff);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 23, y: 12 },
      { x: 12, y: 27 },
      { x: 1, y: 12 }
    ], true);
    save("loot_gem", 24, 28);

    for (const [name, color] of [
      ["grass", 0x346c43],
      ["water", 0x277ba4],
      ["tree", 0x327c48],
      ["bush", 0x489354],
      ["rock", 0x83918c],
      ["flower", 0xf5c76e],
      ["stump", 0x82512f]
    ]) {
      g.fillStyle(color);
      g.fillRect(0, 0, 64, 64);
      save(`fallback_${name}`, 64, 64);
    }

    // Emergency hero fallback: 8-frame sheet
    const h = this.make.graphics({ x: 0, y: 0 });

    for (let i = 0; i < 8; i++) {
      const x = i * 256 + 104;
      const stride = i % 2 ? 12 : -12;

      h.fillStyle(0x623c29);
      h.fillRect(x, 45, 48, 35);

      h.fillStyle(0xe8ad79);
      h.fillRect(x + 5, 75, 38, 42);

      h.fillStyle(0x347db4);
      h.fillRect(x, 120, 48, 65);

      h.fillStyle(0xc73743);
      h.fillRect(x - 9, 120, 61, 12);

      h.fillStyle(0x233954);
      h.fillRect(x + 3 + stride, 185, 16, 58);
      h.fillRect(x + 28 - stride, 185, 16, 58);

      h.fillStyle(0xaeeaff);
      h.fillRect(x + 55, 91, 8, 100);
    }

    h.generateTexture("hero_fallback", 2048, 288);
    h.destroy();
    g.destroy();
  }

  heroTexture(action, dir) {
    const key = `hero_${action}_${dir}`;
    return this.textures.exists(key)
      ? key : "hero_fallback";
  }

  forestTexture(name) {
    const key = `forest_${name}`;
    return this.textures.exists(key)
      ? key : `fallback_${name}`;
  }

  monsterTexture(type, frame) {
    const key = `${type}_${frame}`;
    return this.textures.exists(key)
      ? key : `fallback_${type}_${frame}`;
  }

  makeAnimations() {
    for (const action of ACTIONS) {
      for (const dir of DIRS) {
        const texture = this.heroTexture(action, dir);
        const key = `anim_${action}_${dir}`;

        const frames = [];

        if (texture === "hero_fallback") {
          for (let i = 0; i < 8; i++) {
            frames.push({
              key: texture,
              frame: "__BASE"
            });
          }
        } else {
          for (let i = 0; i < 8; i++) {
            frames.push({ key: texture, frame: i });
          }
        }

        this.anims.create({
          key,
          frames,
          frameRate: action === "attack" ? 17 :
            action === "walk" ? 12 : 5,
          repeat: action === "attack" ? 0 : -1
        });
      }
    }
  }

  playHero(action, dir, restart = false) {
    const key = `anim_${action}_${dir}`;

    if (
      !restart &&
      this.action === action &&
      this.direction === dir &&
      this.hero.anims.isPlaying
    ) return;

    this.action = action;
    this.direction = dir;
    this.hero.play(key, true);
  }

  makeMap() {
    this.add.tileSprite(
      WORLD_W / 2, WORLD_H / 2,
      WORLD_W, WORLD_H,
      this.forestTexture("grass")
    ).setDepth(-10000);

    const ground = this.add.graphics()
      .setDepth(-9999);

    ground.fillStyle(0x5b4932);
    ground.fillEllipse(900, 700, 1520, 345);

    ground.fillStyle(0xa58b5d);
    ground.fillEllipse(900, 690, 1450, 280);

    ground.fillStyle(0xbda16f, 0.45);
    ground.fillEllipse(900, 685, 1350, 220);

    this.add.tileSprite(
      1440, 250, 300, 500,
      this.forestTexture("water")
    ).setDepth(-9998);

    const bridge = this.add.graphics()
      .setDepth(-9997);

    bridge.fillStyle(0x392b22);
    bridge.fillRect(1240, 215, 390, 120);

    for (let x = 1250; x < 1620; x += 27) {
      bridge.fillStyle(0xa87845);
      bridge.fillRect(x, 225, 24, 100);
      bridge.fillStyle(0x4c3526);
      bridge.fillRect(x, 225, 3, 100);
    }

    for (let i = 0; i < 100; i++) {
      const x = P.Math.Between(70, 1730);
      const y = P.Math.Between(70, 1230);

      if (Math.hypot(x - 900, y - 650) < 270)
        continue;

      if (x > 1250 && x < 1620 && y < 510)
        continue;

      const n = P.Math.Between(0, 99);
      const type = n < 30 ? "tree"
        : n < 55 ? "bush"
        : n < 72 ? "rock"
        : n < 91 ? "flower" : "stump";

      const img = this.add.image(
        x, y, this.forestTexture(type)
      ).setOrigin(0.5, 1);

      const height = {
        tree: 145,
        bush: 62,
        rock: 52,
        flower: 28,
        stump: 45
      }[type];

      img.setScale(height / img.height);
      img.setDepth(y);
    }
  }

  spawnMonster() {
    if (!this.hero) return;

    const x = P.Math.Between(100, 1700);
    const y = P.Math.Between(100, 1200);

    if (
      P.Math.Distance.Between(
        x, y, this.hero.x, this.hero.y
      ) < 270
    ) return;

    const type = Math.random() < 0.25
      ? "boar" : "slime";

    const sprite = this.physics.add.sprite(
      x, y, this.monsterTexture(type, 0)
    ).setOrigin(0.5, 1);

    const height = type === "boar" ? 90 : 76;
    sprite.setScale(height / sprite.height);
    sprite.setCollideWorldBounds(true);

    const shadow = this.add.ellipse(
      x, y, 48, 12,
      0x102c21, 0.4
    );

    this.monsters.push({
      type,
      sprite,
      shadow,
      bar: this.add.graphics(),
      hp: type === "boar" ? 85 : 45,
      maxHp: type === "boar" ? 85 : 45,
      frame: 0,
      lastFrame: 0,
      lastHit: 0,
      speed: type === "boar" ? 92 : 76,
      knockX: 0,
      knockY: 0,
      knockUntil: 0,
      hurtUntil: 0
    });
  }

  makeUI() {
    const fixed = o =>
      o.setScrollFactor(0).setDepth(20000);

    this.hud = fixed(this.add.graphics());

    this.hudText = fixed(this.add.text(
      17, 16, "", {
        fontFamily: "system-ui",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff"
      }
    ));

    this.fpsText = fixed(this.add.text(
      0, 15, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffe18b",
        backgroundColor: "#13293bdd",
        padding: { x: 8, y: 6 }
      }
    ));

    this.comboText = fixed(this.add.text(
      0, 130, "", {
        fontFamily: "system-ui",
        fontSize: "23px",
        fontStyle: "bold",
        color: "#ffe28d",
        stroke: "#30211c",
        strokeThickness: 4
      }
    ).setOrigin(0.5));

    this.joyBase = fixed(this.add.circle(
      90, 0, 61, 0x142e40, 0.72
    ).setStrokeStyle(3, 0xb7d2e5));

    this.joyKnob = fixed(this.add.circle(
      90, 0, 27, 0xb1d9f0
    )).setDepth(20001);

    this.attackButton = fixed(this.add.circle(
      0, 0, 50, 0xb43e2c
    ).setStrokeStyle(4, 0xffcb6e));

    this.attackLabel = fixed(this.add.text(
      0, 0, "⚔", {
        fontSize: "34px",
        color: "#ffffff"
      }
    ).setOrigin(0.5)).setDepth(20001);

    this.skillButton = fixed(this.add.circle(
      0, 0, 31, 0x24425d
    ).setStrokeStyle(3, 0xf2c66a));

    this.skillLabel = fixed(this.add.text(
      0, 0, "✦", {
        fontSize: "28px",
        color: "#ffdc7c"
      }
    ).setOrigin(0.5)).setDepth(20001);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    const joyX = w < 450 ? 85 : 105;
    const atkX = w - (w < 450 ? 80 : 105);
    const y = h - 105;

    this.joyBase.setPosition(joyX, y);
    this.joyKnob.setPosition(joyX, y);

    this.attackButton.setPosition(atkX, y);
    this.attackLabel.setPosition(atkX, y);

    this.skillButton.setPosition(
      atkX - 30, y - 105
    );
    this.skillLabel.setPosition(
      atkX - 30, y - 105
    );

    this.fpsText.setPosition(w - 90, 15);
    this.comboText.setPosition(w / 2, 140);
  }

  makeControls() {
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
        this.moveJoy(p);
        return;
      }

      if (
        P.Math.Distance.Between(
          p.x, p.y,
          this.skillButton.x,
          this.skillButton.y
        ) < 48
      ) {
        this.useSkill(this.time.now);
        return;
      }

      if (
        P.Math.Distance.Between(
          p.x, p.y,
          this.attackButton.x,
          this.attackButton.y
        ) < 75
      ) {
        this.attackId = p.id;
        this.attackHeld = true;
        this.attack(this.time.now);
      }
    });

    this.input.on("pointermove", p => {
      if (p.id === this.joyId) this.moveJoy(p);
    });

    const release = p => {
      if (p.id === this.joyId) {
        this.joyId = null;
        this.joy = { x: 0, y: 0 };
        this.joyKnob.setPosition(
          this.joyBase.x, this.joyBase.y
        );
      }

      if (p.id === this.attackId) {
        this.attackId = null;
        this.attackHeld = false;
      }
    };

    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  moveJoy(p) {
    const dx = p.x - this.joyBase.x;
    const dy = p.y - this.joyBase.y;
    const dist = Math.hypot(dx, dy);
    const amount = Math.min(1, dist / 55);

    this.joy = dist ? {
      x: dx / dist * amount,
      y: dy / dist * amount
    } : { x: 0, y: 0 };

    this.joyKnob.setPosition(
      this.joyBase.x + this.joy.x * 43,
      this.joyBase.y + this.joy.y * 43
    );
  }

  facingFromInput(x, y) {
    // Diagonal movement is supported;
    // visual direction uses nearest cardinal sprite.
    if (Math.abs(x) > Math.abs(y)) {
      return x < 0 ? "left" : "right";
    }
    return y < 0 ? "up" : "down";
  }

  directionVector(dir) {
    return {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    }[dir];
  }

  slashFX(x, y, dir, combo) {
    const [dx, dy] = this.directionVector(dir);
    const angle = Math.atan2(dy, dx);

    const g = this.add.graphics()
      .setPosition(x, y - 42)
      .setRotation(angle)
      .setDepth(15000);

    const radius = combo === 3 ? 75 : 55;
    const color = combo === 3
      ? 0xffd46c : 0x9eeaff;

    g.lineStyle(
      combo === 3 ? 15 : 10,
      color, 0.7
    );

    g.beginPath();
    g.arc(0, 0, radius, -1.05, 1.05);
    g.strokePath();

    g.lineStyle(4, 0xffffff);
    g.beginPath();
    g.arc(0, 0, radius, -1.05, 1.05);
    g.strokePath();

    if (combo === 2) g.setScale(1, -1);

    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.3,
      duration: 160,
      onComplete: () => g.destroy()
    });
  }

  floatingText(x, y, text, color) {
    const label = this.add.text(
      x, y, text, {
        fontFamily: "system-ui",
        fontSize: "21px",
        fontStyle: "bold",
        color,
        stroke: "#30251e",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: label,
      y: y - 45,
      alpha: 0,
      duration: 500,
      onComplete: () => label.destroy()
    });
  }

  attack(now) {
    if (this.attacking) return;
    if (now - this.lastAttack < 290) return;

    this.combo = now < this.comboUntil
      ? this.combo % 3 + 1 : 1;

    this.comboUntil = now + 1050;
    this.lastAttack = now;
    this.attacking = true;

    this.attackDir = this.direction;
    this.attackHitDone = false;

    const duration = this.combo === 3 ? 480 : 330;

    this.attackImpact = now +
      (this.combo === 3 ? 210 : 125);

    this.attackEnd = now + duration;

    this.playHero(
      "attack", this.attackDir, true
    );

    this.comboText.setText(
      this.combo === 3
        ? "HEAVY SLASH!"
        : `COMBO ${this.combo}`
    );

    this.comboText.setAlpha(1);
  }

  resolveAttack() {
    const combo = this.combo;
    const dir = this.attackDir;
    const [fx, fy] = this.directionVector(dir);

    this.slashFX(
      this.hero.x + fx * 45,
      this.hero.y + fy * 30,
      dir, combo
    );

    const reach = combo === 3 ? 145 : 115;
    const damage = combo === 1 ? 14
      : combo === 2 ? 18 : 30;

    for (const m of [...this.monsters]) {
      const dx = m.sprite.x - this.hero.x;
      const dy = m.sprite.y - this.hero.y;
      const dist = Math.hypot(dx, dy);

      if (dist > reach || dist < 1) continue;

      const forward = dx * fx + dy * fy;

      if (forward < -15) continue;

      // Wider arc for heavy attack.
      const side = Math.abs(dx * fy - dy * fx);
      if (side > (combo === 3 ? 105 : 75))
        continue;

      this.hitMonster(m, damage, fx, fy, combo);
    }

    if (combo === 3) {
      this.cameras.main.shake(75, 0.002);
    }
  }

  hitMonster(m, damage, fx, fy, combo) {
    if (!m.sprite.active) return;

    m.hp -= damage;

    const now = this.time.now;

    m.hurtUntil = now + 160;
    m.knockUntil = now + (
      combo === 3 ? 270 : 160
    );

    const force = combo === 3 ? 340 : 210;

    m.knockX = fx * force;
    m.knockY = fy * force;

    m.sprite.setTintFill(0xffffff);

    this.floatingText(
      m.sprite.x,
      m.sprite.y - m.sprite.displayHeight - 12,
      `-${damage}`,
      combo === 3 ? "#ffcf61" : "#ffffff"
    );

    if (m.hp > 0) return;

    const x = m.sprite.x;
    const y = m.sprite.y;

    m.sprite.destroy();
    m.shadow.destroy();
    m.bar.destroy();

    const index = this.monsters.indexOf(m);
    if (index >= 0) this.monsters.splice(index, 1);

    this.kills++;
    this.exp += m.type === "boar" ? 20 : 10;

    while (this.exp >= this.level * 50) {
      this.exp -= this.level * 50;
      this.level++;
      this.hp = Math.min(
        this.maxHp, this.hp + 30
      );
    }

    this.dropLoot(x, y);
  }

  useSkill(now) {
    if (now - this.lastSkill < 3500) return;
    this.lastSkill = now;

    const ring = this.add.circle(
      this.hero.x,
      this.hero.y - 30,
      20, 0x54dfff, 0.2
    ).setStrokeStyle(5, 0xb9f6ff)
      .setDepth(15000);

    this.tweens.add({
      targets: ring,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 330,
      onComplete: () => ring.destroy()
    });

    for (const m of [...this.monsters]) {
      const dx = m.sprite.x - this.hero.x;
      const dy = m.sprite.y - this.hero.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 170) {
        const fx = dist > 0 ? dx / dist : 1;
        const fy = dist > 0 ? dy / dist : 0;
        this.hitMonster(m, 27, fx, fy, 3);
      }
    }
  }

  dropLoot(x, y) {
    for (let i = 0; i < 3; i++) {
      const gem = Math.random() < 0.2;

      const sprite = this.add.image(
        x, y,
        gem ? "loot_gem" : "loot_coin"
      ).setDepth(y + 1);

      this.tweens.add({
        targets: sprite,
        x: x + P.Math.Between(-45, 45),
        y: y + P.Math.Between(-25, 25),
        duration: 300
      });

      this.drops.push({
        sprite,
        gem,
        ready: this.time.now + 350
      });
    }
  }

  updateHUD(now) {
    if (now - this.lastHud < 160) return;
    this.lastHud = now;

    const w = this.scale.width;
    const width = Math.max(
      150, Math.min(w - 110, 315)
    );

    this.hud.clear();

    this.hud.fillStyle(0x112638, 0.94);
    this.hud.fillRoundedRect(
      8, 8, width, 100, 7
    );

    this.hud.lineStyle(2, 0xc59b54);
    this.hud.strokeRoundedRect(
      8, 8, width, 100, 7
    );

    this.hud.fillStyle(0x482b31);
    this.hud.fillRect(16, 37, width - 18, 12);

    this.hud.fillStyle(0xd94848);
    this.hud.fillRect(
      16, 37,
      (width - 18) * this.hp / this.maxHp,
      12
    );

    this.hud.fillStyle(0x23334a);
    this.hud.fillRect(16, 58, width - 18, 8);

    this.hud.fillStyle(0x49baff);
    this.hud.fillRect(
      16, 58,
      (width - 18) * this.exp /
      (this.level * 50),
      8
    );

    this.hudText.setText(
      `LV.${this.level} HP ${this.hp}/${this.maxHp}` +
      `\n\n\nGOLD ${this.gold} GEM ${this.gems}` +
      ` KILLS ${this.kills} ${VERSION}`
    );

    this.fpsText.setText(
      "FPS " + Math.round(this.fps)
    );
  }

  update(now, delta) {
    const dt = Math.min(delta / 1000, 0.05);

    this.fps = this.fps * 0.95 +
      Math.min(
        120, 1000 / Math.max(delta, 1)
      ) * 0.05;

    let x = this.joy.x;
    let y = this.joy.y;

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

    const moving = len > 0.1;

    const speed = this.attacking
      ? HERO_SPEED * 0.48 : HERO_SPEED;

    this.hero.setVelocity(
      x * speed, y * speed
    );

    if (this.attacking) {
      if (
        !this.attackHitDone &&
        now >= this.attackImpact
      ) {
        this.attackHitDone = true;
        this.resolveAttack();
      }

      if (now >= this.attackEnd) {
        this.attacking = false;
        this.action = "";
      }
    }

    if (!this.attacking) {
      const dir = moving
        ? this.facingFromInput(x, y)
        : this.direction;

      this.playHero(
        moving ? "walk" : "idle",
        dir
      );
    }

    this.hero.setDepth(this.hero.y);

    this.heroShadow
      .setPosition(this.hero.x, this.hero.y)
      .setDepth(this.hero.y - 1);

    // Monster movement, hurt, and knockback.
    for (const m of this.monsters) {
      const s = m.sprite;

      const dx = this.hero.x - s.x;
      const dy = this.hero.y - s.y;
      const dist = Math.hypot(dx, dy);

      if (now < m.knockUntil) {
        s.setVelocity(m.knockX, m.knockY);

        const friction = Math.max(0, 1 - dt * 7);
        m.knockX *= friction;
        m.knockY *= friction;
      } else if (dist < 310 && dist > 55) {
        s.setVelocity(
          dx / dist * m.speed,
          dy / dist * m.speed
        );
      } else {
        s.setVelocity(0, 0);
      }

      if (now >= m.hurtUntil) {
        s.clearTint();
      }

      if (now - m.lastFrame > 160) {
        m.lastFrame = now;
        m.frame = (m.frame + 1) % 4;

        s.setTexture(
          this.monsterTexture(m.type, m.frame)
        );

        const height = m.type === "boar" ? 90 : 76;
        s.setScale(height / s.height);
      }

      s.setDepth(s.y);

      m.shadow
        .setPosition(s.x, s.y)
        .setDepth(s.y - 1);

      m.bar.clear();

      if (dist < 430) {
        const by =
          s.y - s.displayHeight - 13;

        m.bar.fillStyle(0x172920);
        m.bar.fillRect(s.x - 27, by, 54, 8);

        m.bar.fillStyle(0xe04c4b);
        m.bar.fillRect(
          s.x - 26, by + 1,
          52 * Math.max(0, m.hp / m.maxHp),
          6
        );
      }

      m.bar.setDepth(s.y + 1);

      if (
        dist < 53 &&
        now >= m.knockUntil &&
        now - m.lastHit > 1700 &&
        now - this.lastDamage > 450
      ) {
        m.lastHit = now;
        this.lastDamage = now;

        this.hp = Math.max(
          0, this.hp -
          (m.type === "boar" ? 6 : 3)
        );

        this.hero.setTintFill(0xff7777);

        this.time.delayedCall(120, () => {
          if (this.hero.active) {
            this.hero.clearTint();
          }
        });
      }
    }

    // Hold attack to chain the three strikes.
    if (
      (this.attackHeld || this.keys.SPACE.isDown) &&
      !this.attacking &&
      now - this.lastAttack >= 290
    ) {
      this.attack(now);
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (now < d.ready) continue;

      const s = d.sprite;

      const distance = P.Math.Distance.Between(
        this.hero.x, this.hero.y,
        s.x, s.y
      );

      if (distance < 145) {
        const t = Math.min(1, dt * 7);

        s.x += (this.hero.x - s.x) * t;
        s.y += (this.hero.y - 20 - s.y) * t;
      }

      if (distance < 26) {
        if (d.gem) this.gems++;
        else this.gold++;

        s.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (
      this.monsters.length < 12 &&
      now - this.lastSpawn > 1000
    ) {
      this.lastSpawn = now;
      this.spawnMonster();
    }

    if (this.hp <= 0) {
      this.hp = this.maxHp;
      this.hero.setPosition(900, 650);
      this.hero.setVelocity(0, 0);
      this.cameras.main.flash(
        180, 255, 50, 50
      );
    }

    if (now > this.comboUntil && !this.attacking) {
      this.combo = 0;
    }

    if (
      now > this.lastAttack + 850 &&
      !this.attacking
    ) {
      this.comboText.setAlpha(0);
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
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: P.Scale.CENTER_BOTH
  },

  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },

  physics: {
    default: "arcade",
    arcade: { debug: false }
  },

  scene: [QuarterRPG]
});
