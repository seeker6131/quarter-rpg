
const loading = document.getElementById('loading');

if (!window.Phaser) {
  if (loading) loading.textContent = 'Phaser โหลดไม่สำเร็จ';
  throw Error('Phaser unavailable');
}

const P = window.Phaser;
const WW = 1800;
const HH = 1200;

class GameScene extends P.Scene {
  constructor() {
    super('game');
  }

  create() {
    if (loading) loading.remove();

    this.physics.world.setBounds(0, 0, WW, HH);
    this.cameras.main.setBackgroundColor('#264b48');

    this.createTextures();
    this.createMap();

    this.gold = 0;
    this.kills = 0;
    this.level = 1;
    this.exp = 0;
    this.hp = 100;
    this.lastAttack = 0;
    this.lastSpawn = 0;
    this.move = { x: 0, y: 0 };
    this.joyId = null;
    this.monsters = [];
    this.drops = [];

    this.player = this.actor(900, 600, true);

    for (let i = 0; i < 9; i++) {
      this.spawn();
    }

    this.cameras.main
      .setBounds(0, 0, WW, HH)
      .startFollow(this.player.sprite, true, 0.1, 0.1);

    this.createUI();

    this.keys = this.input.keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE'
    );

    this.scale.on('resize', this.layout, this);
    this.layout();

    this.input.on('pointerdown', p => {
      if (
        p.x < this.scale.width * 0.48 &&
        p.y > this.scale.height * 0.42 &&
        this.joyId === null
      ) {
        this.joyId = p.id;
        this.moveJoy(p);
      } else if (
        p.x > this.scale.width * 0.52 &&
        p.y > this.scale.height * 0.4
      ) {
        this.manual = true;
      }
    });

    this.input.on('pointermove', p => {
      if (p.id === this.joyId) this.moveJoy(p);
    });

    const release = p => {
      if (p.id === this.joyId) {
        this.joyId = null;
        this.move = { x: 0, y: 0 };
        this.knob.setPosition(this.base.x, this.base.y);
      }
    };

    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const save = (name, w, h) => {
      g.generateTexture(name, w, h);
      g.clear();
    };

    // Hero
    g.fillStyle(0x243a66);
    g.fillRoundedRect(13, 45, 14, 21, 3);
    g.fillRoundedRect(29, 45, 14, 21, 3);

    g.fillStyle(0x4c98d9);
    g.fillRoundedRect(9, 22, 38, 31, 7);

    g.fillStyle(0xf0c49c);
    g.fillCircle(28, 16, 15);

    g.fillStyle(0x513725);
    g.fillEllipse(28, 7, 31, 13);

    g.fillStyle(0x192d3a);
    g.fillRect(35, 18, 5, 4);

    g.lineStyle(4, 0xf5e6b6);
    g.lineBetween(48, 37, 61, 13);

    save('hero', 66, 70);

    // Monster
    g.fillStyle(0x3b743c);
    g.fillRoundedRect(12, 41, 12, 15, 3);
    g.fillRoundedRect(32, 41, 12, 15, 3);

    g.fillStyle(0x76be63);
    g.fillEllipse(28, 34, 27, 22);

    g.fillStyle(0xb6e78b);
    g.fillCircle(28, 19, 17);

    g.fillStyle(0x203a25);
    g.fillCircle(35, 19, 3);

    save('slime', 56, 61);

    // Coin
    g.fillStyle(0xffd45c);
    g.fillCircle(12, 12, 10);
    g.lineStyle(3, 0xa86c28);
    g.strokeCircle(12, 12, 10);
    save('coin', 24, 24);

    // Gem
    g.fillStyle(0x65d9ff);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 24, y: 12 },
      { x: 12, y: 24 },
      { x: 0, y: 12 }
    ], true);
    save('gem', 24, 24);

    g.destroy();
  }

  createMap() {
    const g = this.add.graphics().setDepth(-10000);

    g.fillStyle(0x315b48);
    g.fillRect(0, 0, WW, HH);

    for (let i = 0; i < 420; i++) {
      const x = P.Math.Between(0, WW);
      const y = P.Math.Between(0, HH);

      g.fillStyle(
        i % 3 ? 0x56825c : 0x739667,
        0.45
      );

      g.fillEllipse(
        x, y,
        P.Math.Between(5, 25),
        P.Math.Between(2, 8)
      );
    }

    g.fillStyle(0x977b53, 0.35);
    g.fillEllipse(900, 600, 780, 340);

    for (let i = 0; i < 55; i++) {
      const x = P.Math.Between(45, WW - 45);
      const y = P.Math.Between(40, HH - 40);

      if (Math.hypot(x - 900, y - 600) < 230) continue;

      const c = this.add.container(x, y).setDepth(y);

      c.add([
        this.add.ellipse(
          0, 0, 70, 20, 0x0b3028, 0.4
        ),
        this.add.rectangle(
          0, -32, 19, 65, 0x785338
        ),
        this.add.ellipse(
          0, -84, 85, 82, 0x2c8051
        ).setStrokeStyle(4, 0x18583a)
      ]);
    }
  }

  actor(x, y, hero) {
    const shadow = this.add.ellipse(
      x, y, 44, 14, 0x091e19, 0.42
    ).setDepth(y - 1);

    const sprite = this.physics.add.sprite(
      x, y, hero ? 'hero' : 'slime'
    ).setOrigin(0.5, 1).setDepth(y);

    sprite.body.setSize(30, 16);
    sprite.body.setOffset(
      hero ? 13 : 13,
      hero ? 52 : 43
    );
    sprite.setCollideWorldBounds(true);

    const bar = this.add.graphics().setDepth(y + 1);

    return {
      sprite,
      shadow,
      bar,
      hp: hero ? 100 : 40,
      maxHp: hero ? 100 : 40,
      lastHit: 0,
      homeX: x,
      homeY: y,
      hero
    };
  }

  spawn() {
    const x = P.Math.Between(50, WW - 50);
    const y = P.Math.Between(60, HH - 60);

    if (
      Math.hypot(
        x - this.player.sprite.x,
        y - this.player.sprite.y
      ) < 230
    ) return;

    this.monsters.push(this.actor(x, y, false));
  }

  createUI() {
    this.hud = this.add.text(12, 10, '', {
      fontFamily: 'system-ui',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#fff',
      backgroundColor: '#102b38dd',
      padding: { x: 12, y: 8 }
    }).setScrollFactor(0).setDepth(99999);

    this.base = this.add.circle(
      90, 0, 64, 0x0e3043, 0.6
    ).setStrokeStyle(3, 0xd1e9f2, 0.5)
      .setScrollFactor(0).setDepth(99999);

    this.knob = this.add.circle(
      90, 0, 28, 0xa4d9f8, 0.9
    ).setScrollFactor(0).setDepth(100000);

    this.attackBtn = this.add.circle(
      0, 0, 52, 0xc15d39, 0.85
    ).setStrokeStyle(4, 0xffd59a)
      .setScrollFactor(0).setDepth(99999);

    this.attackText = this.add.text(0, 0, 'ตี', {
      fontFamily: 'system-ui',
      fontSize: '23px',
      fontStyle: 'bold',
      color: '#fff'
    }).setOrigin(0.5)
      .setScrollFactor(0).setDepth(100000);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.base.setPosition(90, h - 90);
    this.knob.setPosition(90, h - 90);
    this.attackBtn.setPosition(w - 86, h - 90);
    this.attackText.setPosition(w - 86, h - 90);
  }

  moveJoy(p) {
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const d = Math.hypot(dx, dy);
    const s = Math.min(1, d / 55);

    this.move = d
      ? { x: dx / d * s, y: dy / d * s }
      : { x: 0, y: 0 };

    this.knob.setPosition(
      this.base.x + this.move.x * 44,
      this.base.y + this.move.y * 44
    );
  }

  floatText(x, y, value, crit) {
    const t = this.add.text(
      x, y,
      (crit ? 'CRIT ' : '') + '-' + value,
      {
        fontSize: crit ? '24px' : '19px',
        fontStyle: 'bold',
        color: crit ? '#ffc366' : '#fff3b3',
        stroke: '#38231c',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets: t,
      y: y - 52,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy()
    });
  }

  damage(m) {
    const crit = Math.random() < 0.15;
    const dmg = crit ? 24 : 12;

    m.hp -= dmg;
    m.sprite.setTintFill(0xffffff);

    this.time.delayedCall(90, () => {
      if (m.sprite.active) m.sprite.clearTint();
    });

    this.floatText(
      m.sprite.x,
      m.sprite.y - 80,
      dmg,
      crit
    );

    this.tweens.add({
      targets: m.sprite,
      scaleX: 1.18,
      scaleY: 0.85,
      duration: 75,
      yoyo: true
    });

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

      this.drop(x, y);
    }
  }

  drop(x, y) {
    const count = P.Math.Between(2, 4);

    for (let i = 0; i < count; i++) {
      const gem = Math.random() < 0.16;

      const s = this.add.image(
        x, y - 30, gem ? 'gem' : 'coin'
      ).setDepth(y + 2);

      const tx = x + P.Math.Between(-65, 65);
      const ty = y + P.Math.Between(-25, 25);

      this.tweens.add({
        targets: s,
        x: tx,
        duration: 390,
        ease: 'Cubic.Out'
      });

      this.tweens.add({
        targets: s,
        y: y - 80,
        duration: 210,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          if (s.active) s.y = ty;
        }
      });

      this.drops.push({
        sprite: s,
        value: gem ? 5 : 1,
        ready: this.time.now + 480
      });
    }
  }

  attack(now) {
    const p = this.player.sprite;

    const near = this.monsters
      .filter(m =>
        P.Math.Distance.Between(
          p.x, p.y, m.sprite.x, m.sprite.y
        ) < 100
      )
      .sort((a, b) =>
        P.Math.Distance.Between(
          p.x, p.y, a.sprite.x, a.sprite.y
        ) -
        P.Math.Distance.Between(
          p.x, p.y, b.sprite.x, b.sprite.y
        )
      );

    if (!near.length) return;

    const m = near[0];
    this.lastAttack = now;

    p.setFlipX(m.sprite.x < p.x);
    p.setTintFill(0xd8f1ff);

    this.time.delayedCall(100, () => {
      if (p.active) p.clearTint();
    });

    const slash = this.add.ellipse(
      (p.x + m.sprite.x) / 2,
      (p.y + m.sprite.y) / 2 - 34,
      75, 26, 0xcaf3ff, 0.8
    ).setDepth(15000);

    this.tweens.add({
      targets: slash,
      angle: 50,
      scaleX: 1.45,
      alpha: 0,
      duration: 190,
      onComplete: () => slash.destroy()
    });

    this.damage(m);
  }

  update(now, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const p = this.player.sprite;

    let x = this.move.x;
    let y = this.move.y;

    if (this.keys) {
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
    }

    const len = Math.hypot(x, y);

    if (len > 1) {
      x /= len;
      y /= len;
    }

    p.setVelocity(x * 230, y * 230);

    if (x !== 0) p.setFlipX(x < 0);

    p.setDepth(p.y);

    p.setScale(
      1 + Math.sin(now * 0.016) *
        (len > 0.1 ? 0.025 : 0.008),
      1 + Math.sin(now * 0.016) *
        (len > 0.1 ? -0.025 : -0.008)
    );

    this.player.shadow
      .setPosition(p.x, p.y)
      .setDepth(p.y - 1);

    for (const m of this.monsters) {
      const s = m.sprite;

      const d = P.Math.Distance.Between(
        s.x, s.y, p.x, p.y
      );

      if (d < 270 && d > 48) {
        s.setVelocity(
          (p.x - s.x) / d * 83,
          (p.y - s.y) / d * 83
        );
        s.setFlipX(p.x < s.x);
      } else {
        s.setVelocity(0, 0);
      }

      s.setDepth(s.y);

      m.shadow
        .setPosition(s.x, s.y)
        .setDepth(s.y - 1);

      m.bar.clear()
        .fillStyle(0x16251c, 0.9)
        .fillRoundedRect(
          s.x - 23, s.y - 76, 46, 7, 2
        )
        .fillStyle(0x83df78)
        .fillRoundedRect(
          s.x - 22,
          s.y - 75,
          44 * Math.max(0, m.hp / m.maxHp),
          5, 2
        );

      m.bar.setDepth(s.y + 1);

      if (d < 48 && now - m.lastHit > 1250) {
        m.lastHit = now;
        this.hp = Math.max(0, this.hp - 4);
        this.cameras.main.shake(60, 0.001);
      }
    }

    const nearby = this.monsters.some(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 100
    );

    if (
      now - this.lastAttack > 550 &&
      (
        nearby ||
        this.manual ||
        this.keys.SPACE.isDown
      )
    ) {
      this.attack(now);
    }

    this.manual = false;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const s = d.sprite;

      if (now < d.ready) continue;

      const dist = P.Math.Distance.Between(
        p.x, p.y, s.x, s.y
      );

      if (dist < 135) {
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
      this.monsters.length < 9 &&
      now - this.lastSpawn > 1200
    ) {
      this.lastSpawn = now;
      this.spawn();
    }

    if (this.hp <= 0) {
      this.hp = 100;
      p.setPosition(900, 600);
      this.cameras.main.flash(200, 255, 65, 65);
    }

    this.hud.setText(
      '❤ ' + this.hp + '/100' +
      '   Gold ' + this.gold +
      '   Kills ' + this.kills +
      '\nLv.' + this.level +
      ' EXP ' + this.exp + '/' +
      (this.level * 50) +
      '  V0.2'
    );
  }
}

new P.Game({
  type: P.AUTO,
  parent: 'game',
  backgroundColor: '#14283b',
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
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [GameScene]
});
