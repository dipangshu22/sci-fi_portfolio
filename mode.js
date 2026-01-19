

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// -------------------------------------------------
// Welcome Modal (Zoom-out)
// -------------------------------------------------
window.closeWelcomeModal = function () {
  const modal = document.getElementById("welcomeModal");
  modal.style.transform = "scale(0.2)";
  modal.style.opacity = "0";

  setTimeout(() => {
    modal.style.display = "none";
  }, 500);
};

// -------------------------------------------------
// Scene + Camera
// -------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // WHITE BACKGROUND ✅

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(2, 1, 6);

// -------------------------------------------------
// Renderer
// -------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("webgl"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// -------------------------------------------------
// Controls
// -------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// -------------------------------------------------
// Lights
// -------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1.2));

// -------------------------------------------------
// Raycaster
// -------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let mainModel = null;
let secondModel = null;

// -------------------------------------------------
// Load Models
// -------------------------------------------------
const loader = new GLTFLoader();

// -------- Model 1 --------
loader.load(
  "/assets/city.glb",
  (gltf) => {
    mainModel = gltf.scene;
    mainModel.position.set(1.5, 0, 2);
    mainModel.scale.set(2, 1, 2);
    scene.add(mainModel);
  },
  undefined,
  (err) => console.error("Main model error:", err)
);

// -------- Model 2 --------
loader.load(
  "/assets/",
  (gltf) => {
    secondModel = gltf.scene;
    secondModel.position.set(-2, 0, 1);
    secondModel.scale.set(3, 4, 5);
    secondModel.rotation.y = Math.PI / 2;
    scene.add(secondModel);
  },
  undefined,
  (err) => console.error("Second model error:", err)
);

// -------------------------------------------------
// Click Detection (Both Models)
// -------------------------------------------------
window.addEventListener("click", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const objectsToTest = [];
  if (mainModel) objectsToTest.push(mainModel);
  if (secondModel) objectsToTest.push(secondModel);

  const hits = raycaster.intersectObjects(objectsToTest, true);

  if (hits.length > 0) {
    openModal();
  }
});

// -------------------------------------------------
// Modal Open / Close
// -------------------------------------------------
function openModal() {
  const overlay = document.getElementById("overlay");
  const popup = document.getElementById("popup");

  overlay.style.display = "block";
  popup.style.display = "block";

  setTimeout(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -50%) scale(1)";
  }, 20);
}

window.closeModal = function () {
  const overlay = document.getElementById("overlay");
  const popup = document.getElementById("popup");

  popup.style.opacity = "0";
  popup.style.transform = "translate(-50%, -50%) scale(0.7)";

  setTimeout(() => {
    popup.style.display = "none";
    overlay.style.display = "none";
  }, 250);
};

// -------------------------------------------------
// Animation Loop
// -------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// -------------------------------------------------
// Resize Handler
// -------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
