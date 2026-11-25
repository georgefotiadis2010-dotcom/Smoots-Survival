import * as THREE from 'three';
import './style.css';

/**
 * Creates a 2-step toon gradient texture for crisp cel shading.
 * @returns {THREE.DataTexture}
 */
function createTwoStepGradient() {
  const data = new Uint8Array([115, 255]);
  const texture = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const canvas = document.getElementById('game-canvas');

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

// Locked 45-degree top-down isometric orthographic camera
const FRUSTUM_SIZE = 12;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-FRUSTUM_SIZE * aspect) / 2,
  (FRUSTUM_SIZE * aspect) / 2,
  FRUSTUM_SIZE / 2,
  -FRUSTUM_SIZE / 2,
  0.1,
  100
);

// 45-degree isometric angle: equal horizontal distance in X/Z and 45° elevation
const ISO_DIST = 20;
const HORIZ = ISO_DIST * Math.cos(Math.PI / 4);
const VERT = ISO_DIST * Math.sin(Math.PI / 4);
camera.position.set(HORIZ * Math.SQRT1_2, VERT, HORIZ * Math.SQRT1_2);
camera.lookAt(0, 0, 0);

// Lighting: hemisphere fill + directional sunlight with real-time shadows
const hemiLight = new THREE.HemisphereLight(0xdff5e1, 0x2b3a2e, 0.75);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.6);
sunLight.position.set(10, 16, 8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 50;
const shadowBound = 10;
sunLight.shadow.camera.left = -shadowBound;
sunLight.shadow.camera.right = shadowBound;
sunLight.shadow.camera.top = shadowBound;
sunLight.shadow.camera.bottom = -shadowBound;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Scaffold verification ground & cel-shaded marker
const gradientMap = createTwoStepGradient();

const groundGeo = new THREE.PlaneGeometry(16, 16);
const groundMat = new THREE.MeshToonMaterial({
  color: 0x4c7c3e,
  gradientMap,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(16, 16, 0x2d4e24, 0x3a6130);
gridHelper.position.y = 0.005;
scene.add(gridHelper);

const markerGeo = new THREE.BoxGeometry(1, 1, 1);
const markerMat = new THREE.MeshToonMaterial({
  color: 0xd9a05b,
  gradientMap,
});
const marker = new THREE.Mesh(markerGeo, markerMat);
marker.position.set(0, 0.5, 0);
marker.castShadow = true;
marker.receiveShadow = true;
scene.add(marker);

window.addEventListener('resize', () => {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (-FRUSTUM_SIZE * newAspect) / 2;
  camera.right = (FRUSTUM_SIZE * newAspect) / 2;
  camera.top = FRUSTUM_SIZE / 2;
  camera.bottom = -FRUSTUM_SIZE / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  marker.rotation.y = elapsed * 0.6;
  renderer.render(scene, camera);
}

animate();
