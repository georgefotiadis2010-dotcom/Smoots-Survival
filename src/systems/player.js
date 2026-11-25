import * as THREE from 'three';

const WALK_SPEED = 4.4;
const SPRINT_SPEED = 7.2;
const SNEAK_SPEED = 2.3;
const TURN_SPEED = 14.0;
const PLAYER_RADIUS = 0.42;

const SPRINT_STAMINA_DRAIN = 22.0; // per sec
const STAMINA_REGEN_MOVE = 15.0; // per sec
const STAMINA_REGEN_IDLE = 24.0; // per sec
const HARVEST_STAMINA_COST = 12.0;
const HARVEST_COOLDOWN = 0.45;
const HARVEST_RESPAWN_TIME = 35.0;

const MELEE_STAMINA_COST = 10.0;
const MELEE_COOLDOWN = 0.48;
const MELEE_RANGE = 2.4;
const TRANQ_RANGE = 9.0;

const CONSUMABLES = {
  fish: { hp: 20, stamina: 25, label: 'Raw Fish' },
  meat: { hp: 30, stamina: 35, label: 'Cooked Meat' },
  berries: { hp: 15, stamina: 20, label: 'Jungle Berries' },
  bandages: { hp: 45, stamina: 5, label: 'Jungle Bandages' },
  fish_bait: { hp: 10, stamina: 15, label: 'Fish Bait' },
};

const BLUEPRINT_DEFS = [
  {
    id: 'campfire',
    name: 'Campfire',
    description: 'Warm flickering firelight & Respawn Checkpoint.',
    buildTime: 1.4,
    radius: 0.65,
    isRespawnPoint: true,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 3 },
      { id: 'stone', name: 'Stone', count: 2 },
    ],
  },
  {
    id: 'bed',
    name: 'Survival Bed',
    description: 'Tropical palm-leaf survival bed & Respawn Checkpoint.',
    buildTime: 1.6,
    radius: 0.72,
    isRespawnPoint: true,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 4 },
      { id: 'fiber', name: 'Fiber', count: 3 },
    ],
  },
  {
    id: 'wall',
    name: 'Temple Palisade Wall',
    description: 'Grid-snapped defensive stone/temple wall block.',
    buildTime: 1.2,
    radius: 0.55,
    isRespawnPoint: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 3 },
      { id: 'stone', name: 'Stone', count: 2 },
    ],
  },
  {
    id: 'workbench',
    name: 'Crafting Workbench',
    description: 'Unlocks advanced tool & tranquilizer gear recipes.',
    buildTime: 2.0,
    radius: 0.7,
    isRespawnPoint: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 5 },
      { id: 'stone', name: 'Stone', count: 3 },
    ],
  },
];

const RECIPE_DEFS = [
  {
    id: 'flimsy_axe',
    name: 'Flimsy Axe',
    description: 'Chops trees & mines rocks faster; doubles as melee weapon.',
    craftTime: 1.5,
    requiresWorkbench: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'stone', name: 'Stone', count: 2 },
    ],
    output: { id: 'axe', name: 'Flimsy Axe', count: 1, type: 'tool' },
  },
  {
    id: 'bandages',
    name: 'Jungle Bandages (x2)',
    description: 'Press U or Right-Click to restore +45 HP.',
    craftTime: 1.2,
    requiresWorkbench: false,
    ingredients: [{ id: 'fiber', name: 'Fiber', count: 3 }],
    output: { id: 'bandages', name: 'Jungle Bandages', count: 2, type: 'consumable' },
  },
  {
    id: 'fish_bait',
    name: 'Fish Bait (x2 Raw Fish)',
    description: 'Lures fresh island fish to feed & tame Crockstar.',
    craftTime: 1.3,
    requiresWorkbench: false,
    ingredients: [
      { id: 'fiber', name: 'Fiber', count: 2 },
      { id: 'berries', name: 'Jungle Berries', count: 1 },
    ],
    output: { id: 'fish', name: 'Raw Fish', count: 2, type: 'consumable' },
  },
  {
    id: 'tranq_darts',
    name: 'Tranq Darts (x3)',
    description: 'Ranged tranquilizer darts (Space) that knock out FBI agents.',
    craftTime: 2.0,
    requiresWorkbench: true,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'stone', name: 'Stone', count: 2 },
      { id: 'berries', name: 'Jungle Berries', count: 1 },
    ],
    output: { id: 'tranq_darts', name: 'Tranq Darts', count: 3, type: 'weapon' },
  },
  {
    id: 'wooden_club',
    name: 'Heavy Jungle Club',
    description: 'High-impact melee weapon against FBI patrols.',
    craftTime: 1.8,
    requiresWorkbench: true,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 4 },
      { id: 'fiber', name: 'Fiber', count: 2 },
    ],
    output: { id: 'club', name: 'Heavy Jungle Club', count: 1, type: 'weapon' },
  },
];

function createTwoStepGradient() {
  const data = new Uint8Array([115, 255]);
  const texture = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function enableShadows(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const matName = (obj.material?.name || '').toLowerCase();
    const isOutline = matName.includes('outline') || obj.userData?.noShadow;
    obj.castShadow = !isOutline;
    obj.receiveShadow = !isOutline;
  });
}

function makeCostMap(ingredients) {
  const map = {};
  for (const ing of ingredients) {
    map[ing.id] = ing.count;
  }
  return map;
}

function angleDiff(from, to) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function isMeleeItem(item) {
  if (!item) return false;
  const id = (item.id || '').toLowerCase();
  const type = (item.type || '').toLowerCase();
  return (
    type === 'tool' ||
    (type === 'weapon' && id !== 'tranq_darts') ||
    id.includes('axe') ||
    id.includes('club') ||
    id.includes('machete') ||
    id.includes('hammer') ||
    id.includes('pick')
  );
}

export function createPlayerSystem(ctx) {
  const canvas = ctx.canvas || document.getElementById('game-canvas');
  const gradientMap = createTwoStepGradient();

  // Reusable math temporaries
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerNdc = new THREE.Vector2(0, 0);
  const rayHit = new THREE.Vector3();
  const camForward = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // Input state
  const keys = new Set();
  let sneakToggle = false;
  let pointerDownPos = null;
  let hasPointerNdc = false;

  // Movement & animation state
  let moveTarget = null; // THREE.Vector3 | null
  let pendingHarvestTarget = null; // harvestable ref | null
  let desiredYaw = ctx.player.group?.rotation?.y || 0;
  let currentClip = '';
  let actionAnimClip = null;
  let actionAnimTimer = 0;

  // Timers & cooldowns
  let harvestCooldown = 0;
  let meleeCooldown = 0;
  let staminaRegenDelay = 0;
  let staminaWarnCooldown = 0;
  let hudSyncTimer = 0;
  let elapsedTime = 0;
  let nextBuildingSeq = 1;
  let lastPrompt = null;

  // Active crafting state
  let activeCraft = null; // { recipe, elapsed, duration }

  // Active blueprint placement state
  let activeBlueprint = null; // { def, ghostGroup, ghostMat, gridMat, gx, gz, valid, invalidReason }

  // Visual effect pools
  const clickRings = [];
  const hitEffects = []; // harvestable shake/flash records
  const hitParticles = [];
  const projectiles = []; // tranq darts
  const buildPopAnims = []; // newly placed buildings scaling in
  const harvestBaseTransforms = new WeakMap();
  const harvestIsolatedMats = new WeakSet();

  // --- Helper queries ---

  function getBounds() {
    const b = ctx.worldBounds || { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
    return {
      minX: (b.minX ?? -14) + 0.55,
      maxX: (b.maxX ?? 14) - 0.55,
      minZ: (b.minZ ?? -14) + 0.55,
      maxZ: (b.maxZ ?? 14) - 0.55,
    };
  }

  function clampToWorld(x, z, margin = 0) {
    const b = getBounds();
    return {
      x: Math.max(b.minX + margin, Math.min(b.maxX - margin, x)),
      z: Math.max(b.minZ + margin, Math.min(b.maxZ - margin, z)),
    };
  }

  function hasIngredients(ingredients) {
    for (const ing of ingredients) {
      if ((ctx.player.countItem?.(ing.id) || 0) < ing.count) return false;
    }
    return true;
  }

  function formatMissingIngredients(ingredients) {
    const missing = [];
    for (const ing of ingredients) {
      const have = ctx.player.countItem?.(ing.id) || 0;
      if (have < ing.count) {
        missing.push(`${ing.name} (${have}/${ing.count})`);
      }
    }
    return missing.join(', ');
  }

  function hasWorkbenchBuilt() {
    const list = ctx.buildings || [];
    return list.some((b) => b.type === 'workbench');
  }

  function setPromptIfChanged(text) {
    const next = text || null;
    if (next !== lastPrompt) {
      lastPrompt = next;
      ctx.setPrompt?.(next);
    }
  }

  function playTarcyClip(clipName, fadeSec = 0.14) {
    if (!clipName) return;
    const tarcy = ctx.models?.tarcy;
    if (!tarcy?.play) return;
    const observed = tarcy.activeClip || currentClip;
    if (observed === clipName && currentClip === clipName) return;
    tarcy.play(clipName, fadeSec);
    currentClip = clipName;
  }

  function facePoint(tx, tz) {
    const pos = ctx.player.pos;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    if (dx * dx + dz * dz > 1e-5) {
      desiredYaw = Math.atan2(dx, dz);
    }
  }

  function getSelectedItem() {
    const inv = ctx.player.inventory || [];
    return inv[ctx.player.selectedSlot] || null;
  }

  function distXZ(ax, az, bx, bz) {
    return Math.hypot(ax - bx, az - bz);
  }

  // --- Visual FX helpers ---

  function spawnClickRing(x, z, color = 0xffe066) {
    const geo = new THREE.RingGeometry(0.18, 0.34, 24);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.035, z);
    ctx.scene.add(mesh);
    clickRings.push({ mesh, age: 0, duration: 0.55 });
  }

  function spawnHitChips(x, y, z, color = 0xd9a066, count = 6) {
    const geo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    for (let i = 0; i < count; i += 1) {
      const mat = new THREE.MeshToonMaterial({ color, gradientMap });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + Math.random() * 0.4,
        z + (Math.random() - 0.5) * 0.4
      );
      ctx.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 2.2;
      hitParticles.push({
        mesh,
        vx: Math.cos(angle) * spd,
        vy: 2.2 + Math.random() * 2.2,
        vz: Math.sin(angle) * spd,
        age: 0,
        duration: 0.42 + Math.random() * 0.18,
      });
    }
  }

  function ensureHarvestBaseTransform(h) {
    if (!h?.mesh || harvestBaseTransforms.has(h.mesh)) return;
    harvestBaseTransforms.set(h.mesh, {
      pos: h.mesh.position.clone(),
      scale: h.mesh.scale.clone(),
      rotY: h.mesh.rotation.y,
    });
  }

  function triggerHarvestHitFX(h) {
    if (!h?.mesh) return;
    ensureHarvestBaseTransform(h);

    // Clone materials once per harvestable so flashing never affects sibling clones
    if (!harvestIsolatedMats.has(h.mesh)) {
      harvestIsolatedMats.add(h.mesh);
      h.mesh.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((m) => (m?.clone ? m.clone() : m));
        } else if (obj.material.clone) {
          obj.material = obj.material.clone();
        }
      });
    }

    const existing = hitEffects.find((e) => e.harvestable === h);
    if (existing) {
      existing.age = 0;
      existing.shakeDuration = 0.24;
      existing.flashDuration = 0.11;
      existing.flashCleared = false;
      for (const rec of existing.flashedMats) {
        rec.mat.emissive.setHex(0xffffff);
        rec.mat.emissiveIntensity = 0.55;
      }
    } else {
      const flashedMats = [];
      h.mesh.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.emissive && !flashedMats.some((f) => f.mat === m)) {
            flashedMats.push({
              mat: m,
              prevHex: m.emissive.getHex(),
              prevIntensity: m.emissiveIntensity ?? 1,
            });
            m.emissive.setHex(0xffffff);
            m.emissiveIntensity = 0.55;
          }
        }
      });
      hitEffects.push({
        harvestable: h,
        age: 0,
        shakeDuration: 0.24,
        flashDuration: 0.11,
        flashedMats,
        flashCleared: false,
      });
    }
    const chipColor =
      h.type === 'rock' ? 0x9aa5b1 : h.type === 'fbi_crate' ? 0x2b303a : 0x8d5a2b;
    spawnHitChips(h.x, 0.75, h.z, chipColor, 6);
  }

  // --- Cel-Shaded Building Mesh Builders ---

  function toonMat(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  }

  function createCampfireMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Campfire';

    // Charred base disc
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.62, 0.08, 12),
      toonMat(0x2f2925)
    );
    base.position.y = 0.04;
    group.add(base);

    // Stone ring (7 faceted stones)
    const stoneGeo = new THREE.DodecahedronGeometry(0.17, 0);
    const stoneMat = toonMat(0x7c858e);
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(a) * 0.46, 0.13, Math.sin(a) * 0.46);
      stone.scale.set(1.1, 0.72, 0.95);
      stone.rotation.set(i * 0.4, a, i * 0.3);
      group.add(stone);
    }

    // Crossed logs
    const logGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.66, 7);
    const logMat = toonMat(0x6b4226);
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.y = 0.18;
      log.rotation.z = Math.PI / 2 - 0.32;
      log.rotation.y = (i / 3) * Math.PI;
      group.add(log);
    }

    // Multi-layer cel flames
    const outerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.62, 7),
      toonMat(0xff6b1a, { emissive: 0xff5500, emissiveIntensity: 0.65 })
    );
    outerFlame.position.y = 0.48;
    outerFlame.userData.noShadow = true;
    group.add(outerFlame);

    const innerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.4, 6),
      toonMat(0xffe066, { emissive: 0xffcc00, emissiveIntensity: 0.85 })
    );
    innerFlame.position.y = 0.42;
    innerFlame.userData.noShadow = true;
    group.add(innerFlame);

    let light = null;
    if (!isGhost) {
      light = new THREE.PointLight(0xff8c2a, 2.5, 9.0, 1.5);
      light.position.set(0, 0.95, 0);
      group.add(light);
      group.userData.flames = [outerFlame, innerFlame];
      group.userData.light = light;
    }

    enableShadows(group);
    return { mesh: group, light };
  }

  function createBedMesh() {
    const group = new THREE.Group();
    group.name = 'Building_Bed';

    const woodMat = toonMat(0x7c4d2b);
    const darkWoodMat = toonMat(0x52311a);
    const leafMat = toonMat(0x49a644);
    const leafHiMat = toonMat(0x74c64b);
    const pillowMat = toonMat(0xf1e5c8);

    // Bed frame platform
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 1.52), woodMat);
    frame.position.y = 0.24;
    group.add(frame);

    // 4 Corner posts
    const postGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.42, 7);
    for (const [px, pz] of [
      [-0.42, -0.68],
      [0.42, -0.68],
      [-0.42, 0.68],
      [0.42, 0.68],
    ]) {
      const post = new THREE.Mesh(postGeo, darkWoodMat);
      post.position.set(px, 0.21, pz);
      group.add(post);
    }

    // Palm-leaf mattress layers
    const matBase = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 1.38), leafMat);
    matBase.position.y = 0.35;
    group.add(matBase);

    for (let i = 0; i < 4; i += 1) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.32), leafHiMat);
      frond.position.set((i % 2 === 0 ? -0.04 : 0.04), 0.42, -0.42 + i * 0.3);
      frond.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.12;
      group.add(frond);
    }

    // Woven fiber pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.32), pillowMat);
    pillow.position.set(0, 0.46, -0.48);
    pillow.rotation.x = 0.12;
    group.add(pillow);

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createWallMesh() {
    const src = ctx.envScene?.getObjectByName('Ruin_Temple_Wall');
    if (src) {
      const clone = src.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      enableShadows(clone);
      return { mesh: clone, light: null };
    }

    // Fallback stylized timber palisade + mossy stone wall
    const group = new THREE.Group();
    group.name = 'Building_Wall';
    const stoneBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.38, 0.44),
      toonMat(0x7c868e)
    );
    stoneBase.position.y = 0.19;
    group.add(stoneBase);

    const logGeo = new THREE.CylinderGeometry(0.085, 0.095, 1.45, 7);
    const tipGeo = new THREE.ConeGeometry(0.085, 0.22, 7);
    const woodMat = toonMat(0x7e502c);
    for (let i = -2; i <= 2; i += 1) {
      const log = new THREE.Mesh(logGeo, woodMat);
      log.position.set(i * 0.19, 0.82, 0);
      group.add(log);
      const tip = new THREE.Mesh(tipGeo, woodMat);
      tip.position.set(i * 0.19, 1.65, 0);
      group.add(tip);
    }
    const barMat = toonMat(0x52321b);
    for (const by of [0.65, 1.18]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.1, 0.24), barMat);
      bar.position.y = by;
      group.add(bar);
    }

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createWorkbenchMesh() {
    const group = new THREE.Group();
    group.name = 'Building_Workbench';

    const topMat = toonMat(0xa16938);
    const legMat = toonMat(0x633b1d);
    const metalMat = toonMat(0x8896a3);
    const paperMat = toonMat(0x3b82f6);

    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.14, 0.86), topMat);
    top.position.y = 0.78;
    group.add(top);

    // Lower shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 0.68), legMat);
    shelf.position.y = 0.28;
    group.add(shelf);

    // 4 Legs
    const legGeo = new THREE.BoxGeometry(0.12, 0.76, 0.12);
    for (const [lx, lz] of [
      [-0.5, -0.32],
      [0.5, -0.32],
      [-0.5, 0.32],
      [0.5, 0.32],
    ]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.38, lz);
      group.add(leg);
    }

    // Blueprint sheet on bench
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.32), paperMat);
    sheet.position.set(-0.22, 0.86, 0.04);
    sheet.rotation.y = 0.18;
    group.add(sheet);

    // Tiny hammer prop
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), legMat);
    handle.position.set(0.28, 0.88, 0.05);
    handle.rotation.z = Math.PI / 2;
    handle.rotation.y = -0.5;
    group.add(handle);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), metalMat);
    head.position.set(0.38, 0.89, -0.02);
    head.rotation.y = -0.5;
    group.add(head);

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createBuildingMesh(type, isGhost = false) {
    if (type === 'campfire') return createCampfireMesh(isGhost);
    if (type === 'bed') return createBedMesh();
    if (type === 'wall') return createWallMesh();
    if (type === 'workbench') return createWorkbenchMesh();
    return createCampfireMesh(isGhost);
  }

  // --- Blueprint Placement System ---

  function cancelBlueprint() {
    if (!activeBlueprint) return;
    ctx.scene.remove(activeBlueprint.ghostGroup);
    activeBlueprint.ghostMat.dispose();
    activeBlueprint.gridMat.dispose();
    activeBlueprint.gridGeo?.dispose();
    activeBlueprint = null;
    setPromptIfChanged(null);
  }

  function evaluateGhostPlacement(gx, gz) {
    if (!activeBlueprint) return { valid: false, reason: '' };
    const { def } = activeBlueprint;
    const p = ctx.player.pos;
    if (!hasIngredients(def.ingredients)) {
      return { valid: false, reason: `Missing: ${formatMissingIngredients(def.ingredients)}` };
    }
    if (ctx.isWater?.(gx, gz)) {
      return { valid: false, reason: 'Cannot build in deep water!' };
    }
    if (ctx.isBlocked?.(gx, gz, def.radius)) {
      return { valid: false, reason: 'Space is blocked!' };
    }
    const distToPlayer = distXZ(p.x, p.z, gx, gz);
    if (distToPlayer < 0.62) {
      return { valid: false, reason: 'Too close to Boots — step back!' };
    }
    if (distToPlayer > 8.0) {
      return { valid: false, reason: 'Move closer to build there!' };
    }
    return { valid: true, reason: '' };
  }

  function updateGhostFromCursor() {
    if (!activeBlueprint) return;
    const cam = ctx.getActiveCamera?.();
    let gx = activeBlueprint.gx;
    let gz = activeBlueprint.gz;

    if (cam && hasPointerNdc) {
      raycaster.setFromCamera(pointerNdc, cam);
      if (raycaster.ray.intersectPlane(groundPlane, rayHit)) {
        const clamped = clampToWorld(Math.round(rayHit.x), Math.round(rayHit.z), 0.5);
        gx = Math.round(clamped.x);
        gz = Math.round(clamped.z);
      }
    }

    activeBlueprint.gx = gx;
    activeBlueprint.gz = gz;
    activeBlueprint.ghostGroup.position.set(gx, 0, gz);

    const check = evaluateGhostPlacement(gx, gz);
    activeBlueprint.valid = check.valid;
    activeBlueprint.invalidReason = check.reason;

    const tint = check.valid ? 0x34e04b : 0xff3b3b;
    activeBlueprint.ghostMat.color.setHex(tint);
    activeBlueprint.ghostMat.emissive.setHex(tint);
    activeBlueprint.gridMat.color.setHex(tint);
  }

  function startBlueprint(blueprintId) {
    const def = BLUEPRINT_DEFS.find((b) => b.id === blueprintId);
    if (!def) {
      ctx.toast?.(`Unknown blueprint: ${blueprintId}`, 'warn');
      return false;
    }
    if (ctx.player.isDead) return false;

    cancelBlueprint();

    const { mesh: rawMesh } = createBuildingMesh(def.id, true);
    const ghostMat = new THREE.MeshToonMaterial({
      color: 0x34e04b,
      emissive: 0x34e04b,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      gradientMap,
    });

    rawMesh.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = ghostMat;
      obj.castShadow = false;
      obj.receiveShadow = false;
    });

    const ghostGroup = new THREE.Group();
    ghostGroup.name = `Ghost_${def.id}`;
    ghostGroup.add(rawMesh);

    // 1x1 Grid snap footprint tile
    const gridGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x34e04b,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const gridTile = new THREE.Mesh(gridGeo, gridMat);
    gridTile.rotation.x = -Math.PI / 2;
    gridTile.position.y = 0.03;
    ghostGroup.add(gridTile);

    // Initial position: 2 units in front of Boots snapped to 1x1 grid
    const p = ctx.player.pos;
    const initX = Math.round(p.x + Math.sin(desiredYaw) * 2.0);
    const initZ = Math.round(p.z + Math.cos(desiredYaw) * 2.0);
    const clamped = clampToWorld(initX, initZ, 0.5);

    activeBlueprint = {
      def,
      ghostGroup,
      ghostMat,
      gridMat,
      gridGeo,
      gx: Math.round(clamped.x),
      gz: Math.round(clamped.z),
      valid: false,
      invalidReason: '',
    };

    ctx.scene.add(ghostGroup);
    updateGhostFromCursor();
    ctx.toast?.(`Placing ${def.name} — Left-Click to build, Right-Click/Esc to cancel.`, 'info');
    return true;
  }

  function tryPlaceActiveBlueprint() {
    if (!activeBlueprint || ctx.player.isDead) return false;
    updateGhostFromCursor();

    const { def, gx, gz, valid, invalidReason } = activeBlueprint;
    if (!valid) {
      ctx.toast?.(invalidReason || 'Cannot place blueprint here!', 'warn');
      return false;
    }

    // Deduct materials
    for (const ing of def.ingredients) {
      ctx.player.removeItem?.(ing.id, ing.count);
    }

    const speedMult = Math.max(0.5, ctx.player.craftSpeedMultiplier || 1.0);
    const effectiveBuildTime = def.buildTime / speedMult;

    facePoint(gx, gz);
    actionAnimClip = 'Craft';
    actionAnimTimer = Math.max(0.4, Math.min(1.4, effectiveBuildTime));
    moveTarget = null;
    pendingHarvestTarget = null;

    const { mesh, light } = createBuildingMesh(def.id, false);
    mesh.position.set(gx, 0, gz);
    mesh.scale.set(0.05, 0.05, 0.05);
    ctx.scene.add(mesh);

    const id = `${def.id}_${Date.now()}_${nextBuildingSeq++}`;
    const entry = {
      id,
      type: def.id,
      mesh,
      x: gx,
      z: gz,
      radius: def.radius,
      ...(light ? { light } : {}),
    };
    ctx.buildings.push(entry);
    ctx.addCollider?.(id, gx, gz, def.radius);

    buildPopAnims.push({
      mesh,
      age: 0,
      duration: Math.max(0.28, Math.min(0.85, effectiveBuildTime * 0.55)),
    });

    if (def.isRespawnPoint) {
      if (ctx.systems?.death?.setRespawnPoint) {
        ctx.systems.death.setRespawnPoint(gx, gz);
      } else if (ctx.player.respawnPoint) {
        ctx.player.respawnPoint.set(gx, 0, gz);
      }
    }

    const boostTag = speedMult > 1.05 ? ` (+${Math.round((speedMult - 1) * 100)}% Smuff speed!)` : '';
    const respawnTag = def.isRespawnPoint ? ' Respawn point set!' : '';
    ctx.toast?.(`Built ${def.name}!${respawnTag}${boostTag}`, 'success');

    cancelBlueprint();
    ctx.updateHud?.();
    return true;
  }

  // --- Crafting System ---

  function craftRecipe(recipeId) {
    if (ctx.player.isDead) return false;
    const recipe = RECIPE_DEFS.find((r) => r.id === recipeId);
    if (!recipe) {
      ctx.toast?.(`Unknown recipe: ${recipeId}`, 'warn');
      return false;
    }
    if (activeCraft) {
      ctx.toast?.(`Already crafting ${activeCraft.recipe.name}...`, 'info');
      return false;
    }
    if (recipe.requiresWorkbench && !hasWorkbenchBuilt()) {
      ctx.toast?.('Build a Crafting Workbench first (R menu) to craft this!', 'warn');
      return false;
    }
    if (!hasIngredients(recipe.ingredients)) {
      ctx.toast?.(`Missing materials: ${formatMissingIngredients(recipe.ingredients)}`, 'warn');
      return false;
    }

    for (const ing of recipe.ingredients) {
      ctx.player.removeItem?.(ing.id, ing.count);
    }

    const speedMult = Math.max(0.5, ctx.player.craftSpeedMultiplier || 1.0);
    const duration = recipe.craftTime / speedMult;

    activeCraft = {
      recipe,
      elapsed: 0,
      duration,
    };

    actionAnimClip = 'Craft';
    actionAnimTimer = Math.max(0.45, Math.min(1.5, duration));
    ctx.updateHud?.();

    const boostTag = speedMult > 1.05 ? ` (+${Math.round((speedMult - 1) * 100)}% Smuff Boost!)` : '';
    ctx.toast?.(`Crafting ${recipe.name} (${duration.toFixed(1)}s)${boostTag}...`, 'info');
    return true;
  }

  function getBlueprints() {
    const speedMult = Math.max(0.5, ctx.player.craftSpeedMultiplier || 1.0);
    return BLUEPRINT_DEFS.map((bp) => {
      const canAfford = hasIngredients(bp.ingredients);
      return {
        id: bp.id,
        name: bp.name,
        description: bp.description,
        buildTime: bp.buildTime,
        effectiveTime: Number((bp.buildTime / speedMult).toFixed(2)),
        radius: bp.radius,
        isRespawnPoint: bp.isRespawnPoint,
        ingredients: bp.ingredients.map((i) => ({
          ...i,
          have: ctx.player.countItem?.(i.id) || 0,
        })),
        cost: makeCostMap(bp.ingredients),
        canAfford,
        hasMaterials: canAfford,
      };
    });
  }

  function getRecipes() {
    const speedMult = Math.max(0.5, ctx.player.craftSpeedMultiplier || 1.0);
    const workbenchReady = hasWorkbenchBuilt();
    return RECIPE_DEFS.map((r) => {
      const hasMaterials = hasIngredients(r.ingredients);
      const workbenchOk = !r.requiresWorkbench || workbenchReady;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        craftTime: r.craftTime,
        effectiveTime: Number((r.craftTime / speedMult).toFixed(2)),
        requiresWorkbench: r.requiresWorkbench,
        workbenchReady: workbenchOk,
        ingredients: r.ingredients.map((i) => ({
          ...i,
          have: ctx.player.countItem?.(i.id) || 0,
        })),
        cost: makeCostMap(r.ingredients),
        output: { ...r.output },
        canAfford: hasMaterials,
        hasMaterials,
        canCraft: hasMaterials && workbenchOk && !activeCraft,
      };
    });
  }

  // --- Hotbar & Consumables ---

  function selectSlot(idx) {
    const clamped = Math.max(0, Math.min(9, Math.floor(Number(idx) || 0)));
    ctx.player.selectedSlot = clamped;
    ctx.updateHud?.();
  }

  function isNearWildCrockstar() {
    const crock = ctx.companions?.crockstar;
    if (!crock || crock.tamed || !crock.pos) return false;
    return distXZ(ctx.player.pos.x, ctx.player.pos.z, crock.pos.x, crock.pos.z) <= 2.8;
  }

  function useSelectedConsumable() {
    if (ctx.player.isDead) return false;
    const item = getSelectedItem();
    if (!item) return false;

    const id = (item.id || '').toLowerCase();
    // If near wild Crockstar with fish/meat, feed Crockstar instead of eating it
    if ((id === 'fish' || id === 'meat') && isNearWildCrockstar()) {
      ctx.systems?.companions?.tryTameCrockstar?.();
      return true;
    }

    const spec = CONSUMABLES[id];
    if (!spec && item.type !== 'consumable') return false;

    const hpGain = spec?.hp ?? 20;
    const stamGain = spec?.stamina ?? 20;
    const needsHp = ctx.player.hp < ctx.player.maxHp - 0.5;
    const needsStam = ctx.player.stamina < ctx.player.maxStamina - 0.5;

    if (!needsHp && !needsStam) {
      ctx.toast?.('Health & Stamina are already full!', 'info');
      return false;
    }

    if (ctx.player.removeItem?.(item.id, 1)) {
      if (hpGain > 0) {
        if (ctx.player.heal) {
          ctx.player.heal(hpGain);
        } else {
          ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hpGain);
        }
      }
      if (stamGain > 0) {
        ctx.player.stamina = Math.min(ctx.player.maxStamina, ctx.player.stamina + stamGain);
      }
      actionAnimClip = 'Craft';
      actionAnimTimer = 0.35;
      ctx.toast?.(`Used ${item.name || spec?.label || id} (+${hpGain} HP, +${stamGain} Stamina)`, 'success');
      ctx.updateHud?.();
      return true;
    }
    return false;
  }

  // --- Harvesting & Combat ---

  function findNearestHarvestable(maxExtraRange = 1.85) {
    const p = ctx.player.pos;
    let best = null;
    let bestDist = Infinity;
    for (const h of ctx.harvestables || []) {
      if (!h || h.depleted) continue;
      const d = distXZ(p.x, p.z, h.x, h.z);
      const range = (h.radius || 0.7) + maxExtraRange;
      if (d <= range && d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  function findNearestActiveAgent(maxRange) {
    const p = ctx.player.pos;
    let best = null;
    let bestDist = Infinity;
    for (const agent of ctx.fbi?.agents || []) {
      if (!agent || agent.state === 'ko' || !agent.pos) continue;
      const d = distXZ(p.x, p.z, agent.pos.x, agent.pos.z);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        best = agent;
      }
    }
    return best;
  }

  function harvestResource(h) {
    if (!h || h.depleted || ctx.player.isDead) return false;
    if (harvestCooldown > 0) return false;

    const p = ctx.player.pos;
    const range = (h.radius || 0.7) + 1.9;
    if (distXZ(p.x, p.z, h.x, h.z) > range) return false;

    if (ctx.player.stamina < HARVEST_STAMINA_COST) {
      if (staminaWarnCooldown <= 0) {
        ctx.toast?.('Not enough stamina! Rest a moment to recover.', 'warn');
        staminaWarnCooldown = 1.6;
      }
      return false;
    }

    ctx.player.stamina = Math.max(0, ctx.player.stamina - HARVEST_STAMINA_COST);
    staminaRegenDelay = 0.75;
    harvestCooldown = HARVEST_COOLDOWN;

    facePoint(h.x, h.z);
    actionAnimClip = 'Chop_Mine';
    actionAnimTimer = 0.42;

    const equipped = getSelectedItem();
    const dmg = isMeleeItem(equipped) ? 35 : 22;
    h.hp = Math.max(0, (h.hp ?? 100) - dmg);
    triggerHarvestHitFX(h);

    if (h.hp <= 0) {
      h.depleted = true;
      h.respawnTimer = HARVEST_RESPAWN_TIME;
      ctx.removeCollider?.(h.id);

      const lootSummary = [];
      for (const lootItem of h.loot || []) {
        const added = ctx.player.addItem?.({ ...lootItem });
        if (added !== false) {
          lootSummary.push(`${lootItem.name || lootItem.id} x${lootItem.count || 1}`);
        }
      }
      if (lootSummary.length > 0) {
        ctx.toast?.(`Gathered ${lootSummary.join(', ')}!`, 'success');
      } else {
        ctx.toast?.('Inventory full — make room in your hotbar!', 'warn');
      }
      if (pendingHarvestTarget === h) {
        pendingHarvestTarget = null;
      }
    }

    ctx.updateHud?.();
    return true;
  }

  function fireTranqDart(agent) {
    if (!agent || !agent.pos) return false;
    const item = getSelectedItem();
    if (!item || item.id !== 'tranq_darts') return false;
    if (meleeCooldown > 0) return false;

    if (!ctx.player.removeItem?.('tranq_darts', 1)) return false;
    meleeCooldown = 0.55;
    facePoint(agent.pos.x, agent.pos.z);
    actionAnimClip = 'Craft';
    actionAnimTimer = 0.35;

    // Visible dart projectile flying to agent
    const dartGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6);
    dartGeo.rotateX(Math.PI / 2);
    const dartMat = toonMat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 0.75 });
    const mesh = new THREE.Mesh(dartGeo, dartMat);
    const start = new THREE.Vector3(ctx.player.pos.x, 1.05, ctx.player.pos.z);
    const end = new THREE.Vector3(agent.pos.x, 1.05, agent.pos.z);
    mesh.position.copy(start);
    mesh.lookAt(end);
    ctx.scene.add(mesh);

    projectiles.push({
      mesh,
      start,
      end,
      agentId: agent.id,
      age: 0,
      duration: Math.max(0.12, start.distanceTo(end) / 22.0),
      damage: 55,
    });

    ctx.toast?.('Fired Tranquilizer Dart!', 'info');
    ctx.updateHud?.();
    return true;
  }

  function attackAgentMelee(agent) {
    if (!agent || agent.state === 'ko' || ctx.player.isDead) return false;
    if (meleeCooldown > 0) return false;

    if (ctx.player.stamina < MELEE_STAMINA_COST) {
      if (staminaWarnCooldown <= 0) {
        ctx.toast?.('Low stamina — catch your breath!', 'warn');
        staminaWarnCooldown = 1.5;
      }
      return false;
    }

    ctx.player.stamina = Math.max(0, ctx.player.stamina - MELEE_STAMINA_COST);
    staminaRegenDelay = 0.7;
    meleeCooldown = MELEE_COOLDOWN;

    facePoint(agent.pos.x, agent.pos.z);
    actionAnimClip = 'Chop_Mine';
    actionAnimTimer = 0.42;

    const equipped = getSelectedItem();
    const id = (equipped?.id || '').toLowerCase();
    let dmg = 16;
    if (id.includes('club') || id.includes('machete')) dmg = 38;
    else if (isMeleeItem(equipped)) dmg = 28;

    ctx.systems?.fbi?.damageAgent?.(agent.id, dmg, ctx.player.pos);
    spawnHitChips(agent.pos.x, 1.0, agent.pos.z, 0xffd43b, 5);
    ctx.updateHud?.();
    return true;
  }

  function performSpaceAction() {
    if (ctx.player.isDead || activeBlueprint) return false;
    const equipped = getSelectedItem();

    // 1. Ranged tranq dart if equipped & FBI agent in range
    if (equipped?.id === 'tranq_darts') {
      const rangedAgent = findNearestActiveAgent(TRANQ_RANGE);
      if (rangedAgent) {
        fireTranqDart(rangedAgent);
        return true;
      }
    }

    // 2. Melee attack FBI agent if nearby and holding melee tool/weapon (or agent is close)
    const nearbyAgent = findNearestActiveAgent(MELEE_RANGE);
    if (nearbyAgent && (isMeleeItem(equipped) || nearbyAgent.state === 'chase' || nearbyAgent.state === 'alert')) {
      attackAgentMelee(nearbyAgent);
      return true;
    }

    // 3. Harvest nearby resource
    const h = findNearestHarvestable();
    if (h) {
      harvestResource(h);
      return true;
    }

    // 4. Bare-handed melee fallback if FBI agent is right next to Boots
    if (nearbyAgent) {
      attackAgentMelee(nearbyAgent);
      return true;
    }
    return false;
  }

  // --- Context Interaction (Priority Order) & Prompt ---

  function getBestContextAction() {
    const p = ctx.player.pos;

    // Priority 1: Nearby Death Crate
    for (const crate of ctx.deathCrates || []) {
      if (!crate || crate.recovered || crate.confiscated || !crate.pos) continue;
      if (distXZ(p.x, p.z, crate.pos.x, crate.pos.z) <= 2.3) {
        return {
          type: 'crate',
          target: crate,
          prompt: '[F] Recover Death Crate',
        };
      }
    }

    // Priority 2: Rescue Smuff near cage
    const smuff = ctx.fbi?.smuff;
    if (smuff && !smuff.rescued) {
      const spos = smuff.pos || smuff.cageMesh?.position || smuff.group?.position;
      if (spos && distXZ(p.x, p.z, spos.x, spos.z) <= 2.8) {
        return {
          type: 'smuff',
          target: smuff,
          prompt: '[F] Rescue Smuff (+35% Craft Speed)',
        };
      }
    }

    // Priority 3: Tame wild Crockstar
    const crock = ctx.companions?.crockstar;
    if (crock && !crock.tamed && crock.pos) {
      if (distXZ(p.x, p.z, crock.pos.x, crock.pos.z) <= 2.8) {
        const hasFood =
          (ctx.player.countItem?.('fish') || 0) > 0 ||
          (ctx.player.countItem?.('meat') || 0) > 0;
        return {
          type: 'crockstar',
          target: crock,
          prompt: hasFood
            ? '[F] Feed & Tame Crockstar'
            : '[F] Tame Crockstar (Needs Raw Fish or Meat)',
        };
      }
    }

    // Priority 4: Activate nearby campfire / bed as respawn point
    let bestCamp = null;
    let bestCampDist = Infinity;
    for (const b of ctx.buildings || []) {
      if (!b || (b.type !== 'campfire' && b.type !== 'bed')) continue;
      const d = distXZ(p.x, p.z, b.x, b.z);
      if (d <= 2.35 && d < bestCampDist) {
        bestCampDist = d;
        bestCamp = b;
      }
    }
    if (bestCamp) {
      const label = bestCamp.type === 'campfire' ? 'Campfire' : 'Bed';
      return {
        type: 'respawn',
        target: bestCamp,
        prompt: `[F] Set Respawn Point (${label})`,
      };
    }

    // Priority 5: Harvest nearby resource
    const h = findNearestHarvestable();
    if (h) {
      const label =
        h.type === 'tree'
          ? 'Chop Tree'
          : h.type === 'rock'
          ? 'Mine Rock'
          : h.type === 'fbi_crate'
          ? 'Loot FBI Supply Crate'
          : 'Harvest';
      return {
        type: 'harvest',
        target: h,
        prompt: `[F / Space] ${label}`,
      };
    }

    return null;
  }

  function interact() {
    if (ctx.player.isDead) return false;
    if (activeBlueprint) {
      return tryPlaceActiveBlueprint();
    }

    const action = getBestContextAction();
    if (!action) return false;

    if (action.type === 'crate') {
      ctx.systems?.death?.tryRecoverCrate?.();
      return true;
    }

    if (action.type === 'smuff') {
      ctx.systems?.fbi?.tryRescueSmuff?.();
      return true;
    }

    if (action.type === 'crockstar') {
      ctx.systems?.companions?.tryTameCrockstar?.();
      return true;
    }

    if (action.type === 'respawn') {
      const b = action.target;
      if (ctx.systems?.death?.setRespawnPoint) {
        ctx.systems.death.setRespawnPoint(b.x, b.z);
      } else if (ctx.player.respawnPoint) {
        ctx.player.respawnPoint.set(b.x, 0, b.z);
        ctx.toast?.(
          `Respawn point set at ${b.type === 'campfire' ? 'Campfire' : 'Bed'}!`,
          'success'
        );
      }
      return true;
    }

    if (action.type === 'harvest') {
      return harvestResource(action.target);
    }

    return false;
  }

  // --- Pointer & Keyboard Event Wiring ---

  function updatePointerNdc(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerNdc = true;
  }

  function pickHarvestableUnderPointer() {
    const cam = ctx.getActiveCamera?.();
    if (!cam || !hasPointerNdc) return null;
    raycaster.setFromCamera(pointerNdc, cam);

    const activeMeshes = [];
    const meshToHarvestable = new Map();
    for (const h of ctx.harvestables || []) {
      if (!h || h.depleted || !h.mesh || !h.mesh.visible) continue;
      activeMeshes.push(h.mesh);
      h.mesh.traverse((child) => {
        if (child.isMesh) meshToHarvestable.set(child, h);
      });
    }

    if (activeMeshes.length > 0) {
      const hits = raycaster.intersectObjects(activeMeshes, true);
      if (hits.length > 0) {
        const hitH = meshToHarvestable.get(hits[0].object);
        if (hitH) return hitH;
      }
    }

    // Fallback: proximity to ground ray hit
    if (raycaster.ray.intersectPlane(groundPlane, rayHit)) {
      let best = null;
      let bestD = Infinity;
      for (const h of ctx.harvestables || []) {
        if (!h || h.depleted) continue;
        const d = distXZ(rayHit.x, rayHit.z, h.x, h.z);
        const pickR = (h.radius || 0.7) + 0.45;
        if (d <= pickR && d < bestD) {
          bestD = d;
          best = h;
        }
      }
      return best;
    }
    return null;
  }

  function onPointerMove(e) {
    if (!canvas) return;
    updatePointerNdc(e);
    if (activeBlueprint) {
      updateGhostFromCursor();
    }
  }

  function onPointerDown(e) {
    if (!canvas || e.target !== canvas) return;
    updatePointerNdc(e);

    if (e.button === 2) {
      // Right-click: cancel blueprint OR use consumable
      if (activeBlueprint) {
        cancelBlueprint();
      } else {
        useSelectedConsumable();
      }
      return;
    }

    if (e.button === 0) {
      if (activeBlueprint) {
        tryPlaceActiveBlueprint();
        return;
      }
      pointerDownPos = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerUp(e) {
    if (e.button !== 0 || !pointerDownPos) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    pointerDownPos = null;

    // Ignore drags (e.g., Free Orbit camera rotation)
    if (dx * dx + dy * dy > 36) return;
    if (!canvas || e.target !== canvas) return;
    if (ctx.player.isDead || activeBlueprint) return;

    updatePointerNdc(e);

    // Face toward cursor click on ground plane so attacks/chops aim naturally
    const cam = ctx.getActiveCamera?.();
    if (cam) {
      raycaster.setFromCamera(pointerNdc, cam);
      if (raycaster.ray.intersectPlane(groundPlane, rayHit)) {
        const aimDx = rayHit.x - ctx.player.pos.x;
        const aimDz = rayHit.z - ctx.player.pos.z;
        if (aimDx * aimDx + aimDz * aimDz > 0.01) {
          facingYaw = Math.atan2(aimDx, aimDz);
          ctx.player.group.rotation.y = facingYaw;
        }
      }
    }

    // Check if user clicked directly on a harvestable resource within reach
    const clickedHarvestable = pickHarvestableUnderPointer();
    if (clickedHarvestable) {
      const p = ctx.player.pos;
      const range = (clickedHarvestable.radius || 0.7) + 1.85;
      if (distXZ(p.x, p.z, clickedHarvestable.x, clickedHarvestable.z) <= range) {
        harvestResource(clickedHarvestable);
        return;
      }
    }

    // Primary attack / harvest action on left-click (no tap-to-walk)
    const acted = performSpaceAction();
    if (!acted && actionAnimTimer <= 0 && attackCooldown <= 0) {
      attackCooldown = 0.35;
      playTarcyAnim('Chop_Mine', 0.08, { loopOnce: true, lockSec: 0.3 });
    }
  }

  function onContextMenu(e) {
    if (canvas && e.target === canvas) {
      e.preventDefault();
    }
  }

  function onKeyDown(e) {
    if (isEditableTarget(e.target)) return;

    const code = e.code;
    keys.add(code);

    if (code === 'Escape' && activeBlueprint) {
      e.preventDefault();
      cancelBlueprint();
      return;
    }

    if (code === 'KeyC' && !e.repeat) {
      sneakToggle = !sneakToggle;
      return;
    }

    if ((code === 'ShiftLeft' || code === 'ShiftRight') && sneakToggle) {
      sneakToggle = false;
    }

    if (code === 'Space' && !e.repeat) {
      e.preventDefault();
      performSpaceAction();
      return;
    }

    if (code === 'KeyF' && !e.repeat) {
      e.preventDefault();
      interact();
      return;
    }

    if (code === 'KeyU' && !e.repeat) {
      e.preventDefault();
      useSelectedConsumable();
      return;
    }

    // Hotbar number keys 1-9, 0
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key >= '1' && e.key <= '9') {
        selectSlot(Number(e.key) - 1);
      } else if (e.key === '0') {
        selectSlot(9);
      }
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onWindowBlur() {
    keys.clear();
    pointerDownPos = null;
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);

  // --- Movement & Collision Step ---

  function canOccupy(x, z) {
    if (ctx.isWater?.(x, z)) return false;
    if (ctx.isBlocked?.(x, z, PLAYER_RADIUS)) return false;
    return true;
  }

  function movePlayerBy(dx, dz) {
    const pos = ctx.player.pos;
    const curClamped = clampToWorld(pos.x, pos.z);
    const nextClamped = clampToWorld(pos.x + dx, pos.z + dz);

    const currentlyValid = canOccupy(curClamped.x, curClamped.z);

    if (canOccupy(nextClamped.x, nextClamped.z) || !currentlyValid) {
      pos.x = nextClamped.x;
      pos.z = nextClamped.z;
      return true;
    }

    // Axis-sliding along X then Z
    let moved = false;
    const tryX = clampToWorld(pos.x + dx, pos.z);
    if (Math.abs(dx) > 1e-5 && canOccupy(tryX.x, tryX.z)) {
      pos.x = tryX.x;
      moved = true;
    }
    const tryZ = clampToWorld(pos.x, pos.z + dz);
    if (Math.abs(dz) > 1e-5 && canOccupy(tryZ.x, tryZ.z)) {
      pos.z = tryZ.z;
      moved = true;
    }
    return moved;
  }

  // --- Per-Frame Update ---

  function updateEffects(dt) {
    // 1. Click-to-move ground rings
    for (let i = clickRings.length - 1; i >= 0; i -= 1) {
      const r = clickRings[i];
      r.age += dt;
      const t = r.age / r.duration;
      if (t >= 1) {
        ctx.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        clickRings.splice(i, 1);
      } else {
        const s = 0.7 + t * 1.15;
        r.mesh.scale.set(s, s, 1);
        r.mesh.material.opacity = (1 - t) * 0.85;
      }
    }

    // 2. Harvestable shake / emissive flash / shrink-on-deplete
    for (let i = hitEffects.length - 1; i >= 0; i -= 1) {
      const fx = hitEffects[i];
      fx.age += dt;
      const h = fx.harvestable;
      const base = h?.mesh ? harvestBaseTransforms.get(h.mesh) : null;

      if (!fx.flashCleared && fx.age >= fx.flashDuration) {
        fx.flashCleared = true;
        for (const rec of fx.flashedMats) {
          rec.mat.emissive.setHex(rec.prevHex);
          rec.mat.emissiveIntensity = rec.prevIntensity;
        }
      }

      if (h?.mesh && base) {
        if (h.depleted) {
          const shrinkT = Math.min(1, fx.age / 0.24);
          const s = Math.max(0.01, 1 - shrinkT);
          h.mesh.scale.set(base.scale.x * s, base.scale.y * s, base.scale.z * s);
          if (shrinkT >= 1) {
            h.mesh.visible = false;
            h.mesh.position.copy(base.pos);
          }
        } else if (fx.age < fx.shakeDuration) {
          const damp = 1 - fx.age / fx.shakeDuration;
          const shake = Math.sin(fx.age * 55) * 0.085 * damp;
          h.mesh.position.set(base.pos.x + shake, base.pos.y, base.pos.z - shake * 0.5);
        } else {
          h.mesh.position.copy(base.pos);
        }
      }

      if (fx.age >= Math.max(fx.shakeDuration, fx.flashDuration) && (!h?.depleted || !h?.mesh?.visible)) {
        if (!fx.flashCleared) {
          for (const rec of fx.flashedMats) {
            rec.mat.emissive.setHex(rec.prevHex);
            rec.mat.emissiveIntensity = rec.prevIntensity;
          }
        }
        hitEffects.splice(i, 1);
      }
    }

    // 3. Harvestable respawns
    for (const h of ctx.harvestables || []) {
      if (!h) continue;
      if (h.depleted) {
        h.respawnTimer = (h.respawnTimer ?? HARVEST_RESPAWN_TIME) - dt;
        if (h.respawnTimer <= 0) {
          h.depleted = false;
          h.hp = h.maxHp || 100;
          h.respawnTimer = 0;
          if (h.mesh) {
            const base = harvestBaseTransforms.get(h.mesh);
            h.mesh.visible = true;
            if (base) {
              h.mesh.position.copy(base.pos);
              h.mesh.scale.set(0.05, 0.05, 0.05);
              buildPopAnims.push({ mesh: h.mesh, targetScale: base.scale.clone(), age: 0, duration: 0.4 });
            } else {
              h.mesh.scale.set(1, 1, 1);
            }
          }
          ctx.addCollider?.(h.id, h.x, h.z, h.radius || 0.7);
        }
      }
    }

    // 4. Hit chip particles
    for (let i = hitParticles.length - 1; i >= 0; i -= 1) {
      const p = hitParticles[i];
      p.age += dt;
      if (p.age >= p.duration) {
        ctx.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        hitParticles.splice(i, 1);
      } else {
        p.vy -= 9.8 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += 8 * dt;
        p.mesh.rotation.y += 6 * dt;
        const s = 1 - p.age / p.duration;
        p.mesh.scale.setScalar(Math.max(0.05, s));
      }
    }

    // 5. Tranq dart projectiles
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const proj = projectiles[i];
      proj.age += dt;
      const t = Math.min(1, proj.age / proj.duration);
      proj.mesh.position.lerpVectors(proj.start, proj.end, t);
      if (t >= 1) {
        ctx.scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        proj.mesh.material.dispose();
        ctx.systems?.fbi?.damageAgent?.(proj.agentId, proj.damage, ctx.player.pos);
        spawnHitChips(proj.end.x, 1.0, proj.end.z, 0x22d3ee, 6);
        projectiles.splice(i, 1);
      }
    }

    // 6. Newly built structures / respawn pop-in animation
    for (let i = buildPopAnims.length - 1; i >= 0; i -= 1) {
      const anim = buildPopAnims[i];
      anim.age += dt;
      const t = Math.min(1, anim.age / anim.duration);
      // Slight overshoot ease-out
      const ease = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5);
      const ts = anim.targetScale || { x: 1, y: 1, z: 1 };
      anim.mesh.scale.set(ts.x * ease, ts.y * ease, ts.z * ease);
      if (t >= 1) {
        anim.mesh.scale.set(ts.x, ts.y, ts.z);
        buildPopAnims.splice(i, 1);
      }
    }

    // 7. Flicker player-built campfires
    for (let idx = 0; idx < (ctx.buildings || []).length; idx += 1) {
      const b = ctx.buildings[idx];
      if (!b || b.type !== 'campfire' || !b.mesh) continue;
      const flicker = Math.sin(elapsedTime * 11.0 + idx * 1.9) * 0.14 + Math.cos(elapsedTime * 17.5 + idx) * 0.08;
      if (b.light) {
        b.light.intensity = 2.4 + flicker * 2.2;
      }
      const flames = b.mesh.userData?.flames;
      if (flames) {
        if (flames[0]) {
          flames[0].scale.set(1 + flicker * 0.35, 1 + flicker * 0.65, 1 - flicker * 0.3);
          flames[0].rotation.y = elapsedTime * 1.5;
        }
        if (flames[1]) {
          flames[1].scale.set(1 - flicker * 0.3, 1 + flicker * 0.8, 1 + flicker * 0.3);
          flames[1].rotation.y = -elapsedTime * 2.1;
        }
      }
    }
  }

  function update(dt) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    elapsedTime += safeDt;

    if (harvestCooldown > 0) harvestCooldown = Math.max(0, harvestCooldown - safeDt);
    if (meleeCooldown > 0) meleeCooldown = Math.max(0, meleeCooldown - safeDt);
    if (staminaRegenDelay > 0) staminaRegenDelay = Math.max(0, staminaRegenDelay - safeDt);
    if (staminaWarnCooldown > 0) staminaWarnCooldown = Math.max(0, staminaWarnCooldown - safeDt);
    if (actionAnimTimer > 0) {
      actionAnimTimer = Math.max(0, actionAnimTimer - safeDt);
      if (actionAnimTimer <= 0) actionAnimClip = null;
    }

    updateEffects(safeDt);

    // Handle dead state cleanly
    if (ctx.player.isDead) {
      ctx.player.isSneaking = false;
      moveTarget = null;
      pendingHarvestTarget = null;
      activeCraft = null;
      if (activeBlueprint) cancelBlueprint();
      playTarcyClip('Death', 0.12);
      setPromptIfChanged(null);
      return;
    }

    // Active timed craft completion
    if (activeCraft) {
      activeCraft.elapsed += safeDt;
      if (activeCraft.elapsed >= activeCraft.duration) {
        const { recipe } = activeCraft;
        activeCraft = null;
        const added = ctx.player.addItem?.({ ...recipe.output });
        if (added === false) {
          ctx.toast?.(`Hotbar full! Could not store ${recipe.output.name}.`, 'warn');
        } else {
          ctx.toast?.(`Crafted ${recipe.name}!`, 'success');
        }
        ctx.updateHud?.();
      }
    }

    // Update ghost placement under cursor continuously
    if (activeBlueprint) {
      updateGhostFromCursor();
    }

    // 1. Read WASD / Arrow keyboard axes
    let inputForward = 0;
    let inputRight = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) inputForward += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) inputForward -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) inputRight += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) inputRight -= 1;

    const hasKeyboardMove = inputForward !== 0 || inputRight !== 0;
    if (hasKeyboardMove) {
      moveTarget = null;
      pendingHarvestTarget = null;
    }

    // Compute camera-aligned XZ movement vector
    moveDir.set(0, 0, 0);
    if (hasKeyboardMove) {
      const cam = ctx.getActiveCamera?.();
      if (cam) {
        camForward.set(0, 0, -1).applyQuaternion(cam.quaternion);
        camForward.y = 0;
        if (camForward.lengthSq() < 1e-6) {
          camForward.set(-1, 0, -1);
        }
        camForward.normalize();
        camRight.crossVectors(camForward, UP).normalize();
      } else {
        // Default 45° isometric axes
        camForward.set(-Math.SQRT1_2, 0, -Math.SQRT1_2);
        camRight.set(Math.SQRT1_2, 0, -Math.SQRT1_2);
      }
      moveDir
        .addScaledVector(camForward, inputForward)
        .addScaledVector(camRight, inputRight);
      if (moveDir.lengthSq() > 1e-6) moveDir.normalize();
    } else if (moveTarget) {
      const p = ctx.player.pos;
      const toX = moveTarget.x - p.x;
      const toZ = moveTarget.z - p.z;
      const dist = Math.hypot(toX, toZ);

      // If walking to a clicked harvestable, stop & harvest once within range
      if (pendingHarvestTarget) {
        if (pendingHarvestTarget.depleted) {
          pendingHarvestTarget = null;
          moveTarget = null;
        } else {
          const range = (pendingHarvestTarget.radius || 0.7) + 1.65;
          if (distXZ(p.x, p.z, pendingHarvestTarget.x, pendingHarvestTarget.z) <= range) {
            const target = pendingHarvestTarget;
            pendingHarvestTarget = null;
            moveTarget = null;
            harvestResource(target);
          } else if (dist > 0.15) {
            moveDir.set(toX / dist, 0, toZ / dist);
          }
        }
      } else if (dist <= 0.18) {
        moveTarget = null;
      } else {
        moveDir.set(toX / dist, 0, toZ / dist);
      }
    }

    const isMoving = moveDir.lengthSq() > 1e-4;
    const wantsSneak = sneakToggle || keys.has('ControlLeft') || keys.has('ControlRight');
    const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !wantsSneak;
    const isSprinting = isMoving && wantsSprint && ctx.player.stamina > 0.5;

    ctx.player.isSneaking = Boolean(wantsSneak && !isSprinting);

    // 2. Apply movement & stamina drain/regen
    const prevStamina = ctx.player.stamina;
    let speed = WALK_SPEED;
    if (ctx.player.isSneaking) speed = SNEAK_SPEED;
    else if (isSprinting) speed = SPRINT_SPEED;

    let actuallyMoved = false;
    if (isMoving) {
      const stepDist = speed * safeDt;
      actuallyMoved = movePlayerBy(moveDir.x * stepDist, moveDir.z * stepDist);
      desiredYaw = Math.atan2(moveDir.x, moveDir.z);

      // Cancel click-to-move if completely blocked
      if (!actuallyMoved && moveTarget && !hasKeyboardMove) {
        moveTarget = null;
        pendingHarvestTarget = null;
      }
    }

    if (isSprinting && actuallyMoved) {
      ctx.player.stamina = Math.max(0, ctx.player.stamina - SPRINT_STAMINA_DRAIN * safeDt);
      staminaRegenDelay = 0.65;
    } else if (staminaRegenDelay <= 0 && ctx.player.stamina < ctx.player.maxStamina) {
      const rate = actuallyMoved ? STAMINA_REGEN_MOVE : STAMINA_REGEN_IDLE;
      ctx.player.stamina = Math.min(ctx.player.maxStamina, ctx.player.stamina + rate * safeDt);
    }

    // 3. Smoothly rotate Boots toward movement / action facing
    if (ctx.player.group) {
      const diff = angleDiff(ctx.player.group.rotation.y, desiredYaw);
      ctx.player.group.rotation.y += diff * Math.min(1, TURN_SPEED * safeDt);
    }

    // 4. Select & play appropriate Tarcy animation clip
    if (actionAnimTimer > 0 && actionAnimClip) {
      playTarcyClip(actionAnimClip, 0.1);
    } else if (ctx.player.isSneaking) {
      playTarcyClip('Sneak_Crouch', 0.15);
    } else if (isSprinting && actuallyMoved) {
      playTarcyClip('Run', 0.14);
    } else if (actuallyMoved) {
      playTarcyClip('Walk', 0.14);
    } else {
      playTarcyClip('Idle', 0.18);
    }

    // 5. Update dynamic contextual bottom prompt
    if (activeBlueprint) {
      const status = activeBlueprint.valid
        ? `[Left-Click] Place ${activeBlueprint.def.name}`
        : activeBlueprint.invalidReason || 'Invalid Placement';
      setPromptIfChanged(`${status}  •  [Right-Click / Esc] Cancel`);
    } else if (activeCraft) {
      const pct = Math.min(100, Math.round((activeCraft.elapsed / activeCraft.duration) * 100));
      const boostTag =
        (ctx.player.craftSpeedMultiplier || 1) > 1.05 ? ' (+35% Smuff Boost!)' : '';
      setPromptIfChanged(`Crafting ${activeCraft.recipe.name}... ${pct}%${boostTag}`);
    } else {
      const ctxAction = getBestContextAction();
      setPromptIfChanged(ctxAction ? ctxAction.prompt : null);
    }

    // 6. Periodically sync HUD while stamina changes
    hudSyncTimer += safeDt;
    if (Math.abs(ctx.player.stamina - prevStamina) > 0.01 && hudSyncTimer >= 0.08) {
      hudSyncTimer = 0;
      ctx.updateHud?.();
    }
  }

  return {
    update,
    selectSlot,
    startBlueprint,
    cancelBlueprint,
    craftRecipe,
    getBlueprints,
    getRecipes,
    interact,
    isPlacingBlueprint: () => activeBlueprint !== null,
  };
}
