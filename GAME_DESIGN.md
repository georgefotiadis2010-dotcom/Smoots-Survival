# SYSTEM DIRECTIVE: PHASE-GATED 2.5D MID-POLY GAME DEVELOPMENT (PROJECT: LAST EXOTIC)

## 1. GAME CONCEPT & STORY
- **Genre:** 2.5D Top-Down Island Survival, Stealth, Crafting & Companion Action (modeled directly on *The Survivalists*).
- **Premise:** You play as **Tarcy (Boots)**, the "last of his kind" exotic monkey, hiding on a tropical island filled with ancient overgrown temple ruins while the **FBI** invades the island to capture him.
- **Core Companions & Characters:**
  - **Tarcy (Boots) [Protagonist]:** Lavender-grey monkey with pink face/ears/hands, bright yellow circular belly patch, three white/pink head tufts, and glossy red rubber boots.
  - **Dos [Double-Agent Companion]:** Compact rounded crimson-red blob biped wearing a black FBI baseball cap with gold "FBI" lettering. He is an FBI double agent who helps Boots hide, shrinks FBI detection radius, and plants decoy beacons.
  - **Crockstar [Tameable Animal Companion]:** Olive-green bipedal crocodile with yellow underbelly, jagged teeth, and dorsal ridges found on the island. Tamed with fish/meat; swims across deep water, tanks damage, and attacks FBI agents.
  - **Smuff [Unlockable Side-Quest Character]:** Cobalt-blue character with white Phrygian cap and white trousers held captive in a guarded FBI forward camp. Stealing/rescuing him without getting caught unlocks him and grants a permanent +35% crafting/building speed bonus.
  - **FBI Agents [Enemies]:** Tactical black suits, sunglasses, earpieces, FBI caps/windbreakers, patrol vision cones, flashlights, and tranquilizer rifles.
- **Death & Respawn Rule:** If Boots's HP hits 0, he drops 100% of his carried inventory into a physical 3D death-crate at the exact spot he died and respawns at his last activated campfire/bed with **50% Max HP** (`current_hp = max_hp * 0.5`). He must retrieve his crate before FBI patrols confiscate it.

## 2. EXECUTION PROTOCOL & CRITICAL CONSTRAINTS
- **STRICT PHASE GATING:** Execute Phase 1 ONLY. Do NOT write gameplay logic, physics, inventory systems, or AI routines until visual assets and UI pass user inspection in `EXOTIC-007`.
- **ART STYLE & PIPELINE:** Real-time **2.5D Mid-Poly 3D** (target 3,000–8,000 triangles per character, 500–2,500 triangles per environment prop) viewed from a locked 45-degree top-down isometric/orthographic camera matching *The Survivalists* layout.
- **BLENDER WORKFLOW:** Use Blender (headless Python scripts via `bpy`) to model, UV-unwrap, rig, animate, and export clean **GLTF/GLB** assets (`.glb`) with crisp 2-step cel/toon shading and inverted-hull black outlines (1.5px–2px screen-space equivalent) so they render live in 3D in the browser.
- **ZERO BACKEND / ZERO PAID SERVICES:** 100% static client-side bundle deployable directly to GitHub Pages.

## 3. TECHNICAL STACK & GITHUB PAGES DEPLOYMENT
- **Engine:** Three.js + Vite (JavaScript/TypeScript) — DO NOT use Godot or 2D sprite baking. Render real-time 3D mid-poly `.glb` models natively in WebGL.
- **Camera & Lighting:** Locked 45-degree orthographic/low-FOV isometric camera matching *The Survivalists* angle, directional sunlight with crisp real-time shadow maps, and cel-shaded `MeshToonMaterial` + outline rendering.
- **UI Architecture:** Build all HUD elements as a crisp **HTML5/CSS3 DOM overlay** pinned over the 3D WebGL `<canvas>`.
- **Deployment Target:** Configure `vite.config.js` with `base: './'` and static `.glb` asset bundling in `/public/models` so `/dist` deploys directly to **GitHub Pages** with zero server-side headers.

---

## 4. COMPLETE TICKET BACKLOG (REFERENCE FOR ALL WAVES)

### `EXOTIC-001` | Initialize Vite + Three.js & GitHub Pages Scaffold [EXECUTE NOW]
- Set up Vite + Three.js project structure (`/src`, `/public/models`, `/blender_scripts`, `/references`).
- Configure `vite.config.js` with `base: './'` for static GitHub Pages deployment.
- Done when: `npm run build` outputs clean static files to `/dist` and WebGL canvas renders at 60 FPS with a locked 45° isometric camera and shadow map.

### `EXOTIC-002` | Blender Script: Protagonist Model & Rig — Tarcy (Boots) [PHASE 1]
- File: `blender_scripts/build_tarcy.py` -> `public/models/tarcy_boots.glb` (~5,500 tris).
- Specs: Match `characters_ref.png`. Lavender-grey monkey, pink face/ears/hands, yellow circular belly patch, 3 white/pink head tufts, glossy red rubber boots, 2-step cel shader + 2px inverted-hull black outline.
- Animations: `Idle`, `Walk`, `Run`, `Chop_Mine`, `Craft`, `Sneak_Crouch`, `Take_Damage`, `Death`.

### `EXOTIC-003` | Blender Script: Companions — Dos & Crockstar [PHASE 1]
- File: `blender_scripts/build_companions.py` -> `public/models/dos.glb` (~3,200 tris) & `public/models/crockstar.glb` (~6,500 tris).
- Specs: Match `characters_ref.png`.
  - **Dos:** Crimson-red rounded blob biped, oversized white eyes with black pupils, black FBI baseball cap with gold "FBI" text. Animations: `Idle`, `Waddle`, `Alert_Signal`, `Hide_Assist_Aura`, `Follow`.
  - **Crockstar:** Olive-green bipedal crocodile, yellow underbelly/jaw, white conical teeth, dorsal ridges, cartoon eyes. Animations: `Idle`, `Walk`, `Swim`, `Bite_Attack`, `Friendly_Sit`.
- Both use 2-step cel shader + 2px inverted-hull black outline.

### `EXOTIC-004` | Blender Script: NPC & Enemies — Smuff & FBI Agents [PHASE 1]
- File: `blender_scripts/build_npcs.py` -> `public/models/smuff.glb` (~4,800 tris) & `public/models/fbi_agent.glb` (~5,000 tris).
- Specs:
  - **Smuff (match `characters_ref.png`):** Cobalt-blue skin, bulbous blue nose, white Phrygian cap, white trousers/boots. Animations: `Captured_Idle`, `Sneak_Walk`, `Follow`, `Ability_Cast`.
  - **FBI Agent (match `environment_ui_ref.png` proportions):** Black tactical suit, dark sunglasses, earpiece, black FBI cap, tranquilizer rifle/flashlight. Animations: `Patrol_Walk`, `Flashlight_Sweep`, `Alert_Spot`, `Chase`, `Shoot_Tranq`.
- Both use 2-step cel shader + 2px inverted-hull black outline.

### `EXOTIC-005` | Blender Script: Mid-Poly Environment Kit [PHASE 1]
- File: `blender_scripts/build_environment.py` -> `public/models/env_kit.glb` (500–2,500 tris per modular asset).
- Specs: Match `environment_ui_ref.png`.
  - **Jungle:** Layered tropical canopy trees (green-to-lime cel gradients) and foliage.
  - **Ruins:** Mossy stone walls, cracked sandstone floor tiles, carved pillars, flickering fire braziers.
  - **FBI Outpost:** Black tactical tents, metal holding cage (for Smuff), tripod floodlights with light cones, yellow/black caution tape.
- Modular assets snap cleanly onto a 1x1 world grid.

### `EXOTIC-006` | HTML5/CSS3 HUD & UI Overlay [PHASE 1]
- Files: `src/ui/hud.html` & `src/ui/hud.css` (pinned over WebGL canvas).
- Specs: Match `environment_ui_ref.png`.
  - **Top-Left:** 3-node circular radial action wheel (Monkey Commands, Crafting, Build/Repair).
  - **Top-Right:** Circular live minimap canvas with N/S/E/W markers and sun/time icon.
  - **Bottom-Center:** 10-slot hotbar with active yellow selection border and item label tooltip, flanked by circular Red Heart HP gauge (left) and Green Lightning Stamina gauge (right).

### `EXOTIC-007` | Phase 1 Gate: Live 3D Visual Showcase Scene [PHASE 1 FINAL GATE]
- Assemble all 5 animated `.glb` characters, the Jungle/Ruin/FBI Outpost environment kit, and the HTML/CSS HUD into a live browser showcase scene with a camera toggle (Locked 45° Game View vs. Free Orbit Inspection) and animation switcher.
- **HALT ALL CODING AFTER THIS TICKET until user approves visuals.**

### `EXOTIC-008` | Player Controller, Gathering & Blueprint Crafting [PHASE 2 - LOCKED]
- File: `src/systems/player.js`. WASD/click-to-move 2.5D movement for Boots, stamina drain/regen, harvesting trees/rocks/FBI crates, 10-slot hotbar equipping, and 3D ghost-mesh blueprint building (campfires, beds, walls, workbenches).

### `EXOTIC-009` | Companion AI: Dos & Crockstar [PHASE 2 - LOCKED]
- File: `src/systems/companions.js`. Radial wheel command states: Dos ("Undercover Mode" shrinks FBI detection radius by 50%; "Decoy Beacon" lures patrols away) and Crockstar (tamed with fish/meat; swims across deep water, tanks damage, attacks FBI agents).

### `EXOTIC-010` | FBI Patrol AI, Vision Cones & Smuff Rescue Side Quest [PHASE 2 - LOCKED]
- File: `src/systems/fbi_ai.js`. FBI patrol waypoints, ground-projected vision cones, alert meter escalation, backup spawns, and guarded FBI forward camp holding Smuff (rescuing Smuff undetected recruits him and grants +35% crafting/building speed).

### `EXOTIC-011` | Death Crate Drop & Half-HP Respawn Loop [PHASE 2 - LOCKED]
- File: `src/systems/death_loop.js`. On HP = 0, drop 100% of carried inventory into a physical 3D death-crate at exact death coordinates, respawn Boots at last activated campfire/bed with 50% Max HP, and allow item recovery before FBI patrols confiscate the crate.
