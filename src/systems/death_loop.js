import * as THREE from 'three';

const RESPAWN_DELAY_SEC = 2.2;
const CRATE_LIFETIME_SEC = 45;
const CRATE_LOW_TIME_WARN_SEC = 15;
const CRATE_RECOVERY_RADIUS = 2.3;
const BEACON_BASE_Y = 1.65;

function createTwoStepToonGradient() {
  const data = new Uint8Array([115, 255]);
  const texture = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Shared immutable geometries and static cel-shaded materials reused across death crates.
 * Dynamic per-crate indicator materials (ring, beam, crystal) are created per crate and
 * disposed when the crate is removed from the scene.
 */
function createCrateAssetPalette() {
  const gradientMap = createTwoStepToonGradient();

  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x161210,
    side: THREE.BackSide,
  });

  const woodMat = new THREE.MeshToonMaterial({
    color: 0xa86b32,
    gradientMap,
  });

  const woodDarkMat = new THREE.MeshToonMaterial({
    color: 0x7b4a1e,
    gradientMap,
  });

  const brassMat = new THREE.MeshToonMaterial({
    color: 0xf2b705,
    gradientMap,
  });

  const emblemRedMat = new THREE.MeshToonMaterial({
    color: 0xe03131,
    gradientMap,
  });

  const haloGoldMat = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
  });

  return {
    gradientMap,
    materials: {
      outlineMat,
      woodMat,
      woodDarkMat,
      brassMat,
      emblemRedMat,
      haloGoldMat,
    },
    geometries: {
      body: new THREE.BoxGeometry(0.86, 0.64, 0.86),
      bodyOutline: new THREE.BoxGeometry(0.93, 0.71, 0.93),
      lid: new THREE.BoxGeometry(0.92, 0.12, 0.92),
      lidOutline: new THREE.BoxGeometry(0.98, 0.18, 0.98),
      cornerPost: new THREE.BoxGeometry(0.11, 0.68, 0.11),
      strapH: new THREE.BoxGeometry(0.9, 0.08, 0.9),
      clasp: new THREE.BoxGeometry(0.18, 0.2, 0.08),
      crossBarA: new THREE.BoxGeometry(0.36, 0.03, 0.11),
      crossBarB: new THREE.BoxGeometry(0.11, 0.03, 0.36),
      groundRing: new THREE.RingGeometry(0.62, 0.8, 28),
      beam: new THREE.CylinderGeometry(0.08, 0.25, 1.28, 12, 1, true),
      crystal: new THREE.OctahedronGeometry(0.24, 0),
      crystalOutline: new THREE.OctahedronGeometry(0.285, 0),
      halo: new THREE.TorusGeometry(0.34, 0.042, 8, 24),
    },
  };
}

function buildDeathCrateMesh(palette, x, z) {
  const { geometries: g, materials: m, gradientMap } = palette;

  const root = new THREE.Group();
  root.name = 'Death_Crate';
  root.position.set(x, 0, z);

  // Main stylized wood crate body + inverted-hull cartoon outline
  const body = new THREE.Mesh(g.body, m.woodMat);
  body.position.y = 0.33;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const bodyOutline = new THREE.Mesh(g.bodyOutline, m.outlineMat);
  bodyOutline.position.y = 0.33;
  root.add(bodyOutline);

  // Slightly overhanging lid + outline
  const lid = new THREE.Mesh(g.lid, m.woodDarkMat);
  lid.position.y = 0.68;
  lid.castShadow = true;
  lid.receiveShadow = true;
  root.add(lid);

  const lidOutline = new THREE.Mesh(g.lidOutline, m.outlineMat);
  lidOutline.position.y = 0.68;
  root.add(lidOutline);

  // Brass corner braces
  const cornerOffsets = [
    [-0.4, -0.4],
    [0.4, -0.4],
    [-0.4, 0.4],
    [0.4, 0.4],
  ];
  for (const [cx, cz] of cornerOffsets) {
    const post = new THREE.Mesh(g.cornerPost, m.brassMat);
    post.position.set(cx, 0.35, cz);
    post.castShadow = true;
    root.add(post);
  }

  // Brass mid-strap & front lock clasp
  const strap = new THREE.Mesh(g.strapH, m.brassMat);
  strap.position.y = 0.35;
  strap.castShadow = true;
  root.add(strap);

  const clasp = new THREE.Mesh(g.clasp, m.brassMat);
  clasp.position.set(0, 0.56, 0.45);
  clasp.castShadow = true;
  root.add(clasp);

  // Survival red cross emblem on top of the lid
  const crossA = new THREE.Mesh(g.crossBarA, m.emblemRedMat);
  crossA.position.y = 0.755;
  root.add(crossA);

  const crossB = new THREE.Mesh(g.crossBarB, m.emblemRedMat);
  crossB.position.y = 0.755;
  root.add(crossB);

  // Per-crate dynamic indicator materials (pulsed in update & disposed on removal)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc933,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff4d4f,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const crystalMat = new THREE.MeshToonMaterial({
    color: 0xff3b3b,
    emissive: 0x661111,
    gradientMap,
  });

  // Ground pulsing ring for crisp 45° isometric visibility
  const groundRing = new THREE.Mesh(g.groundRing, ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  root.add(groundRing);

  // Vertical translucent beacon beam rising from the crate
  const beam = new THREE.Mesh(g.beam, beamMat);
  beam.position.y = 1.05;
  root.add(beam);

  // Floating bobbing & spinning red/gold beacon marker above the crate
  const beacon = new THREE.Group();
  beacon.name = 'Death_Crate_Beacon';
  beacon.position.y = BEACON_BASE_Y;

  const crystal = new THREE.Mesh(g.crystal, crystalMat);
  crystal.scale.set(0.95, 1.35, 0.95);
  beacon.add(crystal);

  const crystalOutline = new THREE.Mesh(g.crystalOutline, m.outlineMat);
  crystalOutline.scale.set(0.95, 1.35, 0.95);
  beacon.add(crystalOutline);

  const halo = new THREE.Mesh(g.halo, m.haloGoldMat);
  halo.rotation.x = Math.PI * 0.42;
  beacon.add(halo);

  root.add(beacon);

  return {
    mesh: root,
    beacon,
    disposableMaterials: [ringMat, beamMat, crystalMat],
    ringMat,
    beamMat,
    crystalMat,
  };
}

function disposeCrateVisuals(ctx, crate) {
  if (crate.mesh) {
    if (crate.mesh.parent) {
      crate.mesh.parent.remove(crate.mesh);
    } else if (ctx.scene) {
      ctx.scene.remove(crate.mesh);
    }
  }

  if (Array.isArray(crate._disposableMaterials)) {
    for (const mat of crate._disposableMaterials) {
      mat?.dispose?.();
    }
    crate._disposableMaterials = [];
  }
}

export function createDeathLoopSystem(ctx) {
  if (!Array.isArray(ctx.deathCrates)) {
    ctx.deathCrates = [];
  }

  const palette = createCrateAssetPalette();
  let crateCounter = 0;
  let pendingRespawn = false;
  let respawnTimer = 0;

  function performRespawn() {
    const player = ctx.player;
    if (!player) return;

    const rp = player.respawnPoint;
    const rx = rp && Number.isFinite(rp.x) ? rp.x : 0;
    const rz = rp && Number.isFinite(rp.z) ? rp.z : 1;

    if (player.pos?.set) {
      player.pos.set(rx, 0, rz);
    }
    if (player.group?.position && player.group.position !== player.pos) {
      player.group.position.set(rx, 0, rz);
    }

    // Strict design rule: respawn with 50% Max HP and 75% stamina
    const maxHp = Number.isFinite(player.maxHp) ? player.maxHp : 100;
    const maxStamina = Number.isFinite(player.maxStamina) ? player.maxStamina : 100;
    player.hp = Math.round(maxHp * 0.5);
    player.stamina = Math.round(maxStamina * 0.75);
    player.isDead = false;
    player.isSneaking = false;

    // Prevent instant FBI spawn-camping at the campfire/bed
    if (ctx.fbi) {
      const currentAlert = Number.isFinite(ctx.fbi.globalAlert) ? ctx.fbi.globalAlert : 0;
      ctx.fbi.globalAlert = Math.min(currentAlert, 25);
      ctx.fbi.isPlayerDetected = false;
    }

    ctx.models?.tarcy?.play?.('Idle', 0.18);
    ctx.updateHud?.();
    ctx.toast?.(
      'Respawned at campfire/bed with 50% HP! Recover your Death Crate before FBI patrols confiscate it.',
      'warn'
    );
  }

  function triggerDeath() {
    const player = ctx.player;
    if (!player || player.isDead) {
      return false;
    }

    player.isDead = true;
    player.hp = 0;
    player.isSneaking = false;

    ctx.models?.tarcy?.play?.('Death', 0.1);

    // Drop 100% of Boots's carried inventory into the physical death crate
    const rawDropped =
      typeof player.clearInventory === 'function' ? player.clearInventory() : [];
    const droppedItems = Array.isArray(rawDropped)
      ? rawDropped.filter(Boolean).map((item) => ({ ...item }))
      : [];

    const deathX = Number.isFinite(player.pos?.x) ? player.pos.x : 0;
    const deathZ = Number.isFinite(player.pos?.z) ? player.pos.z : 0;

    const visuals = buildDeathCrateMesh(palette, deathX, deathZ);
    ctx.scene?.add(visuals.mesh);

    const crate = {
      id: `death_crate_${++crateCounter}`,
      mesh: visuals.mesh,
      beacon: visuals.beacon,
      pos: new THREE.Vector3(deathX, 0, deathZ),
      items: droppedItems,
      timer: CRATE_LIFETIME_SEC,
      maxTimer: CRATE_LIFETIME_SEC,
      confiscated: false,
      recovered: false,
      _elapsed: 0,
      _warnedLowTime: false,
      _disposableMaterials: visuals.disposableMaterials,
      _ringMat: visuals.ringMat,
      _beamMat: visuals.beamMat,
      _crystalMat: visuals.crystalMat,
    };

    ctx.deathCrates.push(crate);

    pendingRespawn = true;
    respawnTimer = RESPAWN_DELAY_SEC;

    ctx.updateHud?.();
    ctx.toast?.(
      'Boots was tranquilized! Dropped all gear at death crate. Respawning at 50% HP...',
      'danger'
    );

    return crate;
  }

  function getActiveCrates() {
    return ctx.deathCrates.filter((c) => c && !c.recovered && !c.confiscated);
  }

  function tryRecoverCrate() {
    const player = ctx.player;
    if (!player || player.isDead || !player.pos) {
      return false;
    }

    const activeCrates = getActiveCrates();
    if (activeCrates.length === 0) {
      return false;
    }

    let nearestCrate = null;
    let nearestDistSq = CRATE_RECOVERY_RADIUS * CRATE_RECOVERY_RADIUS;

    for (const crate of activeCrates) {
      const dx = crate.pos.x - player.pos.x;
      const dz = crate.pos.z - player.pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= nearestDistSq) {
        nearestDistSq = distSq;
        nearestCrate = crate;
      }
    }

    if (!nearestCrate) {
      return false;
    }

    const remainingItems = [];
    let recoveredCount = 0;

    for (const item of nearestCrate.items || []) {
      if (!item) continue;
      const added =
        typeof player.addItem === 'function' ? player.addItem({ ...item }) : true;
      if (added) {
        recoveredCount += 1;
      } else {
        remainingItems.push(item);
      }
    }

    if (remainingItems.length > 0) {
      nearestCrate.items = remainingItems;
      ctx.updateHud?.();
      if (recoveredCount > 0) {
        ctx.toast?.(
          'Inventory full! Recovered some gear — free a slot to claim the rest of your Death Crate.',
          'warn'
        );
      } else {
        ctx.toast?.(
          'Inventory full! Free a hotbar slot to recover your Death Crate.',
          'warn'
        );
      }
      return recoveredCount > 0;
    }

    nearestCrate.items = [];
    nearestCrate.recovered = true;
    disposeCrateVisuals(ctx, nearestCrate);
    ctx.updateHud?.();
    ctx.toast?.('Recovered all dropped gear from Death Crate!', 'success');

    return true;
  }

  function confiscateCrate(crateId) {
    const crate = ctx.deathCrates.find((c) => c && c.id === crateId);
    if (!crate || crate.confiscated || crate.recovered) {
      return false;
    }

    crate.confiscated = true;
    crate.timer = 0;
    disposeCrateVisuals(ctx, crate);
    ctx.updateHud?.();
    ctx.toast?.('FBI confiscated your Death Crate! Dropped items were lost.', 'danger');

    return true;
  }

  function setRespawnPoint(x, z) {
    if (!ctx.player || !Number.isFinite(x) || !Number.isFinite(z)) {
      return false;
    }

    if (ctx.player.respawnPoint?.set) {
      ctx.player.respawnPoint.set(x, 0, z);
    } else {
      ctx.player.respawnPoint = new THREE.Vector3(x, 0, z);
    }

    ctx.updateHud?.();
    ctx.toast?.('Respawn checkpoint set!', 'info');
    return true;
  }

  function update(dt) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);

    // Tick down death animation delay before half-HP respawn
    if (pendingRespawn) {
      respawnTimer -= safeDt;
      if (respawnTimer <= 0) {
        pendingRespawn = false;
        respawnTimer = 0;
        performRespawn();
      }
    }

    // Update active death crates: animate beacons, countdown timers, auto-confiscate on expiry
    for (const crate of ctx.deathCrates) {
      if (!crate || crate.recovered || crate.confiscated) continue;

      crate._elapsed = (crate._elapsed || 0) + safeDt;
      crate.timer = Math.max(0, crate.timer - safeDt);

      const isUrgent = crate.timer <= CRATE_LOW_TIME_WARN_SEC;

      // Animate floating red/gold beacon bob & spin
      if (crate.beacon) {
        const bobSpeed = isUrgent ? 6.0 : 3.2;
        const spinSpeed = isUrgent ? 3.2 : 1.7;
        crate.beacon.position.y = BEACON_BASE_Y + Math.sin(crate._elapsed * bobSpeed) * 0.18;
        crate.beacon.rotation.y += safeDt * spinSpeed;
      }

      // Pulse ground ring & beacon beam for visibility and low-time urgency
      const pulse = 0.5 + 0.5 * Math.sin(crate._elapsed * (isUrgent ? 9.0 : 3.6));
      if (crate._ringMat) {
        crate._ringMat.color.setHex(isUrgent ? 0xff3b3b : 0xffc933);
        crate._ringMat.opacity = 0.45 + pulse * 0.42;
      }
      if (crate._beamMat) {
        crate._beamMat.opacity = 0.18 + pulse * 0.2;
      }

      // Warning toast at 15s remaining
      if (isUrgent && !crate._warnedLowTime && crate.timer > 0) {
        crate._warnedLowTime = true;
        ctx.toast?.(
          'Hurry! 15s left before FBI patrols confiscate your Death Crate!',
          'warn'
        );
      }

      // Auto-confiscate when timer hits 0
      if (crate.timer <= 0) {
        confiscateCrate(crate.id);
      }
    }
  }

  return {
    update,
    triggerDeath,
    tryRecoverCrate,
    confiscateCrate,
    setRespawnPoint,
    getActiveCrates,
  };
}
