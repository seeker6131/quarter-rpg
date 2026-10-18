
const P = window.Phaser;
const loading = document.getElementById("loading");

if (!P) {
  if (loading) loading.textContent = "Phaser failed";
  throw new Error("Phaser unavailable");
}

const VW = 1920, VH = 1440;
const HERO_SPEED = 215;
const DIRS = [
  [1,0],[1,1],[0,1],[-1,1],
  [-1,0],[-1,-1],[0,-1],[1,-1]
];

class QuarterRPG extends P.Scene {
  constructor() {
    super("QuarterRPG");
  }

  create() {
    if (loading) loading.remove();

    this.physics.world.setBounds(0,0,VW,VH);
    this.cameras.main.setBackgroundColor("#254737");

    this.gold = 0;
    this.gems = 0;
    this.kills = 0;
    this.level = 1;
    this.exp = 0;
    this.hp = 100;
    this.monsters = [];
    this.drops = [];
    this.fx = [];
    this.move = {x:0,y:0};
    this.direction = 0;
    this.joyPointer = null;
    this.attackPointer = null;
    this.attackHeld = false;
    this.lastAttack = 0;
    this.lastSkill = -9999;
    this.lastSpawn = 0;
    this.lastHUD = 0;
    this.fps = 60;

    this.makeArt();
    this.makeMap();

    this.player = this.actor(920,700,"hero");

    for(let i=0;i<11;i++) this.spawnMonster();

    this.cameras.main
      .setBounds(0,0,VW,VH)
      .startFollow(this.player.sprite,true,0.13,0.13)
      .setRoundPixels(true);

    this.makeUI();
    this.makeControls();

    this.scale.on("resize",this.layout,this);
    this.layout();
  }

  // All pixel artwork is drawn once into textures.
  makeArt() {
    const g = this.make.graphics({x:0,y:0});

    const r = (x,y,w,h,c) => {
      g.fillStyle(c);
      g.fillRect(x*3,y*3,w*3,h*3);
    };

    const save = (name,w,h) => {
      g.generateTexture(name,w*3,h*3);
      g.clear();
    };

    // Detailed hero: 8 directions, 4 walking frames.
    for(let d=0;d<8;d++){
      for(let f=0;f<4;f++){
        const step = [0,1,0,-1][f];
        const side = d===0||d===1||d===7;
        const left = d>=3&&d<=5;
        const back = d>=5;
        const sx = side ? 1 : left ? -1 : 0;

        // Legs and boots
        r(12,30,6,10,0x101a30);
        r(22,30,6,10,0x101a30);
        r(11,38+step,8,4,0x263c59);
        r(21,38-step,8,4,0x263c59);
        r(12,34,5,3,0x435b76);
        r(23,34,5,3,0x435b76);

        // Cape and armor outline
        r(9,18,24,17,0x111b2c);
        r(7,22,5,15,0x982d34);
        r(6-step,27,6,11,0xcb3d3e);
        r(10,19,22,15,0x28476a);
        r(12,20,18,12,0x276caa);
        r(14,21,11,5,0x55b5e5);
        r(13,28,16,3,0x17304c);
        r(17,29,4,3,0xe2b45d);

        // Metal shoulders
        r(7,19,7,8,0x182b43);
        r(8,20,5,5,0x819eb7);
        r(29,19,7,8,0x182b43);
        r(30,20,5,5,0x819eb7);
        r(8,25,5,7,0xc79269);
        r(30,25,5,7,0xc79269);

        // Head
        r(12+sx,5,19,16,0x362822);
        r(13+sx,7,17,14,0xe9b17f);
        r(12+sx,4,19,7,0x573724);
        r(9+sx,7,7,5,0x67402a);
        r(15+sx,3,10,3,0x775038);
        r(22+sx,4,8,4,0x493021);

        if(back){
          r(14+sx,10,16,8,0x6c442e);
          r(16+sx,13,11,3,0x8b5c3b);
        } else if(side){
          const eyeX = left ? 16 : 27;
          r(eyeX,13,2,2,0x14263a);
          r(eyeX,16,3,1,0xb97859);
        } else {
          r(17,13,2,2,0x152538);
          r(26,13,2,2,0x152538);
        }

        // Signature red scarf
        r(11,19,22,4,0x92252c);
        r(13,19,19,3,0xe04b45);
        r(7-step,22,8,3,0xd83a40);
        r(4-step,24,7,2,0x9d2632);

        // Sword and golden guard
        const swordX = left ? 4 : 36;
        r(swordX,21,3,13,0x6d492c);
        r(swordX-2,19,7,3,0xf3c45e);
        r(swordX,6,4,14,0x8cbcd6);
        r(swordX+1,3,2,4,0xe6faff);
        r(swordX,8,1,9,0xffffff);

        save("hero_"+d+"_"+f,44,44);
      }
    }

    // Slime frames
    for(let f=0;f<4;f++){
      const b = f%2;
      r(4,15+b,24,9,0x153c2d);
      r(5,11+b,22,12,0x237c49);
      r(7,7+b,18,13,0x4dbb69);
      r(10,5+b,13,10,0x7ce08a);
      r(10,8+b,7,3,0xb5f6a5);
      r(10,16+b,3,4,0x172e2b);
      r(22,16+b,3,4,0x172e2b);
      r(16,21+b,5,2,0x327d4b);
      r(8,13+b,3,2,0xd3ffbf);
      save("slime_"+f,33,27);
    }

    // Wild boar frames
    for(let f=0;f<4;f++){
      const b=f%2;
      r(7,13,25,14,0x38271f);
      r(8,11,23,14,0x875638);
      r(11,9,18,7,0xb47a4d);
      r(3,15,12,11,0x573726);
      r(3,17,10,8,0xaa7048);
      r(1,20,9,5,0xc28b5e);
      r(7,17,3,3,0x18232b);
      r(10,24,4,3,0xffe4b5);
      r(26,8,6,8,0x533328);
      r(11,26,5,8+b,0x302720);
      r(25,26,5,8-b,0x302720);
      r(33,15,4,3,0x68402c);
      save("boar_"+f,39,36);
    }

    // Gold coin
    r(3,1,8,2,0xffe68a);
    r(1,3,12,9,0x92541e);
    r(2,2,10,10,0xf9bf3f);
    r(4,4,6,6,0xffe786);
    r(6,5,2,4,0xe6a62b);
    save("coin",14,14);

    // Mana crystal
    r(6,0,3,3,0xe3fbff);
    r(4,3,7,4,0x80dcff);
    r(2,7,11,4,0x258fdb);
    r(4,11,7,3,0x165b9c);
    r(6,14,3,2,0x9ae9ff);
    save("gem",15,16);

    // Forest tree
    r(17,30,10,18,0x33291f);
    r(19,30,6,18,0x98663e);
    r(21,33,2,13,0xc28c52);
    r(6,20,32,17,0x133b2e);
    r(3,14,38,19,0x215b3a);
    r(7,7,32,22,0x2b7547);
    r(12,3,23,19,0x408f54);
    r(17,2,14,11,0x67b765);
    r(9,13,9,6,0x65b46a);
    r(28,10,7,5,0x7bc573);
    r(17,8,7,4,0x9bd382);
    save("tree",44,49);

    // Rock
    r(3,13,29,11,0x26343c);
    r(5,8,25,13,0x516772);
    r(10,4,17,11,0x8499a0);
    r(12,5,10,4,0xb7c0b4);
    r(21,15,8,6,0x384a56);
    r(8,17,7,4,0x48645b);
    save("rock",36,26);

    // Flower bush
    r(3,12,26,9,0x153c2e);
    r(5,8,23,11,0x286c42);
    r(9,4,16,11,0x4c9a55);
    r(13,5,7,5,0x80c26e);
    r(7,11,3,3,0xf9df7b);
    r(22,9,3,3,0xffa8bf);
    r(16,3,3,3,0xffffff);
    save("bush",33,23);

    // Wooden chest
    r(3,9,27,15,0x34251c);
    r(4,7,25,15,0x84502d);
    r(5,8,23,5,0xb88044);
    r(7,14,19,2,0x4d2e1d);
    r(6,18,21,2,0x9f6d37);
    r(14,12,5,8,0xe9b84c);
    r(15,14,3,4,0xffe38b);
    save("chest",34,26);

    // Lamp
    r(15,20,6,25,0x3b2b22);
    r(17,20,3,24,0x91653a);
    r(8,14,20,4,0x483126);
    r(11,6,14,12,0x4d3527);
    r(13,8,10,8,0xffc75e);
    r(15,9,6,6,0xfff0a2);
    r(10,4,16,4,0x34291f);
    save("lamp",36,47);

    g.destroy();
  }

  makeMap() {
    const g=this.add.graphics().setDepth(-10000);

    g.fillStyle(0x345d41);
    g.fillRect(0,0,VW,VH);

    // Detailed ground variation
    for(let i=0;i<2200;i++){
      const x=P.Math.Between(0,VW);
      const y=P.Math.Between(0,VH);
      g.fillStyle(
        i%4===0?0x77a568:
        i%4===1?0x26553b:
        i%4===2?0x588a53:0x46754b,
        0.65
      );
      g.fillRect(x,y,P.Math.Between(3,9),3);
    }

    // Forest path
    g.fillStyle(0x554d35);
    g.fillEllipse(920,740,1640,385);
    g.fillStyle(0x957b4e);
    g.fillEllipse(920,734,1590,326);
    g.fillStyle(0xb79a65,0.55);
    g.fillEllipse(920,730,1500,265);

    // River
    g.fillStyle(0x142f47);
    g.fillRect(1320,0,340,600);
    g.fillStyle(0x2478a4);
    g.fillRect(1330,0,320,590);

    for(let i=0;i<150;i++){
      const x=P.Math.Between(1335,1640);
      const y=P.Math.Between(0,590);
      g.fillStyle(0x9ae9f5,0.35);
      g.fillRect(x,y,P.Math.Between(8,26),3);
    }

    // Waterfall
    g.fillStyle(0x8ee7ff,0.75);
    g.fillRect(1400,12,150,80);
    g.fillStyle(0xd5f9ff,0.8);
    for(let i=0;i<12;i++){
      g.fillRect(1405+i*12,20,5,72);
    }

    // Bridge
    g.fillStyle(0x3a291f);
    g.fillRect(1270,265,430,128);
    for(let x=1280;x<1690;x+=28){
      g.fillStyle(
        (x/28)%2?0x96643c:0xb7814a
      );
      g.fillRect(x,273,25,111);
      g.fillStyle(0x493325);
      g.fillRect(x,273,3,111);
    }

    // Stones on the path
    for(let i=0;i<180;i++){
      const x=P.Math.Between(200,1650);
      const y=P.Math.Between(650,825);
      g.fillStyle(0x6d6650,0.45);
      g.fillEllipse(x,y,8,4);
    }

    // Scenery: depth follows bottom position
    for(let i=0;i<125;i++){
      const x=P.Math.Between(60,VW-60);
      const y=P.Math.Between(60,VH-60);

      if(Math.hypot(x-920,y-700)<240) continue;
      if(x>1310&&x<1670&&y<610) continue;

      const n=P.Math.Between(0,9);
      const type=n<5?"tree":n<8?"bush":"rock";
      const scale=type==="tree"
        ?P.Math.FloatBetween(0.85,1.15):1;

      this.add.ellipse(
        x,y,type==="tree"?80:46,16,
        0x0a261c,0.35
      ).setDepth(y-1);

      this.add.image(x,y,type)
        .setOrigin(0.5,1)
        .setScale(scale)
        .setDepth(y);
    }

    this.add.image(1090,530,"chest")
      .setOrigin(0.5,1).setDepth(530);

    for(const [x,y] of [[1200,550],[1700,425]]){
      this.add.ellipse(
        x,y-100,100,45,0xffc35b,0.12
      ).setDepth(y-1);

      this.add.image(x,y,"lamp")
        .setOrigin(0.5,1).setDepth(y);
    }
  }

  actor(x,y,type) {
    const hero=type==="hero";
    const tex=hero?"hero_0_0":type+"_0";

    const shadow=this.add.ellipse(
      x,y,hero?52:55,14,0x081e19,0.42
    ).setDepth(y-1);

    const sprite=this.physics.add.sprite(
      x,y,tex
    ).setOrigin(0.5,1);

    sprite.setDepth(y);
    sprite.setCollideWorldBounds(true);

    const bw=hero?34:40;
    sprite.body.setSize(bw,14);
    sprite.body.setOffset(
      (sprite.width-bw)/2,
      sprite.height-14
    );

    return {
      type,sprite,shadow,
      bar:this.add.graphics(),
      hp:hero?100:type==="boar"?85:45,
      maxHp:hero?100:type==="boar"?85:45,
      frame:0,lastFrame:0,lastHit:0,
      speed:type==="boar"?110:86
    };
  }

  spawnMonster() {
    const x=P.Math.Between(90,VW-90);
    const y=P.Math.Between(90,VH-90);

    if(Math.hypot(
      x-this.player.sprite.x,
      y-this.player.sprite.y
    )<240) return;

    this.monsters.push(
      this.actor(
        x,y,
        Math.random()<0.25?"boar":"slime"
      )
    );
  }

  makeUI() {
    const fixed=o=>o
      .setScrollFactor(0)
      .setDepth(20000);

    this.panel=fixed(this.add.graphics());

    this.hud=fixed(this.add.text(
      16,14,"",{
        fontFamily:"system-ui",
        fontSize:"14px",
        fontStyle:"bold",
        color:"#ffffff"
      }
    ));

    this.fpsText=fixed(this.add.text(
      0,14,"FPS 60",{
        fontFamily:"monospace",
        fontSize:"15px",
        fontStyle:"bold",
        color:"#ffdf79",
        backgroundColor:"#122637dd",
        padding:{x:8,y:6}
      }
    ));

    this.base=fixed(this.add.circle(
      90,0,61,0x102b3d,0.7
    ).setStrokeStyle(3,0xbad5e5,0.7));

    this.knob=fixed(this.add.circle(
      90,0,27,0xa9d2ed,0.95
    )).setDepth(20001);

    this.attackButton=fixed(this.add.circle(
      0,0,51,0xb53b29,0.96
    ).setStrokeStyle(4,0xffc86b));

    this.attackLabel=fixed(this.add.text(
      0,0,"⚔",{
        fontFamily:"system-ui",
        fontSize:"33px",
        color:"#fff4d4"
      }
    ).setOrigin(0.5)).setDepth(20001);

    this.skillButton=fixed(this.add.circle(
      0,0,31,0x243b54,0.95
    ).setStrokeStyle(3,0xf0c66b));

    this.skillLabel=fixed(this.add.text(
      0,0,"✦",{
        fontSize:"28px",
        color:"#ffdf8b"
      }
    ).setOrigin(0.5)).setDepth(20001);
  }

  layout() {
    const w=this.scale.width;
    const h=this.scale.height;
    const joyX=w<450?85:110;
    const joyY=h-100;
    const atkX=w-(w<450?80:110);
    const atkY=h-100;

    this.base.setPosition(joyX,joyY);
    this.knob.setPosition(joyX,joyY);
    this.attackButton.setPosition(atkX,atkY);
    this.attackLabel.setPosition(atkX,atkY);
    this.skillButton.setPosition(atkX-30,atkY-105);
    this.skillLabel.setPosition(atkX-30,atkY-105);
    this.fpsText.setPosition(w-88,12);
  }

  makeControls() {
    this.keys=this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE"
    );

    this.input.addPointer(2);

    this.input.on("pointerdown",p=>{
      const w=this.scale.width;
      const h=this.scale.height;

      if(
        p.x<w*0.48 &&
        p.y>h*0.4 &&
        this.joyPointer===null
      ){
        this.joyPointer=p.id;
        this.joystick(p);
      } else if(
        P.Math.Distance.Between(
          p.x,p.y,
          this.skillButton.x,
          this.skillButton.y
        )<46
      ){
        this.skill(this.time.now);
      } else if(
        P.Math.Distance.Between(
          p.x,p.y,
          this.attackButton.x,
          this.attackButton.y
        )<75
      ){
        this.attackPointer=p.id;
        this.attackHeld=true;
      }
    });

    this.input.on("pointermove",p=>{
      if(p.id===this.joyPointer) this.joystick(p);
    });

    const release=p=>{
      if(p.id===this.joyPointer){
        this.joyPointer=null;
        this.move={x:0,y:0};
        this.knob.setPosition(
          this.base.x,this.base.y
        );
      }
      if(p.id===this.attackPointer){
        this.attackPointer=null;
        this.attackHeld=false;
      }
    };

    this.input.on("pointerup",release);
    this.input.on("pointerupoutside",release);
  }

  joystick(p) {
    const dx=p.x-this.base.x;
    const dy=p.y-this.base.y;
    const d=Math.hypot(dx,dy);
    const v=Math.min(1,d/55);

    this.move=d
      ?{x:dx/d*v,y:dy/d*v}
      :{x:0,y:0};

    this.knob.setPosition(
      this.base.x+this.move.x*43,
      this.base.y+this.move.y*43
    );
  }

  animate(a,now,moving) {
    const delay=moving?105:270;
    if(now-a.lastFrame<delay) return;

    a.lastFrame=now;
    a.frame=(a.frame+1)%4;

    const key=a.type==="hero"
      ?"hero_"+this.direction+"_"+a.frame
      :a.type+"_"+a.frame;

    a.sprite.setTexture(key);
  }

  directionFrom(x,y) {
    const angle=Math.atan2(y,x);
    return (Math.round(angle/(Math.PI/4))+8)%8;
  }

  damageText(x,y,value,crit=false) {
    const t=this.add.text(
      x,y,(crit?"CRIT ":"")+"-"+value,{
        fontFamily:"system-ui",
        fontSize:crit?"24px":"20px",
        fontStyle:"bold",
        color:crit?"#ffd45c":"#fff5c2",
        stroke:"#35241b",
        strokeThickness:4
      }
    ).setOrigin(0.5).setDepth(15000);

    this.tweens.add({
      targets:t,y:y-55,alpha:0,
      duration:650,
      onComplete:()=>t.destroy()
    });
  }

  slash(x,y,angle) {
    const g=this.add.graphics()
      .setPosition(x,y)
      .setRotation(angle)
      .setDepth(15000);

    g.lineStyle(12,0x236bc6,0.55);
    g.beginPath();
    g.arc(0,0,47,-1.1,1.1,false);
    g.strokePath();

    g.lineStyle(5,0xb7f6ff,1);
    g.beginPath();
    g.arc(0,0,47,-1.1,1.1,false);
    g.strokePath();

    g.setScale(0.55);

    this.tweens.add({
      targets:g,
      scaleX:1.3,
      scaleY:1.3,
      alpha:0,
      duration:180,
      onComplete:()=>g.destroy()
    });
  }

  hit(m,skill=false) {
    if(!m.sprite.active) return;

    const crit=Math.random()<0.15;
    const dmg=skill?27:crit?28:15;
    m.hp-=dmg;

    m.sprite.setTintFill(0xffffff);
    this.time.delayedCall(85,()=>{
      if(m.sprite.active) m.sprite.clearTint();
    });

    this.damageText(
      m.sprite.x,
      m.sprite.y-85,
      dmg,crit
    );

    if(m.hp>0) return;

    const x=m.sprite.x,y=m.sprite.y;
    m.sprite.destroy();
    m.shadow.destroy();
    m.bar.destroy();

    const index=this.monsters.indexOf(m);
    if(index>=0) this.monsters.splice(index,1);

    this.kills++;
    this.exp+=m.type==="boar"?20:10;

    while(this.exp>=this.level*50){
      this.exp-=this.level*50;
      this.level++;
      this.hp=100;
    }

    this.loot(x,y);
  }

  attack(now) {
    const p=this.player.sprite;

    const targets=this.monsters.filter(m=>
      P.Math.Distance.Between(
        p.x,p.y,m.sprite.x,m.sprite.y
      )<125
    );

    if(!targets.length) return;

    targets.sort((a,b)=>
      P.Math.Distance.Between(
        p.x,p.y,a.sprite.x,a.sprite.y
      )-
      P.Math.Distance.Between(
        p.x,p.y,b.sprite.x,b.sprite.y
      )
    );

    const m=targets[0];
    const dx=m.sprite.x-p.x;
    const dy=m.sprite.y-p.y;
    const angle=Math.atan2(dy,dx);

    this.direction=this.directionFrom(dx,dy);
    this.lastAttack=now;

    this.slash(
      p.x+Math.cos(angle)*55,
      p.y-45+Math.sin(angle)*30,
      angle
    );

    this.hit(m);
  }

  skill(now) {
    if(now-this.lastSkill<3500) return;
    this.lastSkill=now;

    const p=this.player.sprite;

    const ring=this.add.circle(
      p.x,p.y-30,20,0x5adfff,0.22
    ).setStrokeStyle(5,0xa5f5ff)
      .setDepth(15000);

    this.tweens.add({
      targets:ring,
      scaleX:7,scaleY:7,alpha:0,
      duration:350,
      onComplete:()=>ring.destroy()
    });

    for(const m of [...this.monsters]){
      if(P.Math.Distance.Between(
        p.x,p.y,m.sprite.x,m.sprite.y
      )<160) this.hit(m,true);
    }
  }

  loot(x,y) {
    for(let i=0;i<P.Math.Between(2,4);i++){
      const gem=Math.random()<0.2;
      const s=this.add.image(
        x,y-30,gem?"gem":"coin"
      ).setDepth(y+2);

      const tx=x+P.Math.Between(-55,55);
      const ty=y+P.Math.Between(-25,25);

      this.tweens.add({
        targets:s,x:tx,
        duration:350,ease:"Cubic.Out"
      });

      this.tweens.add({
        targets:s,y:y-75,
        duration:190,yoyo:true,
        onComplete:()=>{
          if(s.active) s.y=ty;
        }
      });

      this.drops.push({
        sprite:s,gem,
        ready:this.time.now+450
      });
    }
  }

  updateHUD(now) {
    if(now-this.lastHUD<150) return;
    this.lastHUD=now;

    const w=this.scale.width;
    const panelW=Math.min(w-110,315);

    this.panel.clear();
    this.panel.fillStyle(0x102535,0.93);
    this.panel.fillRoundedRect(
      8,8,panelW,97,7
    );

    this.panel.lineStyle(2,0xc49a54);
    this.panel.strokeRoundedRect(
      8,8,panelW,97,7
    );

    this.panel.fillStyle(0x47272b);
    this.panel.fillRect(16,38,panelW-17,12);
    this.panel.fillStyle(0xd84444);
    this.panel.fillRect(
      16,38,
      (panelW-17)*this.hp/100,12
    );

    this.panel.fillStyle(0x21334c);
    this.panel.fillRect(16,59,panelW-17,8);
    this.panel.fillStyle(0x4bbaff);
    this.panel.fillRect(
      16,59,
      (panelW-17)*this.exp/(this.level*50),
      8
    );

    this.hud.setFontSize(w<450?13:15);
    this.hud.setText(
      "LV."+this.level+"  HP "+this.hp+"/100"+
      "\n\n\nGOLD "+this.gold+
      "   GEM "+this.gems+
      "   KILLS "+this.kills+
      "   V0.5"
    );

    this.fpsText.setText(
      "FPS "+Math.round(this.fps)
    );
  }

  update(now,delta) {
    const dt=Math.min(delta/1000,0.05);
    this.fps=this.fps*0.95+
      Math.min(120,1000/Math.max(1,delta))*0.05;

    const p=this.player.sprite;
    let x=this.move.x,y=this.move.y;

    x+=Number(
      this.keys.D.isDown||this.keys.RIGHT.isDown
    )-Number(
      this.keys.A.isDown||this.keys.LEFT.isDown
    );

    y+=Number(
      this.keys.S.isDown||this.keys.DOWN.isDown
    )-Number(
      this.keys.W.isDown||this.keys.UP.isDown
    );

    const len=Math.hypot(x,y);
    if(len>1){x/=len;y/=len;}

    p.setVelocity(x*HERO_SPEED,y*HERO_SPEED);

    if(len>0.1){
      const newDir=this.directionFrom(x,y);
      if(newDir!==this.direction){
        this.direction=newDir;
        this.player.lastFrame=0;
      }
    }

    p.setDepth(p.y);
    this.player.shadow
      .setPosition(p.x,p.y)
      .setDepth(p.y-1);

    this.animate(this.player,now,len>0.1);

    for(const m of this.monsters){
      const s=m.sprite;
      const dx=p.x-s.x;
      const dy=p.y-s.y;
      const d=Math.hypot(dx,dy);

      if(d<320&&d>48){
        s.setVelocity(
          dx/d*m.speed,dy/d*m.speed
        );
        s.setFlipX(dx<0);
      } else {
        s.setVelocity(0,0);
      }

      s.setDepth(s.y);
      m.shadow.setPosition(s.x,s.y)
        .setDepth(s.y-1);

      this.animate(m,now,d<320&&d>48);

      m.bar.clear();

      if(d<440){
        m.bar.fillStyle(0x17241e);
        m.bar.fillRect(s.x-27,s.y-91,54,8);
        m.bar.fillStyle(0xd94a43);
        m.bar.fillRect(
          s.x-26,s.y-90,
          52*Math.max(0,m.hp/m.maxHp),6
        );
      }

      m.bar.setDepth(s.y+1);

      if(d<48&&now-m.lastHit>1250){
        m.lastHit=now;
        this.hp=Math.max(
          0,this.hp-(m.type==="boar"?7:4)
        );
        this.cameras.main.shake(55,0.001);
      }
    }

    const nearby=this.monsters.some(m=>
      P.Math.Distance.Between(
        p.x,p.y,m.sprite.x,m.sprite.y
      )<125
    );

    if(
      now-this.lastAttack>520 &&
      (nearby||this.attackHeld||this.keys.SPACE.isDown)
    ){
      this.attack(now);
    }

    for(let i=this.drops.length-1;i>=0;i--){
      const d=this.drops[i],s=d.sprite;
      if(now<d.ready) continue;

      const dist=P.Math.Distance.Between(
        p.x,p.y,s.x,s.y
      );

      if(dist<145){
        const t=Math.min(1,dt*7);
        s.x+=(p.x-s.x)*t;
        s.y+=(p.y-20-s.y)*t;
      }

      s.setDepth(s.y+1);

      if(dist<26){
        if(d.gem)this.gems++;
        else this.gold++;
        s.destroy();
        this.drops.splice(i,1);
      }
    }

    if(
      this.monsters.length<11 &&
      now-this.lastSpawn>1100
    ){
      this.lastSpawn=now;
      this.spawnMonster();
    }

    if(this.hp<=0){
      this.hp=100;
      p.setPosition(920,700);
      p.setVelocity(0,0);
      this.cameras.main.flash(180,255,60,60);
    }

    this.updateHUD(now);
  }
}

new P.Game({
  type:P.AUTO,
  parent:"game",
  backgroundColor:"#14283b",
  fps:{
    target:60,
    forceSetTimeOut:false
  },
  scale:{
    mode:P.Scale.RESIZE,
    width:innerWidth,
    height:innerHeight,
    autoCenter:P.Scale.CENTER_BOTH
  },
  render:{
    pixelArt:true,
    antialias:false,
    roundPixels:true
  },
  physics:{
    default:"arcade",
    arcade:{debug:false}
  },
  scene:[QuarterRPG]
});
