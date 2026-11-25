import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import { createPlayerSystem } from './systems/player.js';
import { createCompanionSystem } from './systems/companions.js';
import { createFBISystem } from './systems/fbi_ai.js';
import { createDeathLoopSystem } from './systems/death_loop.js';
import { createAudioSystem } from './systems/audio.js';
import { createCutsceneSystem } from './systems/cutscenes.js';
import { createStoryManager } from './systems/story_manager.js';
import { createExpandedCraftingSystem } from './systems/crafting_expanded.js';
import { createBossFinaleSystem } from './systems/boss_finale.js';
import { buildExpandedIslandMap, WORLD_BOUNDS } from './world/island_map.js';

const MODEL_PATHS = {
  tarcy: './models/tarcy_boots.glb',
  dos: './models/dos.glb',
  crockstar: './models/crockstar.glb',
  smuff: './models/smuff.glb',
  fbi: './models/fbi_agent.glb',
  env: './models/env_kit.glb',
  vance: './models/director_vance.glb',
};

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

function createAnimatedModel(sceneObj, animations, mixers) {
  enableShadows(sceneObj);
  const mixer = new THREE.AnimationMixer(sceneObj);
  mixers.push(mixer);

  const clips = animations || [];
  const actions = {};
  for (const clip of clips) {
    actions[clip.name] = mixer.clipAction(clip);
  }

  const entry = {
    scene: sceneObj,
    animations: clips,
    mixer,
    actions,
    activeClip: '',
    activeAction: null,
    play(clipName, fadeSec = 0.18) {
      let resolvedName = clipName;
      let next = actions[clipName];
      if (!next && typeof clipName === 'string') {
        const lower = clipName.toLowerCase();
        const foundKey = Object.keys(actions).find((k) => k.toLowerCase() === lower);
        if (foundKey) {
          resolvedName = foundKey;
          next = actions[foundKey];
        }
      }
      if (!next) return false;

      if (entry.activeClip === resolvedName && entry.activeAction && entry.activeAction.isRunning()) {
        return true;
      }

      const prev = entry.activeAction;
      next.enabled = true;
      next.reset();
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);

      if (resolvedName === 'Death' || resolvedName === 'Defeat') {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      }

      next.play();
      if (prev && prev !== next) {
        if (fadeSec > 0) {
          prev.crossFadeTo(next, fadeSec, false);
        } else {
          prev.stop();
        }
      }

      entry.activeAction = next;
      entry.activeClip = resolvedName;
      return true;
    },
  };

  return entry;
}

/**
 * Graceful fallback mesh if director_vance.glb ever fails to load.
 */
function createFallbackVanceGltf(gradientMap) {
  const group = new THREE.Group();
  group.name = 'Director_Vance_Fallback';

  const armorMat = new THREE.MeshToonMaterial({ color: 0x1e242c, gradientMap });
  const goldMat = new THREE.MeshToonMaterial({ color: 0xf2c230, gradientMap });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111317, side: THREE.BackSide });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.35, 0.9), armorMat);
  torso.position.y = 1.65;
  group.add(torso);

  const torsoOut = new THREE.Mesh(new THREE.BoxGeometry(1.33, 1.43, 0.98), outlineMat);
  torsoOut.position.copy(torso.position);
  group.add(torsoOut);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.62), armorMat);
  head.position.y = 2.62;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.1), visorMat);
  visor.position.set(0, 2.66, 0.31);
  group.add(visor);

  for (const sx of [-0.78, 0.78]) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.62), goldMat);
    pauldron.position.set(sx, 2.15, 0);
    group.add(pauldron);
  }

  for (const lx of [-0.36, 0.36]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 0.42), armorMat);
    leg.position.set(lx, 0.5, 0);
    group.add(leg);
  }

  return { scene: group, animations: [] };
}

function normalizeWaypoints(route) {
  if (!Array.isArray(route)) return [];
  const result = [];
  for (const pt of route) {
    if (!pt) continue;
    if (Array.isArray(pt) && pt.length >= 2) {
      const x = Number(pt[0]);
      const z = Number(pt[1]);
      if (Number.isFinite(x) && Number.isFinite(z)) {
        result.push(new THREE.Vector3(x, 0, z));
      }
    } else if (typeof pt === 'object' && Number.isFinite(pt.x) && Number.isFinite(pt.z)) {
      result.push(new THREE.Vector3(pt.x, 0, pt.z));
    }
  }
  return result;
}

function applyWorldPatrolRoutes(ctx, world) {
  const patrolRoutes = world?.patrolRoutes;
  if (!patrolRoutes || !Array.isArray(ctx.fbi?.agents) || ctx.fbi.agents.length === 0) return;

  const namedRoutes = [];
  if (Array.isArray(patrolRoutes)) {
    for (const r of patrolRoutes) {
      const wps = normalizeWaypoints(r);
      if (wps.length > 0) namedRoutes.push(wps);
    }
  } else if (typeof patrolRoutes === 'object') {
    const orderedKeys = ['westCamp', 'courtyard', 'northHq'];
    const seen = new Set();
    for (const key of orderedKeys) {
      if (patrolRoutes[key]) {
        const wps = normalizeWaypoints(patrolRoutes[key]);
        if (wps.length > 0) {
          namedRoutes.push(wps);
          seen.add(key);
        }
      }
    }
    for (const [key, val] of Object.entries(patrolRoutes)) {
      if (seen.has(key)) continue;
      const wps = normalizeWaypoints(val);
      if (wps.length > 0) namedRoutes.push(wps);
    }
  }

  if (namedRoutes.length === 0) return;

  const regularAgents = ctx.fbi.agents.filter((a) => a && !a.isBoss && a.id !== 'director_vance');

  // If 3 routes exist (westCamp, courtyard, northHq) and 2 initial agents exist,
  // guard Smuff's West Camp with agent 0 and combine courtyard + northHq for agent 1
  // (or assign 1-to-1 when counts match).
  const assignments = [];
  if (regularAgents.length === 2 && namedRoutes.length >= 3) {
    assignments.push(namedRoutes[0]);
    assignments.push([...namedRoutes[1], ...namedRoutes[2]]);
  } else {
    for (let i = 0; i < regularAgents.length; i++) {
      assignments.push(namedRoutes[i % namedRoutes.length]);
    }
  }

  regularAgents.forEach((agent, idx) => {
    const wps = assignments[idx];
    if (!wps || wps.length === 0) return;
    agent.waypoints = wps;
    agent.wpIndex = 0;
    const start = wps[0];
    if (agent.group?.position) {
      agent.group.position.set(start.x, 0, start.z);
    }
    if (wps.length > 1 && agent.group) {
      const next = wps[1];
      agent.group.rotation.y = Math.atan2(next.x - start.x, next.z - start.z);
    }
  });
}

export async function initGame(canvas, uiCallbacks = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x164a62);

  // 1. Locked 45° Isometric Orthographic Camera
  let frustumSize = 14.5;
  const aspect = window.innerWidth / window.innerHeight;
  const isoCamera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    180
  );
  const ISO_DIST = 28;
  const HORIZ = ISO_DIST * Math.cos(Math.PI / 4);
  const VERT = ISO_DIST * Math.sin(Math.PI / 4);
  const isoOffset = new THREE.Vector3(HORIZ * Math.SQRT1_2, VERT, HORIZ * Math.SQRT1_2);
  const camTarget = new THREE.Vector3(0, 0.4, 13);
  isoCamera.position.copy(camTarget).add(isoOffset);
  isoCamera.lookAt(camTarget);

  // 2. Free Orbit Inspection Perspective Camera + OrbitControls
  const orbitCamera = new THREE.PerspectiveCamera(44, aspect, 0.1, 220);
  orbitCamera.position.set(10, 12, 24);
  const orbitControls = new OrbitControls(orbitCamera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.target.copy(camTarget);
  orbitControls.minDistance = 3;
  orbitControls.maxDistance = 54;
  orbitControls.maxPolarAngle = Math.PI * 0.47;
  orbitControls.enabled = false;

  let cameraMode = 'iso'; // 'iso' | 'orbit'

  const updateIsoProjection = () => {
    const newAspect = window.innerWidth / window.innerHeight;
    isoCamera.left = (-frustumSize * newAspect) / 2;
    isoCamera.right = (frustumSize * newAspect) / 2;
    isoCamera.top = frustumSize / 2;
    isoCamera.bottom = -frustumSize / 2;
    isoCamera.updateProjectionMatrix();
  };

  // Gentle mouse-wheel zoom in Locked 45° Game View
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (cameraMode !== 'iso' || ctx?.cutsceneActive) return;
      frustumSize = THREE.MathUtils.clamp(frustumSize + e.deltaY * 0.008, 8.5, 24);
      updateIsoProjection();
    },
    { passive: true }
  );

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xe4f7e6, 0x2b3d2f, 0.94);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.65);
  sunLight.position.set(14, 24, 24);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 88;
  const shadowBound = 22;
  sunLight.shadow.camera.left = -shadowBound;
  sunLight.shadow.camera.right = shadowBound;
  sunLight.shadow.camera.top = shadowBound;
  sunLight.shadow.camera.bottom = -shadowBound;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const gradientMap = createTwoStepGradient();

  // Load all 7 GLB assets in parallel (with graceful fallback for director_vance.glb)
  const loader = new GLTFLoader();
  const loadGLB = (path) =>
    new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));

  const [tarcyGltf, dosGltf, crockstarGltf, smuffGltf, fbiGltf, envGltf, vanceGltf] =
    await Promise.all([
      loadGLB(MODEL_PATHS.tarcy),
      loadGLB(MODEL_PATHS.dos),
      loadGLB(MODEL_PATHS.crockstar),
      loadGLB(MODEL_PATHS.smuff),
      loadGLB(MODEL_PATHS.fbi),
      loadGLB(MODEL_PATHS.env),
      loadGLB(MODEL_PATHS.vance).catch((err) => {
        console.warn('Could not load director_vance.glb; using stylized fallback exo-mech:', err);
        return createFallbackVanceGltf(gradientMap);
      }),
    ]);

  const rawGltfs = {
    tarcy: tarcyGltf,
    dos: dosGltf,
    crockstar: crockstarGltf,
    smuff: smuffGltf,
    fbi: fbiGltf,
    vance: vanceGltf,
  };

  const mixers = [];
  const models = {
    tarcy: createAnimatedModel(tarcyGltf.scene, tarcyGltf.animations, mixers),
    dos: createAnimatedModel(dosGltf.scene, dosGltf.animations, mixers),
    crockstar: createAnimatedModel(crockstarGltf.scene, crockstarGltf.animations, mixers),
    smuff: createAnimatedModel(smuffGltf.scene, smuffGltf.animations, mixers),
    fbi: createAnimatedModel(SkeletonUtils.clone(fbiGltf.scene), fbiGltf.animations, mixers),
    vance: createAnimatedModel(vanceGltf.scene, vanceGltf.animations, mixers),
  };

  // Position primary characters in the 4-zone expanded island (Contract #29)
  models.tarcy.scene.position.set(0, 0, 13);
  models.tarcy.scene.rotation.y = Math.PI;
  models.tarcy.play('Idle', 0);
  scene.add(models.tarcy.scene);

  models.dos.scene.position.set(-1.8, 0, 13.5);
  models.dos.scene.rotation.y = Math.PI * 0.88;
  models.dos.play('Idle', 0);
  scene.add(models.dos.scene);

  models.crockstar.scene.position.set(9.5, 0, 11.5);
  models.crockstar.scene.rotation.y = -0.55;
  models.crockstar.play('Idle', 0);
  scene.add(models.crockstar.scene);

  models.smuff.scene.position.set(-18, 0, -4);
  models.smuff.scene.rotation.y = Math.PI * 0.25;
  models.smuff.play('Captured_Idle', 0);
  scene.add(models.smuff.scene);

  models.vance.scene.position.set(0, 0, -20);
  models.vance.scene.rotation.y = 0;
  models.vance.play('Idle', 0);
  scene.add(models.vance.scene);

  // Colliders registry & lightweight event bus
  const colliders = new Map();
  const listeners = new Map();

  // Starter Inventory (10 slots)
  const inventory = [
    { id: 'axe', name: 'Flimsy Axe', count: 1, type: 'tool' },
    { id: 'fish', name: 'Raw Fish', count: 2, type: 'food' },
    { id: 'wood', name: 'Wood', count: 6, type: 'resource' },
    { id: 'stone', name: 'Stone', count: 4, type: 'resource' },
    { id: 'fiber', name: 'Fiber', count: 4, type: 'resource' },
    { id: 'berries', name: 'Jungle Berries', count: 3, type: 'food' },
    null,
    null,
    null,
    null,
  ];

  // Suppress intermediate HUD redraws while boss agent is briefly hidden from fbi_ai.update
  let suppressHudUpdates = false;
  let deferredHudUpdate = false;

  // Shared Phase 3 Architecture Context (Contract #29)
  const ctx = {
    scene,
    getActiveCamera: () => (cameraMode === 'orbit' ? orbitCamera : isoCamera),
    canvas,
    envScene: envGltf.scene,
    models,
    cloneModel(id) {
      const raw = rawGltfs[id];
      if (!raw) {
        throw new Error(`Unknown model id for cloneModel: ${id}`);
      }
      const clonedScene = SkeletonUtils.clone(raw.scene);
      return createAnimatedModel(clonedScene, raw.animations, mixers);
    },
    worldBounds: { ...WORLD_BOUNDS },
    world: null,
    isWater(x, z) {
      return z > 18.5;
    },
    isBlocked(x, z, radius = 0.4) {
      for (const c of colliders.values()) {
        const dx = x - c.x;
        const dz = z - c.z;
        const minDist = c.radius + radius;
        if (dx * dx + dz * dz < minDist * minDist) {
          return true;
        }
      }
      return false;
    },
    addCollider(id, x, z, radius) {
      colliders.set(id, { id, x, z, radius });
    },
    removeCollider(id) {
      colliders.delete(id);
    },
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((fn) => fn(payload));
      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(event, { detail: payload }));
      }
    },
    player: {
      group: models.tarcy.scene,
      pos: models.tarcy.scene.position,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      isSneaking: false,
      camoActive: false,
      isDead: false,
      craftSpeedMultiplier: 1.0,
      selectedSlot: 0,
      inventory,
      addItem(item) {
        if (!item || !item.id) return false;
        const addCount = Math.max(1, item.count ?? 1);
        const itemType = item.type || 'resource';
        if (itemType !== 'tool') {
          const existing = inventory.find((slot) => slot && slot.id === item.id);
          if (existing) {
            existing.count += addCount;
            ctx.updateHud();
            return true;
          }
        }
        const emptyIdx = inventory.findIndex((slot) => slot === null);
        if (emptyIdx === -1) return false;
        inventory[emptyIdx] = {
          id: item.id,
          name: item.name || item.id,
          count: addCount,
          type: itemType,
        };
        ctx.updateHud();
        return true;
      },
      removeItem(id, count = 1) {
        if (ctx.player.countItem(id) < count) return false;
        let remaining = count;
        for (let i = 0; i < inventory.length && remaining > 0; i++) {
          const slot = inventory[i];
          if (!slot || slot.id !== id) continue;
          const take = Math.min(slot.count, remaining);
          slot.count -= take;
          remaining -= take;
          if (slot.count <= 0) {
            inventory[i] = null;
          }
        }
        if (id === 'tranq_darts') {
          ctx.systems.audio?.playSfx('tranq');
        }
        ctx.updateHud();
        return true;
      },
      countItem(id) {
        let total = 0;
        for (const slot of inventory) {
          if (slot && slot.id === id) total += slot.count;
        }
        return total;
      },
      clearInventory() {
        const dropped = [];
        for (let i = 0; i < inventory.length; i++) {
          if (inventory[i]) {
            dropped.push({ ...inventory[i] });
            inventory[i] = null;
          }
        }
        ctx.updateHud();
        return dropped;
      },
      takeDamage(amount, source = 'unknown') {
        if (ctx.cutsceneActive || ctx.player.isDead || amount <= 0) return;
        ctx.player.hp = Math.max(0, ctx.player.hp - amount);
        ctx.emit('player:damaged', { amount, source, hp: ctx.player.hp });
        if (uiCallbacks.onDamageFlash) uiCallbacks.onDamageFlash();
        if (ctx.player.hp > 0) {
          ctx.models.tarcy.play('Take_Damage', 0.08);
          ctx.systems.audio?.playSfx('hit');
          ctx.systems.audio?.playSfx('chirp');
        }
        ctx.updateHud();
        if (ctx.player.hp <= 0) {
          ctx.systems.audio?.playSfx('death');
          ctx.systems.death?.triggerDeath();
          ctx.systems.story?.recordEvent?.('player_died', { source });
        }
      },
      heal(amount) {
        if (ctx.player.isDead || amount <= 0) return;
        const prev = ctx.player.hp;
        ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + amount);
        if (ctx.player.hp > prev + 0.01) {
          ctx.systems.audio?.playSfx('heal');
        }
        ctx.updateHud();
      },
      respawnPoint: new THREE.Vector3(0, 0, 11),
    },
    harvestables: [],
    buildings: [],
    jammers: [],
    escapeVehicle: null,
    traps: [],
    turrets: [],
    cutsceneActive: false,
    story: {
      act: 1,
      waypoint: null,
      daysSurvived: 1,
      fbiEvaded: 0,
      deaths: 0,
    },
    companions: {
      dos: {
        group: models.dos.scene,
        pos: models.dos.scene.position,
        mode: 'follow',
        detectionMultiplier: 1.0,
        decoyPos: null,
        decoyTimer: 0,
      },
      crockstar: {
        group: models.crockstar.scene,
        pos: models.crockstar.scene.position,
        tamed: false,
        mode: 'wild',
        hp: 160,
        maxHp: 160,
        targetAgentId: null,
      },
    },
    fbi: {
      agents: [],
      smuff: {
        group: models.smuff.scene,
        pos: models.smuff.scene.position,
        rescued: false,
        cageMesh: null,
        cageColliderId: 'fbi_cage',
        followOffset: new THREE.Vector3(-1.3, 0, -1.2),
      },
      globalAlert: 0,
      isPlayerDetected: false,
    },
    deathCrates: [],
    systems: {
      audio: null,
      cutscenes: null,
      death: null,
      fbi: null,
      companions: null,
      player: null,
      crafting: null,
      boss: null,
      story: null,
    },
    toast(msg, tone = 'info') {
      if (uiCallbacks.onToast) uiCallbacks.onToast(msg, tone);
    },
    setPrompt(text) {
      if (uiCallbacks.onPrompt) uiCallbacks.onPrompt(text);
    },
    updateHud() {
      if (suppressHudUpdates) {
        deferredHudUpdate = true;
        return;
      }
      if (uiCallbacks.onUpdateHud) uiCallbacks.onUpdateHud(ctx);
    },
  };

  // Build the expanded 56x56 4-Zone Island Map
  const world = buildExpandedIslandMap(scene, envGltf.scene, gradientMap, ctx);
  ctx.world = world;
  if (typeof world?.isWater === 'function') {
    ctx.isWater = world.isWater;
  }
  if (Array.isArray(world?.jammers)) {
    ctx.jammers = world.jammers;
  }
  if (world?.escapeVehicle) {
    ctx.escapeVehicle = world.escapeVehicle;
  }
  // Ensure starter campfire checkpoint & Smuff's cage position align with Contract #29
  ctx.player.respawnPoint.set(0, 0, 11);
  if (ctx.fbi.smuff.group) {
    ctx.fbi.smuff.group.position.set(-18, 0, -4);
  }

  const animatedLights = world?.animatedLights || [];
  const animatedFlames = world?.animatedFlames || [];
  const waterFoamStrips = world?.waterFoamStrips || [];

  // Instantiate all 9 gameplay, story, cutscene, boss, crafting & audio systems
  ctx.systems.audio = createAudioSystem(ctx);
  ctx.systems.cutscenes = createCutsceneSystem(ctx);

  // Guard gameplay inputs during active cutscenes (registered after cutscenes, before player.js)
  if (typeof window !== 'undefined') {
    const cutsceneKeyGuard = (e) => {
      if (!ctx.cutsceneActive) return;
      if (e.code === 'KeyM') return; // Allow audio mute toggle during cutscenes
      e.stopImmediatePropagation();
    };
    const cutscenePointerGuard = (e) => {
      if (!ctx.cutsceneActive) return;
      if (e.target === canvas) {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', cutsceneKeyGuard);
    window.addEventListener('pointerdown', cutscenePointerGuard);
    window.addEventListener('pointerup', cutscenePointerGuard);
  }

  ctx.systems.death = createDeathLoopSystem(ctx);
  ctx.systems.fbi = createFBISystem(ctx);

  // Re-route initial FBI patrol waypoints onto the expanded 4-zone island patrol routes
  applyWorldPatrolRoutes(ctx, world);

  // Wrap FBI system:
  // 1) Route damage targeting Director Vance directly to ctx.systems.boss.damageVance + play 'hit' SFX
  // 2) Keep boss agent excluded during regular fbi_ai patrol/chase ticks so fbi_ai doesn't override Vance
  // 3) Hook Smuff rescue SFX + story event
  if (ctx.systems.fbi) {
    const rawDamageAgent = ctx.systems.fbi.damageAgent;
    ctx.systems.fbi.damageAgent = (agentId, amount, attackerPos) => {
      const target = ctx.fbi.agents.find((a) => a && a.id === agentId);
      if (agentId === 'director_vance' || target?.isBoss) {
        if (typeof ctx.systems.boss?.damageVance === 'function') {
          return ctx.systems.boss.damageVance(amount, attackerPos);
        }
        ctx.systems.audio?.playSfx('hit');
        return false;
      }
      const damaged = rawDamageAgent(agentId, amount, attackerPos);
      if (damaged) {
        ctx.systems.audio?.playSfx('hit');
      }
      return damaged;
    };

    const rawFbiUpdate = ctx.systems.fbi.update;
    ctx.systems.fbi.update = (dt) => {
      const agents = ctx.fbi.agents;
      const bossEntries = [];
      for (let i = agents.length - 1; i >= 0; i--) {
        const a = agents[i];
        if (a && (a.isBoss || a.id === 'director_vance')) {
          bossEntries.push(a);
          agents.splice(i, 1);
        }
      }

      if (bossEntries.length > 0) {
        suppressHudUpdates = true;
        deferredHudUpdate = false;
      }
      try {
        rawFbiUpdate(dt);
      } finally {
        for (let i = bossEntries.length - 1; i >= 0; i--) {
          agents.push(bossEntries[i]);
        }
        if (bossEntries.length > 0) {
          suppressHudUpdates = false;
          if (deferredHudUpdate) {
            deferredHudUpdate = false;
            ctx.updateHud();
          }
        }
      }
    };

    const rawTryRescueSmuff = ctx.systems.fbi.tryRescueSmuff;
    if (typeof rawTryRescueSmuff === 'function') {
      ctx.systems.fbi.tryRescueSmuff = () => {
        const wasRescued = Boolean(ctx.fbi?.smuff?.rescued);
        const ok = rawTryRescueSmuff();
        if (!wasRescued && ok) {
          ctx.systems.audio?.playSfx('victory');
          ctx.systems.story?.recordEvent?.('smuff_rescued');
        }
        return ok;
      };
    }
  }

  ctx.systems.companions = createCompanionSystem(ctx);

  // Hook companion SFX + story progression events
  if (ctx.systems.companions) {
    const rawTame = ctx.systems.companions.tryTameCrockstar;
    if (typeof rawTame === 'function') {
      ctx.systems.companions.tryTameCrockstar = () => {
        const wasTamed = Boolean(ctx.companions?.crockstar?.tamed);
        const ok = rawTame();
        if (!wasTamed && ok && ctx.companions?.crockstar?.tamed) {
          ctx.systems.audio?.playSfx('roar');
          ctx.systems.story?.recordEvent?.('crockstar_tamed');
        }
        return ok;
      };
    }

    const rawDecoy = ctx.systems.companions.deployDecoyBeacon;
    if (typeof rawDecoy === 'function') {
      ctx.systems.companions.deployDecoyBeacon = () => {
        const ok = rawDecoy();
        if (ok) ctx.systems.audio?.playSfx('radio');
        return ok;
      };
    }

    const rawSetDosMode = ctx.systems.companions.setDosMode;
    if (typeof rawSetDosMode === 'function') {
      ctx.systems.companions.setDosMode = (mode) => {
        const ok = rawSetDosMode(mode);
        if (ok && mode === 'undercover') {
          ctx.systems.audio?.playSfx('radio');
          ctx.systems.story?.recordEvent?.('dos_undercover');
        }
        return ok;
      };
    }
  }

  ctx.systems.player = createPlayerSystem(ctx);
  if (ctx.systems.player?.craftRecipe) {
    const rawCraftRecipe = ctx.systems.player.craftRecipe;
    ctx.systems.player.craftRecipe = (id) => {
      const ok = rawCraftRecipe(id);
      if (ok) ctx.systems.audio?.playSfx('craft');
      return ok;
    };
  }

  ctx.systems.crafting = createExpandedCraftingSystem(ctx);
  ctx.systems.boss = createBossFinaleSystem(ctx);
  ctx.systems.story = createStoryManager(ctx);

  // Ensure every spawned FBI agent's group is mounted in the scene
  for (const agent of ctx.fbi.agents) {
    if (agent?.group && !agent.group.parent) {
      scene.add(agent.group);
    }
  }

  // Reveal initial fog-of-war around Boots on South Beach
  ctx.world?.revealFog?.(ctx.player.pos.x, ctx.player.pos.z, 10);

  // Track harvestable HP deltas for automatic chop / mine SFX without editing player.js
  const lastHarvestHp = new WeakMap();
  for (const h of ctx.harvestables) {
    if (h) lastHarvestHp.set(h, h.hp ?? 0);
  }

  function pollHarvestSfx() {
    for (const h of ctx.harvestables) {
      if (!h) continue;
      const curHp = h.hp ?? 0;
      const prevHp = lastHarvestHp.has(h) ? lastHarvestHp.get(h) : curHp;
      if (curHp < prevHp) {
        if (h.type === 'rock' || h.isJammer || h.type === 'jammer') {
          ctx.systems.audio?.playSfx('mine');
        } else {
          ctx.systems.audio?.playSfx('chop');
        }
      }
      lastHarvestHp.set(h, curHp);
    }
  }

  // Camera mode controller
  const setCameraMode = (mode) => {
    cameraMode = mode;
    orbitControls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      const p = ctx.player.pos;
      orbitControls.target.set(p.x, 0.7, p.z);
      orbitCamera.position.set(p.x + 8.5, 8.5, p.z + 10.5);
      orbitControls.update();
    }
  };

  window.addEventListener('resize', () => {
    updateIsoProjection();
    orbitCamera.aspect = window.innerWidth / window.innerHeight;
    orbitCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Initial HUD sync & launch 4-Act Story Campaign
  ctx.updateHud();
  ctx.systems.story?.startCampaign?.();

  // Main 60 FPS game loop
  const clock = new THREE.Clock();
  let hudSyncAccum = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.08);
    const elapsed = clock.elapsedTime;

    // 1. Always reveal fog around Boots, tick audio, skeletal mixers & ambient world animations
    ctx.world?.revealFog?.(ctx.player.pos.x, ctx.player.pos.z, 10);
    ctx.systems.audio?.update?.(dt);

    for (const mixer of mixers) {
      mixer.update(dt);
    }

    for (const item of animatedLights) {
      if (item?.light) {
        item.light.intensity = item.base + Math.sin(elapsed * 9.2 + (item.phase || 0)) * item.amp;
      }
    }
    for (const b of ctx.buildings) {
      if (b?.type === 'campfire' && b.light && !animatedLights.some((l) => l.light === b.light)) {
        b.light.intensity = 2.4 + Math.sin(elapsed * 8.5 + b.x) * 0.4;
      }
    }
    for (const f of animatedFlames) {
      const pulse = 1 + Math.sin(elapsed * 12 + (f.phase || 0)) * 0.14;
      if (f.outer) f.outer.scale.set(1, pulse, 1);
      if (f.inner) f.inner.scale.set(1, 1 + Math.cos(elapsed * 15 + (f.phase || 0)) * 0.16, 1);
    }
    for (const strip of waterFoamStrips) {
      if (!strip) continue;
      const baseZ = strip.userData?.baseZ ?? strip.position.z;
      const phase = strip.userData?.phase ?? 0;
      strip.position.z = baseZ + Math.sin(elapsed * 1.8 + phase) * 0.14;
      if (strip.material) {
        strip.material.opacity = 0.55 + Math.sin(elapsed * 2.2 + phase) * 0.2;
      }
    }

    // 2. Branch cleanly between Cinematic Cutscene Director & Active Gameplay
    if (ctx.cutsceneActive) {
      ctx.systems.cutscenes?.update?.(dt);
      // Allow ending escape helicopter liftoff & defeat sparks to animate during the finale cutscene
      if (ctx.systems.boss?.getBossState?.()?.defeated) {
        ctx.systems.boss.update(dt);
      }
      const cutCam = ctx.systems.cutscenes?.getCamera?.() || isoCamera;

      // Keep directional sun shadows centered near cutscene focus
      sunLight.position.set(camTarget.x + 14, 24, camTarget.z + 12);
      sunLight.target.position.set(camTarget.x, 0, camTarget.z);
      sunLight.target.updateMatrixWorld();

      renderer.render(scene, cutCam);
    } else {
      ctx.systems.player?.update?.(dt);
      ctx.systems.companions?.update?.(dt);
      ctx.systems.fbi?.update?.(dt);
      ctx.systems.death?.update?.(dt);
      ctx.systems.crafting?.update?.(dt);
      ctx.systems.boss?.update?.(dt);
      ctx.systems.story?.update?.(dt);

      pollHarvestSfx();

      // Camera tracking & dynamic sun shadow follow
      const p = ctx.player.pos;
      const followAlpha = 1 - Math.exp(-7 * dt);
      camTarget.x = THREE.MathUtils.lerp(camTarget.x, p.x, followAlpha);
      camTarget.z = THREE.MathUtils.lerp(camTarget.z, p.z, followAlpha);

      sunLight.position.set(camTarget.x + 14, 24, camTarget.z + 12);
      sunLight.target.position.set(camTarget.x, 0, camTarget.z);
      sunLight.target.updateMatrixWorld();

      if (cameraMode === 'orbit') {
        orbitControls.update();
        renderer.render(scene, orbitCamera);
      } else {
        isoCamera.position.copy(camTarget).add(isoOffset);
        isoCamera.lookAt(camTarget);
        renderer.render(scene, isoCamera);
      }
    }

    // 3. Periodic HUD + live minimap refresh (~16 Hz)
    hudSyncAccum += dt;
    if (hudSyncAccum >= 0.06) {
      hudSyncAccum = 0;
      ctx.updateHud();
    }
  }

  animate();

  return {
    ctx,
    setCameraMode,
    getCameraMode: () => cameraMode,
  };
}
