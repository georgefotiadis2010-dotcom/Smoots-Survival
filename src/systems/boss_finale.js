import * as THREE from 'three';

const BOSS_ID = 'director_vance';
const BOSS_MAX_HP = 400;
const BOSS_SPAWN_POS = new THREE.Vector3(0, 0, -20);
const ARENA_CENTER = new THREE.Vector3(0, 0, -19);
const ARENA_BOUNDS = { minX: -11.5, maxX: 11.5, minZ: -23.5, maxZ: -12.5 };
const NORTH_HQ_TRIGGER_Z = -10.5;

const BOSS_WALK_SPEED = 2.45;
const LASER_TELEGRAPH_SEC = 0.8;
const LASER_SWEEP_SEC = 0.85;
const LASER_RECOVER_SEC = 0.45;
const LASER_ARC_RAD = THREE.MathUtils.degToRad(70);
const LASER_RANGE = 9.5;
const LASER_DAMAGE = 24;

const NET_WINDUP_SEC = 0.35;
const NET_RECOVER_SEC = 0.5;
const NET_SPEED = 11.8;
const NET_MAX_LIFE = 1.45;
const NET_DAMAGE = 16;
const NET_SLOW_SEC = 2.2;

const INITIAL_STUN_SEC = 4.0;
const MID_FIGHT_REBOOT_SEC = 5.0;
const MID_FIGHT_STUN_SEC = 3.0;
const DEFEAT_CUTSCENE_DELAY_SEC = 1.25;

const DEFAULT_HELIPAD_POS = new THREE.Vector3(0, 0, -25);

function shortestAngleDiff(from, to) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function rotateToward(obj, targetAngle, speed, dt) {
  if (!obj) return;
  const diff = shortestAngleDiff(obj.rotation.y, targetAngle);
  const step = Math.min(Math.abs(diff), speed * dt);
  obj.rotation.y += Math.sign(diff) * step;
}

function distXZ(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));
}

function clampArena(x, z, worldBounds) {
  const minX = Math.max(ARENA_BOUNDS.minX, (worldBounds?.minX ?? -28) + 1.2);
  const maxX = Math.min(ARENA_BOUNDS.maxX, (worldBounds?.maxX ?? 28) - 1.2);
  const minZ = Math.max(ARENA_BOUNDS.minZ, (worldBounds?.minZ ?? -28) + 1.2);
  const maxZ = Math.min(ARENA_BOUNDS.maxZ, (worldBounds?.maxZ ?? 28) - 1.2);
  return {
    x: THREE.MathUtils.clamp(x, minX, maxX),
    z: THREE.MathUtils.clamp(z, minZ, maxZ),
  };
}

function isolateNonOutlineMaterials(root) {
  const records = [];
  if (!root || typeof root.traverse !== 'function') return records;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cloned = mats.map((m) => {
      const name = (m.name || '').toLowerCase();
      if (name.includes('outline')) return m;
      const copy = m.clone();
      records.push({
        mat: copy,
        origColor: copy.color ? copy.color.clone() : null,
        origEmissive: copy.emissive ? copy.emissive.clone() : null,
        origEmissiveIntensity:
          typeof copy.emissiveIntensity === 'number' ? copy.emissiveIntensity : 0,
      });
      return copy;
    });
    obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
  });
  return records;
}

function applyHitFlash(records, active, colorHex = 0xff3b3b) {
  for (const r of records) {
    if (active) {
      if (r.mat.emissive) {
        r.mat.emissive.setHex(colorHex);
        r.mat.emissiveIntensity = 0.9;
      } else if (r.mat.color) {
        r.mat.color.setHex(colorHex);
      }
    } else {
      if (r.mat.emissive && r.origEmissive) {
        r.mat.emissive.copy(r.origEmissive);
        r.mat.emissiveIntensity = r.origEmissiveIntensity;
      }
      if (r.mat.color && r.origColor) {
        r.mat.color.copy(r.origColor);
      }
    }
  }
}

/**
 * Shimmering golden translucent energy dome shield around Director Vance.
 */
function createShieldDome() {
  const group = new THREE.Group();
  group.name = 'Vance_Golden_Shield';

  const outerGeo = new THREE.IcosahedronGeometry(1.58, 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.position.y = 1.22;
  outerMesh.renderOrder = 4;
  group.add(outerMesh);

  const latticeGeo = new THREE.IcosahedronGeometry(1.62, 1);
  const latticeMat = new THREE.MeshBasicMaterial({
    color: 0xfff08a,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const latticeMesh = new THREE.Mesh(latticeGeo, latticeMat);
  latticeMesh.position.y = 1.22;
  latticeMesh.renderOrder = 5;
  group.add(latticeMesh);

  const ringGeo = new THREE.RingGeometry(1.36, 1.64, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc82e,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const baseRing = new THREE.Mesh(ringGeo, ringMat);
  baseRing.position.y = 0.06;
  baseRing.renderOrder = 3;
  group.add(baseRing);

  return { group, outerMesh, outerMat, latticeMesh, latticeMat, baseRing, ringMat };
}

/**
 * 70-degree glowing red ground telegraph cone for Vance's Laser_Sweep.
 */
function createLaserTelegraphCone() {
  const halfArc = LASER_ARC_RAD * 0.5;
  const segments = 24;
  const positions = [0, 0, 0];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -halfArc + t * LASER_ARC_RAD;
    positions.push(Math.sin(angle) * LASER_RANGE, 0, Math.cos(angle) * LASER_RANGE);
  }
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color: 0xff2233,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Vance_Laser_Telegraph';
  mesh.position.y = 0.06;
  mesh.visible = false;
  mesh.renderOrder = 3;

  const rimPts = [new THREE.Vector3(0, 0.01, 0)];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -halfArc + t * LASER_ARC_RAD;
    rimPts.push(new THREE.Vector3(Math.sin(angle) * LASER_RANGE, 0.01, Math.cos(angle) * LASER_RANGE));
  }
  rimPts.push(new THREE.Vector3(0, 0.01, 0));

  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
  const rimMat = new THREE.LineBasicMaterial({
    color: 0xff5e6c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const rim = new THREE.Line(rimGeo, rimMat);
  mesh.add(rim);

  return { mesh, mat, rimMat };
}

/**
 * Active sweeping 3D red laser beam cylinder emitted from Vance's right cannon.
 */
function createLaserBeam() {
  const group = new THREE.Group();
  group.name = 'Vance_Laser_Beam';
  group.visible = false;

  const coreGeo = new THREE.CylinderGeometry(0.11, 0.14, LASER_RANGE, 8, 1, true);
  coreGeo.rotateX(Math.PI / 2);
  coreGeo.translate(0, 0, LASER_RANGE * 0.5);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfff0f2,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const glowGeo = new THREE.CylinderGeometry(0.28, 0.34, LASER_RANGE, 10, 1, true);
  glowGeo.rotateX(Math.PI / 2);
  glowGeo.translate(0, 0, LASER_RANGE * 0.5);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff1e2d,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  const flareGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const flareMat = new THREE.MeshBasicMaterial({
    color: 0xff4050,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const muzzleFlare = new THREE.Mesh(flareGeo, flareMat);
  group.add(muzzleFlare);

  return { group, coreMat, glowMat, flareMat };
}

/**
 * Glowing yellow-orange energy net projectile mesh for Vance's Net_Shot.
 */
function createEnergyNetMesh() {
  const group = new THREE.Group();
  group.name = 'Vance_Energy_Net';

  const ringGeo = new THREE.TorusGeometry(0.46, 0.055, 6, 12);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffa91f,
    transparent: true,
    opacity: 0.92,
  });
  const outerRing = new THREE.Mesh(ringGeo, ringMat);
  group.add(outerRing);

  const webMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.05), webMat);
    bar.rotation.y = (i * Math.PI) / 3;
    group.add(bar);
  }

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshBasicMaterial({ color: 0xff6b1a })
  );
  group.add(core);

  return group;
}

/**
 * Glowing cyan hack beam from Dos to Director Vance when dismantling shield.
 */
function createDosHackBeam() {
  const group = new THREE.Group();
  group.name = 'Dos_Cyan_Hack_Beam';
  group.visible = false;

  const beamGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 8, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 0.5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x22f2ff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  group.add(beam);

  const haloGeo = new THREE.CylinderGeometry(0.18, 0.18, 1, 8, 1, true);
  haloGeo.rotateX(Math.PI / 2);
  haloGeo.translate(0, 0, 0.5);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x00c8ff,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  const pulses = [];
  for (let i = 0; i < 3; i++) {
    const pGeo = new THREE.TorusGeometry(0.24, 0.04, 6, 12);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xa6fcff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(pGeo, pMat);
    group.add(ring);
    pulses.push(ring);
  }

  return { group, beam, halo, beamMat, haloMat, pulses };
}

/**
 * Injects cel-shaded dark-ink + gold-trim CSS for #boss-hud and #victory-screen safely once.
 */
function ensureBossUIStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('boss-finale-styles')) return;

  const style = document.createElement('style');
  style.id = 'boss-finale-styles';
  style.textContent = `
    #boss-hud {
      position: fixed;
      top: 66px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 32;
      width: min(460px, calc(100vw - 320px));
      min-width: 280px;
      padding: 10px 16px 12px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 24, 34, 0.94) 0%, rgba(12, 15, 22, 0.96) 100%);
      border: 3px solid #14171f;
      box-shadow:
        0 0 0 2px #f4c430,
        0 8px 22px rgba(0, 0, 0, 0.62);
      color: #fffdf4;
      font-family: "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif;
      pointer-events: none;
      user-select: none;
      transition: opacity 220ms ease, transform 220ms ease;
    }
    #boss-hud.is-hidden {
      display: none !important;
    }
    .boss-hud__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .boss-hud__name {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #ffd94a;
      text-transform: uppercase;
      text-shadow: -1px -1px 0 #111, 1px 1px 0 #111;
    }
    .boss-hud__hp-text {
      font-size: 12px;
      font-weight: 900;
      color: #ffccd2;
    }
    .boss-hud__bar-track {
      position: relative;
      height: 16px;
      border-radius: 999px;
      background: #1d212b;
      border: 2.5px solid #0d1016;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
    }
    .boss-hud__hp-fill {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #c9182b 0%, #ff3b4e 60%, #ff7582 100%);
      transition: width 160ms ease-out;
    }
    .boss-hud__shield-row {
      margin-top: 7px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.03em;
    }
    .boss-hud__shield-badge {
      padding: 3px 9px;
      border-radius: 999px;
      border: 2px solid #0d1016;
      background: linear-gradient(180deg, #ffe066 0%, #e0a81a 100%);
      color: #181a20;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .boss-hud__shield-badge.is-hacking {
      background: linear-gradient(180deg, #6ef7ff 0%, #15b8d9 100%);
      color: #082028;
    }
    .boss-hud__shield-badge.is-vulnerable {
      background: linear-gradient(180deg, #69db7c 0%, #2f9e44 100%);
      color: #0b2410;
    }
    .boss-hud__shield-badge.is-stunned {
      background: linear-gradient(180deg, #74e8ff 0%, #ffd43b 100%);
      color: #151820;
    }
    .boss-hud__jammers {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
    }
    .boss-hud__jammer-pip {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #0d1016;
      background: radial-gradient(circle at 35% 30%, #fff3a1, #f5b700 68%, #9e6b00 100%);
      box-shadow: 0 0 8px rgba(255, 209, 59, 0.7);
      transition: transform 180ms ease, background 180ms ease, opacity 180ms ease;
    }
    .boss-hud__jammer-pip.is-destroyed {
      background: #2f3542;
      box-shadow: none;
      opacity: 0.45;
      transform: scale(0.82);
    }

    #victory-screen {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: radial-gradient(circle at 50% 35%, rgba(255, 174, 66, 0.34), rgba(11, 16, 28, 0.88) 72%);
      backdrop-filter: blur(5px);
      font-family: "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #fffdf4;
      pointer-events: auto;
    }
    #victory-screen.is-hidden {
      display: none !important;
      pointer-events: none !important;
    }
    .victory-card {
      width: min(540px, 94vw);
      padding: 28px 30px 26px;
      border-radius: 22px;
      background: linear-gradient(180deg, #1b2232 0%, #121722 100%);
      border: 4px solid #12151c;
      box-shadow:
        0 0 0 3px #f5c536,
        0 20px 52px rgba(0, 0, 0, 0.72);
      text-align: center;
    }
    .victory-kicker {
      display: inline-block;
      padding: 4px 14px;
      margin-bottom: 10px;
      border-radius: 999px;
      background: #f5c536;
      color: #14171f;
      border: 2px solid #14171f;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .victory-title {
      font-size: 32px;
      font-weight: 900;
      line-height: 1.12;
      color: #fff6cf;
      text-shadow: 0 3px 0 #14171f, 0 0 18px rgba(245, 197, 54, 0.4);
      margin-bottom: 8px;
    }
    .victory-subtitle {
      font-size: 14px;
      line-height: 1.45;
      color: #d6e0f0;
      margin-bottom: 20px;
    }
    .victory-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }
    .victory-stat {
      padding: 14px 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 2.5px solid #0e121a;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    .victory-stat__val {
      font-size: 28px;
      font-weight: 900;
      color: #ffd94a;
      line-height: 1.1;
      text-shadow: 0 2px 0 #111;
    }
    .victory-stat__label {
      margin-top: 5px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #b8c7dc;
    }
    .victory-crew {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 22px;
    }
    .victory-crew__pill {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      background: rgba(46, 204, 113, 0.18);
      border: 1.5px solid #51cf66;
      color: #c7f9cc;
    }
    .victory-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .victory-btn {
      padding: 13px 24px;
      border-radius: 14px;
      border: 3px solid #11151d;
      font-family: inherit;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: transform 110ms ease, filter 110ms ease;
    }
    .victory-btn:hover {
      filter: brightness(1.08);
      transform: translateY(-2px);
    }
    .victory-btn:active {
      transform: translateY(1px);
    }
    .victory-btn--primary {
      background: linear-gradient(180deg, #ffe066 0%, #f5b700 100%);
      color: #161922;
      box-shadow: 0 5px 0 #8c6300, 0 8px 18px rgba(0, 0, 0, 0.45);
    }
  `;
  document.head.appendChild(style);
}

export function createBossFinaleSystem(ctx) {
  if (!ctx.fbi) {
    ctx.fbi = { agents: [], smuff: null, globalAlert: 0, isPlayerDetected: false };
  }
  if (!Array.isArray(ctx.fbi.agents)) {
    ctx.fbi.agents = [];
  }

  // -------------------------------------------------------------------------
  // 1. Director Vance Scene Entity & Registration in ctx.fbi.agents
  // -------------------------------------------------------------------------
  const vanceModel = ctx.models?.vance || null;
  const vanceGroup = vanceModel?.scene || new THREE.Group();
  if (!vanceGroup.name) vanceGroup.name = 'Director_Vance_Boss';

  // Place Vance at (0, 0, -20) facing South (+Z) toward approaching Boots
  if (
    Math.abs(vanceGroup.position.x) < 0.001 &&
    Math.abs(vanceGroup.position.z) < 0.001
  ) {
    vanceGroup.position.copy(BOSS_SPAWN_POS);
  }
  vanceGroup.position.y = 0;
  vanceGroup.rotation.y = 0;

  if (ctx.scene && !vanceGroup.parent) {
    ctx.scene.add(vanceGroup);
  }

  const vanceMatRecords = isolateNonOutlineMaterials(vanceGroup);

  let vanceAgent = ctx.fbi.agents.find((a) => a && a.id === BOSS_ID);
  if (!vanceAgent) {
    vanceAgent = {
      id: BOSS_ID,
      name: 'FBI Director Vance',
      isBoss: true,
      model: vanceModel,
      group: vanceGroup,
      pos: vanceGroup.position,
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      state: 'boss_idle',
      alert: 0,
      waypoints: [],
      visionMesh: null,
      shootCooldown: 99999,
      koTimer: 999999,
      shieldActive: true,
      _hitFlashTimer: 0,
    };
    ctx.fbi.agents.push(vanceAgent);
  } else {
    vanceAgent.isBoss = true;
    vanceAgent.model = vanceModel;
    vanceAgent.group = vanceGroup;
    vanceAgent.pos = vanceGroup.position;
    vanceAgent.hp = BOSS_MAX_HP;
    vanceAgent.maxHp = BOSS_MAX_HP;
    vanceAgent.state = 'boss_idle';
    vanceAgent.shieldActive = true;
    vanceAgent.waypoints = [];
    vanceAgent.visionMesh = null;
  }

  // -------------------------------------------------------------------------
  // 2. Boss Visual Effects Meshes (Shield, Laser, Hack Beam, Net Slow Ring)
  // -------------------------------------------------------------------------
  const shieldRig = createShieldDome();
  vanceGroup.add(shieldRig.group);

  const laserTelegraph = createLaserTelegraphCone();
  const laserBeam = createLaserBeam();
  const hackBeam = createDosHackBeam();

  const netSlowRingGeo = new THREE.TorusGeometry(0.68, 0.06, 6, 16);
  netSlowRingGeo.rotateX(Math.PI / 2);
  const netSlowRingMat = new THREE.MeshBasicMaterial({
    color: 0xffa91f,
    transparent: true,
    opacity: 0.85,
  });
  const netSlowRing = new THREE.Mesh(netSlowRingGeo, netSlowRingMat);
  netSlowRing.visible = false;

  if (ctx.scene) {
    ctx.scene.add(laserTelegraph.mesh);
    ctx.scene.add(laserBeam.group);
    ctx.scene.add(hackBeam.group);
    ctx.scene.add(netSlowRing);
  }

  // Dynamic tether lines connecting intact Signal Jammers -> Vance's shield
  const jammerTethers = new Map();

  // Transient VFX pools
  const particles = [];
  const rings = [];
  const netProjectiles = [];

  // -------------------------------------------------------------------------
  // 3. Boss Encounter & Finale State
  // -------------------------------------------------------------------------
  let elapsed = 0;
  let bossActive = false;
  let defeated = false;
  let shieldActive = true;
  let allJammersDownHandled = false;
  let midFightRebootTriggered = false;
  let shieldRebootTimer = 0;
  let stunTimer = 0;
  let hackBeamTimer = 0;
  let shieldFlashTimer = 0;
  let vanceHitFlashTimer = 0;
  let deflectToastCooldown = 0;
  let defeatCutsceneTimer = -1;
  let defeatSparkAccum = 0;
  let jammerSmokeAccum = 0;

  // Combat attack pattern state
  let attackState = 'idle'; // 'idle' | 'walk' | 'laser_telegraph' | 'laser_sweep' | 'laser_recover' | 'net_windup' | 'net_recover'
  let stateTimer = 0;
  let attackCooldown = 1.4;
  let nextAttackChoice = 'laser'; // alternates 'laser' <-> 'net'
  let laserBaseAngle = 0;
  let laserHitPlayer = false;
  let laserHitCrock = false;
  let walkTarget = new THREE.Vector3(0, 0, -18.5);
  let netSlowTimer = 0;
  let prevPlayerPos = ctx.player?.pos ? ctx.player.pos.clone() : null;

  // Ending cutscene & victory screen state
  let escapeTriggered = false;
  let escapeInProgress = false;
  let escapeLiftoffActive = false;
  let escapeLiftoffAge = 0;
  let savedVehiclePos = null;
  let savedVehicleRot = null;
  let savedSkyBg = null;
  let savedFogColor = null;
  let sunsetBlendActive = false;
  let victoryShown = false;
  let endlessMode = false;

  // Track broken jammers so we keep them darkened/tilted even after player.js's shrink FX
  const brokenJammerRecords = new Map();

  // -------------------------------------------------------------------------
  // 4. Non-Invasive Interop Hooks on ctx.systems.fbi
  // -------------------------------------------------------------------------
  function ensureFbiHooks() {
    const fbiSys = ctx.systems?.fbi;
    if (!fbiSys) return;

    // Prevent Phase 2 fbi_ai.js from hijacking Vance's movement, rotation, or tranq shooting
    if (typeof fbiSys.update === 'function' && !fbiSys.update._bossVanceGuarded) {
      const origUpdate = fbiSys.update;
      const wrappedUpdate = function bossGuardedFbiUpdate(dt) {
        const agents = ctx.fbi?.agents;
        let idx = -1;
        let stashed = null;
        if (Array.isArray(agents)) {
          idx = agents.indexOf(vanceAgent);
          if (idx !== -1) {
            stashed = agents.splice(idx, 1)[0];
          }
        }
        try {
          return origUpdate.call(this, dt);
        } finally {
          if (stashed && Array.isArray(agents) && !agents.includes(stashed)) {
            agents.splice(Math.min(idx, agents.length), 0, stashed);
          }
        }
      };
      wrappedUpdate._bossVanceGuarded = true;
      fbiSys.update = wrappedUpdate;
    }

    // Ensure fbi.damageAgent('director_vance', ...) ALWAYS routes cleanly to damageVance
    // even in standalone tests where game.js did not wrap it
    if (typeof fbiSys.damageAgent === 'function' && !fbiSys.damageAgent._bossVanceRouted) {
      const origDamageAgent = fbiSys.damageAgent;
      const wrappedDamageAgent = function bossRoutedDamageAgent(agentId, amount, attackerPos) {
        if (agentId === BOSS_ID) {
          return damageVance(amount, attackerPos);
        }
        return origDamageAgent.call(this, agentId, amount, attackerPos);
      };
      wrappedDamageAgent._bossVanceRouted = true;
      fbiSys.damageAgent = wrappedDamageAgent;
    }
  }

  ensureFbiHooks();

  // -------------------------------------------------------------------------
  // 5. DOM HUD (#boss-hud) & Victory Summary Screen (#victory-screen)
  // -------------------------------------------------------------------------
  let bossHudEl = null;
  let bossHpTextEl = null;
  let bossHpFillEl = null;
  let bossShieldBadgeEl = null;
  let bossJammerPipsEl = null;
  let victoryEl = null;
  let victoryDaysEl = null;
  let victoryEvadedEl = null;
  let victoryDeathsEl = null;
  let victoryCrewEl = null;

  function mountDOMUI() {
    if (typeof document === 'undefined' || !document.body) return;
    ensureBossUIStyles();

    bossHudEl = document.getElementById('boss-hud');
    if (!bossHudEl) {
      bossHudEl = document.createElement('div');
      bossHudEl.id = 'boss-hud';
      bossHudEl.className = 'is-hidden';
      bossHudEl.innerHTML = `
        <div class="boss-hud__header">
          <span class="boss-hud__name">★ FBI Director Vance — Exo-Mech</span>
          <span class="boss-hud__hp-text" id="boss-hud-hp-text">${BOSS_MAX_HP} / ${BOSS_MAX_HP}</span>
        </div>
        <div class="boss-hud__bar-track">
          <div class="boss-hud__hp-fill" id="boss-hud-hp-fill"></div>
        </div>
        <div class="boss-hud__shield-row">
          <span class="boss-hud__shield-badge" id="boss-hud-shield-badge">🛡 GOLDEN SHIELD ACTIVE</span>
          <div class="boss-hud__jammers" id="boss-hud-jammers" title="Signal Jammers"></div>
        </div>
      `;
      document.body.appendChild(bossHudEl);
    }
    bossHpTextEl = bossHudEl.querySelector('#boss-hud-hp-text');
    bossHpFillEl = bossHudEl.querySelector('#boss-hud-hp-fill');
    bossShieldBadgeEl = bossHudEl.querySelector('#boss-hud-shield-badge');
    bossJammerPipsEl = bossHudEl.querySelector('#boss-hud-jammers');

    victoryEl = document.getElementById('victory-screen');
    if (!victoryEl) {
      victoryEl = document.createElement('div');
      victoryEl.id = 'victory-screen';
      victoryEl.className = 'is-hidden';
      victoryEl.innerHTML = `
        <div class="victory-card">
          <div class="victory-kicker">MISSION COMPLETE · EXOTIC ISLAND LIBERATED</div>
          <h1 class="victory-title">VICTORY!</h1>
          <p class="victory-subtitle">
            FBI Director Vance's exo-mech is offline and Tarcy (Boots) escaped the federal dragnet with the whole island crew!
          </p>
          <div class="victory-stats">
            <div class="victory-stat">
              <div class="victory-stat__val" id="victory-stat-days">1</div>
              <div class="victory-stat__label">Days Survived</div>
            </div>
            <div class="victory-stat">
              <div class="victory-stat__val" id="victory-stat-evaded">0</div>
              <div class="victory-stat__label">FBI Evaded</div>
            </div>
            <div class="victory-stat">
              <div class="victory-stat__val" id="victory-stat-deaths">0</div>
              <div class="victory-stat__label">Deaths</div>
            </div>
          </div>
          <div class="victory-crew" id="victory-crew"></div>
          <div class="victory-actions">
            <button type="button" class="victory-btn victory-btn--primary" id="btn-endless-freeplay">
              🌴 Endless Island Free-Play
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(victoryEl);

      const endlessBtn = victoryEl.querySelector('#btn-endless-freeplay');
      if (endlessBtn) {
        endlessBtn.addEventListener('click', () => enterEndlessFreePlay());
      }
    }
    victoryDaysEl = victoryEl.querySelector('#victory-stat-days');
    victoryEvadedEl = victoryEl.querySelector('#victory-stat-evaded');
    victoryDeathsEl = victoryEl.querySelector('#victory-stat-deaths');
    victoryCrewEl = victoryEl.querySelector('#victory-crew');
  }

  mountDOMUI();

  // -------------------------------------------------------------------------
  // 6. Helpers: Jammers, Animations, VFX, HUD Sync
  // -------------------------------------------------------------------------
  function getJammers() {
    if (Array.isArray(ctx.jammers) && ctx.jammers.length > 0) {
      return ctx.jammers;
    }
    if (Array.isArray(ctx.harvestables)) {
      return ctx.harvestables.filter((h) => h && (h.isJammer || h.type === 'jammer'));
    }
    return [];
  }

  function getJammerCounts() {
    const list = getJammers();
    const total = list.length;
    let destroyed = 0;
    for (const j of list) {
      if (j.destroyed || j.depleted || (typeof j.hp === 'number' && j.hp <= 0)) {
        destroyed += 1;
      }
    }
    return { list, total, destroyed, remaining: Math.max(0, total - destroyed) };
  }

  function playVanceClip(clipName, fadeSec = 0.14, clampOnce = false) {
    if (!vanceModel || typeof vanceModel.play !== 'function') return;
    if (vanceModel.actions && !vanceModel.actions[clipName]) return;
    if (vanceModel.activeClip === clipName && !clampOnce) return;
    vanceModel.play(clipName, fadeSec);
    if (clampOnce && vanceModel.actions?.[clipName]) {
      const act = vanceModel.actions[clipName];
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
    }
  }

  function spawnRing(x, z, colorHex, maxScale = 2.8, duration = 0.65, y = 0.08) {
    if (!ctx.scene) return;
    const geo = new THREE.RingGeometry(0.32, 0.56, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 4;
    ctx.scene.add(mesh);
    rings.push({ mesh, geo, mat, age: 0, duration, maxScale });
  }

  function spawnBurstParticles(x, y, z, colors, count = 14, speed = 5.5, gravity = 10.5, scale = 0.22) {
    if (!ctx.scene) return;
    for (let i = 0; i < count; i++) {
      const col = colors[i % colors.length];
      const geo = new THREE.BoxGeometry(scale, scale, scale);
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.3) * 0.4,
        z + (Math.random() - 0.5) * 0.4
      );
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.75);
      ctx.scene.add(mesh);
      particles.push({
        mesh,
        geo,
        mat,
        vx: Math.cos(ang) * spd,
        vy: speed * (0.4 + Math.random() * 0.75),
        vz: Math.sin(ang) * spd,
        gravity,
        age: 0,
        duration: 0.45 + Math.random() * 0.45,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  function spawnCelExplosion(x, z) {
    if (!ctx.scene) return;
    // Cel-shaded fiery blast spheres + shockwave ring + debris sparks
    spawnRing(x, z, 0xff6b1a, 4.2, 0.75, 0.12);
    spawnRing(x, z, 0xffe047, 2.8, 0.5, 0.18);

    const blastColors = [0xff4d1a, 0xff922b, 0xffe047, 0x262930];
    spawnBurstParticles(x, 1.1, z, blastColors, 20, 6.4, 9.8, 0.28);

    // Expanding cel fireball core
    const fbGeo = new THREE.IcosahedronGeometry(0.65, 1);
    const fbMat = new THREE.MeshBasicMaterial({
      color: 0xff8c1a,
      transparent: true,
      opacity: 0.92,
    });
    const fb = new THREE.Mesh(fbGeo, fbMat);
    fb.position.set(x, 1.1, z);
    ctx.scene.add(fb);
    particles.push({
      mesh: fb,
      geo: fbGeo,
      mat: fbMat,
      vx: 0,
      vy: 1.6,
      vz: 0,
      gravity: 0,
      age: 0,
      duration: 0.48,
      spin: 4,
      growTo: 2.6,
    });
  }

  function syncBossHUD() {
    if (!bossHudEl) return;
    const show = bossActive && !defeated && !ctx.cutsceneActive && !victoryShown;
    bossHudEl.classList.toggle('is-hidden', !show);
    if (!show) return;

    const hp = Math.max(0, Math.round(vanceAgent.hp));
    const maxHp = Math.max(1, Math.round(vanceAgent.maxHp));
    const pct = THREE.MathUtils.clamp((hp / maxHp) * 100, 0, 100);

    if (bossHpTextEl) bossHpTextEl.textContent = `${hp} / ${maxHp} HP`;
    if (bossHpFillEl) bossHpFillEl.style.width = `${pct.toFixed(1)}%`;

    const { list, remaining, total } = getJammerCounts();

    if (bossShieldBadgeEl) {
      bossShieldBadgeEl.classList.remove('is-hacking', 'is-vulnerable', 'is-stunned');
      if (shieldActive && remaining > 0) {
        bossShieldBadgeEl.textContent = `🛡 GOLDEN SHIELD — Destroy Jammers (${remaining}/${total || 3} left)`;
      } else if (shieldActive && shieldRebootTimer > 0) {
        bossShieldBadgeEl.classList.add('is-hacking');
        bossShieldBadgeEl.textContent = `⚡ DOS RE-HACKING SHIELD (${shieldRebootTimer.toFixed(1)}s)`;
      } else if (stunTimer > 0) {
        bossShieldBadgeEl.classList.add('is-stunned');
        bossShieldBadgeEl.textContent = `⚡ STUNNED (${stunTimer.toFixed(1)}s) — ATTACK NOW!`;
      } else {
        bossShieldBadgeEl.classList.add('is-vulnerable');
        bossShieldBadgeEl.textContent = '🔓 SHIELD OFFLINE — DEAL FULL DAMAGE!';
      }
    }

    if (bossJammerPipsEl) {
      const pipCount = total > 0 ? total : 3;
      if (bossJammerPipsEl.children.length !== pipCount) {
        bossJammerPipsEl.innerHTML = '';
        for (let i = 0; i < pipCount; i++) {
          const pip = document.createElement('span');
          pip.className = 'boss-hud__jammer-pip';
          bossJammerPipsEl.appendChild(pip);
        }
      }
      for (let i = 0; i < pipCount; i++) {
        const j = list[i];
        const isDown = Boolean(j && (j.destroyed || j.depleted || j.hp <= 0));
        bossJammerPipsEl.children[i].classList.toggle('is-destroyed', isDown);
      }
    }
  }

  function ensureJammerTethers() {
    if (!ctx.scene) return;
    const { list } = getJammerCounts();
    for (const j of list) {
      const isDown = Boolean(j.destroyed || j.depleted || (typeof j.hp === 'number' && j.hp <= 0));
      let tether = jammerTethers.get(j.id);

      if (isDown || !shieldActive || defeated) {
        if (tether) {
          tether.line.visible = false;
        }
        continue;
      }

      if (!tether) {
        const pts = [new THREE.Vector3(), new THREE.Vector3()];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: 0xffd43b,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        line.name = `Jammer_Tether_${j.id}`;
        ctx.scene.add(line);
        tether = { line, geo, mat };
        jammerTethers.set(j.id, tether);
      }

      tether.line.visible = true;
      const posAttr = tether.geo.attributes.position;
      posAttr.setXYZ(0, j.x || 0, 2.35, j.z || 0);
      posAttr.setXYZ(1, vanceAgent.pos.x, 1.45, vanceAgent.pos.z);
      posAttr.needsUpdate = true;
      tether.mat.opacity = 0.45 + Math.sin(elapsed * 6.5 + (j.x || 0)) * 0.25;
    }
  }

  // -------------------------------------------------------------------------
  // 7. Boss Activation, Jammer Destruction & Dos Shield Hack
  // -------------------------------------------------------------------------
  function activateBossEncounter() {
    if (bossActive || defeated) return;
    bossActive = true;
    vanceAgent.state = stunTimer > 0 ? 'boss_stunned' : 'boss_active';
    attackState = 'walk';
    stateTimer = 1.2;
    attackCooldown = 1.3;

    ctx.systems?.audio?.setMusicMode?.('boss');
    ctx.systems?.audio?.playSfx?.('alert');
    spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0xffd23f, 4.0, 0.75);

    const { remaining } = getJammerCounts();
    if (remaining > 0) {
      ctx.toast?.(
        `FBI Director Vance engages! Destroy all ${remaining} Signal Jammers to drop his golden shield!`,
        'warn'
      );
    } else {
      ctx.toast?.('FBI Director Vance engages in North HQ!', 'warn');
    }
    syncBossHUD();
  }

  function applyBrokenTowerLook(jammer) {
    if (!jammer?.mesh) return;
    let rec = brokenJammerRecords.get(jammer.id);
    if (!rec) {
      const basePos = jammer.mesh.position.clone();
      rec = {
        basePos,
        tiltZ: (jammer.x || 0) >= 0 ? -0.44 : 0.44,
        tiltX: 0.24,
        darkened: false,
      };
      brokenJammerRecords.set(jammer.id, rec);
    }

    // Keep broken tower visible & tilted even if player.js tried to hide it when depleted
    jammer.mesh.visible = true;
    jammer.mesh.position.set(rec.basePos.x, rec.basePos.y - 0.08, rec.basePos.z);
    jammer.mesh.scale.set(1.0, 0.78, 1.0);
    jammer.mesh.rotation.z = rec.tiltZ;
    jammer.mesh.rotation.x = rec.tiltX;

    if (!rec.darkened && typeof jammer.mesh.traverse === 'function') {
      rec.darkened = true;
      jammer.mesh.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const darkened = mats.map((m) => {
          const name = (m.name || '').toLowerCase();
          if (name.includes('outline')) return m;
          const c = m.clone();
          if (c.color) c.color.setHex(0x232730);
          if (c.emissive) {
            c.emissive.setHex(0x000000);
            c.emissiveIntensity = 0;
          }
          return c;
        });
        child.material = Array.isArray(child.material) ? darkened : darkened[0];
      });
    }

    if (jammer.beaconLight) {
      jammer.beaconLight.intensity = 0;
      jammer.beaconLight.visible = false;
    }
    if (jammer.mesh?.userData?.targetRing) {
      jammer.mesh.userData.targetRing.visible = false;
    }
  }

  function triggerDosShieldHack({ isMidFightReboot = false } = {}) {
    if (defeated) return;

    // Dos plays Alert_Signal & projects glowing cyan hack beam onto Vance
    ctx.models?.dos?.play?.('Alert_Signal', 0.1);
    ctx.systems?.audio?.playSfx?.('radio');

    if (isMidFightReboot) {
      // Mid-fight 50% HP shield reboot: 5s recharge window while Dos actively hacks it back down
      shieldActive = true;
      vanceAgent.shieldActive = true;
      shieldRebootTimer = MID_FIGHT_REBOOT_SEC;
      hackBeamTimer = MID_FIGHT_REBOOT_SEC + 0.6;
      shieldFlashTimer = 0.35;
      ctx.systems?.audio?.playSfx?.('shield');
      spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0xffd23f, 3.8, 0.7);
      ctx.toast?.(
        'Vance initiated an emergency shield reboot! Dos is hacking back through it (5s)...',
        'warn'
      );
    } else {
      // All 3 jammers down: Dos immediately hacks & shatters Vance's golden shield!
      shieldActive = false;
      vanceAgent.shieldActive = false;
      stunTimer = INITIAL_STUN_SEC;
      vanceAgent.state = 'boss_stunned';
      attackState = 'idle';
      laserTelegraph.mesh.visible = false;
      laserBeam.group.visible = false;
      hackBeamTimer = 2.6;

      playVanceClip('Stunned', 0.1);
      spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0x22f2ff, 4.6, 0.8);
      spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0xffd43b, 3.4, 0.55);
      spawnBurstParticles(
        vanceAgent.pos.x,
        1.4,
        vanceAgent.pos.z,
        [0x22f2ff, 0xffe066, 0xffffff],
        18,
        5.8,
        8.5,
        0.2
      );
      ctx.toast?.(
        "Dos hacked Director Vance's shield! Vance is STUNNED — attack now!",
        'success'
      );
    }

    syncBossHUD();
  }

  function handleJammerDestroyed(jammer) {
    if (!jammer || jammer._bossDestroyedHandled) return;
    jammer._bossDestroyedHandled = true;
    jammer.hp = 0;
    jammer.depleted = true;
    jammer.destroyed = true;
    jammer.respawnTimer = 999999;

    ctx.removeCollider?.(jammer.id);
    activateBossEncounter();

    const jx = jammer.x ?? jammer.mesh?.position?.x ?? 0;
    const jz = jammer.z ?? jammer.mesh?.position?.z ?? -15;
    spawnCelExplosion(jx, jz);
    ctx.systems?.audio?.playSfx?.('explosion');
    applyBrokenTowerLook(jammer);

    const { total, destroyed, remaining } = getJammerCounts();
    ctx.systems?.story?.recordEvent?.('jammer_destroyed', {
      id: jammer.id,
      destroyed,
      total,
      remaining,
    });

    if (remaining > 0) {
      ctx.toast?.(`Signal Jammer destroyed! (${destroyed}/${total})`, 'success');
    } else {
      ctx.toast?.(`Signal Jammer destroyed! (${destroyed}/${total})`, 'success');
      if (!allJammersDownHandled) {
        allJammersDownHandled = true;
        triggerDosShieldHack({ isMidFightReboot: false });
      }
    }

    ctx.updateHud?.();
    syncBossHUD();
  }

  function damageJammer(idOrObj, amount) {
    const list = getJammers();
    const jammer =
      typeof idOrObj === 'object' && idOrObj !== null
        ? idOrObj
        : list.find((j) => j && j.id === idOrObj);
    if (!jammer || jammer.destroyed) return false;

    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return false;

    activateBossEncounter();
    const currentHp = typeof jammer.hp === 'number' ? jammer.hp : jammer.maxHp || 90;
    jammer.hp = Math.max(0, currentHp - dmg);

    const jx = jammer.x ?? jammer.mesh?.position?.x ?? 0;
    const jz = jammer.z ?? jammer.mesh?.position?.z ?? -15;
    spawnBurstParticles(jx, 1.2, jz, [0xffd43b, 0xff6b1a, 0x22f2ff], 7, 4.2, 9.5, 0.14);
    ctx.systems?.audio?.playSfx?.('hit');

    if (jammer.hp <= 0) {
      handleJammerDestroyed(jammer);
    } else {
      syncBossHUD();
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // 8. Damaging Director Vance & Defeat Sequence
  // -------------------------------------------------------------------------
  function handleVanceDefeated() {
    if (defeated) return;
    defeated = true;
    bossActive = false;
    shieldActive = false;
    shieldRebootTimer = 0;
    stunTimer = 0;
    hackBeamTimer = 0;
    attackState = 'defeated';

    vanceAgent.hp = 0;
    vanceAgent.shieldActive = false;
    vanceAgent.state = 'ko';
    vanceAgent.koTimer = 999999;

    // Clear active combat VFX
    shieldRig.group.visible = false;
    laserTelegraph.mesh.visible = false;
    laserBeam.group.visible = false;
    hackBeam.group.visible = false;
    netSlowRing.visible = false;
    netSlowTimer = 0;
    if (ctx.player) {
      ctx.player.isNetted = false;
      ctx.player.slowTimer = 0;
    }

    for (let i = netProjectiles.length - 1; i >= 0; i--) {
      const p = netProjectiles[i];
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      netProjectiles.splice(i, 1);
    }
    for (const t of jammerTethers.values()) {
      t.line.visible = false;
    }

    applyHitFlash(vanceMatRecords, false);
    playVanceClip('Defeat', 0.12, true);

    spawnCelExplosion(vanceAgent.pos.x, vanceAgent.pos.z);
    spawnBurstParticles(
      vanceAgent.pos.x,
      1.5,
      vanceAgent.pos.z,
      [0x22f2ff, 0xffe066, 0xff4d4d, 0xffffff],
      24,
      6.5,
      10.0,
      0.22
    );

    ctx.systems?.audio?.playSfx?.('explosion');
    ctx.systems?.audio?.setMusicMode?.('victory');
    ctx.systems?.story?.recordEvent?.('vance_defeated');

    syncBossHUD();
    ctx.toast?.(
      'FBI Director Vance defeated! Preparing extraction from North Beach Helipad!',
      'success'
    );
    ctx.updateHud?.();

    // Short dramatic beat so player sees Vance short-circuit & slump before ending cutscene
    defeatCutsceneTimer = DEFEAT_CUTSCENE_DELAY_SEC;
  }

  function damageVance(amount, sourcePos) {
    if (defeated || vanceAgent.hp <= 0) return false;
    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return false;

    activateBossEncounter();

    // Check if shield is currently active
    const { remaining } = getJammerCounts();
    if (shieldActive) {
      shieldFlashTimer = 0.28;
      ctx.systems?.audio?.playSfx?.('deflect');

      const hitX = sourcePos
        ? THREE.MathUtils.lerp(vanceAgent.pos.x, sourcePos.x, 0.45)
        : vanceAgent.pos.x;
      const hitZ = sourcePos
        ? THREE.MathUtils.lerp(vanceAgent.pos.z, sourcePos.z, 0.45)
        : vanceAgent.pos.z;
      spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0xffe066, 2.5, 0.36, 1.1);
      spawnBurstParticles(hitX, 1.25, hitZ, [0xffe066, 0xffffff], 7, 4.5, 7.0, 0.14);

      if (deflectToastCooldown <= 0) {
        deflectToastCooldown = 1.8;
        if (remaining > 0) {
          ctx.toast?.(
            'Director Vance is shielded! Destroy all 3 Signal Jammers first!',
            'warn'
          );
        } else {
          ctx.toast?.(
            "Vance's emergency shield is rebooting — Dos is breaking it now!",
            'warn'
          );
        }
      }
      return false;
    }

    // Apply real damage to Director Vance
    vanceAgent.hp = Math.max(0, vanceAgent.hp - dmg);
    vanceHitFlashTimer = 0.18;
    applyHitFlash(vanceMatRecords, true, 0xff3b3b);
    spawnBurstParticles(
      vanceAgent.pos.x,
      1.35,
      vanceAgent.pos.z,
      [0xff4d4d, 0xffd43b, 0xffffff],
      8,
      5.0,
      9.5,
      0.16
    );
    ctx.systems?.audio?.playSfx?.('hit');

    // Trigger dramatic 50% HP brief shield reboot + Dos re-hack
    if (!midFightRebootTriggered && vanceAgent.hp > 0 && vanceAgent.hp <= BOSS_MAX_HP * 0.5) {
      midFightRebootTriggered = true;
      triggerDosShieldHack({ isMidFightReboot: true });
    }

    if (vanceAgent.hp <= 0) {
      handleVanceDefeated();
    } else {
      syncBossHUD();
    }

    ctx.updateHud?.();
    return true;
  }

  // -------------------------------------------------------------------------
  // 9. Boss Attack Patterns (Walk, Laser_Sweep, Net_Shot)
  // -------------------------------------------------------------------------
  function pickBossTarget() {
    const playerAlive = Boolean(ctx.player && !ctx.player.isDead && ctx.player.pos);
    const crock = ctx.companions?.crockstar;
    const crockAlive = Boolean(crock && crock.tamed && crock.hp > 0 && crock.pos);

    if (crockAlive && playerAlive) {
      const dc = distXZ(vanceAgent.pos, crock.pos);
      const dp = distXZ(vanceAgent.pos, ctx.player.pos);
      if (crock.mode === 'attack' && dc < dp - 1.2 && dc < 8.5) {
        return { type: 'crockstar', pos: crock.pos, dist: dc };
      }
      return { type: 'player', pos: ctx.player.pos, dist: dp };
    }
    if (playerAlive) {
      return { type: 'player', pos: ctx.player.pos, dist: distXZ(vanceAgent.pos, ctx.player.pos) };
    }
    if (crockAlive) {
      return { type: 'crockstar', pos: crock.pos, dist: distXZ(vanceAgent.pos, crock.pos) };
    }
    return null;
  }

  function chooseRepositionTarget(targetPos) {
    const angleFromArena = Math.atan2(
      targetPos.x - ARENA_CENTER.x,
      targetPos.z - ARENA_CENTER.z
    );
    const flankOffset = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.65);
    const desiredDist = 4.6 + Math.random() * 2.2;
    const rawX = targetPos.x - Math.sin(angleFromArena + flankOffset) * desiredDist;
    const rawZ = targetPos.z - Math.cos(angleFromArena + flankOffset) * desiredDist;
    const clamped = clampArena(rawX, rawZ, ctx.worldBounds);
    walkTarget.set(clamped.x, 0, clamped.z);
  }

  function launchEnergyNet(targetPos) {
    const mesh = createEnergyNetMesh();
    const fwdX = Math.sin(vanceGroup.rotation.y);
    const fwdZ = Math.cos(vanceGroup.rotation.y);
    // Left arm net launcher gauntlet world offset
    const rightX = Math.cos(vanceGroup.rotation.y);
    const rightZ = -Math.sin(vanceGroup.rotation.y);

    const start = new THREE.Vector3(
      vanceAgent.pos.x + rightX * 0.52 + fwdX * 0.72,
      1.25,
      vanceAgent.pos.z + rightZ * 0.52 + fwdZ * 0.72
    );
    const aim = new THREE.Vector3(targetPos.x, 0.85, targetPos.z);
    const dir = aim.clone().sub(start);
    const len = Math.max(dir.length(), 0.01);
    dir.divideScalar(len);

    mesh.position.copy(start);
    if (ctx.scene) ctx.scene.add(mesh);

    netProjectiles.push({
      mesh,
      pos: start,
      dir,
      life: NET_MAX_LIFE,
    });

    ctx.systems?.audio?.playSfx?.('tranq');
  }

  function updateLaserSweepHit(currentSweepAngle) {
    const halfBeamWidth = 0.24; // ~14 deg active beam thickness

    // Hit Boots
    if (!laserHitPlayer && ctx.player && !ctx.player.isDead && ctx.player.pos) {
      const dx = ctx.player.pos.x - vanceAgent.pos.x;
      const dz = ctx.player.pos.z - vanceAgent.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= LASER_RANGE) {
        const angToPlayer = Math.atan2(dx, dz);
        if (Math.abs(shortestAngleDiff(currentSweepAngle, angToPlayer)) <= halfBeamWidth) {
          laserHitPlayer = true;
          ctx.player.takeDamage?.(LASER_DAMAGE, 'vance_laser');
          spawnRing(ctx.player.pos.x, ctx.player.pos.z, 0xff2233, 1.8, 0.4);
          ctx.systems?.audio?.playSfx?.('hit');
        }
      }
    }

    // Hit tamed Crockstar
    const crock = ctx.companions?.crockstar;
    if (!laserHitCrock && crock && crock.tamed && crock.hp > 0 && crock.pos) {
      const dx = crock.pos.x - vanceAgent.pos.x;
      const dz = crock.pos.z - vanceAgent.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= LASER_RANGE) {
        const angToCrock = Math.atan2(dx, dz);
        if (Math.abs(shortestAngleDiff(currentSweepAngle, angToCrock)) <= halfBeamWidth) {
          laserHitCrock = true;
          crock.hp = Math.max(0, crock.hp - LASER_DAMAGE);
          spawnRing(crock.pos.x, crock.pos.z, 0xff2233, 1.9, 0.4);
          if (crock.hp <= 0) {
            crock.mode = 'sit';
            crock.targetAgentId = null;
            ctx.toast?.('Crockstar was scorched by Vance\'s laser and is recovering!', 'warn');
          }
          ctx.updateHud?.();
        }
      }
    }
  }

  function updateBossCombatAI(dt) {
    if (!bossActive || defeated) return;

    // Stunned window after Dos shatters the shield
    if (stunTimer > 0) {
      stunTimer = Math.max(0, stunTimer - dt);
      vanceAgent.state = 'boss_stunned';
      laserTelegraph.mesh.visible = false;
      laserBeam.group.visible = false;
      playVanceClip('Stunned', 0.12);

      // Periodic stun sparks
      if (Math.random() < dt * 7.5) {
        spawnBurstParticles(
          vanceAgent.pos.x,
          1.45,
          vanceAgent.pos.z,
          [0x22f2ff, 0xffe066],
          2,
          3.2,
          7.0,
          0.12
        );
      }

      if (stunTimer <= 0) {
        vanceAgent.state = 'boss_active';
        attackState = 'walk';
        stateTimer = 1.4;
        attackCooldown = 1.1;
      }
      return;
    }

    vanceAgent.state = 'boss_active';
    const target = pickBossTarget();

    // If Boots is dead & no companion target, hold guard in North HQ center
    if (!target) {
      laserTelegraph.mesh.visible = false;
      laserBeam.group.visible = false;
      const distHome = distXZ(vanceAgent.pos, BOSS_SPAWN_POS);
      if (distHome > 0.6) {
        const dx = BOSS_SPAWN_POS.x - vanceAgent.pos.x;
        const dz = BOSS_SPAWN_POS.z - vanceAgent.pos.z;
        const ang = Math.atan2(dx, dz);
        rotateToward(vanceGroup, ang, 4.5, dt);
        vanceAgent.pos.x += Math.sin(ang) * BOSS_WALK_SPEED * dt;
        vanceAgent.pos.z += Math.cos(ang) * BOSS_WALK_SPEED * dt;
        playVanceClip('Walk', 0.16);
      } else {
        rotateToward(vanceGroup, 0, 3.5, dt);
        playVanceClip('Idle', 0.18);
      }
      return;
    }

    attackCooldown = Math.max(0, attackCooldown - dt);

    if (attackState === 'laser_telegraph') {
      stateTimer -= dt;
      const startAngle = laserBaseAngle - LASER_ARC_RAD * 0.5;
      rotateToward(vanceGroup, startAngle, 7.0, dt);
      playVanceClip('Laser_Sweep', 0.1);

      laserTelegraph.mesh.visible = true;
      laserTelegraph.mesh.position.set(vanceAgent.pos.x, 0.06, vanceAgent.pos.z);
      laserTelegraph.mesh.rotation.y = laserBaseAngle;
      const pulse = 0.28 + Math.abs(Math.sin(elapsed * 18)) * 0.28;
      laserTelegraph.mat.opacity = pulse;
      laserTelegraph.rimMat.opacity = 0.65 + pulse * 0.6;

      if (stateTimer <= 0) {
        attackState = 'laser_sweep';
        stateTimer = LASER_SWEEP_SEC;
        laserHitPlayer = false;
        laserHitCrock = false;
        laserBeam.group.visible = true;
        ctx.systems?.audio?.playSfx?.('roar');
      }
      return;
    }

    if (attackState === 'laser_sweep') {
      stateTimer -= dt;
      const progress = THREE.MathUtils.clamp(1 - stateTimer / LASER_SWEEP_SEC, 0, 1);
      const currentAngle = laserBaseAngle - LASER_ARC_RAD * 0.5 + progress * LASER_ARC_RAD;

      vanceGroup.rotation.y = currentAngle;
      laserTelegraph.mesh.visible = true;
      laserTelegraph.mesh.position.set(vanceAgent.pos.x, 0.06, vanceAgent.pos.z);
      laserTelegraph.mesh.rotation.y = laserBaseAngle;
      laserTelegraph.mat.opacity = 0.18;

      // Mount active red laser beam at Vance's right laser cannon emitter
      const fwdX = Math.sin(currentAngle);
      const fwdZ = Math.cos(currentAngle);
      const leftX = -Math.cos(currentAngle);
      const leftZ = Math.sin(currentAngle);
      laserBeam.group.visible = true;
      laserBeam.group.position.set(
        vanceAgent.pos.x + leftX * 0.52 + fwdX * 0.95,
        1.26,
        vanceAgent.pos.z + leftZ * 0.52 + fwdZ * 0.95
      );
      laserBeam.group.rotation.y = currentAngle;
      const flicker = 0.85 + Math.sin(elapsed * 45) * 0.15;
      laserBeam.glowMat.opacity = 0.55 * flicker;

      updateLaserSweepHit(currentAngle);

      // Scorch sparks along the laser ground path
      if (Math.random() < dt * 16) {
        const r = 2.0 + Math.random() * (LASER_RANGE - 2.5);
        spawnBurstParticles(
          vanceAgent.pos.x + fwdX * r,
          0.18,
          vanceAgent.pos.z + fwdZ * r,
          [0xff2233, 0xff922b, 0xffe066],
          2,
          2.6,
          8.0,
          0.12
        );
      }

      if (stateTimer <= 0) {
        laserBeam.group.visible = false;
        laserTelegraph.mesh.visible = false;
        attackState = 'laser_recover';
        stateTimer = LASER_RECOVER_SEC;
      }
      return;
    }

    if (attackState === 'laser_recover') {
      stateTimer -= dt;
      playVanceClip('Idle', 0.18);
      if (stateTimer <= 0) {
        attackState = 'walk';
        stateTimer = 2.0;
        attackCooldown = 1.6;
        chooseRepositionTarget(target.pos);
      }
      return;
    }

    if (attackState === 'net_windup') {
      stateTimer -= dt;
      const aimAng = Math.atan2(target.pos.x - vanceAgent.pos.x, target.pos.z - vanceAgent.pos.z);
      rotateToward(vanceGroup, aimAng, 8.5, dt);
      playVanceClip('Net_Shot', 0.08);
      if (stateTimer <= 0) {
        launchEnergyNet(target.pos);
        attackState = 'net_recover';
        stateTimer = NET_RECOVER_SEC;
      }
      return;
    }

    if (attackState === 'net_recover') {
      stateTimer -= dt;
      if (stateTimer <= 0) {
        attackState = 'walk';
        stateTimer = 1.9;
        attackCooldown = 1.5;
        chooseRepositionTarget(target.pos);
      }
      return;
    }

    // Default 'walk' / 'idle' repositioning smoothly inside the North HQ arena
    stateTimer -= dt;
    const distToWp = distXZ(vanceAgent.pos, walkTarget);
    if (distToWp > 0.65) {
      const dx = walkTarget.x - vanceAgent.pos.x;
      const dz = walkTarget.z - vanceAgent.pos.z;
      const moveAngle = Math.atan2(dx, dz);
      rotateToward(vanceGroup, moveAngle, 5.5, dt);
      const step = Math.min(distToWp, BOSS_WALK_SPEED * dt);
      const nextX = vanceAgent.pos.x + Math.sin(moveAngle) * step;
      const nextZ = vanceAgent.pos.z + Math.cos(moveAngle) * step;
      const clamped = clampArena(nextX, nextZ, ctx.worldBounds);
      const blocked =
        (typeof ctx.isWater === 'function' && ctx.isWater(clamped.x, clamped.z)) ||
        (typeof ctx.isBlocked === 'function' && ctx.isBlocked(clamped.x, clamped.z, 0.55));
      if (!blocked) {
        vanceAgent.pos.x = clamped.x;
        vanceAgent.pos.z = clamped.z;
      } else {
        chooseRepositionTarget(target.pos);
      }
      playVanceClip('Walk', 0.16);
    } else {
      const faceTarget = Math.atan2(
        target.pos.x - vanceAgent.pos.x,
        target.pos.z - vanceAgent.pos.z
      );
      rotateToward(vanceGroup, faceTarget, 6.0, dt);
      playVanceClip('Idle', 0.18);
    }

    // Launch next boss attack when cooldown is ready and target is in North HQ engagement range
    if (attackCooldown <= 0 && target.dist <= 13.5) {
      if (nextAttackChoice === 'laser' && target.dist <= LASER_RANGE + 1.2) {
        laserBaseAngle = Math.atan2(
          target.pos.x - vanceAgent.pos.x,
          target.pos.z - vanceAgent.pos.z
        );
        attackState = 'laser_telegraph';
        stateTimer = LASER_TELEGRAPH_SEC;
        nextAttackChoice = 'net';
        ctx.systems?.audio?.playSfx?.('alert');
      } else {
        attackState = 'net_windup';
        stateTimer = NET_WINDUP_SEC;
        nextAttackChoice = 'laser';
      }
    } else if (stateTimer <= 0) {
      stateTimer = 2.2;
      chooseRepositionTarget(target.pos);
    }
  }

  function updateNetProjectiles(dt) {
    for (let i = netProjectiles.length - 1; i >= 0; i--) {
      const p = netProjectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.dir, NET_SPEED * dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y += dt * 7.5;

      let hit = false;

      // Hit Boots
      if (ctx.player && !ctx.player.isDead && ctx.player.pos) {
        if (distXZ(p.pos, ctx.player.pos) <= 0.92) {
          hit = true;
          ctx.player.takeDamage?.(NET_DAMAGE, 'vance_net');
          netSlowTimer = NET_SLOW_SEC;
          ctx.player.isNetted = true;
          ctx.player.slowTimer = NET_SLOW_SEC;
          spawnRing(ctx.player.pos.x, ctx.player.pos.z, 0xffa91f, 1.8, 0.45);
          ctx.toast?.("Caught in Vance's Energy Net! Movement briefly slowed!", 'warn');
        }
      }

      // Hit tamed Crockstar
      const crock = ctx.companions?.crockstar;
      if (!hit && crock && crock.tamed && crock.hp > 0 && crock.pos) {
        if (distXZ(p.pos, crock.pos) <= 1.05) {
          hit = true;
          crock.hp = Math.max(0, crock.hp - NET_DAMAGE);
          spawnRing(crock.pos.x, crock.pos.z, 0xffa91f, 1.85, 0.45);
          if (crock.hp <= 0) {
            crock.mode = 'sit';
            crock.targetAgentId = null;
          }
          ctx.updateHud?.();
        }
      }

      if (hit || p.life <= 0) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.mesh.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          }
        });
        netProjectiles.splice(i, 1);
      }
    }

    // Apply physical slow drag + glowing amber ring while Boots is netted
    if (netSlowTimer > 0 && ctx.player?.pos && !ctx.player.isDead) {
      netSlowTimer = Math.max(0, netSlowTimer - dt);
      ctx.player.slowTimer = netSlowTimer;
      ctx.player.isNetted = netSlowTimer > 0;

      if (prevPlayerPos) {
        const dx = ctx.player.pos.x - prevPlayerPos.x;
        const dz = ctx.player.pos.z - prevPlayerPos.z;
        const moved = Math.hypot(dx, dz);
        // Gently dampen 45% of normal frame movement (ignore teleports/respawns > 1.5u)
        if (moved > 0.0005 && moved < 1.5) {
          ctx.player.pos.x -= dx * 0.45;
          ctx.player.pos.z -= dz * 0.45;
        }
      }

      netSlowRing.visible = true;
      netSlowRing.position.set(ctx.player.pos.x, 0.42 + Math.sin(elapsed * 10) * 0.08, ctx.player.pos.z);
      netSlowRing.rotation.z = elapsed * 4.5;
    } else {
      netSlowRing.visible = false;
      if (ctx.player) {
        ctx.player.isNetted = false;
        ctx.player.slowTimer = 0;
      }
    }

    if (ctx.player?.pos) {
      if (!prevPlayerPos) prevPlayerPos = ctx.player.pos.clone();
      else prevPlayerPos.copy(ctx.player.pos);
    }
  }

  // -------------------------------------------------------------------------
  // 10. Ending Cutscene (triggerEscape), Victory Summary & Endless Free-Play
  // -------------------------------------------------------------------------
  function getHelipadPosition() {
    const ev = ctx.escapeVehicle;
    if (ev?.position) return ev.position.clone();
    if (ev?.group?.position) return ev.group.position.clone();
    if (typeof ev?.x === 'number' && typeof ev?.z === 'number') {
      return new THREE.Vector3(ev.x, 0, ev.z);
    }
    return DEFAULT_HELIPAD_POS.clone();
  }

  function getEscapeVehicleRoot() {
    const ev = ctx.escapeVehicle;
    if (!ev) return null;
    if (ev.isObject3D) return ev;
    if (ev.group?.isObject3D) return ev.group;
    if (ev.mesh?.isObject3D) return ev.mesh;
    return null;
  }

  function spinEscapeRotorsAndLift(dt) {
    if (!escapeLiftoffActive) return;
    escapeLiftoffAge += dt;

    const root = getEscapeVehicleRoot();
    const ev = ctx.escapeVehicle;

    // Spin main rotor (Y-axis) and tail rotor (X-axis) on escapeVehicle
    const mainRotors = [];
    const tailRotors = [];
    if (ev?.userData?.rotor) mainRotors.push(ev.userData.rotor);
    if (ev?.rotor) mainRotors.push(ev.rotor);
    if (ev?.mainRotor) mainRotors.push(ev.mainRotor);
    if (ev?.userData?.tailRotor) tailRotors.push(ev.userData.tailRotor);
    if (ev?.tailRotor) tailRotors.push(ev.tailRotor);
    if (root && mainRotors.length === 0 && tailRotors.length === 0 && typeof root.traverse === 'function') {
      root.traverse((child) => {
        const n = (child.name || '').toLowerCase();
        if (n.includes('tailrotor')) {
          tailRotors.push(child);
        } else if (n.includes('rotor') || n.includes('blade') || n.includes('prop')) {
          mainRotors.push(child);
        }
      });
    }

    const spinSpeed = Math.min(26, 5 + escapeLiftoffAge * 14);
    for (const r of mainRotors) {
      r.rotation.y += spinSpeed * dt;
    }
    for (const tr of tailRotors) {
      tr.rotation.x += spinSpeed * 1.45 * dt;
    }

    // Smooth liftoff climb + gentle bank toward the golden sunset horizon
    if (root && savedVehiclePos) {
      const climbT = Math.max(0, escapeLiftoffAge - 0.55);
      const yLift = Math.min(11.5, climbT * climbT * 1.45 + climbT * 1.6);
      const zDrift = Math.min(9.0, climbT * 1.4);
      root.position.set(
        savedVehiclePos.x + Math.sin(climbT * 1.2) * 0.4,
        savedVehiclePos.y + yLift,
        savedVehiclePos.z - zDrift
      );
      root.rotation.z = Math.sin(climbT * 1.5) * 0.08;
      root.rotation.x = Math.min(0.14, climbT * 0.05);
    }

    // Warm sunset sky blend
    if (sunsetBlendActive && ctx.scene) {
      const sunsetColor = new THREE.Color(0xf49742);
      if (ctx.scene.background && ctx.scene.background.isColor) {
        ctx.scene.background.lerp(sunsetColor, Math.min(1, dt * 1.6));
      }
      if (ctx.scene.fog && ctx.scene.fog.color) {
        ctx.scene.fog.color.lerp(sunsetColor, Math.min(1, dt * 1.6));
      }
    }
  }

  function showVictoryScreen() {
    victoryShown = true;
    bossActive = false;
    syncBossHUD();

    const storyState = ctx.systems?.story?.getState?.() || ctx.story || {};
    const daysSurvived = storyState.daysSurvived ?? storyState.stats?.daysSurvived ?? ctx.story?.daysSurvived ?? 1;
    const fbiEvaded = storyState.fbiEvaded ?? storyState.stats?.fbiEvaded ?? ctx.story?.fbiEvaded ?? 0;
    const deaths = storyState.deaths ?? storyState.stats?.deaths ?? ctx.story?.deaths ?? 0;

    if (victoryDaysEl) victoryDaysEl.textContent = String(daysSurvived);
    if (victoryEvadedEl) victoryEvadedEl.textContent = String(fbiEvaded);
    if (victoryDeathsEl) victoryDeathsEl.textContent = String(deaths);

    if (victoryCrewEl) {
      const pills = [
        '🐒 Tarcy (Boots) — Escaped',
        '🕶 Agent Dos — Double Agent',
        ctx.companions?.crockstar?.tamed ? '🐊 Crockstar — Tamed Ally' : '🐊 Crockstar — Island Legend',
        ctx.fbi?.smuff?.rescued ? '🧙 Smuff — Rescued (+35% Craft)' : '⚡ Director Vance — Defeated',
      ];
      victoryCrewEl.innerHTML = pills
        .map((label) => `<span class="victory-crew__pill">${label}</span>`)
        .join('');
    }

    if (victoryEl) {
      victoryEl.classList.remove('is-hidden');
    }

    ctx.systems?.audio?.playSfx?.('victory');
    ctx.systems?.audio?.setMusicMode?.('victory');
    ctx.emit?.('boss:victory', { daysSurvived, fbiEvaded, deaths });
  }

  function enterEndlessFreePlay() {
    victoryShown = false;
    endlessMode = true;
    escapeInProgress = false;
    escapeLiftoffActive = false;
    sunsetBlendActive = false;

    if (victoryEl) {
      victoryEl.classList.add('is-hidden');
    }

    // Restore tropical daylight sky & return escape vehicle to helipad
    if (ctx.scene) {
      if (savedSkyBg && ctx.scene.background?.isColor) {
        ctx.scene.background.copy(savedSkyBg);
      }
      if (savedFogColor && ctx.scene.fog?.color) {
        ctx.scene.fog.color.copy(savedFogColor);
      }
    }
    const root = getEscapeVehicleRoot();
    if (root && savedVehiclePos) {
      root.position.copy(savedVehiclePos);
      if (savedVehicleRot) root.rotation.copy(savedVehicleRot);
    }

    // Restore Boots & companions safely on the cleared North Beach Helipad
    const pad = getHelipadPosition();
    if (ctx.player?.pos) {
      ctx.player.pos.set(pad.x, 0, Math.min(-18.5, pad.z + 3.2));
      ctx.player.isDead = false;
      ctx.player.hp = ctx.player.maxHp || 100;
      ctx.player.stamina = ctx.player.maxStamina || 100;
    }
    if (ctx.companions?.dos?.pos) {
      ctx.companions.dos.pos.set(pad.x - 1.6, 0, Math.min(-18.0, pad.z + 3.6));
    }
    if (ctx.companions?.crockstar?.pos && ctx.companions.crockstar.tamed) {
      ctx.companions.crockstar.pos.set(pad.x + 1.8, 0, Math.min(-18.0, pad.z + 3.6));
      ctx.companions.crockstar.hp = ctx.companions.crockstar.maxHp || 160;
    }
    if (ctx.fbi?.smuff?.pos && ctx.fbi.smuff.rescued) {
      ctx.fbi.smuff.pos.set(pad.x + 0.9, 0, Math.min(-17.5, pad.z + 4.4));
    }

    ctx.models?.tarcy?.play?.('Idle', 0.15);
    ctx.models?.dos?.play?.('Idle', 0.15);

    ctx.systems?.story?.enableEndlessMode?.();
    ctx.systems?.audio?.setMusicMode?.('explore');
    ctx.toast?.(
      'Endless Island Free-Play active! Keep exploring, crafting, and building forever!',
      'success'
    );
    ctx.updateHud?.();
  }

  async function triggerEscape() {
    if (!defeated) {
      ctx.toast?.('Defeat FBI Director Vance first to secure the extraction vehicle!', 'warn');
      return false;
    }
    if (escapeInProgress) return false;

    escapeTriggered = true;
    escapeInProgress = true;
    defeatCutsceneTimer = -1;
    syncBossHUD();

    const vx = vanceAgent.pos.x;
    const vz = vanceAgent.pos.z;
    const pad = getHelipadPosition();
    const hx = pad.x;
    const hz = pad.z;

    const root = getEscapeVehicleRoot();
    if (root && !savedVehiclePos) {
      savedVehiclePos = root.position.clone();
      savedVehicleRot = root.rotation.clone();
    }
    if (ctx.scene) {
      if (!savedSkyBg && ctx.scene.background?.isColor) {
        savedSkyBg = ctx.scene.background.clone();
      }
      if (!savedFogColor && ctx.scene.fog?.color) {
        savedFogColor = ctx.scene.fog.color.clone();
      }
    }

    const endingCutsceneDef = {
      id: 'ending_escape',
      title: 'FINALE — ESCAPE FROM EXOTIC ISLAND',
      shots: [
        {
          speaker: 'Director Vance',
          portrait: 'vance',
          text: "Gzzzt—! Impossible! My Black-Gold Exo-Mech... short-circuited by an exotic monkey and a double agent! Backup... come in...!",
          camPos: [vx + 3.8, 3.1, vz + 4.6],
          camTarget: [vx, 1.15, vz],
          duration: 5.5,
          sfx: 'explosion',
          anims: [{ modelKey: 'vance', clip: 'Defeat' }],
          onStart() {
            playVanceClip('Defeat', 0.05, true);
            spawnBurstParticles(
              vx,
              1.4,
              vz,
              [0x22f2ff, 0xffe066, 0xff4d4d],
              18,
              5.2,
              9.0,
              0.18
            );
          },
        },
        {
          speaker: 'Agent Dos',
          portrait: 'dos',
          text: "All jammers smashed, Director Vance offline, and the extraction chopper is ours! Tip of the FBI cap to you, Boots — everyone aboard!",
          camPos: [hx + 5.2, 3.6, hz + 7.2],
          camTarget: [hx, 1.15, hz + 1.4],
          duration: 6.0,
          sfx: 'radio',
          anims: [
            { modelKey: 'tarcy', clip: 'Idle' },
            { modelKey: 'dos', clip: 'Alert_Signal' },
            { modelKey: 'crockstar', clip: 'Friendly_Sit' },
            { modelKey: 'smuff', clip: 'Ability_Cast' },
          ],
          onStart() {
            // Gather the whole island squad around the North Beach Helipad
            if (ctx.player?.pos) {
              ctx.player.pos.set(hx - 1.35, 0, hz + 2.5);
              if (ctx.player.group) ctx.player.group.rotation.y = 0.25;
            }
            if (ctx.companions?.dos?.pos) {
              ctx.companions.dos.pos.set(hx + 1.45, 0, hz + 2.3);
              if (ctx.companions.dos.group) ctx.companions.dos.group.rotation.y = -0.3;
            }
            if (ctx.companions?.crockstar?.pos) {
              ctx.companions.crockstar.pos.set(hx - 2.65, 0, hz + 3.1);
              if (ctx.companions.crockstar.group) ctx.companions.crockstar.group.rotation.y = 0.45;
            }
            if (ctx.fbi?.smuff?.pos) {
              ctx.fbi.smuff.pos.set(hx + 2.65, 0, hz + 2.9);
              if (ctx.fbi.smuff.group) ctx.fbi.smuff.group.rotation.y = -0.45;
            }
            ctx.models?.dos?.play?.('Alert_Signal', 0.1);
            ctx.models?.crockstar?.play?.('Friendly_Sit', 0.1);
            ctx.models?.smuff?.play?.('Ability_Cast', 0.1);
          },
        },
        {
          speaker: 'Narrator',
          portrait: 'narrator',
          text: "Rotors roar to life against a blazing golden sunset! Soaring free above Exotic Island, Tarcy (Boots), Dos, Crockstar, and Smuff leave the FBI in the dust!",
          camPos: [hx + 7.6, 3.0, hz + 8.4],
          camTarget: [hx, 4.4, hz - 1.8],
          duration: 6.5,
          sfx: 'victory',
          anims: [
            { modelKey: 'tarcy', clip: 'Run' },
            { modelKey: 'dos', clip: 'Hide_Assist_Aura' },
          ],
          onStart() {
            escapeLiftoffActive = true;
            escapeLiftoffAge = 0;
            sunsetBlendActive = true;
            ctx.systems?.audio?.setMusicMode?.('victory');
            spawnRing(hx, hz, 0xffd94a, 5.2, 1.1, 0.12);
          },
        },
      ],
    };

    try {
      if (typeof ctx.systems?.cutscenes?.playCutscene === 'function') {
        await ctx.systems.cutscenes.playCutscene(endingCutsceneDef);
      } else {
        // Fallback when running headless without cutscene director
        escapeLiftoffActive = true;
        sunsetBlendActive = true;
      }
    } finally {
      escapeInProgress = false;
      showVictoryScreen();
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // 11. Main Update Loop
  // -------------------------------------------------------------------------
  function updateTransientVFX(dt) {
    // Expanding shockwave rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dt;
      const t = Math.min(1, r.age / r.duration);
      const s = 0.55 + t * r.maxScale;
      r.mesh.scale.set(s, 1, s);
      r.mat.opacity = (1 - t) * 0.9;
      if (t >= 1) {
        if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
        r.geo.dispose();
        r.mat.dispose();
        rings.splice(i, 1);
      }
    }

    // Cel burst particles & sparks
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.duration);
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.06, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      if (p.growTo) {
        const s = 0.7 + t * p.growTo;
        p.mesh.scale.setScalar(s);
      } else {
        p.mesh.scale.setScalar(Math.max(0.05, 1 - t));
      }
      p.mat.opacity = 1 - t;
      if (t >= 1) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.geo.dispose();
        p.mat.dispose();
        particles.splice(i, 1);
      }
    }

    // Update Dos's glowing cyan hack beam while active
    if (hackBeamTimer > 0 && !defeated) {
      hackBeamTimer = Math.max(0, hackBeamTimer - dt);
      hackBeam.group.visible = true;

      const dosPos = ctx.companions?.dos?.pos;
      const start = dosPos
        ? new THREE.Vector3(dosPos.x, 0.95, dosPos.z)
        : new THREE.Vector3(vanceAgent.pos.x - 3.2, 0.95, vanceAgent.pos.z + 3.2);
      const end = new THREE.Vector3(vanceAgent.pos.x, 1.45, vanceAgent.pos.z);
      const dist = Math.max(0.1, start.distanceTo(end));

      hackBeam.group.position.copy(start);
      hackBeam.group.lookAt(end);
      hackBeam.beam.scale.set(1, 1, dist);
      hackBeam.halo.scale.set(1, 1, dist);
      hackBeam.beamMat.opacity = 0.75 + Math.sin(elapsed * 26) * 0.2;

      for (let i = 0; i < hackBeam.pulses.length; i++) {
        const ring = hackBeam.pulses[i];
        const frac = (elapsed * 2.2 + i / hackBeam.pulses.length) % 1;
        ring.position.set(0, 0, frac * dist);
        const s = 0.8 + Math.sin(frac * Math.PI) * 0.55;
        ring.scale.setScalar(s);
      }
    } else {
      hackBeam.group.visible = false;
    }

    // Animate Vance's golden energy dome shield
    shieldRig.group.visible = shieldActive && !defeated;
    if (shieldRig.group.visible) {
      shieldRig.outerMesh.rotation.y += dt * 0.65;
      shieldRig.latticeMesh.rotation.y -= dt * 0.95;
      shieldRig.latticeMesh.rotation.x = Math.sin(elapsed * 1.4) * 0.16;

      if (shieldFlashTimer > 0) {
        shieldFlashTimer = Math.max(0, shieldFlashTimer - dt);
        shieldRig.outerMat.color.setHex(0xffffff);
        shieldRig.outerMat.opacity = 0.58;
        shieldRig.latticeMat.opacity = 0.9;
      } else if (shieldRebootTimer > 0) {
        // Flickering gold/cyan clash while Dos re-hacks emergency shield
        const clash = Math.sin(elapsed * 20) > 0 ? 0x22f2ff : 0xffd23f;
        shieldRig.outerMat.color.setHex(clash);
        shieldRig.outerMat.opacity = 0.28 + Math.abs(Math.sin(elapsed * 10)) * 0.14;
        shieldRig.latticeMat.opacity = 0.52;
      } else {
        shieldRig.outerMat.color.setHex(0xffd23f);
        shieldRig.outerMat.opacity = 0.22 + Math.sin(elapsed * 4.2) * 0.06;
        shieldRig.latticeMat.opacity = 0.38 + Math.sin(elapsed * 5.0) * 0.1;
      }
      const rScale = 1.0 + Math.sin(elapsed * 3.8) * 0.05;
      shieldRig.baseRing.scale.set(rScale, 1, rScale);
    }

    // Hit flash decay on Vance's armor
    if (vanceHitFlashTimer > 0) {
      vanceHitFlashTimer = Math.max(0, vanceHitFlashTimer - dt);
      if (vanceHitFlashTimer <= 0) {
        applyHitFlash(vanceMatRecords, false);
      }
    }
  }

  function update(rawDt) {
    const dt = Math.min(Math.max(rawDt || 0, 0), 0.1);
    elapsed += dt;
    deflectToastCooldown = Math.max(0, deflectToastCooldown - dt);

    ensureFbiHooks();

    // Keep Vance safe from any fallback fbi_ai timers
    vanceAgent.shootCooldown = 99999;
    if (defeated) {
      vanceAgent.state = 'ko';
      vanceAgent.koTimer = 999999;
    }

    // 1. Always animate helicopter liftoff & transient sparks even during cutscenes
    spinEscapeRotorsAndLift(dt);
    updateTransientVFX(dt);

    // 2. Watch all 3 Signal Jammers for destruction & maintain broken tower look
    const { list: jammers, remaining } = getJammerCounts();
    for (const j of jammers) {
      if (!j._bossDestroyedHandled && (j.destroyed || j.depleted || (typeof j.hp === 'number' && j.hp <= 0))) {
        handleJammerDestroyed(j);
      }
      if (j.destroyed || j._bossDestroyedHandled) {
        j.depleted = true;
        j.respawnTimer = 999999;
        applyBrokenTowerLook(j);
      }
    }

    // Periodic charred smoke puffs rising from broken jammer towers
    if (brokenJammerRecords.size > 0) {
      jammerSmokeAccum += dt;
      if (jammerSmokeAccum >= 0.75) {
        jammerSmokeAccum = 0;
        for (const j of jammers) {
          if (j.destroyed) {
            spawnBurstParticles(
              j.x ?? 0,
              1.05,
              j.z ?? -15,
              [0x2b303a, 0x495057, 0xff7b29],
              2,
              1.1,
              -1.4,
              0.18
            );
          }
        }
      }
    }

    ensureJammerTethers();

    // 3. Handle 50% HP shield reboot countdown -> Dos shatters it cleanly
    if (!defeated && shieldRebootTimer > 0) {
      shieldRebootTimer = Math.max(0, shieldRebootTimer - dt);
      ctx.models?.dos?.play?.('Alert_Signal', 0.12);
      if (shieldRebootTimer <= 0) {
        shieldActive = false;
        vanceAgent.shieldActive = false;
        stunTimer = MID_FIGHT_STUN_SEC;
        vanceAgent.state = 'boss_stunned';
        playVanceClip('Stunned', 0.1);
        ctx.systems?.audio?.playSfx?.('explosion');
        ctx.systems?.audio?.playSfx?.('radio');
        spawnRing(vanceAgent.pos.x, vanceAgent.pos.z, 0x22f2ff, 4.4, 0.75);
        ctx.toast?.("Dos shattered Vance's rebooted shield! Finish him off!", 'success');
      }
    } else if (!defeated && remaining === 0 && !allJammersDownHandled && jammers.length > 0) {
      // Safety net if all jammers were pre-destroyed before first update
      allJammersDownHandled = true;
      triggerDosShieldHack({ isMidFightReboot: false });
    }

    // 4. Short-circuit electric spark bursts on defeated Vance + auto-trigger ending cutscene
    if (defeated) {
      defeatSparkAccum += dt;
      if (defeatSparkAccum >= 0.42) {
        defeatSparkAccum = 0;
        spawnBurstParticles(
          vanceAgent.pos.x,
          1.15,
          vanceAgent.pos.z,
          [0x22f2ff, 0xffe066, 0xff6b1a],
          4,
          3.4,
          8.5,
          0.14
        );
      }

      if (defeatCutsceneTimer >= 0) {
        defeatCutsceneTimer -= dt;
        if (defeatCutsceneTimer <= 0 && !escapeTriggered) {
          defeatCutsceneTimer = -1;
          triggerEscape();
        }
      }

      syncBossHUD();
      return;
    }

    // Pause boss AI combat ticks while a cutscene is playing
    if (ctx.cutsceneActive) {
      syncBossHUD();
      return;
    }

    // 5. Activate Boss Fight when Boots enters North HQ (z < -10.5)
    if (!bossActive && ctx.player?.pos && !ctx.player.isDead && ctx.player.pos.z < NORTH_HQ_TRIGGER_Z) {
      activateBossEncounter();
    }

    if (!bossActive) {
      playVanceClip('Idle', 0.2);
      syncBossHUD();
      return;
    }

    // 6. Execute Vance's combat AI & energy net projectiles
    updateBossCombatAI(dt);
    updateNetProjectiles(dt);
    syncBossHUD();
  }

  function getBossState() {
    const { total, destroyed, remaining } = getJammerCounts();
    return {
      active: bossActive,
      defeated,
      hp: vanceAgent.hp,
      maxHp: vanceAgent.maxHp,
      shieldActive,
      shieldRebootActive: shieldRebootTimer > 0,
      shieldRebootRemaining: Number(shieldRebootTimer.toFixed(2)),
      jammersTotal: total,
      jammersDestroyed: destroyed,
      jammersRemaining: remaining,
      stunned: stunTimer > 0,
      stunRemaining: Number(stunTimer.toFixed(2)),
      state: vanceAgent.state,
      phase: defeated ? 'defeated' : stunTimer > 0 ? 'stunned' : attackState,
      pos: { x: vanceAgent.pos.x, y: vanceAgent.pos.y, z: vanceAgent.pos.z },
      escapeTriggered,
      victoryShown,
      endlessMode,
    };
  }

  function isVictoryShown() {
    return victoryShown;
  }

  // Start Vance in menacing Idle pose
  playVanceClip('Idle', 0);

  return {
    update,
    damageJammer,
    damageVance,
    triggerEscape,
    getBossState,
    isVictoryShown,
  };
}
