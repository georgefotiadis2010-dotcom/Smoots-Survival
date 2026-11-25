import * as THREE from 'three';

const BASE_VISION_RANGE = 6.2;
const HALF_FOV_RAD = THREE.MathUtils.degToRad(32);
const COS_HALF_FOV = Math.cos(HALF_FOV_RAD);

const PATROL_SPEED = 1.95;
const INVESTIGATE_SPEED = 2.35;
const CHASE_SPEED = 3.25;
const SMUFF_FOLLOW_SPEED = 3.35;
const SMUFF_SNEAK_SPEED = 2.05;

const AGENT_MAX_HP = 100;
const AGENT_RADIUS = 0.42;
const DECOY_LURE_RANGE = 10.0;
const CRATE_CONFISCATE_RANGE = 12.0;
const SHOOT_RANGE = 7.4;
const SHOOT_PREFERRED_DIST = 4.2;
const SHOOT_COOLDOWN_SEC = 1.6;
const TRANQ_DAMAGE_PLAYER = 18;
const TRANQ_DAMAGE_CROCKSTAR = 14;
const DART_SPEED = 14.5;
const KO_DURATION_SEC = 25.0;
const BACKUP_COOLDOWN_SEC = 25.0;
const MAX_AGENTS = 4;
const SMUFF_RESCUE_RANGE = 2.6;

const VISION_STYLES = {
  patrol: { color: 0xffd43b, opacity: 0.22 },
  confiscate: { color: 0xffd43b, opacity: 0.26 },
  investigate: { color: 0xff922b, opacity: 0.34 },
  alert: { color: 0xff922b, opacity: 0.36 },
  chase: { color: 0xff3b3b, opacity: 0.42 },
};

function clampToWorld(x, z, bounds, margin = 0.6) {
  const minX = (bounds?.minX ?? -14) + margin;
  const maxX = (bounds?.maxX ?? 14) - margin;
  const minZ = (bounds?.minZ ?? -14) + margin;
  const maxZ = (bounds?.maxZ ?? 14) - margin;
  return {
    x: THREE.MathUtils.clamp(x, minX, maxX),
    z: THREE.MathUtils.clamp(z, minZ, maxZ),
  };
}

function shortestAngleDiff(from, to) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function rotateToward(obj, targetAngle, speed, dt) {
  const diff = shortestAngleDiff(obj.rotation.y, targetAngle);
  const step = Math.min(Math.abs(diff), speed * dt);
  obj.rotation.y += Math.sign(diff) * step;
}

function playClip(model, clipName, fadeSec = 0.18) {
  if (!model || typeof model.play !== 'function') return;
  if (model.activeClip === clipName) return;
  if (model.actions && !model.actions[clipName]) return;
  model.play(clipName, fadeSec);
}

/**
 * Builds a unit-radius ground-projected vision sector mesh lying flat on y = 0.04,
 * pointing along local +Z (matching glTF character forward direction).
 */
function createVisionConeMesh() {
  const segments = 24;
  const positions = [0, 0, 0];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -HALF_FOV_RAD + t * (HALF_FOV_RAD * 2);
    positions.push(Math.sin(angle), 0, Math.cos(angle));
  }
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color: VISION_STYLES.patrol.color,
    transparent: true,
    opacity: VISION_STYLES.patrol.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'FBI_Vision_Cone';
  mesh.position.y = 0.04;
  mesh.renderOrder = 2;

  // Subtle rim outline for crisp readability against grass and sandstone
  const rimPts = [new THREE.Vector3(0, 0.005, 0)];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -HALF_FOV_RAD + t * (HALF_FOV_RAD * 2);
    rimPts.push(new THREE.Vector3(Math.sin(angle), 0.005, Math.cos(angle)));
  }
  rimPts.push(new THREE.Vector3(0, 0.005, 0));

  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
  const rimMat = new THREE.LineBasicMaterial({
    color: VISION_STYLES.patrol.color,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const rimLine = new THREE.Line(rimGeo, rimMat);
  rimLine.renderOrder = 3;
  mesh.add(rimLine);
  mesh.userData.rimMat = rimMat;

  return mesh;
}

/**
 * Floating 3D alert indicator above an FBI agent's head during alert/investigate/chase.
 */
function createAlertBadge() {
  const badge = new THREE.Group();
  badge.position.set(0, 2.25, 0);
  badge.visible = false;

  const mat = new THREE.MeshBasicMaterial({
    color: 0xff922b,
    transparent: true,
    opacity: 0.95,
  });

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.11), mat);
  bar.position.y = 0.14;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), mat);
  dot.position.y = -0.14;

  badge.add(bar, dot);
  badge.userData.mat = mat;
  return badge;
}

/**
 * Glowing cyan tranquilizer dart projectile mesh.
 */
function createTranqDartMesh() {
  const group = new THREE.Group();
  group.name = 'FBI_Tranq_Dart';

  const bodyGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.38, 6);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x3bf7ff });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const haloGeo = new THREE.SphereGeometry(0.11, 8, 8);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  const tailGeo = new THREE.ConeGeometry(0.07, 0.16, 5);
  tailGeo.rotateX(-Math.PI / 2);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4d6d });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.z = -0.22;
  group.add(tail);

  return group;
}

/**
 * Subtle beacon ring under Smuff's cage so players can spot the rescue objective.
 */
function createSmuffBeacon() {
  const geo = new THREE.RingGeometry(0.95, 1.18, 28);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x4dabf7,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.y = 0.05;
  ring.renderOrder = 2;
  return ring;
}

/**
 * Clones non-outline mesh materials on a model so each agent can flash red independently.
 */
function isolateAgentMaterials(root) {
  const records = [];
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

function setHitFlash(records, active) {
  if (!records) return;
  for (const r of records) {
    if (active) {
      if (r.mat.emissive) {
        r.mat.emissive.setHex(0xff2a2a);
        r.mat.emissiveIntensity = 0.85;
      } else if (r.mat.color) {
        r.mat.color.setHex(0xff5252);
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

export function createFBISystem(ctx) {
  // Ensure ctx.fbi structure matches shared contract #15 without replacing existing references
  if (!ctx.fbi) {
    ctx.fbi = {
      agents: [],
      smuff: {
        group: null,
        pos: new THREE.Vector3(7, 0, -5),
        rescued: false,
        cageMesh: null,
        followOffset: new THREE.Vector3(1.55, 0, -1.25),
      },
      globalAlert: 0,
      isPlayerDetected: false,
    };
  }
  if (!Array.isArray(ctx.fbi.agents)) ctx.fbi.agents = [];
  if (typeof ctx.fbi.globalAlert !== 'number') ctx.fbi.globalAlert = 0;
  if (typeof ctx.fbi.isPlayerDetected !== 'boolean') ctx.fbi.isPlayerDetected = false;

  // Resolve Smuff state & scene object
  const smuff = ctx.fbi.smuff || (ctx.fbi.smuff = {});
  if (!smuff.group && ctx.models?.smuff?.scene) {
    smuff.group = ctx.models.smuff.scene;
  }
  if (smuff.group && !smuff.group.parent && ctx.scene) {
    ctx.scene.add(smuff.group);
  }
  if (!smuff.pos) {
    smuff.pos = smuff.group ? smuff.group.position : new THREE.Vector3(7, 0, -5);
  } else if (smuff.group && smuff.pos !== smuff.group.position) {
    smuff.group.position.copy(smuff.pos);
  }
  if (typeof smuff.rescued !== 'boolean') smuff.rescued = false;
  if (!smuff.followOffset) {
    smuff.followOffset = new THREE.Vector3(1.55, 0, -1.25);
  }

  // Locate cage mesh & tactical tent in scene if not explicitly wired
  if (!smuff.cageMesh && ctx.scene) {
    smuff.cageMesh = ctx.scene.getObjectByName('FBI_Holding_Cage') || null;
  }
  const smuffOrigin = new THREE.Vector3(smuff.pos.x, 0, smuff.pos.z);

  let tentSpawnPos = new THREE.Vector3(smuffOrigin.x + 1.8, 0, smuffOrigin.z - 2.4);
  if (ctx.scene) {
    const tentObj = ctx.scene.getObjectByName('FBI_Tactical_Tent');
    if (tentObj) {
      const wp = new THREE.Vector3();
      tentObj.getWorldPosition(wp);
      tentSpawnPos.set(wp.x, 0, wp.z + 2.0);
    }
  }
  {
    const clamped = clampToWorld(tentSpawnPos.x, tentSpawnPos.z, ctx.worldBounds, 1.0);
    tentSpawnPos.set(clamped.x, 0, clamped.z);
  }

  // Visual beacon for Smuff's cage
  const smuffBeacon = createSmuffBeacon();
  smuffBeacon.position.set(smuffOrigin.x, 0.05, smuffOrigin.z);
  smuffBeacon.visible = !smuff.rescued;
  if (ctx.scene) ctx.scene.add(smuffBeacon);

  // Start Smuff in Captured_Idle
  if (!smuff.rescued && ctx.models?.smuff) {
    playClip(ctx.models.smuff, 'Captured_Idle', 0.05);
  }

  // Active projectiles & transient VFX
  const darts = [];
  const transientRings = [];
  let cageUnlockAnim = null;
  let smuffCastTimer = 0;
  let backupCooldown = 0;
  let nextAgentSeq = 1;
  let hudSyncTimer = 0;
  let elapsed = 0;

  function isPositionFree(x, z, radius = AGENT_RADIUS, avoidWater = true) {
    const b = ctx.worldBounds || { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
    if (x < b.minX + 0.5 || x > b.maxX - 0.5 || z < b.minZ + 0.5 || z > b.maxZ - 0.5) {
      return false;
    }
    if (avoidWater && typeof ctx.isWater === 'function' && ctx.isWater(x, z)) {
      return false;
    }
    if (typeof ctx.isBlocked === 'function' && ctx.isBlocked(x, z, radius)) {
      return false;
    }
    return true;
  }

  function findNearbyFreePoint(originX, originZ, radius = AGENT_RADIUS) {
    if (isPositionFree(originX, originZ, radius)) {
      return new THREE.Vector3(originX, 0, originZ);
    }
    for (let r = 0.8; r <= 4.0; r += 0.8) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const tx = originX + Math.cos(a) * r;
        const tz = originZ + Math.sin(a) * r;
        if (isPositionFree(tx, tz, radius)) {
          return new THREE.Vector3(tx, 0, tz);
        }
      }
    }
    const c = clampToWorld(originX, originZ, ctx.worldBounds, 1.0);
    return new THREE.Vector3(c.x, 0, c.z);
  }

  function moveEntityToward(pos, targetX, targetZ, speed, dt, radius = AGENT_RADIUS) {
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return { moved: 0, dist: 0, angle: null };

    const step = Math.min(dist, speed * dt);
    const nx = dx / dist;
    const nz = dz / dist;
    const baseAngle = Math.atan2(nx, nz);

    // Try straight, then small steering angles, then axis slides
    const candidateAngles = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];
    for (const offset of candidateAngles) {
      const a = baseAngle + offset;
      const cx = pos.x + Math.sin(a) * step;
      const cz = pos.z + Math.cos(a) * step;
      if (isPositionFree(cx, cz, radius)) {
        const actualMoved = Math.hypot(cx - pos.x, cz - pos.z);
        pos.x = cx;
        pos.z = cz;
        return { moved: actualMoved, dist: Math.hypot(targetX - pos.x, targetZ - pos.z), angle: a };
      }
    }

    // Fallback axis slide
    const sx = pos.x + nx * step;
    if (isPositionFree(sx, pos.z, radius)) {
      const m = Math.abs(sx - pos.x);
      pos.x = sx;
      return { moved: m, dist: Math.hypot(targetX - pos.x, targetZ - pos.z), angle: baseAngle };
    }
    const sz = pos.z + nz * step;
    if (isPositionFree(pos.x, sz, radius)) {
      const m = Math.abs(sz - pos.z);
      pos.z = sz;
      return { moved: m, dist: Math.hypot(targetX - pos.x, targetZ - pos.z), angle: baseAngle };
    }

    return { moved: 0, dist, angle: baseAngle };
  }

  function buildOutpostWaypoints() {
    const ox = smuffOrigin.x;
    const oz = smuffOrigin.z;
    const raw = [
      [ox - 2.3, oz + 2.1],
      [ox + 2.3, oz + 2.0],
      [ox + 2.5, oz - 2.3],
      [ox - 2.2, oz - 2.3],
    ];
    return raw.map(([wx, wz]) => findNearbyFreePoint(wx, wz, AGENT_RADIUS));
  }

  function buildCourtyardWaypoints() {
    const raw = [
      [-5.2, -4.6],
      [3.6, -4.6],
      [4.6, 3.8],
      [-5.0, 3.8],
    ];
    return raw.map(([wx, wz]) => findNearbyFreePoint(wx, wz, AGENT_RADIUS));
  }

  function buildBackupWaypoints() {
    const raw = [
      [smuffOrigin.x - 1.5, smuffOrigin.z + 3.0],
      [2.8, 3.2],
      [-2.8, -1.8],
      [3.5, -5.2],
    ];
    return raw.map(([wx, wz]) => findNearbyFreePoint(wx, wz, AGENT_RADIUS));
  }

  function spawnRingBurst(x, z, colorHex, maxScale = 2.6, duration = 0.7) {
    if (!ctx.scene) return;
    const geo = new THREE.RingGeometry(0.35, 0.55, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.08, z);
    mesh.renderOrder = 3;
    ctx.scene.add(mesh);
    transientRings.push({ mesh, mat, geo, age: 0, duration, maxScale });
  }

  function createAgent({ model, spawnPos, waypoints, initialState = 'patrol' }) {
    if (!model || !model.scene) return null;

    const id = `fbi-${nextAgentSeq++}`;
    const group = new THREE.Group();
    group.name = `FBI_Agent_${id}`;

    // Reparent model scene cleanly into the agent's root group
    model.scene.position.set(0, 0, 0);
    model.scene.rotation.set(0, 0, 0);
    group.add(model.scene);

    const safeSpawn = findNearbyFreePoint(spawnPos.x, spawnPos.z, AGENT_RADIUS);
    group.position.copy(safeSpawn);

    const visionMesh = createVisionConeMesh();
    group.add(visionMesh);

    const alertBadge = createAlertBadge();
    group.add(alertBadge);

    if (ctx.scene) {
      ctx.scene.add(group);
    }

    const materialRecords = isolateAgentMaterials(model.scene);

    const agent = {
      id,
      model,
      group,
      pos: group.position,
      hp: AGENT_MAX_HP,
      maxHp: AGENT_MAX_HP,
      state: initialState,
      alert: initialState === 'chase' ? 75 : 0,
      waypoints,
      wpIndex: 0,
      visionMesh,
      targetCrateId: null,
      shootCooldown: 0.8,
      koTimer: 0,

      // Internal AI bookkeeping
      _alertBadge: alertBadge,
      _materialRecords: materialRecords,
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
      _aggroTarget: null, // 'player' | 'crockstar' | null
      _crockAggroTimer: 0,
    };

    // Face first waypoint
    if (waypoints.length > 0) {
      const nextWp = waypoints[Math.min(1, waypoints.length - 1)];
      group.rotation.y = Math.atan2(nextWp.x - group.position.x, nextWp.z - group.position.z);
    }

    playClip(model, 'Patrol_Walk', 0.05);
    ctx.fbi.agents.push(agent);
    return agent;
  }

  // Spawn initial 2 patrolling FBI agents
  const outpostWps = buildOutpostWaypoints();
  const courtyardWps = buildCourtyardWaypoints();

  if (ctx.models?.fbi) {
    createAgent({
      model: ctx.models.fbi,
      spawnPos: outpostWps[0],
      waypoints: outpostWps,
    });
  }

  if (typeof ctx.cloneModel === 'function') {
    const fbiClone = ctx.cloneModel('fbi');
    if (fbiClone) {
      createAgent({
        model: fbiClone,
        spawnPos: courtyardWps[0],
        waypoints: courtyardWps,
      });
    }
  }

  function getEffectiveVisionRange() {
    const dosMult = ctx.companions?.dos?.detectionMultiplier ?? 1.0;
    const sneakMult = ctx.player?.isSneaking ? 0.72 : 1.0;
    return BASE_VISION_RANGE * dosMult * sneakMult;
  }

  function updateVisionVisual(agent, effectiveRange) {
    const mesh = agent.visionMesh;
    if (!mesh) return;

    if (agent.state === 'ko') {
      mesh.visible = false;
      agent._alertBadge.visible = false;
      return;
    }

    mesh.visible = true;
    mesh.scale.set(effectiveRange, 1, effectiveRange);

    const styleKey =
      agent.state === 'chase' || agent._seesPlayer
        ? 'chase'
        : agent.state === 'alert' || agent.state === 'investigate'
          ? 'investigate'
          : 'patrol';
    const style = VISION_STYLES[styleKey] || VISION_STYLES.patrol;

    mesh.material.color.setHex(style.color);
    mesh.material.opacity = style.opacity;
    if (mesh.userData.rimMat) {
      mesh.userData.rimMat.color.setHex(style.color);
    }

    // Overhead alert indicator
    const showBadge =
      agent.state === 'chase' ||
      agent.state === 'alert' ||
      agent.state === 'investigate' ||
      agent._seesPlayer;
    agent._alertBadge.visible = showBadge;
    if (showBadge) {
      const badgeColor =
        agent.state === 'chase' || agent._seesPlayer ? 0xff3b3b : 0xff922b;
      agent._alertBadge.userData.mat.color.setHex(badgeColor);
      agent._alertBadge.position.y = 2.25 + Math.sin(elapsed * 7.5) * 0.08;
      agent._alertBadge.rotation.y = elapsed * 2.4;
    }
  }

  function fireTranqDart(agent, targetType, targetPos) {
    const mesh = createTranqDartMesh();
    const fwdX = Math.sin(agent.group.rotation.y);
    const fwdZ = Math.cos(agent.group.rotation.y);

    const startPos = new THREE.Vector3(
      agent.pos.x + fwdX * 0.55,
      1.05,
      agent.pos.z + fwdZ * 0.55
    );
    const aimPos = new THREE.Vector3(targetPos.x, 0.9, targetPos.z);
    const dir = aimPos.clone().sub(startPos);
    const totalDist = Math.max(dir.length(), 0.01);
    dir.divideScalar(totalDist);

    mesh.position.copy(startPos);
    mesh.lookAt(aimPos);
    if (ctx.scene) ctx.scene.add(mesh);

    darts.push({
      mesh,
      pos: startPos,
      dir,
      targetType,
      life: Math.min(totalDist / DART_SPEED + 0.35, 1.4),
    });

    agent.shootCooldown = SHOOT_COOLDOWN_SEC;
    agent._shootAnimTimer = 0.45;
    playClip(agent.model, 'Shoot_Tranq', 0.08);
  }

  function updateDarts(dt) {
    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      d.life -= dt;
      d.pos.addScaledVector(d.dir, DART_SPEED * dt);
      d.mesh.position.copy(d.pos);

      let hit = false;

      // Check hit on Boots
      if (ctx.player && !ctx.player.isDead && ctx.player.pos) {
        const dp = Math.hypot(d.pos.x - ctx.player.pos.x, d.pos.z - ctx.player.pos.z);
        if (dp <= 0.65) {
          hit = true;
          if (typeof ctx.player.takeDamage === 'function') {
            ctx.player.takeDamage(TRANQ_DAMAGE_PLAYER, 'fbi_tranq');
          }
          spawnRingBurst(ctx.player.pos.x, ctx.player.pos.z, 0x3bf7ff, 1.2, 0.35);
        }
      }

      // Check hit on Crockstar (when tamed and alive)
      const crock = ctx.companions?.crockstar;
      if (!hit && crock && crock.tamed && crock.hp > 0 && crock.pos) {
        const dc = Math.hypot(d.pos.x - crock.pos.x, d.pos.z - crock.pos.z);
        if (dc <= 0.85) {
          hit = true;
          crock.hp = Math.max(0, crock.hp - TRANQ_DAMAGE_CROCKSTAR);
          spawnRingBurst(crock.pos.x, crock.pos.z, 0x3bf7ff, 1.35, 0.35);
          if (crock.hp <= 0) {
            crock.mode = 'sit';
            crock.targetAgentId = null;
            ctx.toast?.('Crockstar took heavy tranq fire and is recovering!', 'warn');
          }
          ctx.updateHud?.();
        }
      }

      if (hit || d.life <= 0) {
        if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
        d.mesh.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          }
        });
        darts.splice(i, 1);
      }
    }
  }

  function updateTransientEffects(dt) {
    for (let i = transientRings.length - 1; i >= 0; i--) {
      const r = transientRings[i];
      r.age += dt;
      const t = Math.min(r.age / r.duration, 1);
      const scale = 0.6 + t * r.maxScale;
      r.mesh.scale.set(scale, 1, scale);
      r.mat.opacity = (1 - t) * 0.85;
      if (t >= 1) {
        if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
        r.geo.dispose();
        r.mat.dispose();
        transientRings.splice(i, 1);
      }
    }

    // Animate cage lifting & fading after undetected Smuff rescue
    if (cageUnlockAnim) {
      cageUnlockAnim.age += dt;
      const t = Math.min(cageUnlockAnim.age / cageUnlockAnim.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      cageUnlockAnim.mesh.position.y = cageUnlockAnim.startY + eased * 2.8;
      for (const m of cageUnlockAnim.materials) {
        m.opacity = Math.max(0, 1 - t);
      }
      if (t >= 1) {
        cageUnlockAnim.mesh.visible = false;
        cageUnlockAnim = null;
      }
    }

    // Pulse Smuff rescue beacon while still captive
    if (!smuff.rescued && smuffBeacon.visible) {
      const pulse = 1.0 + Math.sin(elapsed * 3.5) * 0.08;
      smuffBeacon.scale.set(pulse, 1, pulse);
      smuffBeacon.material.opacity = 0.36 + Math.sin(elapsed * 3.5) * 0.14;
    }
  }

  function findNearestConfiscatableCrate(agentPos) {
    const crates = ctx.deathCrates;
    if (!Array.isArray(crates) || crates.length === 0) return null;
    let best = null;
    let bestDist = CRATE_CONFISCATE_RANGE;
    for (const c of crates) {
      if (!c || c.confiscated || c.recovered || !c.pos) continue;
      const d = Math.hypot(c.pos.x - agentPos.x, c.pos.z - agentPos.z);
      if (d <= bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  function getCrateById(crateId) {
    if (!crateId || !Array.isArray(ctx.deathCrates)) return null;
    return ctx.deathCrates.find((c) => c && c.id === crateId && !c.confiscated && !c.recovered) || null;
  }

  function pickChaseTarget(agent) {
    const crock = ctx.companions?.crockstar;
    const crockAlive = Boolean(crock && crock.tamed && crock.hp > 0 && crock.pos);
    const playerAlive = Boolean(ctx.player && !ctx.player.isDead && ctx.player.pos);

    if (crockAlive) {
      const distCrock = Math.hypot(crock.pos.x - agent.pos.x, crock.pos.z - agent.pos.z);
      const distPlayer = playerAlive
        ? Math.hypot(ctx.player.pos.x - agent.pos.x, ctx.player.pos.z - agent.pos.z)
        : Infinity;

      // Crockstar taunts/tanks if he attacked this agent or is actively attacking close by
      if (
        (agent._aggroTarget === 'crockstar' && agent._crockAggroTimer > 0 && distCrock <= 13) ||
        (crock.mode === 'attack' && distCrock <= 4.5 && distCrock <= distPlayer + 1.0)
      ) {
        return { type: 'crockstar', pos: crock.pos, dist: distCrock };
      }
    }

    if (playerAlive) {
      const distPlayer = Math.hypot(ctx.player.pos.x - agent.pos.x, ctx.player.pos.z - agent.pos.z);
      return { type: 'player', pos: ctx.player.pos, dist: distPlayer };
    }

    return null;
  }

  function updateAgent(agent, dt, effectiveRange) {
    // Handle hit flash decay
    if (agent._hitFlashTimer > 0) {
      agent._hitFlashTimer = Math.max(0, agent._hitFlashTimer - dt);
      if (agent._hitFlashTimer <= 0) {
        setHitFlash(agent._materialRecords, false);
      }
    }

    // Handle KO state & revival at FBI tent
    if (agent.state === 'ko') {
      agent.koTimer -= dt;
      agent._seesPlayer = false;
      updateVisionVisual(agent, effectiveRange);
      if (agent.koTimer <= 0) {
        agent.hp = agent.maxHp;
        agent.state = 'patrol';
        agent.alert = 0;
        agent.targetCrateId = null;
        agent._aggroTarget = null;
        agent._crockAggroTimer = 0;
        agent._investigateTarget = null;
        agent._investigatingDecoy = false;
        const reviveSpot = findNearbyFreePoint(tentSpawnPos.x, tentSpawnPos.z, AGENT_RADIUS);
        agent.group.position.copy(reviveSpot);
        agent.model.scene.rotation.x = 0;
        agent.model.scene.position.y = 0;
        agent.visionMesh.visible = true;
        playClip(agent.model, 'Patrol_Walk', 0.15);
        ctx.toast?.('An FBI agent recovered and redeployed from the tent.', 'info');
      }
      return;
    }

    agent.shootCooldown = Math.max(0, agent.shootCooldown - dt);
    agent._alertSpotTimer = Math.max(0, agent._alertSpotTimer - dt);
    agent._shootAnimTimer = Math.max(0, agent._shootAnimTimer - dt);
    agent._crockAggroTimer = Math.max(0, agent._crockAggroTimer - dt);
    if (agent._crockAggroTimer <= 0 && agent._aggroTarget === 'crockstar') {
      agent._aggroTarget = null;
    }

    // 1. Check Boots visibility in vision cone
    const playerAlive = Boolean(ctx.player && !ctx.player.isDead && ctx.player.pos);
    let seesPlayer = false;
    let distToPlayer = Infinity;

    if (playerAlive) {
      const dx = ctx.player.pos.x - agent.pos.x;
      const dz = ctx.player.pos.z - agent.pos.z;
      distToPlayer = Math.hypot(dx, dz);

      const fwdX = Math.sin(agent.group.rotation.y);
      const fwdZ = Math.cos(agent.group.rotation.y);
      const dot = distToPlayer > 0.001 ? (dx / distToPlayer) * fwdX + (dz / distToPlayer) * fwdZ : 1;

      const dosMult = ctx.companions?.dos?.detectionMultiplier ?? 1.0;
      const sneakMult = ctx.player?.isSneaking ? 0.72 : 1.0;
      const proximityBump = 1.05 * dosMult * sneakMult;

      if (distToPlayer <= proximityBump || (distToPlayer <= effectiveRange && dot >= COS_HALF_FOV)) {
        seesPlayer = true;
      }
    }

    const wasSeeing = agent._seesPlayer;
    agent._seesPlayer = seesPlayer;

    if (seesPlayer) {
      const proxFactor = 1.0 + (1.0 - Math.min(distToPlayer / Math.max(effectiveRange, 0.2), 1.0)) * 1.4;
      agent.alert = Math.min(100, agent.alert + 56 * proxFactor * dt);
      ctx.fbi.globalAlert = Math.min(
        100,
        Math.max(ctx.fbi.globalAlert + 32 * proxFactor * dt, agent.alert * 0.88)
      );
      agent._lastKnownTargetPos = ctx.player.pos.clone();
      agent._spotMemoryTimer = 4.2;
      agent._investigatingDecoy = false;
      agent.targetCrateId = null;

      if (!wasSeeing && agent.state !== 'chase') {
        agent._alertSpotTimer = 0.55;
        playClip(agent.model, 'Alert_Spot', 0.1);
      }

      if (agent.alert >= 60 || ctx.fbi.globalAlert >= 65) {
        agent.state = 'chase';
      } else if (agent.state === 'patrol' || agent.state === 'confiscate') {
        agent.state = 'alert';
      }
    } else {
      agent._spotMemoryTimer = Math.max(0, agent._spotMemoryTimer - dt);
      if (agent._spotMemoryTimer <= 0) {
        agent.alert = Math.max(0, agent.alert - 16 * dt);
      }
      if (!playerAlive && agent._aggroTarget !== 'crockstar') {
        agent.alert = Math.max(0, agent.alert - 35 * dt);
        if (agent.state === 'chase' || agent.state === 'alert') {
          agent.state = 'patrol';
        }
      }
    }

    // Global high alert pulls nearby agents into chase
    if (
      playerAlive &&
      ctx.fbi.globalAlert >= 65 &&
      distToPlayer <= 11.5 &&
      agent.state !== 'chase'
    ) {
      agent.state = 'chase';
      agent._lastKnownTargetPos = ctx.player.pos.clone();
      agent._spotMemoryTimer = Math.max(agent._spotMemoryTimer, 2.5);
    }

    // 2. Dos Decoy Beacon luring (when patrolling/investigating and not actively seeing Boots)
    const decoyPos = ctx.companions?.dos?.decoyPos || null;
    const decoyActive =
      decoyPos && (ctx.companions.dos.decoyTimer === undefined || ctx.companions.dos.decoyTimer > 0);
    if (
      decoyActive &&
      !seesPlayer &&
      (agent.state === 'patrol' || agent.state === 'investigate' || agent.state === 'alert')
    ) {
      const distDecoy = Math.hypot(decoyPos.x - agent.pos.x, decoyPos.z - agent.pos.z);
      if (distDecoy <= DECOY_LURE_RANGE) {
        agent.state = 'investigate';
        agent._investigateTarget = new THREE.Vector3(decoyPos.x, 0, decoyPos.z);
        agent._investigatingDecoy = true;
        agent.targetCrateId = null;
      }
    } else if (agent._investigatingDecoy && !decoyActive) {
      agent._investigatingDecoy = false;
      agent._investigateTarget = null;
      if (agent.state === 'investigate') agent.state = 'patrol';
    }

    // 3. Death Crate Confiscation check (when patrolling and not chasing/lured)
    if (agent.state === 'patrol' && !seesPlayer) {
      const crate = findNearestConfiscatableCrate(agent.pos);
      if (crate) {
        agent.state = 'confiscate';
        agent.targetCrateId = crate.id;
        agent._confiscateTimer = 0;
      }
    }

    // 4. Execute state behavior
    if (agent.state === 'chase') {
      const target = pickChaseTarget(agent);
      if (!target || (target.type === 'player' && target.dist > 15.5 && agent._spotMemoryTimer <= 0)) {
        agent.state = agent._lastKnownTargetPos ? 'investigate' : 'patrol';
        agent._investigateTarget = agent._lastKnownTargetPos ? agent._lastKnownTargetPos.clone() : null;
        agent._investigatingDecoy = false;
      } else {
        const aimAngle = Math.atan2(target.pos.x - agent.pos.x, target.pos.z - agent.pos.z);
        rotateToward(agent.group, aimAngle, 8.0, dt);

        let isMoving = false;
        if (target.dist > SHOOT_PREFERRED_DIST) {
          const res = moveEntityToward(agent.pos, target.pos.x, target.pos.z, CHASE_SPEED, dt);
          isMoving = res.moved > 0.002;
        }

        // Fire tranquilizer dart when within range and roughly aimed
        const angleErr = Math.abs(shortestAngleDiff(agent.group.rotation.y, aimAngle));
        if (target.dist <= SHOOT_RANGE && angleErr < 0.42 && agent.shootCooldown <= 0) {
          fireTranqDart(agent, target.type, target.pos);
        }

        if (agent._shootAnimTimer > 0) {
          playClip(agent.model, 'Shoot_Tranq', 0.08);
        } else if (agent._alertSpotTimer > 0) {
          playClip(agent.model, 'Alert_Spot', 0.1);
        } else if (isMoving) {
          playClip(agent.model, 'Chase', 0.14);
        } else {
          playClip(agent.model, 'Alert_Spot', 0.18);
        }
      }
    } else if (agent.state === 'alert') {
      const lookPos = agent._lastKnownTargetPos || ctx.player?.pos;
      if (lookPos) {
        const aimAngle = Math.atan2(lookPos.x - agent.pos.x, lookPos.z - agent.pos.z);
        rotateToward(agent.group, aimAngle, 6.5, dt);
      }

      if (agent._alertSpotTimer > 0) {
        playClip(agent.model, 'Alert_Spot', 0.1);
      } else if (!seesPlayer) {
        if (agent._lastKnownTargetPos) {
          agent.state = 'investigate';
          agent._investigateTarget = agent._lastKnownTargetPos.clone();
          agent._investigatingDecoy = false;
        } else {
          agent.state = 'patrol';
        }
      }
    } else if (agent.state === 'investigate') {
      const targetPos = agent._investigateTarget;
      if (!targetPos) {
        agent.state = 'patrol';
      } else {
        const dist = Math.hypot(targetPos.x - agent.pos.x, targetPos.z - agent.pos.z);
        if (dist > 1.35) {
          const res = moveEntityToward(agent.pos, targetPos.x, targetPos.z, INVESTIGATE_SPEED, dt);
          if (res.angle !== null) rotateToward(agent.group, res.angle, 6.0, dt);
          playClip(agent.model, 'Patrol_Walk', 0.16);
          if (res.moved < 0.002) {
            agent._stuckTimer += dt;
            if (agent._stuckTimer > 2.0) {
              agent._stuckTimer = 0;
              agent._investigateTarget = null;
              agent._investigatingDecoy = false;
              agent.state = 'patrol';
            }
          } else {
            agent._stuckTimer = 0;
          }
        } else {
          // Arrived at decoy or last-known position: sweep with flashlight
          const lookAngle =
            Math.atan2(targetPos.x - agent.pos.x, targetPos.z - agent.pos.z) +
            Math.sin(elapsed * 2.4) * 0.55;
          rotateToward(agent.group, lookAngle, 4.0, dt);
          playClip(agent.model, 'Flashlight_Sweep', 0.18);

          if (!agent._investigatingDecoy) {
            agent._patrolPauseTimer += dt;
            if (agent._patrolPauseTimer >= 2.6) {
              agent._patrolPauseTimer = 0;
              agent._investigateTarget = null;
              agent._lastKnownTargetPos = null;
              agent.state = 'patrol';
            }
          }
        }
      }
    } else if (agent.state === 'confiscate') {
      const crate = getCrateById(agent.targetCrateId);
      if (!crate) {
        agent.targetCrateId = null;
        agent._confiscateTimer = 0;
        agent.state = 'patrol';
      } else {
        const dist = Math.hypot(crate.pos.x - agent.pos.x, crate.pos.z - agent.pos.z);
        if (dist > 1.35) {
          const res = moveEntityToward(agent.pos, crate.pos.x, crate.pos.z, INVESTIGATE_SPEED, dt);
          if (res.angle !== null) rotateToward(agent.group, res.angle, 6.0, dt);
          playClip(agent.model, 'Patrol_Walk', 0.16);
          if (res.moved < 0.002) {
            agent._stuckTimer += dt;
            if (agent._stuckTimer > 2.5) {
              agent._stuckTimer = 0;
              agent.targetCrateId = null;
              agent.state = 'patrol';
            }
          } else {
            agent._stuckTimer = 0;
          }
        } else {
          const faceAngle = Math.atan2(crate.pos.x - agent.pos.x, crate.pos.z - agent.pos.z);
          rotateToward(agent.group, faceAngle, 5.0, dt);
          playClip(agent.model, 'Flashlight_Sweep', 0.16);
          agent._confiscateTimer += dt;
          if (agent._confiscateTimer >= 0.75) {
            ctx.systems?.death?.confiscateCrate?.(crate.id);
            agent.targetCrateId = null;
            agent._confiscateTimer = 0;
            agent.state = 'patrol';
          }
        }
      }
    } else {
      // 'patrol' state
      const wps = agent.waypoints;
      if (wps && wps.length > 0) {
        const wp = wps[agent.wpIndex % wps.length];
        if (agent._patrolPauseTimer > 0) {
          agent._patrolPauseTimer -= dt;
          // Gentle flashlight scan while pausing at waypoint
          agent.group.rotation.y += Math.sin(elapsed * 2.0 + agent.wpIndex) * 0.55 * dt;
          playClip(agent.model, 'Flashlight_Sweep', 0.2);
        } else {
          const res = moveEntityToward(agent.pos, wp.x, wp.z, PATROL_SPEED, dt);
          if (res.angle !== null) rotateToward(agent.group, res.angle, 5.2, dt);
          playClip(agent.model, 'Patrol_Walk', 0.18);

          if (res.dist <= 0.45) {
            agent.wpIndex = (agent.wpIndex + 1) % wps.length;
            agent._patrolPauseTimer = 1.6;
            agent._stuckTimer = 0;
          } else if (res.moved < 0.002) {
            agent._stuckTimer += dt;
            if (agent._stuckTimer > 2.0) {
              agent.wpIndex = (agent.wpIndex + 1) % wps.length;
              agent._stuckTimer = 0;
            }
          } else {
            agent._stuckTimer = 0;
          }
        }
      }
    }

    updateVisionVisual(agent, effectiveRange);
  }

  function applyAgentSeparation(dt) {
    const agents = ctx.fbi.agents;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state === 'ko') continue;
      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j];
        if (b.state === 'ko') continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 0.95) {
          const push = ((0.95 - d) * 1.8) * dt;
          const nx = dx / d;
          const nz = dz / d;
          if (isPositionFree(a.pos.x - nx * push, a.pos.z - nz * push, AGENT_RADIUS)) {
            a.pos.x -= nx * push;
            a.pos.z -= nz * push;
          }
          if (isPositionFree(b.pos.x + nx * push, b.pos.z + nz * push, AGENT_RADIUS)) {
            b.pos.x += nx * push;
            b.pos.z += nz * push;
          }
        }
      }
    }
  }

  function updateSmuff(dt) {
    if (!smuff.group) return;

    if (!smuff.rescued) {
      playClip(ctx.models?.smuff, 'Captured_Idle', 0.2);
      if (smuff.pos !== smuff.group.position) {
        smuff.pos.copy(smuff.group.position);
      }
      return;
    }

    if (smuffCastTimer > 0) {
      smuffCastTimer = Math.max(0, smuffCastTimer - dt);
      playClip(ctx.models?.smuff, 'Ability_Cast', 0.14);
      if (smuff.pos !== smuff.group.position) {
        smuff.pos.copy(smuff.group.position);
      }
      return;
    }

    if (!ctx.player?.pos) return;

    const desiredX = ctx.player.pos.x + (smuff.followOffset?.x ?? 1.55);
    const desiredZ = ctx.player.pos.z + (smuff.followOffset?.z ?? -1.25);
    const dist = Math.hypot(desiredX - smuff.group.position.x, desiredZ - smuff.group.position.z);

    if (dist > 0.5) {
      const speed = ctx.player.isSneaking ? SMUFF_SNEAK_SPEED : SMUFF_FOLLOW_SPEED;
      const res = moveEntityToward(smuff.group.position, desiredX, desiredZ, speed, dt, 0.36);
      if (res.angle !== null) {
        rotateToward(smuff.group, res.angle, 7.5, dt);
      }
      if (res.moved > 0.002) {
        playClip(ctx.models?.smuff, ctx.player.isSneaking ? 'Sneak_Walk' : 'Follow', 0.16);
      } else {
        playClip(ctx.models?.smuff, 'Captured_Idle', 0.2);
      }
    } else {
      const facePlayer = Math.atan2(
        ctx.player.pos.x - smuff.group.position.x,
        ctx.player.pos.z - smuff.group.position.z
      );
      rotateToward(smuff.group, facePlayer, 5.0, dt);

      if (ctx.models?.tarcy?.activeClip === 'Craft') {
        playClip(ctx.models?.smuff, 'Ability_Cast', 0.15);
      } else {
        playClip(ctx.models?.smuff, 'Captured_Idle', 0.22);
      }
    }

    if (smuff.pos !== smuff.group.position) {
      smuff.pos.copy(smuff.group.position);
    }
  }

  function spawnBackup(nearPos) {
    if (ctx.fbi.agents.length >= MAX_AGENTS) return null;
    if (typeof ctx.cloneModel !== 'function') return null;

    const cloned = ctx.cloneModel('fbi');
    if (!cloned) return null;

    backupCooldown = BACKUP_COOLDOWN_SEC;

    const spawnPos = findNearbyFreePoint(tentSpawnPos.x, tentSpawnPos.z, AGENT_RADIUS);
    const agent = createAgent({
      model: cloned,
      spawnPos,
      waypoints: buildBackupWaypoints(),
      initialState: nearPos ? 'chase' : 'patrol',
    });

    if (agent && nearPos) {
      agent._lastKnownTargetPos = new THREE.Vector3(nearPos.x, 0, nearPos.z);
      agent._investigateTarget = agent._lastKnownTargetPos.clone();
      agent._spotMemoryTimer = 5.0;
      agent.alert = 75;
    }

    spawnRingBurst(spawnPos.x, spawnPos.z, 0xff3b3b, 2.2, 0.65);
    ctx.toast?.('FBI backup deployed from the forward camp!', 'danger');
    ctx.updateHud?.();
    return agent;
  }

  function damageAgent(agentId, amount, attackerPos) {
    const agent = ctx.fbi.agents.find((a) => a.id === agentId);
    if (!agent || agent.state === 'ko') return false;

    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return false;

    agent.hp = Math.max(0, agent.hp - dmg);
    agent._hitFlashTimer = 0.22;
    setHitFlash(agent._materialRecords, true);
    spawnRingBurst(agent.pos.x, agent.pos.z, 0xff6b6b, 1.15, 0.32);

    // Determine if Crockstar or Boots dealt the damage and redirect aggro
    const crock = ctx.companions?.crockstar;
    const isCrockAttacker =
      Boolean(crock && crock.tamed && crock.hp > 0 && attackerPos && crock.pos) &&
      Math.hypot(attackerPos.x - crock.pos.x, attackerPos.z - crock.pos.z) <= 2.4;

    if (isCrockAttacker) {
      agent._aggroTarget = 'crockstar';
      agent._crockAggroTimer = 6.5;
    } else {
      agent._aggroTarget = 'player';
      agent.alert = Math.max(agent.alert, 85);
      ctx.fbi.globalAlert = Math.min(100, Math.max(ctx.fbi.globalAlert, 55));
    }

    if (attackerPos) {
      agent._lastKnownTargetPos = new THREE.Vector3(attackerPos.x, 0, attackerPos.z);
      agent._spotMemoryTimer = 5.0;
    }

    if (agent.hp <= 0) {
      agent.state = 'ko';
      agent.koTimer = KO_DURATION_SEC;
      agent.alert = 0;
      agent._seesPlayer = false;
      agent.targetCrateId = null;
      agent._aggroTarget = null;
      agent.visionMesh.visible = false;
      agent._alertBadge.visible = false;
      agent.model.scene.rotation.x = -Math.PI / 2;
      agent.model.scene.position.y = 0.24;
      setHitFlash(agent._materialRecords, false);
      ctx.toast?.('FBI agent knocked out! (Revives in 25s)', 'success');
    } else {
      agent.state = 'chase';
      agent._alertSpotTimer = 0.35;
      playClip(agent.model, 'Alert_Spot', 0.08);
    }

    ctx.updateHud?.();
    return true;
  }

  function tryRescueSmuff() {
    if (smuff.rescued) return false;
    if (!ctx.player?.pos || ctx.player.isDead) return false;

    const smuffPos = smuff.group ? smuff.group.position : smuff.pos;
    const dist = Math.hypot(ctx.player.pos.x - smuffPos.x, ctx.player.pos.z - smuffPos.z);
    if (dist > SMUFF_RESCUE_RANGE) return false;

    if (ctx.fbi.isPlayerDetected || ctx.fbi.globalAlert >= 60) {
      ctx.toast?.(
        'Cannot pick the cage lock while FBI has you spotted! Shake them off or use Dos Undercover/Decoy.',
        'warn'
      );
      return false;
    }

    // Unlock cage & fade bars cleanly
    smuff.rescued = true;
    ctx.player.craftSpeedMultiplier = 1.35;
    smuffBeacon.visible = false;

    if (smuff.cageMesh) {
      const clonedMats = [];
      smuff.cageMesh.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMats = mats.map((m) => {
          const copy = m.clone();
          copy.transparent = true;
          clonedMats.push(copy);
          return copy;
        });
        obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
      });
      cageUnlockAnim = {
        mesh: smuff.cageMesh,
        materials: clonedMats,
        startY: smuff.cageMesh.position.y,
        age: 0,
        duration: 0.9,
      };
    }

    // Remove cage collider under any probable ID used by world setup
    if (typeof ctx.removeCollider === 'function') {
      if (smuff.cageColliderId) ctx.removeCollider(smuff.cageColliderId);
      ctx.removeCollider('fbi_cage');
      ctx.removeCollider('FBI_Holding_Cage');
      ctx.removeCollider('smuff_cage');
      ctx.removeCollider('cage');
    }

    smuffCastTimer = 1.5;
    playClip(ctx.models?.smuff, 'Ability_Cast', 0.1);
    spawnRingBurst(smuffPos.x, smuffPos.z, 0x339af0, 2.8, 0.85);

    ctx.toast?.(
      'Smuff rescued undetected! Permanent +35% crafting & building speed unlocked!',
      'success'
    );
    ctx.updateHud?.();
    return true;
  }

  function update(rawDt) {
    const dt = Math.min(Math.max(rawDt || 0, 0), 0.1);
    elapsed += dt;
    backupCooldown = Math.max(0, backupCooldown - dt);

    const effectiveRange = getEffectiveVisionRange();
    const prevAlert = ctx.fbi.globalAlert;
    const prevDetected = ctx.fbi.isPlayerDetected;

    let anySeesPlayer = false;
    let anyChasingPlayer = false;
    let activeCount = 0;

    for (const agent of ctx.fbi.agents) {
      updateAgent(agent, dt, effectiveRange);
      if (agent.state !== 'ko') {
        activeCount++;
        if (agent._seesPlayer) anySeesPlayer = true;
        if (
          (agent.state === 'chase' || agent.state === 'alert') &&
          agent._aggroTarget !== 'crockstar' &&
          !ctx.player?.isDead
        ) {
          anyChasingPlayer = true;
        }
      }
    }

    applyAgentSeparation(dt);

    // Global alert decay when undetected
    if (!anySeesPlayer && !anyChasingPlayer) {
      ctx.fbi.globalAlert = Math.max(0, ctx.fbi.globalAlert - 7.5 * dt);
    } else if (!anySeesPlayer && anyChasingPlayer) {
      ctx.fbi.globalAlert = Math.max(0, ctx.fbi.globalAlert - 2.5 * dt);
    }

    ctx.fbi.isPlayerDetected = Boolean(
      !ctx.player?.isDead && (anySeesPlayer || anyChasingPlayer)
    );

    // Trigger backup spawn at high global alert (>= 85)
    if (
      ctx.fbi.globalAlert >= 85 &&
      activeCount < MAX_AGENTS &&
      ctx.fbi.agents.length < MAX_AGENTS &&
      backupCooldown <= 0
    ) {
      spawnBackup(ctx.player?.pos);
    }

    updateDarts(dt);
    updateSmuff(dt);
    updateTransientEffects(dt);

    // Throttled HUD sync when alert meter or detection status changes
    hudSyncTimer += dt;
    if (
      prevDetected !== ctx.fbi.isPlayerDetected ||
      (Math.abs(ctx.fbi.globalAlert - prevAlert) > 0.25 && hudSyncTimer >= 0.15)
    ) {
      hudSyncTimer = 0;
      ctx.updateHud?.();
    }
  }

  function getAgents() {
    return ctx.fbi.agents;
  }

  return {
    update,
    damageAgent,
    tryRescueSmuff,
    spawnBackup,
    getAgents,
  };
}
