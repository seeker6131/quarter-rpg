
const P = window.Phaser;

if (!P) throw new Error("Phaser not loaded");

const VERSION = "V0.5 PNG";
const WORLD_W = 1800;
const WORLD_H = 1300;
const SPEED = 220;

class QuarterRPG extends P.Scene {
  constructor() {
    super("QuarterRPG");
  }

  preload() {
    for (const type of ["hero", "slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `png_${type}_${i}`,
          `assets/${type}_${i}.png`
        );
      }
    }

    this.load.on("loaderror", file => {
      console.warn("Missing asset:", file.key);
    });
  }

  create() {
    document.getElementById("loading")?.remove();

    this.physics.world.setBounds(
      0, 0, WORLD_W, WORLD_H
    );

    this.cameras.main.setBackgroundColor("#284b38");

    this.gold = 0;
    this.gems = 0;
    this.kills = 0;
    this.level = 1;
    this.exp = 0;
    this.hp = 100;
    this.maxHp = 100;

    this.monsters = [];
    this.drops = [];
    this.joy = { x: 0, y: 0 };
    this.joyPointer = null;
    this.attackPointer = null;
    this.attackHeld = false;
    this.facing = 1;
    this.lastAttack = -1000;
    this.lastSkill = -5000;
    this.lastSpawn = 0;
    this.lastHUD = 0;
    this.fps = 60;

    this.makeFallbackTextures();
    this.makeMap();

    this.player = this.makeActor(
      "hero", 900, 650
    );

    for (let i = 0; i < 12; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .startFollow(
        this.player.sprite, true, 0.12, 0.12
      );

    this.cameras.main.setRoundPixels(true);

    this.makeUI();
    this.makeControls();
    this.layout();

    this.scale.on("resize", this.layout, this);
  }

  // Fallback pixel-art textures.
  makeFallbackTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const r = (x, y, w, h, color) => {
      g.fillStyle(color);
      g.fillRect(x * 3, y * 3, w * 3, h * 3);
    };

    const save = (name, w, h) => {
      g.generateTexture(name, w * 3, h * 3);
      g.clear();
    };

    for (let f = 0; f < 4; f++) {
      const step = [0, 1, 0, -1][f];

      // Hero
      r(9, 25, 7, 10, 0x18263b);
      r(20, 25, 7, 10, 0x18263b);
      r(8, 32 + step, 9, 4, 0x304c6c);
      r(19, 32 - step, 9, 4, 0x304c6c);

      r(6, 13, 25, 16, 0x16283f);
      r(9, 15, 19, 13, 0x246ba7);
      r(11, 17, 13, 5, 0x59a9d6);

      r(5, 17, 6, 10, 0xc89367);
      r(28, 17, 6, 10, 0xc89367);

      r(10, 4, 19, 13, 0x4c3025);
      r(12, 6, 16, 11, 0xe8af7c);
      r(9, 3, 19, 6, 0x65402a);
      r(23, 10, 2, 2, 0x142235);

      r(8, 14, 23, 4, 0xc5333c);
      r(3 - step, 17, 10, 3, 0xe4474a);

      r(32, 15, 3, 15, 0x74502f);
      r(30, 15, 7, 3, 0xf5c66b);
      r(32, 3, 4, 12, 0x8dd9f5);
      r(33, 1, 2, 3, 0xffffff);

      save(`fallback_hero_${f}`, 40, 38);

      // Slime
      r(3, 12 + step, 23, 10, 0x173d2b);
      r(5, 9 + step, 19, 11, 0x349655);
      r(7, 5 + step, 15, 11, 0x74dc80);
      r(8, 7 + step, 6, 3, 0xb3f5a1);
      r(9, 14 + step, 3, 3, 0x172c2a);
      r(19, 14 + step, 3, 3, 0x172c2a);

      save(`fallback_slime_${f}`, 30, 25);

      // Boar
      r(5, 10, 24, 15, 0x493020);
      r(7, 9, 21, 13, 0x95613e);
      r(2, 13, 12, 11, 0xa9714b);
      r(1, 17, 8, 5, 0xc38b60);
      r(7, 14, 3, 3, 0x15202a);
      r(10, 22, 4, 4, 0xffe4b2);
      r(12, 24, 5, 7 + step, 0x3d2a22);
      r(24, 24, 5, 7 - step, 0x3d2a22);
      r(25, 6, 6, 8, 0x5a3928);

      save(`fallback_boar_${f}`, 35, 35);
    }

    // Trees
    r(13, 24, 9, 17, 0x513324);
    r(15, 24, 5, 16, 0x9b653b);
    r(4, 15, 29, 15, 0x173d2d);
    r(3, 10, 31, 16, 0x286440);
    r(7, 4, 25, 16, 0x3f8c50);
    r(11, 2, 18, 11, 0x68b66a);
    r(8, 11, 8, 5, 0x83c777);
    save("tree", 37, 42);

    // Rock
    r(2, 9, 24, 10, 0x263941);
    r(5, 5, 19, 11, 0x657a80);
    r(8, 3, 13, 6, 0xa6b4b0);
    save("rock", 29, 21);

    // Bush
    r(2, 8, 22, 10, 0x19472f);
    r(5, 5, 18, 11, 0x3c8b4c);
    r(9, 2, 11, 8, 0x6dbb68);
    save("bush", 27, 20);

    // Coin
    r(2, 1, 9, 10, 0xb87a26);
    r(3, 2, 7, 8, 0xffd454);
    r(5, 3, 3, 5, 0xffef9b);
    save("coin", 13, 12);

    // Gem
    r(5, 0, 3, 3, 0xd5faff);
    r(3, 3, 7, 5, 0x70d9ff);
    r(2, 8, 9, 3, 0x248dc9);
    r(5, 11, 3, 3, 0x1d5e9e);
    save("gem", 13, 15);

    g.destroy();
  }

  textureFor(type, frame) {
    const png = `png_${type}_${frame}`;

    if (this.textures.exists(png)) return png;

    return `fallback_${type}_${frame}`;
  }

  makeMap() {
    const g = this.add.graphics()
      .setDepth(-10000);

    g.fillStyle(0x315d43);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grass details
    for (let i = 0; i < 1600; i++) {
      const x = P.Math.Between(0, WORLD_W);
      const y = P.Math.Between(0, WORLD_H);

      g.fillStyle(
        i % 2 ? 0x55864f : 0x76a764,
        0.55
      );
      g.fillRect(x, y, 5, 3);
    }

    // Dirt road
    g.fillStyle(0x5d5238);
    g.fillEllipse(900, 690, 1510, 330);

    g.fillStyle(0x9b8255);
    g.fillEllipse(900, 680, 1450, 275);

    g.fillStyle(0xb9a06d, 0.45);
    g.fillEllipse(900, 675, 1320, 205);

    // River
    g.fillStyle(0x163e59);
    g.fillRect(1290, 0, 300, 510);

    g.fillStyle(0x287fa8);
    g.fillRect(1305, 0, 270, 500);

    for (let i = 0; i < 110; i++) {
      const x = P.Math.Between(1310, 1570);
      const y = P.Math.Between(0, 490);

      g.fillStyle(0xb6effa, 0.45);
      g.fillRect(x, y, 15, 3);
    }

    // Wooden bridge
    g.fillStyle(0x3a2c22);
    g.fillRect(1250, 220, 390, 120);

    for (let x = 1260; x < 1630; x += 25) {
      g.fillStyle(0x9f7042);
      g.fillRect(x, 230, 22, 100);

      g.fillStyle(0x523a29);
      g.fillRect(x, 230, 3, 100);
    }

    // Trees and scenery
    for (let i = 0; i < 100; i++) {
      const x = P.Math.Between(60, WORLD_W - 60);
      const y = P.Math.Between(60, WORLD_H - 60);

      if (Math.hypot(x - 900, y - 650) < 240)
        continue;

      if (x > 1280 && x < 1600 && y < 520)
        continue;

      const n = P.Math.Between(0, 9);
      const type = n < 5 ? "tree"
        : n < 8 ? "bush" : "rock";

      this.add.ellipse(
        x, y,
        type === "tree" ? 75 : 42,
        14, 0x0c291e, 0.4
      ).setDepth(y - 1);

      this.add.image(x, y, type)
        .setOrigin(0.5, 1)
        .setDepth(y);
    }
  }

  makeActor(type, x, y) {
    const isHero = type === "hero";

    const sprite = this.physics.add.sprite(
      x, y, this.textureFor(type, 0)
    ).setOrigin(0.5, 1);

    // Normalize PNG and fallback sizes.
    const targetHeight = isHero ? 112
      : type === "boar" ? 90 : 76;

    const tex = sprite.texture.getSourceImage();

    const scale = targetHeight / tex.height;
    sprite.setScale(scale);

    // World-space collision box.
    const bw = isHero ? 34 : 38;
    const bh = 18;

    sprite.body.setSize(
      bw / scale, bh / scale
    );

    sprite.body.setOffset(
      (sprite.width - bw / scale) / 2,
      sprite.height - bh / scale
    );

    sprite.setCollideWorldBounds(true);
    sprite.setDepth(y);

    const shadow = this.add.ellipse(
      x, y, isHero ? 48 : 52,
      14, 0x09271c, 0.4
    ).setDepth(y - 1);

    return {
      type,
      sprite,
      shadow,
      bar: this.add.graphics(),
      hp: isHero ? 100 : type === "boar" ? 85 : 45,
      maxHp: isHero ? 100 : type === "boar" ? 85 : 45,
      frame: 0,
      lastFrame: 0,
      lastHit: 0,
      speed: type === "boar" ? 105 : 85
    };
  }

  spawnMonster() {
    const x = P.Math.Between(100, WORLD_W - 100);
    const y = P.Math.Between(100, WORLD_H - 100);

    if (Math.hypot(
      x - this.player.sprite.x,
      y - this.player.sprite.y
    ) < 250) return;

    const type = Math.random() < 0.25
      ? "boar" : "slime";

    this.monsters.push(
      this.makeActor(type, x, y)
    );
  }

  makeUI() {
    const fixed = obj => obj
      .setScrollFactor(0)
      .setDepth(20000);

    this.hudBg = fixed(this.add.graphics());

    this.hudText = fixed(this.add.text(
      17, 15, "", {
        fontFamily: "system-ui",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffffff"
      }
    ));

    this.fpsText = fixed(this.add.text(
      0, 13, "FPS 60", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffe08a",
        backgroundColor: "#13283cdd",
        padding: { x: 8, y: 6 }
      }
    ));

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
    const joyY = h - 105;
    const atkX = w - (w < 450 ? 80 : 105);
    const atkY = h - 105;

    this.joyBase.setPosition(joyX, joyY);
    this.joyKnob.setPosition(joyX, joyY);

    this.attackButton.setPosition(atkX, atkY);
    this.attackLabel.setPosition(atkX, atkY);

    this.skillButton.setPosition(
      atkX - 30, atkY - 105
    );

    this.skillLabel.setPosition(
      atkX - 30, atkY - 105
    );

    this.fpsText.setPosition(w - 90, 12);
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
        this.joyPointer === null
      ) {
        this.joyPointer = p.id;
        this.moveJoystick(p);
        return;
      }

      const skillDistance = P.Math.Distance.Between(
        p.x, p.y,
        this.skillButton.x,
        this.skillButton.y
      );

      if (skillDistance < 48) {
        this.useSkill(this.time.now);
        return;
      }

      const attackDistance = P.Math.Distance.Between(
        p.x, p.y,
        this.attackButton.x,
        this.attackButton.y
      );

      if (attackDistance < 75) {
        this.attackPointer = p.id;
        this.attackHeld = true;
        this.attack(this.time.now);
      }
    });

    this.input.on("pointermove", p => {
      if (p.id === this.joyPointer) {
        this.moveJoystick(p);
      }
    });

    const release = p => {
      if (p.id === this.joyPointer) {
        this.joyPointer = null;
        this.joy = { x: 0, y: 0 };

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
  }

  moveJoystick(p) {
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

  animateActor(a, now, moving) {
    const delay = moving ? 115 : 270;

    if (now - a.lastFrame < delay) return;

    a.lastFrame = now;
    a.frame = (a.frame + 1) % 4;

    const key = this.textureFor(a.type, a.frame);

    a.sprite.setTexture(key);

    // Keep PNG frames the same on-screen height.
    const targetHeight = a.type === "hero"
      ? 112 : a.type === "boar" ? 90 : 76;

    const source = a.sprite.texture.getSourceImage();
    const scale = targetHeight / source.height;

    a.sprite.setScale(scale);
  }

  slash(x, y, angle) {
    const g = this.add.graphics()
      .setPosition(x, y)
      .setRotation(angle)
      .setDepth(15000);

    g.lineStyle(12, 0x2473db, 0.6);
    g.beginPath();
    g.arc(0, 0, 48, -1.1, 1.1, false);
    g.strokePath();

    g.lineStyle(5, 0xb9f8ff);
    g.beginPath();
    g.arc(0, 0, 48, -1.1, 1.1, false);
    g.strokePath();

    g.setScale(0.6);

    this.tweens.add({
      targets: g,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 190,
      onComplete: () => g.destroy()
    });
  }

  floatingDamage(x, y, damage) {
    const text = this.add.text(
      x, y, "-" + damage, {
        fontFamily: "system-ui",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#fff2a4",
        stroke: "#34251d",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy()
    });
  }

  hitMonster(m, damage) {
    if (!m.sprite.active) return;

    m.hp -= damage;

    this.floatingDamage(
      m.sprite.x,
      m.sprite.y - 75,
      damage
    );

    m.sprite.setTintFill(0xffffff);

    this.time.delayedCall(90, () => {
      if (m.sprite.active) m.sprite.clearTint();
    });

    if (m.hp > 0) return;

    const x = m.sprite.x;
    const y = m.sprite.y;

    m.sprite.destroy();
    m.shadow.destroy();
    m.bar.destroy();

    const index = this.monsters.indexOf(m);

    if (index >= 0) {
      this.monsters.splice(index, 1);
    }

    this.kills++;
    this.exp += m.type === "boar" ? 20 : 10;

    while (this.exp >= this.level * 50) {
      this.exp -= this.level * 50;
      this.level++;
      this.hp = this.maxHp;
    }

    this.dropLoot(x, y);
  }

  attack(now) {
    if (now - this.lastAttack < 500) return;

    this.lastAttack = now;

    const p = this.player.sprite;

    const targets = this.monsters.filter(m =>
      P.Math.Distance.Between(
        p.x, p.y,
        m.sprite.x, m.sprite.y
      ) < 125
    );

    if (!targets.length) {
      this.slash(
        p.x + this.facing * 50,
        p.y - 45,
        this.facing < 0 ? Math.PI : 0
      );
      return;
    }

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
    const angle = Math.atan2(dy, dx);

    this.facing = dx < 0 ? -1 : 1;
    p.setFlipX(this.facing < 0);

    this.slash(
      p.x + Math.cos(angle) * 55,
      p.y - 45 + Math.sin(angle) * 25,
      angle
    );

    const critical = Math.random() < 0.15;
    this.hitMonster(m, critical ? 28 : 15);
  }

  useSkill(now) {
    if (now - this.lastSkill < 3500) return;

    this.lastSkill = now;

    const p = this.player.sprite;

    const ring = this.add.circle(
      p.x, p.y - 30,
      20, 0x55dfff, 0.2
    ).setStrokeStyle(5, 0xb5f5ff)
      .setDepth(15000);

    this.tweens.add({
      targets: ring,
      scaleX: 7,
      scaleY: 7,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy()
    });

    for (const m of [...this.monsters]) {
      const d = P.Math.Distance.Between(
        p.x, p.y,
        m.sprite.x, m.sprite.y
      );

      if (d < 160) {
        this.hitMonster(m, 27);
      }
    }
  }

  dropLoot(x, y) {
    const count = P.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const gem = Math.random() < 0.2;

      const s = this.add.image(
        x, y,
        gem ? "gem" : "coin"
      ).setDepth(y + 2);

      const tx = x + P.Math.Between(-50, 50);
      const ty = y + P.Math.Between(-25, 25);

      this.tweens.add({
        targets: s,
        x: tx,
        y: ty,
        duration: 350,
        ease: "Cubic.Out"
      });

      this.drops.push({
        sprite: s,
        gem,
        ready: this.time.now + 400
      });
    }
  }

  updateHUD(now) {
    if (now - this.lastHUD < 150) return;

    this.lastHUD = now;

    const w = this.scale.width;
    const pw = Math.max(
      150, Math.min(w - 110, 315)
    );

    this.hudBg.clear();

    this.hudBg.fillStyle(0x112638, 0.94);
    this.hudBg.fillRoundedRect(
      8, 8, pw, 100, 7
    );

    this.hudBg.lineStyle(2, 0xc59b54);
    this.hudBg.strokeRoundedRect(
      8, 8, pw, 100, 7
    );

    this.hudBg.fillStyle(0x482b31);
    this.hudBg.fillRect(16, 37, pw - 18, 12);

    this.hudBg.fillStyle(0xd94848);
    this.hudBg.fillRect(
      16, 37,
      (pw - 18) * this.hp / this.maxHp,
      12
    );

    this.hudBg.fillStyle(0x23334a);
    this.hudBg.fillRect(16, 58, pw - 18, 8);

    this.hudBg.fillStyle(0x49baff);
    this.hudBg.fillRect(
      16, 58,
      (pw - 18) * this.exp /
      (this.level * 50),
      8
    );

    this.hudText.setFontSize(w < 450 ? 12 : 14);

    this.hudText.setText(
      `LV.${this.level}  HP ${this.hp}/${this.maxHp}` +
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
      Math.min(120, 1000 / Math.max(1, delta)) * 0.05;

    const p = this.player.sprite;

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

    p.setVelocity(x * SPEED, y * SPEED);

    if (Math.abs(x) > 0.1) {
      this.facing = x < 0 ? -1 : 1;
      p.setFlipX(this.facing < 0);
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
      const dist = Math.hypot(dx, dy);

      if (dist < 330 && dist > 48) {
        s.setVelocity(
          dx / dist * m.speed,
          dy / dist * m.speed
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
        m, now, dist < 330 && dist > 48
      );

      m.bar.clear();

      if (dist < 450) {
        m.bar.fillStyle(0x1b2822);
        m.bar.fillRect(
          s.x - 27, s.y - 90, 54, 8
        );

        m.bar.fillStyle(0xd84942);
        m.bar.fillRect(
          s.x - 26, s.y - 89,
          52 * Math.max(0, m.hp / m.maxHp),
          6
        );
      }

      m.bar.setDepth(s.y + 1);

      if (
        dist < 48 &&
        now - m.lastHit > 1250
      ) {
        m.lastHit = now;

        this.hp = Math.max(
          0,
          this.hp - (m.type === "boar" ? 7 : 4)
        );

        this.cameras.main.shake(50, 0.001);
      }
    }

    if (
      (this.attackHeld || this.keys.SPACE.isDown) &&
      now - this.lastAttack > 500
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
      this.monsters.length < 12 &&
      now - this.lastSpawn > 1000
    ) {
      this.lastSpawn = now;
      this.spawnMonster();
    }

    if (this.hp <= 0) {
      this.hp = this.maxHp;
      p.setPosition(900, 650);
      p.setVelocity(0, 0);
      this.cameras.main.flash(180, 255, 50, 50);
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
