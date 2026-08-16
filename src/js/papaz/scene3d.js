/* =============================================================================
 *  PLAY NIGHT — PAPAZ KAÇTI 3B SAHNE
 *
 *  Karanlık bir oda, tepeden sarkan tek bir ampul ve altındaki yuvarlak masa.
 *  Oyuncular masanın etrafında 3B kafalar olarak oturur; kafa rengi profil
 *  rengidir, aksesuarlar kişiye özeldir.
 *
 *  GİZLİLİK: Bu katman yalnızca KART SAYISINI bilir. Rakiplerin gerçek kartları
 *  hiçbir zaman istemciye gönderilmez (bkz. papaz/engine.js viewFor), bu yüzden
 *  sahnede de yalnızca kapalı kart sırtları çizilir.
 * ========================================================================== */
(function (w) {
  'use strict';

  const THREE = w.THREE;
  const HAS3D = !!THREE;

  /* Profil renkleri -> kafa rengi (util.js AVATAR_COLORS ile aynı sıra) */
  const HEAD_COLORS = [
    0x2f6bff, 0x46d4ff, 0x7a4dff, 0x2fe08a, 0xffc93c,
    0xff4d63, 0xff7ac2, 0x38e0d0, 0xa0f04a, 0xff9142,
  ];

  /* Sahne ölçüleri tek yerden — masa, kafa ve kamera hep uyumlu kalsın. */
  const HEAD_Y = 1.72;        // kafa merkezi (zeminden)
  const TABLE_TOP = 0.95;     // masa yüzeyi
  const TABLE_R = 2.1;        // masa yarıçapı
  const SEAT_R = 2.78;        // oyuncuların masaya uzaklığı

  const ACCESSORIES = {
    hat: ['yok', 'sapka', 'kasket', 'silindir', 'tac', 'fes'],
    face: ['yok', 'gozluk', 'gunes', 'maske'],
    hair: ['yok', 'biyik', 'sakal', 'kelebek'],
  };
  const ACC_LABEL = {
    hat: { yok: 'Yok', sapka: 'Şapka', kasket: 'Kasket', silindir: 'Silindir', tac: 'Taç', fes: 'Fes' },
    face: { yok: 'Yok', gozluk: 'Gözlük', gunes: 'Güneş gözlüğü', maske: 'Maske' },
    hair: { yok: 'Yok', biyik: 'Bıyık', sakal: 'Sakal', kelebek: 'Papyon' },
  };

  /* --------------------------------------------------------- karakter -- */
  /**
   * Tek bir oyuncu karakteri: kafa, gözler, ağız, aksesuarlar ve önündeki
   * kapalı kart yelpazesi.
   */
  function buildCharacter(opts) {
    const g = new THREE.Group();
    const color = HEAD_COLORS[(opts.color || 0) % HEAD_COLORS.length];
    const acc = opts.acc || {};

    const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.35 });

    /* --- gövde (omuzlar) ---
       Masa yüzeyi y≈0.95'te. Kafanın masanın üstünde kalması için gövde uzun. */
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.72, 1.35, 20),
      new THREE.MeshStandardMaterial({ color: mix(color, 0x101018, 0.62), roughness: 0.85 })
    );
    body.position.y = 0.675;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    /* --- kafa --- */
    const head = new THREE.Group();
    head.position.y = HEAD_Y;
    g.add(head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), skin);
    skull.scale.set(1, 1.12, 0.95);
    skull.castShadow = true; skull.receiveShadow = true;
    head.add(skull);

    /* kulaklar */
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), skin);
      ear.position.set(sx * 0.4, 0, 0);
      ear.scale.set(0.6, 1, 0.7);
      ear.castShadow = true;
      head.add(ear);
    }

    /* --- gözler --- */
    const eyes = [];
    for (const sx of [-1, 1]) {
      const eyeG = new THREE.Group();
      eyeG.position.set(sx * 0.155, 0.06, 0.38);
      const wball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), white);
      wball.scale.set(1, 1.05, 0.55);
      eyeG.add(wball);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), dark);
      pupil.position.z = 0.05;
      eyeG.add(pupil);
      head.add(eyeG);
      eyes.push({ group: eyeG, ball: wball, pupil });
    }

    /* --- kaşlar --- */
    const brows = [];
    for (const sx of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.032, 0.04), dark);
      brow.position.set(sx * 0.16, 0.2, 0.4);
      head.add(brow);
      brows.push(brow);
    }

    /* --- ağız --- */
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 20, Math.PI), dark);
    mouth.position.set(0, -0.14, 0.37);
    mouth.rotation.z = Math.PI;      // varsayılan: hafif gülümseme
    head.add(mouth);

    /* --------------------------------------------------- aksesuarlar -- */
    addHat(head, acc.hat, color);
    addFace(head, acc.face);
    addHair(head, acc.hair, color, g);

    /* ---------------------------------------- önündeki kapalı kartlar --
       Karakter masaya döndüğü için yerel +Z masanın merkezine bakar. */
    const cards = new THREE.Group();
    cards.position.set(0, 0, 1.02);
    g.add(cards);

    return { group: g, head, eyes, brows, mouth, cards, skull, color };
  }

  function mix(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((ar + (br - ar) * t) << 16 | (ag + (bg - ag) * t) << 8 | (ab + (bb - ab) * t)) & 0xffffff;
  }

  function addHat(head, kind, color) {
    if (!kind || kind === 'yok') return;
    const felt = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.8 : r });

    if (kind === 'sapka' || kind === 'silindir') {
      const isTop = kind === 'silindir';
      const m = felt(isTop ? 0x14151c : mix(color, 0x000000, 0.55));
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(isTop ? 0.6 : 0.66, isTop ? 0.6 : 0.66, 0.035, 28), m);
      brim.position.y = 0.4; brim.castShadow = true; head.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, isTop ? 0.62 : 0.3, 24), m);
      crown.position.y = 0.4 + (isTop ? 0.32 : 0.16); crown.castShadow = true; head.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.07, 24), felt(0xd8b24a, 0.5));
      band.position.y = 0.44; head.add(band);
    } else if (kind === 'kasket') {
      const m = felt(mix(color, 0xffffff, 0.25));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m);
      dome.position.y = 0.12; dome.castShadow = true; head.add(dome);
      const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24, 1, false, -0.8, 1.6), m);
      peak.position.set(0, 0.13, 0.24); peak.scale.set(1, 1, 1.5); head.add(peak);
    } else if (kind === 'tac') {
      const m = new THREE.MeshStandardMaterial({ color: 0xffcf4a, roughness: 0.25, metalness: 0.85 });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.13, 20), m);
      ring.position.y = 0.46; ring.castShadow = true; head.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), m);
        spike.position.set(Math.cos(a) * 0.34, 0.58, Math.sin(a) * 0.34);
        head.add(spike);
      }
    } else if (kind === 'fes') {
      const m = felt(0xb3202c, 0.75);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.4, 22), m);
      cyl.position.y = 0.56; cyl.castShadow = true; head.add(cyl);
      const tsl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x18181c }));
      tsl.position.set(0.16, 0.76, 0); head.add(tsl);
    }
  }

  function addFace(head, kind) {
    if (!kind || kind === 'yok') return;
    if (kind === 'gozluk' || kind === 'gunes') {
      const isSun = kind === 'gunes';
      const frame = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.35, metalness: 0.4 });
      const lens = new THREE.MeshStandardMaterial({
        color: isSun ? 0x0a0c12 : 0xbfe6ff,
        roughness: 0.1, metalness: 0.2,
        transparent: !isSun, opacity: isSun ? 1 : 0.4,
      });
      for (const sx of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 20), frame);
        rim.position.set(sx * 0.16, 0.06, 0.4);
        head.add(rim);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), lens);
        gl.position.set(sx * 0.16, 0.06, 0.4);
        head.add(gl);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), frame);
      bridge.position.set(0, 0.07, 0.41);
      head.add(bridge);
    } else if (kind === 'maske') {
      const m = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.7 });
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.43, 22, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3), m);
      mk.position.y = 0.02; mk.scale.set(1, 1.12, 0.98);
      head.add(mk);
    }
  }

  function addHair(head, kind, color, root) {
    if (!kind || kind === 'yok') return;
    const hairM = new THREE.MeshStandardMaterial({ color: mix(color, 0x0a0a0e, 0.72), roughness: 0.9 });
    if (kind === 'biyik') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 18, Math.PI), hairM);
      m.position.set(0, -0.05, 0.38); m.rotation.z = Math.PI;
      head.add(m);
    } else if (kind === 'sakal') {
      /* yalnızca çeneyi saran dar bir kabuk — kulakların arkasına taşmasın */
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 22, 14, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.52, Math.PI * 0.4),
        hairM
      );
      b.position.set(0, -0.06, 0.02); b.scale.set(1, 1.05, 1);
      head.add(b);
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI), hairM);
      m.position.set(0, -0.04, 0.37); m.rotation.z = Math.PI;
      head.add(m);
    } else if (kind === 'kelebek') {
      const bow = new THREE.MeshStandardMaterial({ color: 0xc0203a, roughness: 0.55 });
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 4), bow);
        wing.position.set(sx * 0.09, 0.55, 0.38);
        wing.rotation.z = sx * Math.PI / 2;
        root.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bow);
      knot.position.set(0, 0.55, 0.39);
      root.add(knot);
    }
  }

  /* ============================================================ SAHNE == */
  function createScene(canvas, opts) {
    if (!HAS3D) return null;
    const o = opts || {};

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, w.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030407);
    scene.fog = new THREE.FogExp2(0x030407, 0.055);

    const CAM_Y = 4.9, CAM_Z = 7.6, LOOK_Y = 1.30;
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, CAM_Y, CAM_Z);
    camera.lookAt(0, LOOK_Y, 0);

    /* ---------------------------------------------------------- oda --- */
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.93 });
    /* zemin duvarın içinde kalsın, ufukta sert bir çizgi oluşmasın */
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12.9, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* arka duvar hissi için geniş silindir */
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 13, 9, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0d0e13, roughness: 1, side: THREE.BackSide })
    );
    wall.position.y = 4.4;
    scene.add(wall);

    /* ------------------------------------------------------- ampul ---- */
    const lampRig = new THREE.Group();
    scene.add(lampRig);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 3.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 })
    );
    cord.position.y = 5.05;
    lampRig.add(cord);

    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.09, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.55, metalness: 0.6 })
    );
    socket.position.y = 3.42;
    lampRig.add(socket);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2cf });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), bulbMat);
    bulb.position.y = 3.22;
    bulb.scale.set(1, 1.22, 1);
    lampRig.add(bulb);

    /* ampulün etrafındaki halo */
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: 0.16, depthWrite: false })
    );
    halo.position.y = 3.22;
    lampRig.add(halo);

    /* asıl ışık — sahnenin tamamı bundan besleniyor */
    const lamp = new THREE.PointLight(0xffe3b0, 1.35, 24, 1.35);
    lamp.position.y = 3.2;
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -0.0035;
    lamp.shadow.camera.near = 0.4;
    lamp.shadow.camera.far = 16;
    lampRig.add(lamp);

    /* ışık konisi (görünür hüzme) */
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.9, 3.3, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe6b8, transparent: true, opacity: 0.055,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    cone.position.y = 1.6;
    lampRig.add(cone);

    /* çok hafif dolgu ışığı — yüzler tamamen kararmasın */
    scene.add(new THREE.HemisphereLight(0x2a3550, 0x05060a, 0.16));

    /* ------------------------------------------------------- masa ----- */
    const table = new THREE.Group();
    scene.add(table);

    const feltTop = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.09, 56),
      new THREE.MeshStandardMaterial({ color: 0x14603f, roughness: 0.95 })
    );
    feltTop.position.y = TABLE_TOP - 0.045;
    feltTop.receiveShadow = true;
    table.add(feltTop);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(TABLE_R + 0.02, 0.1, 12, 56),
      new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.6 })
    );
    rim.position.y = TABLE_TOP - 0.045;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true; rim.receiveShadow = true;
    table.add(rim);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.52, TABLE_TOP - 0.09, 20),
      new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 0.8 })
    );
    pedestal.position.y = (TABLE_TOP - 0.09) / 2;
    pedestal.castShadow = true;
    table.add(pedestal);

    /* ------------------------------------------------- kart geometrisi */
    const cardGeo = new THREE.PlaneGeometry(0.36, 0.5);
    const cardBackMat = new THREE.MeshStandardMaterial({ color: 0x1d3a72, roughness: 0.55, side: THREE.DoubleSide });
    const cardEdgeMat = new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.7, side: THREE.DoubleSide });

    const state = {
      renderer, scene, camera, lampRig, lamp, bulb, halo, cone,
      chars: new Map(),           // seat -> character
      raf: 0, running: false,
      t0: performance.now(),
      shake: 0, flash: 0,
      cardGeo, cardBackMat, cardEdgeMat,
      seatCount: 0,
      onResize: null,
    };

    /* --------------------------------------------------- boyutlandırma */
    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const wpx = parent.clientWidth, hpx = parent.clientHeight;
      if (!wpx || !hpx) return;
      renderer.setSize(wpx, hpx, false);
      camera.aspect = wpx / hpx;
      camera.updateProjectionMatrix();
    }
    state.resize = resize;

    /* ------------------------------------------------------- döngü ---- */
    function frame() {
      if (!state.running) return;
      const t = (performance.now() - state.t0) / 1000;

      /* ampul hafifçe sallanır ve titreşir */
      lampRig.rotation.z = Math.sin(t * 0.55) * 0.028;
      lampRig.rotation.x = Math.cos(t * 0.41) * 0.02;
      const flicker = 1 + Math.sin(t * 13.7) * 0.012 + Math.sin(t * 4.3) * 0.02;
      lamp.intensity = (state.baseIntensity || 1.0) * flicker + state.flash;
      bulb.material.color.setHSL(0.11, 0.55, Math.min(1, 0.86 * flicker + state.flash * 0.3));
      halo.scale.setScalar(1 + Math.sin(t * 2.1) * 0.04 + state.flash * 0.5);

      if (state.flash > 0) state.flash = Math.max(0, state.flash - 0.06);

      /* kafalar nefes alsın, göz kırpsın */
      for (const [, c] of state.chars) {
        c.group.position.y = c.baseY + Math.sin(t * 1.3 + c.phase) * 0.014;
        const blink = Math.sin(t * 0.9 + c.phase * 3);
        const closed = blink > 0.985;
        for (const e of c.eyes) e.ball.scale.y = closed ? 0.12 : 1.05;
        /* sırası gelen hafifçe öne eğilir */
        const lean = c.active ? 0.16 : 0;
        c.head.rotation.x += (lean - c.head.rotation.x) * 0.08;
        c.group.rotation.y += (c.baseRotY + (c.turnBias || 0) - c.group.rotation.y) * 0.08;
        if (c.bob > 0) { c.bob -= 0.05; c.head.position.y = HEAD_Y + Math.sin(c.bob * Math.PI) * 0.1; }
      }

      /* masa sarsıntısı (papaz anı) */
      if (state.shake > 0) {
        state.shake -= 0.05;
        const s = state.shake * 0.06;
        camera.position.x = Math.sin(t * 60) * s;
        camera.position.y = CAM_Y + Math.cos(t * 71) * s;
      } else {
        camera.position.x += (0 - camera.position.x) * 0.1;
        camera.position.y += (CAM_Y - camera.position.y) * 0.1;
      }
      camera.lookAt(0, LOOK_Y, 0);

      renderer.render(scene, camera);
      state.raf = requestAnimationFrame(frame);
    }

    state.start = function () {
      if (state.running) return;
      state.running = true;
      state.t0 = performance.now();
      resize();
      state.raf = requestAnimationFrame(frame);
    };
    state.stop = function () {
      state.running = false;
      cancelAnimationFrame(state.raf);
    };

    /* ------------------------------------------------ oyuncu yerleşimi */
    /**
     * Oyuncuları masanın etrafına diz. Kendi karakterin en önde (kameraya
     * en yakın) oturur, diğerleri saat yönünde yerleşir.
     */
    state.setPlayers = function (players, mySeat) {
      for (const [, c] of state.chars) scene.remove(c.group);
      state.chars.clear();
      const n = players.length;
      state.seatCount = n;

      players.forEach((p) => {
        /* görsel sıra: ben 0 (ön/kameraya en yakın), diğerleri saat yönünde */
        const v = ((p.seat - mySeat) % n + n) % n;
        const ang = Math.PI / 2 + (v / n) * Math.PI * 2;   // ön = +Z
        const x = Math.cos(ang) * SEAT_R;
        const z = Math.sin(ang) * SEAT_R;

        const ch = buildCharacter({ color: p.color, acc: p.acc });
        ch.group.position.set(x, 0, z);
        ch.baseY = 0;
        /* yerel +Z masanın merkezine baksın */
        ch.baseRotY = Math.atan2(-x, -z);
        ch.group.rotation.y = ch.baseRotY;
        ch.phase = v * 1.7;
        ch.bob = 0;
        ch.seat = p.seat;
        ch.vseat = v;
        ch.active = false;
        /* kendi karakterim önde: küçült ve biraz geriye çek ki masayı kapamasın */
        if (v === 0) { ch.group.scale.setScalar(0.86); ch.group.position.z += 0.75; }
        scene.add(ch.group);
        state.chars.set(p.seat, ch);
      });
    };

    /** Oyuncuların önündeki kapalı kart sayısını güncelle. */
    state.setCards = function (counts) {
      for (const [seat, c] of state.chars) {
        const n = Math.min(counts[seat] || 0, 10);
        while (c.cards.children.length > n) {
          const m = c.cards.children.pop();
          c.cards.remove(m);
        }
        while (c.cards.children.length < n) {
          const i = c.cards.children.length;
          const card = new THREE.Mesh(cardGeo, cardBackMat);
          card.castShadow = true;
          c.cards.add(card);
        }
        /* masaya yatık, hafif yelpaze — hepsi KAPALI (sırt) */
        c.cards.children.forEach((card, i) => {
          const total = c.cards.children.length;
          const off = (i - (total - 1) / 2);
          card.position.set(off * 0.17, TABLE_TOP + 0.012 + i * 0.001, Math.abs(off) * 0.035);
          card.rotation.set(-Math.PI / 2, 0, off * 0.09);
        });
      }
    };

    /** Sırası gelen oyuncuyu vurgula. */
    state.setTurn = function (seat) {
      for (const [s, c] of state.chars) c.active = (s === seat);
    };

    /** Oyuncu masadan kalktı (eli bitti). */
    state.setOut = function (seat, isOut) {
      const c = state.chars.get(seat);
      if (!c) return;
      c.group.traverse((n) => {
        if (n.isMesh && n.material && n.material.opacity !== undefined) { /* dokunma */ }
      });
      c.group.position.y = isOut ? -0.28 : 0;
      c.baseY = isOut ? -0.28 : 0;
    };

    /** Kafa sallama (tepki). */
    state.bob = function (seat) {
      const c = state.chars.get(seat);
      if (c) c.bob = 1;
    };

    /** Papaz anı: ışık patlar, masa sarsılır. */
    state.jolt = function () {
      state.shake = 1;
      state.flash = 1.6;
    };

    /** Ampulü kıs/aç (dramatik anlar). */
    state.setBrightness = function (v) { state.baseIntensity = v; };
    state.baseIntensity = 1.35;

    /** Bir koltuğun ekrandaki konumu (konuşma balonu yerleştirmek için). */
    state.projectSeat = function (seat) {
      const c = state.chars.get(seat);
      if (!c) return null;
      const v = new THREE.Vector3();
      c.head.getWorldPosition(v);
      v.y += 0.65;
      v.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
        visible: v.z < 1,
      };
    };

    state.dispose = function () {
      state.stop();
      scene.traverse((n) => {
        if (n.isMesh) {
          if (n.geometry) n.geometry.dispose();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
            else n.material.dispose();
          }
        }
      });
      renderer.dispose();
    };

    resize();
    return state;
  }

  /* ============================================ KARAKTER ÖNİZLEME ===== */
  /** Ayarlar ekranındaki döner karakter önizlemesi. */
  function createPreview(canvas) {
    if (!HAS3D) return null;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, w.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.35, 3.1);
    camera.lookAt(0, 1.0, 0);

    const key = new THREE.PointLight(0xffe3b0, 1.5, 14, 1.7);
    key.position.set(0.4, 2.6, 1.4);
    key.castShadow = true;
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0x33456b, 0x07080c, 0.4));

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.08, 40),
      new THREE.MeshStandardMaterial({ color: 0x121a2e, roughness: 0.9 })
    );
    disc.position.y = -0.04;
    disc.receiveShadow = true;
    scene.add(disc);

    let char = null;
    const holder = new THREE.Group();
    scene.add(holder);

    const st = { raf: 0, running: false };

    function resize() {
      const p = canvas.parentElement;
      if (!p || !p.clientWidth) return;
      const size = Math.min(p.clientWidth, 260);
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }

    function frame() {
      if (!st.running) return;
      holder.rotation.y += 0.008;
      renderer.render(scene, camera);
      st.raf = requestAnimationFrame(frame);
    }

    st.set = function (color, acc) {
      if (char) holder.remove(char.group);
      char = buildCharacter({ color, acc });
      char.group.position.y = 0;
      holder.add(char.group);
    };
    st.start = function () { if (!st.running) { st.running = true; resize(); st.raf = requestAnimationFrame(frame); } };
    st.stop = function () { st.running = false; cancelAnimationFrame(st.raf); };
    st.resize = resize;
    st.dispose = function () { st.stop(); renderer.dispose(); };

    resize();
    return st;
  }

  w.Papaz3D = { HAS3D, createScene, createPreview, buildCharacter, ACCESSORIES, ACC_LABEL, HEAD_COLORS };
})(window);
