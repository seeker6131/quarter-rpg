
const loading = document.getElementById('loading');

if (!window.Phaser) {
  loading.textContent = 'โหลด Phaser ไม่สำเร็จ';
  throw new Error('Phaser unavailable');
}

const P = window.Phaser;
const W = 1800;
const H = 1200;

class GameScene extends P.Scene {
  constructor() {
    super('game');
  }

  create() {
    loading.remove();

    this.cameras.main.setBackgroundColor('#254c55');
    this.physics.world.setBounds(0, 0, W, H);

    this.makeTextures();
    this.makeWorld();

    this.gold = 0;
    this.kills = 0;
    this.level = 1;
    this.exp = 0;
    this.hp = 100;
    this.move = { x: 0, y: 0 };
    this.touchId = null;
    this.lastAttack = 0;
    this.lastSpawn = 0;
    this.monsters = [];
    this.drops = [];

    this.player = this.makeActor(900, 600, true);

    for (let i = 0; i < 9; i++) {
      this.spawnMonster();
    }

    this.cameras.main
      .setBounds(0, 0, W, H)
      .startFollow(this.player.sprite, true, 0.1, 0.1);

    this.setupUI();

    this.keys = this.input.keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE'
    );

    this.scale.on('resize', this.placeUI, this);
    this.placeUI();

    this.input.on('pointerdown', p => {
      if (
        p.x < this.scale.width * 0.48 &&
        p.y > this.scale.height * 0.42 &&
        this.touchId === null
      ) {
        this.touchId = p.id;
        this.joystick(p);
      } else if (
        p.x > this.scale.width * 0.55 &&
        p.y > this.scale.height * 0.4
      ) {
        this.manualAttack = true;
      }
    });

    this.input.on('pointermove', p => {
      if (p.id === this.touchId) this.joystick(p);
    });

    const release = p => {
      if (p.id === this.touchId) {
        this.touchId = null;
        this.move = { x: 0, y: 0 };
        this.knob.setPosition(this.base.x, this.base.y);
      }
    };

    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Hero
    g.fillStyle(0x5eabed);
    g.fillRoundedRect(9, 23, 30, 32, 8);
    g.fillStyle(0xf4c7a1);
    g.fillCircle(24, 17, 14);
    g.fillStyle(0x453525);
    g.fillEllipse(24, 8, 29, 12);
    g.fillStyle(0x253b6c);
    g.fillRect(11, 53, 12, 13);
    g.fillRect(26, 53, 12, 13);
    g.fillStyle(0x172c3c);
    g.fillRect(32, 17, 6, 4);
    g.generateTexture('hero', 48, 70);

    g.clear();

    // Monster
    g.fillStyle(0x78c56b);
    g.fillEllipse(28, 36, 26, 21);
    g.fillStyle(0xb6e78b);
    g.fillCircle(28, 18, 16);
    g.fillStyle(0x142c23);
    g.fillCircle(35, 18, 3);
    g.fillStyle(0x436a39);
    g.fillRect(14, 49, 11, 10);
    g.fillRect(32, 49, 11, 10);
    g.generateTexture('slime', 56, 62);

    g.clear();

    // Coin
    g.fillStyle(0xffd65a);
    g.fillCircle(11, 11, 9);
    g.lineStyle(3, 0xa66a25);
    g.strokeCircle(11, 11, 9);
    g.generateTexture('coin', 22, 22);

    g.clear();

    // Gem
    g.fillStyle(0x6dd8fc);
    g.fillPoints([
      { x: 12, y: 0 },
      { x: 24, y: 12 },
      { x: 12, y: 24 },
      { x: 0, y: 12 }
    ], true);
    g.generateTexture('gem', 24, 24);

    g.destroy();
  }

  makeWorld() {
    const bg = this.add.graphics().setDepth(-10000);

    bg.fillStyle(0x365f4b);
    bg.fillRect(0, 0, W, H);

    for (let i = 0; i < 450; i++) {
      const x = P.Math.Between(0, W);
      const y = P.Math.Between(0, H);

      bg.fillStyle(
        i % 3 === 0 ? 0x729c67 : 0x4c7b59,
        0.5
      );

      bg.fillEllipse(
        x, y,
        P.Math.Between(5, 26),
        P.Math.Between(2, 8)
      );
    }

    for (let i = 0; i < 60; i++) {
      const x = P.Math.Between(30, W - 30);
      const y = P.Math.Between(35, H - 35);

      if (Math.hypot(x - 900, y - 600) < 240) continue;

      const tree = this.add.container(x, y).setDepth(y);

      tree.add([
        this.add.ellipse(0, 0, 68, 18, 0x102e25, 0.35),
        this.add.rectangle(0, -29, 17, 62, 0x76563d),
        this.add.ellipse(0, -76, 79, 81, 0x2a8151)
          .setStrokeStyle(3, 0x185638)
      ]);
    }
  }

  makeActor(x, y, hero) {
    const shadow = this.add.ellipse(
      x, y, 40, 13, 0x0c241f, 0.45
    ).setDepth(y - 1);

    const sprite = this.physics.add.sprite(
      x, y, hero ? 'hero' : 'slime'
    );

    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);

    sprite.body.setSize(30, 17);
    sprite.body.setOffset(hero ? 9 : 13, hero ? 52 : 44);
    sprite.setCollideWorldBounds(true);

    return {
      sprite,
      shadow,
      hp: hero ? 100 : 40,
      lastHit: 0,
      originX: x,
      originY: y,
      hero
    };
  }

  spawnMonster() {
    const x = P.Math.Between(60, W - 60);
    const y = P.Math.Between(80, H - 80);

    if (
      Math.hypot(
        x - this.player.sprite.x,
        y - this.player.sprite.y
      ) < 220
    ) return;

    this.monsters.push(this.makeActor(x, y, false));
  }

  setupUI() {
    this.hud = this.add.text(12, 10, '', {
      fontFamily: 'system-ui',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#0d2638dd',
      padding: { x: 10, y: 7 }
    }).setScrollFactor(0).setDepth(99999);

    this.base = this.add.circle(
      90, 0, 64, 0x0c2942, 0.6
    ).setStrokeStyle(3, 0xffffff, 0.45)
      .setScrollFactor(0).setDepth(99999);

    this.knob = this.add.circle(
      90, 0, 27, 0xa4d9f8, 0.9
    ).setScrollFactor(0).setDepth(100000);

    this.attackBtn = this.add.circle(
      0, 0, 52, 0xc35a39, 0.85
    ).setStrokeStyle(4, 0xffd49b)
      .setScrollFactor(0).setDepth(99999);

    this.attackText = this.add.text(0, 0, 'ตี', {
      fontFamily: 'system-ui',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#fff'
    }).setOrigin(0.5)
      .setScrollFactor(0).setDepth(100000);
  }

  placeUI() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.base.setPosition(90, h - 90);
    this.knob.setPosition(90, h - 90);
    this.attackBtn.setPosition(w - 85, h - 90);
    this.attackText.setPosition(w - 85, h - 90);
  }

  joystick(p) {
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const d = Math.hypot(dx, dy);
    const strength = Math.min(1, d / 55);

    this.move = d > 0
      ? { x: dx / d * strength, y: dy / d * strength }
      : { x: 0, y: 0 };

    this.knob.setPosition(
      this.base.x + this.move.x * 44,
      this.base.y + this.move.y * 44
    );
  }

  damage(mon) {
    const crit = Math.random() < 0.15;
    const damage = crit ? 24 : 12;

    mon.hp -= damage;
    mon.sprite.setTintFill(0xffffff);

    this.time.delayedCall(95, () => {
      if (mon.sprite.active) mon.sprite.clearTint();
    });

    const txt = this.add.text(
      mon.sprite.x,
      mon.sprite.y - 83,
      (crit ? 'CRIT ' : '') + '-' + damage,
      {
        fontSize: crit ? '24px' : '19px',
        fontStyle: 'bold',
        color: crit ? '#ffb65b' : '#fff0ad',
        stroke: '#3d261c',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(10000);

    this.tweens.add({
      targets: txt,
      y: txt.y - 48,
      alpha: 0,
      duration: 650,
      onComplete: () => txt.destroy()
    });

    if (mon.hp <= 0) {
      const x = mon.sprite.x;
      const y = mon.sprite.y;

      mon.sprite.destroy();
      mon.shadow.destroy();

      this.monsters.splice(
        this.monsters.indexOf(mon), 1
      );

      this.kills++;
      this.exp += 10;

      if (this.exp >= this.level * 50) {
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
      const gem = Math.random() < 0.15;

      const obj = this.add.image(
        x, y - 32, gem ? 'gem' : 'coin'
      ).setDepth(y + 1);

      const targetX = x + P.Math.Between(-65, 65);

      this.tweens.add({
        targets: obj,
        x: targetX,
        duration: 400,
        ease: 'Cubic.Out'
      });

      this.tweens.add({
        targets: obj,
        y: y - 80,
        duration: 220,
        yoyo: true,
        ease: 'Quad.Out'
      });

      this.drops.push({
        sprite: obj,
        value: gem ? 5 : 1
      });
    }
  }

  attack(now) {
    const p = this.player.sprite;

    const nearby = this.monsters
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

    if (!nearby.length) return;

    const m = nearby[0];
    this.lastAttack = now;

    p.setTintFill(0xd8efff);

    this.time.delayedCall(100, () => {
      if (p.active) p.clearTint();
    });

    const slash = this.add.ellipse(
      (p.x + m.sprite.x) / 2,
      (p.y + m.sprite.y) / 2 - 28,
      65, 26, 0xe5f6ff, 0.8
    ).setDepth(10000);

    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      duration: 180,
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

    p.setVelocity(x * 235, y * 235);

    if (x !== 0) p.setFlipX(x < 0);

    p.setDepth(p.y);

    this.player.shadow
      .setPosition(p.x, p.y)
      .setDepth(p.y - 1);

    for (const m of this.monsters) {
      const s = m.sprite;

      const d = P.Math.Distance.Between(
        s.x, s.y, p.x, p.y
      );

      if (d < 265 && d > 48) {
        s.setVelocity(
          (p.x - s.x) / d * 85,
          (p.y - s.y) / d * 85
        );
        s.setFlipX(p.x < s.x);
      } else {
        s.setVelocity(0, 0);
      }

      s.setDepth(s.y);

      m.shadow
        .setPosition(s.x, s.y)
        .setDepth(s.y - 1);

      if (d < 48 && now - m.lastHit > 1250) {
        m.lastHit = now;
        this.hp = Math.max(0, this.hp - 4);
        this.cameras.main.shake(60, 0.001);
      }
    }

    const enemyNearby = this.monsters.some(m =>
      P.Math.Distance.Between(
        p.x, p.y, m.sprite.x, m.sprite.y
      ) < 100
    );

    if (
      now - this.lastAttack > 550 &&
      (this.manualAttack ||
       this.keys.SPACE.isDown ||
       enemyNearby)
    ) {
      this.attack(now);
    }

    this.manualAttack = false;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const s = d.sprite;

      const dist = P.Math.Distance.Between(
        p.x, p.y, s.x, s.y
      );

      if (dist < 130) {
        s.x += (p.x - s.x) * Math.min(1, dt * 6);
        s.y += (p.y - 28 - s.y) * Math.min(1, dt * 6);
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
      now - this.lastSpawn > 1250
    ) {
      this.lastSpawn = now;
      this.spawnMonster();
    }

    if (this.hp <= 0) {
      this.hp = 100;
      p.setPosition(900, 600);
      this.cameras.main.flash(200, 255, 70, 70);
    }

    this.hud.setText(
      'HP ' + this.hp + '/100' +
      '   Gold ' + this.gold +
      '   Kills ' + this.kills +
      '\nLv.' + this.level +
      '  EXP ' + this.exp + '/' +
      (this.level * 50) +
      '  V0.1'
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
