import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* =========================================================
   DOM
========================================================= */
const webgl = document.getElementById("webgl");
const blurLayer = document.getElementById("blurLayer");
const flash = document.getElementById("flash");
const overlay = document.getElementById("overlay");
const popup = document.getElementById("popup");

const loaderUI = document.getElementById("loader");
const loaderBar = document.getElementById("loader-progress");
const loaderText = document.getElementById("loader-text");

/* =========================================================
   LOADER UI
========================================================= */
function updateLoader(p) {
  const percent = Math.floor(p * 100);
  loaderBar.style.width = percent + "%";
  loaderText.textContent = `Loading ${percent}%`;
}

function hideLoader() {
  loaderUI.style.opacity = "0";
  setTimeout(() => loaderUI.remove(), 500);
}

/* =========================================================
   WELCOME
========================================================= */
window.closeWelcomeModal = function () {
  const modal = document.getElementById("welcomeModal");
  modal.style.opacity = "0";
  modal.style.transform = "scale(0.8)";
  setTimeout(() => (modal.style.display = "none"), 500);
};

/* =========================================================
   BLUR
========================================================= */
function setBlur(v) {
  if (v === 0) {
    blurLayer.style.backdropFilter = "none";
    blurLayer.style.webkitBackdropFilter = "none";
    return;
  }
  blurLayer.style.backdropFilter = `blur(${v}px)`;
}

function animateBlur(from, to, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    setBlur(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* =========================================================
   SCENE & CAMERA
========================================================= */
const scene = new THREE.Scene();

const cameraRig = new THREE.Group();
scene.add(cameraRig);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
cameraRig.add(camera);

const basePos = new THREE.Vector3();

/* =========================================================
   RENDERER
========================================================= */
const renderer = new THREE.WebGLRenderer({
  canvas: webgl,
  alpha: true,
  antialias: false,
  powerPreference: "high-performance"
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.2 : 1.5));

/* =========================================================
   CONTROLS
========================================================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2.1;

/* =========================================================
   LIGHTS
========================================================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
scene.add(new THREE.DirectionalLight(0x00aaff, 2));

/* =========================================================
   CAMERA POSITION
========================================================= */
function setGameCamera() {
  if (innerWidth < 768) {
    cameraRig.position.set(0, 1.6, 5.2);
  } else {
    cameraRig.position.set(0, 1.8, 6.8);
  }
  controls.target.set(0, 0.8, 0);
  controls.update();
  basePos.copy(cameraRig.position);
}

/* =========================================================
   POST PROCESSING (LAZY)
========================================================= */
let composer, bloomPass;

async function loadPostProcessing() {
  if (composer) return;

  const [
    { EffectComposer },
    { RenderPass },
    { UnrealBloomPass }
  ] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js")
  ]);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    innerWidth < 768 ? 0.6 : 1.1,
    0.4,
    0.85
  );

  composer.addPass(bloomPass);
}

/* =========================================================
   AUDIO (LAZY)
========================================================= */
const listener = new THREE.AudioListener();
camera.add(listener);

const portalSound = new THREE.Audio(listener);
let audioLoaded = false;
let soundFinished = false;

async function loadPortalAudio() {
  if (audioLoaded) {
    portalSound.play();
    return;
  }

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("/assets/portal.mp3", buffer => {
    portalSound.setBuffer(buffer);
    portalSound.onEnded = () => {
      soundFinished = true;
      tryRedirect();
    };
    audioLoaded = true;
    portalSound.play();
  });
}

/* =========================================================
   MODEL & ANIMATION
========================================================= */
const clock = new THREE.Clock();
let mixer, portalAction;
let animationFinished = false;
let modelReady = false;
let clickableModel = null;

function normalize(obj, size = 6) {
  const box = new THREE.Box3().setFromObject(obj);
  const max = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  obj.scale.setScalar(size / max);
}

const loader = new GLTFLoader();

loader.load(
  "/assets/animated.glb",
  gltf => {
    const model = gltf.scene;
    clickableModel = model;

    normalize(model);
    model.position.set(0, -1.4, 0);
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);
    portalAction = mixer.clipAction(gltf.animations[0]);
    portalAction.loop = THREE.LoopOnce;
    portalAction.clampWhenFinished = true;
    portalAction.timeScale = 0.5;

    mixer.addEventListener("finished", () => {
      animationFinished = true;
      tryRedirect();
    });

    modelReady = true;
    setGameCamera();
    hideLoader();
  },
  xhr => {
    if (xhr.total) updateLoader(xhr.loaded / xhr.total);
  }
);

/* =========================================================
   RAYCAST CLICK
========================================================= */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", e => {
  if (!clickableModel) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );

  raycaster.setFromCamera(mouse, camera);
  if (raycaster.intersectObject(clickableModel, true).length) {
    openModal();
  }
});

/* =========================================================
   POPUP
========================================================= */
window.openModal = function () {
  controls.enabled = false;
  overlay.style.display = "block";
  popup.style.display = "flex";
  requestAnimationFrame(() => popup.classList.add("active"));
};

window.closeModal = function () {
  controls.enabled = true;
  popup.classList.remove("active");
  setTimeout(() => {
    popup.style.display = "none";
    overlay.style.display = "none";
  }, 250);
};

/* =========================================================
   ENTER PORTAL
========================================================= */
let shakeTime = 0;
let shakeIntensity = 0;

window.enterPortal = async function () {
  if (!modelReady || !portalAction) return;

  popup.classList.remove("active");
  setTimeout(() => {
    popup.style.display = "none";
    overlay.style.display = "none";
  }, 200);

  controls.enabled = false;
  animationFinished = false;
  soundFinished = false;

  await loadPostProcessing();
  await loadPortalAudio();

  portalAction.reset().play();

  shakeTime = 0.7;
  shakeIntensity = innerWidth < 768 ? 0.05 : 0.12;
  animateBlur(0, 6, 2000);
};

/* =========================================================
   REDIRECT
========================================================= */
function tryRedirect() {
  if (animationFinished && soundFinished) {
    animateBlur(6, 18, 300);
    shakeTime = 0.4;
    shakeIntensity = innerWidth < 768 ? 0.08 : 0.18;
    flash.classList.add("active");
    setTimeout(() => (location.href = "/portal"), 350);
  }
}

/* =========================================================
   RESIZE
========================================================= */
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  setGameCamera();
});

/* =========================================================
   LOOP
========================================================= */
function animate() {
  requestAnimationFrame(animate);

  const d = clock.getDelta();
  if (mixer && portalAction?.isRunning()) mixer.update(d);

  if (shakeTime > 0) {
    shakeTime -= d;
    cameraRig.position.x = basePos.x + (Math.random() - 0.5) * shakeIntensity;
    cameraRig.position.y = basePos.y + (Math.random() - 0.5) * shakeIntensity;
  } else {
    cameraRig.position.lerp(basePos, 0.15);
  }

  controls.update();

  if (composer) composer.render();
  else renderer.render(scene, camera);
}
animate();
