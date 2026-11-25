import './style.css';
import './ui/hud.css';
import hudHtml from './ui/hud.html?raw';
import { initGame } from './game.js';

// Mount Phase 1 HUD overlay verbatim over #game-canvas
const hudMount = document.getElementById('hud-mount');
hudMount.innerHTML = hudHtml;

// Inject clean numeric readouts onto HP & Stamina gauges without modifying hud.html
function attachGaugeBadge(gaugeId, badgeId) {
  const gauge = document.getElementById(gaugeId);
  if (!gauge) return null;
  const cavity = gauge.querySelector('.hud-gauge-cavity') || gauge;
  let badge = document.getElementById(badgeId);
  if (!badge) {
    badge = document.createElement('span');
    badge.id = badgeId;
    badge.className = 'hud-gauge-num';
    cavity.appendChild(badge);
  }
  return badge;
}

const hpNumEl = attachGaugeBadge('hud-hp-gauge', 'hud-hp-num');
const stamNumEl = attachGaugeBadge('hud-stamina-gauge', 'hud-stamina-num');

const hudRootEl = document.getElementById('hud-root');
const hpGaugeEl = document.getElementById('hud-hp-gauge');
const stamGaugeEl = document.getElementById('hud-stamina-gauge');
const tooltipEl = document.getElementById('hud-item-tooltip');
const minimapCanvas = document.getElementById('hud-minimap');
const slotButtons = Array.from(document.querySelectorAll('.hud-slot'));

const radialBtns = {
  companions: document.getElementById('hud-action-monkey'),
  craft: document.getElementById('hud-action-craft'),
  build: document.getElementById('hud-action-build'),
};

const popovers = {
  companions: document.getElementById('popover-companions'),
  craft: document.getElementById('popover-craft'),
  build: document.getElementById('popover-build'),
};

const panelBodies = {
  companions: document.getElementById('companions-panel-body'),
  craft: document.getElementById('craft-panel-body'),
  build: document.getElementById('build-panel-body'),
};

const zoneBadgeEl = document.getElementById('zone-badge');
const sweepWarningChipEl = document.getElementById('sweep-warning-chip');
const alertGroupEl = document.getElementById('fbi-alert-group');
const alertTrackEl = document.getElementById('fbi-alert-track');
const alertFillEl = document.getElementById('fbi-alert-fill');
const alertTextEl = document.getElementById('fbi-alert-text');
const statusChipsEl = document.getElementById('status-chips');

const btnAudioToggle = document.getElementById('btn-audio-toggle');
const btnCamToggle = document.getElementById('btn-cam-toggle');
const btnTestDeath = document.getElementById('btn-test-death');
const btnHelpToggle = document.getElementById('btn-help-toggle');
const btnHelpClose = document.getElementById('btn-help-close');
const helpCardEl = document.getElementById('controls-help-card');

const toastStackEl = document.getElementById('toast-stack');
const promptEl = document.getElementById('context-prompt');
const damageVignetteEl = document.getElementById('damage-vignette');
const loadingOverlayEl = document.getElementById('loading-overlay');
const loadingStatusEl = document.getElementById('loading-status');

const EXPANDED_USABLE_IDS = new Set([
  'camo_bush',
  'emp_grenade',
  'banana_smoothie',
  'blowpipe',
]);

// Crisp cel-shaded SVG icons for all survival items & Phase 3 expanded gear/blueprints
const ITEM_ICONS = {
  axe: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(-38 18 18)">
      <rect x="16" y="10" width="4.2" height="20" rx="1.8" fill="#b8783e" stroke="#181c20" stroke-width="2" />
      <path d="M19 9h7.5c2 2.2 2 6.8 0 9H19z" fill="#8b9aa6" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M24.2 10.5c1.2 1.8 1.2 5.2 0 7" fill="none" stroke="#dce6ee" stroke-width="1.6" stroke-linecap="round" />
    </g>
  </svg>`,
  pickaxe: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(-38 18 18)">
      <rect x="16" y="10" width="4" height="20" rx="1.8" fill="#a86d38" stroke="#181c20" stroke-width="2" />
      <path d="M7 13c4-5 18-5 22 0l-2.5 3.6c-4-3.2-13-3.2-17 0z" fill="#7f8f9e" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M11 11.5c4-2 10-2 14 0" fill="none" stroke="#dbe5ee" stroke-width="1.5" stroke-linecap="round" />
    </g>
  </svg>`,
  wooden_club: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(40 18 18)">
      <path d="M15.5 29h5l1.8-13.5c0.6-3.8-1.2-7.5-4.3-7.5s-4.9 3.7-4.3 7.5z" fill="#8f5626" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
      <circle cx="15.2" cy="12.5" r="1.7" fill="#d9a566" stroke="#181c20" stroke-width="1.2" />
      <circle cx="20.6" cy="14.5" r="1.7" fill="#d9a566" stroke="#181c20" stroke-width="1.2" />
      <rect x="15.2" y="23.5" width="5.6" height="2.6" fill="#4fa642" stroke="#181c20" stroke-width="1.2" />
    </g>
  </svg>`,
  club: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(42 18 18)">
      <rect x="15.5" y="12" width="5" height="17" rx="2" fill="#9c6230" stroke="#181c20" stroke-width="2.2" />
      <rect x="11" y="7" width="14" height="7" rx="2.5" fill="#7d4a21" stroke="#181c20" stroke-width="2.2" />
    </g>
  </svg>`,
  stone_spear: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(42 18 18)">
      <rect x="16.4" y="12" width="3.2" height="19" rx="1.4" fill="#a86d38" stroke="#181c20" stroke-width="1.9" />
      <polygon points="18,4 22.5,13 18,15.5 13.5,13" fill="#94a3b8" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
      <line x1="18" y1="6" x2="18" y2="13.5" stroke="#e2e8f0" stroke-width="1.4" stroke-linecap="round" />
      <rect x="15.5" y="13.5" width="5" height="2.6" rx="1" fill="#4fa642" stroke="#181c20" stroke-width="1.2" />
    </g>
  </svg>`,
  blowpipe: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(-38 18 18)">
      <rect x="5" y="15.5" width="21" height="5" rx="2" fill="#74b83e" stroke="#181c20" stroke-width="2" />
      <line x1="11" y1="15.5" x2="11" y2="20.5" stroke="#36691e" stroke-width="1.8" />
      <line x1="18" y1="15.5" x2="18" y2="20.5" stroke="#36691e" stroke-width="1.8" />
      <polygon points="27,16 33,18 27,20" fill="#22d3ee" stroke="#181c20" stroke-width="1.6" stroke-linejoin="round" />
      <circle cx="29" cy="14" r="1.4" fill="#67e8f9" />
    </g>
  </svg>`,
  camo_bush: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M7 25c-2-5 1-11 6-12 2-4 8-5 11-1 5 0 8 5 6 11-1 3-3 4-6 4H12c-3 0-4-1-5-2z" fill="#3a9438" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <path d="M12 14c3-2 7-2 10 0" fill="none" stroke="#8ce96c" stroke-width="2" stroke-linecap="round" />
    <ellipse cx="14.5" cy="21" rx="2.1" ry="1.8" fill="#fffdf4" stroke="#181c20" stroke-width="1.3" />
    <ellipse cx="21.5" cy="21" rx="2.1" ry="1.8" fill="#fffdf4" stroke="#181c20" stroke-width="1.3" />
    <circle cx="15" cy="21" r="0.9" fill="#181c20" />
    <circle cx="22" cy="21" r="0.9" fill="#181c20" />
  </svg>`,
  emp_grenade: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="15" y="6" width="6" height="4.5" rx="1.5" fill="#facc15" stroke="#181c20" stroke-width="1.8" />
    <circle cx="18" cy="20" r="10" fill="#1e3a5f" stroke="#181c20" stroke-width="2.2" />
    <circle cx="18" cy="20" r="7.2" fill="#06b6d4" opacity="0.45" />
    <polygon points="19,13 14.5,20.5 18.2,20.5 17,27 22,19 18.4,19" fill="#fde047" stroke="#181c20" stroke-width="1.3" stroke-linejoin="round" />
  </svg>`,
  banana_smoothie: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M21 6l3 7" stroke="#f43f5e" stroke-width="2.4" stroke-linecap="round" />
    <path d="M11 14h14l-1.8 14.5c-0.2 1.2-1.1 2-2.2 2h-6c-1.1 0-2-0.8-2.2-2z" fill="#fde047" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <ellipse cx="18" cy="14" rx="7.5" ry="2.6" fill="#fef08a" stroke="#181c20" stroke-width="1.8" />
    <path d="M13 21c2.5 1.5 7.5 1.5 10 0" fill="none" stroke="#4ade80" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="13.5" cy="11.5" r="2.2" fill="#f43f5e" stroke="#181c20" stroke-width="1.4" />
  </svg>`,
  fish: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M7 18c4-7 13-8 19-2l4-4v12l-4-4c-6 6-15 5-19-2z" fill="#38bdf8" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <path d="M12 15c3-2 7-2 10 0" fill="none" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="12.5" cy="17.5" r="1.7" fill="#181c20" />
  </svg>`,
  fish_bait: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M8 19c4-6 12-7 17-2l4-3v10l-4-3c-5 5-13 4-17-2z" fill="#22d3ee" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <circle cx="13" cy="18.5" r="1.6" fill="#181c20" />
  </svg>`,
  meat: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M10 26l6-6" stroke="#f0e8d5" stroke-width="4" stroke-linecap="round" />
    <circle cx="8.5" cy="27.5" r="2.5" fill="#f0e8d5" stroke="#181c20" stroke-width="1.6" />
    <ellipse cx="21" cy="15" rx="8.5" ry="6.5" transform="rotate(-35 21 15)" fill="#c93b2b" stroke="#181c20" stroke-width="2.2" />
    <ellipse cx="19.5" cy="13.5" rx="3.2" ry="1.8" transform="rotate(-35 19.5 13.5)" fill="#f08070" />
  </svg>`,
  wood: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(-24 18 18)">
      <rect x="7" y="13" width="22" height="10" rx="4" fill="#9c6230" stroke="#181c20" stroke-width="2.2" />
      <ellipse cx="26.5" cy="18" rx="3.2" ry="4.8" fill="#d9a566" stroke="#181c20" stroke-width="2" />
      <path d="M11 16.5h10M12 20h8" stroke="#6b401b" stroke-width="1.6" stroke-linecap="round" />
    </g>
  </svg>`,
  stone: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <polygon points="8,25 11,13 21,9 29,17 26,27 14,28" fill="#7c8792" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <polygon points="11,13 21,9 23,17 13,18" fill="#a5b1bc" />
  </svg>`,
  fiber: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M8 26C10 14 19 8 28 9c-1 10-7 17-18 18z" fill="#4fa642" stroke="#181c20" stroke-width="2.2" stroke-linejoin="round" />
    <path d="M9 26C15 20 21 15 27 10" fill="none" stroke="#9be063" stroke-width="2" stroke-linecap="round" />
  </svg>`,
  berries: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M18 13c2-4 6-5 8-4-1 3-4 5-8 4z" fill="#4fa642" stroke="#181c20" stroke-width="1.8" />
    <circle cx="14" cy="21" r="5.5" fill="#d6336c" stroke="#181c20" stroke-width="2.2" />
    <circle cx="22.5" cy="21.5" r="5.5" fill="#e64980" stroke="#181c20" stroke-width="2.2" />
    <circle cx="18" cy="15.5" r="5" fill="#f06595" stroke="#181c20" stroke-width="2.2" />
    <circle cx="16.5" cy="14" r="1.4" fill="#ffdeeb" />
  </svg>`,
  bandages: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="8" y="10" width="20" height="16" rx="4" fill="#f5f1e6" stroke="#181c20" stroke-width="2.2" />
    <path d="M18 13v10M13 18h10" stroke="#e03131" stroke-width="3.2" stroke-linecap="round" />
  </svg>`,
  tranq_darts: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <g transform="rotate(-40 18 18)">
      <rect x="11" y="16" width="15" height="4" rx="1.5" fill="#22d3ee" stroke="#181c20" stroke-width="2" />
      <polygon points="26,15 32,18 26,21" fill="#e2e8f0" stroke="#181c20" stroke-width="1.8" stroke-linejoin="round" />
      <polygon points="6,14 12,18 6,22" fill="#f43f5e" stroke="#181c20" stroke-width="1.8" stroke-linejoin="round" />
    </g>
  </svg>`,
  campfire: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <path d="M18 7c5 5 8 10 6 16-2 3-10 3-12 0-2-6 1-11 6-16z" fill="#ff6b1a" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
    <path d="M18 13c2.5 3 3.5 6 2 9-1.2 1.5-2.8 1.5-4 0-1.5-3-0.5-6 2-9z" fill="#ffe047" />
    <line x1="8" y1="27" x2="28" y2="23" stroke="#8f5626" stroke-width="3.5" stroke-linecap="round" />
    <line x1="8" y1="23" x2="28" y2="27" stroke="#6b401b" stroke-width="3.5" stroke-linecap="round" />
  </svg>`,
  bed: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="6" y="18" width="24" height="9" rx="2.5" fill="#8f5626" stroke="#181c20" stroke-width="2" />
    <rect x="8" y="14" width="20" height="7" rx="2" fill="#4fa642" stroke="#181c20" stroke-width="1.8" />
    <rect x="9" y="11" width="7" height="5" rx="2" fill="#f5eedc" stroke="#181c20" stroke-width="1.6" />
  </svg>`,
  spike_wall: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <polygon points="8,28 11,9 14,28" fill="#9c6230" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
    <polygon points="15,28 18,7 21,28" fill="#b3743b" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
    <polygon points="22,28 25,9 28,28" fill="#9c6230" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
    <rect x="6" y="20" width="24" height="4" rx="1.2" fill="#6b401b" stroke="#181c20" stroke-width="1.6" />
  </svg>`,
  workbench: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="6" y="12" width="24" height="6" rx="1.8" fill="#b3743b" stroke="#181c20" stroke-width="2" />
    <rect x="9" y="18" width="4" height="11" fill="#6b401b" stroke="#181c20" stroke-width="1.8" />
    <rect x="23" y="18" width="4" height="11" fill="#6b401b" stroke="#181c20" stroke-width="1.8" />
    <rect x="11" y="9" width="9" height="4" rx="1" fill="#3b82f6" stroke="#181c20" stroke-width="1.4" />
  </svg>`,
  snare_trap: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <ellipse cx="18" cy="21" rx="11" ry="6.5" fill="none" stroke="#eab308" stroke-width="3" />
    <ellipse cx="18" cy="21" rx="11" ry="6.5" fill="none" stroke="#181c20" stroke-width="1.2" stroke-dasharray="3 2" />
    <path d="M10 15l3 4M26 15l-3 4M18 11v5" stroke="#cbd5e1" stroke-width="2.2" stroke-linecap="round" />
  </svg>`,
  coconut_turret: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <polygon points="10,29 14,19 22,19 26,29" fill="#7c8792" stroke="#181c20" stroke-width="2" stroke-linejoin="round" />
    <rect x="12" y="11" width="16" height="7" rx="2.5" fill="#74b83e" stroke="#181c20" stroke-width="2" />
    <circle cx="28" cy="14.5" r="3.2" fill="#7d4a21" stroke="#181c20" stroke-width="1.8" />
  </svg>`,
  reinforced_wall: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="6" y="10" width="24" height="18" rx="2.5" fill="#7c8792" stroke="#181c20" stroke-width="2.2" />
    <path d="M6 16h24M6 22h24M14 10v6M22 16v6M14 22v6" stroke="#181c20" stroke-width="1.8" />
    <rect x="9" y="12" width="18" height="2.4" fill="#38bdf8" opacity="0.85" />
  </svg>`,
  default: `<svg class="hud-slot-icon" viewBox="0 0 36 36" aria-hidden="true">
    <rect x="9" y="9" width="18" height="18" rx="4" fill="#d4b06a" stroke="#181c20" stroke-width="2.2" />
    <circle cx="18" cy="18" r="3.5" fill="#fffdf4" />
  </svg>`,
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getItemIcon(item) {
  if (!item) return '';
  const id = (typeof item === 'string' ? item : item.id || '').toLowerCase();
  if (ITEM_ICONS[id]) return ITEM_ICONS[id];
  if (id.includes('pick')) return ITEM_ICONS.pickaxe;
  if (id.includes('axe')) return ITEM_ICONS.axe;
  if (id.includes('spear')) return ITEM_ICONS.stone_spear;
  if (id.includes('blowpipe')) return ITEM_ICONS.blowpipe;
  if (id.includes('camo') || id.includes('bush')) return ITEM_ICONS.camo_bush;
  if (id.includes('emp') || id.includes('grenade')) return ITEM_ICONS.emp_grenade;
  if (id.includes('smoothie') || id.includes('banana')) return ITEM_ICONS.banana_smoothie;
  if (id.includes('club')) return ITEM_ICONS.wooden_club;
  if (id.includes('fish')) return ITEM_ICONS.fish;
  if (id.includes('meat')) return ITEM_ICONS.meat;
  if (id.includes('wood')) return ITEM_ICONS.wood;
  if (id.includes('stone')) return ITEM_ICONS.stone;
  if (id.includes('fiber')) return ITEM_ICONS.fiber;
  if (id.includes('berr')) return ITEM_ICONS.berries;
  if (id.includes('band')) return ITEM_ICONS.bandages;
  if (id.includes('tranq') || id.includes('dart')) return ITEM_ICONS.tranq_darts;
  if (id.includes('turret') || id.includes('coconut')) return ITEM_ICONS.coconut_turret;
  if (id.includes('snare') || id.includes('trap')) return ITEM_ICONS.snare_trap;
  if (id.includes('spike')) return ITEM_ICONS.spike_wall;
  if (id.includes('reinforced') || id.includes('wall')) return ITEM_ICONS.reinforced_wall;
  if (id.includes('campfire')) return ITEM_ICONS.campfire;
  if (id.includes('bed')) return ITEM_ICONS.bed;
  if (id.includes('workbench')) return ITEM_ICONS.workbench;
  return ITEM_ICONS.default;
}

// Toast notification stack
function showToast(msg, tone = 'info') {
  if (!toastStackEl || !msg) return;
  const item = document.createElement('div');
  item.className = `toast-item toast-item--${tone}`;
  item.textContent = msg;
  toastStackEl.appendChild(item);

  while (toastStackEl.children.length > 4) {
    toastStackEl.firstElementChild?.remove();
  }

  window.setTimeout(() => {
    item.classList.add('is-leaving');
    window.setTimeout(() => item.remove(), 240);
  }, 3400);
}

// Bottom-center contextual prompt pill
let externalPromptText = '';
function setContextPrompt(text) {
  externalPromptText = text || '';
  if (!promptEl) return;
  if (!text) {
    promptEl.classList.add('is-hidden');
    promptEl.textContent = '';
  } else {
    promptEl.textContent = text;
    promptEl.classList.remove('is-hidden');
  }
}

// Brief screen-edge red flash on taking damage
let flashTimer = null;
function triggerDamageFlash() {
  if (!damageVignetteEl) return;
  damageVignetteEl.classList.add('is-flashing');
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    damageVignetteEl.classList.remove('is-flashing');
  }, 180);
}

// Live Circular Minimap Renderer (delegates to expanded Fog-of-War island map)
function renderMinimap(ctx) {
  if (!minimapCanvas || !ctx) return;

  if (typeof ctx.world?.drawMinimap === 'function') {
    ctx.world.drawMinimap(minimapCanvas, ctx);
    return;
  }

  // Fallback minimap if world.drawMinimap is unavailable
  const c = minimapCanvas.getContext('2d');
  if (!c) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const bounds = ctx.worldBounds || { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const toX = (wx) => ((wx - bounds.minX) / spanX) * w;
  const toY = (wz) => ((wz - bounds.minZ) / spanZ) * h;

  c.clearRect(0, 0, w, h);
  c.fillStyle = '#3c6e32';
  c.fillRect(0, 0, w, h);

  if (ctx.player?.pos) {
    c.beginPath();
    c.arc(toX(ctx.player.pos.x), toY(ctx.player.pos.z), 4.6, 0, Math.PI * 2);
    c.fillStyle = '#e879b9';
    c.fill();
    c.lineWidth = 1.8;
    c.strokeStyle = '#ffffff';
    c.stroke();
  }
}

// Active Radial Popover State
let activeMenu = null; // null | 'companions' | 'craft' | 'build'
let activeTierFilter = { craft: 'all', build: 'all' }; // 'all' | 1 | 2 | 3
let gameRef = null;
let lastPopoverSig = '';

function setActiveMenu(menu) {
  if (gameRef?.ctx?.cutsceneActive) return;
  activeMenu = activeMenu === menu ? null : menu;
  lastPopoverSig = '';
  for (const [key, btn] of Object.entries(radialBtns)) {
    btn?.classList.toggle('is-active', activeMenu === key);
  }
  for (const [key, el] of Object.entries(popovers)) {
    el?.classList.toggle('is-hidden', activeMenu !== key);
  }
  if (gameRef?.ctx) {
    renderActivePopover(gameRef.ctx, true);
  }
}

function closeMenus() {
  if (!activeMenu) return;
  activeMenu = null;
  lastPopoverSig = '';
  for (const btn of Object.values(radialBtns)) btn?.classList.remove('is-active');
  for (const el of Object.values(popovers)) el?.classList.add('is-hidden');
}

function normalizeTieredEntries(rawList, smuffRescued) {
  if (!rawList) return [];
  let flat = [];
  if (Array.isArray(rawList)) {
    flat = rawList;
  } else if (typeof rawList === 'object') {
    for (const [k, v] of Object.entries(rawList)) {
      if (Array.isArray(v)) {
        const inferredTier = Number(String(k).replace(/\D/g, '')) || 1;
        for (const entry of v) {
          flat.push({ tier: inferredTier, ...entry });
        }
      }
    }
  }
  return flat.map((entry) => {
    const tier = Number(entry.tier) || 1;
    const requiresSmuff = Boolean(entry.requiresSmuff ?? tier === 3);
    const locked = entry.locked !== undefined ? Boolean(entry.locked) : requiresSmuff && !smuffRescued;
    const unlocked = entry.unlocked !== undefined ? Boolean(entry.unlocked) : !locked;
    return {
      ...entry,
      tier,
      tierName:
        entry.tierName ||
        (tier === 1 ? 'Starter' : tier === 2 ? 'Jungle Stealth' : 'Smuff Tech'),
      requiresSmuff,
      locked,
      unlocked,
    };
  });
}

function renderTierTabsHtml(menuKey, currentFilter, smuffRescued) {
  const tabs = [
    { key: 'all', label: 'ALL' },
    { key: '1', label: 'T1' },
    { key: '2', label: 'T2' },
    { key: '3', label: smuffRescued ? 'T3 ✓' : 'T3 🔒' },
  ];
  return `
    <div class="tier-tabs" role="tablist" aria-label="Tier Filter">
      ${tabs
        .map((t) => {
          const isAct = String(currentFilter) === t.key;
          return `<button type="button" class="tier-tab-btn ${isAct ? 'is-active' : ''}" data-tier-tab="${t.key}" data-tier-menu="${menuKey}" role="tab" aria-selected="${isAct ? 'true' : 'false'}">${t.label}</button>`;
        })
        .join('')}
    </div>
  `;
}

function renderTierHeaderHtml(tier, smuffRescued) {
  if (tier === 1) {
    return `<div class="tier-section-header"><span>Tier 1 — Starter</span><span>Unlocked</span></div>`;
  }
  if (tier === 2) {
    return `<div class="tier-section-header tier-section-header--t2"><span>Tier 2 — Jungle Stealth</span><span>Unlocked</span></div>`;
  }
  if (smuffRescued) {
    return `<div class="tier-section-header tier-section-header--t3"><span>Tier 3 — Smuff Tech</span><span>✓ Unlocked</span></div>`;
  }
  return `<div class="tier-section-header tier-section-header--locked"><span>Tier 3 — Smuff Tech 🔒</span><span>Rescue Smuff</span></div>`;
}

function renderActivePopover(ctx, force = false) {
  if (!activeMenu || !ctx?.systems) return;

  if (activeMenu === 'companions') {
    const status = ctx.systems.companions?.getStatus?.() || {
      dosMode: ctx.companions.dos.mode,
      detectionMultiplier: ctx.companions.dos.detectionMultiplier,
      decoyCooldown: 0,
      decoyActive: Boolean(ctx.companions.dos.decoyPos && ctx.companions.dos.decoyTimer > 0),
      crockstarTamed: ctx.companions.crockstar.tamed,
      crockstarMode: ctx.companions.crockstar.mode,
      crockstarHp: Math.round(ctx.companions.crockstar.hp),
      crockstarMaxHp: Math.round(ctx.companions.crockstar.maxHp),
    };
    const smuffRescued = Boolean(ctx.fbi?.smuff?.rescued);
    const sig = JSON.stringify([status, smuffRescued]);
    if (!force && sig === lastPopoverSig) return;
    lastPopoverSig = sig;

    const decoyDisabled = status.decoyActive || status.decoyCooldown > 0;
    const decoyLabel = status.decoyActive
      ? 'Decoy Active!'
      : status.decoyCooldown > 0
      ? `Decoy (${Math.ceil(status.decoyCooldown)}s)`
      : 'Deploy Decoy Beacon';

    const crockHpPct = Math.max(
      0,
      Math.min(100, (status.crockstarHp / (status.crockstarMaxHp || 160)) * 100)
    );

    panelBodies.companions.innerHTML = `
      <div class="panel-card">
        <div class="panel-card-top">
          <span class="panel-card-title">Dos (FBI Double Agent)</span>
          <span class="panel-badge ${status.dosMode === 'undercover' ? 'panel-badge--cyan' : 'panel-badge--gold'}">
            ${status.dosMode === 'undercover' ? 'Undercover -50%' : escapeHtml(status.dosMode)}
          </span>
        </div>
        <div class="panel-card-desc">Shrinks FBI detection radius by 50% in Undercover Mode or lures patrols with a Decoy Beacon.</div>
        <div class="panel-btn-row">
          <button type="button" class="panel-action-btn ${status.dosMode === 'follow' ? 'is-active' : ''}" data-dos-mode="follow">Follow</button>
          <button type="button" class="panel-action-btn ${status.dosMode === 'undercover' ? 'is-active' : ''}" data-dos-mode="undercover">Undercover (-50%)</button>
        </div>
        <div class="panel-btn-row">
          <button type="button" class="panel-action-btn panel-action-btn--accent" data-dos-decoy ${decoyDisabled ? 'disabled' : ''}>${decoyLabel}</button>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-card-top">
          <span class="panel-card-title">Crockstar (Lagoon Croc)</span>
          <span class="panel-badge ${status.crockstarTamed ? 'panel-badge--green' : 'panel-badge--muted'}">
            ${status.crockstarTamed ? escapeHtml(status.crockstarMode) : 'Wild'}
          </span>
        </div>
        ${
          status.crockstarTamed
            ? `
          <div class="panel-card-desc">HP: ${status.crockstarHp} / ${status.crockstarMaxHp} • Swims deep water &amp; tanks FBI / Director Vance.</div>
          <div class="mini-hp-bar"><div class="mini-hp-fill" style="width:${crockHpPct}%"></div></div>
          <div class="panel-btn-row">
            <button type="button" class="panel-action-btn ${status.crockstarMode === 'follow' ? 'is-active' : ''}" data-crock-mode="follow">Follow</button>
            <button type="button" class="panel-action-btn ${status.crockstarMode === 'attack' ? 'is-active' : ''}" data-crock-mode="attack">Attack FBI</button>
            <button type="button" class="panel-action-btn ${status.crockstarMode === 'sit' ? 'is-active' : ''}" data-crock-mode="sit">Sit</button>
          </div>
        `
            : `
          <div class="panel-card-desc">Wild at the East Sunken Lagoon. Walk close with Raw Fish or Meat and press <strong>[F]</strong> to tame!</div>
          <div class="panel-btn-row">
            <button type="button" class="panel-action-btn panel-action-btn--primary" data-crock-tame>Feed &amp; Tame (Nearby)</button>
          </div>
        `
        }
      </div>

      <div class="panel-card">
        <div class="panel-card-top">
          <span class="panel-card-title">Smuff (Master Crafter)</span>
          <span class="panel-badge ${smuffRescued ? 'panel-badge--blue' : 'panel-badge--muted'}">
            ${smuffRescued ? 'Tier 3 +35% Speed' : 'Captive'}
          </span>
        </div>
        <div class="panel-card-desc">
          ${
            smuffRescued
              ? 'Rescued! Tier 3 Smuff Tech (EMP Grenades, Coconut Turrets, Banana Smoothies) &amp; +35% speed active.'
              : 'Held in the West FBI Forward Camp cage. Sneak in undetected and press <strong>[F]</strong> to rescue him &amp; unlock Tier 3 Tech!'
          }
        </div>
      </div>
    `;
    return;
  }

  if (activeMenu === 'craft') {
    const smuffRescued = Boolean(ctx.fbi?.smuff?.rescued);
    const smuffBoost = (ctx.player.craftSpeedMultiplier || 1) > 1.05;
    const rawRecipes =
      ctx.systems.crafting?.getTieredRecipes?.() || ctx.systems.player?.getRecipes?.() || [];
    const recipes = normalizeTieredEntries(rawRecipes, smuffRescued);
    const tierFilter = activeTierFilter.craft;

    const sig = JSON.stringify([recipes, smuffRescued, smuffBoost, tierFilter]);
    if (!force && sig === lastPopoverSig) return;
    lastPopoverSig = sig;

    const headerBanner = smuffBoost
      ? `<div class="panel-card"><div class="panel-card-top"><span class="panel-card-title">Smuff Workshop Bonus</span><span class="panel-badge panel-badge--blue">+35% Speed &amp; T3 Unlocked</span></div></div>`
      : '';

    const tiersToRender = tierFilter === 'all' ? [1, 2, 3] : [Number(tierFilter)];
    const sectionsHtml = tiersToRender
      .map((tierNum) => {
        const items = recipes.filter((r) => r.tier === tierNum);
        if (items.length === 0) return '';
        const cards = items
          .map((r) => {
            const ings = (r.ingredients || [])
              .map((ing) => {
                const have = ing.have ?? ctx.player.countItem(ing.id);
                const ok = have >= ing.count;
                return `<span class="ingredient-pill ${ok ? 'ingredient-pill--ok' : 'ingredient-pill--short'}">${escapeHtml(ing.name || ing.id)} ${have}/${ing.count}</span>`;
              })
              .join('');

            const iconId = r.output?.id || r.id;
            let badgeHtml;
            if (r.locked) {
              badgeHtml = `<span class="panel-badge panel-badge--gold">🔒 Smuff Tech</span>`;
            } else if (r.requiresWorkbench) {
              badgeHtml = `<span class="panel-badge ${r.workbenchReady ? 'panel-badge--green' : 'panel-badge--gold'}">${r.workbenchReady ? 'Workbench OK' : 'Needs Workbench'}</span>`;
            } else {
              badgeHtml = `<span class="panel-badge panel-badge--muted">${r.effectiveTime ?? r.craftTime ?? 1.2}s</span>`;
            }

            const canCraft = !r.locked && (r.canCraft !== undefined ? r.canCraft : r.canAfford !== false);
            return `
              <div class="panel-card ${r.locked ? 'panel-card--locked' : ''}">
                <div class="panel-card-top">
                  <div class="panel-card-heading">
                    <span class="panel-card-icon">${getItemIcon(iconId)}</span>
                    <span class="panel-card-title">${escapeHtml(r.name)}</span>
                  </div>
                  ${badgeHtml}
                </div>
                <div class="panel-card-desc">${escapeHtml(r.description || '')}</div>
                <div class="ingredient-list">${ings}</div>
                <div class="panel-btn-row">
                  <button type="button" class="panel-action-btn panel-action-btn--primary" data-craft-id="${escapeHtml(r.id)}" ${canCraft ? '' : 'disabled'}>
                    ${r.locked ? '🔒 Rescue Smuff First' : 'Craft'}
                  </button>
                </div>
              </div>
            `;
          })
          .join('');
        return `${renderTierHeaderHtml(tierNum, smuffRescued)}${cards}`;
      })
      .join('');

    panelBodies.craft.innerHTML =
      renderTierTabsHtml('craft', tierFilter, smuffRescued) + headerBanner + sectionsHtml;
    return;
  }

  if (activeMenu === 'build') {
    const smuffRescued = Boolean(ctx.fbi?.smuff?.rescued);
    const rawBlueprints =
      ctx.systems.crafting?.getTieredBlueprints?.() || ctx.systems.player?.getBlueprints?.() || [];
    const blueprints = normalizeTieredEntries(rawBlueprints, smuffRescued);
    const placing = Boolean(
      ctx.systems.crafting?.isPlacingBlueprint?.() || ctx.systems.player?.isPlacingBlueprint?.()
    );
    const tierFilter = activeTierFilter.build;

    const sig = JSON.stringify([blueprints, smuffRescued, placing, tierFilter]);
    if (!force && sig === lastPopoverSig) return;
    lastPopoverSig = sig;

    const cancelBanner = placing
      ? `<div class="panel-card"><div class="panel-btn-row"><button type="button" class="panel-action-btn" data-cancel-blueprint>Cancel Active Ghost Placement (Esc)</button></div></div>`
      : '';

    const tiersToRender = tierFilter === 'all' ? [1, 2, 3] : [Number(tierFilter)];
    const sectionsHtml = tiersToRender
      .map((tierNum) => {
        const items = blueprints.filter((bp) => bp.tier === tierNum);
        if (items.length === 0) return '';
        const cards = items
          .map((bp) => {
            const ings = (bp.ingredients || [])
              .map((ing) => {
                const have = ing.have ?? ctx.player.countItem(ing.id);
                const ok = have >= ing.count;
                return `<span class="ingredient-pill ${ok ? 'ingredient-pill--ok' : 'ingredient-pill--short'}">${escapeHtml(ing.name || ing.id)} ${have}/${ing.count}</span>`;
              })
              .join('');

            let badgeHtml;
            if (bp.locked) {
              badgeHtml = `<span class="panel-badge panel-badge--gold">🔒 Smuff Tech</span>`;
            } else if (bp.isRespawnPoint) {
              badgeHtml = `<span class="panel-badge panel-badge--gold">Respawn Point</span>`;
            } else {
              badgeHtml = `<span class="panel-badge panel-badge--muted">${bp.effectiveTime ?? bp.buildTime ?? 1.4}s</span>`;
            }

            const canPlace = !bp.locked && bp.canAfford !== false;
            return `
              <div class="panel-card ${bp.locked ? 'panel-card--locked' : ''}">
                <div class="panel-card-top">
                  <div class="panel-card-heading">
                    <span class="panel-card-icon">${getItemIcon(bp.id)}</span>
                    <span class="panel-card-title">${escapeHtml(bp.name)}</span>
                  </div>
                  ${badgeHtml}
                </div>
                <div class="panel-card-desc">${escapeHtml(bp.description || '')}</div>
                <div class="ingredient-list">${ings}</div>
                <div class="panel-btn-row">
                  <button type="button" class="panel-action-btn panel-action-btn--accent" data-blueprint-id="${escapeHtml(bp.id)}" ${canPlace ? '' : 'disabled'}>
                    ${bp.locked ? '🔒 Rescue Smuff First' : 'Place 3D Blueprint'}
                  </button>
                </div>
              </div>
            `;
          })
          .join('');
        return `${renderTierHeaderHtml(tierNum, smuffRescued)}${cards}`;
      })
      .join('');

    panelBodies.build.innerHTML =
      renderTierTabsHtml('build', tierFilter, smuffRescued) + cancelBanner + sectionsHtml;
  }
}

// Event delegation for popover action buttons
panelBodies.companions?.addEventListener('click', (e) => {
  const ctx = gameRef?.ctx;
  if (!ctx?.systems?.companions) return;
  ctx.systems.audio?.unlock?.();

  const dosModeBtn = e.target.closest('[data-dos-mode]');
  if (dosModeBtn) {
    ctx.systems.companions.setDosMode(dosModeBtn.dataset.dosMode);
    renderActivePopover(ctx, true);
    return;
  }
  if (e.target.closest('[data-dos-decoy]')) {
    ctx.systems.companions.deployDecoyBeacon();
    renderActivePopover(ctx, true);
    return;
  }
  const crockModeBtn = e.target.closest('[data-crock-mode]');
  if (crockModeBtn) {
    ctx.systems.companions.commandCrockstar(crockModeBtn.dataset.crockMode);
    renderActivePopover(ctx, true);
    return;
  }
  if (e.target.closest('[data-crock-tame]')) {
    ctx.systems.companions.tryTameCrockstar();
    renderActivePopover(ctx, true);
  }
});

panelBodies.craft?.addEventListener('click', (e) => {
  const ctx = gameRef?.ctx;
  if (!ctx) return;
  ctx.systems.audio?.unlock?.();

  const tabBtn = e.target.closest('[data-tier-tab]');
  if (tabBtn) {
    activeTierFilter.craft = tabBtn.dataset.tierTab;
    renderActivePopover(ctx, true);
    return;
  }

  const btn = e.target.closest('[data-craft-id]');
  if (!btn) return;
  const id = btn.dataset.craftId;
  if (typeof ctx.systems.crafting?.craftItem === 'function') {
    ctx.systems.crafting.craftItem(id);
  } else if (typeof ctx.systems.player?.craftRecipe === 'function') {
    ctx.systems.player.craftRecipe(id);
  }
  renderActivePopover(ctx, true);
});

panelBodies.build?.addEventListener('click', (e) => {
  const ctx = gameRef?.ctx;
  if (!ctx) return;
  ctx.systems.audio?.unlock?.();

  const tabBtn = e.target.closest('[data-tier-tab]');
  if (tabBtn) {
    activeTierFilter.build = tabBtn.dataset.tierTab;
    renderActivePopover(ctx, true);
    return;
  }

  if (e.target.closest('[data-cancel-blueprint]')) {
    ctx.systems.crafting?.cancelBlueprint?.();
    ctx.systems.player?.cancelBlueprint?.();
    renderActivePopover(ctx, true);
    return;
  }

  const btn = e.target.closest('[data-blueprint-id]');
  if (!btn) return;
  const id = btn.dataset.blueprintId;

  // Cancel any stale blueprint on the other system before starting
  ctx.systems.player?.cancelBlueprint?.();
  ctx.systems.crafting?.cancelBlueprint?.();

  let started = false;
  if (typeof ctx.systems.crafting?.startBlueprint === 'function') {
    started = ctx.systems.crafting.startBlueprint(id);
  } else if (typeof ctx.systems.player?.startBlueprint === 'function') {
    started = ctx.systems.player.startBlueprint(id);
  }
  if (started !== false) {
    closeMenus();
  }
});

function resolveZoneInfo(ctx) {
  const pos = ctx?.player?.pos;
  if (!pos || typeof ctx?.world?.getZoneAt !== 'function') {
    return { label: 'SOUTH BEACH', theme: 'south_beach' };
  }
  const raw = ctx.world.getZoneAt(pos.x, pos.z);
  const name =
    typeof raw === 'string'
      ? raw
      : raw?.shortName || raw?.name || raw?.label || raw?.title || raw?.id || 'SOUTH BEACH';
  const lower = String(raw?.id || name).toLowerCase();
  let theme = 'south_beach';
  if (lower.includes('lagoon') || lower.includes('swamp') || lower.includes('water')) {
    theme = 'lagoon';
  } else if (lower.includes('west') || lower.includes('camp') || lower.includes('outpost')) {
    theme = 'west_camp';
  } else if (lower.includes('north') || lower.includes('hq') || lower.includes('extraction') || lower.includes('boss')) {
    theme = 'north_hq';
  }
  return { label: String(name).toUpperCase(), theme };
}

function isNearEscapeChopper(ctx) {
  if (!ctx?.player?.pos || ctx.player.isDead) return false;
  const bossState = ctx.systems?.boss?.getBossState?.();
  const vanceAgent = ctx.fbi?.agents?.find((a) => a && (a.id === 'director_vance' || a.isBoss));
  const vanceDefeated = Boolean(
    bossState?.defeated || (vanceAgent && (vanceAgent.hp <= 0 || vanceAgent.state === 'ko'))
  );
  if (!vanceDefeated) return false;
  if (ctx.systems?.boss?.isVictoryShown?.()) return false;

  const evPos = ctx.escapeVehicle?.position || { x: 0, z: -25 };
  const dist = Math.hypot(ctx.player.pos.x - evPos.x, ctx.player.pos.z - evPos.z);
  return dist <= 5.0;
}

function tryUseExpandedItem(ctx, item) {
  if (!ctx || !item || ctx.player?.isDead || ctx.cutsceneActive) return false;
  const id = (item.id || '').toLowerCase();
  if (!EXPANDED_USABLE_IDS.has(id)) return false;
  if (typeof ctx.systems?.crafting?.useExpandedItem !== 'function') return false;
  const handled = Boolean(ctx.systems.crafting.useExpandedItem(item));
  if (handled) {
    syncHud(ctx);
  }
  return handled;
}

function updateAudioButtonUI(ctx) {
  if (!btnAudioToggle) return;
  const muted = Boolean(ctx?.systems?.audio?.isMuted?.());
  btnAudioToggle.textContent = muted ? '🔇' : '🔊';
  btnAudioToggle.classList.toggle('is-muted', muted);
  btnAudioToggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
  btnAudioToggle.title = muted ? 'Unmute Audio (M)' : 'Mute Audio (M)';
}

// Master HUD Sync (`ctx.updateHud`)
let lastHotbarSig = '';
let lastChipsSig = '';
let lastZoneLabel = '';
let lastSweepSig = '';

function syncHud(ctx) {
  if (!ctx) return;

  // 1. HP & Stamina circular gauges
  const hpPct = Math.max(0, Math.min(100, (ctx.player.hp / (ctx.player.maxHp || 100)) * 100));
  const stamPct = Math.max(
    0,
    Math.min(100, (ctx.player.stamina / (ctx.player.maxStamina || 100)) * 100)
  );

  if (hudRootEl) {
    hudRootEl.style.setProperty('--hp-pct', `${hpPct.toFixed(1)}%`);
    hudRootEl.style.setProperty('--stamina-pct', `${stamPct.toFixed(1)}%`);
  }
  if (hpGaugeEl) {
    const roundedHp = Math.round(ctx.player.hp);
    hpGaugeEl.setAttribute('aria-valuenow', String(roundedHp));
    hpGaugeEl.title = `Health: ${roundedHp} / ${ctx.player.maxHp}`;
    if (hpNumEl) hpNumEl.textContent = `${roundedHp}`;
  }
  if (stamGaugeEl) {
    const roundedStam = Math.round(ctx.player.stamina);
    stamGaugeEl.setAttribute('aria-valuenow', String(roundedStam));
    stamGaugeEl.title = `Stamina: ${roundedStam} / ${ctx.player.maxStamina}`;
    if (stamNumEl) stamNumEl.textContent = `${roundedStam}`;
  }

  // 2. 10-slot hotbar + item tooltip
  const hotbarSig = JSON.stringify([ctx.player.selectedSlot, ctx.player.inventory]);
  if (hotbarSig !== lastHotbarSig) {
    lastHotbarSig = hotbarSig;
    slotButtons.forEach((btn, idx) => {
      const item = ctx.player.inventory[idx];
      const isSelected = idx === ctx.player.selectedSlot;
      const keyLabel = idx === 9 ? '0' : String(idx + 1);
      btn.classList.toggle('is-selected', isSelected);
      btn.classList.toggle('is-empty', !item);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      if (item) {
        btn.setAttribute('data-item-name', item.name.toUpperCase());
        btn.setAttribute(
          'aria-label',
          `Slot ${keyLabel}: ${item.name}${item.count > 1 ? `, count ${item.count}` : ''}`
        );
        const countBadge =
          item.type !== 'tool' && item.count > 0
            ? `<span class="hud-slot-count" aria-hidden="true">${item.count}</span>`
            : '';
        btn.innerHTML = `<span class="hud-slot-key" aria-hidden="true">${keyLabel}</span>${getItemIcon(item)}${countBadge}`;
      } else {
        btn.setAttribute('data-item-name', 'EMPTY');
        btn.setAttribute('aria-label', `Slot ${keyLabel}: Empty`);
        btn.innerHTML = `<span class="hud-slot-key" aria-hidden="true">${keyLabel}</span>`;
      }
    });

    const activeItem = ctx.player.inventory[ctx.player.selectedSlot];
    if (tooltipEl) {
      if (activeItem) {
        const suffix =
          activeItem.type !== 'tool' && activeItem.count > 1 ? ` ×${activeItem.count}` : '';
        tooltipEl.textContent = `${activeItem.name.toUpperCase()}${suffix}`;
      } else {
        tooltipEl.textContent = 'EMPTY HANDS';
      }
    }
  }

  // 3. Current Zone Name Badge
  if (zoneBadgeEl) {
    const zone = resolveZoneInfo(ctx);
    if (zone.label !== lastZoneLabel) {
      lastZoneLabel = zone.label;
      zoneBadgeEl.textContent = zone.label;
      zoneBadgeEl.dataset.zone = zone.theme;
    }
  }

  // 4. FBI Alert Meter
  const alertVal = Math.max(0, Math.min(100, Math.round(ctx.fbi?.globalAlert || 0)));
  let level = 'calm';
  let label = 'CALM';
  if (ctx.fbi?.isPlayerDetected || alertVal >= 75) {
    level = 'hunted';
    label = 'HUNTED!';
  } else if (alertVal >= 40) {
    level = 'alert';
    label = `ALERT ${alertVal}%`;
  } else if (alertVal >= 12) {
    level = 'suspicious';
    label = `SUSP ${alertVal}%`;
  }
  if (alertGroupEl) alertGroupEl.dataset.level = level;
  if (alertFillEl) alertFillEl.style.width = `${alertVal}%`;
  if (alertTrackEl) alertTrackEl.setAttribute('aria-valuenow', String(alertVal));
  if (alertTextEl) alertTextEl.textContent = label;

  // 5. FBI Sweep Warning Chip
  if (sweepWarningChipEl) {
    const sweep = ctx.systems?.crafting?.getSweepStatus?.();
    let sweepText = '';
    let sweepCls = 'sweep-warning-chip is-hidden';
    if (sweep) {
      if (sweep.sweepActive) {
        const raiders = Math.max(0, Math.round(sweep.raidersAlive || 0));
        sweepText = `🚨 FBI SWEEP (${raiders})`;
        sweepCls = 'sweep-warning-chip is-active';
      } else if (sweep.warningActive) {
        sweepText = `⚠ SWEEP IN ${Math.max(1, Math.ceil(sweep.nextSweepIn || 0))}s`;
        sweepCls = 'sweep-warning-chip is-warning';
      } else if (Number.isFinite(sweep.nextSweepIn) && sweep.nextSweepIn > 0 && sweep.nextSweepIn <= 20) {
        sweepText = `SWEEP ${Math.ceil(sweep.nextSweepIn)}s`;
        sweepCls = 'sweep-warning-chip';
      }
    }
    const sig = `${sweepCls}|${sweepText}`;
    if (sig !== lastSweepSig) {
      lastSweepSig = sig;
      sweepWarningChipEl.className = sweepCls;
      sweepWarningChipEl.textContent = sweepText;
    }
  }

  // 6. Compact dynamic status chips
  const chips = [];
  if (ctx.player.camoActive) {
    chips.push({ cls: 'status-chip--green', text: 'CAMO BUSH' });
  }
  if (ctx.player.isSneaking) {
    chips.push({ cls: 'status-chip--gold', text: 'SNEAK' });
  }
  if (ctx.companions?.dos?.mode === 'undercover') {
    chips.push({ cls: 'status-chip--cyan', text: 'DOS -50%' });
  }
  if (ctx.fbi?.smuff?.rescued) {
    chips.push({ cls: 'status-chip--blue', text: 'SMUFF +35%' });
  }
  const activeCrates = (ctx.deathCrates || []).filter((c) => c && !c.recovered && !c.confiscated);
  if (activeCrates.length > 0) {
    const soonest = Math.max(0, Math.ceil(Math.min(...activeCrates.map((c) => c.timer ?? 0))));
    chips.push({ cls: 'status-chip--red', text: `CRATE ${soonest}s` });
  }
  const chipsSig = JSON.stringify(chips);
  if (statusChipsEl && chipsSig !== lastChipsSig) {
    lastChipsSig = chipsSig;
    statusChipsEl.innerHTML = chips
      .map((ch) => `<span class="status-chip ${ch.cls}">${ch.text}</span>`)
      .join('');
  }

  // 7. Escape Chopper Context Prompt Override (when Director Vance is defeated)
  if (!ctx.cutsceneActive && isNearEscapeChopper(ctx)) {
    if (promptEl) {
      promptEl.textContent = '[F] Board FBI Escape Chopper!';
      promptEl.classList.remove('is-hidden');
    }
  } else if (promptEl && promptEl.textContent === '[F] Board FBI Escape Chopper!') {
    setContextPrompt(externalPromptText);
  }

  // 8. Audio button sync, Minimap & open popover refresh
  updateAudioButtonUI(ctx);
  renderMinimap(ctx);
  renderActivePopover(ctx, false);
}

// Wire Static DOM Controls & Hotkeys
function wireUIControls() {
  const unlockAudio = () => {
    gameRef?.ctx?.systems?.audio?.unlock?.();
  };

  // Unlock Web Audio cleanly on first pointer or keyboard interaction
  window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });

  // Capture-phase hook BEFORE player.js for expanded item use (U / Right-Click / Space blowpipe)
  // and Escape Chopper boarding (F near escapeVehicle after Vance defeat)
  window.addEventListener(
    'pointerdown',
    (e) => {
      const ctx = gameRef?.ctx;
      if (!ctx || ctx.cutsceneActive) return;
      const canvas = ctx.canvas;
      if (!canvas || e.target !== canvas) return;

      if (e.button === 2) {
        if (ctx.systems?.crafting?.isPlacingBlueprint?.()) {
          ctx.systems.crafting.cancelBlueprint();
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        const selected = ctx.player.inventory?.[ctx.player.selectedSlot];
        if (selected && EXPANDED_USABLE_IDS.has((selected.id || '').toLowerCase())) {
          const handled = tryUseExpandedItem(ctx, selected);
          if (handled) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      }
    },
    { capture: true }
  );

  window.addEventListener(
    'keydown',
    (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const ctx = gameRef?.ctx;
      if (!ctx) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        ctx.systems?.audio?.unlock?.();
        const muted = ctx.systems?.audio?.toggleMute?.();
        updateAudioButtonUI(ctx);
        showToast(muted ? 'Audio muted' : 'Audio unmuted', 'info');
        return;
      }

      if (ctx.cutsceneActive) return;

      if (e.code === 'KeyU') {
        const selected = ctx.player.inventory?.[ctx.player.selectedSlot];
        if (selected && EXPANDED_USABLE_IDS.has((selected.id || '').toLowerCase())) {
          const handled = tryUseExpandedItem(ctx, selected);
          if (handled) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
        }
      }

      if (e.code === 'KeyF') {
        if (isNearEscapeChopper(ctx) && typeof ctx.systems?.boss?.triggerEscape === 'function') {
          e.preventDefault();
          e.stopImmediatePropagation();
          ctx.systems.boss.triggerEscape();
          return;
        }
      }
    },
    { capture: true }
  );

  // Hotbar slot click -> selectSlot (or use if clicking already-selected expanded item!)
  slotButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const ctx = gameRef?.ctx;
      if (!ctx || ctx.cutsceneActive) return;
      ctx.systems?.audio?.unlock?.();

      const wasSelected = ctx.player.selectedSlot === idx;
      const item = ctx.player.inventory?.[idx];
      if (wasSelected && item && EXPANDED_USABLE_IDS.has((item.id || '').toLowerCase())) {
        tryUseExpandedItem(ctx, item);
        return;
      }

      if (ctx.systems?.player?.selectSlot) {
        ctx.systems.player.selectSlot(idx);
      } else if (ctx.player) {
        ctx.player.selectedSlot = idx;
        syncHud(ctx);
      }
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const ctx = gameRef?.ctx;
      if (!ctx || ctx.cutsceneActive) return;
      ctx.systems?.audio?.unlock?.();
      if (ctx.systems?.player?.selectSlot) {
        ctx.systems.player.selectSlot(idx);
      } else {
        ctx.player.selectedSlot = idx;
      }
      const item = ctx.player.inventory?.[idx];
      if (item) {
        tryUseExpandedItem(ctx, item);
      }
    });
  });

  // Top-left 3-node radial wheel buttons
  radialBtns.companions?.addEventListener('click', () => {
    unlockAudio();
    setActiveMenu('companions');
  });
  radialBtns.craft?.addEventListener('click', () => {
    unlockAudio();
    setActiveMenu('craft');
  });
  radialBtns.build?.addEventListener('click', () => {
    unlockAudio();
    setActiveMenu('build');
  });

  // Close buttons on popovers
  document.querySelectorAll('[data-close-popover]').forEach((btn) => {
    btn.addEventListener('click', closeMenus);
  });

  // Audio Mute toggle button
  btnAudioToggle?.addEventListener('click', () => {
    const ctx = gameRef?.ctx;
    if (!ctx?.systems?.audio) return;
    ctx.systems.audio.unlock();
    const muted = ctx.systems.audio.toggleMute();
    updateAudioButtonUI(ctx);
    showToast(muted ? 'Audio muted' : 'Audio unmuted', 'info');
  });

  // Camera toggle (Locked 45° Game View <-> Free Orbit Inspection)
  btnCamToggle?.addEventListener('click', () => {
    if (!gameRef) return;
    unlockAudio();
    const nextMode = gameRef.getCameraMode() === 'iso' ? 'orbit' : 'iso';
    gameRef.setCameraMode(nextMode);
    btnCamToggle.dataset.mode = nextMode;
    btnCamToggle.textContent = nextMode === 'iso' ? 'Locked 45°' : 'Free Orbit';
    showToast(
      nextMode === 'iso'
        ? 'Camera: Locked 45° Game View'
        : 'Camera: Free Orbit Inspection (Drag to rotate, scroll to zoom)',
      'info'
    );
  });

  // Quick Test Death button (triggers Death Crate + 50% HP Respawn Loop)
  btnTestDeath?.addEventListener('click', () => {
    const ctx = gameRef?.ctx;
    if (!ctx) return;
    unlockAudio();
    if (ctx.cutsceneActive) {
      showToast('Finish or skip the cutscene first!', 'info');
      return;
    }
    if (ctx.player.isDead) {
      showToast('Boots is already respawning!', 'warn');
      return;
    }
    ctx.player.takeDamage(ctx.player.maxHp + 50, 'test_death_button');
  });

  // Controls Help card toggle
  const toggleHelp = (forceState) => {
    const shouldShow =
      typeof forceState === 'boolean' ? forceState : helpCardEl.classList.contains('is-hidden');
    helpCardEl.classList.toggle('is-hidden', !shouldShow);
    btnHelpToggle?.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
  };
  btnHelpToggle?.addEventListener('click', () => {
    unlockAudio();
    toggleHelp();
  });
  btnHelpClose?.addEventListener('click', () => toggleHelp(false));

  // Global keyboard shortcuts for menus (Q/E/R), test death (K), help (H), and Escape
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    const ctx = gameRef?.ctx;
    if (ctx?.cutsceneActive) return;

    if (e.code === 'KeyQ') {
      e.preventDefault();
      setActiveMenu('companions');
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      setActiveMenu('craft');
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      setActiveMenu('build');
    } else if (e.code === 'KeyK') {
      e.preventDefault();
      if (ctx && !ctx.player.isDead) {
        ctx.player.takeDamage(ctx.player.maxHp + 50, 'test_death_hotkey');
      }
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      toggleHelp();
    } else if (e.code === 'Escape') {
      if (ctx?.systems?.crafting?.isPlacingBlueprint?.()) {
        ctx.systems.crafting.cancelBlueprint();
      } else if (!helpCardEl.classList.contains('is-hidden')) {
        toggleHelp(false);
      } else if (activeMenu) {
        closeMenus();
      }
    }
  });
}

// Boot the full Phase 3 Project: Last Exotic Island Survival Game
async function boot() {
  wireUIControls();
  const canvas = document.getElementById('game-canvas');

  try {
    gameRef = await initGame(canvas, {
      onToast: showToast,
      onPrompt: setContextPrompt,
      onUpdateHud: syncHud,
      onDamageFlash: triggerDamageFlash,
    });

    // Fade out loading screen
    if (loadingOverlayEl) {
      loadingOverlayEl.classList.add('is-done');
      window.setTimeout(() => loadingOverlayEl.remove(), 300);
    }
  } catch (err) {
    console.error('Failed to boot Project: Last Exotic:', err);
    if (loadingStatusEl) {
      loadingStatusEl.textContent = `Boot Error: ${err.message}`;
      loadingStatusEl.style.color = '#fca5a5';
    }
  }
}

boot();
