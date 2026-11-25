import * as THREE from 'three';

// ============================================================================
// Project: Last Exotic — 3D In-Engine Cutscene Director & Dialogue UI (EXOTIC-012)
// Owns: src/systems/cutscenes.js, src/ui/dialogue.html, src/ui/dialogue.css
// ============================================================================

const TYPEWRITER_CHARS_PER_SEC = 42;
const BLIP_CHAR_INTERVAL = 3;
const DEFAULT_CAM_TRANSITION_SEC = 1.35;
const RETURN_EASE_DURATION_SEC = 0.65;
const DEFAULT_TEXTLESS_SHOT_SEC = 2.4;

const HAS_DOM =
  typeof document !== 'undefined' && typeof document.createElement === 'function';
const HAS_WINDOW = typeof window !== 'undefined';

// Browser-only lazy import of Vite ?raw HTML and CSS so headless Node ESM tests
// can import this module without hitting ERR_UNKNOWN_FILE_EXTENSION while Vite
// statically bundles both ../ui/dialogue.html?raw and ../ui/dialogue.css.
let uiAssetsPromise = null;
let loadedDialogueHtml = '';

function loadBrowserUiAssets() {
  if (!HAS_DOM) return null;
  if (!uiAssetsPromise) {
    uiAssetsPromise = Promise.all([
      import('../ui/dialogue.html?raw'),
      import('../ui/dialogue.css'),
    ])
      .then(([htmlMod]) => {
        loadedDialogueHtml = typeof htmlMod?.default === 'string' ? htmlMod.default : '';
        return loadedDialogueHtml;
      })
      .catch(() => '');
  }
  return uiAssetsPromise;
}

if (HAS_DOM) {
  loadBrowserUiAssets();
}

// ============================================================================
// Inline Cel-Shaded SVG Speaker Portraits (matching references/characters_ref.png)
// Zero external URLs / fonts.
// ============================================================================

const SPEAKER_META = Object.freeze({
  tarcy: {
    label: 'TARCY (BOOTS)',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Shoulders & iconic bright yellow circular belly patch -->
      <path d="M22 96c2-15 11-23 26-23s24 8 26 23z" fill="#978ea8" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <circle cx="48" cy="88" r="13.5" fill="#f7e248" stroke="#181c20" stroke-width="2.4" />
      <!-- Three iconic white/pink head tufts -->
      <path d="M40 27c-3-9-2-17 3-20 4 4 5 11 4 19z" fill="#ffffff" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M41.5 24c-1.5-6-1-11 1.5-13.5 1.8 3 2.2 8 1.5 13z" fill="#f7a8c2" />
      <path d="M47 26c1-10 5-18 11-19 2 6 0 13-4 19z" fill="#ffffff" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M49.2 23.5c1-6.5 3.5-11.5 6.8-12.5.8 3.5-.3 8.2-2.6 12.2z" fill="#f7a8c2" />
      <path d="M54 29c4-7 10-12 15-11 0 6-4 12-10 15z" fill="#ffffff" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M56 28c2.6-4.5 6.4-7.2 9.4-6.8-.4 3.4-3 7-6.8 8.8z" fill="#f7a8c2" />
      <!-- Side Ears -->
      <circle cx="19" cy="49" r="10.5" fill="#978ea8" stroke="#181c20" stroke-width="3" />
      <circle cx="19.5" cy="49.5" r="5.5" fill="#f7b7cd" stroke="#181c20" stroke-width="1.8" />
      <circle cx="77" cy="49" r="10.5" fill="#978ea8" stroke="#181c20" stroke-width="3" />
      <circle cx="76.5" cy="49.5" r="5.5" fill="#f7b7cd" stroke="#181c20" stroke-width="1.8" />
      <!-- Lavender-Grey Monkey Head -->
      <ellipse cx="48" cy="51" rx="27" ry="24.5" fill="#978ea8" stroke="#181c20" stroke-width="3" />
      <path d="M23 55c4 12 14 18 25 18 11 0 21-6 25-18-3 14-13 21-25 21S26 69 23 55z" fill="#776e88" />
      <!-- Soft Pink Face Mask -->
      <path d="M27 52c0-10 7.5-17 15.5-15.5 2.4.5 4.2 1.8 5.5 3.6 1.3-1.8 3.1-3.1 5.5-3.6C61.5 35 69 42 69 52c0 4.5-1.8 8.2-4.6 10.6 1.2 2 1.8 4.2 1.6 6.4-.5 5.4-8.2 8.2-18 8.2s-17.5-2.8-18-8.2c-.2-2.2.4-4.4 1.6-6.4C28.8 60.2 27 56.5 27 52z" fill="#f7b7cd" stroke="#181c20" stroke-width="2.4" stroke-linejoin="round" />
      <!-- Cartoon Eyes -->
      <ellipse cx="39.5" cy="50" rx="5.2" ry="6.2" fill="#ffffff" stroke="#181c20" stroke-width="2.2" />
      <ellipse cx="56.5" cy="50" rx="5.2" ry="6.2" fill="#ffffff" stroke="#181c20" stroke-width="2.2" />
      <ellipse cx="40.3" cy="50.5" rx="3.1" ry="4.1" fill="#2c1d24" />
      <ellipse cx="55.7" cy="50.5" rx="3.1" ry="4.1" fill="#2c1d24" />
      <circle cx="41.4" cy="48.4" r="1.4" fill="#ffffff" />
      <circle cx="56.8" cy="48.4" r="1.4" fill="#ffffff" />
      <!-- Nostrils & Cheerful Smile -->
      <circle cx="45.2" cy="58.2" r="1.3" fill="#a85d79" />
      <circle cx="50.8" cy="58.2" r="1.3" fill="#a85d79" />
      <path d="M36.5 64.5c5.5 4.4 17.5 4.4 23 0" fill="none" stroke="#181c20" stroke-width="2.6" stroke-linecap="round" />
    </svg>`,
  },

  dos: {
    label: 'DOS',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Stubby crimson arms -->
      <path d="M22 72l-9 9c-2 2-1 5 2 6l9-3z" fill="#b4181e" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <path d="M74 72l9 9c2 2 1 5-2 6l-9-3z" fill="#b4181e" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <!-- Compact faceted crimson-red blob body -->
      <path d="M24 44c0-10 10-16 24-16s24 6 24 16l4 26c1 13-9 22-28 22S19 83 20 70z" fill="#cc1e24" stroke="#181c20" stroke-width="3.2" stroke-linejoin="round" />
      <!-- Low-poly cel highlight & shadow facets -->
      <path d="M25 46l12-10 4 46-17-6z" fill="#e63036" opacity="0.55" />
      <path d="M58 34l14 10 3 26c0 10-7 17-18 20l4-24z" fill="#921218" opacity="0.6" />
      <!-- Oversized expressive white cartoon eyes -->
      <circle cx="37" cy="59" r="12.5" fill="#ffffff" stroke="#181c20" stroke-width="3" />
      <circle cx="60" cy="59" r="12.5" fill="#ffffff" stroke="#181c20" stroke-width="3" />
      <circle cx="39.5" cy="59.5" r="6.4" fill="#32181a" />
      <circle cx="62.2" cy="59.5" r="6.4" fill="#32181a" />
      <circle cx="37.2" cy="56.5" r="2.3" fill="#ffffff" />
      <circle cx="60.0" cy="56.5" r="2.3" fill="#ffffff" />
      <!-- Determined flat mouth -->
      <path d="M44 76.5h9" stroke="#5c0d12" stroke-width="3" stroke-linecap="round" />
      <!-- Black FBI Baseball Cap -->
      <path d="M21 41c1-16 11-26 27-26 15 0 25 9 27 24l-54 2z" fill="#23282e" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <path d="M25 38c2-11 9-18 20-20-6 5-9 12-9 20z" fill="#353d46" opacity="0.7" />
      <!-- Curved Cap Brim -->
      <path d="M20 40c16-4 40-3 62 3 2 1 1 5-3 5-17-2-39-2-57 1-4 0-5-7-2-9z" fill="#171b20" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <!-- Cap Top Button -->
      <circle cx="48" cy="14.5" r="3.2" fill="#2d333b" stroke="#181c20" stroke-width="2" />
      <!-- Bold Gold FBI Lettering -->
      <text x="48" y="34.5" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="900" font-size="14.5" letter-spacing="1.2" fill="#f0cf4a" stroke="#14181c" stroke-width="0.9">FBI</text>
    </svg>`,
  },

  crockstar: {
    label: 'CROCKSTAR',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Dorsal ridges along back of head/neck -->
      <path d="M18 32l-7 6 7 5-8 7 8 5-7 8 9 4z" fill="#4f611c" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <!-- Olive-green torso & bright yellow ribbed underbelly -->
      <path d="M19 96l3-36c2-15 11-24 25-24h16l10 14-8 46z" fill="#7c9233" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <path d="M40 66c9-2 17-1 22 4l-2 26H38z" fill="#f2dc52" stroke="#181c20" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M41 75h19M40 83h20M40 90h19" stroke="#c4ad2c" stroke-width="2" stroke-linecap="round" />
      <!-- Chunky Crocodile Head & Snout -->
      <path d="M23 44c0-13 9-22 22-22h11c5 0 9 3 10 8l15 5c5 2 7 6 6 11-1 5-6 8-13 9l-24 2-19-2c-5-1-8-5-8-11z" fill="#7c9233" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <!-- Upper snout highlight -->
      <path d="M52 36l25 5c3 1 4 3 3 5l-27-3z" fill="#9eb848" />
      <!-- Yellow Lower Jaw -->
      <path d="M27 52c8 4 21 5 35 4l21-2c1 6-4 11-13 12-13 2-30 1-40-4-4-2-5-6-3-10z" fill="#f2dc52" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <!-- Jagged White Conical Teeth -->
      <polygon points="46,55 50,62 54,55" fill="#ffffff" stroke="#181c20" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="60,55 64,62 68,54" fill="#ffffff" stroke="#181c20" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="73,53 77,60 80,53" fill="#ffffff" stroke="#181c20" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="54,58 57,52 60,58" fill="#ffffff" stroke="#181c20" stroke-width="1.6" stroke-linejoin="round" />
      <!-- Snout Nostrils -->
      <circle cx="77" cy="44.5" r="2.2" fill="#3a4714" />
      <circle cx="83" cy="45.5" r="1.8" fill="#3a4714" />
      <!-- Expressive Cartoon Eyes with Brow Ridges -->
      <path d="M35 28c0-6 5-10 10-9 5 1 8 5 8 10v8H35z" fill="#6d822a" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M53 29c0-5 4-9 9-8s7 5 7 9v7H53z" fill="#6d822a" stroke="#181c20" stroke-width="2.6" stroke-linejoin="round" />
      <ellipse cx="44" cy="34.5" rx="6.2" ry="6.8" fill="#f8f4cc" stroke="#181c20" stroke-width="2.4" />
      <ellipse cx="61" cy="34.5" rx="5.5" ry="6.2" fill="#f8f4cc" stroke="#181c20" stroke-width="2.4" />
      <circle cx="45.8" cy="35" r="2.8" fill="#181c20" />
      <circle cx="62.5" cy="35" r="2.5" fill="#181c20" />
      <circle cx="44.8" cy="33.2" r="1.1" fill="#ffffff" />
      <circle cx="61.5" cy="33.2" r="1" fill="#ffffff" />
    </svg>`,
  },

  smuff: {
    label: 'SMUFF',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Cobalt-blue shoulders & white trousers waistband peek -->
      <path d="M23 96c2-14 11-22 25-22s23 8 25 22z" fill="#288ee6" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <path d="M27 89h42v7H27z" fill="#f2f6fa" stroke="#181c20" stroke-width="2.6" />
      <!-- Pointed Cobalt Ears -->
      <path d="M24 55c-8-1-12 3-10 8 2 5 7 6 12 4z" fill="#288ee6" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <path d="M72 55c8-1 12 3 10 8-2 5-7 6-12 4z" fill="#288ee6" stroke="#181c20" stroke-width="2.8" stroke-linejoin="round" />
      <!-- Cobalt-Blue Head -->
      <ellipse cx="48" cy="58" rx="24" ry="20" fill="#288ee6" stroke="#181c20" stroke-width="3" />
      <path d="M26 62c4 10 13 15 22 15 10 0 18-5 22-15-4 12-12 17-22 17s-18-5-22-17z" fill="#1868b3" />
      <!-- Big White Cartoon Eyes -->
      <ellipse cx="41" cy="53" rx="6.2" ry="7.2" fill="#ffffff" stroke="#181c20" stroke-width="2.4" />
      <ellipse cx="55" cy="53" rx="6.2" ry="7.2" fill="#ffffff" stroke="#181c20" stroke-width="2.4" />
      <circle cx="42.5" cy="53.5" r="2.8" fill="#181c20" />
      <circle cx="53.5" cy="53.5" r="2.8" fill="#181c20" />
      <circle cx="41.7" cy="51.7" r="1.1" fill="#ffffff" />
      <circle cx="52.7" cy="51.7" r="1.1" fill="#ffffff" />
      <!-- Friendly Smile -->
      <path d="M38 67.5c5.5 4.2 14.5 4.2 20 0" fill="none" stroke="#181c20" stroke-width="2.6" stroke-linecap="round" />
      <!-- Bulbous Blue Nose -->
      <ellipse cx="48.5" cy="60.5" rx="7.6" ry="6.2" fill="#3ca4fa" stroke="#181c20" stroke-width="2.5" />
      <ellipse cx="46.2" cy="58.4" rx="2.5" ry="1.6" fill="#92d3ff" />
      <!-- Iconic Floppy White Phrygian Cap -->
      <path d="M21 48c0-17 11-36 31-38 11-1 20 3 21 10 1 6-4 10-12 11 7 2 12 7 13 15-16-4-36-4-53 2z" fill="#f3f7fb" stroke="#181c20" stroke-width="3" stroke-linejoin="round" />
      <path d="M23 44c16-5 35-5 49-1-1 2-1 4-2 5-15-4-33-4-48 1z" fill="#cad7e6" />
      <path d="M37 28c10-2 20-1 27 3" fill="none" stroke="#b6c6d8" stroke-width="2.4" stroke-linecap="round" />
    </svg>`,
  },

  vance: {
    label: 'DIRECTOR VANCE',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Heavy Armored Exo-Mech Pauldrons with Gold Trim -->
      <path d="M6 96l6-28c3-7 10-10 19-11l17 4 17-4c9 1 16 4 19 11l6 28z" fill="#20252d" stroke="#14181c" stroke-width="3" stroke-linejoin="round" />
      <path d="M10 73l14-12 7 7-13 14z" fill="#f0c030" stroke="#14181c" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M86 73L72 61l-7 7 13 14z" fill="#f0c030" stroke="#14181c" stroke-width="2.2" stroke-linejoin="round" />
      <!-- Glowing Gold Power Core & Chestplate -->
      <polygon points="48,73 56,80 53,90 43,90 40,80" fill="#ffd92b" stroke="#14181c" stroke-width="2.4" stroke-linejoin="round" />
      <polygon points="48,76 52.5,80.5 50.8,86.5 45.2,86.5 43.5,80.5" fill="#fff7bd" />
      <!-- Gold Tactical Antenna / Earpiece -->
      <path d="M74 44V21" stroke="#f0c030" stroke-width="3.2" stroke-linecap="round" />
      <circle cx="74" cy="19" r="3.4" fill="#ff3344" stroke="#14181c" stroke-width="2" />
      <rect x="69" y="38" width="8" height="14" rx="3" fill="#f0c030" stroke="#14181c" stroke-width="2.2" />
      <!-- Armored Tactical Helmet / Head -->
      <path d="M25 41c0-15 10-25 23-25s23 10 23 25v14c0 9-9 16-23 16s-23-7-23-16z" fill="#272e38" stroke="#14181c" stroke-width="3" stroke-linejoin="round" />
      <!-- Helmet Gold Crest -->
      <path d="M43 16h10l-2 15h-6z" fill="#f0c030" stroke="#14181c" stroke-width="2" stroke-linejoin="round" />
      <!-- Menacing Glowing Crimson Red Visor -->
      <path d="M27 39l17 3h8l17-3v11c-5 4-13 5-21 5s-16-1-21-5z" fill="#12151a" stroke="#14181c" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M30 42l15 2.5h6L66 42v6.2c-4.5 2.5-11 3.3-18 3.3s-13.5-.8-18-3.3z" fill="#ff2638" />
      <path d="M33 44.5h30l-4 3.5H37z" fill="#ff9ca4" opacity="0.85" />
      <!-- Armored Jawplate & Stern Slit -->
      <path d="M36 60h24l-4 8H40z" fill="#3a4350" stroke="#14181c" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M41 63.5h14" stroke="#14181c" stroke-width="2.4" stroke-linecap="round" />
    </svg>`,
  },

  fbi: {
    label: 'FBI AGENT',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Black Tactical Suit & White Shirt/Tie -->
      <path d="M15 96l5-21c3-7 13-11 28-11s25 4 28 11l5 21z" fill="#1e242b" stroke="#14181c" stroke-width="3" stroke-linejoin="round" />
      <polygon points="37,65 48,88 59,65" fill="#f0f4f8" stroke="#14181c" stroke-width="2.2" stroke-linejoin="round" />
      <polygon points="45,67 51,67 50,86 48,91 46,86" fill="#14181c" />
      <!-- Tactical Coiled Earpiece -->
      <path d="M70 54c4 2 5 7 1 11" fill="none" stroke="#d2dce6" stroke-width="2.4" stroke-linecap="round" />
      <!-- Square-Jawed Agent Head -->
      <path d="M28 40h40v14c0 10-8 17-20 17s-20-7-20-17z" fill="#e2b492" stroke="#14181c" stroke-width="3" stroke-linejoin="round" />
      <path d="M56 41h11v13c0 8-5 14-14 16 6-4 8-10 8-16z" fill="#c79572" opacity="0.55" />
      <!-- Stern Expression -->
      <path d="M41 61.5h14" stroke="#14181c" stroke-width="2.6" stroke-linecap="round" />
      <!-- Pitch-Black Aviator Sunglasses -->
      <path d="M27 43h19v9c0 4-3.5 6-8.5 6S27 56 27 52z" fill="#11151a" stroke="#14181c" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M50 43h19v9c0 4-3.5 6-8.5 6S50 56 50 52z" fill="#11151a" stroke="#14181c" stroke-width="2.4" stroke-linejoin="round" />
      <path d="M45 45h6" stroke="#14181c" stroke-width="2.6" />
      <path d="M31 46l5 8M54 46l5 8" stroke="#7dd3fc" stroke-width="2.2" stroke-linecap="round" opacity="0.85" />
      <!-- Black FBI Tactical Cap -->
      <path d="M23 39c2-15 11-23 25-23s23 8 25 23z" fill="#232a32" stroke="#14181c" stroke-width="3" stroke-linejoin="round" />
      <path d="M19 39c18-3 40-3 58 0 1 3-1 5-4 5-17-2-33-2-50 0-3 0-5-2-4-5z" fill="#14181e" stroke="#14181c" stroke-width="2.6" stroke-linejoin="round" />
      <text x="48" y="34" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="900" font-size="13.5" letter-spacing="1.1" fill="#f0c83c">FBI</text>
    </svg>`,
  },

  narrator: {
    label: 'NARRATOR',
    svg: `<svg class="dialogue-portrait-svg" viewBox="0 0 96 96" aria-hidden="true">
      <!-- Outer Antique Gold Compass Ring -->
      <circle cx="48" cy="48" r="38" fill="#1d4d57" stroke="#14181c" stroke-width="3.2" />
      <circle cx="48" cy="48" r="32" fill="none" stroke="#f0c94a" stroke-width="2.8" />
      <!-- Rising Tropical Sun -->
      <circle cx="48" cy="44" r="15" fill="#ffd92b" stroke="#14181c" stroke-width="2.2" />
      <!-- Ocean Horizon -->
      <path d="M16 56c12-4 22 4 32 0s20-4 32 0c-3 15-16 26-32 26S19 71 16 56z" fill="#2792b5" stroke="#14181c" stroke-width="2.4" stroke-linejoin="round" />
      <!-- Island Sand Mound & Palm Silhouette -->
      <path d="M28 60c7-7 28-8 38 0z" fill="#e5c16a" stroke="#14181c" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M47 58c-1-9 1-16 4-22" fill="none" stroke="#5c3b1e" stroke-width="4" stroke-linecap="round" />
      <path d="M51 36c-8-4-15-2-19 3 6 0 12 1 17 4z" fill="#3f993b" stroke="#14181c" stroke-width="2" stroke-linejoin="round" />
      <path d="M51 36c8-5 16-3 20 2-6 0-12 2-17 5z" fill="#4eb346" stroke="#14181c" stroke-width="2" stroke-linejoin="round" />
      <path d="M51 36c-2-7 3-13 9-14-1 5-3 9-6 13z" fill="#63c754" stroke="#14181c" stroke-width="2" stroke-linejoin="round" />
      <!-- Cardinal Compass Points -->
      <polygon points="48,7 52,16 44,16" fill="#ffe066" stroke="#14181c" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="48,89 52,80 44,80" fill="#ffe066" stroke="#14181c" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="7,48 16,44 16,52" fill="#ffe066" stroke="#14181c" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="89,48 80,44 80,52" fill="#ffe066" stroke="#14181c" stroke-width="1.8" stroke-linejoin="round" />
    </svg>`,
  },
});

// ============================================================================
// Pure Helpers
// ============================================================================

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function toVec3(input, fallback) {
  if (Array.isArray(input) && input.length >= 3) {
    const x = Number(input[0]);
    const y = Number(input[1]);
    const z = Number(input[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return new THREE.Vector3(x, y, z);
    }
  } else if (input && typeof input === 'object') {
    const x = Number(input.x);
    const y = Number(input.y);
    const z = Number(input.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return new THREE.Vector3(x, y, z);
    }
  }
  return fallback.clone();
}

function resolveSpeakerKey(portrait, speaker) {
  const candidates = [portrait, speaker];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const norm = raw.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SPEAKER_META, norm)) {
      return norm;
    }
    if (norm.includes('tarcy') || norm.includes('boots') || norm.includes('monkey')) return 'tarcy';
    if (norm.includes('dos')) return 'dos';
    if (norm.includes('crock') || norm.includes('croc')) return 'crockstar';
    if (norm.includes('smuff') || norm.includes('smurf')) return 'smuff';
    if (norm.includes('vance') || norm.includes('director') || norm.includes('boss')) return 'vance';
    if (
      norm.includes('fbi') ||
      norm.includes('agent') ||
      norm.includes('chopper') ||
      norm.includes('squad') ||
      norm.includes('pilot')
    ) {
      return 'fbi';
    }
    if (norm.includes('narrator')) return 'narrator';
  }
  return 'narrator';
}

function triggerShotAnims(ctx, anims) {
  if (!Array.isArray(anims) || anims.length === 0) return;
  const models = ctx?.models;

  for (const entry of anims) {
    if (!entry || !entry.modelKey || !entry.clip) continue;
    const rawKey = String(entry.modelKey).trim().toLowerCase();
    const fadeSec = typeof entry.fadeSec === 'number' ? entry.fadeSec : 0.16;

    // Resolve alias keys cleanly
    let key = rawKey;
    if (key === 'boots') key = 'tarcy';
    if (key === 'director_vance' || key === 'director') key = 'vance';

    const model = models?.[key] ?? models?.[entry.modelKey];
    if (model && typeof model.play === 'function') {
      try {
        model.play(entry.clip, fadeSec);
      } catch {
        // Ignore missing clips safely
      }
    }

    // Also animate active patrolling FBI clones during 'fbi' cutscene shots
    if (key === 'fbi' && Array.isArray(ctx?.fbi?.agents)) {
      for (const agent of ctx.fbi.agents) {
        if (!agent || agent.isBoss || agent.state === 'ko') continue;
        if (agent.model && agent.model !== model && typeof agent.model.play === 'function') {
          try {
            agent.model.play(entry.clip, fadeSec);
          } catch {
            // Ignore missing clips safely
          }
        }
      }
    }
  }
}

function sampleGameplayCameraPose(ctx, fallbackPos, fallbackTarget) {
  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const activeCam = typeof ctx?.getActiveCamera === 'function' ? ctx.getActiveCamera() : null;

  if (activeCam) {
    try {
      activeCam.updateMatrixWorld?.(true);
      if (typeof activeCam.getWorldPosition === 'function') {
        activeCam.getWorldPosition(pos);
      } else if (activeCam.position) {
        pos.copy(activeCam.position);
      }

      const dir = new THREE.Vector3(0, -0.7, -0.7).normalize();
      if (typeof activeCam.getWorldDirection === 'function') {
        activeCam.getWorldDirection(dir);
      }

      if (dir.y < -0.05) {
        const t = THREE.MathUtils.clamp((0.4 - pos.y) / dir.y, 2, 48);
        target.copy(pos).addScaledVector(dir, t);
      } else if (ctx?.player?.pos) {
        target.set(
          Number.isFinite(ctx.player.pos.x) ? ctx.player.pos.x : 0,
          0.8,
          Number.isFinite(ctx.player.pos.z) ? ctx.player.pos.z : 0
        );
      } else {
        target.copy(pos).addScaledVector(dir, 12);
      }
      return { pos, target };
    } catch {
      // Fall through to player-based fallback
    }
  }

  if (ctx?.player?.pos) {
    const px = Number.isFinite(ctx.player.pos.x) ? ctx.player.pos.x : 0;
    const pz = Number.isFinite(ctx.player.pos.z) ? ctx.player.pos.z : 0;
    target.set(px, 0.8, pz);
    pos.set(px + 10, 12, pz + 12);
    return { pos, target };
  }

  return {
    pos: fallbackPos ? fallbackPos.clone() : new THREE.Vector3(10, 12, 18),
    target: fallbackTarget ? fallbackTarget.clone() : new THREE.Vector3(0, 0.8, 0),
  };
}

// ============================================================================
// Factory: createCutsceneSystem(ctx)
// ============================================================================

export function createCutsceneSystem(ctx = {}) {
  const initialAspect =
    HAS_WINDOW && window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9;

  const cutsceneCam = new THREE.PerspectiveCamera(46, initialAspect, 0.1, 240);
  cutsceneCam.position.set(10, 12, 22);
  cutsceneCam.lookAt(0, 0.8, 10);

  // Ensure ctx.cutsceneActive starts cleanly initialized
  if (ctx && typeof ctx === 'object' && typeof ctx.cutsceneActive !== 'boolean') {
    ctx.cutsceneActive = false;
  }

  // Runtime state
  let active = false;
  let phase = 'idle'; // 'idle' | 'shots' | 'returning'
  let currentDef = null;
  let shotIndex = -1;
  let resolveCurrent = null;

  // Typewriter state
  let fullText = '';
  let revealedCount = 0;
  let charFloat = 0;
  let blipCharAccum = 0;
  let isTyping = false;
  let shotElapsed = 0;

  // Camera easing state (pooled vectors for zero per-frame allocations)
  const currentCamPos = new THREE.Vector3(10, 12, 22);
  const currentCamTarget = new THREE.Vector3(0, 0.8, 10);
  const shotFromPos = new THREE.Vector3();
  const shotToPos = new THREE.Vector3();
  const shotFromTarget = new THREE.Vector3();
  const shotToTarget = new THREE.Vector3();
  const tmpDesiredPos = new THREE.Vector3();
  const tmpDesiredTarget = new THREE.Vector3();
  let camEaseElapsed = 0;
  let camEaseDuration = DEFAULT_CAM_TRANSITION_SEC;
  let returnElapsed = 0;

  // DOM references (populated when mounted in browser)
  const dom = {
    mounted: false,
    overlay: null,
    title: null,
    progress: null,
    skipBtn: null,
    dialogueBox: null,
    portrait: null,
    speaker: null,
    text: null,
    continueEl: null,
    lastPortraitKey: '',
  };

  function applyCameraTransform() {
    cutsceneCam.position.copy(currentCamPos);
    cutsceneCam.lookAt(currentCamTarget);
    cutsceneCam.updateMatrixWorld();
  }

  function syncDomFromState() {
    if (!dom.mounted || !dom.overlay) return;

    dom.overlay.classList.toggle('is-active', active);
    dom.overlay.setAttribute('aria-hidden', active ? 'false' : 'true');

    if (!active || !currentDef) {
      dom.overlay.classList.remove('is-dialogue-visible', 'is-typing', 'is-line-ready');
      return;
    }

    // Top title banner
    const titleStr = typeof currentDef.title === 'string' ? currentDef.title.trim() : '';
    if (dom.title) {
      dom.title.textContent = titleStr;
      dom.title.classList.toggle('is-empty', titleStr.length === 0);
    }

    // Shot progress counter
    const totalShots = Array.isArray(currentDef.shots) ? currentDef.shots.length : 0;
    if (dom.progress) {
      if (phase === 'shots' && totalShots > 1 && shotIndex >= 0) {
        dom.progress.textContent = `${shotIndex + 1} / ${totalShots}`;
        dom.progress.classList.remove('is-empty');
      } else {
        dom.progress.textContent = '';
        dom.progress.classList.add('is-empty');
      }
    }

    if (phase !== 'shots' || shotIndex < 0 || shotIndex >= totalShots) {
      dom.overlay.classList.remove('is-dialogue-visible', 'is-typing', 'is-line-ready');
      return;
    }

    const shot = currentDef.shots[shotIndex];
    const hasDialogue = fullText.length > 0 || Boolean(shot?.speaker);
    dom.overlay.classList.toggle('is-dialogue-visible', hasDialogue);
    dom.overlay.classList.toggle('is-typing', isTyping);
    dom.overlay.classList.toggle('is-line-ready', !isTyping && hasDialogue);

    const speakerKey = resolveSpeakerKey(shot?.portrait, shot?.speaker);
    const meta = SPEAKER_META[speakerKey] || SPEAKER_META.narrator;
    dom.overlay.setAttribute('data-speaker', speakerKey);

    if (dom.speaker) {
      const displaySpeaker =
        typeof shot?.speaker === 'string' && shot.speaker.trim().length > 0
          ? shot.speaker.trim()
          : meta.label;
      dom.speaker.textContent = displaySpeaker;
    }

    if (dom.portrait && dom.lastPortraitKey !== speakerKey) {
      dom.portrait.innerHTML = meta.svg;
      dom.lastPortraitKey = speakerKey;
    }

    if (dom.text) {
      dom.text.textContent = fullText.slice(0, revealedCount);
    }
  }

  function bindOverlayDom(rootEl) {
    if (!rootEl) return;
    dom.overlay = rootEl;
    dom.title = rootEl.querySelector('#cutscene-title');
    dom.progress = rootEl.querySelector('#cutscene-progress');
    dom.skipBtn = rootEl.querySelector('#btn-cutscene-skip');
    dom.dialogueBox = rootEl.querySelector('#dialogue-box');
    dom.portrait = rootEl.querySelector('#dialogue-portrait');
    dom.speaker = rootEl.querySelector('#dialogue-speaker');
    dom.text = rootEl.querySelector('#dialogue-text');
    dom.continueEl = rootEl.querySelector('#dialogue-continue');
    dom.mounted = true;

    const stopPointerLeak = (e) => {
      if (!active) return;
      e.stopPropagation();
    };

    if (dom.skipBtn) {
      dom.skipBtn.addEventListener('pointerdown', stopPointerLeak);
      dom.skipBtn.addEventListener('click', (e) => {
        if (!active) return;
        e.preventDefault();
        e.stopPropagation();
        skip();
      });
    }

    if (dom.dialogueBox) {
      dom.dialogueBox.addEventListener('pointerdown', stopPointerLeak);
      dom.dialogueBox.addEventListener('click', (e) => {
        if (!active) return;
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('#btn-cutscene-skip')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleAdvanceInput();
      });
    }

    // Force style flush before toggling .is-active so slide-in transitions animate cleanly
    if (active && typeof rootEl.offsetHeight === 'number') {
      void rootEl.offsetHeight;
    }
    syncDomFromState();
  }

  function ensureDomMounted() {
    if (!HAS_DOM || dom.mounted) return;

    const existing = document.getElementById('cutscene-overlay');
    if (existing) {
      bindOverlayDom(existing);
      return;
    }

    const mountHtml = (html) => {
      if (dom.mounted || !html || !document.body) return;
      const already = document.getElementById('cutscene-overlay');
      if (already) {
        bindOverlayDom(already);
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      const overlayNode = wrapper.querySelector('#cutscene-overlay') || wrapper.firstElementChild;
      if (overlayNode) {
        document.body.appendChild(overlayNode);
        bindOverlayDom(overlayNode);
      }
    };

    if (loadedDialogueHtml) {
      mountHtml(loadedDialogueHtml);
    } else {
      loadBrowserUiAssets()?.then((html) => {
        mountHtml(html);
      });
    }
  }

  function finishCutscene(wasSkipped = false) {
    if (!active) return;
    const finishedDef = currentDef;
    const done = resolveCurrent;

    active = false;
    phase = 'idle';
    currentDef = null;
    shotIndex = -1;
    resolveCurrent = null;
    fullText = '';
    revealedCount = 0;
    charFloat = 0;
    blipCharAccum = 0;
    isTyping = false;
    shotElapsed = 0;

    if (ctx && typeof ctx === 'object') {
      ctx.cutsceneActive = false;
    }

    syncDomFromState();

    if (wasSkipped && typeof finishedDef?.onSkip === 'function') {
      try {
        finishedDef.onSkip(ctx);
      } catch {
        // Keep teardown resilient
      }
    }
    if (typeof finishedDef?.onEnd === 'function') {
      try {
        finishedDef.onEnd(ctx);
      } catch {
        // Keep teardown resilient
      }
    }

    try {
      ctx?.emit?.('cutscene:end', { id: finishedDef?.id ?? null, skipped: wasSkipped });
    } catch {
      // Ignore event bus errors
    }

    if (typeof done === 'function') {
      done({ id: finishedDef?.id ?? null, skipped: wasSkipped });
    }
  }

  function beginReturnEase() {
    phase = 'returning';
    returnElapsed = 0;
    shotFromPos.copy(currentCamPos);
    shotFromTarget.copy(currentCamTarget);

    const livePose = sampleGameplayCameraPose(ctx, shotFromPos, shotFromTarget);
    shotToPos.copy(livePose.pos);
    shotToTarget.copy(livePose.target);

    // Hide dialogue box smoothly while camera eases back
    isTyping = false;
    syncDomFromState();
  }

  function enterShot(index) {
    const shots = currentDef?.shots;
    if (!Array.isArray(shots) || index >= shots.length) {
      beginReturnEase();
      return;
    }

    shotIndex = index;
    shotElapsed = 0;
    const shot = shots[index] || {};

    // Camera transition endpoints from current camera pose -> shot target pose
    shotFromPos.copy(currentCamPos);
    shotFromTarget.copy(currentCamTarget);
    shotToPos.copy(toVec3(shot.camPos, shotFromPos));
    shotToTarget.copy(toVec3(shot.camTarget, shotFromTarget));

    camEaseElapsed = 0;
    if (typeof shot.camDuration === 'number' && Number.isFinite(shot.camDuration) && shot.camDuration > 0) {
      camEaseDuration = shot.camDuration;
    } else if (typeof shot.duration === 'number' && Number.isFinite(shot.duration) && shot.duration > 0) {
      camEaseDuration = THREE.MathUtils.clamp(shot.duration * 0.35, 0.75, 1.75);
    } else {
      camEaseDuration = DEFAULT_CAM_TRANSITION_SEC;
    }

    // Typewriter initialization
    fullText = typeof shot.text === 'string' ? shot.text : '';
    revealedCount = 0;
    charFloat = 0;
    blipCharAccum = 0;
    isTyping = fullText.length > 0;

    // Trigger shot animations, optional SFX, and onStart hook
    triggerShotAnims(ctx, shot.anims);

    if (typeof shot.sfx === 'string' && shot.sfx.trim()) {
      try {
        ctx?.systems?.audio?.playSfx?.(shot.sfx.trim());
      } catch {
        // Ignore audio errors
      }
    }

    if (typeof shot.onStart === 'function') {
      try {
        shot.onStart(ctx);
      } catch {
        // Never allow a shot callback to soft-lock a cutscene
      }
    }

    syncDomFromState();
  }

  function handleAdvanceInput() {
    if (!active) return;

    if (phase === 'returning') {
      // Allow impatient click/Space during ease-back to complete return cleanly
      if (returnElapsed > 0.12) {
        currentCamPos.copy(shotToPos);
        currentCamTarget.copy(shotToTarget);
        applyCameraTransform();
        finishCutscene(false);
      }
      return;
    }

    if (phase !== 'shots') return;

    if (isTyping) {
      // Instantly complete current typewriter line
      revealedCount = fullText.length;
      charFloat = fullText.length;
      isTyping = false;
      try {
        ctx?.systems?.audio?.playSfx?.('blip');
      } catch {
        // Ignore audio errors
      }
      syncDomFromState();
      return;
    }

    // Advance to next shot (or smooth ease-back after last shot)
    enterShot(shotIndex + 1);
  }

  // Global keyboard handler in capture phase so Space / Enter / Escape never leak to gameplay
  const BLOCKED_GAMEPLAY_CODES = new Set([
    'Space',
    'Enter',
    'Escape',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyQ',
    'KeyE',
    'KeyR',
    'KeyC',
    'KeyU',
    'KeyK',
  ]);

  function onKeyDown(e) {
    if (!active) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const code = e.code || e.key;
    if (code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      if (!e.repeat) skip();
      return;
    }

    if (code === 'Space' || code === 'Enter' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      if (!e.repeat) handleAdvanceInput();
      return;
    }

    if (BLOCKED_GAMEPLAY_CODES.has(code)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
  }

  function onResize() {
    if (!HAS_WINDOW || window.innerHeight <= 0) return;
    cutsceneCam.aspect = window.innerWidth / window.innerHeight;
    cutsceneCam.updateProjectionMatrix();
  }

  if (HAS_WINDOW && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('resize', onResize);
  }

  // Auto-mount overlay on creation in browser environments
  ensureDomMounted();

  // ==========================================================================
  // Public API
  // ==========================================================================

  function playCutscene(def) {
    // If another cutscene is currently running, cleanly finish/resolve it first
    if (active) {
      finishCutscene(true);
    }

    if (!def || !Array.isArray(def.shots) || def.shots.length === 0) {
      if (ctx && typeof ctx === 'object') {
        ctx.cutsceneActive = false;
      }
      return Promise.resolve({ id: def?.id ?? null, skipped: false });
    }

    ensureDomMounted();

    // Update aspect ratio in case window resized prior to launch
    onResize();

    // Initialize cutsceneCam smoothly from active gameplay camera's world pose & lookAt
    const firstShot = def.shots[0] || {};
    const fallbackPos = toVec3(firstShot.camPos, new THREE.Vector3(10, 12, 22));
    const fallbackTarget = toVec3(firstShot.camTarget, new THREE.Vector3(0, 0.8, 10));
    const startPose = sampleGameplayCameraPose(ctx, fallbackPos, fallbackTarget);
    currentCamPos.copy(startPose.pos);
    currentCamTarget.copy(startPose.target);
    applyCameraTransform();

    active = true;
    phase = 'shots';
    currentDef = def;
    shotIndex = -1;

    if (ctx && typeof ctx === 'object') {
      ctx.cutsceneActive = true;
    }

    try {
      ctx?.emit?.('cutscene:start', { id: def.id ?? null, title: def.title ?? '' });
    } catch {
      // Ignore event bus errors
    }

    return new Promise((resolve) => {
      resolveCurrent = resolve;
      enterShot(0);
    });
  }

  function isActive() {
    return active;
  }

  function skip() {
    if (!active) return;
    const livePose = sampleGameplayCameraPose(ctx, currentCamPos, currentCamTarget);
    currentCamPos.copy(livePose.pos);
    currentCamTarget.copy(livePose.target);
    applyCameraTransform();
    finishCutscene(true);
  }

  function update(dt) {
    if (!active) return;

    const safeDt = typeof dt === 'number' && Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;

    if (phase === 'shots') {
      shotElapsed += safeDt;

      // 1. Smoothly ease camera toward current shot's camPos & camTarget
      camEaseElapsed += safeDt;
      const rawT = camEaseDuration > 0 ? camEaseElapsed / camEaseDuration : 1;
      const easedT = smoothstep(rawT);

      tmpDesiredPos.lerpVectors(shotFromPos, shotToPos, easedT);
      tmpDesiredTarget.lerpVectors(shotFromTarget, shotToTarget, easedT);

      // Blend with frame-rate-independent damping for buttery smooth mid-transition cuts
      const dampAlpha = safeDt > 0 ? 1 - Math.exp(-12 * safeDt) : 1;
      currentCamPos.lerp(tmpDesiredPos, dampAlpha);
      currentCamTarget.lerp(tmpDesiredTarget, dampAlpha);
      applyCameraTransform();

      // 2. Advance typewriter at ~42 chars/sec with audio 'blip' every ~3 chars
      if (isTyping && safeDt > 0) {
        charFloat += TYPEWRITER_CHARS_PER_SEC * safeDt;
        const nextCount = Math.min(fullText.length, Math.floor(charFloat));

        if (nextCount > revealedCount) {
          let triggerBlip = false;
          for (let i = revealedCount; i < nextCount; i++) {
            const ch = fullText.charCodeAt(i);
            // Count visible non-whitespace characters toward blip cadence
            if (ch > 32) {
              blipCharAccum += 1;
              if (blipCharAccum >= BLIP_CHAR_INTERVAL) {
                blipCharAccum -= BLIP_CHAR_INTERVAL;
                triggerBlip = true;
              }
            }
          }

          revealedCount = nextCount;
          if (dom.text) {
            dom.text.textContent = fullText.slice(0, revealedCount);
          }

          if (triggerBlip) {
            try {
              ctx?.systems?.audio?.playSfx?.('blip');
            } catch {
              // Ignore audio errors
            }
          }

          if (revealedCount >= fullText.length) {
            isTyping = false;
            syncDomFromState();
          }
        }
      }

      // 3. Auto-advance ONLY for textless scenic shots or shots explicitly marked autoAdvance
      const shot = currentDef?.shots?.[shotIndex];
      const isTextless = fullText.length === 0;
      if (isTextless) {
        const holdSec =
          typeof shot?.duration === 'number' && Number.isFinite(shot.duration) && shot.duration > 0
            ? shot.duration
            : DEFAULT_TEXTLESS_SHOT_SEC;
        if (shotElapsed >= holdSec) {
          enterShot(shotIndex + 1);
        }
      } else if (shot?.autoAdvance === true && !isTyping) {
        const holdSec =
          typeof shot?.duration === 'number' && Number.isFinite(shot.duration) && shot.duration > 0
            ? shot.duration
            : 1.5;
        if (shotElapsed >= holdSec) {
          enterShot(shotIndex + 1);
        }
      }
      return;
    }

    if (phase === 'returning') {
      returnElapsed += safeDt;

      // Refresh live return target in case gameplay camera updated
      const livePose = sampleGameplayCameraPose(ctx, shotToPos, shotToTarget);
      shotToPos.copy(livePose.pos);
      shotToTarget.copy(livePose.target);

      const t = RETURN_EASE_DURATION_SEC > 0 ? returnElapsed / RETURN_EASE_DURATION_SEC : 1;
      const eased = smoothstep(t);
      currentCamPos.lerpVectors(shotFromPos, shotToPos, eased);
      currentCamTarget.lerpVectors(shotFromTarget, shotToTarget, eased);
      applyCameraTransform();

      if (returnElapsed >= RETURN_EASE_DURATION_SEC) {
        currentCamPos.copy(shotToPos);
        currentCamTarget.copy(shotToTarget);
        applyCameraTransform();
        finishCutscene(false);
      }
    }
  }

  function getCamera() {
    return cutsceneCam;
  }

  return {
    playCutscene,
    isActive,
    skip,
    update,
    getCamera,
  };
}
