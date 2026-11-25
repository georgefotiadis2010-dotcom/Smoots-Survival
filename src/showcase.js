import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_PATHS = {
  tarcy: './models/tarcy_boots.glb',
  dos: './models/dos.glb',
  crockstar: './models/crockstar.glb',
  smuff: './models/smuff.glb',
  fbi: './models/fbi_agent.glb',
  env: './models/env_kit.glb',
};

const CHARACTER_CONFIGS = [
  {
    id: 'tarcy',
    label: 'Tarcy (Boots)',
    path: MODEL_PATHS.tarcy,
    position: [0, 0, 1],
    rotationY: Math.PI * 0.15,
    defaultClip: 'Idle',
    dotColor: '#d988b9',
  },
  {
    id: 'dos',
    label: 'Dos',
    path: MODEL_PATHS.dos,
    position: [-1.5, 0, 1.5],
    rotationY: Math.PI * 0.25,
    defaultClip: 'Idle',
    dotColor: '#e03131',
  },
  {
    id: 'crockstar',
    label: 'Crockstar',
    path: MODEL_PATHS.crockstar,
    position: [2.0, 0, 2.0],
    rotationY: -Math.PI * 0.2,
    defaultClip: 'Idle',
    dotColor: '#74b816',
  },
  {
    id: 'smuff',
    label: 'Smuff',
    path: MODEL_PATHS.smuff,
    position: [4.5, 0, -2.5],
    rotationY: Math.PI * 0.1,
    defaultClip: 'Captured_Idle',
    dotColor: '#228be6',
  },
  {
    id: 'fbi',
    label: 'FBI Agent',
    path: MODEL_PATHS.fbi,
    position: [3.0, 0, -1.0],
    rotationY: -Math.PI * 0.35,
    defaultClip: 'Patrol_Walk',
    dotColor: '#212529',
  },
];

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
    const matName = obj.material?.name || '';
    const isOutline = matName.toLowerCase().includes('outline');
    const isLightCone = obj.name.toLowerCase().includes('lightcone');
    if (isOutline || isLightCone) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    } else {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function cloneEnvNode(envScene, name, x, z, rotY = 0) {
  const src = envScene.getObjectByName(name);
  if (!src) return null;
  const clone = src.clone(true);
  clone.position.set(x, 0, z);
  clone.rotation.set(0, rotY, 0);
  enableShadows(clone);
  return clone;
}

function buildShowcaseEnvironment(scene, envScene) {
  const group = new THREE.Group();
  group.name = 'Showcase_Environment';

  // Central Ruin Sandstone Courtyard (x: -2..2, z: -2..2)
  for (let gx = -2; gx <= 2; gx += 1) {
    for (let gz = -2; gz <= 2; gz += 1) {
      const tile = cloneEnvNode(envScene, 'Ruin_Sandstone_Floor', gx, gz);
      if (tile) group.add(tile);
    }
  }

  // Ruin Temple Walls along North & West edges with entrance gap
  for (const gx of [-3, -2, -1, 1, 2, 3]) {
    const wallN = cloneEnvNode(envScene, 'Ruin_Temple_Wall', gx, -3);
    if (wallN) group.add(wallN);
  }
  for (const gz of [-2, -1, 1, 2]) {
    const wallW = cloneEnvNode(envScene, 'Ruin_Temple_Wall', -3, gz, Math.PI / 2);
    if (wallW) group.add(wallW);
  }

  // Carved Stone Pillars at courtyard corners
  const pillarCoords = [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ];
  for (const [px, pz] of pillarCoords) {
    const pillar = cloneEnvNode(envScene, 'Ruin_Stone_Pillar', px, pz);
    if (pillar) group.add(pillar);
  }

  // Fire Braziers flanking the courtyard entrance
  const brazierLights = [];
  for (const [bx, bz] of [
    [-1, 3],
    [1, 3],
  ]) {
    const brazier = cloneEnvNode(envScene, 'Ruin_Fire_Brazier', bx, bz);
    if (brazier) group.add(brazier);
    const light = new THREE.PointLight(0xff8c2a, 2.2, 7, 1.5);
    light.position.set(bx, 1.65, bz);
    group.add(light);
    brazierLights.push(light);
  }

  // Tropical Jungle Canopy & Bushes framing West & South-West
  const trees = [
    ['Jungle_Canopy_Tree_Large', -5.5, -4.5, 0.2],
    ['Jungle_Canopy_Tree_Large', -5.5, 1.5, 1.1],
    ['Jungle_Canopy_Tree_Small', -4.5, 4.5, -0.4],
    ['Jungle_Canopy_Tree_Large', -1.5, 5.5, 0.8],
    ['Jungle_Canopy_Tree_Small', 3.5, 5.0, -0.7],
    ['Jungle_Canopy_Tree_Large', 6.0, 3.5, 0.5],
  ];
  for (const [name, tx, tz, ry] of trees) {
    const tree = cloneEnvNode(envScene, name, tx, tz, ry);
    if (tree) group.add(tree);
  }

  const bushes = [
    [-4.2, -1.5],
    [-4.2, 3.2],
    [-2.5, 4.2],
    [2.5, 4.0],
    [4.6, 2.2],
  ];
  for (const [bx, bz] of bushes) {
    const bush = cloneEnvNode(envScene, 'Jungle_Foliage_Bush', bx, bz, bx * 0.7);
    if (bush) group.add(bush);
  }

  // FBI Outpost Overlay (East / North-East flank)
  const tent = cloneEnvNode(envScene, 'FBI_Tactical_Tent', 5.5, -5.0, -Math.PI * 0.25);
  if (tent) group.add(tent);

  const cage = cloneEnvNode(envScene, 'FBI_Holding_Cage', 4.5, -2.5, 0);
  if (cage) group.add(cage);

  const floodlight = cloneEnvNode(envScene, 'FBI_Tripod_Floodlight', 2.0, -4.5, Math.PI * 0.2);
  if (floodlight) group.add(floodlight);

  const barriers = [
    [1.5, -2.5, 0],
    [5.8, -1.0, Math.PI * 0.45],
  ];
  for (const [bx, bz, ry] of barriers) {
    const barrier = cloneEnvNode(envScene, 'FBI_Caution_Barrier', bx, bz, ry);
    if (barrier) group.add(barrier);
  }

  scene.add(group);
  return { group, brazierLights };
}

function drawMinimap(canvas, characters) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Island terrain backdrop
  ctx.fillStyle = '#3b6b33';
  ctx.fillRect(0, 0, w, h);

  // Scale world [-8..8] -> canvas [0..w]
  const toMap = (wx, wz) => [cx + (wx / 8) * (w * 0.45), cy + (wz / 8) * (h * 0.45)];

  // Temple courtyard
  const [rx, rz] = toMap(-2.5, -2.5);
  const rw = (5 / 8) * (w * 0.45);
  ctx.fillStyle = '#b99d6b';
  ctx.fillRect(rx, rz, rw, rw);

  // FBI Outpost marker
  const [fx, fz] = toMap(4.0, -4.5);
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(fx, fz, 22, 22);

  // Character dots
  for (const ch of characters) {
    const [mx, mz] = toMap(ch.position[0], ch.position[2]);
    ctx.beginPath();
    ctx.arc(mx, mz, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = ch.dotColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}

export async function initShowcase(canvas) {
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
  scene.background = new THREE.Color(0x1f3524);

  // 1. Locked 45° Isometric Orthographic Camera
  const FRUSTUM_SIZE = 12;
  const aspect = window.innerWidth / window.innerHeight;
  const isoCamera = new THREE.OrthographicCamera(
    (-FRUSTUM_SIZE * aspect) / 2,
    (FRUSTUM_SIZE * aspect) / 2,
    FRUSTUM_SIZE / 2,
    -FRUSTUM_SIZE / 2,
    0.1,
    120
  );
  const ISO_DIST = 24;
  const HORIZ = ISO_DIST * Math.cos(Math.PI / 4);
  const VERT = ISO_DIST * Math.sin(Math.PI / 4);
  const isoDefaultPos = new THREE.Vector3(HORIZ * Math.SQRT1_2, VERT, HORIZ * Math.SQRT1_2);
  isoCamera.position.copy(isoDefaultPos);
  isoCamera.lookAt(1, 0, -0.5);

  // 2. Free Orbit Inspection Perspective Camera + OrbitControls
  const orbitCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 150);
  orbitCamera.position.set(7.5, 6.0, 9.5);
  const orbitControls = new OrbitControls(orbitCamera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.target.set(1, 0.7, -0.5);
  orbitControls.minDistance = 2.5;
  orbitControls.maxDistance = 28;
  orbitControls.maxPolarAngle = Math.PI * 0.48;
  orbitControls.enabled = false;

  let cameraMode = 'iso'; // 'iso' | 'orbit'

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xdff5e1, 0x2b3a2e, 0.9);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.65);
  sunLight.position.set(12, 18, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 60;
  const shadowBound = 12;
  sunLight.shadow.camera.left = -shadowBound;
  sunLight.shadow.camera.right = shadowBound;
  sunLight.shadow.camera.top = shadowBound;
  sunLight.shadow.camera.bottom = -shadowBound;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // Base Grass Ground Plane
  const gradientMap = createTwoStepGradient();
  const groundGeo = new THREE.PlaneGeometry(24, 24);
  const groundMat = new THREE.MeshToonMaterial({
    color: 0x457438,
    gradientMap,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(24, 24, 0x2d4e24, 0x3a6130);
  gridHelper.position.y = 0.004;
  scene.add(gridHelper);

  // Load all GLB assets
  const loader = new GLTFLoader();
  const loadGLB = (path) =>
    new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));

  const envGltf = await loadGLB(MODEL_PATHS.env);
  const { brazierLights } = buildShowcaseEnvironment(scene, envGltf.scene);

  const characterEntries = [];
  for (const cfg of CHARACTER_CONFIGS) {
    const gltf = await loadGLB(cfg.path);
    const model = gltf.scene;
    model.position.set(...cfg.position);
    model.rotation.y = cfg.rotationY;
    enableShadows(model);
    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations || [];
    const actions = {};
    for (const clip of clips) {
      actions[clip.name] = mixer.clipAction(clip);
    }

    const initialClip = actions[cfg.defaultClip] ? cfg.defaultClip : clips[0]?.name;
    let activeAction = null;
    if (initialClip && actions[initialClip]) {
      activeAction = actions[initialClip];
      activeAction.play();
    }

    characterEntries.push({
      ...cfg,
      model,
      mixer,
      clips,
      actions,
      activeClip: initialClip || '',
      activeAction,
    });
  }

  drawMinimap(document.getElementById('hud-minimap'), CHARACTER_CONFIGS);

  const setCameraMode = (mode) => {
    cameraMode = mode;
    orbitControls.enabled = mode === 'orbit';
  };

  const focusCharacter = (charId) => {
    if (charId === 'all') {
      const center = new THREE.Vector3(1, 0.6, -0.5);
      isoCamera.position.copy(isoDefaultPos).add(new THREE.Vector3(1, 0, -0.5));
      isoCamera.lookAt(center);
      orbitControls.target.copy(center);
      orbitCamera.position.set(7.5, 6.0, 9.5);
      orbitControls.update();
      return;
    }
    const entry = characterEntries.find((c) => c.id === charId);
    if (!entry) return;
    const target = new THREE.Vector3(entry.position[0], 0.7, entry.position[2]);
    isoCamera.position.copy(isoDefaultPos).add(new THREE.Vector3(target.x, 0, target.z));
    isoCamera.lookAt(target);
    orbitControls.target.copy(target);
    orbitCamera.position.set(target.x + 2.8, target.y + 1.8, target.z + 3.4);
    orbitControls.update();
  };

  const playAnimation = (charId, clipName) => {
    const entry = characterEntries.find((c) => c.id === charId);
    if (!entry || !entry.actions[clipName]) return;
    if (entry.activeAction === entry.actions[clipName]) return;

    const nextAction = entry.actions[clipName];
    nextAction.reset().play();
    if (entry.activeAction) {
      entry.activeAction.crossFadeTo(nextAction, 0.2, true);
    }
    entry.activeAction = nextAction;
    entry.activeClip = clipName;
  };

  window.addEventListener('resize', () => {
    const newAspect = window.innerWidth / window.innerHeight;
    isoCamera.left = (-FRUSTUM_SIZE * newAspect) / 2;
    isoCamera.right = (FRUSTUM_SIZE * newAspect) / 2;
    isoCamera.top = FRUSTUM_SIZE / 2;
    isoCamera.bottom = -FRUSTUM_SIZE / 2;
    isoCamera.updateProjectionMatrix();

    orbitCamera.aspect = newAspect;
    orbitCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;

    for (const entry of characterEntries) {
      entry.mixer.update(delta);
    }

    // Subtle brazier firelight flicker
    brazierLights.forEach((light, idx) => {
      light.intensity = 2.0 + Math.sin(elapsed * 9 + idx * 2.1) * 0.35;
    });

    if (cameraMode === 'orbit') {
      orbitControls.update();
      renderer.render(scene, orbitCamera);
    } else {
      renderer.render(scene, isoCamera);
    }
  }
  animate();

  return {
    characters: characterEntries,
    setCameraMode,
    focusCharacter,
    playAnimation,
  };
}
