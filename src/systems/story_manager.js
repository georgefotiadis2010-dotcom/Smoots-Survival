// ============================================================================
// Project: Last Exotic — 4-Act Story Campaign & Quest Tracker HUD (EXOTIC-013)
// Owns: src/systems/story_manager.js
// ============================================================================

const LANDMARKS = Object.freeze({
  southBeach: { x: 0, z: 13 },
  dosSpawn: { x: -1.8, z: 13.5 },
  starterCampfire: { x: 0, z: 11 },
  sunkenLagoon: { x: 9.5, z: 11.5 },
  lagoonFishBank: { x: 11.5, z: 9.5 },
  westCamp: { x: -18, z: -4 },
  smuffCage: { x: -18, z: -4 },
  northHq: { x: 0, z: -18 },
  vanceArena: { x: 0, z: -20 },
  escapeHelipad: { x: 0, z: -25 },
  defaultJammers: [
    { x: -9, z: -15 },
    { x: 9, z: -15 },
    { x: 0, z: -13 },
  ],
});

const ACT_META = Object.freeze({
  1: {
    badge: 'ACT 1 / 4',
    title: 'Crash on Exotic Island',
    cutsceneId: 'act1_opening',
  },
  2: {
    badge: 'ACT 2 / 4',
    title: 'Beast of the Lagoon',
    cutsceneId: 'act2_lagoon',
  },
  3: {
    badge: 'ACT 3 / 4',
    title: 'Operation Blue Cap',
    cutsceneId: 'act3_smuff_radio',
  },
  4: {
    badge: 'ACT 4 / 4',
    title: 'Exfiltration Protocol',
    cutsceneId: 'act4_vance_hq',
  },
});

const DAY_DURATION_SEC = 90;
const HIGH_ALERT_THRESHOLD = 50;
const EVADED_ALERT_THRESHOLD = 15;
const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ============================================================================
// Helpers
// ============================================================================

function finiteOr(val, fallback) {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function getPosXZ(obj, fallback) {
  const x = finiteOr(obj?.x, fallback.x);
  const z = finiteOr(obj?.z, fallback.z);
  return { x, z };
}

function distXZ(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function getCompassDir(fromX, fromZ, toX, toZ) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  if (Math.hypot(dx, dz) < 0.5) return 'HERE';
  // North = -Z, East = +X, South = +Z, West = -X
  const bearing = Math.atan2(dx, -dz);
  const norm = (bearing + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round(norm / (Math.PI / 4)) % 8;
  return COMPASS_DIRS[idx];
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getZoneName(ctx, x, z) {
  try {
    const zVal = ctx?.world?.getZoneAt?.(x, z);
    if (typeof zVal === 'string' && zVal.trim()) return zVal.trim();
    if (zVal && typeof zVal === 'object' && typeof zVal.name === 'string' && zVal.name.trim()) {
      return zVal.name.trim();
    }
  } catch {
    // Fallback to coordinate inference
  }
  if (z < -11 && x >= -15 && x <= 15) return 'North Beach FBI HQ';
  if (x <= -9.5 && z >= -12.5 && z <= 6.5) return 'West FBI Forward Camp';
  if ((x > 5.5 && z > -2.5 && z < 14.5) || z > 18.5) return 'Sunken Lagoon';
  return 'South Beach & Jungle';
}

function countItemSafe(ctx, id) {
  if (typeof ctx?.player?.countItem === 'function') {
    const n = ctx.player.countItem(id);
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  const inv = ctx?.player?.inventory;
  if (!Array.isArray(inv)) return 0;
  let total = 0;
  for (const slot of inv) {
    if (slot && slot.id === id) {
      total += finiteOr(slot.count, 1);
    }
  }
  return total;
}

function isCampfireOrBed(b) {
  if (!b) return false;
  const t = String(b.type || b.id || '').toLowerCase();
  return t === 'campfire' || t === 'bed' || t === 'leaf_bed';
}

function isJammerDestroyed(j) {
  if (!j) return false;
  if (j.destroyed === true || j.depleted === true) return true;
  if (typeof j.hp === 'number' && j.hp <= 0) return true;
  return false;
}

function findNearestHarvestable(ctx, px, pz, matcher) {
  const list = ctx?.harvestables;
  if (!Array.isArray(list)) return null;
  let best = null;
  let bestDist = Infinity;
  for (const h of list) {
    if (!h || h.depleted) continue;
    if (!matcher(h)) continue;
    const hx = finiteOr(h.x ?? h.pos?.x, NaN);
    const hz = finiteOr(h.z ?? h.pos?.z, NaN);
    if (!Number.isFinite(hx) || !Number.isFinite(hz)) continue;
    const d = distXZ(px, pz, hx, hz);
    if (d < bestDist) {
      bestDist = d;
      best = { x: hx, z: hz };
    }
  }
  return best;
}

function findNearestCheckpoint(ctx, px, pz) {
  const list = ctx?.buildings;
  if (!Array.isArray(list) || list.length === 0) return LANDMARKS.starterCampfire;
  let best = null;
  let bestDist = Infinity;
  for (const b of list) {
    if (!isCampfireOrBed(b)) continue;
    const bx = finiteOr(b.x ?? b.pos?.x ?? b.mesh?.position?.x, NaN);
    const bz = finiteOr(b.z ?? b.pos?.z ?? b.mesh?.position?.z, NaN);
    if (!Number.isFinite(bx) || !Number.isFinite(bz)) continue;
    const d = distXZ(px, pz, bx, bz);
    if (d < bestDist) {
      bestDist = d;
      best = { x: bx, z: bz };
    }
  }
  return best || LANDMARKS.starterCampfire;
}

// ============================================================================
// Scripted Cutscene Builders (4 Acts)
// ============================================================================

function buildCutsceneDef(cutsceneId, ctx) {
  const rawBoots = getPosXZ(ctx?.player?.pos, LANDMARKS.southBeach);
  const rawDos = getPosXZ(ctx?.companions?.dos?.pos, LANDMARKS.dosSpawn);
  const rawCrock = getPosXZ(ctx?.companions?.crockstar?.pos, LANDMARKS.sunkenLagoon);
  const rawSmuff = getPosXZ(ctx?.fbi?.smuff?.pos, LANDMARKS.smuffCage);

  if (cutsceneId === 'act1_opening') {
    const nearSouth = distXZ(rawBoots.x, rawBoots.z, 0, 13) <= 9;
    const bx = nearSouth ? rawBoots.x : LANDMARKS.southBeach.x;
    const bz = nearSouth ? rawBoots.z : LANDMARKS.southBeach.z;
    const dx = nearSouth ? rawDos.x : LANDMARKS.dosSpawn.x;
    const dz = nearSouth ? rawDos.z : LANDMARKS.dosSpawn.z;

    return {
      id: 'act1_opening',
      title: 'ACT 1 — CRASH ON EXOTIC ISLAND',
      shots: [
        {
          speaker: 'Narrator',
          portrait: 'narrator',
          text: "Exotic Island — an untamed paradise of ancient mossy ruins and hidden lagoons, home to Tarcy (Boots), the last exotic monkey of his kind. Tonight, the FBI's choppers sweep the canopy looking for him.",
          camPos: [14, 13, 25],
          camTarget: [0, 1.0, 11.5],
          duration: 5.0,
          sfx: 'alert',
        },
        {
          speaker: 'FBI Strike Squad',
          portrait: 'fbi',
          text: "Chopper-One to Island Landing Team: thermal lock on South Beach! Fan out through the ruins, set floodlights, and capture Target 'Boots' alive!",
          camPos: [-11.5, 9.2, 20.5],
          camTarget: [0, 0.9, 13.0],
          duration: 4.6,
          anims: [{ modelKey: 'fbi', clip: 'Flashlight_Sweep' }],
          sfx: 'radio',
        },
        {
          speaker: 'Tarcy (Boots)',
          portrait: 'tarcy',
          text: '*Chirp-chirp!* Boots scrambles onto the warm sand in his glossy red rubber boots as searchlights slice across the jungle palms!',
          camPos: [bx + 4.1, 3.1, bz + 4.4],
          camTarget: [bx, 0.9, bz],
          duration: 4.2,
          anims: [{ modelKey: 'tarcy', clip: 'Run' }],
          sfx: 'chirp',
        },
        {
          speaker: 'Dos (Double Agent)',
          portrait: 'dos',
          text: "Psst — get down, Boots! I'm Dos, deep undercover inside the Bureau. I slipped away from their landing squad in this black FBI cap to keep you safe!",
          camPos: [dx - 3.8, 2.9, dz + 3.9],
          camTarget: [(bx + dx) * 0.5, 0.9, (bz + dz) * 0.5],
          duration: 4.8,
          anims: [
            { modelKey: 'tarcy', clip: 'Sneak_Crouch' },
            { modelKey: 'dos', clip: 'Alert_Signal' },
          ],
          sfx: 'radio',
        },
        {
          speaker: 'Dos (Double Agent)',
          portrait: 'dos',
          text: 'Crouch with [C] or toggle my Undercover aura [Q] to shrink FBI vision cones. Activate or build a Campfire/Bed checkpoint so your gear is safe, then move east toward the Sunken Lagoon!',
          camPos: [bx + 3.6, 3.4, bz + 3.2],
          camTarget: [0, 0.8, 11.4],
          duration: 5.2,
          anims: [
            { modelKey: 'dos', clip: 'Hide_Assist_Aura' },
            { modelKey: 'tarcy', clip: 'Sneak_Crouch' },
          ],
          sfx: 'chirp',
        },
      ],
    };
  }

  if (cutsceneId === 'act2_lagoon') {
    const cx = ctx?.companions?.crockstar?.tamed ? rawCrock.x : LANDMARKS.sunkenLagoon.x;
    const cz = ctx?.companions?.crockstar?.tamed ? rawCrock.z : LANDMARKS.sunkenLagoon.z;

    return {
      id: 'act2_lagoon',
      title: 'ACT 2 — BEAST OF THE LAGOON',
      shots: [
        {
          speaker: 'Crockstar',
          portrait: 'crockstar',
          text: 'GRRROOOAAARRR!! *Crockstar rears out of the turquoise Sunken Lagoon, snapping his jagged jaws and sending an FBI recon patrol scrambling back into the trees!*',
          camPos: [cx + 4.1, 3.3, cz + 4.2],
          camTarget: [cx, 1.0, cz],
          duration: 4.6,
          anims: [{ modelKey: 'crockstar', clip: 'Bite_Attack' }],
          sfx: 'roar',
        },
        {
          speaker: 'FBI Recon Patrol',
          portrait: 'fbi',
          text: 'HQ, Sector East is compromised! A giant bipedal crocodile just chomped our scout drone in half — pulling all patrol squads out of the lagoon!',
          camPos: [cx + 5.2, 5.4, cz - 3.4],
          camTarget: [cx, 1.0, cz],
          duration: 4.4,
          anims: [
            { modelKey: 'fbi', clip: 'Alert_Spot' },
            { modelKey: 'crockstar', clip: 'Bite_Attack' },
          ],
          sfx: 'alert',
        },
        {
          speaker: 'Dos (Double Agent)',
          portrait: 'dos',
          text: "Whoa — that's Crockstar! Even the FBI won't go near him. Good news: he's a total softie for fresh island Fish or Meat. Grab some from the lagoon banks, walk up, and press [F] to tame him!",
          camPos: [cx - 3.8, 3.2, cz + 3.8],
          camTarget: [cx, 0.9, cz],
          duration: 5.0,
          anims: [
            { modelKey: 'dos', clip: 'Hide_Assist_Aura' },
            { modelKey: 'crockstar', clip: 'Idle' },
          ],
          sfx: 'radio',
        },
        {
          speaker: 'Tarcy (Boots)',
          portrait: 'tarcy',
          text: '*Ooh-ooh!* With Crockstar on our team, we can cross deep water channels and smash right through FBI patrols!',
          camPos: [cx - 2.6, 2.8, cz + 4.5],
          camTarget: [cx, 0.9, cz],
          duration: 3.8,
          anims: [
            { modelKey: 'tarcy', clip: 'Idle' },
            { modelKey: 'crockstar', clip: 'Friendly_Sit' },
          ],
          sfx: 'chirp',
        },
      ],
    };
  }

  if (cutsceneId === 'act3_smuff_radio') {
    const sx = ctx?.fbi?.smuff?.rescued ? LANDMARKS.smuffCage.x : rawSmuff.x;
    const sz = ctx?.fbi?.smuff?.rescued ? LANDMARKS.smuffCage.z : rawSmuff.z;

    return {
      id: 'act3_smuff_radio',
      title: 'ACT 3 — OPERATION BLUE CAP',
      shots: [
        {
          speaker: 'Dos (Double Agent)',
          portrait: 'dos',
          text: "*KSSHHK!* Hold on, Boots! I just intercepted an encrypted FBI radio broadcast from the West Forward Camp — they've locked up an island inventor!",
          camPos: [rawDos.x + 3.4, 2.9, rawDos.z + 3.6],
          camTarget: [rawDos.x, 0.9, rawDos.z],
          duration: 4.6,
          anims: [{ modelKey: 'dos', clip: 'Alert_Signal' }],
          sfx: 'radio',
        },
        {
          speaker: 'Smuff',
          portrait: 'smuff',
          text: "Hey! Unlock this cage, you suited bureaucrats! Building coconut turrets and EMP gadgets isn't a federal crime on Exotic Island! Somebody get me out!",
          camPos: [sx + 4.6, 3.6, sz + 4.8],
          camTarget: [sx, 1.0, sz],
          duration: 4.8,
          anims: [{ modelKey: 'smuff', clip: 'Captured_Idle' }],
          sfx: 'alert',
        },
        {
          speaker: 'FBI Camp Guard',
          portrait: 'fbi',
          text: 'Blue-cap tinkerer is secure inside Holding Cage West. Keep those floodlights sweeping — Director Vance wants zero escapes before extraction!',
          camPos: [sx - 4.4, 5.4, sz + 6.2],
          camTarget: [sx, 0.9, sz],
          duration: 4.4,
          anims: [
            { modelKey: 'fbi', clip: 'Flashlight_Sweep' },
            { modelKey: 'smuff', clip: 'Captured_Idle' },
          ],
          sfx: 'radio',
        },
        {
          speaker: 'Dos (Double Agent)',
          portrait: 'dos',
          text: "That's Smuff! Infiltrate the West FBI Forward Camp undetected with my Undercover aura or Decoy Beacon ([Q]), then press [F] at his cage. He grants +35% craft speed and unlocks Tier 3 Smuff Tech!",
          camPos: [rawBoots.x - 3.6, 3.3, rawBoots.z + 4.0],
          camTarget: [rawBoots.x, 0.9, rawBoots.z],
          duration: 5.2,
          anims: [
            { modelKey: 'dos', clip: 'Hide_Assist_Aura' },
            { modelKey: 'tarcy', clip: 'Sneak_Crouch' },
          ],
          sfx: 'chirp',
        },
      ],
    };
  }

  // Default: Act 4 — Exfiltration Protocol
  return {
    id: 'act4_vance_hq',
    title: 'ACT 4 — EXFILTRATION PROTOCOL',
    shots: [
      {
        speaker: 'Smuff',
        portrait: 'smuff',
        text: "Free at last! Thanks, Boots! I've boosted our build speed by +35% and unlocked Tier 3 Smuff Tech — EMP Grenades, Coconut Turrets, and Healing Banana Smoothies! Now let's steal their escape chopper!",
        camPos: [rawBoots.x + 3.4, 3.0, rawBoots.z + 3.8],
        camTarget: [rawBoots.x, 0.9, rawBoots.z],
        duration: 5.0,
        anims: [{ modelKey: 'smuff', clip: 'Ability_Cast' }],
        sfx: 'craft',
      },
      {
        speaker: 'FBI Director Vance',
        portrait: 'vance',
        text: 'Enough insolence! I am FBI Director Vance! Power up all three Signal Jammers, energize my exo-mech shield, and seal the North Beach Helipad — nobody leaves Exotic Island!',
        camPos: [6.8, 5.0, -11.8],
        camTarget: [0, 1.4, -20],
        duration: 5.0,
        anims: [{ modelKey: 'vance', clip: 'Laser_Sweep' }],
        sfx: 'alert',
      },
      {
        speaker: 'Narrator',
        portrait: 'narrator',
        text: "Three pulsing Signal Jammers guard the fortified North Beach Extraction HQ, projecting a golden shield around Director Vance's armored exo-mech while the FBI Escape Chopper waits on the northern helipad.",
        camPos: [-11.5, 9.2, -9.2],
        camTarget: [0, 1.1, -18.5],
        duration: 4.8,
        anims: [{ modelKey: 'vance', clip: 'Idle' }],
        sfx: 'radio',
      },
      {
        speaker: 'Dos (Double Agent)',
        portrait: 'dos',
        text: "Here's our final play, Boots: smash all 3 Signal Jammers in North HQ so I can hack Vance's shield offline, defeat Director Vance, and hijack the FBI Escape Chopper ([F]) on the helipad!",
        camPos: [0.6, 6.0, -16.5],
        camTarget: [0, 1.3, -24.5],
        duration: 5.2,
        anims: [
          { modelKey: 'dos', clip: 'Alert_Signal' },
          { modelKey: 'tarcy', clip: 'Idle' },
        ],
        sfx: 'chirp',
      },
    ],
  };
}

// ============================================================================
// Self-Contained Cel-Shaded Quest Tracker HUD (#quest-tracker)
// ============================================================================

const QUEST_TRACKER_CSS = `
#quest-tracker {
  position: fixed;
  top: 156px;
  left: 18px;
  z-index: 22;
  width: 262px;
  max-width: calc(100vw - 36px);
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  font-family: "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif;
  color: #fffdf4;
  transition: opacity 220ms ease, transform 220ms ease;
}

#quest-tracker.qt-hidden {
  opacity: 0;
  transform: translateX(-12px);
}

#quest-tracker * {
  box-sizing: border-box;
  pointer-events: none;
}

.qt-card {
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(24, 31, 38, 0.92) 0%, rgba(15, 20, 25, 0.94) 100%);
  border: 2.5px solid #14181c;
  box-shadow:
    0 0 0 2px rgba(236, 200, 92, 0.72),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 8px 20px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.qt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px 6px;
  background: linear-gradient(180deg, #2e3944 0%, #1d242c 100%);
  border-bottom: 2px solid #14181c;
}

.qt-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffd92b 0%, #d99b18 100%);
  border: 1.5px solid #14181c;
  color: #161a1e;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
  white-space: nowrap;
}

.qt-badge--endless {
  background: linear-gradient(180deg, #5ef2a8 0%, #1eb872 100%);
  color: #0d2217;
}

.qt-collapse-btn {
  pointer-events: auto !important;
  cursor: pointer;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 6px;
  border: 1.5px solid #14181c;
  background: #2b3540;
  color: #e4edf5;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: filter 100ms ease, transform 90ms ease, border-color 110ms ease;
}

.qt-collapse-btn:hover {
  filter: brightness(1.18);
  border-color: #ffd92b;
}

.qt-collapse-btn:active {
  transform: scale(0.92);
}

.qt-body {
  padding: 8px 10px 9px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

#quest-tracker.qt-collapsed .qt-body {
  display: none;
}

.qt-title {
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: 0.03em;
  color: #ffe380;
  text-shadow: 0 1.5px 0 #12161a;
}

.qt-objectives {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.qt-obj {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.28;
  color: #edf3f8;
}

.qt-obj--done {
  color: #7ee8a9;
}

.qt-obj--done .qt-obj-text {
  text-decoration: line-through;
  opacity: 0.85;
}

.qt-check {
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1.1;
  color: #ffd92b;
  text-shadow: 0 1px 0 #12161a;
}

.qt-obj--done .qt-check {
  color: #4ade80;
}

.qt-waypoint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 7px;
  background: rgba(12, 17, 22, 0.72);
  border: 1.5px solid #2a3642;
  font-size: 10.5px;
  font-weight: 800;
  color: #bae6fd;
}

.qt-waypoint-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qt-waypoint-dist {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(255, 217, 43, 0.16);
  border: 1px solid rgba(255, 217, 43, 0.48);
  color: #ffe380;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.03em;
}

.qt-zone-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #9eb0c2;
  letter-spacing: 0.03em;
}

.qt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 5px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.qt-stats {
  font-size: 10px;
  font-weight: 800;
  color: #b7c6d4;
  white-space: nowrap;
}

.qt-replay-btn {
  pointer-events: auto !important;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1.5px solid #14181c;
  background: linear-gradient(180deg, #3c4a58 0%, #26313c 100%);
  color: #ffe380;
  font-family: inherit;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.02em;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  white-space: nowrap;
  transition: filter 100ms ease, transform 90ms ease, border-color 110ms ease;
}

.qt-replay-btn:hover {
  filter: brightness(1.16);
  border-color: #ffd92b;
}

.qt-replay-btn:active {
  transform: scale(0.95);
}

@media (max-width: 820px) {
  #quest-tracker {
    top: 124px;
    left: 12px;
    width: 218px;
  }

  .qt-title {
    font-size: 12px;
  }

  .qt-obj {
    font-size: 10.5px;
  }
}
`;

function mountQuestTrackerHud(onReplay) {
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  if (!document.getElementById('quest-tracker-styles') && document.head) {
    const styleEl = document.createElement('style');
    styleEl.id = 'quest-tracker-styles';
    styleEl.textContent = QUEST_TRACKER_CSS;
    document.head.appendChild(styleEl);
  }

  const existing = document.getElementById('quest-tracker');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const root = document.createElement('aside');
  root.id = 'quest-tracker';
  root.setAttribute('aria-label', 'Story Quest Tracker');
  root.innerHTML = `
    <div class="qt-card">
      <div class="qt-header">
        <span id="qt-act-badge" class="qt-badge">ACT 1 / 4</span>
        <button type="button" id="qt-collapse-btn" class="qt-collapse-btn" title="Collapse/Expand Quest Tracker" aria-expanded="true">▾</button>
      </div>
      <div class="qt-body">
        <div id="qt-act-title" class="qt-title">Crash on Exotic Island</div>
        <ul id="qt-objectives" class="qt-objectives"></ul>
        <div id="qt-waypoint" class="qt-waypoint">
          <span id="qt-waypoint-label" class="qt-waypoint-label">🧭 Campfire Checkpoint</span>
          <span id="qt-waypoint-dist" class="qt-waypoint-dist">--</span>
        </div>
        <div class="qt-zone-row">
          <span id="qt-zone-name">📍 South Beach &amp; Jungle</span>
        </div>
        <div class="qt-footer">
          <span id="qt-stats" class="qt-stats">Day 1 · Evaded 0</span>
          <button type="button" id="qt-replay-btn" class="qt-replay-btn" title="Replay current Act cutscene">🎬 Replay Cutscene</button>
        </div>
      </div>
    </div>
  `;

  const mountTarget = document.getElementById('hud-mount') || document.body;
  mountTarget.appendChild(root);

  const badgeEl = root.querySelector('#qt-act-badge');
  const titleEl = root.querySelector('#qt-act-title');
  const objListEl = root.querySelector('#qt-objectives');
  const wpWrapEl = root.querySelector('#qt-waypoint');
  const wpLabelEl = root.querySelector('#qt-waypoint-label');
  const wpDistEl = root.querySelector('#qt-waypoint-dist');
  const zoneEl = root.querySelector('#qt-zone-name');
  const statsEl = root.querySelector('#qt-stats');
  const replayBtn = root.querySelector('#qt-replay-btn');
  const collapseBtn = root.querySelector('#qt-collapse-btn');

  let collapsed = false;
  collapseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    root.classList.toggle('qt-collapsed', collapsed);
    collapseBtn.textContent = collapsed ? '▸' : '▾';
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  });

  replayBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    onReplay?.();
  });

  let lastKey = '';

  return {
    root,
    render(view) {
      const hidden = Boolean(view.cutsceneActive);
      root.classList.toggle('qt-hidden', hidden);

      const renderKey = JSON.stringify([
        view.actBadge,
        view.actTitle,
        view.endlessMode,
        view.objectives,
        view.waypointLabel,
        view.waypointDistText,
        view.zoneName,
        view.statsText,
      ]);

      if (renderKey === lastKey) return;
      lastKey = renderKey;

      if (badgeEl) {
        badgeEl.textContent = view.actBadge;
        badgeEl.classList.toggle('qt-badge--endless', Boolean(view.endlessMode));
      }
      if (titleEl) {
        titleEl.textContent = view.actTitle;
      }
      if (objListEl) {
        objListEl.innerHTML = view.objectives
          .map((obj) => {
            const box = obj.done ? '☑' : '☐';
            const cls = obj.done ? 'qt-obj qt-obj--done' : 'qt-obj';
            return `<li class="${cls}"><span class="qt-check">${box}</span><span class="qt-obj-text">${escapeHtml(obj.text)}</span></li>`;
          })
          .join('');
      }
      if (wpWrapEl) {
        if (view.waypointLabel) {
          wpWrapEl.style.display = 'flex';
          if (wpLabelEl) wpLabelEl.textContent = `🧭 ${view.waypointLabel}`;
          if (wpDistEl) wpDistEl.textContent = view.waypointDistText || '--';
        } else {
          wpWrapEl.style.display = 'none';
        }
      }
      if (zoneEl) {
        zoneEl.textContent = `📍 ${view.zoneName}`;
      }
      if (statsEl) {
        statsEl.textContent = view.statsText;
      }
    },
  };
}

// ============================================================================
// Story Manager Factory
// ============================================================================

export function createStoryManager(ctx) {
  if (!ctx.story || typeof ctx.story !== 'object') {
    ctx.story = {
      act: 1,
      waypoint: null,
      daysSurvived: 1,
      fbiEvaded: 0,
      deaths: 0,
    };
  }

  // Core story state
  let act = finiteOr(ctx.story.act, 1);
  if (act < 1 || act > 4) act = 1;
  let campaignStarted = false;
  let campaignComplete = false;
  let endlessMode = false;

  // Objective flags
  const flags = {
    act1Stealth: false,
    act1Checkpoint: false,
    act1Lagoon: false,
    act2BaitEverHeld: false,
    act2Tamed: false,
    act3Infiltrated: false,
    act3Rescued: false,
    act4Jammers: false,
    act4ShieldHacked: false,
    act4VanceDefeated: false,
    act4Escaped: false,
  };

  let eventJammersDestroyed = 0;
  let jammersDestroyed = 0;
  let totalJammers = 3;
  let westCampStealthHintShown = false;

  // Campaign stats tracking
  let activePlaySeconds = 0;
  let bonusDays = 0;
  let daysSurvived = Math.max(1, finiteOr(ctx.story.daysSurvived, 1));
  let fbiEvaded = Math.max(0, finiteOr(ctx.story.fbiEvaded, 0));
  let wasHighAlert = false;

  let deaths = Math.max(0, finiteOr(ctx.story.deaths, 0));
  let eventDeaths = deaths;
  let crateDeaths = 0;
  let deadEdgeDeaths = 0;
  let wasPlayerDead = Boolean(ctx?.player?.isDead);
  const seenCrates = new Set();

  // Initial checkpoint snapshot so starter campfire doesn't auto-check Act 1b on frame 0
  const initialCampfireBeds = new Set();
  if (Array.isArray(ctx?.buildings)) {
    for (const b of ctx.buildings) {
      if (isCampfireOrBed(b)) initialCampfireBeds.add(b);
    }
  }
  const initialCampfireBedCount = initialCampfireBeds.size;
  const initialRespawn = ctx?.player?.respawnPoint
    ? {
        x: finiteOr(ctx.player.respawnPoint.x, LANDMARKS.starterCampfire.x),
        z: finiteOr(ctx.player.respawnPoint.z, LANDMARKS.starterCampfire.z),
      }
    : null;

  // Non-destructively observe ctx.systems.death.setRespawnPoint so pressing F on starter campfire counts
  let respawnHooked = false;
  function ensureRespawnHook() {
    if (respawnHooked) return;
    const deathSys = ctx?.systems?.death;
    if (!deathSys || typeof deathSys.setRespawnPoint !== 'function') return;
    if (deathSys.setRespawnPoint._storyWrapped) {
      respawnHooked = true;
      return;
    }
    const origSetRespawn = deathSys.setRespawnPoint;
    const wrapped = function wrappedSetRespawnPoint(x, z) {
      const result = origSetRespawn.apply(this, arguments);
      if (result !== false) {
        flags.act1Checkpoint = true;
      }
      return result;
    };
    wrapped._storyWrapped = true;
    deathSys.setRespawnPoint = wrapped;
    respawnHooked = true;
  }

  // Cutscene queue & tracking
  const playedCutscenes = new Set();
  let pendingCutsceneId = null;
  let cutsceneDelayTimer = 0;
  let lastPlayedCutsceneId = 'act1_opening';

  function triggerCutscene(cutsceneId, { force = false } = {}) {
    if (!cutsceneId) return Promise.resolve(false);
    if (!force && playedCutscenes.has(cutsceneId)) {
      return Promise.resolve(false);
    }

    const cutsceneSys = ctx?.systems?.cutscenes;
    if (!cutsceneSys || typeof cutsceneSys.playCutscene !== 'function') {
      playedCutscenes.add(cutsceneId);
      lastPlayedCutsceneId = cutsceneId;
      return Promise.resolve(false);
    }

    if (cutsceneSys.isActive?.() || ctx.cutsceneActive) {
      if (!force) {
        pendingCutsceneId = cutsceneId;
        cutsceneDelayTimer = 0.2;
      }
      return Promise.resolve(false);
    }

    playedCutscenes.add(cutsceneId);
    lastPlayedCutsceneId = cutsceneId;
    const def = buildCutsceneDef(cutsceneId, ctx);
    try {
      const result = cutsceneSys.playCutscene(def);
      return Promise.resolve(result).catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  // Live Jammer & Boss inspection
  function computeJammerCounts() {
    const list = Array.isArray(ctx?.jammers) ? ctx.jammers : [];
    const total = list.length > 0 ? list.length : 3;
    let liveDestroyed = 0;
    for (const j of list) {
      if (isJammerDestroyed(j)) liveDestroyed += 1;
    }
    const count = Math.min(total, Math.max(liveDestroyed, eventJammersDestroyed, flags.act4VanceDefeated ? total : 0));
    return { destroyed: count, total };
  }

  function checkBossState() {
    const bossSys = ctx?.systems?.boss;
    const bossState = typeof bossSys?.getBossState === 'function' ? bossSys.getBossState() : null;

    if (bossState) {
      if (bossState.shieldActive === false && jammersDestroyed >= totalJammers) {
        flags.act4ShieldHacked = true;
      }
      if (
        bossState.defeated === true ||
        bossState.isDefeated === true ||
        bossState.state === 'defeated' ||
        (typeof bossState.hp === 'number' && bossState.hp <= 0)
      ) {
        flags.act4VanceDefeated = true;
      }
    }

    if (typeof bossSys?.isVictoryShown === 'function' && bossSys.isVictoryShown()) {
      flags.act4VanceDefeated = true;
      flags.act4Escaped = true;
      campaignComplete = true;
    }

    const agents = ctx?.fbi?.agents;
    if (Array.isArray(agents)) {
      const vance = agents.find((a) => a && (a.id === 'director_vance' || a.isBoss));
      if (vance) {
        if (vance.state === 'defeated' || (typeof vance.hp === 'number' && vance.hp <= 0)) {
          flags.act4VanceDefeated = true;
        }
      }
    }
  }

  function hasFishOrMeatNow() {
    return countItemSafe(ctx, 'fish') > 0 || countItemSafe(ctx, 'meat') > 0;
  }

  // Evaluate live ctx state & handle smooth in-order / out-of-order progression
  function evaluateProgress(allowCutsceneQueue = true) {
    ensureRespawnHook();

    const p = getPosXZ(ctx?.player?.pos, LANDMARKS.southBeach);
    const zoneName = getZoneName(ctx, p.x, p.z);
    const zoneLower = zoneName.toLowerCase();

    // --- Act 1 live checks ---
    const dos = ctx?.companions?.dos;
    if (
      ctx?.player?.isSneaking === true ||
      ctx?.player?.camoActive === true ||
      dos?.mode === 'undercover' ||
      (typeof dos?.detectionMultiplier === 'number' && dos.detectionMultiplier < 0.85)
    ) {
      flags.act1Stealth = true;
    }

    if (!flags.act1Checkpoint) {
      if (Array.isArray(ctx?.buildings)) {
        let countNow = 0;
        for (const b of ctx.buildings) {
          if (isCampfireOrBed(b)) {
            countNow += 1;
            if (!initialCampfireBeds.has(b)) {
              flags.act1Checkpoint = true;
              break;
            }
          }
        }
        if (countNow > initialCampfireBedCount) {
          flags.act1Checkpoint = true;
        }
      }
      if (!flags.act1Checkpoint && initialRespawn && ctx?.player?.respawnPoint) {
        const rx = finiteOr(ctx.player.respawnPoint.x, initialRespawn.x);
        const rz = finiteOr(ctx.player.respawnPoint.z, initialRespawn.z);
        if (distXZ(rx, rz, initialRespawn.x, initialRespawn.z) > 0.05) {
          flags.act1Checkpoint = true;
        }
      }
    }

    const inLagoonCoords = p.x > 5 && p.z < 14;
    const inLagoonZone = zoneLower.includes('lagoon') || zoneLower.includes('swamp');
    if (inLagoonCoords || inLagoonZone) {
      flags.act1Lagoon = true;
    }

    // --- Act 2 live checks ---
    const holdingBait = hasFishOrMeatNow();
    if (holdingBait) {
      flags.act2BaitEverHeld = true;
    }
    if (ctx?.companions?.crockstar?.tamed === true) {
      flags.act2Tamed = true;
      flags.act2BaitEverHeld = true;
      flags.act1Lagoon = true;
    }

    // --- Act 3 live checks ---
    const smuffPos = getPosXZ(ctx?.fbi?.smuff?.pos, LANDMARKS.smuffCage);
    const inWestCampCoords = p.x <= -9.5 && p.z >= -12.5 && p.z <= 6.5;
    const inWestCampZone =
      zoneLower.includes('west') || zoneLower.includes('forward camp') || zoneLower.includes('outpost');
    const inWestCamp = inWestCampCoords || inWestCampZone;
    const globalAlert = finiteOr(ctx?.fbi?.globalAlert, 0);
    const isDetected = Boolean(ctx?.fbi?.isPlayerDetected);

    if (inWestCamp) {
      if (!isDetected && globalAlert < 60) {
        flags.act3Infiltrated = true;
      } else if (distXZ(p.x, p.z, smuffPos.x, smuffPos.z) <= 5.2) {
        flags.act3Infiltrated = true;
      } else if (act === 3 && !westCampStealthHintShown) {
        westCampStealthHintShown = true;
        ctx.toast?.('Tip: Use Dos Undercover (Q) or Sneak (C) to slip past the West Camp guards!', 'warn');
      }
    }

    if (ctx?.fbi?.smuff?.rescued === true) {
      flags.act3Rescued = true;
      flags.act3Infiltrated = true;
    }

    // --- Act 4 live checks ---
    const jc = computeJammerCounts();
    jammersDestroyed = jc.destroyed;
    totalJammers = jc.total;
    if (jammersDestroyed >= totalJammers) {
      flags.act4Jammers = true;
      flags.act4ShieldHacked = true;
    }

    checkBossState();

    if (flags.act4VanceDefeated) {
      flags.act4Jammers = true;
      flags.act4ShieldHacked = true;
    }
    if (flags.act4Escaped || endlessMode) {
      campaignComplete = true;
    }

    // --- Act Progression (monotonic forward, supports out-of-order play!) ---
    let nextAct = act;

    if (act === 1) {
      const act1AllDone = flags.act1Stealth && flags.act1Checkpoint && flags.act1Lagoon;
      if (act1AllDone || flags.act1Lagoon || flags.act2Tamed) {
        nextAct = 2;
      }
    }

    if (nextAct === 2 && flags.act2Tamed) {
      nextAct = 3;
    }

    if (nextAct < 4 && (flags.act3Rescued || flags.act4VanceDefeated || jammersDestroyed >= totalJammers)) {
      nextAct = 4;
    }

    if (nextAct > act) {
      const prevAct = act;
      act = nextAct;
      const meta = ACT_META[act];
      if (meta) {
        ctx.toast?.(`${meta.badge}: ${meta.title}`, 'success');
        if (allowCutsceneQueue && prevAct !== act) {
          triggerCutscene(meta.cutsceneId);
        }
      }
    }

    // Sync active waypoint & ctx.story
    const waypoint = computeActiveWaypoint(p.x, p.z);
    ctx.story.act = act;
    ctx.story.waypoint = waypoint;
    ctx.story.daysSurvived = daysSurvived;
    ctx.story.fbiEvaded = fbiEvaded;
    ctx.story.deaths = deaths;
    ctx.story.endlessMode = endlessMode;
  }

  function computeActiveWaypoint(px, pz) {
    if (endlessMode || flags.act4Escaped) {
      return null;
    }

    if (act === 1) {
      if (!flags.act1Checkpoint) {
        const cp = findNearestCheckpoint(ctx, px, pz);
        return {
          x: cp.x,
          z: cp.z,
          label: flags.act1Stealth ? 'Campfire Checkpoint (F)' : 'Stealth (C/Q) & Campfire',
        };
      }
      return {
        x: LANDMARKS.sunkenLagoon.x,
        z: LANDMARKS.sunkenLagoon.z,
        label: 'Sunken Lagoon',
      };
    }

    if (act === 2) {
      const holdingBait = hasFishOrMeatNow();
      if (!holdingBait && !flags.act2Tamed) {
        const fishSpot = findNearestHarvestable(ctx, px, pz, (h) => {
          const t = String(h.type || h.id || '').toLowerCase();
          if (t.includes('fish')) return true;
          if (Array.isArray(h.loot)) {
            return h.loot.some((l) => l && (l.id === 'fish' || l.id === 'meat'));
          }
          return false;
        });
        const target = fishSpot || LANDMARKS.lagoonFishBank;
        return {
          x: target.x,
          z: target.z,
          label: 'Gather Fish / Meat',
        };
      }
      const crockPos = getPosXZ(ctx?.companions?.crockstar?.pos, LANDMARKS.sunkenLagoon);
      return {
        x: crockPos.x,
        z: crockPos.z,
        label: 'Tame Crockstar (F)',
      };
    }

    if (act === 3) {
      const smuffPos = getPosXZ(ctx?.fbi?.smuff?.pos, LANDMARKS.smuffCage);
      return {
        x: smuffPos.x,
        z: smuffPos.z,
        label: flags.act3Infiltrated ? 'Unlock Smuff Cage (F)' : 'West FBI Forward Camp',
      };
    }

    // Act 4 — Exfiltration Protocol
    if (!flags.act4Jammers) {
      const list = Array.isArray(ctx?.jammers) ? ctx.jammers : [];
      let best = null;
      let bestDist = Infinity;
      for (const j of list) {
        if (!j || isJammerDestroyed(j)) continue;
        const jx = finiteOr(j.x ?? j.mesh?.position?.x, NaN);
        const jz = finiteOr(j.z ?? j.mesh?.position?.z, NaN);
        if (!Number.isFinite(jx) || !Number.isFinite(jz)) continue;
        const d = distXZ(px, pz, jx, jz);
        if (d < bestDist) {
          bestDist = d;
          best = { x: jx, z: jz };
        }
      }
      const target = best || LANDMARKS.defaultJammers[Math.min(jammersDestroyed, 2)];
      return {
        x: target.x,
        z: target.z,
        label: `Signal Jammer (${jammersDestroyed}/${totalJammers})`,
      };
    }

    if (!flags.act4VanceDefeated) {
      const vanceAgent = Array.isArray(ctx?.fbi?.agents)
        ? ctx.fbi.agents.find((a) => a && (a.id === 'director_vance' || a.isBoss))
        : null;
      const vPos = getPosXZ(vanceAgent?.pos || ctx?.models?.vance?.scene?.position, LANDMARKS.vanceArena);
      return {
        x: vPos.x,
        z: vPos.z,
        label: 'Defeat Director Vance',
      };
    }

    const heliPos = getPosXZ(
      ctx?.escapeVehicle?.position || ctx?.escapeVehicle?.pos || ctx?.escapeVehicle,
      LANDMARKS.escapeHelipad
    );
    return {
      x: heliPos.x,
      z: heliPos.z,
      label: 'Board Escape Chopper (F)',
    };
  }

  function buildObjectivesList() {
    if (endlessMode) {
      return [
        { id: 'endless_campaign', text: 'Exotic Island Campaign Complete', done: true },
        { id: 'endless_tech', text: 'Tier 3 Smuff Tech & All Zones Unlocked', done: true },
        { id: 'endless_survive', text: 'Explore, build & survive endlessly!', done: false },
      ];
    }

    if (act === 1) {
      return [
        {
          id: 'act1_stealth',
          text: 'Activate Dos Undercover or Stealth Sneak (C / Q)',
          done: flags.act1Stealth,
        },
        {
          id: 'act1_checkpoint',
          text: 'Build or activate a Campfire/Bed checkpoint',
          done: flags.act1Checkpoint,
        },
        {
          id: 'act1_lagoon',
          text: 'Travel east toward the Sunken Lagoon',
          done: flags.act1Lagoon,
        },
      ];
    }

    if (act === 2) {
      const baitReady = hasFishOrMeatNow() || flags.act2Tamed;
      return [
        {
          id: 'act2_bait',
          text: 'Gather or hold Fish / Meat',
          done: baitReady,
        },
        {
          id: 'act2_tame',
          text: 'Feed & tame Crockstar (F near Crockstar)',
          done: flags.act2Tamed,
        },
      ];
    }

    if (act === 3) {
      return [
        {
          id: 'act3_infiltrate',
          text: 'Infiltrate West FBI Forward Camp undetected',
          done: flags.act3Infiltrated,
        },
        {
          id: 'act3_rescue',
          text: "Unlock Smuff's cage (F) to recruit Smuff",
          done: flags.act3Rescued,
        },
      ];
    }

    // Act 4
    const jammerText = `Destroy all 3 Signal Jammers in North HQ (${jammersDestroyed}/${totalJammers})`;
    const vanceText = flags.act4VanceDefeated
      ? "Dos hacked Vance's shield — Director Vance defeated!"
      : flags.act4Jammers
        ? "Dos hacked Vance's shield — defeat Director Vance!"
        : "Have Dos hack Vance's shield & defeat Director Vance";

    return [
      {
        id: 'act4_jammers',
        text: jammerText,
        done: flags.act4Jammers,
      },
      {
        id: 'act4_vance',
        text: vanceText,
        done: flags.act4VanceDefeated,
      },
      {
        id: 'act4_escape',
        text: 'Hijack & board the FBI Escape Chopper (F)',
        done: flags.act4Escaped,
      },
    ];
  }

  function updateStats(safeDt) {
    // 1. Days Survived (1 day per ~90s of active gameplay)
    if (!ctx.cutsceneActive && !ctx?.player?.isDead && safeDt > 0) {
      activePlaySeconds += safeDt;
      const computedDay = 1 + Math.floor(activePlaySeconds / DAY_DURATION_SEC) + bonusDays;
      if (computedDay > daysSurvived) {
        daysSurvived = computedDay;
        ctx.toast?.(`☀ Day ${daysSurvived} on Exotic Island!`, 'info');
      }
    }

    // 2. FBI Evaded (increments when globalAlert drops below 15 after exceeding 50)
    const alert = finiteOr(ctx?.fbi?.globalAlert, 0);
    if (alert > HIGH_ALERT_THRESHOLD) {
      wasHighAlert = true;
    } else if (wasHighAlert && alert < EVADED_ALERT_THRESHOLD) {
      wasHighAlert = false;
      fbiEvaded += 1;
      ctx.toast?.('🕶 FBI Patrol Evaded!', 'success');
    }

    // 3. Deaths (tracks unique death crates, 'player_died' events, and isDead rising edges without double-counting)
    if (Array.isArray(ctx?.deathCrates)) {
      for (const crate of ctx.deathCrates) {
        if (!crate) continue;
        const key = crate.id !== undefined ? crate.id : crate;
        if (!seenCrates.has(key)) {
          seenCrates.add(key);
          crateDeaths += 1;
        }
      }
    }

    const isDeadNow = Boolean(ctx?.player?.isDead);
    if (isDeadNow && !wasPlayerDead) {
      deadEdgeDeaths += 1;
    }
    wasPlayerDead = isDeadNow;

    deaths = Math.max(deaths, eventDeaths, crateDeaths, deadEdgeDeaths);

    ctx.story.daysSurvived = daysSurvived;
    ctx.story.fbiEvaded = fbiEvaded;
    ctx.story.deaths = deaths;
  }

  // Mount HUD (safely no-ops in headless Node environments)
  const hud = mountQuestTrackerHud(() => {
    replayCurrentCutscene();
  });

  let hudRefreshAccum = 0;

  function syncHud(force = false) {
    if (!hud) return;
    if (!force && hudRefreshAccum < 0.18) return;
    hudRefreshAccum = 0;

    const p = getPosXZ(ctx?.player?.pos, LANDMARKS.southBeach);
    const zoneName = getZoneName(ctx, p.x, p.z);
    const meta = ACT_META[act] || ACT_META[1];
    const waypoint = ctx.story.waypoint;

    let waypointDistText = '';
    if (waypoint) {
      const d = Math.round(distXZ(p.x, p.z, waypoint.x, waypoint.z));
      const dir = getCompassDir(p.x, p.z, waypoint.x, waypoint.z);
      waypointDistText = dir === 'HERE' ? 'HERE' : `${d}m ${dir}`;
    }

    hud.render({
      cutsceneActive: Boolean(ctx.cutsceneActive || ctx?.systems?.cutscenes?.isActive?.()),
      endlessMode,
      actBadge: endlessMode ? 'ENDLESS FREE-PLAY' : meta.badge,
      actTitle: endlessMode ? 'ENDLESS ISLAND FREE-PLAY' : meta.title,
      objectives: buildObjectivesList(),
      waypointLabel: waypoint ? waypoint.label : '',
      waypointDistText,
      zoneName,
      statsText: `Day ${daysSurvived} · Evaded ${fbiEvaded} · ☠ ${deaths}`,
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  function startCampaign() {
    ensureRespawnHook();
    if (campaignStarted) {
      evaluateProgress(false);
      syncHud(true);
      return Promise.resolve(false);
    }
    campaignStarted = true;
    evaluateProgress(false);
    syncHud(true);
    return triggerCutscene(ACT_META[act]?.cutsceneId || 'act1_opening');
  }

  function update(dt) {
    const safeDt = Math.min(Math.max(finiteOr(dt, 0), 0), 3600);

    // Fire any queued act transition cutscene once the current cutscene finishes
    if (pendingCutsceneId && !ctx.cutsceneActive && !ctx?.systems?.cutscenes?.isActive?.()) {
      cutsceneDelayTimer -= safeDt;
      if (cutsceneDelayTimer <= 0) {
        const queued = pendingCutsceneId;
        pendingCutsceneId = null;
        triggerCutscene(queued);
      }
    }

    updateStats(safeDt);
    evaluateProgress(true);

    hudRefreshAccum += safeDt;
    syncHud(false);
  }

  function recordEvent(type, payload = {}) {
    const ev = String(type || '').toLowerCase().trim();
    if (!ev) return;

    switch (ev) {
      case 'player_died':
      case 'death':
        eventDeaths += 1;
        deaths = Math.max(deaths, eventDeaths, crateDeaths, deadEdgeDeaths);
        break;

      case 'stealth_used':
      case 'undercover_activated':
      case 'sneak_toggled':
      case 'camo_activated':
        flags.act1Stealth = true;
        break;

      case 'checkpoint_activated':
      case 'respawn_set':
      case 'campfire_built':
      case 'bed_built':
        flags.act1Checkpoint = true;
        break;

      case 'building_placed': {
        const bType = String(payload?.type || payload?.id || '').toLowerCase();
        if (bType === 'campfire' || bType === 'bed' || bType === 'leaf_bed') {
          flags.act1Checkpoint = true;
        }
        break;
      }

      case 'entered_lagoon':
      case 'lagoon_reached':
        flags.act1Lagoon = true;
        break;

      case 'item_gathered':
      case 'item_collected':
      case 'bait_gathered': {
        const itemId = String(payload?.id || payload?.itemId || '').toLowerCase();
        if (!itemId || itemId === 'fish' || itemId === 'meat') {
          flags.act2BaitEverHeld = true;
        }
        break;
      }

      case 'crockstar_tamed':
        flags.act2Tamed = true;
        flags.act2BaitEverHeld = true;
        flags.act1Lagoon = true;
        break;

      case 'west_camp_infiltrated':
      case 'camp_infiltrated':
        flags.act3Infiltrated = true;
        break;

      case 'smuff_rescued':
        flags.act3Rescued = true;
        flags.act3Infiltrated = true;
        break;

      case 'jammer_destroyed': {
        if (typeof payload?.destroyedCount === 'number') {
          eventJammersDestroyed = Math.max(eventJammersDestroyed, payload.destroyedCount);
        } else {
          eventJammersDestroyed += 1;
        }
        break;
      }

      case 'shield_hacked':
      case 'vance_shield_down':
        flags.act4ShieldHacked = true;
        break;

      case 'vance_defeated':
      case 'boss_defeated':
        flags.act4VanceDefeated = true;
        flags.act4Jammers = true;
        flags.act4ShieldHacked = true;
        break;

      case 'escaped':
      case 'escape_triggered':
      case 'chopper_boarded':
      case 'campaign_complete':
      case 'victory':
        flags.act4VanceDefeated = true;
        flags.act4Jammers = true;
        flags.act4ShieldHacked = true;
        flags.act4Escaped = true;
        campaignComplete = true;
        break;

      case 'fbi_evaded':
        fbiEvaded += 1;
        break;

      case 'day_passed':
        bonusDays += 1;
        daysSurvived = Math.max(daysSurvived + 1, 1 + Math.floor(activePlaySeconds / DAY_DURATION_SEC) + bonusDays);
        break;

      case 'endless_enabled':
        enableEndlessMode();
        return;

      default:
        break;
    }

    evaluateProgress(true);
    syncHud(true);
  }

  function enableEndlessMode() {
    endlessMode = true;
    campaignComplete = true;
    flags.act4Escaped = true;
    flags.act4VanceDefeated = true;
    flags.act4Jammers = true;
    flags.act4ShieldHacked = true;
    act = 4;

    ctx.story.act = act;
    ctx.story.endlessMode = true;
    ctx.story.waypoint = null;
    ctx.story.daysSurvived = daysSurvived;
    ctx.story.fbiEvaded = fbiEvaded;
    ctx.story.deaths = deaths;

    ctx.systems?.audio?.setMusicMode?.('explore');
    ctx.toast?.('🌴 Endless Island Free-Play unlocked! Keep exploring, crafting & building!', 'success');
    syncHud(true);
  }

  function replayCurrentCutscene() {
    const cutsceneId = endlessMode
      ? lastPlayedCutsceneId || 'act4_vance_hq'
      : ACT_META[act]?.cutsceneId || 'act1_opening';
    return triggerCutscene(cutsceneId, { force: true });
  }

  function getState() {
    const meta = ACT_META[act] || ACT_META[1];
    return {
      act,
      actBadge: endlessMode ? 'ENDLESS FREE-PLAY' : meta.badge,
      actTitle: endlessMode ? 'ENDLESS ISLAND FREE-PLAY' : meta.title,
      endlessMode,
      campaignStarted,
      campaignComplete,
      objectives: buildObjectivesList(),
      waypoint: ctx.story.waypoint ? { ...ctx.story.waypoint } : null,
      daysSurvived,
      fbiEvaded,
      deaths,
      stats: {
        daysSurvived,
        fbiEvaded,
        deaths,
      },
      jammersDestroyed,
      totalJammers,
      vanceDefeated: flags.act4VanceDefeated,
      escaped: flags.act4Escaped,
    };
  }

  // Initial sync
  evaluateProgress(false);
  syncHud(true);

  return {
    update,
    startCampaign,
    getState,
    recordEvent,
    enableEndlessMode,
    replayCurrentCutscene,
  };
}
