import * as THREE from 'three';

const TIER_NAMES = {
  1: 'Starter',
  2: 'Jungle Stealth',
  3: 'Smuff Tech',
};

const SWEEP_INITIAL_DELAY = 60.0;
const SWEEP_INTERVAL = 75.0;
const SWEEP_WARNING_LEAD = 10.0;
const SWEEP_RAID_TIMEOUT = 55.0;
const RAIDER_MAX_HP = 80;
const RAIDER_MARCH_SPEED = 2.15;

const SPIKE_TRIGGER_RADIUS = 1.4;
const SPIKE_DAMAGE = 18;
const SPIKE_HIT_COOLDOWN = 0.9;

const SNARE_TRIGGER_RADIUS = 1.4;
const SNARE_DAMAGE = 22;
const SNARE_ROOT_DURATION = 4.0;
const SNARE_REARM_TIME = 12.0;

const TURRET_RANGE = 9.5;
const TURRET_DAMAGE = 22;
const TURRET_FIRE_INTERVAL = 1.4;

const EMP_TARGET_RANGE = 9.0;
const EMP_BLAST_RADIUS = 4.2;
const EMP_JAMMER_DAMAGE = 55;
const EMP_AGENT_DAMAGE = 40;
const EMP_AGENT_STUN_SEC = 4.0;
const EMP_VANCE_DAMAGE = 45;

const BLOWPIPE_RANGE = 8.5;
const BLOWPIPE_DAMAGE = 24;
const BLOWPIPE_SLEEP_SEC = 3.5;

const SMOOTHIE_HEAL_HP = 65;
const SMOOTHIE_HEAL_STAMINA = 60;

const CAMO_DETECTION_FACTOR = 0.3;
const CAMO_MIN_DETECTION_MULT = 0.2;

const TIERED_RECIPES = [
  // Tier 1 — Starter (Always Unlocked)
  {
    id: 'flimsy_axe',
    name: 'Flimsy Axe',
    tier: 1,
    description: 'Chops trees fast and doubles as a reliable jungle melee tool.',
    craftTime: 1.4,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'stone', name: 'Stone', count: 1 },
    ],
    output: { id: 'axe', name: 'Flimsy Axe', count: 1, type: 'tool' },
  },
  {
    id: 'pickaxe',
    name: 'Stone Pickaxe',
    tier: 1,
    description: 'Heavy mining pickaxe dealing bonus damage to boulders & FBI Signal Jammers.',
    craftTime: 1.6,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'stone', name: 'Stone', count: 2 },
    ],
    output: { id: 'pickaxe', name: 'Stone Pickaxe', count: 1, type: 'tool' },
  },
  {
    id: 'wooden_club',
    name: 'Wooden Club',
    tier: 1,
    description: 'Heavy hardwood club delivering high-impact melee strikes that stun FBI agents.',
    craftTime: 1.6,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 3 },
      { id: 'fiber', name: 'Fiber', count: 1 },
    ],
    output: { id: 'wooden_club', name: 'Wooden Club', count: 1, type: 'weapon' },
  },

  // Tier 2 — Jungle Stealth (Always Unlocked)
  {
    id: 'stone_spear',
    name: 'Stone Spear',
    tier: 2,
    description: 'Extended-reach flint spear for thrusting at FBI patrols from safer distance.',
    craftTime: 1.8,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'stone', name: 'Stone', count: 2 },
      { id: 'fiber', name: 'Fiber', count: 2 },
    ],
    output: { id: 'stone_spear', name: 'Stone Spear', count: 1, type: 'weapon' },
  },
  {
    id: 'blowpipe',
    name: 'Sleep-Dart Blowpipe',
    tier: 2,
    description: 'Use [U / Right-Click] to fire berry-tipped sleep darts (8.5u) that damage & daze FBI agents.',
    craftTime: 2.0,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'fiber', name: 'Fiber', count: 3 },
      { id: 'berries', name: 'Jungle Berries', count: 2 },
    ],
    output: { id: 'blowpipe', name: 'Sleep-Dart Blowpipe', count: 1, type: 'ranged' },
  },
  {
    id: 'camo_bush',
    name: 'Camo Bush Disguise',
    tier: 2,
    description: 'Use [U / Right-Click] to toggle a 3D leafy bush disguise that slashes FBI vision range.',
    craftTime: 1.8,
    requiresSmuff: false,
    ingredients: [
      { id: 'fiber', name: 'Fiber', count: 4 },
      { id: 'wood', name: 'Wood', count: 1 },
    ],
    output: { id: 'camo_bush', name: 'Camo Bush Disguise', count: 1, type: 'gadget' },
  },

  // Tier 3 — Smuff Tech (Locked until ctx.fbi.smuff.rescued === true)
  {
    id: 'emp_grenade',
    name: 'EMP Jammer Grenade',
    tier: 3,
    description: 'Arcing cyan EMP orb! Deals 55 dmg to Signal Jammers and stuns FBI agents / Vance (4s).',
    craftTime: 2.2,
    requiresSmuff: true,
    ingredients: [
      { id: 'stone', name: 'Stone', count: 3 },
      { id: 'fiber', name: 'Fiber', count: 2 },
      { id: 'berries', name: 'Jungle Berries', count: 1 },
    ],
    output: { id: 'emp_grenade', name: 'EMP Jammer Grenade', count: 1, type: 'gadget' },
  },
  {
    id: 'banana_smoothie',
    name: 'Healing Banana Smoothie',
    tier: 3,
    description: 'Tropical Smuff-blend tonic! Restores +65 HP & +60 Stamina with healing sparkles.',
    craftTime: 1.5,
    requiresSmuff: true,
    ingredients: [
      { id: 'berries', name: 'Jungle Berries', count: 3 },
      { id: 'fish', name: 'Raw Fish', count: 1 },
    ],
    output: { id: 'banana_smoothie', name: 'Healing Banana Smoothie', count: 1, type: 'food' },
  },
];

const TIERED_BLUEPRINTS = [
  // Tier 1 — Starter
  {
    id: 'campfire',
    name: 'Campfire',
    tier: 1,
    description: 'Warm flickering firelight & Respawn Checkpoint.',
    buildTime: 1.4,
    radius: 0.65,
    isRespawnPoint: true,
    blocksMovement: true,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 3 },
      { id: 'stone', name: 'Stone', count: 2 },
    ],
  },
  {
    id: 'bed',
    name: 'Leaf Bed',
    tier: 1,
    description: 'Woven tropical palm-leaf bed & Respawn Checkpoint.',
    buildTime: 1.6,
    radius: 0.72,
    isRespawnPoint: true,
    blocksMovement: true,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 4 },
      { id: 'fiber', name: 'Fiber', count: 3 },
    ],
  },
  {
    id: 'spike_wall',
    name: 'Wooden Spike Wall',
    tier: 1,
    description: 'Sharpened jungle barricade! Damages FBI raiders & agents within 1.4u.',
    buildTime: 1.3,
    radius: 0.58,
    isRespawnPoint: false,
    blocksMovement: true,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 3 },
      { id: 'stone', name: 'Stone', count: 1 },
    ],
  },
  {
    id: 'workbench',
    name: 'Crafting Workbench',
    tier: 1,
    description: 'Sturdy island crafting table for tools, traps, and camp upgrades.',
    buildTime: 2.0,
    radius: 0.7,
    isRespawnPoint: false,
    blocksMovement: true,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 5 },
      { id: 'stone', name: 'Stone', count: 3 },
    ],
  },

  // Tier 2 — Jungle Stealth
  {
    id: 'snare_trap',
    name: 'Tripwire Snare Trap',
    tier: 2,
    description: 'Snaps shut on FBI agents within 1.4u — deals 22 dmg & roots them for 4s!',
    buildTime: 1.2,
    radius: 0.48,
    isRespawnPoint: false,
    blocksMovement: false,
    requiresSmuff: false,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 2 },
      { id: 'fiber', name: 'Fiber', count: 3 },
    ],
  },

  // Tier 3 — Smuff Tech
  {
    id: 'coconut_turret',
    name: 'Auto-Turret Coconut Launcher',
    tier: 3,
    description: 'Bamboo/stone auto-turret firing flying coconuts every 1.4s at FBI/Vance within 9.5u (22 dmg).',
    buildTime: 2.2,
    radius: 0.65,
    isRespawnPoint: false,
    blocksMovement: true,
    requiresSmuff: true,
    ingredients: [
      { id: 'wood', name: 'Wood', count: 4 },
      { id: 'stone', name: 'Stone', count: 3 },
      { id: 'fiber', name: 'Fiber', count: 2 },
    ],
  },
  {
    id: 'reinforced_wall',
    name: 'Reinforced Stone Wall',
    tier: 3,
    description: 'Fortified ancient temple wall with high durability blocking FBI raids & sightlines.',
    buildTime: 1.8,
    radius: 0.62,
    isRespawnPoint: false,
    blocksMovement: true,
    requiresSmuff: true,
    ingredients: [
      { id: 'stone', name: 'Stone', count: 4 },
      { id: 'wood', name: 'Wood', count: 2 },
    ],
  },
];

const DOS_CAMO_HOOKED = Symbol('dosCamoDetectionHooked');

function createTwoStepGradient() {
  const data = new Uint8Array([115, 255]);
  const texture = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function makeCostMap(ingredients) {
  const map = {};
  for (const ing of ingredients) {
    map[ing.id] = ing.count;
  }
  return map;
}

function distXZ(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function angleDiff(from, to) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function isEditableTarget(target) {
  if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
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

function disposeObjectTree(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child.isMesh || child.isLine) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        for (const m of child.material) m?.dispose?.();
      } else {
        child.material?.dispose?.();
      }
    }
  });
}

function resolveItemId(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.toLowerCase();
  return String(item.id || '').toLowerCase();
}

export function createExpandedCraftingSystem(ctx) {
  // Ensure required shared arrays/fields exist cleanly on ctx
  if (!Array.isArray(ctx.buildings)) ctx.buildings = [];
  if (!Array.isArray(ctx.traps)) ctx.traps = [];
  if (!Array.isArray(ctx.turrets)) ctx.turrets = [];
  if (!Array.isArray(ctx.jammers)) ctx.jammers = [];
  if (!Array.isArray(ctx.harvestables)) ctx.harvestables = [];
  if (ctx.player && typeof ctx.player.camoActive !== 'boolean') {
    ctx.player.camoActive = false;
  }

  const gradientMap = createTwoStepGradient();
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x16191d,
    side: THREE.BackSide,
  });
  outlineMat.name = 'outline_ink';

  function toonMat(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  }

  function addOutlineShell(parent, mesh, inflate = 1.08) {
    const shell = new THREE.Mesh(mesh.geometry, outlineMat);
    shell.position.copy(mesh.position);
    shell.rotation.copy(mesh.rotation);
    shell.scale.copy(mesh.scale).multiplyScalar(inflate);
    shell.userData.noShadow = true;
    parent.add(shell);
    return shell;
  }

  // Reusable math / raycast state
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerNdc = new THREE.Vector2(0, 0);
  const rayHit = new THREE.Vector3();
  let hasPointerNdc = false;

  // Counters & state
  let elapsed = 0;
  let nextStructureSeq = 1;
  let nextRaiderSeq = 1;
  let activeBlueprint = null;
  let lastPromptOwned = false;

  // Item cooldowns & passive tool bonus trackers
  let blowpipeCooldown = 0;
  let empCooldown = 0;
  let camoToggleCooldown = 0;
  let camoGraceTimer = 0;
  let smoothieCooldown = 0;
  let spearCooldown = 0;
  let clubCooldown = 0;

  let prevPlayerX = ctx.player?.pos?.x ?? 0;
  let prevPlayerZ = ctx.player?.pos?.z ?? 0;

  const harvestPrevHp = new WeakMap();
  const agentPrevHp = new WeakMap();

  // Active combat / VFX / crowd-control pools
  const buildPopAnims = [];
  const particles = [];
  const shockwaves = [];
  const empProjectiles = [];
  const dartProjectiles = [];
  const coconutProjectiles = [];
  const agentCC = new Map(); // agentId -> { agent, mode: 'root'|'stun'|'sleep', timer, anchorX, anchorZ, vfxGroup }
  const defeatedRaiders = []; // { agent, cleanupTimer }

  // Periodic FBI Island Sweep raid state
  let sweepCountdown = SWEEP_INITIAL_DELAY;
  let warningTriggered = false;
  let sweepActive = false;
  let sweepElapsed = 0;
  let sweepWaveNum = 0;
  const activeRaiders = [];

  // --- Shared Helpers ---

  function isSmuffRescued() {
    return Boolean(ctx.fbi?.smuff?.rescued);
  }

  function getSpeedMultiplier() {
    return Math.max(0.5, Number(ctx.player?.craftSpeedMultiplier) || 1.0);
  }

  function getBounds() {
    const b = ctx.worldBounds || { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
    return {
      minX: (b.minX ?? -28) + 0.65,
      maxX: (b.maxX ?? 28) - 0.65,
      minZ: (b.minZ ?? -28) + 0.65,
      maxZ: (b.maxZ ?? 28) - 0.65,
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
      if ((ctx.player?.countItem?.(ing.id) || 0) < ing.count) return false;
    }
    return true;
  }

  function formatMissingIngredients(ingredients) {
    const missing = [];
    for (const ing of ingredients) {
      const have = ctx.player?.countItem?.(ing.id) || 0;
      if (have < ing.count) {
        missing.push(`${ing.name} (${have}/${ing.count})`);
      }
    }
    return missing.join(', ');
  }

  function getSelectedItem() {
    const inv = ctx.player?.inventory;
    if (!Array.isArray(inv)) return null;
    return inv[ctx.player.selectedSlot ?? 0] || null;
  }

  function getActiveAgents() {
    return (ctx.fbi?.agents || []).filter(
      (a) => a && a.state !== 'ko' && a.pos && (typeof a.hp !== 'number' || a.hp > 0)
    );
  }

  function findNearestActiveAgent(originX, originZ, maxRange) {
    let best = null;
    let bestDist = maxRange;
    for (const agent of getActiveAgents()) {
      const d = distXZ(originX, originZ, agent.pos.x, agent.pos.z);
      if (d <= bestDist) {
        bestDist = d;
        best = agent;
      }
    }
    return best;
  }

  function dealDamageToAgent(agent, amount, sourcePos) {
    if (!agent || amount <= 0) return false;
    const isVance = agent.id === 'director_vance' || Boolean(agent.isBoss);

    if (isVance && typeof ctx.systems?.boss?.damageVance === 'function') {
      ctx.systems.boss.damageVance(amount, sourcePos);
      return true;
    }

    if (typeof ctx.systems?.fbi?.damageAgent === 'function') {
      return Boolean(ctx.systems.fbi.damageAgent(agent.id, amount, sourcePos));
    }

    // Fallback for standalone unit tests without fbi_ai mounted
    if (typeof agent.hp === 'number') {
      agent.hp = Math.max(0, agent.hp - amount);
      if (agent.hp <= 0) {
        agent.state = 'ko';
      }
      return true;
    }
    return false;
  }

  function dealDamageToJammer(jammer, amount) {
    if (!jammer || jammer.destroyed || jammer.depleted || amount <= 0) return false;

    if (typeof ctx.systems?.boss?.damageJammer === 'function') {
      ctx.systems.boss.damageJammer(jammer.id, amount);
    } else {
      jammer.hp = Math.max(0, (jammer.hp ?? 90) - amount);
      if (jammer.hp <= 0) {
        jammer.depleted = true;
        jammer.destroyed = true;
      }
    }

    // Sync any separate mirror entry inside ctx.harvestables
    for (const h of ctx.harvestables || []) {
      if (h && h !== jammer && h.id === jammer.id) {
        h.hp = jammer.hp;
        if ((jammer.hp ?? 0) <= 0) {
          h.depleted = true;
        }
      }
    }
    return true;
  }

  // --- Transparent Detection Multiplier Hook for Camo Bush ---

  function ensureDosDetectionHook() {
    const dos = ctx.companions?.dos;
    if (!dos || dos[DOS_CAMO_HOOKED]) return;

    let baseMult = typeof dos.detectionMultiplier === 'number' ? dos.detectionMultiplier : 1.0;
    try {
      Object.defineProperty(dos, 'detectionMultiplier', {
        configurable: true,
        enumerable: true,
        get() {
          if (ctx.player?.camoActive && !ctx.player?.isDead) {
            return Math.max(CAMO_MIN_DETECTION_MULT, baseMult * CAMO_DETECTION_FACTOR);
          }
          return baseMult;
        },
        set(val) {
          if (Number.isFinite(val)) {
            baseMult = val;
          }
        },
      });
      dos[DOS_CAMO_HOOKED] = true;
    } catch {
      // Fallback if object is frozen in a synthetic test
    }
  }
  ensureDosDetectionHook();

  // --- VFX Helpers ---

  function spawnSparkBurst(x, y, z, color = 0xffe066, count = 8, options = {}) {
    if (!ctx.scene) return;
    const size = options.size ?? 0.11;
    const upward = options.upward ?? 2.3;
    const spread = options.spread ?? 2.2;
    const gravity = options.gravity ?? 7.5;
    const duration = options.duration ?? 0.55;
    const shape = options.shape ?? 'box';

    const geo =
      shape === 'octa'
        ? new THREE.OctahedronGeometry(size, 0)
        : shape === 'sphere'
        ? new THREE.SphereGeometry(size, 7, 7)
        : new THREE.BoxGeometry(size, size, size);

    for (let i = 0; i < count; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const spd = (0.45 + Math.random() * 0.75) * spread;
      mesh.position.set(
        x + Math.cos(angle) * 0.18,
        y + Math.random() * 0.3,
        z + Math.sin(angle) * 0.18
      );
      ctx.scene.add(mesh);
      particles.push({
        mesh,
        geo,
        mat,
        vx: Math.cos(angle) * spd,
        vy: upward * (0.65 + Math.random() * 0.6),
        vz: Math.sin(angle) * spd,
        gravity,
        age: 0,
        duration: duration * (0.8 + Math.random() * 0.4),
      });
    }
  }

  function spawnShockwaveRing(x, z, color = 0x22d3ee, maxScale = 4.2, duration = 0.55, withDome = false) {
    if (!ctx.scene) return;
    const group = new THREE.Group();
    group.position.set(x, 0.08, z);

    const ringGeo = new THREE.RingGeometry(0.45, 0.72, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.renderOrder = 4;
    group.add(ringMesh);

    const innerGeo = new THREE.RingGeometry(0.18, 0.34, 24);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xe0faff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.y = 0.015;
    innerMesh.renderOrder = 4;
    group.add(innerMesh);

    let domeMat = null;
    let domeMesh = null;
    let flashLight = null;
    if (withDome) {
      const domeGeo = new THREE.SphereGeometry(0.65, 16, 12);
      domeMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.position.y = 0.35;
      group.add(domeMesh);

      flashLight = new THREE.PointLight(color, 4.5, maxScale * 2.5, 1.5);
      flashLight.position.y = 1.1;
      group.add(flashLight);
    }

    ctx.scene.add(group);
    shockwaves.push({
      group,
      ringMat,
      innerMat,
      domeMat,
      domeMesh,
      flashLight,
      maxScale,
      age: 0,
      duration,
    });
  }

  // --- 3D Cel-Shaded Camo Bush Disguise Mesh (attached to Boots) ---

  function createCamoBushDisguiseMesh() {
    const group = new THREE.Group();
    group.name = 'Boots_Camo_Bush_Disguise';
    group.visible = false;

    const leafDark = toonMat(0x287a35);
    const leafMid = toonMat(0x3ea342);
    const leafBright = toonMat(0x6bd04b);
    const berryMat = toonMat(0xe64980);

    const puffs = [
      { pos: [0, 0.52, 0], r: 0.56, scale: [1.18, 0.92, 1.14], mat: leafDark },
      { pos: [-0.36, 0.44, 0.22], r: 0.34, scale: [1.05, 0.92, 1.0], mat: leafMid },
      { pos: [0.36, 0.46, 0.2], r: 0.35, scale: [1.0, 0.94, 1.05], mat: leafMid },
      { pos: [0.0, 0.46, -0.36], r: 0.38, scale: [1.1, 0.9, 0.96], mat: leafDark },
      { pos: [-0.28, 0.68, -0.14], r: 0.32, scale: [1.0, 0.88, 1.0], mat: leafBright },
      { pos: [0.24, 0.72, 0.08], r: 0.3, scale: [1.0, 0.86, 1.0], mat: leafBright },
      { pos: [0.0, 0.86, -0.02], r: 0.28, scale: [1.08, 0.78, 1.05], mat: leafBright },
    ];

    for (const p of puffs) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 0), p.mat);
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      m.scale.set(p.scale[0], p.scale[1], p.scale[2]);
      group.add(m);
      addOutlineShell(group, m, 1.07);
    }

    // Little decorative tropical berries on the camouflage bush
    const berryGeo = new THREE.SphereGeometry(0.065, 7, 7);
    for (const [bx, by, bz] of [
      [0.34, 0.66, 0.38],
      [-0.32, 0.58, 0.4],
      [0.14, 0.96, 0.16],
    ]) {
      const b = new THREE.Mesh(berryGeo, berryMat);
      b.position.set(bx, by, bz);
      group.add(b);
    }

    // Subtle ground stealth ring under the bush
    const stealthRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.8, 24),
      new THREE.MeshBasicMaterial({
        color: 0x51cf66,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    stealthRing.rotation.x = -Math.PI / 2;
    stealthRing.position.y = 0.04;
    stealthRing.userData.noShadow = true;
    group.add(stealthRing);
    group.userData.stealthRing = stealthRing;

    enableShadows(group);
    return group;
  }

  const camoBushMesh = createCamoBushDisguiseMesh();
  if (ctx.player?.group) {
    ctx.player.group.add(camoBushMesh);
  }

  function setCamoState(active, reason = 'toggle') {
    const next = Boolean(active);
    ensureDosDetectionHook();

    if (ctx.player) {
      ctx.player.camoActive = next;
      ctx.player.camoStealthFactor = next ? CAMO_DETECTION_FACTOR : 1.0;
    }

    // Ensure mesh is parented to Boots if player.group became ready later
    if (ctx.player?.group && camoBushMesh.parent !== ctx.player.group) {
      ctx.player.group.add(camoBushMesh);
    }
    camoBushMesh.visible = next;

    const px = ctx.player?.pos?.x ?? 0;
    const pz = ctx.player?.pos?.z ?? 0;
    spawnSparkBurst(px, 0.65, pz, next ? 0x51cf66 : 0x74c64b, 8, {
      size: 0.1,
      upward: 1.8,
      spread: 2.0,
    });

    if (next) {
      camoGraceTimer = 0.3;
      ctx.systems?.audio?.playSfx?.('chop');
      ctx.toast?.('Camo Bush Disguise ON — FBI detection radius slashed!', 'success');
    } else if (reason === 'break') {
      ctx.toast?.('Camo Bush dropped — sprinting or attacking broke your cover!', 'warn');
    } else if (reason === 'toggle') {
      ctx.systems?.audio?.playSfx?.('chop');
      ctx.toast?.('Camo Bush Disguise removed.', 'info');
    }

    ctx.updateHud?.();
  }

  // --- 3D Cel-Shaded Blueprint Mesh Builders ---

  function createCampfireMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Campfire';

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.62, 0.08, 12),
      toonMat(0x2f2925)
    );
    base.position.y = 0.04;
    group.add(base);

    const stoneGeo = new THREE.DodecahedronGeometry(0.17, 0);
    const stoneMat = toonMat(0x7c858e);
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(a) * 0.46, 0.13, Math.sin(a) * 0.46);
      stone.scale.set(1.1, 0.72, 0.95);
      stone.rotation.set(i * 0.4, a, i * 0.3);
      group.add(stone);
      if (!isGhost) addOutlineShell(group, stone, 1.1);
    }

    const logGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.68, 7);
    const logMat = toonMat(0x6b4226);
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.y = 0.18;
      log.rotation.z = Math.PI / 2 - 0.3;
      log.rotation.y = (i / 3) * Math.PI;
      group.add(log);
    }

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

  function createBedMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Bed';

    const woodMat = toonMat(0x7c4d2b);
    const darkWoodMat = toonMat(0x52311a);
    const leafMat = toonMat(0x49a644);
    const leafHiMat = toonMat(0x74c64b);
    const pillowMat = toonMat(0xf1e5c8);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 1.52), woodMat);
    frame.position.y = 0.24;
    group.add(frame);
    if (!isGhost) addOutlineShell(group, frame, 1.05);

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

    const matBase = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 1.38), leafMat);
    matBase.position.y = 0.35;
    group.add(matBase);

    for (let i = 0; i < 4; i += 1) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.32), leafHiMat);
      frond.position.set(i % 2 === 0 ? -0.04 : 0.04, 0.42, -0.42 + i * 0.3);
      frond.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.12;
      group.add(frond);
    }

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.32), pillowMat);
    pillow.position.set(0, 0.46, -0.48);
    pillow.rotation.x = 0.12;
    group.add(pillow);
    if (!isGhost) addOutlineShell(group, pillow, 1.07);

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createSpikeWallMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Spike_Wall';

    const stoneMat = toonMat(0x707b84);
    const woodMat = toonMat(0x82512b);
    const darkWoodMat = toonMat(0x52311a);
    const spikeTipMat = toonMat(0xe8d5b5);
    const warnMat = toonMat(0xd9483b);

    // Stone footing
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.32, 0.56), stoneMat);
    base.position.y = 0.16;
    group.add(base);
    if (!isGhost) addOutlineShell(group, base, 1.06);

    // Upright sharpened palisade posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.095, 1.18, 7);
    const tipGeo = new THREE.ConeGeometry(0.082, 0.3, 7);
    for (let i = -2; i <= 2; i += 1) {
      const x = i * 0.21;
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(x, 0.72, 0);
      group.add(post);
      if (!isGhost) addOutlineShell(group, post, 1.08);

      const tip = new THREE.Mesh(tipGeo, spikeTipMat);
      tip.position.set(x, 1.46, 0);
      group.add(tip);
    }

    // Horizontal cross-beam with red danger stripe
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, 0.24), darkWoodMat);
    beam.position.set(0, 0.62, 0);
    group.add(beam);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.05, 0.26), warnMat);
    stripe.position.set(0, 0.62, 0);
    group.add(stripe);

    // Forward & backward angled defensive spikes (damages approaching FBI raiders)
    const spearGeo = new THREE.ConeGeometry(0.068, 0.58, 6);
    for (const dir of [-1, 1]) {
      for (let i = -1; i <= 1; i += 1) {
        const spike = new THREE.Mesh(spearGeo, spikeTipMat);
        spike.position.set(i * 0.3, 0.54, dir * 0.34);
        spike.rotation.x = dir * (Math.PI * 0.34);
        group.add(spike);
        if (!isGhost) addOutlineShell(group, spike, 1.09);
      }
    }

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createWorkbenchMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Workbench';

    const topMat = toonMat(0xa16938);
    const legMat = toonMat(0x633b1d);
    const metalMat = toonMat(0x8896a3);
    const paperMat = toonMat(0x3b82f6);

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.14, 0.86), topMat);
    top.position.y = 0.78;
    group.add(top);
    if (!isGhost) addOutlineShell(group, top, 1.05);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 0.68), legMat);
    shelf.position.y = 0.28;
    group.add(shelf);

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

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.32), paperMat);
    sheet.position.set(-0.22, 0.86, 0.04);
    sheet.rotation.y = 0.18;
    group.add(sheet);

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

  function createSnareTrapMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Snare_Trap';

    const woodMat = toonMat(0x7c4d2b);
    const ropeMat = toonMat(0xdcb464);
    const leafMat = toonMat(0x49a644);
    const triggerMat = toonMat(0xff922b, { emissive: 0xff7b00, emissiveIntensity: 0.35 });

    // Coiled rope snare ring on ground
    const snareLoop = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 7, 18), ropeMat);
    snareLoop.rotation.x = Math.PI / 2;
    snareLoop.position.y = 0.055;
    group.add(snareLoop);
    if (!isGhost) addOutlineShell(group, snareLoop, 1.12);

    // 2 tension stakes + tripwire rope across center
    const stakeGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.42, 6);
    for (const sx of [-0.52, 0.52]) {
      const stake = new THREE.Mesh(stakeGeo, woodMat);
      stake.position.set(sx, 0.2, 0);
      stake.rotation.z = sx < 0 ? 0.22 : -0.22;
      group.add(stake);
      if (!isGhost) addOutlineShell(group, stake, 1.12);
    }

    const tripwire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 1.04, 6),
      triggerMat
    );
    tripwire.rotation.z = Math.PI / 2;
    tripwire.position.y = 0.24;
    group.add(tripwire);

    // Camouflage leaves hiding center trigger plate
    const leafGeo = new THREE.BoxGeometry(0.28, 0.04, 0.16);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(a) * 0.24, 0.035, Math.sin(a) * 0.24);
      leaf.rotation.y = a;
      group.add(leaf);
    }

    // Center bait / pressure peg
    const peg = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), triggerMat);
    peg.position.y = 0.09;
    group.add(peg);

    group.userData.snareLoop = snareLoop;
    group.userData.tripwire = tripwire;
    group.userData.peg = peg;

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createCoconutTurretMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Coconut_Turret';

    const stoneMat = toonMat(0x7c868f);
    const mossMat = toonMat(0x4c9440);
    const bambooMat = toonMat(0xc5a858);
    const bambooDark = toonMat(0x8c7132);
    const ropeMat = toonMat(0x754a24);
    const cocoMat = toonMat(0x61381c);
    const techMat = toonMat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 0.75 });

    // Heavy stone pedestal base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 0.56, 8), stoneMat);
    base.position.y = 0.28;
    group.add(base);
    if (!isGhost) addOutlineShell(group, base, 1.07);

    const mossRing = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.52, 0.1, 8), mossMat);
    mossRing.position.y = 0.54;
    group.add(mossRing);

    // Rotating upper turret head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62, 0);
    group.add(headGroup);

    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.22, 8), bambooDark);
    pivot.position.y = 0.11;
    headGroup.add(pivot);

    // Bamboo A-frame side struts
    for (const sx of [-0.22, 0.22]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.16), bambooMat);
      strut.position.set(sx, 0.34, -0.02);
      headGroup.add(strut);
    }

    // Recoiling launcher barrel sub-group
    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.48, 0);
    headGroup.add(barrelGroup);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.17, 0.96, 9), bambooMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.24;
    barrelGroup.add(barrel);
    if (!isGhost) addOutlineShell(barrelGroup, barrel, 1.09);

    // Rope bands around bamboo tube
    for (const bz of [-0.08, 0.28, 0.58]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.06, 9), ropeMat);
      band.rotation.x = Math.PI / 2;
      band.position.z = bz;
      barrelGroup.add(band);
    }

    // Glowing cyan Smuff-Tech targeting lens mounted on top
    const sensorMount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), bambooDark);
    sensorMount.position.set(0, 0.2, 0.14);
    barrelGroup.add(sensorMount);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), techMat);
    lens.position.set(0, 0.21, 0.24);
    lens.userData.noShadow = true;
    barrelGroup.add(lens);

    // Side coconut ammo hopper (3 coconuts!)
    const ammoGeo = new THREE.SphereGeometry(0.105, 8, 8);
    for (const [cx, cy, cz] of [
      [-0.25, 0.56, -0.18],
      [-0.25, 0.56, -0.01],
      [-0.25, 0.72, -0.1],
    ]) {
      const coco = new THREE.Mesh(ammoGeo, cocoMat);
      coco.position.set(cx, cy, cz);
      headGroup.add(coco);
    }

    let light = null;
    if (!isGhost) {
      light = new THREE.PointLight(0x22d3ee, 1.3, 4.5, 1.6);
      light.position.set(0, 1.25, 0);
      group.add(light);
    }

    group.userData.headGroup = headGroup;
    group.userData.barrelGroup = barrelGroup;
    group.userData.lens = lens;

    enableShadows(group);
    return { mesh: group, light, headGroup, barrelGroup };
  }

  function createReinforcedWallMesh(isGhost) {
    const group = new THREE.Group();
    group.name = 'Building_Reinforced_Wall';

    const stoneMat = toonMat(0x88939e);
    const darkStoneMat = toonMat(0x525d68);
    const goldMat = toonMat(0xe5b842);
    const mossMat = toonMat(0x4c9142);

    // Thick fortified stone body
    const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.36, 0.62), stoneMat);
    mainBlock.position.y = 0.68;
    group.add(mainBlock);
    if (!isGhost) addOutlineShell(group, mainBlock, 1.05);

    // Heavy stepped plinth base
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.28, 0.72), darkStoneMat);
    plinth.position.y = 0.14;
    group.add(plinth);

    // Top battlements (3 merlons)
    for (const mx of [-0.36, 0, 0.36]) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.64), darkStoneMat);
      merlon.position.set(mx, 1.48, 0);
      group.add(merlon);
      if (!isGhost) addOutlineShell(group, merlon, 1.07);
    }

    // Iron/Gold Smuff-Tech reinforcement brackets & temple emblem
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.66), darkStoneMat);
    band.position.y = 0.92;
    group.add(band);

    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), goldMat);
    emblem.position.set(0, 0.92, 0.34);
    emblem.scale.set(1, 1, 0.35);
    group.add(emblem);

    const emblemBack = emblem.clone();
    emblemBack.position.z = -0.34;
    group.add(emblemBack);

    // Subtle temple moss accents
    const moss = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.12), mossMat);
    moss.position.set(-0.32, 1.24, 0.31);
    group.add(moss);

    enableShadows(group);
    return { mesh: group, light: null };
  }

  function createBlueprintMesh(type, isGhost = false) {
    if (type === 'campfire') return createCampfireMesh(isGhost);
    if (type === 'bed') return createBedMesh(isGhost);
    if (type === 'spike_wall') return createSpikeWallMesh(isGhost);
    if (type === 'workbench') return createWorkbenchMesh(isGhost);
    if (type === 'snare_trap') return createSnareTrapMesh(isGhost);
    if (type === 'coconut_turret') return createCoconutTurretMesh(isGhost);
    if (type === 'reinforced_wall') return createReinforcedWallMesh(isGhost);
    return createCampfireMesh(isGhost);
  }

  // --- Tiered Recipes & Crafting API ---

  function getTieredRecipes() {
    const speedMult = getSpeedMultiplier();
    const smuffUnlocked = isSmuffRescued();
    return TIERED_RECIPES.map((r) => {
      const unlocked = !r.requiresSmuff || smuffUnlocked;
      const hasMaterials = hasIngredients(r.ingredients);
      return {
        id: r.id,
        name: r.name,
        tier: r.tier,
        tierName: TIER_NAMES[r.tier] || 'Starter',
        description: r.description,
        craftTime: r.craftTime,
        effectiveTime: Number((r.craftTime / speedMult).toFixed(2)),
        requiresSmuff: Boolean(r.requiresSmuff),
        requiresWorkbench: false,
        workbenchReady: true,
        unlocked,
        locked: !unlocked,
        ingredients: r.ingredients.map((ing) => ({
          ...ing,
          have: ctx.player?.countItem?.(ing.id) || 0,
        })),
        cost: makeCostMap(r.ingredients),
        output: { ...r.output },
        canAfford: hasMaterials,
        hasMaterials,
        canCraft: unlocked && hasMaterials,
      };
    });
  }

  function getTieredBlueprints() {
    const speedMult = getSpeedMultiplier();
    const smuffUnlocked = isSmuffRescued();
    return TIERED_BLUEPRINTS.map((bp) => {
      const unlocked = !bp.requiresSmuff || smuffUnlocked;
      const hasMaterials = hasIngredients(bp.ingredients);
      return {
        id: bp.id,
        name: bp.name,
        tier: bp.tier,
        tierName: TIER_NAMES[bp.tier] || 'Starter',
        description: bp.description,
        buildTime: bp.buildTime,
        effectiveTime: Number((bp.buildTime / speedMult).toFixed(2)),
        radius: bp.radius,
        isRespawnPoint: Boolean(bp.isRespawnPoint),
        requiresSmuff: Boolean(bp.requiresSmuff),
        unlocked,
        locked: !unlocked,
        ingredients: bp.ingredients.map((ing) => ({
          ...ing,
          have: ctx.player?.countItem?.(ing.id) || 0,
        })),
        cost: makeCostMap(bp.ingredients),
        canAfford: hasMaterials,
        hasMaterials,
        canCraft: unlocked && hasMaterials,
      };
    });
  }

  function craftItem(recipeId) {
    if (ctx.player?.isDead) return false;
    const recipe = TIERED_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      // Fallback gracefully to legacy Phase 2 player recipes if requested
      if (typeof ctx.systems?.player?.craftRecipe === 'function') {
        return Boolean(ctx.systems.player.craftRecipe(recipeId));
      }
      ctx.toast?.(`Unknown recipe: ${recipeId}`, 'warn');
      return false;
    }

    if (recipe.requiresSmuff && !isSmuffRescued()) {
      ctx.toast?.('Locked! Rescue Smuff at the West FBI Camp to unlock Tier 3 Smuff Tech!', 'warn');
      return false;
    }

    if (!hasIngredients(recipe.ingredients)) {
      ctx.toast?.(`Missing materials: ${formatMissingIngredients(recipe.ingredients)}`, 'warn');
      return false;
    }

    // Deduct materials
    const deducted = [];
    for (const ing of recipe.ingredients) {
      const ok = ctx.player?.removeItem?.(ing.id, ing.count);
      if (ok === false) {
        for (const prev of deducted) {
          ctx.player?.addItem?.({ id: prev.id, name: prev.name, count: prev.count, type: 'resource' });
        }
        ctx.toast?.(`Missing materials: ${formatMissingIngredients(recipe.ingredients)}`, 'warn');
        return false;
      }
      deducted.push(ing);
    }

    const added = ctx.player?.addItem?.({ ...recipe.output });
    if (added === false) {
      // Refund if hotbar is completely full
      for (const prev of deducted) {
        ctx.player?.addItem?.({ id: prev.id, name: prev.name, count: prev.count, type: 'resource' });
      }
      ctx.toast?.(`Hotbar full! Make room before crafting ${recipe.name}.`, 'warn');
      return false;
    }

    const speedMult = getSpeedMultiplier();
    const px = ctx.player?.pos?.x ?? 0;
    const pz = ctx.player?.pos?.z ?? 0;

    ctx.models?.tarcy?.play?.('Craft', 0.1);
    if (isSmuffRescued()) {
      ctx.models?.smuff?.play?.('Ability_Cast', 0.12);
    }
    ctx.systems?.audio?.playSfx?.('craft');
    spawnSparkBurst(px, 0.95, pz, recipe.tier === 3 ? 0x22d3ee : 0xffe066, 9, {
      shape: 'octa',
      upward: 2.4,
    });

    const boostTag = speedMult > 1.05 ? ` (+${Math.round((speedMult - 1) * 100)}% Smuff speed!)` : '';
    ctx.toast?.(`Crafted ${recipe.name}!${boostTag}`, 'success');
    ctx.updateHud?.();
    return true;
  }

  // --- 3D Ghost-Mesh Blueprint Placement ---

  function setOwnPrompt(text) {
    if (text) {
      lastPromptOwned = true;
      ctx.setPrompt?.(text);
    } else if (lastPromptOwned) {
      lastPromptOwned = false;
      ctx.setPrompt?.(null);
    }
  }

  function cancelBlueprint() {
    if (!activeBlueprint) return;
    if (activeBlueprint.ghostGroup && ctx.scene) {
      ctx.scene.remove(activeBlueprint.ghostGroup);
    }
    activeBlueprint.ghostMat?.dispose?.();
    activeBlueprint.gridMat?.dispose?.();
    activeBlueprint.gridGeo?.dispose?.();
    activeBlueprint = null;
    setOwnPrompt(null);
    ctx.updateHud?.();
  }

  function evaluateGhostPlacement(gx, gz) {
    if (!activeBlueprint) return { valid: false, reason: '' };
    const { def } = activeBlueprint;
    const p = ctx.player?.pos || { x: 0, z: 0 };

    if (def.requiresSmuff && !isSmuffRescued()) {
      return { valid: false, reason: 'Rescue Smuff first to unlock Tier 3 Smuff Tech!' };
    }
    if (!hasIngredients(def.ingredients)) {
      return { valid: false, reason: `Missing: ${formatMissingIngredients(def.ingredients)}` };
    }
    if (ctx.isWater?.(gx, gz)) {
      return { valid: false, reason: 'Cannot build in deep water!' };
    }
    if (def.blocksMovement && ctx.isBlocked?.(gx, gz, def.radius)) {
      return { valid: false, reason: 'Space is blocked!' };
    }
    // Prevent overlapping existing traps/buildings on same tile
    for (const existing of ctx.buildings || []) {
      if (!existing) continue;
      if (distXZ(gx, gz, existing.x, existing.z) < 0.78) {
        return { valid: false, reason: 'Tile already occupied!' };
      }
    }
    const distToPlayer = distXZ(p.x, p.z, gx, gz);
    if (def.blocksMovement && distToPlayer < 0.62) {
      return { valid: false, reason: 'Too close to Boots — step back!' };
    }
    if (distToPlayer > 8.5) {
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

    const status = check.valid
      ? `[Left-Click] Place ${activeBlueprint.def.name}`
      : check.reason || 'Invalid Placement';
    setOwnPrompt(`${status}  •  [Right-Click / Esc] Cancel`);
  }

  function startBlueprint(blueprintId) {
    const def = TIERED_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!def) {
      ctx.toast?.(`Unknown blueprint: ${blueprintId}`, 'warn');
      return false;
    }
    if (ctx.player?.isDead) return false;
    if (def.requiresSmuff && !isSmuffRescued()) {
      ctx.toast?.('Locked! Rescue Smuff at the West FBI Camp to unlock Tier 3 blueprints!', 'warn');
      return false;
    }

    // Cancel any active Phase 2 player blueprint so only one ghost is active
    ctx.systems?.player?.cancelBlueprint?.();
    cancelBlueprint();

    const { mesh: rawMesh } = createBlueprintMesh(def.id, true);
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
    ghostGroup.name = `Ghost_Expanded_${def.id}`;
    ghostGroup.add(rawMesh);

    const gridGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x34e04b,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const gridTile = new THREE.Mesh(gridGeo, gridMat);
    gridTile.rotation.x = -Math.PI / 2;
    gridTile.position.y = 0.032;
    ghostGroup.add(gridTile);

    // Optional range preview ring for turrets / traps
    if (def.id === 'coconut_turret' || def.id === 'snare_trap' || def.id === 'spike_wall') {
      const previewR = def.id === 'coconut_turret' ? TURRET_RANGE : 1.4;
      const ringGeo = new THREE.RingGeometry(previewR - 0.08, previewR, 36);
      ringGeo.rotateX(-Math.PI / 2);
      const rangeMesh = new THREE.Mesh(ringGeo, gridMat);
      rangeMesh.position.y = 0.04;
      ghostGroup.add(rangeMesh);
    }

    const p = ctx.player?.pos || { x: 0, z: 0 };
    const yaw = ctx.player?.group?.rotation?.y || 0;
    const initX = Math.round(p.x + Math.sin(yaw) * 2.0);
    const initZ = Math.round(p.z + Math.cos(yaw) * 2.0);
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

    ctx.scene?.add(ghostGroup);
    updateGhostFromCursor();
    ctx.toast?.(`Placing ${def.name} — Left-Click to build, Right-Click/Esc to cancel.`, 'info');
    ctx.updateHud?.();
    return true;
  }

  function placeActiveBlueprint(overrideGx, overrideGz) {
    if (!activeBlueprint || ctx.player?.isDead) return false;

    if (Number.isFinite(overrideGx) && Number.isFinite(overrideGz)) {
      activeBlueprint.gx = Math.round(overrideGx);
      activeBlueprint.gz = Math.round(overrideGz);
      activeBlueprint.ghostGroup.position.set(activeBlueprint.gx, 0, activeBlueprint.gz);
      const check = evaluateGhostPlacement(activeBlueprint.gx, activeBlueprint.gz);
      activeBlueprint.valid = check.valid;
      activeBlueprint.invalidReason = check.reason;
    } else {
      updateGhostFromCursor();
    }

    const { def, gx, gz, valid, invalidReason } = activeBlueprint;
    if (!valid) {
      ctx.toast?.(invalidReason || 'Cannot place blueprint here!', 'warn');
      return false;
    }

    // Deduct materials
    for (const ing of def.ingredients) {
      ctx.player?.removeItem?.(ing.id, ing.count);
    }

    const speedMult = getSpeedMultiplier();
    const effectiveBuildTime = def.buildTime / speedMult;

    if (ctx.player?.group && ctx.player?.pos) {
      ctx.player.group.rotation.y = Math.atan2(gx - ctx.player.pos.x, gz - ctx.player.pos.z);
    }
    ctx.models?.tarcy?.play?.('Craft', 0.1);
    if (isSmuffRescued()) {
      ctx.models?.smuff?.play?.('Ability_Cast', 0.12);
    }
    ctx.systems?.audio?.playSfx?.('craft');

    const built = createBlueprintMesh(def.id, false);
    built.mesh.position.set(gx, 0, gz);
    built.mesh.scale.set(0.05, 0.05, 0.05);
    ctx.scene?.add(built.mesh);

    const id = `${def.id}_${Date.now()}_${nextStructureSeq++}`;
    const entry = {
      id,
      type: def.id,
      tier: def.tier,
      mesh: built.mesh,
      x: gx,
      z: gz,
      radius: def.radius,
      hp: def.id === 'reinforced_wall' ? 350 : def.id === 'spike_wall' ? 180 : 120,
      maxHp: def.id === 'reinforced_wall' ? 350 : def.id === 'spike_wall' ? 180 : 120,
      ...(built.light ? { light: built.light } : {}),
    };

    ctx.buildings.push(entry);

    if (def.blocksMovement) {
      ctx.addCollider?.(id, gx, gz, def.radius);
    }

    // Register specialized defensive structures into ctx.traps & ctx.turrets
    if (def.id === 'spike_wall') {
      ctx.traps.push({
        id,
        type: 'spike_wall',
        mesh: built.mesh,
        x: gx,
        z: gz,
        triggerRadius: SPIKE_TRIGGER_RADIUS,
        damage: SPIKE_DAMAGE,
        armed: true,
        cooldowns: new Map(),
      });
    } else if (def.id === 'snare_trap') {
      ctx.traps.push({
        id,
        type: 'snare_trap',
        mesh: built.mesh,
        x: gx,
        z: gz,
        triggerRadius: SNARE_TRIGGER_RADIUS,
        damage: SNARE_DAMAGE,
        rootDuration: SNARE_ROOT_DURATION,
        armed: true,
        rearmTimer: 0,
      });
    } else if (def.id === 'coconut_turret') {
      ctx.turrets.push({
        id,
        type: 'coconut_turret',
        mesh: built.mesh,
        headGroup: built.headGroup,
        barrelGroup: built.barrelGroup,
        x: gx,
        z: gz,
        range: TURRET_RANGE,
        damage: TURRET_DAMAGE,
        fireInterval: TURRET_FIRE_INTERVAL,
        fireCooldown: 0.25,
        recoil: 0,
      });
    }

    buildPopAnims.push({
      mesh: built.mesh,
      age: 0,
      duration: Math.max(0.24, Math.min(0.85, effectiveBuildTime * 0.52)),
    });

    spawnSparkBurst(gx, 0.55, gz, def.tier === 3 ? 0x22d3ee : 0xffd43b, 8, {
      shape: 'octa',
      upward: 2.2,
    });

    if (def.isRespawnPoint) {
      if (typeof ctx.systems?.death?.setRespawnPoint === 'function') {
        ctx.systems.death.setRespawnPoint(gx, gz);
      } else if (ctx.player?.respawnPoint?.set) {
        ctx.player.respawnPoint.set(gx, 0, gz);
      } else if (ctx.player) {
        ctx.player.respawnPoint = new THREE.Vector3(gx, 0, gz);
      }
    }

    const boostTag = speedMult > 1.05 ? ` (+${Math.round((speedMult - 1) * 100)}% Smuff speed!)` : '';
    const respawnTag = def.isRespawnPoint ? ' Respawn checkpoint set!' : '';
    ctx.toast?.(`Built ${def.name}!${respawnTag}${boostTag}`, 'success');

    cancelBlueprint();
    ctx.updateHud?.();
    return true;
  }

  // --- Agent Crowd-Control (Snare Root, EMP/Club Stun, Blowpipe Sleep) ---

  function createCCVisual(mode) {
    const group = new THREE.Group();
    group.name = `CC_VFX_${mode}`;

    if (mode === 'root') {
      // Visible glowing golden/woven snare ring gripping agent's ankles
      const ropeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.055, 8, 22),
        toonMat(0xe5b842, { emissive: 0xd97706, emissiveIntensity: 0.4 })
      );
      ropeRing.rotation.x = Math.PI / 2;
      ropeRing.position.y = 0.26;
      group.add(ropeRing);

      const upperRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.04, 7, 18),
        toonMat(0xc48b35)
      );
      upperRing.rotation.x = Math.PI / 2;
      upperRing.position.y = 0.54;
      group.add(upperRing);

      const groundRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffb703,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      groundRing.rotation.x = -Math.PI / 2;
      groundRing.position.y = 0.05;
      group.add(groundRing);
    } else if (mode === 'stun') {
      // Electric cyan / gold stun halo spinning overhead
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.032, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.05;
      group.add(halo);

      const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        const star = new THREE.Mesh(sparkGeo, sparkMat);
        star.position.set(Math.cos(a) * 0.42, 2.08, Math.sin(a) * 0.42);
        group.add(star);
      }
      group.userData.spinTarget = group;
    } else {
      // 'sleep': floating lavender-cyan sleep bubbles rising above head
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.85,
      });
      const bubbles = [];
      for (let i = 0; i < 3; i += 1) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.065 + i * 0.02, 8, 8), bubbleMat);
        b.position.set(i * 0.12 - 0.1, 1.9 + i * 0.22, 0);
        group.add(b);
        bubbles.push(b);
      }
      group.userData.bubbles = bubbles;
    }

    return group;
  }

  function applyAgentCC(agent, mode, duration) {
    if (!agent || !agent.pos || agent.state === 'ko') return;
    const key = agent.id || agent;
    const existing = agentCC.get(key);

    agent.isRooted = mode === 'root';
    agent.isStunned = mode === 'stun';
    agent.isSleeping = mode === 'sleep';

    if (existing) {
      // Upgrade/refresh duration & swap visuals if mode changed
      existing.timer = Math.max(existing.timer, duration);
      if (existing.mode !== mode) {
        if (existing.vfxGroup && ctx.scene) {
          ctx.scene.remove(existing.vfxGroup);
          disposeObjectTree(existing.vfxGroup);
        }
        existing.mode = mode;
        existing.vfxGroup = createCCVisual(mode);
        existing.vfxGroup.position.set(agent.pos.x, 0, agent.pos.z);
        ctx.scene?.add(existing.vfxGroup);
      }
      existing.anchorX = agent.pos.x;
      existing.anchorZ = agent.pos.z;
      return;
    }

    const vfxGroup = createCCVisual(mode);
    vfxGroup.position.set(agent.pos.x, 0, agent.pos.z);
    ctx.scene?.add(vfxGroup);

    agentCC.set(key, {
      agent,
      mode,
      timer: duration,
      anchorX: agent.pos.x,
      anchorZ: agent.pos.z,
      vfxGroup,
      age: 0,
    });
  }

  function updateAgentCC(dt) {
    for (const [key, rec] of agentCC.entries()) {
      const { agent } = rec;
      rec.timer -= dt;
      rec.age += dt;

      const expired =
        rec.timer <= 0 ||
        !agent ||
        agent.state === 'ko' ||
        (typeof agent.hp === 'number' && agent.hp <= 0);

      if (expired) {
        if (rec.vfxGroup && ctx.scene) {
          ctx.scene.remove(rec.vfxGroup);
          disposeObjectTree(rec.vfxGroup);
        }
        if (agent) {
          agent.isRooted = false;
          agent.isStunned = false;
          agent.isSleeping = false;
        }
        agentCC.delete(key);
        continue;
      }

      if (rec.mode === 'root' || rec.mode === 'stun') {
        agent.pos.x = rec.anchorX;
        agent.pos.z = rec.anchorZ;
        if (agent.group && agent.group.position !== agent.pos) {
          agent.group.position.set(rec.anchorX, 0, rec.anchorZ);
        }
        agent.isRooted = rec.mode === 'root';
        agent.isStunned = rec.mode === 'stun';
        if (rec.mode === 'stun') {
          agent.shootCooldown = Math.max(agent.shootCooldown || 0, 0.4);
          if (agent.group) {
            agent.group.rotation.y += Math.sin(rec.age * 24) * 0.08;
          }
        }
      } else if (rec.mode === 'sleep') {
        // Heavy slow / daze: pull 82% back toward anchor and suppress firing
        agent.pos.x = THREE.MathUtils.lerp(agent.pos.x, rec.anchorX, 0.82);
        agent.pos.z = THREE.MathUtils.lerp(agent.pos.z, rec.anchorZ, 0.82);
        rec.anchorX = agent.pos.x;
        rec.anchorZ = agent.pos.z;
        if (agent.group && agent.group.position !== agent.pos) {
          agent.group.position.set(agent.pos.x, 0, agent.pos.z);
        }
        agent.isSleeping = true;
        agent.shootCooldown = Math.max(agent.shootCooldown || 0, 0.45);
      }

      if (rec.vfxGroup) {
        rec.vfxGroup.position.set(agent.pos.x, 0, agent.pos.z);
        if (rec.mode === 'root') {
          const pulse = 1.0 + Math.sin(rec.age * 10) * 0.06;
          rec.vfxGroup.scale.set(pulse, 1, pulse);
        } else if (rec.mode === 'stun') {
          rec.vfxGroup.rotation.y = rec.age * 5.2;
        } else if (rec.mode === 'sleep' && rec.vfxGroup.userData.bubbles) {
          rec.vfxGroup.userData.bubbles.forEach((b, idx) => {
            const phase = (rec.age * 1.4 + idx * 0.33) % 1;
            b.position.y = 1.85 + phase * 0.75;
            b.position.x = Math.sin(rec.age * 3 + idx * 2) * 0.16;
            const s = 0.65 + phase * 0.55;
            b.scale.setScalar(s);
          });
        }
      }
    }
  }

  // --- EMP Grenade Throw & Detonation ---

  function createEmpOrbMesh() {
    const group = new THREE.Group();
    group.name = 'EMP_Grenade_Orb';

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xb8f9ff })
    );
    group.add(core);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    group.add(shell);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.025, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    group.add(ring);

    const light = new THREE.PointLight(0x22d3ee, 2.2, 5.5, 1.5);
    group.add(light);

    group.userData.ring = ring;
    return group;
  }

  function findEmpThrowTarget() {
    const p = ctx.player?.pos || { x: 0, z: 0 };
    let bestPos = null;
    let bestScore = Infinity;

    // Prioritize nearby active Signal Jammers within 9u
    for (const j of ctx.jammers || []) {
      if (!j || j.destroyed || j.depleted || (typeof j.hp === 'number' && j.hp <= 0)) continue;
      const d = distXZ(p.x, p.z, j.x, j.z);
      if (d <= EMP_TARGET_RANGE && d - 0.8 < bestScore) {
        bestScore = d - 0.8;
        bestPos = new THREE.Vector3(j.x, 0.25, j.z);
      }
    }

    // Check active FBI agents & Director Vance within 9u
    for (const agent of getActiveAgents()) {
      const d = distXZ(p.x, p.z, agent.pos.x, agent.pos.z);
      const bossBonus = agent.id === 'director_vance' || agent.isBoss ? 0.6 : 0;
      if (d <= EMP_TARGET_RANGE && d - bossBonus < bestScore) {
        bestScore = d - bossBonus;
        bestPos = new THREE.Vector3(agent.pos.x, 0.25, agent.pos.z);
      }
    }

    if (bestPos) return bestPos;

    // Throw forward in Boots's facing direction
    const yaw = ctx.player?.group?.rotation?.y || 0;
    const clamped = clampToWorld(p.x + Math.sin(yaw) * 5.5, p.z + Math.cos(yaw) * 5.5, 0.5);
    return new THREE.Vector3(clamped.x, 0.25, clamped.z);
  }

  function detonateEmp(x, z) {
    const blastPos = new THREE.Vector3(x, 0, z);
    spawnShockwaveRing(x, z, 0x00e5ff, EMP_BLAST_RADIUS, 0.62, true);
    spawnSparkBurst(x, 0.8, z, 0x38bdf8, 14, {
      shape: 'octa',
      size: 0.13,
      upward: 3.1,
      spread: 3.8,
      duration: 0.6,
    });
    ctx.systems?.audio?.playSfx?.('explosion');

    let jammersHit = 0;
    let agentsStunned = 0;
    let vanceHit = false;

    // 1. Heavy EMP damage (55) to nearby Signal Jammers
    for (const j of ctx.jammers || []) {
      if (!j || j.destroyed || j.depleted || (typeof j.hp === 'number' && j.hp <= 0)) continue;
      if (distXZ(x, z, j.x, j.z) <= EMP_BLAST_RADIUS + (j.radius || 0.9)) {
        dealDamageToJammer(j, EMP_JAMMER_DAMAGE);
        spawnSparkBurst(j.x, 1.0, j.z, 0x22d3ee, 8, { shape: 'octa', upward: 2.6 });
        jammersHit += 1;
      }
    }

    // 2. Stun & damage FBI agents (40 dmg + 4s stun) and Director Vance (45 dmg + disruption)
    for (const agent of getActiveAgents()) {
      const d = distXZ(x, z, agent.pos.x, agent.pos.z);
      const isVance = agent.id === 'director_vance' || Boolean(agent.isBoss);
      const hitRadius = isVance ? EMP_BLAST_RADIUS + 1.0 : EMP_BLAST_RADIUS + 0.5;
      if (d > hitRadius) continue;

      if (isVance) {
        dealDamageToAgent(agent, EMP_VANCE_DAMAGE, blastPos);
        agent.empDisrupted = true;
        agent.stunTimer = Math.max(agent.stunTimer || 0, EMP_AGENT_STUN_SEC);
        applyAgentCC(agent, 'stun', EMP_AGENT_STUN_SEC);
        vanceHit = true;
      } else {
        dealDamageToAgent(agent, EMP_AGENT_DAMAGE, blastPos);
        if (agent.state !== 'ko' && (typeof agent.hp !== 'number' || agent.hp > 0)) {
          applyAgentCC(agent, 'stun', EMP_AGENT_STUN_SEC);
        }
        agentsStunned += 1;
      }
    }

    const hits = [];
    if (jammersHit > 0) hits.push(`${jammersHit} Signal Jammer${jammersHit > 1 ? 's' : ''} (-${EMP_JAMMER_DAMAGE} HP)`);
    if (vanceHit) hits.push(`Director Vance disrupted (-${EMP_VANCE_DAMAGE} HP)`);
    if (agentsStunned > 0) hits.push(`${agentsStunned} FBI agent${agentsStunned > 1 ? 's' : ''} stunned (4s)`);

    if (hits.length > 0) {
      ctx.toast?.(`EMP Blast! ${hits.join(' • ')}!`, 'success');
    } else {
      ctx.toast?.('EMP Jammer Grenade detonated!', 'info');
    }
    ctx.updateHud?.();
  }

  function throwEmpGrenade() {
    if (empCooldown > 0) return false;
    if ((ctx.player?.countItem?.('emp_grenade') || 0) < 1) {
      ctx.toast?.('No EMP Jammer Grenades left!', 'warn');
      return false;
    }

    if (ctx.player?.camoActive) {
      setCamoState(false, 'break');
    }

    if (ctx.player?.removeItem?.('emp_grenade', 1) === false) return false;
    empCooldown = 0.45;

    const p = ctx.player?.pos || { x: 0, z: 0 };
    const end = findEmpThrowTarget();
    const start = new THREE.Vector3(p.x, 1.05, p.z);

    if (ctx.player?.group) {
      ctx.player.group.rotation.y = Math.atan2(end.x - p.x, end.z - p.z);
    }
    ctx.models?.tarcy?.play?.('Craft', 0.08);
    ctx.systems?.audio?.playSfx?.('tranq');

    const mesh = createEmpOrbMesh();
    mesh.position.copy(start);
    ctx.scene?.add(mesh);

    const dist = start.distanceTo(end);
    const duration = THREE.MathUtils.clamp(dist / 13.5, 0.24, 0.56);

    empProjectiles.push({
      mesh,
      start,
      end,
      arcHeight: THREE.MathUtils.clamp(1.3 + dist * 0.16, 1.4, 2.7),
      age: 0,
      duration,
    });

    ctx.toast?.('Threw EMP Jammer Grenade!', 'info');
    ctx.updateHud?.();
    return true;
  }

  // --- Sleep-Dart Blowpipe ---

  function createSleepDartMesh() {
    const group = new THREE.Group();
    group.name = 'Blowpipe_Sleep_Dart';

    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.44, 6);
    shaftGeo.rotateX(Math.PI / 2);
    const shaft = new THREE.Mesh(
      shaftGeo,
      new THREE.MeshBasicMaterial({ color: 0xa78bfa })
    );
    group.add(shaft);

    const tipGeo = new THREE.ConeGeometry(0.048, 0.14, 6);
    tipGeo.rotateX(Math.PI / 2);
    const tip = new THREE.Mesh(
      tipGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    tip.position.z = 0.26;
    group.add(tip);

    const fletchGeo = new THREE.ConeGeometry(0.065, 0.14, 5);
    fletchGeo.rotateX(-Math.PI / 2);
    const fletch = new THREE.Mesh(
      fletchGeo,
      new THREE.MeshBasicMaterial({ color: 0xf06595 })
    );
    fletch.position.z = -0.24;
    group.add(fletch);

    return group;
  }

  function fireBlowpipe() {
    if (blowpipeCooldown > 0) return false;

    if (ctx.player?.camoActive) {
      setCamoState(false, 'break');
    }

    const p = ctx.player?.pos || { x: 0, z: 0 };
    const target = findNearestActiveAgent(p.x, p.z, BLOWPIPE_RANGE);

    blowpipeCooldown = 0.62;
    ctx.models?.tarcy?.play?.('Craft', 0.08);
    ctx.systems?.audio?.playSfx?.('tranq');

    const start = new THREE.Vector3(p.x, 1.05, p.z);
    let end;
    if (target) {
      end = new THREE.Vector3(target.pos.x, 1.05, target.pos.z);
      if (ctx.player?.group) {
        ctx.player.group.rotation.y = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
      }
    } else {
      const yaw = ctx.player?.group?.rotation?.y || 0;
      end = new THREE.Vector3(p.x + Math.sin(yaw) * 6.0, 1.05, p.z + Math.cos(yaw) * 6.0);
    }

    const mesh = createSleepDartMesh();
    mesh.position.copy(start);
    mesh.lookAt(end);
    ctx.scene?.add(mesh);

    const dist = Math.max(0.5, start.distanceTo(end));
    dartProjectiles.push({
      mesh,
      start,
      end,
      targetAgent: target,
      age: 0,
      duration: Math.max(0.12, dist / 20.0),
      damage: BLOWPIPE_DAMAGE,
      sleepDuration: BLOWPIPE_SLEEP_SEC,
    });

    if (target) {
      ctx.toast?.('Fired Sleep Dart!', 'info');
    } else {
      ctx.toast?.('Fired Sleep Dart — no FBI agent within 8.5u!', 'info');
    }
    return true;
  }

  // --- Banana Smoothie ---

  function drinkBananaSmoothie() {
    if (smoothieCooldown > 0) return false;
    if ((ctx.player?.countItem?.('banana_smoothie') || 0) < 1) {
      ctx.toast?.('No Healing Banana Smoothies left!', 'warn');
      return false;
    }

    if (ctx.player?.removeItem?.('banana_smoothie', 1) === false) return false;
    smoothieCooldown = 0.25;

    const maxHp = Number.isFinite(ctx.player?.maxHp) ? ctx.player.maxHp : 100;
    const maxStamina = Number.isFinite(ctx.player?.maxStamina) ? ctx.player.maxStamina : 100;

    if (typeof ctx.player?.heal === 'function') {
      ctx.player.heal(SMOOTHIE_HEAL_HP);
    } else if (ctx.player) {
      ctx.player.hp = Math.min(maxHp, (ctx.player.hp || 0) + SMOOTHIE_HEAL_HP);
    }
    if (ctx.player) {
      ctx.player.stamina = Math.min(maxStamina, (ctx.player.stamina || 0) + SMOOTHIE_HEAL_STAMINA);
    }

    const px = ctx.player?.pos?.x ?? 0;
    const pz = ctx.player?.pos?.z ?? 0;
    spawnSparkBurst(px, 0.75, pz, 0x51cf66, 12, {
      shape: 'octa',
      size: 0.12,
      upward: 2.8,
      spread: 1.6,
      gravity: 2.2,
      duration: 0.75,
    });
    spawnSparkBurst(px, 0.9, pz, 0xffe066, 6, {
      shape: 'sphere',
      size: 0.08,
      upward: 2.4,
      spread: 1.2,
      gravity: 1.8,
      duration: 0.65,
    });
    spawnShockwaveRing(px, pz, 0x51cf66, 1.8, 0.5, false);

    ctx.models?.tarcy?.play?.('Craft', 0.1);
    ctx.systems?.audio?.playSfx?.('heal');
    ctx.toast?.(
      `Drank Healing Banana Smoothie! (+${SMOOTHIE_HEAL_HP} HP, +${SMOOTHIE_HEAL_STAMINA} Stamina)`,
      'success'
    );
    ctx.updateHud?.();
    return true;
  }

  // --- Extended-Reach Stone Spear & Heavy Wooden Club Active Strikes ---

  function strikeStoneSpear() {
    if (spearCooldown > 0) return false;
    const p = ctx.player?.pos || { x: 0, z: 0 };
    const target = findNearestActiveAgent(p.x, p.z, 3.85);
    if (!target) return false;

    if (ctx.player?.camoActive) setCamoState(false, 'break');
    spearCooldown = 0.52;

    if (ctx.player?.group) {
      ctx.player.group.rotation.y = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
    }
    ctx.models?.tarcy?.play?.('Chop_Mine', 0.08);
    dealDamageToAgent(target, 32, p);
    spawnSparkBurst(target.pos.x, 1.0, target.pos.z, 0xffe066, 6);
    ctx.systems?.audio?.playSfx?.('hit');
    return true;
  }

  function strikeWoodenClub() {
    if (clubCooldown > 0) return false;
    const p = ctx.player?.pos || { x: 0, z: 0 };
    const target = findNearestActiveAgent(p.x, p.z, 2.65);
    if (!target) return false;

    if (ctx.player?.camoActive) setCamoState(false, 'break');
    clubCooldown = 0.58;

    if (ctx.player?.group) {
      ctx.player.group.rotation.y = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
    }
    ctx.models?.tarcy?.play?.('Chop_Mine', 0.08);
    dealDamageToAgent(target, 38, p);
    if (target.state !== 'ko' && (typeof target.hp !== 'number' || target.hp > 0)) {
      applyAgentCC(target, 'stun', 2.2);
    }
    spawnShockwaveRing(target.pos.x, target.pos.z, 0xffd43b, 1.5, 0.35, false);
    ctx.systems?.audio?.playSfx?.('hit');
    return true;
  }

  // --- Public Expanded Item Usage Entry Point ---

  function useExpandedItem(item) {
    if (ctx.player?.isDead) return false;
    const id = resolveItemId(item);
    if (!id) return false;

    if (id === 'camo_bush') {
      if (camoToggleCooldown > 0) return true;
      camoToggleCooldown = 0.22;
      setCamoState(!ctx.player?.camoActive, 'toggle');
      return true;
    }

    if (id === 'emp_grenade') {
      return throwEmpGrenade();
    }

    if (id === 'banana_smoothie') {
      return drinkBananaSmoothie();
    }

    if (id === 'blowpipe') {
      return fireBlowpipe();
    }

    if (id === 'stone_spear') {
      return strikeStoneSpear();
    }

    if (id === 'wooden_club') {
      return strikeWoodenClub();
    }

    return false;
  }

  // --- Auto-Turret Coconut Launcher & Trap Updates ---

  function createCoconutProjectileMesh() {
    const group = new THREE.Group();
    group.name = 'Turret_Coconut_Projectile';

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 9, 8),
      toonMat(0x61381c)
    );
    group.add(body);
    addOutlineShell(group, body, 1.14);

    // 3 dark coconut eyes
    const eyeGeo = new THREE.SphereGeometry(0.032, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x24140a });
    for (const [ex, ey, ez] of [
      [-0.04, 0.04, 0.145],
      [0.04, 0.04, 0.145],
      [0.0, -0.03, 0.15],
    ]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ex, ey, ez);
      group.add(eye);
    }

    return group;
  }

  function updateTrapsAndTurrets(dt) {
    const activeAgents = getActiveAgents();

    // 1. Placed traps (spike_wall & snare_trap)
    for (const trap of ctx.traps || []) {
      if (!trap) continue;

      if (trap.type === 'spike_wall') {
        if (!trap.cooldowns) trap.cooldowns = new Map();
        for (const [aid, cd] of trap.cooldowns.entries()) {
          if (cd - dt <= 0) trap.cooldowns.delete(aid);
          else trap.cooldowns.set(aid, cd - dt);
        }

        const triggerR = trap.triggerRadius ?? SPIKE_TRIGGER_RADIUS;
        const dmg = trap.damage ?? SPIKE_DAMAGE;
        const trapPos = new THREE.Vector3(trap.x, 0, trap.z);

        for (const agent of activeAgents) {
          const aid = agent.id || agent;
          if (trap.cooldowns.has(aid)) continue;
          const d = distXZ(trap.x, trap.z, agent.pos.x, agent.pos.z);
          if (d <= triggerR) {
            trap.cooldowns.set(aid, SPIKE_HIT_COOLDOWN);
            dealDamageToAgent(agent, dmg, trapPos);

            // Gentle knockback off spikes
            if (d > 0.05) {
              const pushX = ((agent.pos.x - trap.x) / d) * 0.32;
              const pushZ = ((agent.pos.z - trap.z) / d) * 0.32;
              if (!ctx.isBlocked?.(agent.pos.x + pushX, agent.pos.z + pushZ, 0.38)) {
                agent.pos.x += pushX;
                agent.pos.z += pushZ;
              }
            }

            spawnSparkBurst(agent.pos.x, 0.85, agent.pos.z, 0xff6b6b, 6);
            ctx.systems?.audio?.playSfx?.('hit');
          }
        }
      } else if (trap.type === 'snare_trap') {
        if (!trap.armed) {
          trap.rearmTimer = Math.max(0, (trap.rearmTimer ?? SNARE_REARM_TIME) - dt);
          if (trap.rearmTimer <= 0) {
            trap.armed = true;
            if (trap.mesh?.userData?.tripwire) trap.mesh.userData.tripwire.visible = true;
            if (trap.mesh?.userData?.snareLoop) trap.mesh.userData.snareLoop.scale.setScalar(1);
          }
          continue;
        }

        const triggerR = trap.triggerRadius ?? SNARE_TRIGGER_RADIUS;
        const dmg = trap.damage ?? SNARE_DAMAGE;
        const rootDur = trap.rootDuration ?? SNARE_ROOT_DURATION;

        for (const agent of activeAgents) {
          const d = distXZ(trap.x, trap.z, agent.pos.x, agent.pos.z);
          if (d <= triggerR) {
            trap.armed = false;
            trap.rearmTimer = SNARE_REARM_TIME;
            if (trap.mesh?.userData?.tripwire) trap.mesh.userData.tripwire.visible = false;
            if (trap.mesh?.userData?.snareLoop) trap.mesh.userData.snareLoop.scale.setScalar(0.55);

            const trapPos = new THREE.Vector3(trap.x, 0, trap.z);
            dealDamageToAgent(agent, dmg, trapPos);
            if (agent.state !== 'ko' && (typeof agent.hp !== 'number' || agent.hp > 0)) {
              applyAgentCC(agent, 'root', rootDur);
            }

            spawnShockwaveRing(agent.pos.x, agent.pos.z, 0xffb703, 1.75, 0.42, false);
            spawnSparkBurst(agent.pos.x, 0.5, agent.pos.z, 0xdcb464, 8);
            ctx.systems?.audio?.playSfx?.('chop');
            ctx.toast?.('Tripwire Snare Trap snapped! FBI agent rooted for 4s!', 'success');
            break;
          }
        }
      }
    }

    // 2. Placed auto-turret coconut launchers
    for (const turret of ctx.turrets || []) {
      if (!turret) continue;
      const range = turret.range ?? TURRET_RANGE;
      const dmg = turret.damage ?? TURRET_DAMAGE;
      const fireInterval = turret.fireInterval ?? TURRET_FIRE_INTERVAL;

      turret.fireCooldown = Math.max(0, (turret.fireCooldown ?? 0) - dt);

      // Barrel recoil recovery
      if (turret.barrelGroup && (turret.recoil || 0) > 0) {
        turret.recoil = Math.max(0, turret.recoil - dt * 4.5);
        turret.barrelGroup.position.z = -turret.recoil * 0.22;
      }

      const target = findNearestActiveAgent(turret.x, turret.z, range);
      if (!target) continue;

      const aimYaw = Math.atan2(target.pos.x - turret.x, target.pos.z - turret.z);
      if (turret.headGroup) {
        const diff = angleDiff(turret.headGroup.rotation.y, aimYaw);
        turret.headGroup.rotation.y += diff * Math.min(1, dt * 10.0);
      }

      if (turret.fireCooldown <= 0) {
        turret.fireCooldown = fireInterval;
        turret.recoil = 1.0;

        const fwdX = Math.sin(aimYaw);
        const fwdZ = Math.cos(aimYaw);
        const start = new THREE.Vector3(turret.x + fwdX * 0.65, 1.12, turret.z + fwdZ * 0.65);
        const end = new THREE.Vector3(target.pos.x, 0.95, target.pos.z);

        const mesh = createCoconutProjectileMesh();
        mesh.position.copy(start);
        ctx.scene?.add(mesh);

        const dist = Math.max(0.5, start.distanceTo(end));
        coconutProjectiles.push({
          mesh,
          start,
          end,
          turretPos: new THREE.Vector3(turret.x, 0, turret.z),
          targetAgent: target,
          damage: dmg,
          arcHeight: THREE.MathUtils.clamp(0.45 + dist * 0.08, 0.5, 1.35),
          age: 0,
          duration: Math.max(0.14, dist / 16.5),
        });

        spawnSparkBurst(start.x, start.y, start.z, 0xe8d5b5, 4, {
          size: 0.08,
          upward: 1.2,
          spread: 1.4,
          duration: 0.28,
        });
        ctx.systems?.audio?.playSfx?.('chop');
      }
    }
  }

  // --- Periodic "FBI Island Sweep" Raid System ---

  function getActiveCampfireTarget() {
    if (ctx.player?.respawnPoint) {
      return new THREE.Vector3(ctx.player.respawnPoint.x, 0, ctx.player.respawnPoint.z);
    }
    const camps = (ctx.buildings || []).filter(
      (b) => b && (b.type === 'campfire' || b.type === 'bed')
    );
    if (camps.length > 0) {
      const latest = camps[camps.length - 1];
      return new THREE.Vector3(latest.x, 0, latest.z);
    }
    return new THREE.Vector3(0, 0, 11);
  }

  function isPointWalkable(x, z, radius = 0.42) {
    const b = getBounds();
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
    if (ctx.isWater?.(x, z)) return false;
    if (ctx.isBlocked?.(x, z, radius)) return false;
    return true;
  }

  function findFreePerimeterSpawn(prefX, prefZ) {
    const c = clampToWorld(prefX, prefZ, 1.2);
    if (isPointWalkable(c.x, c.z, 0.42)) {
      return new THREE.Vector3(c.x, 0, c.z);
    }
    for (let r = 1.0; r <= 6.0; r += 1.0) {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const tx = c.x + Math.cos(a) * r;
        const tz = c.z + Math.sin(a) * r;
        if (isPointWalkable(tx, tz, 0.42)) {
          return new THREE.Vector3(tx, 0, tz);
        }
      }
    }
    return new THREE.Vector3(c.x, 0, c.z);
  }

  function createFallbackRaiderModel() {
    const root = new THREE.Group();
    root.name = 'FBI_Scout_Raider_Fallback';
    const suit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 1.15, 8),
      toonMat(0x1f242c)
    );
    suit.position.y = 0.62;
    root.add(suit);
    addOutlineShell(root, suit, 1.08);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), toonMat(0xecc29b));
    head.position.y = 1.42;
    root.add(head);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.14, 8), toonMat(0x11151b));
    cap.position.y = 1.58;
    root.add(cap);

    return {
      scene: root,
      actions: {},
      activeClip: '',
      play() {
        return false;
      },
    };
  }

  function createRaiderVisionCone() {
    const halfFov = THREE.MathUtils.degToRad(32);
    const segments = 16;
    const positions = [0, 0, 0];
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = -halfFov + (i / segments) * halfFov * 2;
      positions.push(Math.sin(a), 0, Math.cos(a));
    }
    for (let i = 1; i <= segments; i += 1) {
      indices.push(0, i, i + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0xff922b,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.04;
    mesh.renderOrder = 2;
    mesh.userData.rimMat = null;
    return mesh;
  }

  function createRaiderAlertBadge() {
    const badge = new THREE.Group();
    badge.position.set(0, 2.25, 0);
    badge.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.95 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.11), mat);
    bar.position.y = 0.14;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), mat);
    dot.position.y = -0.14;
    badge.add(bar, dot);
    badge.userData.mat = mat;
    return badge;
  }

  function spawnSweepRaider(spawnPos, targetPos, indexOffset) {
    let model = null;
    if (typeof ctx.cloneModel === 'function') {
      try {
        model = ctx.cloneModel('fbi');
      } catch {
        model = null;
      }
    }
    if (!model || !model.scene) {
      model = createFallbackRaiderModel();
    }

    const id = `fbi-raider-${sweepWaveNum}-${nextRaiderSeq++}`;
    const group = new THREE.Group();
    group.name = `FBI_Sweep_Raider_${id}`;

    model.scene.position.set(0, 0, 0);
    model.scene.rotation.set(0, 0, 0);
    group.add(model.scene);
    group.position.copy(spawnPos);

    const visionMesh = createRaiderVisionCone();
    group.add(visionMesh);

    const alertBadge = createRaiderAlertBadge();
    group.add(alertBadge);

    // Distinct pulsing amber/crimson raid ring under sweep raiders
    const raidRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.62, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff4d4d,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    raidRing.rotation.x = -Math.PI / 2;
    raidRing.position.y = 0.045;
    group.add(raidRing);

    ctx.scene?.add(group);

    // Waypoints marching straight from camp perimeter toward Boots's campfire/respawnPoint
    const mid = new THREE.Vector3(
      THREE.MathUtils.lerp(spawnPos.x, targetPos.x, 0.5) + indexOffset * 1.1,
      0,
      THREE.MathUtils.lerp(spawnPos.z, targetPos.z, 0.5)
    );
    const campEdge = new THREE.Vector3(targetPos.x + indexOffset * 0.9, 0, targetPos.z - 0.8);
    const campSide = new THREE.Vector3(targetPos.x - indexOffset * 1.1, 0, targetPos.z + 0.9);
    const waypoints = [mid, campEdge, campSide];

    group.rotation.y = Math.atan2(targetPos.x - spawnPos.x, targetPos.z - spawnPos.z);
    model.play?.('Patrol_Walk', 0.08);

    // Populate all fields expected by Phase 2 fbi_ai.js so raids integrate seamlessly
    const raider = {
      id,
      model,
      group,
      pos: group.position,
      hp: RAIDER_MAX_HP,
      maxHp: RAIDER_MAX_HP,
      state: 'patrol',
      alert: 25,
      waypoints,
      wpIndex: 0,
      visionMesh,
      targetCrateId: null,
      shootCooldown: 1.0,
      koTimer: 0,

      isSweepRaider: true,
      sweepWave: sweepWaveNum,
      _raidRing: raidRing,
      _prevX: group.position.x,
      _prevZ: group.position.z,

      _alertBadge: alertBadge,
      _materialRecords: [],
      _hitFlashTimer: 0,
      _patrolPauseTimer: 0,
      _stuckTimer: 0,
      _alertSpotTimer: 0,
      _shootAnimTimer: 0,
      _confiscateTimer: 0,
      _spotMemoryTimer: 0,
      _seesPlayer: false,
      _lastKnownTargetPos: null,
      _investigateTarget: null,
      _investigatingDecoy: false,
      _aggroTarget: null,
      _crockAggroTimer: 0,
    };

    if (!ctx.fbi) {
      ctx.fbi = { agents: [], smuff: { rescued: false }, globalAlert: 0, isPlayerDetected: false };
    }
    if (!Array.isArray(ctx.fbi.agents)) ctx.fbi.agents = [];

    ctx.fbi.agents.push(raider);
    activeRaiders.push(raider);
    spawnShockwaveRing(spawnPos.x, spawnPos.z, 0xff4d4d, 2.2, 0.55, false);
    return raider;
  }

  function spawnSweepRaidSquad() {
    sweepWaveNum += 1;
    const target = getActiveCampfireTarget();
    const b = getBounds();

    // Pick West FBI Forward Camp / outpost perimeter biased toward target campfire
    const campAnchorX = THREE.MathUtils.clamp(-14.5, b.minX + 1.5, b.maxX - 1.5);
    const campAnchorZ = THREE.MathUtils.clamp(2.5, b.minZ + 1.5, b.maxZ - 1.5);

    const dx = campAnchorX - target.x;
    const dz = campAnchorZ - target.z;
    const dist = Math.hypot(dx, dz);

    let baseSpawnX = campAnchorX;
    let baseSpawnZ = campAnchorZ;
    if (dist > 17.5) {
      baseSpawnX = target.x + (dx / dist) * 15.5;
      baseSpawnZ = target.z + (dz / dist) * 15.5;
    } else if (dist < 6.0) {
      // Campfire is right inside West Camp — spawn from North perimeter instead
      baseSpawnX = THREE.MathUtils.clamp(target.x + 2.0, b.minX + 2, b.maxX - 2);
      baseSpawnZ = THREE.MathUtils.clamp(target.z - 12.0, b.minZ + 2, b.maxZ - 2);
    }

    const spawn1 = findFreePerimeterSpawn(baseSpawnX - 1.1, baseSpawnZ - 0.8);
    const spawn2 = findFreePerimeterSpawn(baseSpawnX + 1.1, baseSpawnZ + 0.9);

    spawnSweepRaider(spawn1, target, -1);
    spawnSweepRaider(spawn2, target, 1);

    sweepActive = true;
    sweepElapsed = 0;
    warningTriggered = false;

    ctx.systems?.audio?.playSfx?.('radio');
    ctx.toast?.('FBI Scout Raid Squad deployed! Defend your campfire with traps & turrets!', 'danger');
    ctx.updateHud?.();
  }

  function removeRaiderFromWorld(raider) {
    if (!raider) return;
    if (raider.group && ctx.scene) {
      ctx.scene.remove(raider.group);
      disposeObjectTree(raider.group);
    }
    if (Array.isArray(ctx.fbi?.agents)) {
      const idx = ctx.fbi.agents.indexOf(raider);
      if (idx !== -1) ctx.fbi.agents.splice(idx, 1);
    }
  }

  function updateSweepSystem(dt) {
    // Cleanup defeated raiders after short KO linger so they never revive/leak
    for (let i = defeatedRaiders.length - 1; i >= 0; i -= 1) {
      const rec = defeatedRaiders[i];
      rec.cleanupTimer -= dt;
      if (rec.cleanupTimer <= 0) {
        removeRaiderFromWorld(rec.agent);
        defeatedRaiders.splice(i, 1);
      }
    }

    // Pause sweep countdown and raid progression during cutscenes or player death
    if (ctx.cutsceneActive || ctx.player?.isDead) {
      return;
    }

    if (!sweepActive) {
      sweepCountdown = Math.max(0, sweepCountdown - dt);
      if (sweepCountdown <= SWEEP_WARNING_LEAD && sweepCountdown > 0 && !warningTriggered) {
        warningTriggered = true;
        ctx.toast?.(
          '⚠ FBI Island Sweep incoming! Scout squad heading toward your campfire!',
          'warn'
        );
        ctx.systems?.audio?.playSfx?.('alert');
        ctx.updateHud?.();
      }
      if (sweepCountdown <= 0) {
        spawnSweepRaidSquad();
      }
      return;
    }

    // Active sweep tick
    sweepElapsed += dt;
    const campTarget = getActiveCampfireTarget();

    for (let i = activeRaiders.length - 1; i >= 0; i -= 1) {
      const raider = activeRaiders[i];
      if (!raider || raider.state === 'ko' || (typeof raider.hp === 'number' && raider.hp <= 0)) {
        activeRaiders.splice(i, 1);
        if (raider) {
          defeatedRaiders.push({ agent: raider, cleanupTimer: 2.5 });
        }
        continue;
      }

      // Pulse raider indicator ring
      if (raider._raidRing) {
        const s = 1.0 + Math.sin(elapsed * 6.5 + i * 2) * 0.1;
        raider._raidRing.scale.set(s, s, 1);
      }

      // Fallback marching logic when fbi_ai isn't ticking (e.g., isolated tests)
      const movedSinceLast = distXZ(raider.pos.x, raider.pos.z, raider._prevX, raider._prevZ);
      const isCCed = agentCC.has(raider.id || raider);
      if (movedSinceLast < 0.001 && !isCCed && raider.state === 'patrol' && (raider._patrolPauseTimer || 0) <= 0) {
        const dx = campTarget.x - raider.pos.x;
        const dz = campTarget.z - raider.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.1) {
          const step = Math.min(d, RAIDER_MARCH_SPEED * dt);
          const nx = raider.pos.x + (dx / d) * step;
          const nz = raider.pos.z + (dz / d) * step;
          if (!ctx.isWater?.(nx, nz) && !ctx.isBlocked?.(nx, nz, 0.38)) {
            raider.pos.x = nx;
            raider.pos.z = nz;
            raider.group.rotation.y = Math.atan2(dx, dz);
          }
        }
      }

      raider._prevX = raider.pos.x;
      raider._prevZ = raider.pos.z;
    }

    if (activeRaiders.length === 0) {
      sweepActive = false;
      sweepCountdown = SWEEP_INTERVAL;
      warningTriggered = false;
      ctx.toast?.('FBI Island Sweep repelled! Your camp is safe for now.', 'success');
      ctx.systems?.audio?.playSfx?.('chirp');
      ctx.updateHud?.();
    } else if (sweepElapsed >= SWEEP_RAID_TIMEOUT) {
      // Safety retreat after timeout so waves recycle cleanly
      for (const r of activeRaiders) {
        removeRaiderFromWorld(r);
      }
      activeRaiders.length = 0;
      sweepActive = false;
      sweepCountdown = SWEEP_INTERVAL;
      warningTriggered = false;
      ctx.toast?.('FBI Scout Squad called off the sweep and fell back.', 'info');
      ctx.updateHud?.();
    }
  }

  function getSweepStatus() {
    const raidersAlive = activeRaiders.filter(
      (a) => a && a.state !== 'ko' && (typeof a.hp !== 'number' || a.hp > 0)
    ).length;
    const warningActive = !sweepActive && sweepCountdown <= SWEEP_WARNING_LEAD && sweepCountdown > 0;
    return {
      nextSweepIn: sweepActive ? 0 : Number(Math.max(0, sweepCountdown).toFixed(2)),
      warningActive,
      sweepActive,
      raidersAlive,
    };
  }

  // --- Passive Tool Perks (Stone Pickaxe bonus rock/jammer dmg, Wooden Club melee stun) & Camo Monitor ---

  function updateToolPerksAndCamo(dt) {
    ensureDosDetectionHook();
    const equipped = getSelectedItem();
    const eqId = resolveItemId(equipped);

    // 1. Stone Pickaxe bonus damage (+20) against rocks & Signal Jammers
    for (const h of ctx.harvestables || []) {
      if (!h) continue;
      const prev = harvestPrevHp.get(h);
      const cur = typeof h.hp === 'number' ? h.hp : null;
      if (
        prev !== undefined &&
        cur !== null &&
        cur < prev &&
        !h.depleted &&
        eqId === 'pickaxe' &&
        (h.type === 'rock' || h.type === 'jammer' || h.isJammer)
      ) {
        const bonus = 20;
        if (h.type === 'jammer' || h.isJammer) {
          const j = (ctx.jammers || []).find((jm) => jm && jm.id === h.id) || h;
          dealDamageToJammer(j, bonus);
        } else {
          h.hp = Math.max(0, h.hp - bonus);
        }
        spawnSparkBurst(h.x, 0.85, h.z, 0xffe066, 5, { size: 0.09 });
      }
      if (cur !== null) harvestPrevHp.set(h, h.hp);
    }

    // 2. Wooden Club melee stun when Boots strikes an FBI agent via player.js melee
    for (const agent of ctx.fbi?.agents || []) {
      if (!agent) continue;
      const prev = agentPrevHp.get(agent);
      const cur = typeof agent.hp === 'number' ? agent.hp : null;
      if (
        prev !== undefined &&
        cur !== null &&
        cur < prev &&
        agent.state !== 'ko' &&
        cur > 0 &&
        eqId === 'wooden_club' &&
        ctx.player?.pos &&
        distXZ(ctx.player.pos.x, ctx.player.pos.z, agent.pos.x, agent.pos.z) <= 2.9
      ) {
        applyAgentCC(agent, 'stun', 2.0);
        spawnShockwaveRing(agent.pos.x, agent.pos.z, 0xffd43b, 1.35, 0.35, false);
      }
      if (cur !== null) agentPrevHp.set(agent, cur);
    }

    // 3. Camo Bush animation & auto-break on sprint / attack / death
    const px = ctx.player?.pos?.x ?? prevPlayerX;
    const pz = ctx.player?.pos?.z ?? prevPlayerZ;
    const moveSpeed = dt > 0.0001 ? distXZ(px, pz, prevPlayerX, prevPlayerZ) / dt : 0;
    prevPlayerX = px;
    prevPlayerZ = pz;

    if (ctx.player?.camoActive) {
      if (ctx.player.isDead) {
        setCamoState(false, 'death');
        return;
      }

      if (camoGraceTimer > 0) {
        camoGraceTimer = Math.max(0, camoGraceTimer - dt);
      } else {
        const activeClip = ctx.models?.tarcy?.activeClip || '';
        const isSprinting = activeClip === 'Run' || moveSpeed > 5.6;
        const isAttacking = activeClip === 'Chop_Mine';
        if (isSprinting || isAttacking) {
          setCamoState(false, 'break');
          return;
        }
      }

      // Gentle bush rustle when moving, settled when still
      if (camoBushMesh.visible) {
        if (moveSpeed > 0.3) {
          camoBushMesh.rotation.z = Math.sin(elapsed * 11.0) * 0.075;
          camoBushMesh.position.y = 0.04 + Math.abs(Math.sin(elapsed * 11.0)) * 0.04;
        } else {
          camoBushMesh.rotation.z *= 0.85;
          camoBushMesh.position.y = -0.02;
        }
      }

      // Gently reduce soft alert of distant patrolling FBI agents while hidden
      for (const agent of getActiveAgents()) {
        if (agent.isBoss) continue;
        const d = distXZ(px, pz, agent.pos.x, agent.pos.z);
        if (d > 2.4 && (agent.alert || 0) < 55 && !agent._seesPlayer) {
          agent.alert = Math.max(0, (agent.alert || 0) - 10 * dt);
        }
      }
    } else if (camoBushMesh.visible) {
      camoBushMesh.visible = false;
    }
  }

  // --- Projectile & Visual Effects Tick ---

  function updateProjectilesAndVfx(dt) {
    // 1. Arcing EMP Grenades
    for (let i = empProjectiles.length - 1; i >= 0; i -= 1) {
      const p = empProjectiles[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.duration);
      const x = THREE.MathUtils.lerp(p.start.x, p.end.x, t);
      const z = THREE.MathUtils.lerp(p.start.z, p.end.z, t);
      const y = THREE.MathUtils.lerp(p.start.y, p.end.y, t) + Math.sin(t * Math.PI) * p.arcHeight;
      p.mesh.position.set(x, y, z);
      p.mesh.rotation.y += dt * 9.0;
      if (p.mesh.userData.ring) {
        p.mesh.userData.ring.rotation.x += dt * 11.0;
      }

      if (t >= 1) {
        ctx.scene?.remove(p.mesh);
        disposeObjectTree(p.mesh);
        empProjectiles.splice(i, 1);
        detonateEmp(p.end.x, p.end.z);
      }
    }

    // 2. Sleep-Dart Blowpipe Projectiles
    for (let i = dartProjectiles.length - 1; i >= 0; i -= 1) {
      const d = dartProjectiles[i];
      d.age += dt;
      const t = Math.min(1, d.age / d.duration);

      if (d.targetAgent?.pos && d.targetAgent.state !== 'ko') {
        d.end.set(d.targetAgent.pos.x, 1.05, d.targetAgent.pos.z);
      }
      d.mesh.position.lerpVectors(d.start, d.end, t);
      d.mesh.lookAt(d.end);

      if (t >= 1) {
        ctx.scene?.remove(d.mesh);
        disposeObjectTree(d.mesh);
        dartProjectiles.splice(i, 1);

        if (d.targetAgent && d.targetAgent.state !== 'ko') {
          dealDamageToAgent(d.targetAgent, d.damage, ctx.player?.pos);
          if (
            d.targetAgent.state !== 'ko' &&
            (typeof d.targetAgent.hp !== 'number' || d.targetAgent.hp > 0)
          ) {
            applyAgentCC(d.targetAgent, 'sleep', d.sleepDuration);
          }
          spawnSparkBurst(d.end.x, 1.0, d.end.z, 0xa78bfa, 7, { shape: 'sphere' });
          ctx.systems?.audio?.playSfx?.('hit');
        }
      }
    }

    // 3. Flying Coconut Turret Projectiles
    for (let i = coconutProjectiles.length - 1; i >= 0; i -= 1) {
      const c = coconutProjectiles[i];
      c.age += dt;
      const t = Math.min(1, c.age / c.duration);

      if (c.targetAgent?.pos && c.targetAgent.state !== 'ko') {
        c.end.set(c.targetAgent.pos.x, 0.95, c.targetAgent.pos.z);
      }
      const x = THREE.MathUtils.lerp(c.start.x, c.end.x, t);
      const z = THREE.MathUtils.lerp(c.start.z, c.end.z, t);
      const y = THREE.MathUtils.lerp(c.start.y, c.end.y, t) + Math.sin(t * Math.PI) * c.arcHeight;
      c.mesh.position.set(x, y, z);
      c.mesh.rotation.x += dt * 14.0;
      c.mesh.rotation.z += dt * 9.0;

      if (t >= 1) {
        ctx.scene?.remove(c.mesh);
        disposeObjectTree(c.mesh);
        coconutProjectiles.splice(i, 1);

        if (c.targetAgent && c.targetAgent.state !== 'ko') {
          dealDamageToAgent(c.targetAgent, c.damage, c.turretPos);
          spawnSparkBurst(c.end.x, 0.95, c.end.z, 0x7c4d2b, 5, { size: 0.1 });
          spawnSparkBurst(c.end.x, 0.95, c.end.z, 0xf8f9fa, 4, { shape: 'sphere', size: 0.07 });
          ctx.systems?.audio?.playSfx?.('hit');
        }
      }
    }

    // 4. Expanding Shockwaves / Rings
    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const sw = shockwaves[i];
      sw.age += dt;
      const t = Math.min(1, sw.age / sw.duration);
      const ease = 1 - Math.pow(1 - t, 2.2);
      const s = 0.4 + ease * sw.maxScale;
      sw.group.scale.set(s, 1, s);
      sw.ringMat.opacity = (1 - t) * 0.9;
      sw.innerMat.opacity = (1 - t) * 0.85;
      if (sw.domeMat && sw.domeMesh) {
        sw.domeMesh.scale.set(1, 0.65 + ease * 0.55, 1);
        sw.domeMat.opacity = (1 - t) * 0.38;
      }
      if (sw.flashLight) {
        sw.flashLight.intensity = (1 - t) * 4.5;
      }
      if (t >= 1) {
        ctx.scene?.remove(sw.group);
        disposeObjectTree(sw.group);
        shockwaves.splice(i, 1);
      }
    }

    // 5. Burst Particles
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.duration) {
        ctx.scene?.remove(p.mesh);
        p.geo.dispose();
        p.mat.dispose();
        particles.splice(i, 1);
      } else {
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0.06, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += 7 * dt;
        p.mesh.rotation.y += 5 * dt;
        const frac = 1 - p.age / p.duration;
        p.mesh.scale.setScalar(Math.max(0.05, frac));
        p.mat.opacity = frac * 0.95;
      }
    }

    // 6. Newly Placed Building Pop-In Animations
    for (let i = buildPopAnims.length - 1; i >= 0; i -= 1) {
      const anim = buildPopAnims[i];
      anim.age += dt;
      const t = Math.min(1, anim.age / anim.duration);
      const ease = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5);
      anim.mesh.scale.set(ease, ease, ease);
      if (t >= 1) {
        anim.mesh.scale.set(1, 1, 1);
        buildPopAnims.splice(i, 1);
      }
    }
  }

  // --- Browser Pointer & Keyboard Event Wiring (Capture Phase Guard) ---

  const canvas =
    ctx.canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);

  function updatePointerNdc(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerNdc = true;
  }

  function onPointerMove(e) {
    if (!canvas) return;
    updatePointerNdc(e);
    if (activeBlueprint) {
      updateGhostFromCursor();
    }
  }

  function onPointerDown(e) {
    if (!activeBlueprint) return;
    if (!canvas || e.target !== canvas) return;
    updatePointerNdc(e);

    if (e.button === 2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancelBlueprint();
      return;
    }

    if (e.button === 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      placeActiveBlueprint();
    }
  }

  function onKeyDown(e) {
    if (isEditableTarget(e.target)) return;

    // Intercept Esc / F cleanly while placing an expanded blueprint
    if (activeBlueprint) {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelBlueprint();
        return;
      }
      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        e.stopImmediatePropagation();
        placeActiveBlueprint();
        return;
      }
    }

    // Space support for Blowpipe ranged shots & Stone Spear extended-reach thrusts
    if (
      e.code === 'Space' &&
      !e.repeat &&
      !activeBlueprint &&
      !ctx.cutsceneActive &&
      !ctx.player?.isDead
    ) {
      const selected = getSelectedItem();
      const selId = resolveItemId(selected);
      if (selId === 'blowpipe') {
        e.preventDefault();
        e.stopImmediatePropagation();
        fireBlowpipe();
      } else if (selId === 'stone_spear') {
        const p = ctx.player?.pos;
        if (p) {
          const closeAgent = findNearestActiveAgent(p.x, p.z, 2.4);
          const extendedAgent = findNearestActiveAgent(p.x, p.z, 3.85);
          if (!closeAgent && extendedAgent) {
            e.preventDefault();
            e.stopImmediatePropagation();
            strikeStoneSpear();
          }
        }
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  // --- Main Per-Frame Update ---

  function step(dt) {
    elapsed += dt;

    if (blowpipeCooldown > 0) blowpipeCooldown = Math.max(0, blowpipeCooldown - dt);
    if (empCooldown > 0) empCooldown = Math.max(0, empCooldown - dt);
    if (camoToggleCooldown > 0) camoToggleCooldown = Math.max(0, camoToggleCooldown - dt);
    if (smoothieCooldown > 0) smoothieCooldown = Math.max(0, smoothieCooldown - dt);
    if (spearCooldown > 0) spearCooldown = Math.max(0, spearCooldown - dt);
    if (clubCooldown > 0) clubCooldown = Math.max(0, clubCooldown - dt);

    if (ctx.player?.isDead && activeBlueprint) {
      cancelBlueprint();
    }

    if (activeBlueprint) {
      updateGhostFromCursor();
    }

    updateToolPerksAndCamo(dt);
    updateTrapsAndTurrets(dt);
    updateProjectilesAndVfx(dt);
    updateAgentCC(dt);
    updateSweepSystem(dt);
  }

  function update(rawDt) {
    const total = Number.isFinite(rawDt) ? Math.max(0, Math.min(rawDt, 120)) : 0;
    if (total <= 0) return;
    if (total <= 0.25) {
      step(total);
      return;
    }
    // Substep larger synthetic test deltas cleanly so warnings, flight arcs & timers fire accurately
    const maxStep = total <= 2.0 ? 0.1 : 0.25;
    let remaining = total;
    while (remaining > 1e-6) {
      const slice = Math.min(remaining, maxStep);
      step(slice);
      remaining -= slice;
    }
  }

  return {
    update,
    getTieredRecipes,
    getTieredBlueprints,
    craftItem,
    startBlueprint,
    cancelBlueprint,
    isPlacingBlueprint: () => activeBlueprint !== null,
    useExpandedItem,
    getSweepStatus,
    placeActiveBlueprint,
  };
}
