
const P = window.Phaser;
const loading = document.getElementById("loading");

if (!P) {
  if (loading) loading.textContent = "Phaser load failed";
  throw new Error("Phaser unavailable");
}

const WW = 1800, HH = 1200;
const TILE = 32;
const SPEED = 220;

class RPG extends P.Scene {
  constructor() {
    super("RPG");
  }

  create() {
    if (loading) loading.remove();

    this.physics.world.setBounds(0, 0, WW, HH);
    this.cameras.main.setBackgroundColor("#244f43");

    this.gold = 0;
    this.exp = 0;
    this.level = 1;
    this.kills = 0;
    this.hp = 100;
    this.monsters = [];
    this.drops = [];
    this.lastAttack = 0;
    this.lastSpawn = 0;
    this.move = { x: 0, y: 0 };
    this.joyId = null;
    this.manualAttack = false;

    this.createTextures();
    this.createMap();

    this.player = this.createActor(900, 600, true);

    for (let i = 0; i < 10; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, WW, HH)
      .startFollow(this.player.sprite, true, 0.1, 0.1);

    this.createUI();
    this.createControls();

    this.scale.on("resize", this.layoutUI, this);
    this.layoutUI();
  }

  // Create pixel textures without external assets
  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const pixel = (x, y, w, h, color) => {
      g.fillStyle(color);
      g.fillRect(x * 3, y * 3, w * 3, h * 3);
    };

    const save = (name, w, h) => {
      g.generateTexture(name, w * 3, h * 3);
      g.clear();
    };

    // Hero: three-quarter facing
    for (let f = 0; f < 4; f++) {
      const walk = f % 2 ? 1 : -1;
      const name = "hero" + f;

      pixel(6, 19, 5, 6, 0x182b47);
      pixel(12, 19, 5, 6, 0x182b47);
      pixel(6, 24 + walk, 5, 2, 0x101d35);
      pixel(12, 24 - walk, 5, 2, 0x101d35);

      pixel(5, 10, 13, 10, 0x15283c);
      pixel(6, 11, 11, 8, 0x3978b8);
      pixel(7, 11, 5, 3, 0x69b7f2);

      pixel(3, 12, 3, 8, 0xd9a578);
      pixel(17, 12, 3, 8, 0xd9a578);

      pixel(6, 2, 12, 10, 0x302b32);
      pixel(7, 4, 10, 8, 0xf2c69b);
      pixel(7, 2, 10, 4, 0x54372d);

      pixel(15, 7, 2, 2, 0x18283a);
      pixel(11, 8, 2, 2, 0x18283a);

      pixel(19, 10, 2, 13, 0x513e2c);
      pixel(18, 1, 4, 12, 0xd6e9ef);
      pixel(19, 0, 2, 2, 0xffffff);

      save(name, 24, 28);
    }

    // Slime animation
    for (let f = 0; f < 4; f++) {
      const bounce = f % 2;

      pixel(3, 12 + bounce, 18, 9, 0x1e513c);
      pixel(4, 9 + bounce, 16, 11, 0x55b76e);
      pixel(6, 6 + bounce, 12, 11, 0x80d986);
      pixel(8, 8 + bounce, 5, 3, 0xb8f5a0);
      pixel(8, 13 + bounce, 2, 3, 0x16372d);
      pixel(16, 13 + bounce, 2, 3, 0x16372d);
      pixel(10, 18 + bounce, 6, 2, 0x2b7546);

      save("slime" + f, 24, 24);
    }

    // Gold coin
    pixel(3, 0, 6, 2, 0xffeb8a);
    pixel(1, 2, 10, 8, 0xb97827);
    pixel(2, 1, 8, 9, 0xffcf4b);
    pixel(4, 3, 4, 5, 0xffef9b);
    save("coin", 12, 12);

    // Blue crystal
    pixel(5, 0, 2, 2, 0xc6f7ff);
    pixel(3, 2, 6, 3, 0x63cfff);
    pixel(1, 5, 10, 3, 0x208bc9);
    pixel(3, 8, 6, 3, 0x1b5d9c);
    pixel(5, 11, 2, 1, 0xa4edff);
    save("gem", 12, 12);

    // Tree
    pixel(10, 17, 6, 14, 0x563d2c);
    pixel(12, 18, 3, 11, 0x926a40);
    pixel(5, 8, 17, 16, 0x163f32);
    pixel(3, 6, 20, 14, 0x276747);
    pixel(6, 3, 15, 13, 0x36895a);
    pixel(9, 2, 10, 7, 0x58a86b);
    pixel(5, 9, 5, 3, 0x79b977);
    save("tree", 26, 32);

    // Rock
    pixel(3, 8, 18, 8, 0x303e4b);
    pixel(5, 4, 14, 10, 0x667985);
    pixel(8, 3, 8, 4, 0x9daeb2);
    pixel(13, 8, 6, 4, 0x465969);
    save("rock", 24, 17);

    // Bush
    pixel(2, 8, 18, 6, 0x1d4b38);
    pixel(3, 5, 16, 8, 0x337d4c);
    pixel(7, 2, 9, 8, 0x5aa668);
    save("bush", 22, 15);

    g.destroy();
  }

  createMap() {
    const g = this.add.graphics().setDepth(-10000);

    g.fillStyle(0x315e48);
    g.fillRect(0, 0, WW, HH);

    // Pixel grass
    for (let i = 0; i < 900; i++) {
      const x = P.Math.Between(0, WW);
      const y = P.Math.Between(0, HH);
      g.fillStyle(
        i % 3 ? 0x467b51 : 0x6a9a62,
        0.6
      );
      g.fillRect(x, y, 5, 3);
    }

    // Winding dirt road
    g.fillStyle(0x826f4c, 0.75);
    g.fillEllipse(900, 600, 1000, 290);
    g.fillStyle(0xa38b5d, 0.45);
    g.fillEllipse(900, 600, 900, 220);

    for (let i = 0; i < 65; i++) {
      const x = P.Math.Between(35, WW - 35);
      const y = P.Math.Between(35, HH - 35);

      if (Math.hypot(x - 900, y - 600) < 190) continue;

      const kind = P.Math.Between(0, 3);
      const texture = kind === 0 ? "rock"
        : kind === 1 ? "bush" : "tree";

      const obj = this.add.image(x, y, texture);
      obj.setOrigin(0.5, 1);
      obj.setDepth(y);
    }
  }

  createActor(x, y, hero) {
    const shadow = this.add.ellipse(
      x, y, hero ? 45 : 48, 13,
      0x071e1a, 0.42
    ).setDepth(y - 1);

    const sprite = this.physics.add.sprite(
      x, y, hero ? "hero0" : "slime0"
    );

    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);
    sprite.setCollideWorldBounds(true);

    // Foot-level collision
    sprite.body.setSize(28, 14);
    sprite.body.setOffset(
      (sprite.width - 28) / 2,
      sprite.height - 14
    );

    const bar = this.add.graphics();

    return {
      sprite,
      shadow,
      bar,
      hero,
      hp: hero ? 100 : 45,
      maxHp: hero ? 100 : 45,
      lastHit: 0,
      frame: 0,
      lastFrame: 0,
      homeX: x,
      homeY: y
    };
  }

  spawnMonster() {
    const x = P.Math.Between(70, WW - 70);
    const y = P.Math.Between(70, HH - 70);

    if (
      Math.hypot(
        x - this.player.sprite.x,
        y - this.player.sprite.y
      ) < 200
    ) return;

    this.monsters.push(
      this.createActor(x, y, false)
    );
  }

  createUI() {
    this.hud = this.add.text(12, 10, "", {
      fontFamily: "system-ui",
      fontSize: "17px",
      fontStyle: "bold",
      color: "#fff",
      backgroundColor: "#122d3add",
      padding: { x: 12, y: 8 }
    }).setScrollFactor(0).setDepth(20000);

    this.base = this.add.circle(
      90, 0, 62, 0x0c2942, 0.65
    ).setStrokeStyle(3, 0xffffff, 0.45)
      .setScrollFactor(0).setDepth(20000);

    this.knob = this.add.circle(
      90, 0, 27, 0x9ed6ff, 0.9
    ).setScrollFactor(0).setDepth(20001);

    this.attackButton = this.add.circle(
      0, 0, 52, 0xc45b38, 0.85
    ).setStrokeStyle(4, 0xffd49a)
      .setScrollFactor(0).setDepth(20000);

    this.attackLabel = this.add.text(
      0, 0, "ตี", {
        fontFamily: "system-ui",
        fontSize: "23px",
        fontStyle: "bold",
        color: "#fff"
      }
    ).setOrigin(0.5)
      .setScrollFactor(0).setDepth(20001);
  }

  layoutUI() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.base.setPosition(90, h - 90);
    this.knob.setPosition(90, h - 90);
    this.attackButton.setPosition(w - 86, h - 90);
    this.attackLabel.setPosition(w - 86, h - 90);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE"
    );

    this.input.on("pointerdown", p => {
      if (
        p.x < this.scale.width * 0.48 &&
        p.y > this.scale.height * 0.4 &&
        this.joyId === null
      ) {
        this.joyId = p.id;
        this.moveJoystick(p);
      } else if (
        p.x > this.scale.width * 0.52 &&
        p.y > this.scale.height * 0.4
      ) {
        this.manualAttack = true;
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
    };

    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  moveJoystick(p) {
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const d = Math.hypot(dx, dy);
    const strength = Math.min(1, d / 55);

    this.move = d
      ? {
          x: dx / d * strength,
          y: dy / d * strength
        }
      : { x: 0, y: 0 };

    this.knob.setPosition(
      this.base.x + this.move.x * 44,
      this.base.y + this.move.y * 44
    );
  }

  floatDamage(x, y, dmg, crit) {
    const text = this.add.text(
      x, y,
      (crit ? "CRIT " : "") + "-" + dmg,
      {
        fontSize: crit ? "25px" : "20px",
        fontStyle: "bold",
        color: crit ? "#ffc45c" : "#fff1aa",
        stroke: "#34231b",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 650,
      onComplete: () => text.destroy()
    });
  }

  attack(now) {
    const p = this.player.sprite;

    const targets = this.monsters.filter(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 115
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
    const crit = Math.random() < 0.15;
    const dmg = crit ? 27 : 14;

    this.lastAttack = now;
    p.setFlipX(m.sprite.x < p.x);

    const slash = this.add.ellipse(
      (p.x + m.sprite.x) / 2,
      (p.y + m.sprite.y) / 2 - 35,
      75, 26, 0xd6f5ff, 0.8
    ).setDepth(15000);

    this.tweens.add({
      targets: slash,
      angle: 65,
      scaleX: 1.5,
      alpha: 0,
      duration: 190,
      onComplete: () => slash.destroy()
    });

    m.hp -= dmg;
    m.sprite.setTintFill(0xffffff);

    this.time.delayedCall(90, () => {
      if (m.sprite.active) m.sprite.clearTint();
    });

    this.floatDamage(
      m.sprite.x,
      m.sprite.y - 75,
      dmg, crit
    );

    if (m.hp <= 0) {
      const x = m.sprite.x;
      const y = m.sprite.y;

      m.sprite.destroy();
      m.shadow.destroy();
      m.bar.destroy();

      this.monsters.splice(
        this.monsters.indexOf(m), 1
      );

      this.kills++;
      this.exp += 10;

      while (this.exp >= this.level * 50) {
        this.exp -= this.level * 50;
        this.level++;
        this.hp = 100;
      }

      this.dropLoot(x, y);
    }
  }

  dropLoot(x, y) {
    const count = P.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const gem = Math.random() < 0.16;

      const sprite = this.add.image(
        x, y - 28,
        gem ? "gem" : "coin"
      ).setDepth(y + 2);

      const tx = x + P.Math.Between(-60, 60);
      const ty = y + P.Math.Between(-25, 25);

      this.tweens.add({
        targets: sprite,
        x: tx,
        duration: 390,
        ease: "Cubic.Out"
      });

      this.tweens.add({
        targets: sprite,
        y: y - 80,
        duration: 220,
        yoyo: true,
        ease: "Quad.Out",
        onComplete: () => {
          if (sprite.active) sprite.y = ty;
        }
      });

      this.drops.push({
        sprite,
        value: gem ? 5 : 1,
        ready: this.time.now + 500
      });
    }
  }

  animateActor(a, now, moving) {
    if (now - a.lastFrame < (moving ? 130 : 250)) {
      return;
    }

    a.lastFrame = now;
    a.frame = (a.frame + 1) % 4;

    a.sprite.setTexture(
      (a.hero ? "hero" : "slime") + a.frame
    );
  }

  update(now, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const p = this.player.sprite;

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

    if (x !== 0) p.setFlipX(x < 0);

    p.setDepth(p.y);

    this.player.shadow
      .setPosition(p.x, p.y)
      .setDepth(p.y - 1);

    this.animateActor(
      this.player, now, len > 0.1
    );

    for (const m of this.monsters) {
      const s = m.sprite;

      const d = P.Math.Distance.Between(
        s.x, s.y, p.x, p.y
      );

      if (d < 280 && d > 48) {
        s.setVelocity(
          (p.x - s.x) / d * 90,
          (p.y - s.y) / d * 90
        );

        s.setFlipX(p.x < s.x);
      } else {
        s.setVelocity(0, 0);
      }

      s.setDepth(s.y);

      m.shadow
        .setPosition(s.x, s.y)
        .setDepth(s.y - 1);

      this.animateActor(m, now, d < 280);

      m.bar.clear();

      m.bar.fillStyle(0x14281d, 0.9);
      m.bar.fillRect(s.x - 25, s.y - 78, 50, 8);

      m.bar.fillStyle(0x7ee177);
      m.bar.fillRect(
        s.x - 24,
        s.y - 77,
        48 * Math.max(0, m.hp / m.maxHp),
        6
      );

      m.bar.setDepth(s.y + 1);

      if (d < 48 && now - m.lastHit > 1200) {
        m.lastHit = now;
        this.hp = Math.max(0, this.hp - 4);
        this.cameras.main.shake(65, 0.001);
      }
    }

    const nearby = this.monsters.some(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 115
    );

    if (
      now - this.lastAttack > 550 &&
      (
        nearby ||
        this.manualAttack ||
        this.keys.SPACE.isDown
      )
    ) {
      this.attack(now);
    }

    this.manualAttack = false;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const s = d.sprite;

      if (now < d.ready) continue;

      const dist = P.Math.Distance.Between(
        p.x, p.y, s.x, s.y
      );

      if (dist < 140) {
        s.x += (p.x - s.x) * Math.min(1, dt * 6);
        s.y += (p.y - 25 - s.y) * Math.min(1, dt * 6);
      }

      s.setDepth(s.y + 1);

      if (dist < 25) {
        this.gold += d.value;
        s.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (
      this.monsters.length < 10 &&
      now - this.lastSpawn > 1100
    ) {
      this.lastSpawn = now;
      this.spawnMonster();
    }

    if (this.hp <= 0) {
      this.hp = 100;
      p.setPosition(900, 600);
      this.cameras.main.flash(200, 255, 60, 60);
    }

    this.hud.setText(
      "HP " + this.hp + "/100" +
      "   GOLD " + this.gold +
      "   KILLS " + this.kills +
      "\nLV." + this.level +
      "  EXP " + this.exp + "/" +
      (this.level * 50) +
      "  V0.3"
    );
  }
}

new P.Game({
  type: P.AUTO,
  parent: "game",
  backgroundColor: "#14283b",
  scale: {
    mode: P.Scale.RESIZE,
    width: innerWidth,
    height: innerHeight,
    autoCenter: P.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true,
    antialias: false
  },
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [RPG]
});
