import * as THREE from 'three';

export const WORLD_BOUNDS = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };

const GRID_SIZE = 56; // 56x56 1m cells covering [-28, 28) in X and Z

const ZONES = {
  south_beach: {
    id: 'south_beach',
    name: 'South Beach & Jungle',
    shortName: 'South Beach',
    color: '#4e8a3c',
    danger: 'low',
    toString() {
      return this.name;
    },
    [Symbol.toPrimitive]() {
      return this.name;
    },
  },
  temple_ruins: {
    id: 'temple_ruins',
    name: 'Ancient Temple Courtyard',
    shortName: 'Temple Ruins',
    color: '#c2a36b',
    danger: 'low',
    toString() {
      return this.name;
    },
    [Symbol.toPrimitive]() {
      return this.name;
    },
  },
  sunken_lagoon: {
    id: 'sunken_lagoon',
    name: 'Sunken Lagoon & Swamp',
    shortName: 'Sunken Lagoon',
    color: '#2596be',
    danger: 'medium',
    toString() {
      return this.name;
    },
    [Symbol.toPrimitive]() {
      return this.name;
    },
  },
  west_fbi_camp: {
    id: 'west_fbi_camp',
    name: 'West FBI Forward Camp',
    shortName: 'West FBI Camp',
    color: '#f2c230',
    danger: 'high',
    toString() {
      return this.name;
    },
    [Symbol.toPrimitive]() {
      return this.name;
    },
  },
  north_fbi_hq: {
    id: 'north_fbi_hq',
    name: 'North Beach FBI HQ',
    shortName: 'North FBI HQ',
    color: '#ef4444',
    danger: 'extreme',
    toString() {
      return this.name;
    },
    [Symbol.toPrimitive]() {
      return this.name;
    },
  },
};

function createFallbackGradientMap() {
  const data = new Uint8Array([115, 255]);
  const texture = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function enableShadows(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const matName = (obj.material?.name || '').toLowerCase();
    const objName = (obj.name || '').toLowerCase();
    const isOutline = matName.includes('outline') || objName.includes('outline');
    const isLightCone = objName.includes('lightcone') || objName.includes('cone');
    if (isOutline || isLightCone) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    } else {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

/**
 * Fallback procedural cel-shaded mesh when `envScene` is unavailable (e.g., headless Node tests).
 */
function createFallbackEnvMesh(name, gradientMap, outlineMat) {
  const g = new THREE.Group();
  g.name = name;

  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap });

  if (name.startsWith('Jungle_Canopy_Tree')) {
    const isLarge = name.includes('Large');
    const h = isLarge ? 3.2 : 2.3;
    const r = isLarge ? 1.35 : 0.95;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h * 0.65, 7), toon(0x6b4328));
    trunk.position.y = h * 0.325;
    g.add(trunk);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), toon(0x3a9430));
    crown.position.y = h * 0.78;
    crown.scale.set(1.15, 0.72, 1.15);
    g.add(crown);
  } else if (name === 'Jungle_Foliage_Bush') {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), toon(0x388c2e));
    bush.position.y = 0.35;
    bush.scale.set(1.2, 0.75, 1.15);
    g.add(bush);
  } else if (name === 'Ruin_Sandstone_Floor') {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), toon(0xc29e63));
    tile.position.y = 0.02;
    g.add(tile);
  } else if (name === 'Ruin_Temple_Wall') {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.42), toon(0x9a7d50));
    wall.position.y = 0.8;
    g.add(wall);
  } else if (name === 'Ruin_Stone_Pillar') {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.2, 0.76), toon(0xa88a5b));
    pillar.position.y = 1.1;
    g.add(pillar);
  } else if (name === 'Ruin_Fire_Brazier') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.15, 8), toon(0x7c6851));
    base.position.y = 0.58;
    g.add(base);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.52, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7b1a })
    );
    flame.name = 'Ruin_Fire_Brazier_Flame';
    flame.position.y = 1.38;
    g.add(flame);
  } else if (name === 'FBI_Tactical_Tent') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.55, 2.1), toon(0x232830));
    body.position.y = 0.78;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.75, 4), toon(0x1a1e24));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.9;
    g.add(roof);
  } else if (name === 'FBI_Holding_Cage') {
    const frameMat = toon(0x525d69);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), frameMat);
    base.position.y = 0.05;
    g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), frameMat);
    top.position.y = 1.85;
    g.add(top);
    const barGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6);
    for (let i = -2; i <= 2; i += 1) {
      const off = i * 0.32;
      for (const [bx, bz] of [
        [off, -0.7],
        [off, 0.7],
        [-0.7, off],
        [0.7, off],
      ]) {
        const bar = new THREE.Mesh(barGeo, frameMat);
        bar.position.set(bx, 0.95, bz);
        g.add(bar);
      }
    }
  } else if (name === 'FBI_Tripod_Floodlight') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 6), toon(0x303740));
    pole.position.y = 1.05;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.22), toon(0xf2c230));
    head.position.y = 2.15;
    g.add(head);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 2.6, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xeef8ff,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    cone.name = 'FBI_Tripod_Floodlight_LightCone';
    cone.position.set(0, 1.25, 0.9);
    cone.rotation.x = -Math.PI * 0.34;
    g.add(cone);
  } else if (name === 'FBI_Caution_Barrier') {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 0.16), toon(0xf2c230));
    plank.position.y = 0.65;
    g.add(plank);
    const legGeo = new THREE.BoxGeometry(0.12, 0.85, 0.24);
    const legL = new THREE.Mesh(legGeo, toon(0x1e2228));
    legL.position.set(-0.44, 0.42, 0);
    const legR = new THREE.Mesh(legGeo, toon(0x1e2228));
    legR.position.set(0.44, 0.42, 0);
    g.add(legL, legR);
  } else {
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), toon(0x7c8691));
    fallback.position.y = 0.4;
    const out = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), outlineMat);
    out.position.y = 0.4;
    g.add(fallback, out);
  }

  enableShadows(g);
  return g;
}

function cloneEnvNode(envScene, name, x, z, rotY = 0, scale = 1, gradientMap = null, outlineMat = null) {
  const src = envScene && typeof envScene.getObjectByName === 'function' ? envScene.getObjectByName(name) : null;
  const clone = src ? src.clone(true) : createFallbackEnvMesh(name, gradientMap, outlineMat);
  clone.position.set(x, 0, z);
  clone.rotation.set(0, rotY, 0);
  if (scale !== 1) clone.scale.setScalar(scale);
  enableShadows(clone);
  return clone;
}

/**
 * Pure deterministic water test for the 56x56 4-Zone Tropical Island.
 * Matches every 3D water mesh and minimap pixel cleanly:
 * - Southern ocean (`z > 18.5`)
 * - Northern ocean behind the North Beach Helipad (`z < -26.6`)
 * - Outer East/West island ocean edges (`x < -26.5 || x > 26.5`)
 * - Zone 2 Eastern Sunken Lagoon & Swamp channels (`x: 7.2..24.5, z: -1.5..13.0`),
 *   carving out dry sandy islands, Crockstar's bank, and wadeable sandbar/bridge causeways.
 */
function checkIsWater(x, z) {
  // Outer surrounding tropical ocean
  if (z > 18.5) return true;
  if (z < -26.6) return true;
  if (x < -26.5 || x > 26.5) return true;

  // Zone 2 — Eastern Sunken Lagoon & Swamp deep water channels
  const inMainLagoon = x >= 10.8 && x <= 23.2 && z >= -1.5 && z <= 13.0;
  const inWestSwampFinger = x >= 7.2 && x <= 11.2 && z >= 1.2 && z <= 8.8;

  if (inMainLagoon || inWestSwampFinger) {
    // Dry Crockstar south-west sandy bank (keeps Crockstar at (9.5, 11.5) & approach dry)
    if (x <= 11.0 && z >= 9.0) return false;

    // Central Sunken Temple Islet (dry island inside the lagoon)
    if (x >= 14.5 && x <= 20.5 && z >= 2.5 && z <= 8.5) return false;

    // South wadeable sandy causeway spit connecting beach to Central Lagoon Islet
    if (x >= 16.0 && x <= 19.0 && z >= 8.2 && z <= 13.5) return false;

    // North Ancient Stone Ruin Bridge connecting north jungle bank to Central Lagoon Islet
    if (x >= 15.8 && x <= 18.8 && z >= -2.0 && z <= 2.8) return false;

    return true;
  }

  return false;
}

function resolveZoneAt(x, z) {
  // Zone 4 — North Beach FBI Extraction HQ
  if (z <= -11.0 && x >= -15.5 && x <= 15.5) {
    return ZONES.north_fbi_hq;
  }
  if (z <= -22.5) {
    return ZONES.north_fbi_hq;
  }

  // Zone 3 — West FBI Forward Camp
  if (x <= -9.5 && z >= -13.0 && z <= 6.8) {
    return ZONES.west_fbi_camp;
  }

  // Zone 2 — Sunken Lagoon & Swamp
  if ((x >= 6.0 && z >= -2.5 && z <= 14.8) || z > 18.5) {
    return ZONES.sunken_lagoon;
  }

  // Central Ancient Temple Courtyard sub-area inside Zone 1
  if (x >= -4.8 && x <= 4.8 && z >= -2.8 && z <= 6.5) {
    return ZONES.temple_ruins;
  }

  // Zone 1 — South Beach & Jungle
  return ZONES.south_beach;
}

// ---------------------------------------------------------------------------
// Stylized Cel-Shaded Procedural Prop Builders
// ---------------------------------------------------------------------------

function createStylizedCampfire(gradientMap, outlineMat, x, z, name = 'Starter_Campfire', isShrine = false) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, 0, z);

  const stoneMat = new THREE.MeshToonMaterial({ color: isShrine ? 0x9c8862 : 0x7c8288, gradientMap });
  const logMat = new THREE.MeshToonMaterial({ color: 0x6b4423, gradientMap });
  const flameOuterMat = new THREE.MeshBasicMaterial({ color: isShrine ? 0xff7a1a : 0xff6b1a });
  const flameInnerMat = new THREE.MeshBasicMaterial({ color: isShrine ? 0xfff078 : 0xffe047 });

  if (isShrine) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.88, 0.16, 8), stoneMat);
    plinth.position.y = 0.08;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
    const plinthOut = new THREE.Mesh(new THREE.CylinderGeometry(0.81, 0.93, 0.2, 8), outlineMat);
    plinthOut.position.y = 0.08;
    group.add(plinthOut);
  }

  const stoneGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const stoneOutlineGeo = new THREE.DodecahedronGeometry(0.205, 0);
  const ringRadius = isShrine ? 0.56 : 0.5;
  const baseY = isShrine ? 0.22 : 0.11;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.cos(a) * ringRadius;
    const sz = Math.sin(a) * ringRadius;
    const s = new THREE.Mesh(stoneGeo, stoneMat);
    s.position.set(sx, baseY, sz);
    s.scale.set(1.1, 0.72, 1.0);
    s.rotation.y = a;
    s.castShadow = true;
    s.receiveShadow = true;
    group.add(s);

    const so = new THREE.Mesh(stoneOutlineGeo, outlineMat);
    so.position.copy(s.position);
    so.scale.copy(s.scale);
    so.rotation.copy(s.rotation);
    group.add(so);
  }

  const logGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.82, 7);
  for (let i = 0; i < 3; i += 1) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.position.set(0, baseY + 0.05, 0);
    log.rotation.z = Math.PI / 2 - 0.18;
    log.rotation.y = (i / 3) * Math.PI;
    log.castShadow = true;
    group.add(log);
  }

  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.64, 6), flameOuterMat);
  flameOuter.position.y = baseY + 0.34;
  flameOuter.name = 'campfire_flame_outer';
  group.add(flameOuter);

  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.44, 6), flameInnerMat);
  flameInner.position.y = baseY + 0.28;
  flameInner.name = 'campfire_flame_inner';
  group.add(flameInner);

  group.userData.flames = [flameOuter, flameInner];

  return { group, flameOuter, flameInner };
}

function createStylizedRockMesh(mats, geos, seed = 0) {
  const group = new THREE.Group();

  const mainMesh = new THREE.Mesh(geos.rockMain, mats.rock);
  mainMesh.position.set(0, 0.42, 0);
  mainMesh.scale.set(1.15, 0.78, 0.96);
  mainMesh.rotation.set(0.15, seed * 1.1, 0.1);
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

  const mainOutline = new THREE.Mesh(geos.rockMainOut, mats.outline);
  mainOutline.position.copy(mainMesh.position);
  mainOutline.scale.copy(mainMesh.scale);
  mainOutline.rotation.copy(mainMesh.rotation);
  group.add(mainOutline);

  const subMesh = new THREE.Mesh(geos.rockSub, mats.rock);
  subMesh.position.set(0.45, 0.24, 0.22);
  subMesh.scale.set(1.0, 0.72, 0.9);
  subMesh.rotation.y = seed * 2.3;
  subMesh.castShadow = true;
  subMesh.receiveShadow = true;
  group.add(subMesh);

  const subOutline = new THREE.Mesh(geos.rockSubOut, mats.outline);
  subOutline.position.copy(subMesh.position);
  subOutline.scale.copy(subMesh.scale);
  subOutline.rotation.copy(subMesh.rotation);
  group.add(subOutline);

  const mossCap = new THREE.Mesh(geos.rockMoss, mats.moss);
  mossCap.position.set(-0.18, 0.68, -0.05);
  mossCap.scale.set(1.2, 0.45, 1.0);
  group.add(mossCap);

  return group;
}

function createFBICrateMesh(mats, geos) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(geos.crateBody, mats.crateBody);
  body.position.y = 0.36;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const outline = new THREE.Mesh(geos.crateOutline, mats.outline);
  outline.position.y = 0.36;
  group.add(outline);

  const lid = new THREE.Mesh(geos.crateLid, mats.crateTrim);
  lid.position.y = 0.75;
  lid.castShadow = true;
  group.add(lid);

  const stripe = new THREE.Mesh(geos.crateStripe, mats.fbiGold);
  stripe.position.y = 0.52;
  group.add(stripe);

  const latch = new THREE.Mesh(geos.crateLatch, mats.fbiGold);
  latch.position.set(0, 0.66, 0.41);
  group.add(latch);

  return group;
}

function createBerryBushMesh(envScene, gradientMap, mats, geos, seed = 0) {
  const group = cloneEnvNode(envScene, 'Jungle_Foliage_Bush', 0, 0, seed * 0.85, 1.05, gradientMap, mats.outline);
  // Add bright cel-shaded berry clusters so harvestable berry bushes stand out from decorative shrubs
  const berryOffsets = [
    [0.28, 0.52, 0.24],
    [-0.24, 0.56, 0.22],
    [0.06, 0.66, -0.2],
    [-0.28, 0.44, -0.18],
    [0.24, 0.42, -0.24],
    [0.0, 0.58, 0.32],
  ];
  for (const [bx, by, bz] of berryOffsets) {
    const berry = new THREE.Mesh(geos.berry, mats.berry);
    berry.position.set(bx, by, bz);
    berry.castShadow = true;
    group.add(berry);
    const bOut = new THREE.Mesh(geos.berryOut, mats.outline);
    bOut.position.set(bx, by, bz);
    group.add(bOut);
  }
  return group;
}

function createFishSpotMesh(mats, geos, x, z, idx) {
  const group = new THREE.Group();
  group.name = `Lagoon_Fish_Spot_${idx + 1}`;
  group.position.set(x, 0, z);

  // Shimmering turquoise/white water-ripple rings right at water surface
  const outerRipple = new THREE.Mesh(geos.fishRippleOuter, mats.fishRipple.clone());
  outerRipple.rotation.x = -Math.PI / 2;
  outerRipple.position.y = 0.02;
  outerRipple.userData.baseZ = 0;
  outerRipple.userData.phase = idx * 1.3;
  group.add(outerRipple);

  const innerRipple = new THREE.Mesh(geos.fishRippleInner, mats.fishRippleBright.clone());
  innerRipple.rotation.x = -Math.PI / 2;
  innerRipple.position.y = 0.03;
  group.add(innerRipple);

  // Stylized leaping cel-shaded tropical fish arc
  const fishGroup = new THREE.Group();
  fishGroup.position.set(0, 0.24, 0);
  fishGroup.rotation.y = idx * 1.1;

  const fishBody = new THREE.Mesh(geos.fishBody, mats.fishBlue);
  fishBody.scale.set(1.5, 0.72, 0.52);
  fishBody.rotation.z = 0.35;
  fishBody.castShadow = true;
  fishGroup.add(fishBody);

  const fishOut = new THREE.Mesh(geos.fishBodyOut, mats.outline);
  fishOut.scale.set(1.55, 0.78, 0.58);
  fishOut.rotation.z = 0.35;
  fishGroup.add(fishOut);

  const tail = new THREE.Mesh(geos.fishTail, mats.fishGold);
  tail.position.set(-0.34, -0.09, 0);
  tail.rotation.z = Math.PI * 0.5 + 0.35;
  fishGroup.add(tail);

  const fin = new THREE.Mesh(geos.fishTail, mats.fishGold);
  fin.position.set(0.05, 0.18, 0);
  fin.scale.setScalar(0.65);
  fishGroup.add(fin);

  group.add(fishGroup);

  // Small hovering splash droplets
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + idx;
    const drop = new THREE.Mesh(geos.splashDrop, mats.foamSolid);
    drop.position.set(Math.cos(a) * 0.36, 0.16 + (i % 2) * 0.08, Math.sin(a) * 0.36);
    group.add(drop);
  }

  return { group, outerRipple };
}

function createLilyPadMesh(mats, geos, x, z, rotY, hasLotus = false) {
  const group = new THREE.Group();
  group.position.set(x, -0.015, z);
  group.rotation.y = rotY;

  const pad = new THREE.Mesh(geos.lilyPad, mats.lilyPad);
  pad.rotation.x = -Math.PI / 2;
  pad.receiveShadow = true;
  group.add(pad);

  const rim = new THREE.Mesh(geos.lilyPadOut, mats.outline);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.008;
  group.add(rim);

  if (hasLotus) {
    const flower = new THREE.Mesh(geos.lotus, mats.lotusPink);
    flower.position.set(0.06, 0.08, 0.04);
    flower.scale.set(1.1, 0.7, 1.1);
    group.add(flower);
    const center = new THREE.Mesh(geos.lotusCore, mats.fbiGold);
    center.position.set(0.06, 0.14, 0.04);
    group.add(center);
  }

  return group;
}

function createSwampReedsMesh(mats, geos, x, z, seed = 0) {
  const group = new THREE.Group();
  group.position.set(x, -0.05, z);
  const count = 4;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + seed;
    const dist = 0.12 + (i % 2) * 0.14;
    const hScale = 0.8 + ((seed + i) % 3) * 0.22;
    const stalk = new THREE.Mesh(geos.reedStalk, mats.reedGreen);
    stalk.position.set(Math.cos(a) * dist, 0.55 * hScale, Math.sin(a) * dist);
    stalk.scale.set(1, hScale, 1);
    stalk.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.08;
    stalk.castShadow = true;
    group.add(stalk);

    if (i < 2) {
      const head = new THREE.Mesh(geos.reedHead, mats.reedBrown);
      head.position.set(stalk.position.x, 0.96 * hScale, stalk.position.z);
      head.rotation.z = stalk.rotation.z;
      group.add(head);
    }
  }
  return group;
}

function createFortifiedWallSegment(mats, width, height, depth) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats.hqConcrete);
  body.position.y = height * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const out = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.09, height + 0.09, depth + 0.09),
    mats.outline
  );
  out.position.y = height * 0.5;
  group.add(out);

  // Dark steel cap rail + yellow tactical stripe
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.16, depth + 0.08), mats.hqSteelDark);
  cap.position.y = height + 0.06;
  cap.castShadow = true;
  group.add(cap);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.16, depth + 0.03), mats.fbiGold);
  stripe.position.y = 0.42;
  group.add(stripe);

  return group;
}

/**
 * Stylized cel-shaded FBI Signal Jammer Radio Tower & Parabolic Dish with pulsing red beacon.
 */
function createSignalJammerMesh(gradientMap, outlineMat, id, x, z) {
  const group = new THREE.Group();
  group.name = `FBI_Signal_Jammer_${id}`;
  group.position.set(x, 0, z);

  const steelDark = new THREE.MeshToonMaterial({ color: 0x252b33, gradientMap });
  const steelMid = new THREE.MeshToonMaterial({ color: 0x4b5664, gradientMap });
  const goldMat = new THREE.MeshToonMaterial({ color: 0xf2c230, gradientMap });
  const dishMat = new THREE.MeshToonMaterial({ color: 0xccd4de, gradientMap });
  const beaconOrbMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });

  // Ground hazard target ring
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.15, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff4d2a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 0.04;
  group.add(targetRing);

  // Octagonal concrete/steel pedestal base + outline
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.56, 8), steelDark);
  base.position.y = 0.28;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const baseOut = new THREE.Mesh(new THREE.CylinderGeometry(0.73, 0.87, 0.61, 8), outlineMat);
  baseOut.position.y = 0.28;
  group.add(baseOut);

  // Yellow hazard collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.7, 0.14, 8), goldMat);
  collar.position.y = 0.62;
  group.add(collar);

  // Tapered radio pylon tower + outline
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.44, 2.35, 6), steelMid);
  tower.position.y = 1.82;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const towerOut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.49, 2.4, 6), outlineMat);
  towerOut.position.y = 1.82;
  group.add(towerOut);

  // Horizontal cross-strut rings
  for (const ry of [1.25, 2.05, 2.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36 - (ry - 1.25) * 0.08, 0.045, 6, 8), steelDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    group.add(ring);
  }

  // Tilted parabolic jammer dish
  const dishPivot = new THREE.Group();
  dishPivot.position.set(0, 2.48, 0.22);
  dishPivot.rotation.x = -0.35;

  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.34, 12, 1, false), dishMat);
  dish.rotation.x = -Math.PI / 2;
  dish.castShadow = true;
  dishPivot.add(dish);

  const dishOut = new THREE.Mesh(new THREE.ConeGeometry(0.77, 0.38, 12, 1, false), outlineMat);
  dishOut.rotation.x = -Math.PI / 2;
  dishPivot.add(dishOut);

  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.46, 6), goldMat);
  emitter.rotation.x = Math.PI / 2;
  emitter.position.z = 0.24;
  dishPivot.add(emitter);

  const emitterTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), beaconOrbMat);
  emitterTip.position.z = 0.48;
  dishPivot.add(emitterTip);

  group.add(dishPivot);

  // Top spire & pulsing red beacon sphere
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.72, 6), steelDark);
  spire.position.y = 3.28;
  spire.castShadow = true;
  group.add(spire);

  const beaconOrb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), beaconOrbMat);
  beaconOrb.position.y = 3.72;
  group.add(beaconOrb);

  const beaconOut = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), outlineMat);
  beaconOut.position.y = 3.72;
  group.add(beaconOut);

  const beaconLight = new THREE.PointLight(0xff2b2b, 2.2, 8.5, 1.5);
  beaconLight.position.set(0, 3.85, 0);
  group.add(beaconLight);

  group.userData.beaconOrb = beaconOrb;
  group.userData.beaconOrbMat = beaconOrbMat;
  group.userData.targetRing = targetRing;
  group.userData.dishPivot = dishPivot;

  return { group, beaconLight, beaconOrbMat };
}

/**
 * Stylized Mid-Poly Cel-Shaded Black & Gold FBI Extraction Helicopter sitting on the North Beach Helipad.
 * Exposes `escapeVehicle.userData.rotor` (main spinning top rotor group) and `tailRotor`.
 */
function createFBIEscapeHelicopter(gradientMap, outlineMat, x, z) {
  const vehicle = new THREE.Group();
  vehicle.name = 'FBI_Escape_Chopper';
  vehicle.position.set(x, 0, z);
  vehicle.rotation.y = Math.PI * 0.14;

  const hullBlack = new THREE.MeshToonMaterial({ color: 0x1b2028, gradientMap });
  const hullCharcoal = new THREE.MeshToonMaterial({ color: 0x2c3440, gradientMap });
  const goldMat = new THREE.MeshToonMaterial({ color: 0xf2c61b, gradientMap });
  const glassMat = new THREE.MeshToonMaterial({
    color: 0x38bdf8,
    gradientMap,
    transparent: true,
    opacity: 0.84,
  });
  const rotorSteel = new THREE.MeshToonMaterial({ color: 0x3a434f, gradientMap });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff5c2 });

  const addOutlinedBox = (parent, w, h, d, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    const o = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, d + 0.08), outlineMat);
    o.position.copy(m.position);
    o.rotation.copy(m.rotation);
    parent.add(o);
    return m;
  };

  // Twin Landing Skids & Struts (planted cleanly on helipad top y = 0.08)
  for (const side of [-1, 1]) {
    const sx = side * 0.92;
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 3.05, 8), rotorSteel);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, 0.14, 0.12);
    skid.castShadow = true;
    vehicle.add(skid);

    // Upturned front skid toe
    const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.42, 8), goldMat);
    toe.rotation.x = Math.PI / 2 - 0.55;
    toe.position.set(sx, 0.24, 1.76);
    vehicle.add(toe);

    // Front & rear support struts
    for (const sz of [-0.62, 0.72]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6), rotorSteel);
      strut.position.set(side * 0.72, 0.42, sz);
      strut.rotation.z = side * 0.36;
      strut.castShadow = true;
      vehicle.add(strut);
    }
  }

  // Main Tactical Fuselage Cabin
  addOutlinedBox(vehicle, 1.56, 1.18, 2.35, hullBlack, 0, 1.18, 0.1);

  // Sloped Cockpit Nose + Tinted Cyan Canopy
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.74, 1.05), hullBlack);
  nose.position.set(0, 0.98, 1.55);
  nose.rotation.x = 0.22;
  nose.castShadow = true;
  vehicle.add(nose);
  const noseOut = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.82, 1.12), outlineMat);
  noseOut.position.copy(nose.position);
  noseOut.rotation.copy(nose.rotation);
  vehicle.add(noseOut);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.66, 0.96), glassMat);
  canopy.position.set(0, 1.38, 1.34);
  canopy.rotation.x = 0.42;
  vehicle.add(canopy);

  // Side windows
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.92), glassMat);
    win.position.set(side * 0.79, 1.36, 0.45);
    vehicle.add(win);

    // Bold Gold FBI Stripe & Emblem Plate along fuselage flank
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 2.28), goldMat);
    stripe.position.set(side * 0.8, 0.92, 0.12);
    vehicle.add(stripe);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.66), goldMat);
    badge.position.set(side * 0.81, 1.24, -0.45);
    vehicle.add(badge);
  }

  // Top Turbine Housing + Twin Exhaust Pods
  addOutlinedBox(vehicle, 0.98, 0.44, 1.65, hullCharcoal, 0, 1.94, -0.15);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.65, 8), rotorSteel);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.58, 1.92, -0.68);
    pod.castShadow = true;
    vehicle.add(pod);
  }

  // Nose Searchlight
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lampMat);
  lamp.position.set(0, 0.82, 2.12);
  vehicle.add(lamp);

  // Swept Tail Boom + Vertical Fin + Gold Stripe
  addOutlinedBox(vehicle, 0.42, 0.44, 2.35, hullBlack, 0, 1.36, -2.05, 0.06, 0, 0);
  const tailStripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 2.0), goldMat);
  tailStripe.position.set(0, 1.36, -2.05);
  tailStripe.rotation.x = 0.06;
  vehicle.add(tailStripe);

  addOutlinedBox(vehicle, 0.18, 1.15, 0.68, hullCharcoal, 0, 1.88, -3.12, -0.22, 0, 0);
  const finGold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.56), goldMat);
  finGold.position.set(0, 2.28, -3.22);
  vehicle.add(finGold);

  // Horizontal Tail Stabilizer Wings
  addOutlinedBox(vehicle, 1.45, 0.1, 0.4, hullCharcoal, 0, 1.44, -2.78);

  // Spinning Tail Rotor Group
  const tailRotor = new THREE.Group();
  tailRotor.name = 'FBI_Chopper_TailRotor';
  tailRotor.position.set(0.22, 1.88, -3.14);
  for (let i = 0; i < 2; i += 1) {
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.88, 0.12), i === 0 ? goldMat : rotorSteel);
    tBlade.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(tBlade);
  }
  vehicle.add(tailRotor);

  // Main Rotor Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 8), rotorSteel);
  mast.position.set(0, 2.26, 0.08);
  mast.castShadow = true;
  vehicle.add(mast);

  // Main Spinning Top Rotor Group (`escapeVehicle.userData.rotor`)
  const rotor = new THREE.Group();
  rotor.name = 'FBI_Chopper_MainRotor';
  rotor.position.set(0, 2.46, 0.08);

  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 10), goldMat);
  hubCap.castShadow = true;
  rotor.add(hubCap);

  const hubOut = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.2, 10), outlineMat);
  rotor.add(hubOut);

  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI) / 2;

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 2.55), rotorSteel);
    blade.position.set(0, 0, 1.42);
    blade.castShadow = true;
    arm.add(blade);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.38), goldMat);
    tip.position.set(0, 0, 2.52);
    arm.add(tip);

    rotor.add(arm);
  }

  vehicle.add(rotor);

  vehicle.userData.rotor = rotor;
  vehicle.userData.tailRotor = tailRotor;
  return vehicle;
}

/**
 * Raised octagonal helipad deck with bold yellow ring and stylized 'H' marking at (0, 0, -25).
 */
function createHelipadPlatform(mats, x, z) {
  const group = new THREE.Group();
  group.name = 'North_HQ_Helipad';
  group.position.set(x, 0, z);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.65, 0.12, 12), mats.hqPad);
  pad.position.y = 0.02;
  pad.receiveShadow = true;
  group.add(pad);

  const padOut = new THREE.Mesh(new THREE.CylinderGeometry(3.42, 3.74, 0.1, 12), mats.outline);
  padOut.position.y = 0.01;
  group.add(padOut);

  // Outer yellow safety circle ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.58, 2.92, 32), mats.helipadYellow);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.088;
  group.add(ring);

  // Inner dark contrast circle
  const innerDisc = new THREE.Mesh(new THREE.CircleGeometry(2.55, 32), mats.hqPadInner);
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = 0.084;
  innerDisc.receiveShadow = true;
  group.add(innerDisc);

  // Stylized Yellow 'H' Marking
  const barL = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 2.45), mats.helipadYellow);
  barL.rotation.x = -Math.PI / 2;
  barL.position.set(-0.78, 0.09, 0);
  group.add(barL);

  const barR = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 2.45), mats.helipadYellow);
  barR.rotation.x = -Math.PI / 2;
  barR.position.set(0.78, 0.09, 0);
  group.add(barR);

  const cross = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.36), mats.helipadYellow);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.09, 0);
  group.add(cross);

  // 4 Corner Runway Bollard Beacons
  const bollardGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.34, 8);
  const bulbGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (const [bx, bz] of [
    [-2.85, -2.05],
    [2.85, -2.05],
    [-2.85, 2.05],
    [2.85, 2.05],
  ]) {
    const post = new THREE.Mesh(bollardGeo, mats.hqSteelDark);
    post.position.set(bx, 0.17, bz);
    post.castShadow = true;
    group.add(post);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(bx, 0.37, bz);
    group.add(bulb);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Main 56x56 4-Zone Island Map Builder
// ---------------------------------------------------------------------------

export function buildExpandedIslandMap(scene, envScene, gradientMap, ctx) {
  const gMap = gradientMap || createFallbackGradientMap();

  // Safely ensure required ctx arrays/objects exist (helpful for standalone/headless tests)
  const safeCtx = ctx || {};
  if (!Array.isArray(safeCtx.harvestables)) safeCtx.harvestables = [];
  if (!Array.isArray(safeCtx.buildings)) safeCtx.buildings = [];
  if (!Array.isArray(safeCtx.jammers)) safeCtx.jammers = [];
  const addCollider = (id, x, z, radius) => {
    if (typeof safeCtx.addCollider === 'function') {
      safeCtx.addCollider(id, x, z, radius);
    }
  };

  const worldGroup = new THREE.Group();
  worldGroup.name = 'Expanded_Island_World_56x56';
  if (scene && typeof scene.add === 'function') {
    scene.add(worldGroup);
  }

  const animatedLights = [];
  const animatedFlames = [];
  const waterFoamStrips = [];
  const jammers = safeCtx.jammers;

  // Shared Cel-Shaded Material Palette
  const mats = {
    outline: new THREE.MeshBasicMaterial({ color: 0x15181d, side: THREE.BackSide }),
    oceanDeep: new THREE.MeshToonMaterial({ color: 0x144862, gradientMap: gMap }),
    lagoonBed: new THREE.MeshToonMaterial({ color: 0x195b6e, gradientMap: gMap }),
    waterSurface: new THREE.MeshToonMaterial({
      color: 0x26a9c8,
      gradientMap: gMap,
      transparent: true,
      opacity: 0.78,
    }),
    swampWater: new THREE.MeshToonMaterial({
      color: 0x21929c,
      gradientMap: gMap,
      transparent: true,
      opacity: 0.8,
    }),
    grassMain: new THREE.MeshToonMaterial({ color: 0x487d37, gradientMap: gMap }),
    grassSwamp: new THREE.MeshToonMaterial({ color: 0x3f7139, gradientMap: gMap }),
    sandBeach: new THREE.MeshToonMaterial({ color: 0xe3c67c, gradientMap: gMap }),
    dirtTrail: new THREE.MeshToonMaterial({ color: 0xa28655, gradientMap: gMap }),
    westCampPad: new THREE.MeshToonMaterial({ color: 0x52575e, gradientMap: gMap }),
    hqConcrete: new THREE.MeshToonMaterial({ color: 0x434a54, gradientMap: gMap }),
    hqPad: new THREE.MeshToonMaterial({ color: 0x2c323b, gradientMap: gMap }),
    hqPadInner: new THREE.MeshToonMaterial({ color: 0x22272f, gradientMap: gMap }),
    hqSteelDark: new THREE.MeshToonMaterial({ color: 0x1d2228, gradientMap: gMap }),
    fbiGold: new THREE.MeshToonMaterial({ color: 0xf2c230, gradientMap: gMap }),
    helipadYellow: new THREE.MeshBasicMaterial({ color: 0xf2c61b }),
    rock: new THREE.MeshToonMaterial({ color: 0x7b8590, gradientMap: gMap }),
    moss: new THREE.MeshToonMaterial({ color: 0x528238, gradientMap: gMap }),
    crateBody: new THREE.MeshToonMaterial({ color: 0x39453f, gradientMap: gMap }),
    crateTrim: new THREE.MeshToonMaterial({ color: 0x21272b, gradientMap: gMap }),
    berry: new THREE.MeshToonMaterial({ color: 0xe03568, gradientMap: gMap }),
    lilyPad: new THREE.MeshToonMaterial({ color: 0x4aa83b, gradientMap: gMap }),
    lotusPink: new THREE.MeshToonMaterial({ color: 0xf472b6, gradientMap: gMap }),
    reedGreen: new THREE.MeshToonMaterial({ color: 0x437a32, gradientMap: gMap }),
    reedBrown: new THREE.MeshToonMaterial({ color: 0x6f4728, gradientMap: gMap }),
    bridgeWood: new THREE.MeshToonMaterial({ color: 0x8a5b32, gradientMap: gMap }),
    fishBlue: new THREE.MeshToonMaterial({ color: 0x38bdf8, gradientMap: gMap }),
    fishGold: new THREE.MeshToonMaterial({ color: 0xfbbf24, gradientMap: gMap }),
    foamSolid: new THREE.MeshBasicMaterial({ color: 0xe6fbff }),
    fishRipple: new THREE.MeshBasicMaterial({
      color: 0xcffafe,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    fishRippleBright: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };

  // Shared Procedural Geometries
  const geos = {
    rockMain: new THREE.DodecahedronGeometry(0.68, 0),
    rockMainOut: new THREE.DodecahedronGeometry(0.73, 0),
    rockSub: new THREE.DodecahedronGeometry(0.38, 0),
    rockSubOut: new THREE.DodecahedronGeometry(0.42, 0),
    rockMoss: new THREE.DodecahedronGeometry(0.32, 0),
    crateBody: new THREE.BoxGeometry(0.92, 0.72, 0.78),
    crateOutline: new THREE.BoxGeometry(0.98, 0.78, 0.84),
    crateLid: new THREE.BoxGeometry(0.98, 0.12, 0.84),
    crateStripe: new THREE.BoxGeometry(0.94, 0.11, 0.8),
    crateLatch: new THREE.BoxGeometry(0.16, 0.16, 0.08),
    berry: new THREE.SphereGeometry(0.1, 7, 7),
    berryOut: new THREE.SphereGeometry(0.125, 7, 7),
    fishRippleOuter: new THREE.RingGeometry(0.56, 0.74, 24),
    fishRippleInner: new THREE.RingGeometry(0.24, 0.36, 20),
    fishBody: new THREE.SphereGeometry(0.19, 8, 8),
    fishBodyOut: new THREE.SphereGeometry(0.22, 8, 8),
    fishTail: new THREE.ConeGeometry(0.13, 0.24, 4),
    splashDrop: new THREE.SphereGeometry(0.045, 5, 5),
    lilyPad: new THREE.CircleGeometry(0.48, 12, 0.22, Math.PI * 1.86),
    lilyPadOut: new THREE.CircleGeometry(0.52, 12, 0.22, Math.PI * 1.86),
    lotus: new THREE.OctahedronGeometry(0.14, 0),
    lotusCore: new THREE.SphereGeometry(0.06, 6, 6),
    reedStalk: new THREE.CylinderGeometry(0.025, 0.04, 1.1, 5),
    reedHead: new THREE.CylinderGeometry(0.055, 0.055, 0.28, 6),
  };

  // =========================================================================
  // 0. BASE OCEAN, ISLAND TERRAIN, BEACHES, TRAILS & 56x56 GRID
  // =========================================================================

  // Vast Deep Ocean Backdrop
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mats.oceanDeep);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.62;
  ocean.receiveShadow = true;
  worldGroup.add(ocean);

  // Outer Translucent Ocean Water Plane (surrounds the entire island beyond shorelines)
  const outerWater = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mats.waterSurface);
  outerWater.rotation.x = -Math.PI / 2;
  outerWater.position.y = -0.09;
  outerWater.receiveShadow = true;
  worldGroup.add(outerWater);

  // Helper to add raised flat island land slabs (top surface cleanly at y = 0.0)
  const addLandSlab = (w, d, cx, cz, mat, topY = 0.0, thickness = 0.56) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), mat);
    slab.position.set(cx, topY - thickness * 0.5, cz);
    slab.receiveShadow = true;
    worldGroup.add(slab);
    return slab;
  };

  // Main Western & Central Tropical Island Grass Body:
  // West half: x in [-26.5, 10.8], z in [-24.0, 13.0]
  addLandSlab(37.3, 37.0, -7.85, -5.5, mats.grassMain, 0.0);

  // North-East Jungle Peninsula above the Sunken Lagoon: x in [10.6, 26.5], z in [-24.0, -1.4]
  addLandSlab(15.9, 22.6, 18.55, -12.7, mats.grassMain, 0.0);

  // Far-East Outer Lagoon Shore Bank: x in [23.2, 26.5], z in [-1.6, 13.4]
  addLandSlab(3.3, 15.0, 24.85, 5.9, mats.grassSwamp, 0.0);

  // Crockstar's South-West Lagoon Bank (fills x in [7.0, 11.0], z in [8.8, 13.2])
  addLandSlab(4.2, 4.5, 9.0, 11.0, mats.sandBeach, 0.002);

  // Southern Golden Sandy Beach Shoreline Strip (x in [-26.5, 26.5], z in [12.5, 18.5])
  addLandSlab(53.0, 6.1, 0, 15.5, mats.sandBeach, 0.003);

  // Northern Golden Sandy Beach Strip (x in [-26.5, 26.5], z in [-26.6, -23.5])
  addLandSlab(53.0, 3.2, 0, -25.05, mats.sandBeach, 0.002);

  // Carve & visually render the Sunken Lagoon & Swamp Water Basin (matching checkIsWater exactly!)
  const lagoonBed = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 15.2), mats.lagoonBed);
  lagoonBed.rotation.x = -Math.PI / 2;
  lagoonBed.position.set(15.6, -0.46, 5.7);
  lagoonBed.receiveShadow = true;
  worldGroup.add(lagoonBed);

  // Main Lagoon turquoise water sheet (x: 10.8..23.2, z: -1.5..13.0)
  const mainLagoonWater = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 14.7), mats.waterSurface);
  mainLagoonWater.rotation.x = -Math.PI / 2;
  mainLagoonWater.position.set(17.0, -0.04, 5.75);
  mainLagoonWater.receiveShadow = true;
  worldGroup.add(mainLagoonWater);

  // Western Swamp Water Finger (x: 7.2..11.2, z: 1.2..8.8) — recessed neatly into grass
  // Carve visual inset by placing darker teal swamp sheet slightly above grass seam with mossy shore rim
  const swampWater = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 7.6), mats.swampWater);
  swampWater.rotation.x = -Math.PI / 2;
  swampWater.position.set(9.2, 0.006, 5.0);
  swampWater.receiveShadow = true;
  worldGroup.add(swampWater);

  // Dry Central Sunken Temple Islet (x: 14.5..20.5, z: 2.5..8.5) rising above lagoon water!
  addLandSlab(6.0, 6.0, 17.5, 5.5, mats.sandBeach, 0.015, 0.52);
  const isletGrass = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), mats.grassSwamp);
  isletGrass.rotation.x = -Math.PI / 2;
  isletGrass.position.set(17.5, 0.022, 5.5);
  isletGrass.receiveShadow = true;
  worldGroup.add(isletGrass);

  // Dry South Wadeable Sandbar Causeway (x: 16.0..19.0, z: 8.2..13.5)
  addLandSlab(3.0, 5.3, 17.5, 10.85, mats.sandBeach, 0.008, 0.45);

  // Dry North Ancient Stone/Wood Ruin Bridge Causeway (x: 15.8..18.8, z: -2.0..2.8)
  addLandSlab(3.0, 4.8, 17.3, 0.4, mats.sandBeach, 0.006, 0.44);
  for (let bz = -1.6; bz <= 2.4; bz += 0.72) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.54), mats.bridgeWood);
    plank.position.set(17.3, 0.04, bz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    worldGroup.add(plank);
  }
  // Low stone bridge side curbs (purely decorative inside narrow margin)
  for (const bx of [16.02, 18.58]) {
    for (const bz of [-1.2, 0.4, 2.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.24), mats.rock);
      post.position.set(bx, 0.18, bz);
      post.castShadow = true;
      worldGroup.add(post);
    }
  }

  // Stylized Animated Foam Strips along South Ocean, North Ocean, and Lagoon Channels
  const foamMatBase = new THREE.MeshBasicMaterial({
    color: 0xdff9ff,
    transparent: true,
    opacity: 0.72,
  });
  const addFoamStrip = (width, depth, fx, fy, fz, phase, rotY = 0) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), foamMatBase.clone());
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = rotY;
    strip.position.set(fx, fy, fz);
    strip.userData.baseZ = fz;
    strip.userData.phase = phase;
    worldGroup.add(strip);
    waterFoamStrips.push(strip);
    return strip;
  };

  // Southern Beach Shoreline Surf Foam
  for (let i = 0; i < 3; i += 1) {
    addFoamStrip(52.0, i === 0 ? 0.32 : 0.16, 0, -0.02, 18.65 + i * 2.4, i * 1.8);
  }
  // Northern Beach Surf Foam behind Helipad
  addFoamStrip(50.0, 0.28, 0, -0.02, -26.75, 0.9);
  addFoamStrip(48.0, 0.16, 0, -0.02, -27.7, 2.7);
  // Lagoon internal gentle ripples
  addFoamStrip(4.2, 0.16, 13.0, -0.012, 11.4, 0.5);
  addFoamStrip(4.2, 0.16, 21.0, -0.012, 10.6, 2.1);
  addFoamStrip(3.8, 0.16, 13.0, -0.012, 1.5, 3.4);
  addFoamStrip(3.2, 0.15, 21.2, -0.012, 1.2, 1.4);
  addFoamStrip(3.2, 0.14, 9.2, 0.015, 4.8, 2.6);

  // Subtle Dirt Trails guiding player naturally across all 4 zones
  const trailPatches = [
    // South Beach -> Starter Campfire -> Temple Courtyard
    [0, 10.2, 2.8, 4.8, 0],
    [0, 7.2, 2.8, 3.6, 0.05],
    // South Beach East -> Crockstar & Sunken Lagoon
    [4.6, 12.2, 6.2, 2.2, -0.14],
    [8.2, 11.6, 4.2, 2.4, -0.05],
    // Temple Courtyard West -> West FBI Forward Camp
    [-6.6, 1.2, 6.4, 2.2, 0.12],
    [-9.6, -1.0, 4.0, 2.8, -0.15],
    // Temple Courtyard North -> North HQ Chokepoint
    [0, -5.8, 2.8, 8.6, 0],
    [0, -10.2, 3.8, 2.6, 0],
    // West FBI Camp North Flank -> North HQ West Breach
    [-15.4, -14.2, 2.4, 7.0, 0.15],
    // Lagoon North Bank -> North HQ East Breach
    [15.4, -9.8, 2.4, 11.5, -0.08],
  ];
  for (const [tx, tz, tw, td, rz] of trailPatches) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(tw, td), mats.dirtTrail);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rz;
    patch.position.set(tx, 0.011, tz);
    patch.receiveShadow = true;
    worldGroup.add(patch);
  }

  // Subtle 56x56 Grid Overlay for clean 1x1 blueprint alignment
  const gridHelper = new THREE.GridHelper(56, 56, 0x325828, 0x3b6730);
  gridHelper.position.set(0, 0.008, 0);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.16;
  worldGroup.add(gridHelper);

  // =========================================================================
  // ZONE 1 — SOUTH BEACH, STARTER CAMP & ANCIENT TEMPLE COURTYARD
  // =========================================================================

  // Starter Campfire at (0, 0, 11) — Registered in ctx.buildings & Default Respawn Point
  const starterCampfire = createStylizedCampfire(gMap, mats.outline, 0, 11, 'Starter_Campfire', false);
  const starterFireLight = new THREE.PointLight(0xff8c2a, 2.5, 9.5, 1.4);
  starterFireLight.position.set(0, 1.15, 0);
  starterCampfire.group.add(starterFireLight);
  worldGroup.add(starterCampfire.group);

  animatedLights.push({ light: starterFireLight, base: 2.5, amp: 0.45, phase: 0.4 });
  animatedFlames.push({ outer: starterCampfire.flameOuter, inner: starterCampfire.flameInner, phase: 0 });
  addCollider('building-starter-campfire', 0, 11, 0.65);
  safeCtx.buildings.push({
    id: 'building-starter-campfire',
    type: 'campfire',
    mesh: starterCampfire.group,
    x: 0,
    z: 11,
    radius: 0.65,
    light: starterFireLight,
  });
  if (safeCtx.player?.respawnPoint && typeof safeCtx.player.respawnPoint.set === 'function') {
    safeCtx.player.respawnPoint.set(0, 0, 11);
  }

  // Ancient Temple Courtyard Ruins centered around (0, 0, 2) -> gx: -3..3, gz: -1..5
  for (let gx = -3; gx <= 3; gx += 1) {
    for (let gz = -1; gz <= 5; gz += 1) {
      const tile = cloneEnvNode(envScene, 'Ruin_Sandstone_Floor', gx, gz, 0, 1, gMap, mats.outline);
      if (tile) worldGroup.add(tile);
    }
  }

  // Mossy Temple Perimeter Walls with wide open cardinal archways
  for (const gx of [-3, -2, 2, 3]) {
    // North courtyard wall (z = -1.5)
    const wallN = cloneEnvNode(envScene, 'Ruin_Temple_Wall', gx, -1.5, 0, 1, gMap, mats.outline);
    if (wallN) worldGroup.add(wallN);
    addCollider(`ruin-wall-n-${gx}`, gx, -1.5, 0.58);

    // South courtyard wall (z = 5.5)
    const wallS = cloneEnvNode(envScene, 'Ruin_Temple_Wall', gx, 5.5, 0, 1, gMap, mats.outline);
    if (wallS) worldGroup.add(wallS);
    addCollider(`ruin-wall-s-${gx}`, gx, 5.5, 0.58);
  }
  for (const gz of [-1, 0, 4, 5]) {
    // West courtyard wall (x = -3.5)
    const wallW = cloneEnvNode(envScene, 'Ruin_Temple_Wall', -3.5, gz, Math.PI / 2, 1, gMap, mats.outline);
    if (wallW) worldGroup.add(wallW);
    addCollider(`ruin-wall-w-${gz}`, -3.5, gz, 0.58);

    // East courtyard wall (x = 3.5)
    const wallE = cloneEnvNode(envScene, 'Ruin_Temple_Wall', 3.5, gz, Math.PI / 2, 1, gMap, mats.outline);
    if (wallE) worldGroup.add(wallE);
    addCollider(`ruin-wall-e-${gz}`, 3.5, gz, 0.58);
  }

  // Carved Stone Pillars at courtyard corners
  [
    [-3.5, -1.5],
    [3.5, -1.5],
    [-3.5, 5.5],
    [3.5, 5.5],
  ].forEach(([px, pz], idx) => {
    const pillar = cloneEnvNode(envScene, 'Ruin_Stone_Pillar', px, pz, 0, 1, gMap, mats.outline);
    if (pillar) worldGroup.add(pillar);
    addCollider(`ruin-pillar-${idx}`, px, pz, 0.56);
  });

  // Flickering Temple Fire Braziers (front south entrance gets real PointLights; north entrance glows emissively)
  [
    { x: -1.7, z: 5.5, hasLight: true },
    { x: 1.7, z: 5.5, hasLight: true },
    { x: -1.7, z: -1.5, hasLight: false },
    { x: 1.7, z: -1.5, hasLight: false },
  ].forEach((b, idx) => {
    const brazier = cloneEnvNode(envScene, 'Ruin_Fire_Brazier', b.x, b.z, 0, 1, gMap, mats.outline);
    if (brazier) worldGroup.add(brazier);
    if (b.hasLight) {
      const light = new THREE.PointLight(0xff8c2a, 2.1, 8.5, 1.4);
      light.position.set(b.x, 1.75, b.z);
      worldGroup.add(light);
      animatedLights.push({ light, base: 2.1, amp: 0.4, phase: idx * 2.1 });
    }
    addCollider(`ruin-brazier-${idx}`, b.x, b.z, 0.46);
  });

  // =========================================================================
  // ZONE 2 — SUNKEN LAGOON, SWAMP, SUNKEN RUINS & FISH SPOTS
  // =========================================================================

  // Overgrown Sunken Temple Ruins on Central Lagoon Islet (17.5, 5.5)
  for (let gx = 16; gx <= 19; gx += 1) {
    for (let gz = 4; gz <= 7; gz += 1) {
      const tile = cloneEnvNode(envScene, 'Ruin_Sandstone_Floor', gx, gz, 0, 1, gMap, mats.outline);
      if (tile) {
        tile.position.y = 0.02;
        worldGroup.add(tile);
      }
    }
  }
  [
    [15.6, 3.6],
    [19.4, 3.6],
    [15.6, 7.4],
    [19.4, 7.4],
  ].forEach(([px, pz], idx) => {
    const p = cloneEnvNode(envScene, 'Ruin_Stone_Pillar', px, pz, idx * 0.4, 0.92, gMap, mats.outline);
    if (p) {
      p.position.y = 0.02;
      worldGroup.add(p);
    }
    addCollider(`lagoon-ruin-pillar-${idx}`, px, pz, 0.5);
  });
  const lagoonWall = cloneEnvNode(envScene, 'Ruin_Temple_Wall', 19.6, 5.5, Math.PI / 2, 1, gMap, mats.outline);
  if (lagoonWall) worldGroup.add(lagoonWall);
  addCollider('lagoon-ruin-wall-e', 19.6, 5.5, 0.56);

  // Sunken Islet Mystic Brazier
  const isletBrazier = cloneEnvNode(envScene, 'Ruin_Fire_Brazier', 17.5, 5.5, 0, 1, gMap, mats.outline);
  if (isletBrazier) {
    isletBrazier.position.y = 0.02;
    worldGroup.add(isletBrazier);
  }
  const isletLight = new THREE.PointLight(0xff9b38, 2.0, 9.0, 1.4);
  isletLight.position.set(17.5, 1.8, 5.5);
  worldGroup.add(isletLight);
  animatedLights.push({ light: isletLight, base: 2.0, amp: 0.35, phase: 1.7 });
  addCollider('lagoon-islet-brazier', 17.5, 5.5, 0.46);

  // Half-submerged Sunken Pillars jutting dramatically out of the lagoon channels
  [
    [12.4, 3.5, 0.14],
    [22.0, 7.8, -0.18],
    [13.2, 9.6, 0.1],
  ].forEach(([sx, sz, tilt], idx) => {
    const sp = cloneEnvNode(envScene, 'Ruin_Stone_Pillar', sx, sz, idx * 1.2, 0.85, gMap, mats.outline);
    if (sp) {
      sp.position.y = -0.58;
      sp.rotation.z = tilt;
      worldGroup.add(sp);
    }
  });

  // Lily Pads & Blooming Lotuses scattered across Lagoon & Swamp water channels
  const lilyCoords = [
    [8.2, 3.2, 0.4, true],
    [9.8, 2.4, 1.8, false],
    [8.6, 6.8, 2.5, true],
    [10.2, 5.2, 0.9, false],
    [12.0, 6.2, 1.3, true],
    [13.4, 4.8, 2.8, false],
    [12.6, 10.6, 0.7, true],
    [14.2, 11.8, 3.1, false],
    [21.4, 3.8, 1.1, true],
    [22.2, 6.4, 2.2, false],
    [20.6, 10.2, 0.2, true],
    [22.0, 11.6, 1.9, false],
    [13.5, 0.4, 2.7, true],
    [20.8, 0.6, 0.8, false],
  ];
  for (const [lx, lz, rot, lotus] of lilyCoords) {
    worldGroup.add(createLilyPadMesh(mats, geos, lx, lz, rot, lotus));
  }

  // Swamp Reeds along lagoon & swamp edges
  const reedCoords = [
    [7.4, 2.2],
    [7.5, 7.6],
    [10.8, 7.8],
    [11.4, 12.6],
    [15.4, 12.2],
    [19.6, 12.4],
    [22.8, 9.8],
    [22.9, 2.4],
    [14.8, 2.7],
    [14.8, 8.2],
    [20.2, 2.8],
    [12.0, -1.2],
    [21.6, -1.2],
  ];
  reedCoords.forEach(([rx, rz], idx) => {
    worldGroup.add(createSwampReedsMesh(mats, geos, rx, rz, idx + 1));
  });

  // Harvestable Fish Spots on Lagoon Banks (shimmering water-ripple fishing nodes giving fish + meat!)
  // Positioned right along the shallow shoreline so Boots harvests easily from dry land without snagging.
  const fishSpotDefs = [
    { x: 11.1, z: 10.4 }, // right beside Crockstar's bank at (9.5, 11.5)!
    { x: 11.1, z: 12.2 }, // south-west lagoon shore
    { x: 15.6, z: 9.8 },  // west edge of south sandbar
    { x: 19.4, z: 9.4 },  // east edge of south sandbar
    { x: 14.1, z: 4.8 },  // west shore of sunken temple islet
    { x: 7.4, z: 5.8 },   // western swamp cove bank
    { x: 13.6, z: -1.3 }, // northern lagoon bank
    { x: 4.8, z: 18.2 },  // southern beach tidepool
  ];
  fishSpotDefs.forEach((fs, idx) => {
    const id = `harvest-fish-spot-${idx + 1}`;
    const { group, outerRipple } = createFishSpotMesh(mats, geos, fs.x, fs.z, idx);
    worldGroup.add(group);
    // Gentle ripple animation via waterFoamStrips
    outerRipple.userData.baseZ = 0;
    outerRipple.userData.phase = idx * 1.4;
    waterFoamStrips.push(outerRipple);

    safeCtx.harvestables.push({
      id,
      type: 'fish_spot',
      mesh: group,
      x: fs.x,
      z: fs.z,
      radius: 0.85,
      hp: 30,
      maxHp: 30,
      loot: [
        { id: 'fish', name: 'Raw Fish', count: 2, type: 'food' },
        { id: 'meat', name: 'Prime Meat', count: 1, type: 'food' },
      ],
      depleted: false,
      respawnTimer: 0,
    });
  });

  // =========================================================================
  // ZONE 3 — WEST FBI FORWARD CAMP (x: -24..-10, z: -12..6)
  // =========================================================================

  // Tactical gravel/asphalt compound pad
  const westCampFloor = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 17.5), mats.westCampPad);
  westCampFloor.rotation.x = -Math.PI / 2;
  westCampFloor.position.set(-17.0, 0.012, -3.2);
  westCampFloor.receiveShadow = true;
  worldGroup.add(westCampFloor);

  // Subtle yellow perimeter compound stripes
  const westBorderN = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 0.18), mats.helipadYellow);
  westBorderN.rotation.x = -Math.PI / 2;
  westBorderN.position.set(-17.0, 0.016, -11.8);
  worldGroup.add(westBorderN);
  const westBorderS = westBorderN.clone();
  westBorderS.position.set(-17.0, 0.016, 5.4);
  worldGroup.add(westBorderS);

  // FBI Tactical Black Tents
  const westTents = [
    { id: 'west-tent-1', x: -21.8, z: -8.8, ry: Math.PI * 0.22 },
    { id: 'west-tent-2', x: -13.2, z: -9.4, ry: -0.18 },
    { id: 'west-tent-3', x: -22.0, z: 1.8, ry: Math.PI * 0.42 },
  ];
  for (const t of westTents) {
    const tent = cloneEnvNode(envScene, 'FBI_Tactical_Tent', t.x, t.z, t.ry, 1, gMap, mats.outline);
    if (tent) worldGroup.add(tent);
    addCollider(t.id, t.x, t.z, 1.45);
  }

  // Smuff's Locked Holding Cage at EXACT (-18, 0, -4)
  const cage = cloneEnvNode(envScene, 'FBI_Holding_Cage', -18, -4, 0, 1, gMap, mats.outline);
  if (cage) worldGroup.add(cage);
  if (safeCtx.fbi?.smuff) {
    if (safeCtx.fbi.smuff.pos && typeof safeCtx.fbi.smuff.pos.set === 'function') {
      safeCtx.fbi.smuff.pos.set(-18, 0, -4);
    }
    safeCtx.fbi.smuff.cageMesh = cage;
    safeCtx.fbi.smuff.cageColliderId = 'fbi_cage';
  }
  addCollider('fbi_cage', -18, -4, 0.72);

  // West Camp Tripod Floodlights (with volumetric cones)
  const westFloodlights = [
    { x: -14.8, z: -6.2, ry: -Math.PI * 0.68, hasLight: true },
    { x: -20.6, z: -1.4, ry: Math.PI * 0.35, hasLight: true },
    { x: -11.4, z: 2.8, ry: -Math.PI * 0.25, hasLight: false },
    { x: -18.0, z: -10.4, ry: 0.05, hasLight: false },
  ];
  westFloodlights.forEach((fl, idx) => {
    const mesh = cloneEnvNode(envScene, 'FBI_Tripod_Floodlight', fl.x, fl.z, fl.ry, 1, gMap, mats.outline);
    if (mesh) worldGroup.add(mesh);
    if (fl.hasLight) {
      const light = new THREE.PointLight(0xeef6ff, 1.75, 9.5, 1.5);
      light.position.set(fl.x, 2.4, fl.z);
      worldGroup.add(light);
    }
    addCollider(`west-floodlight-${idx}`, fl.x, fl.z, 0.44);
  });

  // Yellow/Black Caution Barriers framing stealth approaches
  const westBarriers = [
    [-15.2, 4.9, 0.05],
    [-13.4, 4.9, -0.05],
    [-10.6, -1.6, Math.PI / 2],
    [-10.6, -6.2, Math.PI / 2],
    [-16.4, -11.3, 0.0],
    [-19.8, -11.3, 0.0],
  ];
  westBarriers.forEach(([bx, bz, ry], idx) => {
    const barrier = cloneEnvNode(envScene, 'FBI_Caution_Barrier', bx, bz, ry, 1, gMap, mats.outline);
    if (barrier) worldGroup.add(barrier);
    addCollider(`west-barrier-${idx}`, bx, bz, 0.56);
  });

  // =========================================================================
  // ZONE 4 — NORTH BEACH FBI EXTRACTION HQ (x: -14..14, z: -26..-11)
  // =========================================================================

  // Fortified HQ Concrete Compound Floor
  const hqFloor = new THREE.Mesh(new THREE.PlaneGeometry(28.0, 13.6), mats.hqConcrete);
  hqFloor.rotation.x = -Math.PI / 2;
  hqFloor.position.set(0, 0.013, -18.0);
  hqFloor.receiveShadow = true;
  worldGroup.add(hqFloor);

  // Boss Arena Ring centered at (0, 0, -19) — clear open arena for Director Vance
  const bossArenaBase = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), mats.hqPad);
  bossArenaBase.rotation.x = -Math.PI / 2;
  bossArenaBase.position.set(0, 0.019, -19);
  bossArenaBase.receiveShadow = true;
  worldGroup.add(bossArenaBase);

  const bossArenaRing = new THREE.Mesh(new THREE.RingGeometry(5.28, 5.58, 32), mats.helipadYellow);
  bossArenaRing.rotation.x = -Math.PI / 2;
  bossArenaRing.position.set(0, 0.023, -19);
  worldGroup.add(bossArenaRing);

  const bossInnerRing = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 2.55, 24),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55 })
  );
  bossInnerRing.rotation.x = -Math.PI / 2;
  bossInnerRing.position.set(0, 0.024, -19);
  worldGroup.add(bossInnerRing);

  // Fortified Concrete/Stone Perimeter Walls with 3 Strategic Entry Chokepoints
  // 1) South Wall (z = -11.2) — Wide Central Chokepoint Gate open at x in [-3.5, 3.5]
  const hqWallDefs = [
    // South-West fortified wall wing
    { id: 'hq-wall-sw-1', x: -11.5, z: -11.2, w: 4.6, d: 0.75, r: 0.65, cols: [-13.2, -11.5, -9.8] },
    { id: 'hq-wall-sw-2', x: -6.7, z: -11.2, w: 4.4, d: 0.75, r: 0.65, cols: [-8.2, -6.7, -5.1] },
    // South-East fortified wall wing
    { id: 'hq-wall-se-1', x: 6.7, z: -11.2, w: 4.4, d: 0.75, r: 0.65, cols: [5.1, 6.7, 8.2] },
    { id: 'hq-wall-se-2', x: 11.5, z: -11.2, w: 4.6, d: 0.75, r: 0.65, cols: [9.8, 11.5, 13.2] },
    // West Perimeter Wall (x = -13.9) — West Flanking Breach Gap open at z in [-18.5, -15.8]
    { id: 'hq-wall-w-s', x: -13.9, z: -13.4, w: 0.75, d: 4.4, r: 0.65, colZs: [-12.0, -13.5, -15.0] },
    { id: 'hq-wall-w-n', x: -13.9, z: -21.4, w: 0.75, d: 5.2, r: 0.65, colZs: [-19.4, -21.4, -23.4] },
    // East Perimeter Wall (x = 13.9) — East Flanking Breach Gap open at z in [-18.5, -15.8]
    { id: 'hq-wall-e-s', x: 13.9, z: -13.4, w: 0.75, d: 4.4, r: 0.65, colZs: [-12.0, -13.5, -15.0] },
    { id: 'hq-wall-e-n', x: 13.9, z: -21.4, w: 0.75, d: 5.2, r: 0.65, colZs: [-19.4, -21.4, -23.4] },
  ];

  for (const wd of hqWallDefs) {
    const wallMesh = createFortifiedWallSegment(mats, wd.w, 1.85, wd.d);
    wallMesh.position.set(wd.x, 0, wd.z);
    worldGroup.add(wallMesh);
    if (wd.cols) {
      wd.cols.forEach((cx, i) => addCollider(`${wd.id}-c${i}`, cx, wd.z, wd.r));
    }
    if (wd.colZs) {
      wd.colZs.forEach((cz, i) => addCollider(`${wd.id}-c${i}`, wd.x, cz, wd.r));
    }
  }

  // Carved Watch Pillars flanking North HQ South Gate & Flanking Breaches
  [
    [-4.1, -11.2],
    [4.1, -11.2],
    [-13.9, -11.2],
    [13.9, -11.2],
  ].forEach(([px, pz], idx) => {
    const p = cloneEnvNode(envScene, 'Ruin_Stone_Pillar', px, pz, 0, 1.05, gMap, mats.outline);
    if (p) worldGroup.add(p);
    addCollider(`hq-gate-pillar-${idx}`, px, pz, 0.56);
  });

  // Back Corner HQ Tactical Tents (well clear of jammers & boss arena)
  const hqTents = [
    { id: 'hq-tent-nw', x: -11.2, z: -22.4, ry: Math.PI * 0.25 },
    { id: 'hq-tent-ne', x: 11.2, z: -22.4, ry: -Math.PI * 0.25 },
  ];
  for (const t of hqTents) {
    const tent = cloneEnvNode(envScene, 'FBI_Tactical_Tent', t.x, t.z, t.ry, 1, gMap, mats.outline);
    if (tent) worldGroup.add(tent);
    addCollider(t.id, t.x, t.z, 1.45);
  }

  // North HQ Tripod Floodlights & Caution Barriers
  const hqFloodlights = [
    { x: -4.4, z: -12.4, ry: Math.PI * 0.15, hasLight: false },
    { x: 4.4, z: -12.4, ry: -Math.PI * 0.15, hasLight: false },
    { x: -8.6, z: -21.2, ry: Math.PI * 0.65, hasLight: true },
    { x: 8.6, z: -21.2, ry: -Math.PI * 0.65, hasLight: true },
  ];
  hqFloodlights.forEach((fl, idx) => {
    const mesh = cloneEnvNode(envScene, 'FBI_Tripod_Floodlight', fl.x, fl.z, fl.ry, 1, gMap, mats.outline);
    if (mesh) worldGroup.add(mesh);
    if (fl.hasLight) {
      const light = new THREE.PointLight(0xeef6ff, 1.9, 12.0, 1.4);
      light.position.set(fl.x, 2.5, fl.z);
      worldGroup.add(light);
    }
    addCollider(`hq-floodlight-${idx}`, fl.x, fl.z, 0.44);
  });

  [
    [-5.8, -12.4, 0.15],
    [5.8, -12.4, -0.15],
    [-12.2, -16.8, Math.PI * 0.45],
    [12.2, -16.8, -Math.PI * 0.45],
  ].forEach(([bx, bz, ry], idx) => {
    const barrier = cloneEnvNode(envScene, 'FBI_Caution_Barrier', bx, bz, ry, 1, gMap, mats.outline);
    if (barrier) worldGroup.add(barrier);
    addCollider(`hq-barrier-${idx}`, bx, bz, 0.52);
  });

  // -------------------------------------------------------------------------
  // 3 Destroyable Signal Jammers at EXACT (-9, 0, -15), (9, 0, -15), (0, 0, -13)
  // Pushed into BOTH ctx.jammers AND ctx.harvestables (same shared object!)
  // -------------------------------------------------------------------------
  const jammerCoords = [
    { id: 'jammer_west', x: -9, z: -15, ry: 0.45 },
    { id: 'jammer_east', x: 9, z: -15, ry: -0.45 },
    { id: 'jammer_center', x: 0, z: -13, ry: 0.0 },
  ];

  jammerCoords.forEach((jd, idx) => {
    const { group: mesh, beaconLight, beaconOrbMat } = createSignalJammerMesh(
      gMap,
      mats.outline,
      jd.id,
      jd.x,
      jd.z
    );
    mesh.rotation.y = jd.ry;
    worldGroup.add(mesh);

    let _respawnTimer = 999999;
    const jammerEntry = {
      id: jd.id,
      type: 'jammer',
      isJammer: true,
      mesh,
      x: jd.x,
      z: jd.z,
      radius: 0.9,
      hp: 90,
      maxHp: 90,
      destroyed: false,
      beaconLight,
      loot: [{ id: 'stone', name: 'FBI Tech Scrap', count: 2, type: 'material' }],
      depleted: false,
    };

    // Keep destroyed jammers permanently non-respawning even if player.js resets respawnTimer on depletion
    Object.defineProperty(jammerEntry, 'respawnTimer', {
      enumerable: true,
      configurable: true,
      get() {
        return jammerEntry.destroyed || jammerEntry.depleted ? 999999 : _respawnTimer;
      },
      set(v) {
        _respawnTimer = jammerEntry.destroyed || jammerEntry.depleted ? 999999 : v;
      },
    });

    jammers.push(jammerEntry);
    safeCtx.harvestables.push(jammerEntry);
    addCollider(jd.id, jd.x, jd.z, 0.85);

    // Pulse red beacon cleanly while active, and automatically extinguish once destroyed/depleted
    const beaconProxy = {
      get intensity() {
        return beaconLight.intensity;
      },
      set intensity(val) {
        if (jammerEntry.destroyed || jammerEntry.depleted || jammerEntry.hp <= 0) {
          beaconLight.intensity = 0;
          beaconOrbMat.color.setHex(0x281c1c);
          if (mesh.userData.targetRing) mesh.userData.targetRing.visible = false;
        } else {
          beaconLight.intensity = Math.max(0.4, val);
          const hot = val > 2.0;
          beaconOrbMat.color.setHex(hot ? 0xff2b2b : 0xb31b1b);
        }
      },
    };
    animatedLights.push({ light: beaconProxy, base: 1.9, amp: 1.15, phase: idx * 2.1 });
  });

  // -------------------------------------------------------------------------
  // Helipad & FBI Escape Chopper at EXACT (0, 0, -25) overlooking Northern Beach
  // -------------------------------------------------------------------------
  const helipad = createHelipadPlatform(mats, 0, -25);
  worldGroup.add(helipad);

  const escapeVehicle = createFBIEscapeHelicopter(gMap, mats.outline, 0, -25);
  worldGroup.add(escapeVehicle);
  safeCtx.escapeVehicle = escapeVehicle;

  const helipadLight = new THREE.PointLight(0xffe066, 1.8, 10.5, 1.5);
  helipadLight.position.set(0, 3.2, -25);
  worldGroup.add(helipadLight);
  animatedLights.push({ light: helipadLight, base: 1.8, amp: 0.35, phase: 1.1 });
  addCollider('escape-chopper', 0, -25, 1.55);

  // =========================================================================
  // HARVESTABLE RESOURCES ACROSS ALL 4 ZONES
  // (Trees, Rock Outcrops, Berry Bushes, Ancient Campfire Shrines, FBI Crates)
  // =========================================================================

  // 1. Harvestable Jungle Trees (Wood + Fiber + occasional Berries)
  const treeDefs = [
    // Zone 1 — South Beach & Jungle
    { name: 'Jungle_Canopy_Tree_Large', x: -6.8, z: 10.6, ry: 0.4, berries: true },
    { name: 'Jungle_Canopy_Tree_Small', x: -4.2, z: 13.8, ry: 1.2, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: -11.4, z: 12.2, ry: -0.7, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: -15.8, z: 14.4, ry: 2.1, berries: false },
    { name: 'Jungle_Canopy_Tree_Small', x: -20.6, z: 13.2, ry: 0.5, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: -23.4, z: 9.2, ry: -1.3, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: -12.6, z: 8.6, ry: 0.8, berries: false },
    { name: 'Jungle_Canopy_Tree_Small', x: 5.4, z: 14.4, ry: -0.4, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: 12.8, z: 15.2, ry: 1.7, berries: false },
    { name: 'Jungle_Canopy_Tree_Small', x: 20.8, z: 15.6, ry: 2.4, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: 24.4, z: 12.0, ry: -0.9, berries: false },
    // Central Jungle around Ancient Temple Courtyard
    { name: 'Jungle_Canopy_Tree_Large', x: -7.2, z: 4.8, ry: 0.3, berries: true },
    { name: 'Jungle_Canopy_Tree_Small', x: -7.4, z: -2.4, ry: 1.9, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: -5.4, z: -7.6, ry: -0.6, berries: true },
    { name: 'Jungle_Canopy_Tree_Small', x: 4.8, z: -6.8, ry: 0.9, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: 9.2, z: -5.8, ry: 2.5, berries: true },
    // Zone 2 — Lagoon Outer Banks & North-East Jungle
    { name: 'Jungle_Canopy_Tree_Large', x: 24.8, z: 4.6, ry: 0.7, berries: false },
    { name: 'Jungle_Canopy_Tree_Small', x: 24.6, z: -0.4, ry: -1.1, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: 11.4, z: -5.6, ry: 1.4, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: 19.6, z: -6.4, ry: -0.3, berries: true },
    { name: 'Jungle_Canopy_Tree_Small', x: 22.8, z: -12.8, ry: 2.0, berries: false },
    { name: 'Jungle_Canopy_Tree_Large', x: 19.2, z: -18.4, ry: 0.6, berries: false },
    // North-West Jungle bordering West Camp & North HQ
    { name: 'Jungle_Canopy_Tree_Large', x: -23.6, z: -15.4, ry: 1.1, berries: false },
    { name: 'Jungle_Canopy_Tree_Small', x: -19.2, z: -18.6, ry: -0.8, berries: true },
    { name: 'Jungle_Canopy_Tree_Large', x: -22.2, z: -22.4, ry: 2.2, berries: false },
  ];

  treeDefs.forEach((td, idx) => {
    const id = `harvest-tree-${idx + 1}`;
    const mesh = cloneEnvNode(envScene, td.name, td.x, td.z, td.ry, 1, gMap, mats.outline);
    worldGroup.add(mesh);
    const loot = [
      { id: 'wood', name: 'Wood', count: 3, type: 'resource' },
      { id: 'fiber', name: 'Fiber', count: 2, type: 'resource' },
    ];
    if (td.berries) {
      loot.push({ id: 'berries', name: 'Jungle Berries', count: 2, type: 'food' });
    }
    safeCtx.harvestables.push({
      id,
      type: 'tree',
      mesh,
      x: td.x,
      z: td.z,
      radius: 0.78,
      hp: 45,
      maxHp: 45,
      loot,
      depleted: false,
      respawnTimer: 0,
    });
    addCollider(id, td.x, td.z, 0.72);
  });

  // 2. Harvestable Stone Rock Outcrops (Stone + Fiber)
  const rockDefs = [
    // Zone 1 — South Beach & Jungle
    { x: -5.4, z: 11.4 },
    { x: 4.4, z: 9.2 },
    { x: -9.8, z: 14.6 },
    { x: -17.6, z: 10.6 },
    { x: -6.4, z: -4.8 },
    { x: 4.6, z: -9.2 },
    // Zone 2 — Sunken Lagoon & Islet
    { x: 15.4, z: 5.4 },
    { x: 24.4, z: 8.6 },
    { x: 18.8, z: -3.8 },
    // Zone 3 & North Perimeter
    { x: -24.4, z: -4.2 },
    { x: -10.8, z: -16.8 },
    { x: 17.6, z: -13.6 },
    { x: -16.8, z: -23.6 },
    { x: 18.4, z: -23.4 },
  ];

  rockDefs.forEach((rd, idx) => {
    const id = `harvest-rock-${idx + 1}`;
    const mesh = createStylizedRockMesh(mats, geos, idx + 1);
    mesh.position.set(rd.x, 0, rd.z);
    worldGroup.add(mesh);
    safeCtx.harvestables.push({
      id,
      type: 'rock',
      mesh,
      x: rd.x,
      z: rd.z,
      radius: 0.82,
      hp: 55,
      maxHp: 55,
      loot: [
        { id: 'stone', name: 'Stone', count: 3, type: 'resource' },
        { id: 'fiber', name: 'Fiber', count: 1, type: 'resource' },
      ],
      depleted: false,
      respawnTimer: 0,
    });
    addCollider(id, rd.x, rd.z, 0.72);
  });

  // 3. Harvestable Berry Bushes (Berries + Fiber)
  const berryBushDefs = [
    { x: -3.8, z: 9.8 },
    { x: 3.6, z: 11.6 },
    { x: -8.6, z: 6.8 },
    { x: -5.6, z: 2.6 },
    { x: 5.4, z: 2.2 },
    { x: 8.4, z: -1.8 },
    { x: 14.6, z: -4.2 },
    { x: -9.0, z: -8.6 },
    { x: -19.4, z: 8.4 },
    { x: 18.2, z: 14.6 },
  ];

  berryBushDefs.forEach((bd, idx) => {
    const id = `harvest-berry-bush-${idx + 1}`;
    const mesh = createBerryBushMesh(envScene, gMap, mats, geos, idx + 1);
    mesh.position.set(bd.x, 0, bd.z);
    worldGroup.add(mesh);
    safeCtx.harvestables.push({
      id,
      type: 'berry_bush',
      mesh,
      x: bd.x,
      z: bd.z,
      radius: 0.68,
      hp: 25,
      maxHp: 25,
      loot: [
        { id: 'berries', name: 'Jungle Berries', count: 3, type: 'food' },
        { id: 'fiber', name: 'Fiber', count: 2, type: 'resource' },
      ],
      depleted: false,
      respawnTimer: 0,
    });
    addCollider(id, bd.x, bd.z, 0.55);
  });

  // 4. Ancient Campfire Shrines (harvestable jungle shrines with flickering flames!)
  const shrineDefs = [
    { x: -8.2, z: 8.8 },
    { x: -4.8, z: -5.8 },
  ];

  shrineDefs.forEach((sd, idx) => {
    const id = `harvest-shrine-${idx + 1}`;
    const shrine = createStylizedCampfire(gMap, mats.outline, sd.x, sd.z, `Ancient_Shrine_${idx + 1}`, true);
    worldGroup.add(shrine.group);
    animatedFlames.push({ outer: shrine.flameOuter, inner: shrine.flameInner, phase: idx * 2.4 + 1.1 });

    safeCtx.harvestables.push({
      id,
      type: 'shrine',
      mesh: shrine.group,
      x: sd.x,
      z: sd.z,
      radius: 0.82,
      hp: 50,
      maxHp: 50,
      loot: [
        { id: 'wood', name: 'Wood', count: 3, type: 'resource' },
        { id: 'stone', name: 'Stone', count: 3, type: 'resource' },
        { id: 'berries', name: 'Jungle Berries', count: 2, type: 'food' },
      ],
      depleted: false,
      respawnTimer: 0,
    });
    addCollider(id, sd.x, sd.z, 0.72);
  });

  // 5. Harvestable FBI Supply Crates (West FBI Camp, North HQ, Lagoon Ruins, South Beach)
  const fbiCrateDefs = [
    // Zone 3 — West FBI Forward Camp
    {
      x: -14.4,
      z: -1.4,
      ry: 0.25,
      loot: [
        { id: 'meat', name: 'Prime Meat', count: 2, type: 'food' },
        { id: 'fish', name: 'Raw Fish', count: 2, type: 'food' },
      ],
    },
    {
      x: -19.8,
      z: -6.8,
      ry: -0.35,
      loot: [
        { id: 'wood', name: 'Wood', count: 3, type: 'resource' },
        { id: 'stone', name: 'Stone', count: 3, type: 'resource' },
      ],
    },
    {
      x: -12.0,
      z: -7.0,
      ry: 0.5,
      loot: [
        { id: 'fiber', name: 'Fiber', count: 3, type: 'resource' },
        { id: 'berries', name: 'Jungle Berries', count: 2, type: 'food' },
      ],
    },
    {
      x: -18.8,
      z: 2.8,
      ry: -0.15,
      loot: [
        { id: 'fish', name: 'Raw Fish', count: 2, type: 'food' },
        { id: 'stone', name: 'Stone', count: 2, type: 'resource' },
      ],
    },
    // Zone 4 — North Beach FBI Extraction HQ
    {
      x: -11.6,
      z: -13.2,
      ry: 0.2,
      loot: [
        { id: 'stone', name: 'Stone', count: 3, type: 'resource' },
        { id: 'fiber', name: 'Fiber', count: 2, type: 'resource' },
      ],
    },
    {
      x: 11.6,
      z: -13.2,
      ry: -0.2,
      loot: [
        { id: 'meat', name: 'Prime Meat', count: 2, type: 'food' },
        { id: 'berries', name: 'Jungle Berries', count: 3, type: 'food' },
      ],
    },
    {
      x: -7.0,
      z: -23.0,
      ry: 0.4,
      loot: [
        { id: 'wood', name: 'Wood', count: 3, type: 'resource' },
        { id: 'meat', name: 'Prime Meat', count: 2, type: 'food' },
      ],
    },
    {
      x: 7.0,
      z: -23.0,
      ry: -0.4,
      loot: [
        { id: 'fish', name: 'Raw Fish', count: 2, type: 'food' },
        { id: 'stone', name: 'Stone', count: 3, type: 'resource' },
      ],
    },
    // Zone 2 — Sunken Lagoon Islet Treasure Crate
    {
      x: 18.8,
      z: 6.4,
      ry: 0.35,
      loot: [
        { id: 'fish', name: 'Raw Fish', count: 3, type: 'food' },
        { id: 'meat', name: 'Prime Meat', count: 2, type: 'food' },
      ],
    },
    // Zone 1 — Washed-up South Beach Crate
    {
      x: -5.8,
      z: 15.8,
      ry: -0.25,
      loot: [
        { id: 'wood', name: 'Wood', count: 3, type: 'resource' },
        { id: 'fiber', name: 'Fiber', count: 2, type: 'resource' },
      ],
    },
  ];

  fbiCrateDefs.forEach((cd, idx) => {
    const id = `harvest-fbi-crate-${idx + 1}`;
    const mesh = createFBICrateMesh(mats, geos);
    mesh.position.set(cd.x, 0, cd.z);
    mesh.rotation.y = cd.ry;
    worldGroup.add(mesh);
    safeCtx.harvestables.push({
      id,
      type: 'fbi_crate',
      mesh,
      x: cd.x,
      z: cd.z,
      radius: 0.72,
      hp: 35,
      maxHp: 35,
      loot: cd.loot,
      depleted: false,
      respawnTimer: 0,
    });
    addCollider(id, cd.x, cd.z, 0.64);
  });

  // Decorative Non-Blocking Lush Foliage Bushes (cover & island framing)
  const decorativeBushes = [
    [-2.8, 12.4],
    [2.6, 12.2],
    [-4.8, 6.2],
    [4.6, 6.4],
    [-4.6, -2.0],
    [4.6, -2.0],
    [-10.4, 5.2],
    [-11.2, 11.0],
    [-16.2, 11.4],
    [-23.6, 5.4],
    [-24.2, -11.4],
    [-17.4, -14.8],
    [-10.2, -9.8],
    [8.2, -9.8],
    [14.2, -10.2],
    [16.6, -7.8],
    [23.2, -6.2],
    [23.6, -18.8],
    [16.2, -21.2],
    [-16.4, -21.2],
    [7.8, 14.2],
    [14.4, 14.8],
    [22.4, 14.6],
    [15.4, 4.0],
    [19.2, 4.2],
  ];
  decorativeBushes.forEach(([bx, bz], idx) => {
    const bush = cloneEnvNode(
      envScene,
      'Jungle_Foliage_Bush',
      bx,
      bz,
      idx * 0.9,
      0.92 + (idx % 3) * 0.12,
      gMap,
      mats.outline
    );
    worldGroup.add(bush);
  });

  // =========================================================================
  // PATROL WAYPOINT ROUTES (Unobstructed dry-land loops per zone)
  // =========================================================================
  const patrolRoutes = {
    westCamp: [
      new THREE.Vector3(-16.2, 0, 0.2),
      new THREE.Vector3(-12.8, 0, -3.8),
      new THREE.Vector3(-16.2, 0, -7.6),
      new THREE.Vector3(-20.4, 0, -4.4),
    ],
    northHq: [
      new THREE.Vector3(-6.2, 0, -13.4),
      new THREE.Vector3(6.2, 0, -13.4),
      new THREE.Vector3(6.4, 0, -17.2),
      new THREE.Vector3(-6.4, 0, -17.2),
    ],
    courtyard: [
      new THREE.Vector3(-5.2, 0, -3.2),
      new THREE.Vector3(5.2, 0, -3.2),
      new THREE.Vector3(5.2, 0, 7.2),
      new THREE.Vector3(-5.2, 0, 7.2),
    ],
    lagoonRim: [
      new THREE.Vector3(6.4, 0, -3.0),
      new THREE.Vector3(14.0, 0, -3.0),
      new THREE.Vector3(14.0, 0, -8.5),
      new THREE.Vector3(6.4, 0, -8.5),
    ],
  };

  // =========================================================================
  // FOG-OF-WAR (56x56 Uint8Array: 0 = unexplored, 1 = explored, 2 = visible)
  // =========================================================================
  const fogOfWar = new Uint8Array(GRID_SIZE * GRID_SIZE);

  function worldToFogCell(wx, wz) {
    const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(wx - WORLD_BOUNDS.minX)));
    const gz = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(wz - WORLD_BOUNDS.minZ)));
    return { gx, gz, idx: gz * GRID_SIZE + gx };
  }

  function revealFog(x, z, radius = 10) {
    // Demote previously currently-visible cells (2) -> explored (1)
    for (let i = 0; i < fogOfWar.length; i += 1) {
      if (fogOfWar[i] === 2) fogOfWar[i] = 1;
    }

    const r = Math.max(1, Number(radius) || 10);
    const rSq = r * r;
    const minGx = Math.max(0, Math.floor(x - r - WORLD_BOUNDS.minX));
    const maxGx = Math.min(GRID_SIZE - 1, Math.ceil(x + r - WORLD_BOUNDS.minX));
    const minGz = Math.max(0, Math.floor(z - r - WORLD_BOUNDS.minZ));
    const maxGz = Math.min(GRID_SIZE - 1, Math.ceil(z + r - WORLD_BOUNDS.minZ));

    for (let gz = minGz; gz <= maxGz; gz += 1) {
      const cellCenterZ = WORLD_BOUNDS.minZ + gz + 0.5;
      const dz = cellCenterZ - z;
      const dzSq = dz * dz;
      const rowOffset = gz * GRID_SIZE;
      for (let gx = minGx; gx <= maxGx; gx += 1) {
        const cellCenterX = WORLD_BOUNDS.minX + gx + 0.5;
        const dx = cellCenterX - x;
        if (dx * dx + dzSq <= rSq) {
          fogOfWar[rowOffset + gx] = 2;
        }
      }
    }
  }

  // Reveal initial starting beach around Boots (0, 13)
  revealFog(0, 13, 10);

  // =========================================================================
  // LIVE CIRCULAR MINIMAP RENDERER WITH FOG-OF-WAR
  // =========================================================================
  const MINIMAP_VIEW_SPAN = 46; // World units across the circular radar (centered on Boots)
  const AGENT_RADAR_RANGE = 13.5;

  function drawMinimap(canvas, liveCtx) {
    if (!canvas) return;
    const c = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!c) return;

    const renderCtx = liveCtx || safeCtx;
    const w = canvas.width || 160;
    const h = canvas.height || 160;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = w / MINIMAP_VIEW_SPAN;
    const now = typeof performance !== 'undefined' ? performance.now() * 0.001 : Date.now() * 0.001;

    const pPos = renderCtx?.player?.pos || { x: 0, z: 13 };
    const px = Number.isFinite(pPos.x) ? pPos.x : 0;
    const pz = Number.isFinite(pPos.z) ? pPos.z : 13;

    const toX = (wx) => cx + (wx - px) * scale;
    const toY = (wz) => cy + (wz - pz) * scale;
    const fillWorldRect = (x0, z0, x1, z1, color) => {
      const rx = toX(x0);
      const ry = toY(z0);
      c.fillStyle = color;
      c.fillRect(rx, ry, (x1 - x0) * scale, (z1 - z0) * scale);
    };

    c.clearRect(0, 0, w, h);

    // 1. Deep Tropical Ocean Backdrop
    c.fillStyle = '#144d68';
    c.fillRect(0, 0, w, h);

    // 2. Biome Terrain Layers (exact match to 3D island geometry)
    // Main Island Jungle Grass
    fillWorldRect(-26.5, -24.0, 26.5, 13.0, '#3e7333');
    // Southern Sandy Beach Shoreline
    fillWorldRect(-26.5, 12.5, 26.5, 18.5, '#dec075');
    // Northern Sandy Beach Shoreline
    fillWorldRect(-26.5, -26.6, 26.5, -23.5, '#dec075');

    // Zone 2 — Sunken Lagoon & Swamp Turquoise Water
    fillWorldRect(10.8, -1.5, 23.2, 13.0, '#229ec0');
    fillWorldRect(7.2, 1.2, 11.2, 8.8, '#1e8a96');
    // Dry Crockstar bank, Central Islet, South Sandbar & North Bridge
    fillWorldRect(7.0, 9.0, 11.0, 13.2, '#dec075');
    fillWorldRect(16.0, 8.2, 19.0, 13.5, '#dec075');
    fillWorldRect(15.8, -2.0, 18.8, 2.8, '#9a6b3c');
    fillWorldRect(14.5, 2.5, 20.5, 8.5, '#c9b46e');
    fillWorldRect(15.5, 3.5, 19.5, 7.5, '#51803c');

    // Central Ancient Temple Courtyard (-3.5..3.5, -1.5..5.5)
    fillWorldRect(-3.6, -1.6, 3.6, 5.6, '#c0a169');
    c.strokeStyle = '#6f5c39';
    c.lineWidth = 1.2;
    c.strokeRect(toX(-3.6), toY(-1.6), 7.2 * scale, 7.2 * scale);

    // Zone 3 — West FBI Forward Camp (-24..-10, -12..6)
    fillWorldRect(-24.0, -12.0, -10.0, 5.5, '#464d56');
    c.strokeStyle = '#f2c230';
    c.lineWidth = 1.1;
    c.strokeRect(toX(-24.0), toY(-12.0), 14.0 * scale, 17.5 * scale);

    // Zone 4 — North Beach FBI Extraction HQ (-14..14, -24.8..-11.2)
    fillWorldRect(-14.0, -24.8, 14.0, -11.2, '#3a414c');
    c.strokeStyle = '#ef4444';
    c.lineWidth = 1.3;
    c.strokeRect(toX(-14.0), toY(-24.8), 28.0 * scale, 13.6 * scale);

    // Boss Arena Ring at (0, -19)
    c.beginPath();
    c.arc(toX(0), toY(-19), 5.4 * scale, 0, Math.PI * 2);
    c.fillStyle = 'rgba(24, 28, 36, 0.72)';
    c.fill();
    c.strokeStyle = 'rgba(242, 194, 48, 0.75)';
    c.lineWidth = 1.1;
    c.stroke();

    // Helipad Circle & 'H' at (0, -25)
    const hx = toX(0);
    const hy = toY(-25);
    c.beginPath();
    c.arc(hx, hy, 3.1 * scale, 0, Math.PI * 2);
    c.fillStyle = '#202630';
    c.fill();
    c.strokeStyle = '#f2c61b';
    c.lineWidth = 1.5;
    c.stroke();

    // 3. Buildings (campfires, beds, turrets, walls, traps)
    for (const b of renderCtx?.buildings || []) {
      if (!b || typeof b.x !== 'number' || typeof b.z !== 'number') continue;
      const cell = worldToFogCell(b.x, b.z);
      if (fogOfWar[cell.idx] === 0) continue;
      const bx = toX(b.x);
      const by = toY(b.z);
      if (b.type === 'campfire') {
        c.beginPath();
        c.arc(bx, by, 3.1, 0, Math.PI * 2);
        c.fillStyle = '#ff8c2a';
        c.fill();
      } else if (b.type === 'bed') {
        c.fillStyle = '#ffd43b';
        c.fillRect(bx - 2.4, by - 2.4, 4.8, 4.8);
      } else if (b.type === 'coconut_turret') {
        c.fillStyle = '#38bdf8';
        c.fillRect(bx - 2.5, by - 2.5, 5, 5);
      } else if (b.type === 'workbench') {
        c.fillStyle = '#b87d44';
        c.fillRect(bx - 2.4, by - 2.4, 4.8, 4.8);
      } else {
        c.fillStyle = '#9aa5b1';
        c.fillRect(bx - 1.8, by - 1.8, 3.6, 3.6);
      }
    }

    // 4. Fog-of-War Shroud (run-length merged per row for crisp 60fps Canvas2D)
    const cellPx = scale + 0.55; // Slight overlap prevents hairline seams
    for (let gz = 0; gz < GRID_SIZE; gz += 1) {
      const wz0 = WORLD_BOUNDS.minZ + gz;
      const sy = toY(wz0);
      if (sy + cellPx < 0 || sy > h) continue;
      const rowOffset = gz * GRID_SIZE;
      let gx = 0;
      while (gx < GRID_SIZE) {
        const state = fogOfWar[rowOffset + gx];
        if (state === 2) {
          gx += 1;
          continue;
        }
        let endGx = gx + 1;
        while (endGx < GRID_SIZE && fogOfWar[rowOffset + endGx] === state) {
          endGx += 1;
        }
        const sx0 = toX(WORLD_BOUNDS.minX + gx);
        const spanW = (endGx - gx) * scale + 0.55;
        if (sx0 + spanW >= 0 && sx0 <= w) {
          c.fillStyle = state === 0 ? 'rgba(9, 15, 23, 0.86)' : 'rgba(9, 15, 23, 0.42)';
          c.fillRect(sx0, sy, spanW, cellPx);
        }
        gx = endGx;
      }
    }

    // Helper for outlined circular markers
    const drawDot = (wx, wz, radius, fill, stroke = '#ffffff', lw = 1.3) => {
      const mx = toX(wx);
      const my = toY(wz);
      c.beginPath();
      c.arc(mx, my, radius, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.lineWidth = lw;
        c.strokeStyle = stroke;
        c.stroke();
      }
    };

    // 5. Active Signal Jammers (pulsing orange radar beacons)
    for (const j of renderCtx?.jammers || jammers) {
      if (!j || j.destroyed || j.depleted || j.hp <= 0) continue;
      const jx = toX(j.x);
      const jy = toY(j.z);
      const pulseR = 4.6 + Math.sin(now * 6.5 + j.x) * 1.6;
      c.beginPath();
      c.arc(jx, jy, pulseR, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255, 138, 36, 0.88)';
      c.lineWidth = 1.5;
      c.stroke();
      drawDot(j.x, j.z, 3.0, '#ff7b1a', '#181c20', 1.2);
    }

    // 6. Active Decoy Beacon (pulsing cyan sonar rings)
    const dos = renderCtx?.companions?.dos;
    if (dos?.decoyPos && dos.decoyTimer > 0) {
      const dx = toX(dos.decoyPos.x);
      const dy = toY(dos.decoyPos.z);
      const pulseR = 4 + ((now * 14) % 10);
      c.beginPath();
      c.arc(dx, dy, pulseR, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(34, 211, 238, 0.88)';
      c.lineWidth = 1.6;
      c.stroke();
      drawDot(dos.decoyPos.x, dos.decoyPos.z, 2.8, '#22d3ee', '#ffffff', 1.1);
    }

    // 7. Death Crates (pulsing red/gold X marker — always visible so player can recover loot!)
    for (const crate of renderCtx?.deathCrates || []) {
      if (!crate || crate.recovered || crate.confiscated || !crate.pos) continue;
      const dx = toX(crate.pos.x);
      const dy = toY(crate.pos.z);
      const r = 4.8 + Math.sin(now * 8) * 1.4;
      c.beginPath();
      c.arc(dx, dy, r, 0, Math.PI * 2);
      c.fillStyle = 'rgba(239, 68, 68, 0.36)';
      c.fill();
      c.strokeStyle = '#ffd43b';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(dx - 3.4, dy - 3.4);
      c.lineTo(dx + 3.4, dy + 3.4);
      c.moveTo(dx + 3.4, dy - 3.4);
      c.lineTo(dx - 3.4, dy + 3.4);
      c.stroke();
    }

    // 8. Smuff Cage / Companion (blue with rescue pulse when captive)
    const smuff = renderCtx?.fbi?.smuff;
    if (smuff?.pos) {
      if (!smuff.rescued) {
        const sx = toX(smuff.pos.x);
        const sy = toY(smuff.pos.z);
        c.beginPath();
        c.arc(sx, sy, 5.4 + Math.sin(now * 5.2) * 1.4, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(59, 130, 246, 0.9)';
        c.lineWidth = 1.5;
        c.stroke();
      }
      drawDot(smuff.pos.x, smuff.pos.z, 3.4, '#3b82f6', '#ffffff', 1.3);
    }

    // 9. Crockstar (lime)
    const crock = renderCtx?.companions?.crockstar;
    if (crock?.pos) {
      drawDot(
        crock.pos.x,
        crock.pos.z,
        3.6,
        crock.tamed ? '#84cc16' : '#a3e635',
        crock.tamed ? '#ffffff' : '#181c20',
        1.3
      );
    }

    // 10. Dos (red; cyan rim when undercover)
    if (dos?.pos) {
      drawDot(
        dos.pos.x,
        dos.pos.z,
        3.3,
        '#e03131',
        dos.mode === 'undercover' ? '#22d3ee' : '#ffffff',
        1.5
      );
    }

    // 11. FBI Agents (only when in explored/visible fog OR within radar range) & Boss Vance Icon
    let vanceAgent = null;
    for (const agent of renderCtx?.fbi?.agents || []) {
      if (!agent?.pos) continue;
      if (agent.isBoss || agent.id === 'director_vance') {
        vanceAgent = agent;
        continue;
      }
      const cell = worldToFogCell(agent.pos.x, agent.pos.z);
      const dist = Math.hypot(agent.pos.x - px, agent.pos.z - pz);
      if (fogOfWar[cell.idx] === 0 && dist > AGENT_RADAR_RANGE) continue;

      let fill = '#1f2937';
      let stroke = '#facc15';
      if (agent.state === 'ko') {
        fill = '#6b7280';
        stroke = '#111827';
      } else if (agent.state === 'chase' || agent.state === 'alert') {
        fill = '#ef4444';
        stroke = '#ffffff';
      } else if (agent.state === 'investigate') {
        fill = '#f97316';
        stroke = '#ffffff';
      }
      drawDot(agent.pos.x, agent.pos.z, 3.3, fill, stroke, 1.3);
    }

    // Boss Director Vance Icon (distinctive red/gold skull emblem!)
    const vancePos = vanceAgent?.pos || renderCtx?.models?.vance?.scene?.position;
    const vanceAlive = vanceAgent ? vanceAgent.hp > 0 && vanceAgent.state !== 'defeated' : true;
    if (vancePos && vanceAlive) {
      const vx = toX(vancePos.x);
      const vy = toY(vancePos.z);
      const skullPulse = 6.2 + Math.sin(now * 5.5) * 1.2;
      c.beginPath();
      c.arc(vx, vy, skullPulse, 0, Math.PI * 2);
      c.fillStyle = 'rgba(220, 38, 38, 0.34)';
      c.fill();
      c.strokeStyle = '#facc15';
      c.lineWidth = 1.6;
      c.stroke();

      // Stylized mini-skull shape (red cranium, gold jaw/eyes)
      c.beginPath();
      c.arc(vx, vy - 0.8, 3.6, 0, Math.PI * 2);
      c.fillStyle = '#dc2626';
      c.fill();
      c.strokeStyle = '#ffd43b';
      c.lineWidth = 1.1;
      c.stroke();
      c.fillStyle = '#ffd43b';
      c.fillRect(vx - 2.0, vy + 1.6, 4.0, 2.0);
      c.fillStyle = '#181c20';
      c.fillRect(vx - 1.8, vy - 1.5, 1.3, 1.3);
      c.fillRect(vx + 0.6, vy - 1.5, 1.3, 1.3);
    }

    // 12. Active Quest Waypoint Pulsing Ring (plus edge indicator when off-radar!)
    const wp = renderCtx?.story?.waypoint;
    if (wp && typeof wp.x === 'number' && typeof wp.z === 'number') {
      const wx = toX(wp.x);
      const wy = toY(wp.z);
      const dx = wx - cx;
      const dy = wy - cy;
      const distPx = Math.hypot(dx, dy);
      const maxRadarR = Math.min(cx, cy) - 10;

      if (distPx <= maxRadarR) {
        const ringR = 5.5 + ((now * 10) % 7.5);
        c.beginPath();
        c.arc(wx, wy, ringR, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(255, 212, 59, 0.92)';
        c.lineWidth = 1.8;
        c.stroke();
        drawDot(wp.x, wp.z, 2.6, '#ffe066', '#181c20', 1.1);
      } else if (distPx > 0.001) {
        // Clamp glowing gold pointer triangle to circular radar edge
        const nx = dx / distPx;
        const ny = dy / distPx;
        const ex = cx + nx * maxRadarR;
        const ey = cy + ny * maxRadarR;
        const pxPerp = -ny;
        const pyPerp = nx;
        const pulse = 1 + Math.sin(now * 7) * 0.16;

        c.beginPath();
        c.moveTo(ex + nx * 6.5 * pulse, ey + ny * 6.5 * pulse);
        c.lineTo(ex - nx * 3.5 + pxPerp * 4.2, ey - ny * 3.5 + pyPerp * 4.2);
        c.lineTo(ex - nx * 3.5 - pxPerp * 4.2, ey - ny * 3.5 - pyPerp * 4.2);
        c.closePath();
        c.fillStyle = '#ffd43b';
        c.fill();
        c.strokeStyle = '#181c20';
        c.lineWidth = 1.3;
        c.stroke();
      }
    }

    // 13. Subtle Radar Range Ring around Boots
    c.beginPath();
    c.arc(cx, cy, 10 * scale, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    c.lineWidth = 1;
    c.stroke();

    // 14. Boots Directional Arrow right in Center (cx, cy)
    const yaw = renderCtx?.player?.group?.rotation?.y ?? Math.PI;
    const fx = Math.sin(yaw);
    const fy = Math.cos(yaw);
    const rx = -fy;
    const ry = fx;

    c.beginPath();
    c.moveTo(cx + fx * 7.2, cy + fy * 7.2);
    c.lineTo(cx - fx * 4.5 + rx * 4.6, cy - fy * 4.5 + ry * 4.6);
    c.lineTo(cx - fx * 2.0, cy - fy * 2.0);
    c.lineTo(cx - fx * 4.5 - rx * 4.6, cy - fy * 4.5 - ry * 4.6);
    c.closePath();
    c.fillStyle = '#f472b6';
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.6;
    c.stroke();
  }

  return {
    worldGroup,
    isWater: checkIsWater,
    getZoneAt: resolveZoneAt,
    animatedLights,
    animatedFlames,
    waterFoamStrips,
    jammers,
    escapeVehicle,
    patrolRoutes,
    fogOfWar,
    revealFog,
    drawMinimap,
  };
}
