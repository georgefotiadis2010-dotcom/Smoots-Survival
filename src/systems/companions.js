import * as THREE from 'three';

const DECOY_DURATION = 12;
const DECOY_COOLDOWN = 16;
const DECOY_DETECT_FBI_RANGE = 10;
const DECOY_FORWARD_DIST = 3.5;

const CROCK_TAME_DIST = 2.8;
const CROCK_ATTACK_DETECT_RANGE = 12;
const CROCK_BITE_RANGE = 1.55;
const CROCK_BITE_DAMAGE = 28;
const CROCK_BITE_COOLDOWN = 1.1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function lerpAngle(current, target, t) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * clamp(t, 0, 1);
}

function createStealthAuraVisuals() {
  const bootsGroup = new THREE.Group();
  bootsGroup.name = 'Dos_Stealth_Aura_Boots';
  bootsGroup.visible = false;

  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.24, 36), outerMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.05;
  bootsGroup.add(outerRing);

  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.78, 24), innerMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.055;
  bootsGroup.add(innerRing);

  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fillDisc = new THREE.Mesh(new THREE.CircleGeometry(1.02, 32), fillMat);
  fillDisc.rotation.x = -Math.PI / 2;
  fillDisc.position.y = 0.045;
  bootsGroup.add(fillDisc);

  const dosGroup = new THREE.Group();
  dosGroup.name = 'Dos_Stealth_Aura_Self';
  dosGroup.visible = false;

  const dosRingMat = new THREE.MeshBasicMaterial({
    color: 0x38d9a9,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dosRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 28), dosRingMat);
  dosRing.rotation.x = -Math.PI / 2;
  dosRing.position.y = 0.05;
  dosGroup.add(dosRing);

  const dosGoldMat = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dosGoldRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 20), dosGoldMat);
  dosGoldRing.rotation.x = -Math.PI / 2;
  dosGoldRing.position.y = 0.055;
  dosGroup.add(dosGoldRing);

  return {
    bootsGroup,
    dosGroup,
    outerRing,
    innerRing,
    outerMat,
    innerMat,
    fillMat,
    dosRingMat,
    dosGoldMat,
  };
}

function createDecoyBeaconVisuals() {
  const group = new THREE.Group();
  group.name = 'Dos_Decoy_Beacon';
  group.visible = false;

  // Outline ring on ground
  const outlineMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 16),
    new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outlineMesh.rotation.x = -Math.PI / 2;
  outlineMesh.position.y = 0.02;
  group.add(outlineMesh);

  // Metallic dark base
  const baseMat = new THREE.MeshToonMaterial({ color: 0x262a30 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.14, 8), baseMat);
  base.position.y = 0.07;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Gold collar
  const goldMat = new THREE.MeshToonMaterial({ color: 0xfcc419 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 8), goldMat);
  collar.position.y = 0.19;
  collar.castShadow = true;
  group.add(collar);

  // Crimson tactical housing
  const bodyMat = new THREE.MeshToonMaterial({ color: 0xc92a2a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 8), bodyMat);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  // Blinking dome
  const domeMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), domeMat);
  dome.position.y = 0.48;
  group.add(dome);

  // Small antenna + gold tip
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6),
    baseMat
  );
  antenna.position.set(0.06, 0.56, 0);
  group.add(antenna);

  const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd43b });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), tipMat);
  tip.position.set(0.06, 0.7, 0);
  group.add(tip);

  // Expanding sonar pulse rings
  const pulseRings = [];
  const ringColors = [0xff3b3b, 0xffd43b];
  for (let i = 0; i < 2; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: ringColors[i],
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 36), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06 + i * 0.005;
    group.add(mesh);
    pulseRings.push({ mesh, mat, phaseOffset: i * 0.5 });
  }

  const light = new THREE.PointLight(0xff4d3b, 1.8, 4.5, 1.6);
  light.position.set(0, 0.6, 0);
  group.add(light);

  return { group, dome, domeMat, tipMat, pulseRings, light };
}

function createWaterRippleVisuals() {
  const group = new THREE.Group();
  group.name = 'Crockstar_Water_Ripples';
  group.visible = false;

  const rings = [];
  const colors = [0xe3fafc, 0x66d9e8];
  for (let i = 0; i < 2; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i],
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.94, 32), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04 + i * 0.004;
    group.add(mesh);
    rings.push({ mesh, mat, phaseOffset: i * 0.5 });
  }

  return { group, rings };
}

function createTameBurstVisuals() {
  const group = new THREE.Group();
  group.name = 'Crockstar_Tame_Burst';
  group.visible = false;

  const particles = [];
  const geoStar = new THREE.OctahedronGeometry(0.11, 0);
  const geoHeart = new THREE.SphereGeometry(0.1, 8, 8);

  for (let i = 0; i < 10; i += 1) {
    const isHeart = i % 2 === 0;
    const mat = new THREE.MeshBasicMaterial({
      color: isHeart ? 0xff5c8a : 0xffd43b,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(isHeart ? geoHeart : geoStar, mat);
    if (isHeart) {
      mesh.scale.set(1.15, 1.0, 0.7);
    }
    group.add(mesh);
    const angle = (i / 10) * Math.PI * 2;
    particles.push({
      mesh,
      mat,
      angle,
      speed: 0.7 + (i % 3) * 0.25,
      rise: 1.15 + (i % 4) * 0.28,
    });
  }

  return { group, particles };
}

function createBiteImpactVisuals() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffa94d,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.65, 16), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.55;
  mesh.visible = false;
  return { mesh, mat };
}

function createHealthBarVisuals() {
  const group = new THREE.Group();
  group.name = 'Crockstar_HP_Bar';
  group.visible = false;

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.16),
    new THREE.MeshBasicMaterial({
      color: 0x16191d,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    })
  );
  group.add(bg);

  const fillGeo = new THREE.PlaneGeometry(1.0, 0.09);
  fillGeo.translate(0.5, 0, 0); // Anchor left edge at x=0
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x51cf66,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.position.set(-0.5, 0, 0.005);
  group.add(fill);

  bg.renderOrder = 20;
  fill.renderOrder = 21;

  return { group, fill, fillMat };
}

export function createCompanionSystem(ctx) {
  const dos = ctx.companions.dos;
  const crock = ctx.companions.crockstar;

  // Ensure canonical starting values per contract
  dos.mode = dos.mode || 'follow';
  dos.detectionMultiplier = dos.mode === 'undercover' ? 0.5 : 1.0;
  dos.decoyPos = dos.decoyPos || null;
  dos.decoyTimer = dos.decoyTimer || 0;

  crock.tamed = Boolean(crock.tamed);
  crock.mode = crock.tamed ? crock.mode || 'follow' : 'wild';
  crock.maxHp = crock.maxHp || 160;
  crock.hp = typeof crock.hp === 'number' ? crock.hp : crock.maxHp;
  crock.targetAgentId = null;

  // Internal state — Dos
  let dosCurrentClip = '';
  let dosWasMoving = false;
  let decoyCooldown = 0;
  let decoyPhase = 'idle'; // 'idle' | 'running' | 'signaling'
  let decoyTarget = new THREE.Vector3();
  let decoyRunTimer = 0;
  let decoySignalTimer = 0;
  let previousDosMode = 'follow';
  const beaconWorldPos = new THREE.Vector3();

  // Internal state — Crockstar
  let crockCurrentClip = '';
  let crockTameCelebrateTimer = 0;
  let crockBiteCooldown = 0;
  let crockBiteAnimTimer = 0;
  let crockRecovering = false;
  let crockLastDamageAt = -10;
  let prevCrockHp = crock.hp;
  let crockHomePos = crock.pos.clone();

  // Wild patrol waypoints along southern shoreline & lagoon
  const wildCenterX = clamp(crockHomePos.x, -6, 6);
  const wildWaypoints = [
    new THREE.Vector3(wildCenterX - 2.6, 0, 6.7),
    new THREE.Vector3(wildCenterX + 1.8, 0, 6.9),
    new THREE.Vector3(wildCenterX + 3.2, 0, 8.8),
    new THREE.Vector3(wildCenterX - 0.5, 0, 9.6),
    new THREE.Vector3(wildCenterX - 3.4, 0, 8.5),
  ];
  let wildWpIndex = 0;
  let wildPauseTimer = 0.8;

  // Visual FX
  const stealthAura = createStealthAuraVisuals();
  const decoyVisuals = createDecoyBeaconVisuals();
  const waterRipples = createWaterRippleVisuals();
  const tameBurst = createTameBurstVisuals();
  const biteImpact = createBiteImpactVisuals();
  const crockHpBar = createHealthBarVisuals();

  ctx.scene.add(stealthAura.bootsGroup);
  ctx.scene.add(stealthAura.dosGroup);
  ctx.scene.add(decoyVisuals.group);
  ctx.scene.add(waterRipples.group);
  ctx.scene.add(tameBurst.group);
  ctx.scene.add(biteImpact.mesh);
  ctx.scene.add(crockHpBar.group);

  let elapsed = 0;
  let tameBurstTimer = 0;
  let biteImpactTimer = 0;
  let hudSyncAccum = 0;

  function getBounds() {
    const b = ctx.worldBounds || { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
    return {
      minX: b.minX + 0.55,
      maxX: b.maxX - 0.55,
      minZ: b.minZ + 0.55,
      maxZ: b.maxZ - 0.55,
    };
  }

  function isValidPos(x, z, radius, canSwim) {
    const b = getBounds();
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
    if (!canSwim && ctx.isWater?.(x, z)) return false;
    if (ctx.isBlocked?.(x, z, radius)) return false;
    return true;
  }

  function playDosAnim(clipName, fadeSec = 0.16) {
    if (!ctx.models?.dos?.play) return;
    if (dosCurrentClip === clipName) return;
    dosCurrentClip = clipName;
    ctx.models.dos.play(clipName, fadeSec);
  }

  function playCrockAnim(clipName, fadeSec = 0.16) {
    if (!ctx.models?.crockstar?.play) return;
    if (crockCurrentClip === clipName) return;
    crockCurrentClip = clipName;
    ctx.models.crockstar.play(clipName, fadeSec);
  }

  function moveEntityToward(pos, group, targetX, targetZ, speed, dt, radius, canSwim) {
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) return 0;

    const step = Math.min(speed * dt, dist);
    const baseAngle = Math.atan2(dx, dz);
    const angleOffsets = [0, 0.5, -0.5, 1.05, -1.05, 1.57, -1.57];

    for (const offset of angleOffsets) {
      const ang = baseAngle + offset;
      const nx = pos.x + Math.sin(ang) * step;
      const nz = pos.z + Math.cos(ang) * step;
      if (isValidPos(nx, nz, radius, canSwim)) {
        pos.x = nx;
        pos.z = nz;
        if (group) {
          group.rotation.y = lerpAngle(group.rotation.y, ang, Math.min(1, dt * 11));
        }
        return step;
      }
    }

    // If trapped in water for a non-swimmer, nudge north out of the lagoon
    if (!canSwim && ctx.isWater?.(pos.x, pos.z)) {
      const b = getBounds();
      pos.z = clamp(pos.z - speed * dt, b.minZ, b.maxZ);
      if (group) {
        group.rotation.y = lerpAngle(group.rotation.y, Math.PI, Math.min(1, dt * 10));
      }
      return speed * dt;
    }

    return 0;
  }

  function findNearbyValidSpot(cx, cz, preferDist, radius, canSwim) {
    const b = getBounds();
    const candidates = [
      [0, 0],
      [-preferDist, 0.4],
      [preferDist, 0.4],
      [0, -preferDist],
      [-preferDist, -preferDist * 0.7],
      [preferDist, -preferDist * 0.7],
      [0, preferDist],
    ];
    for (const [ox, oz] of candidates) {
      const tx = clamp(cx + ox, b.minX, b.maxX);
      const tz = clamp(cz + oz, b.minZ, b.maxZ);
      if (isValidPos(tx, tz, radius, canSwim)) {
        return { x: tx, z: tz };
      }
    }
    return { x: clamp(cx, b.minX, b.maxX), z: clamp(cz, b.minZ, b.maxZ) };
  }

  function findNearestActiveFBI(origin, maxRange) {
    const agents = ctx.fbi?.agents || [];
    let best = null;
    let bestDist = maxRange;
    for (const agent of agents) {
      if (!agent || agent.state === 'ko') continue;
      if (typeof agent.hp === 'number' && agent.hp <= 0) continue;
      if (!agent.pos) continue;
      const d = distXZ(origin, agent.pos);
      if (d <= bestDist) {
        bestDist = d;
        best = agent;
      }
    }
    return best;
  }

  function computeDecoyPlacementTarget() {
    const pPos = ctx.player.pos;
    const b = getBounds();
    let dirX = Math.sin(ctx.player.group?.rotation?.y || 0);
    let dirZ = Math.cos(ctx.player.group?.rotation?.y || 0);
    let targetDist = DECOY_FORWARD_DIST;

    const nearestFbi = findNearestActiveFBI(pPos, DECOY_DETECT_FBI_RANGE);
    if (nearestFbi) {
      const toFbiX = nearestFbi.pos.x - pPos.x;
      const toFbiZ = nearestFbi.pos.z - pPos.z;
      const len = Math.hypot(toFbiX, toFbiZ);
      if (len > 0.01) {
        dirX = toFbiX / len;
        dirZ = toFbiZ / len;
        // Place ~3.5u toward patrol, stopping a safe distance before the agent
        targetDist = clamp(Math.min(DECOY_FORWARD_DIST, len - 2.0), 1.6, DECOY_FORWARD_DIST);
      }
    }

    const baseAngle = Math.atan2(dirX, dirZ);
    const distSteps = [targetDist, targetDist * 0.75, targetDist * 0.5, 1.4];
    const angleOffsets = [0, 0.45, -0.45, 0.9, -0.9, Math.PI];

    for (const d of distSteps) {
      for (const aOff of angleOffsets) {
        const ang = baseAngle + aOff;
        const tx = clamp(pPos.x + Math.sin(ang) * d, b.minX, b.maxX);
        const tz = clamp(pPos.z + Math.cos(ang) * d, b.minZ, b.maxZ);
        if (isValidPos(tx, tz, 0.35, false)) {
          return new THREE.Vector3(tx, 0, tz);
        }
      }
    }

    return new THREE.Vector3(dos.pos.x, 0, dos.pos.z);
  }

  function plantBeaconAt(x, z) {
    beaconWorldPos.set(x, 0, z);
    dos.decoyPos = beaconWorldPos.clone();
    dos.decoyTimer = DECOY_DURATION;

    decoyVisuals.group.position.set(x, 0, z);
    decoyVisuals.group.visible = true;

    ctx.toast?.('Dos planted a Decoy Beacon! Nearby FBI patrols are being lured away (12s).', 'success');
    ctx.updateHud?.();
  }

  // -------------------------------------------------------------------------
  // Public Commands — Dos
  // -------------------------------------------------------------------------
  function setDosMode(mode) {
    if (mode === 'decoy') {
      return deployDecoyBeacon();
    }
    if (mode !== 'follow' && mode !== 'undercover') {
      return false;
    }

    // Cancel pending decoy run if user explicitly switches mode
    if (decoyPhase !== 'idle') {
      decoyPhase = 'idle';
      decoyRunTimer = 0;
      decoySignalTimer = 0;
    }

    dos.mode = mode;
    previousDosMode = mode;
    dos.detectionMultiplier = mode === 'undercover' ? 0.5 : 1.0;

    if (mode === 'undercover') {
      playDosAnim('Hide_Assist_Aura');
      ctx.toast?.('Dos: Undercover Mode active — FBI detection radius reduced by 50%!', 'info');
    } else {
      playDosAnim('Idle');
      ctx.toast?.('Dos: Follow Mode active.', 'info');
    }

    ctx.updateHud?.();
    return true;
  }

  function deployDecoyBeacon() {
    if (decoyCooldown > 0) {
      ctx.toast?.(`Decoy Beacon recharging (${Math.ceil(decoyCooldown)}s remaining).`, 'warn');
      return false;
    }

    if (dos.mode !== 'decoy') {
      previousDosMode = dos.mode === 'undercover' ? 'undercover' : 'follow';
    }

    decoyTarget = computeDecoyPlacementTarget();
    decoyCooldown = DECOY_COOLDOWN;
    decoyPhase = 'running';
    decoyRunTimer = 0.95; // Max run time so Dos always plants cleanly
    decoySignalTimer = 0;

    dos.mode = 'decoy';
    dos.detectionMultiplier = previousDosMode === 'undercover' ? 0.5 : 1.0;

    playDosAnim('Follow');
    ctx.toast?.('Dos is deploying a Decoy Beacon...', 'info');
    ctx.updateHud?.();
    return true;
  }

  // -------------------------------------------------------------------------
  // Public Commands — Crockstar
  // -------------------------------------------------------------------------
  function tryTameCrockstar() {
    if (crock.tamed) {
      ctx.toast?.('Crockstar is already tamed!', 'info');
      return true;
    }

    const d = distXZ(ctx.player.pos, crock.pos);
    if (d > CROCK_TAME_DIST) {
      ctx.toast?.('Move closer to Crockstar to feed and tame him.', 'info');
      return false;
    }

    const fishCount = ctx.player.countItem?.('fish') || 0;
    const meatCount = ctx.player.countItem?.('meat') || 0;

    if (fishCount <= 0 && meatCount <= 0) {
      ctx.toast?.('You need Fish or Meat to tame Crockstar! Gather Fish or Meat first.', 'warn');
      return false;
    }

    if (fishCount > 0) {
      ctx.player.removeItem('fish', 1);
    } else {
      ctx.player.removeItem('meat', 1);
    }

    crock.tamed = true;
    crock.mode = 'follow';
    crock.hp = crock.maxHp;
    crock.targetAgentId = null;
    prevCrockHp = crock.hp;
    crockTameCelebrateTimer = 1.65;

    // Trigger celebratory heart/star particle burst
    tameBurstTimer = 1.75;
    tameBurst.group.position.set(crock.pos.x, Math.max(0, crock.pos.y) + 0.9, crock.pos.z);
    tameBurst.group.visible = true;

    playCrockAnim('Friendly_Sit', 0.12);
    ctx.toast?.('Crockstar tamed! He can swim across deep water and fight FBI agents.', 'success');
    ctx.updateHud?.();
    return true;
  }

  function commandCrockstar(mode) {
    if (!crock.tamed) {
      ctx.toast?.('Tame Crockstar first by approaching him with Fish or Meat!', 'warn');
      return false;
    }
    if (mode !== 'follow' && mode !== 'attack' && mode !== 'sit') {
      return false;
    }

    crock.mode = mode;
    crockTameCelebrateTimer = 0;

    if (mode !== 'attack') {
      crock.targetAgentId = null;
    }

    if (mode === 'follow') {
      ctx.toast?.('Crockstar: Follow Mode.', 'info');
    } else if (mode === 'attack') {
      ctx.toast?.('Crockstar: Attack Mode — charging nearby FBI agents!', 'warn');
    } else if (mode === 'sit') {
      ctx.toast?.('Crockstar: Sit & Guard Mode — recovering HP faster.', 'info');
    }

    ctx.updateHud?.();
    return true;
  }

  // -------------------------------------------------------------------------
  // Update — Dos
  // -------------------------------------------------------------------------
  function updateDos(dt) {
    const pPos = ctx.player.pos;

    // Tick cooldown & active beacon timer
    if (decoyCooldown > 0) {
      decoyCooldown = Math.max(0, decoyCooldown - dt);
    }

    if (dos.decoyTimer > 0) {
      dos.decoyTimer = Math.max(0, dos.decoyTimer - dt);
      if (dos.decoyTimer <= 0) {
        dos.decoyPos = null;
        decoyVisuals.group.visible = false;
        ctx.toast?.('Decoy Beacon signal faded.', 'info');
        ctx.updateHud?.();
      }
    }

    // Handle active decoy deployment phases
    if (decoyPhase === 'running') {
      decoyRunTimer -= dt;
      const distToTarget = distXZ(dos.pos, decoyTarget);
      if (distToTarget > 0.35 && decoyRunTimer > 0) {
        moveEntityToward(dos.pos, dos.group, decoyTarget.x, decoyTarget.z, 6.8, dt, 0.34, false);
        playDosAnim('Follow');
      } else {
        plantBeaconAt(dos.pos.x, dos.pos.z);
        decoyPhase = 'signaling';
        decoySignalTimer = 0.85;
        playDosAnim('Alert_Signal', 0.12);
      }
    } else if (decoyPhase === 'signaling') {
      decoySignalTimer -= dt;
      // Face toward nearest FBI agent or away from Boots while signaling
      const nearAgent = findNearestActiveFBI(dos.pos, 14);
      if (nearAgent && dos.group) {
        const ang = Math.atan2(nearAgent.pos.x - dos.pos.x, nearAgent.pos.z - dos.pos.z);
        dos.group.rotation.y = lerpAngle(dos.group.rotation.y, ang, Math.min(1, dt * 10));
      }
      playDosAnim('Alert_Signal');

      if (decoySignalTimer <= 0) {
        decoyPhase = 'idle';
        dos.mode = previousDosMode;
        dos.detectionMultiplier = dos.mode === 'undercover' ? 0.5 : 1.0;
        ctx.updateHud?.();
      }
    } else {
      // Standard 'follow' or 'undercover' positioning near Boots
      const isUndercover = dos.mode === 'undercover';
      dos.detectionMultiplier = isUndercover ? 0.5 : 1.0;

      // Catch up cleanly if Boots respawned far away
      const distToPlayer = distXZ(dos.pos, pPos);
      if (distToPlayer > 14) {
        const spot = findNearbyValidSpot(pPos.x, pPos.z, 1.6, 0.34, false);
        dos.pos.x = spot.x;
        dos.pos.z = spot.z;
      }

      // Compute follow offset (~1.6u in follow, ~1.35u in undercover) slightly left/behind Boots
      const pRot = ctx.player.group?.rotation?.y || 0;
      const offsetDist = isUndercover ? 1.35 : 1.6;
      const sideAngle = pRot - Math.PI * 0.72;
      let goalX = pPos.x + Math.sin(sideAngle) * offsetDist;
      let goalZ = pPos.z + Math.cos(sideAngle) * offsetDist;

      // Keep goal out of deep water & obstacles
      if (!isValidPos(goalX, goalZ, 0.34, false)) {
        const safe = findNearbyValidSpot(pPos.x, pPos.z, offsetDist, 0.34, false);
        goalX = safe.x;
        goalZ = safe.z;
      }

      const distToGoal = distXZ(dos.pos, { x: goalX, z: goalZ });
      const moveStartThreshold = dosWasMoving ? 0.22 : 0.45;

      if (distToGoal > moveStartThreshold) {
        const speed = distToPlayer > 4.5 ? 6.4 : 4.5;
        const moved = moveEntityToward(dos.pos, dos.group, goalX, goalZ, speed, dt, 0.34, false);
        dosWasMoving = moved > 0.002;

        if (isUndercover && distToPlayer < 2.5) {
          playDosAnim('Hide_Assist_Aura');
        } else if (distToGoal > 1.1) {
          playDosAnim('Follow');
        } else {
          playDosAnim('Waddle');
        }
      } else {
        dosWasMoving = false;
        if (dos.group) {
          const faceBoots = Math.atan2(pPos.x - dos.pos.x, pPos.z - dos.pos.z);
          dos.group.rotation.y = lerpAngle(dos.group.rotation.y, faceBoots, Math.min(1, dt * 6));
        }
        playDosAnim(isUndercover ? 'Hide_Assist_Aura' : 'Idle');
      }
    }

    // Keep Dos on dry land height
    dos.pos.y = 0;

    // Update Undercover Stealth Aura Visuals
    const showAura = dos.mode === 'undercover' && !ctx.player.isDead;
    stealthAura.bootsGroup.visible = showAura;
    stealthAura.dosGroup.visible = showAura;
    if (showAura) {
      stealthAura.bootsGroup.position.set(pPos.x, 0, pPos.z);
      stealthAura.dosGroup.position.set(dos.pos.x, 0, dos.pos.z);

      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.8);
      const scale = 0.96 + pulse * 0.08;
      stealthAura.outerRing.scale.setScalar(scale);
      stealthAura.innerRing.rotation.z = elapsed * 0.9;
      stealthAura.outerMat.opacity = 0.32 + pulse * 0.26;
      stealthAura.innerMat.opacity = 0.26 + (1 - pulse) * 0.24;
      stealthAura.fillMat.opacity = 0.08 + pulse * 0.06;
      stealthAura.dosRingMat.opacity = 0.34 + pulse * 0.24;
      stealthAura.dosGoldMat.opacity = 0.25 + (1 - pulse) * 0.22;
    }

    // Animate active Decoy Beacon VFX
    if (decoyVisuals.group.visible && dos.decoyPos) {
      const blink = Math.sin(elapsed * 12) > 0;
      decoyVisuals.domeMat.color.setHex(blink ? 0xff3b3b : 0xffd43b);
      decoyVisuals.tipMat.color.setHex(blink ? 0xffd43b : 0xff3b3b);
      decoyVisuals.light.color.setHex(blink ? 0xff3b3b : 0xffb703);
      decoyVisuals.light.intensity = blink ? 2.1 : 0.9;

      for (const ring of decoyVisuals.pulseRings) {
        const phase = (elapsed * 0.95 + ring.phaseOffset) % 1;
        const rScale = 0.38 + phase * 3.35;
        ring.mesh.scale.setScalar(rScale);
        ring.mat.opacity = (1 - phase) * 0.65;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Update — Crockstar
  // -------------------------------------------------------------------------
  function updateCrockstar(dt) {
    const pPos = ctx.player.pos;

    // Detect external damage (e.g., FBI tranquilizer hits while tanking)
    if (crock.hp < prevCrockHp - 0.01) {
      crockLastDamageAt = elapsed;
    }
    crock.hp = clamp(crock.hp, 0, crock.maxHp);

    if (crock.tamed && crock.hp <= 0 && !crockRecovering) {
      crockRecovering = true;
      crock.targetAgentId = null;
      ctx.toast?.('Crockstar is battered and catching his breath!', 'warn');
      ctx.updateHud?.();
    }

    if (crockBiteCooldown > 0) {
      crockBiteCooldown = Math.max(0, crockBiteCooldown - dt);
    }
    if (crockBiteAnimTimer > 0) {
      crockBiteAnimTimer = Math.max(0, crockBiteAnimTimer - dt);
    }

    const inWater = Boolean(ctx.isWater?.(crock.pos.x, crock.pos.z));

    if (!crock.tamed) {
      // Wild shoreline & deep-water roaming
      crock.mode = 'wild';
      const distToBoots = distXZ(crock.pos, pPos);

      if (distToBoots < 3.0) {
        // Pause curiously and look at Boots so taming feels responsive
        if (crock.group) {
          const ang = Math.atan2(pPos.x - crock.pos.x, pPos.z - crock.pos.z);
          crock.group.rotation.y = lerpAngle(crock.group.rotation.y, ang, Math.min(1, dt * 6));
        }
        playCrockAnim(inWater ? 'Swim' : 'Idle');
      } else if (wildPauseTimer > 0) {
        wildPauseTimer -= dt;
        playCrockAnim(inWater ? 'Swim' : 'Idle');
      } else {
        const wp = wildWaypoints[wildWpIndex];
        const dWp = distXZ(crock.pos, wp);
        if (dWp < 0.55) {
          wildWpIndex = (wildWpIndex + 1) % wildWaypoints.length;
          wildPauseTimer = 1.4 + (wildWpIndex % 3) * 0.7;
          playCrockAnim(inWater ? 'Swim' : 'Idle');
        } else {
          const speed = inWater ? 2.2 : 1.85;
          const moved = moveEntityToward(crock.pos, crock.group, wp.x, wp.z, speed, dt, 0.44, true);
          if (moved < 0.001) {
            wildWpIndex = (wildWpIndex + 1) % wildWaypoints.length;
          }
          playCrockAnim(inWater ? 'Swim' : 'Walk');
        }
      }
    } else if (crockRecovering) {
      // Rapid rest recovery until 50% HP
      crock.hp = Math.min(crock.maxHp, crock.hp + 22 * dt);
      playCrockAnim(inWater ? 'Swim' : 'Friendly_Sit');
      if (crock.hp >= crock.maxHp * 0.5) {
        crockRecovering = false;
        ctx.toast?.('Crockstar is back in action!', 'success');
        ctx.updateHud?.();
      }
    } else if (crockTameCelebrateTimer > 0) {
      crockTameCelebrateTimer -= dt;
      if (crock.group) {
        const faceBoots = Math.atan2(pPos.x - crock.pos.x, pPos.z - crock.pos.z);
        crock.group.rotation.y = lerpAngle(crock.group.rotation.y, faceBoots, Math.min(1, dt * 8));
      }
      playCrockAnim(inWater ? 'Swim' : 'Friendly_Sit');
    } else if (crock.mode === 'sit') {
      // Sit & guard current spot, regenerating HP faster
      crock.targetAgentId = null;
      if (crock.hp < crock.maxHp && elapsed - crockLastDamageAt > 1.5) {
        crock.hp = Math.min(crock.maxHp, crock.hp + 12 * dt);
      }
      playCrockAnim(inWater ? 'Swim' : 'Friendly_Sit');
    } else if (crock.mode === 'attack') {
      // Search nearest active FBI agent within 12 units (of Crockstar or Boots)
      let target = findNearestActiveFBI(crock.pos, CROCK_ATTACK_DETECT_RANGE);
      if (!target) {
        target = findNearestActiveFBI(pPos, CROCK_ATTACK_DETECT_RANGE);
      }

      if (target) {
        crock.targetAgentId = target.id;
        const distToTarget = distXZ(crock.pos, target.pos);

        if (distToTarget > CROCK_BITE_RANGE) {
          const chargeSpeed = inWater ? 5.2 : 5.6;
          moveEntityToward(crock.pos, crock.group, target.pos.x, target.pos.z, chargeSpeed, dt, 0.44, true);
          playCrockAnim(crockBiteAnimTimer > 0 ? 'Bite_Attack' : inWater ? 'Swim' : 'Walk');
        } else {
          // Face target and bite!
          if (crock.group) {
            const ang = Math.atan2(target.pos.x - crock.pos.x, target.pos.z - crock.pos.z);
            crock.group.rotation.y = lerpAngle(crock.group.rotation.y, ang, Math.min(1, dt * 14));
          }

          if (crockBiteCooldown <= 0) {
            crockBiteCooldown = CROCK_BITE_COOLDOWN;
            crockBiteAnimTimer = 0.55;
            crockLastDamageAt = elapsed; // Actively in combat
            playCrockAnim('Bite_Attack', 0.08);
            ctx.systems?.fbi?.damageAgent?.(target.id, CROCK_BITE_DAMAGE, crock.pos);

            // Spawn brief bite impact ring at target
            biteImpactTimer = 0.32;
            biteImpact.mesh.position.set(target.pos.x, 0.55, target.pos.z);
            biteImpact.mesh.scale.setScalar(0.5);
            biteImpact.mesh.visible = true;
          } else {
            playCrockAnim(crockBiteAnimTimer > 0 ? 'Bite_Attack' : inWater ? 'Swim' : 'Idle');
          }
        }
      } else {
        // No FBI within 12u: shadow Boots and slowly regen HP out of combat
        crock.targetAgentId = null;
        if (crock.hp < crock.maxHp && elapsed - crockLastDamageAt > 3.5) {
          crock.hp = Math.min(crock.maxHp, crock.hp + 4 * dt);
        }
        followBootsAsCrockstar(dt, inWater, 2.2);
      }
    } else {
      // 'follow' mode (swims across deep water & walks on land)
      crock.targetAgentId = null;
      if (crock.hp < crock.maxHp && elapsed - crockLastDamageAt > 3.5) {
        crock.hp = Math.min(crock.maxHp, crock.hp + 4 * dt);
      }
      followBootsAsCrockstar(dt, inWater, 2.1);
    }

    // Smooth vertical immersion in deep water (-0.22 in water, 0 on land)
    const nowInWater = Boolean(ctx.isWater?.(crock.pos.x, crock.pos.z));
    const targetY = nowInWater ? -0.22 : 0;
    crock.pos.y += (targetY - crock.pos.y) * Math.min(1, dt * 8);

    // Animated water ripple ring when in deep water
    waterRipples.group.visible = nowInWater;
    if (nowInWater) {
      waterRipples.group.position.set(crock.pos.x, 0, crock.pos.z);
      for (const r of waterRipples.rings) {
        const phase = (elapsed * 0.9 + r.phaseOffset) % 1;
        r.mesh.scale.setScalar(0.62 + phase * 1.05);
        r.mat.opacity = (1 - phase) * 0.58;
      }
    }

    // Tame celebration heart/star burst animation
    if (tameBurstTimer > 0) {
      tameBurstTimer = Math.max(0, tameBurstTimer - dt);
      const progress = 1 - tameBurstTimer / 1.75;
      tameBurst.group.position.set(crock.pos.x, Math.max(0, crock.pos.y) + 0.85, crock.pos.z);
      for (const p of tameBurst.particles) {
        const radius = 0.25 + progress * 1.05 * p.speed;
        const a = p.angle + progress * 2.2;
        p.mesh.position.set(
          Math.cos(a) * radius,
          progress * p.rise,
          Math.sin(a) * radius
        );
        p.mesh.rotation.y = elapsed * 4 + p.angle;
        p.mat.opacity = clamp(1 - progress * 1.05, 0, 1);
      }
      if (tameBurstTimer <= 0) {
        tameBurst.group.visible = false;
      }
    }

    // Bite impact ring animation
    if (biteImpactTimer > 0) {
      biteImpactTimer = Math.max(0, biteImpactTimer - dt);
      const progress = 1 - biteImpactTimer / 0.32;
      biteImpact.mesh.scale.setScalar(0.55 + progress * 1.15);
      biteImpact.mat.opacity = (1 - progress) * 0.85;
      if (biteImpactTimer <= 0) {
        biteImpact.mesh.visible = false;
      }
    }

    // Floating 3D health bar when tamed & damaged or attacking
    const showHpBar = crock.tamed && (crock.hp < crock.maxHp - 0.5 || crock.mode === 'attack' || crockRecovering);
    crockHpBar.group.visible = showHpBar;
    if (showHpBar) {
      crockHpBar.group.position.set(crock.pos.x, crock.pos.y + 2.05, crock.pos.z);
      const cam = ctx.getActiveCamera?.();
      if (cam) {
        crockHpBar.group.quaternion.copy(cam.quaternion);
      }
      const pct = clamp(crock.hp / Math.max(1, crock.maxHp), 0, 1);
      crockHpBar.fill.scale.x = Math.max(0.001, pct);
      if (pct > 0.55) {
        crockHpBar.fillMat.color.setHex(0x51cf66);
      } else if (pct > 0.25) {
        crockHpBar.fillMat.color.setHex(0xfcc419);
      } else {
        crockHpBar.fillMat.color.setHex(0xff5252);
      }
    }

    prevCrockHp = crock.hp;
  }

  function followBootsAsCrockstar(dt, inWater, offsetDist) {
    const pPos = ctx.player.pos;
    const distToPlayer = distXZ(crock.pos, pPos);

    if (distToPlayer > 16) {
      const spot = findNearbyValidSpot(pPos.x, pPos.z, offsetDist, 0.44, true);
      crock.pos.x = spot.x;
      crock.pos.z = spot.z;
    }

    // Offset opposite side of Dos (right/behind Boots)
    const pRot = ctx.player.group?.rotation?.y || 0;
    const sideAngle = pRot + Math.PI * 0.72;
    const b = getBounds();
    let goalX = clamp(pPos.x + Math.sin(sideAngle) * offsetDist, b.minX, b.maxX);
    let goalZ = clamp(pPos.z + Math.cos(sideAngle) * offsetDist, b.minZ, b.maxZ);

    if (!isValidPos(goalX, goalZ, 0.44, true)) {
      const safe = findNearbyValidSpot(pPos.x, pPos.z, offsetDist, 0.44, true);
      goalX = safe.x;
      goalZ = safe.z;
    }

    const distToGoal = distXZ(crock.pos, { x: goalX, z: goalZ });
    if (distToGoal > 0.45) {
      const speed = distToPlayer > 5.0 ? 6.2 : inWater ? 4.8 : 4.5;
      moveEntityToward(crock.pos, crock.group, goalX, goalZ, speed, dt, 0.44, true);
      playCrockAnim(inWater ? 'Swim' : 'Walk');
    } else {
      if (crock.group) {
        const faceBoots = Math.atan2(pPos.x - crock.pos.x, pPos.z - crock.pos.z);
        crock.group.rotation.y = lerpAngle(crock.group.rotation.y, faceBoots, Math.min(1, dt * 6));
      }
      playCrockAnim(inWater ? 'Swim' : 'Idle');
    }
  }

  // -------------------------------------------------------------------------
  // Main Update & Status
  // -------------------------------------------------------------------------
  function update(dt) {
    const clampedDt = Math.min(Math.max(dt || 0, 0), 0.1);
    elapsed += clampedDt;

    updateDos(clampedDt);
    updateCrockstar(clampedDt);

    // Throttled HUD sync while decoy timers or Crockstar HP are actively ticking
    if (decoyCooldown > 0 || dos.decoyTimer > 0 || crock.hp < crock.maxHp) {
      hudSyncAccum += clampedDt;
      if (hudSyncAccum >= 0.35) {
        hudSyncAccum = 0;
        ctx.updateHud?.();
      }
    } else {
      hudSyncAccum = 0;
    }
  }

  function getStatus() {
    return {
      dosMode: dos.mode,
      detectionMultiplier: dos.detectionMultiplier,
      decoyCooldown: Math.max(0, Math.round(decoyCooldown * 10) / 10),
      decoyActive: Boolean((dos.decoyPos && dos.decoyTimer > 0) || decoyPhase === 'running'),
      crockstarTamed: Boolean(crock.tamed),
      crockstarMode: crock.mode,
      crockstarHp: Math.round(crock.hp),
      crockstarMaxHp: Math.round(crock.maxHp),
    };
  }

  // Initialize default idle animations
  playDosAnim(dos.mode === 'undercover' ? 'Hide_Assist_Aura' : 'Idle', 0.05);
  playCrockAnim(ctx.isWater?.(crock.pos.x, crock.pos.z) ? 'Swim' : 'Idle', 0.05);

  return {
    update,
    setDosMode,
    deployDecoyBeacon,
    commandCrockstar,
    tryTameCrockstar,
    getStatus,
  };
}
