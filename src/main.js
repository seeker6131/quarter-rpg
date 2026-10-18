
const P = window.Phaser;

if (!P) throw new Error("Phaser not loaded");

const VERSION = "V0.6";
const WW = 1800;
const WH = 1300;
const SPEED = 220;

class QuarterRPG extends P.Scene {
  constructor() {
    super("QuarterRPG");
  }

  preload() {
    const characters = ["hero", "slime", "boar"];
    const forest = [
      "tree", "bush", "rock", "flower",
      "stump", "grass", "dirt", "water"
    ];

    for (const type of characters) {
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `${type}_${i}`,
          `assets/${type}_${i}.png`
        );
      }
    }

    for (const name of forest) {
      this.load.image(
        `forest_${name}`,
        `assets/${name}.png`
      );
    }

    this.load.on("loaderror", file => {
      console.warn("Asset missing:", file.key);
    });
  }

  create() {
    document.getElementById("loading")?.remove();

    this.physics.world.setBounds(0, 0, WW, WH);
    this.cameras.main.setBackgroundColor("#285a40");

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

    this.makeFallbacks();
    this.makeMap();

    this.player = this.makeActor(
      "hero", 900, 650
    );

    for (let i = 0; i < 12; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, WW, WH)
      .startFollow(
        this.player.sprite, true, 0.12, 0.12
      )
      .setRoundPixels(true);

    this.makeUI();
    this.makeControls();
    this.layout();

    this.scale.on("resize", this.layout, this);
  }

  makeFallbacks() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const rect = (x, y, w, h, c) => {
      g.fillStyle(c);
      g.fillRect(x, y, w, h);
    };

    const save = (name, w, h) => {
      g.generateTexture(name, w, h);
      g.clear();
    };

    // Fallback characters
    for (const type of ["hero", "slime", "boar"]) {
      for (let i = 0; i < 4; i++) {
        if (type === "hero") {
          rect(16, 4, 22, 19, 0x754b2c);
          rect(19, 12, 18, 16, 0xf2bc86);
          rect(12, 29, 30, 24, 0x2367a1);
          rect(10, 29, 33, 6, 0xc73743);
          rect(17, 53, 9, 16, 0x1c2c45);
          rect(30, 53, 9, 16, 0x1c2c45);
          rect(45, 12, 5, 40, 0xbceaff);
          save(`fallback_${type}_${i}`, 60, 72);
        } else if (type === "slime") {
          g.fillStyle(0x48b967);
          g.fillEllipse(32, 34 + i % 2, 54, 43);
          rect(18, 31, 6, 7, 0x19352c);
          rect(40, 31, 6, 7, 0x19352c);
          save(`fallback_${type}_${i}`, 64, 56);
        } else {
          g.fillStyle(0x91613f);
          g.fillEllipse(37, 32, 62, 42);
          rect(5, 24, 20, 19, 0xb67b50);
          rect(12, 26, 5, 5, 0x1d2529);
          rect(18, 44, 7, 14, 0x493022);
          rect(49, 44, 7, 14, 0x493022);
          save(`fallback_${type}_${i}`, 76, 62);
        }
      }
    }

    // Coin
    g.fillStyle(0xffd35c);
    g.fillCircle(12, 12, 10);
    g.lineStyle(3, 0xa36a26);
    g.strokeCircle(12, 12, 10);
    save("coin", 24, 24);

    // Gem
    g.fillStyle(0x65d8ff);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 22, y: 12 },
      { x: 12, y: 26 },
      { x: 2, y: 12 }
    ], true);
    save("gem", 24, 28);

    // Fallback scenery
    rect(12, 38, 16, 25, 0x825331);
    g.fillStyle(0x327d47);
    g.fillCircle(20, 27, 24);
    save("fallback_tree", 44, 66);

    g.fillStyle(0x438e50);
    g.fillEllipse(24, 22, 45, 30);
    save("fallback_bush", 48, 39);

    g.fillStyle(0x778a87);
    g.fillEllipse(25, 20, 46, 29);
    save("fallback_rock", 50, 36);

    rect(9, 6, 4, 20, 0x439b4d);
    g.fillStyle(0xffd58a);
    g.fillCircle(11, 7, 7);
    save("fallback_flower", 23, 29);

    rect(6, 8, 31, 20, 0x81502e);
    g.fillStyle(0xb8814c);
    g.fillEllipse(21, 9, 32, 13);
    save("fallback_stump", 43, 30);

    for (const [name, color] of [
      ["grass", 0x356d43],
      ["dirt", 0xa88a5b],
      ["water", 0x287da5]
    ]) {
      rect(0, 0, 64, 64, color);
      save(`fallback_${name}`, 64, 64);
    }

    g.destroy();
  }

  texture(name) {
    const key = `forest_${name}`;

    return this.textures.exists(key)
      ? key
      : `fallback_${name}`;
  }

  characterTexture(type, frame) {
    const key = `${type}_${frame}`;

    return this.textures.exists(key)
      ? key
      : `fallback_${type}_${frame}`;
  }

  makeMap() {
    // Ground textures are created once.
    this.add.tileSprite(
      WW / 2, WH / 2,
      WW, WH,
      this.texture("grass")
    ).setDepth(-10000);

    // Dirt path
    const road = this.add.graphics()
      .setDepth(-9999);

    road.fillStyle(0x5c4b33);
    road.fillEllipse(900, 700, 1520, 340);

    road.fillStyle(0x9c8052);
    road.fillEllipse(900, 690, 1470, 290);

    road.fillStyle(0xb79a68, 0.65);
    road.fillEllipse(900, 685, 1390, 240);

    // Path decoration
    for (let i = 0; i < 220; i++) {
      const x = P.Math.Between(180, 1600);
      const y = P.Math.Between(615, 785);

      road.fillStyle(
        i % 2 ? 0xd0b17c : 0x796343,
        0.5
      );

      road.fillRect(x, y, 5, 3);
    }

    // River
    this.add.tileSprite(
      1440, 250,
      300, 500,
      this.texture("water")
    ).setDepth(-9998);

    // Wooden bridge
    const bridge = this.add.graphics()
      .setDepth(-9997);

    bridge.fillStyle(0x392a21);
    bridge.fillRect(1240, 215, 390, 120);

    for (let x = 1250; x < 1620; x += 27) {
      bridge.fillStyle(
        x % 2 ? 0x9b6b3e : 0xb37c45
      );
      bridge.fillRect(x, 224, 24, 100);

      bridge.fillStyle(0x4e3827);
      bridge.fillRect(x, 224, 3, 100);
    }

    // Forest scenery
    for (let i = 0; i < 145; i++) {
      const x = P.Math.Between(65, WW - 65);
      const y = P.Math.Between(65, WH - 65);

      if (Math.hypot(x - 900, y - 650) < 235)
        continue;

      if (x > 1270 && x < 1610 && y < 510)
        continue;

      const n = P.Math.Between(0, 99);

      const type = n < 37 ? "tree"
        : n < 60 ? "bush"
        : n < 75 ? "rock"
        : n < 90 ? "flower"
        : "stump";

      this.addScenery(x, y, type);
    }

    // Additional forest clusters
    for (const [x, y, type] of [
      [600, 450, "tree"],
      [720, 450, "tree"],
      [1150, 470, "tree"],
      [530, 890, "tree"],
      [1260, 900, "tree"],
      [800, 510, "bush"],
      [1090, 520, "bush"],
      [730, 850, "rock"],
      [1100, 850, "rock"],
      [830, 590, "flower"],
      [1040, 590, "flower"]
    ]) {
      this.addScenery(x, y, type);
    }
  }

  addScenery(x, y, type) {
    const sizes = {
      tree: 155,
      bush: 67,
      rock: 57,
      flower: 32,
      stump: 51
    };

    const key = this.texture(type);
    const source = this.textures.get(key).getSourceImage();
    const scale = sizes[type] / source.height;

    const shadowWidth =
      type === "tree" ? 78 : 39;

    this.add.ellipse(
      x, y,
      shadowWidth, 13,
      0x0b261b, 0.3
    ).setDepth(y - 1);

    this.add.image(x, y, key)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(y);
  }

  makeActor(type, x, y) {
    const isHero = type === "hero";

    const sprite = this.physics.add.sprite(
      x, y,
      this.characterTexture(type, 0)
    ).setOrigin(0.5, 1);

    const targetHeight = isHero ? 112
      : type === "boar" ? 90 : 76;

    const source = sprite.texture.getSourceImage();
    const scale = targetHeight / source.height;

    sprite.setScale(scale);

    const bw = isHero ? 34 : 38;
    const bh = 18;

    sprite.body.setSize(bw / scale, bh / scale);

    sprite.body.setOffset(
      (sprite.width - bw / scale) / 2,
      sprite.height - bh / scale
    );

    sprite.setCollideWorldBounds(true);
    sprite.setDepth(y);

    const shadow = this.add.ellipse(
      x, y,
      isHero ? 48 : 52,
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
    const x = P.Math.Between(100, WW - 100);
    const y = P.Math.Between(100, WH - 100);

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
          this.joyBase.x,
          this.joyBase.y
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

    const key = this.characterTexture(
      a.type, a.frame
    );

    a.sprite.setTexture(key);

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
      m.sprite.y - m.sprite.displayHeight - 10,
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
        const barY =
          s.y - s.displayHeight - 14;

        m.bar.fillStyle(0x1b2822);
        m.bar.fillRect(
          s.x - 27, barY, 54, 8
        );

        m.bar.fillStyle(0xd84942);
        m.bar.fillRect(
          s.x - 26, barY + 1,
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
