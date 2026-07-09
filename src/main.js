import * as THREE from "three";
import "./style.css";


// ---------- Basic scene setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 12, 55);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 4.2, 8.5);
camera.lookAt(0, 0.8, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Lighting ----------
scene.add(new THREE.AmbientLight(0x8899ff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 10, 4);
sun.castShadow = true;
scene.add(sun);

// ---------- Track / ground ----------
const LANE_X = [-2.2, 0, 2.2];
const trackLength = 60;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8, trackLength * 2),
  new THREE.MeshStandardMaterial({ color: 0x14192b })
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -trackLength / 2 + 10;
ground.receiveShadow = true;
scene.add(ground);

// lane divider lines
for (const x of [-1.1, 1.1]) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06, trackLength * 2),
    new THREE.MeshBasicMaterial({ color: 0x3a4a8f })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, 0.01, ground.position.z);
  scene.add(line);
}

// ---------- Player ----------
const player = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 0.8, 0.8),
  new THREE.MeshStandardMaterial({ color: 0x5b8cff, emissive: 0x11224a })
);
player.castShadow = true;
player.position.set(0, 0.4, 0);
scene.add(player);

// ---------- Game state ----------
const state = {
  lane: 1,
  targetX: 0,
  velY: 0,
  grounded: true,
  running: false,
  score: 0,
  speed: 9,
  spawnTimer: 0,
  spawnInterval: 1.15,
  obstacles: [],
};

const GRAVITY = -22;
const JUMP_VELOCITY = 8.4;
const GROUND_Y = 0.4;

// ---------- Input ----------
addEventListener("keydown", (e) => {
  if (!state.running) return;
  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      state.lane = Math.max(0, state.lane - 1);
      state.targetX = LANE_X[state.lane];
      break;
    case "ArrowRight":
    case "KeyD":
      state.lane = Math.min(2, state.lane + 1);
      state.targetX = LANE_X[state.lane];
      break;
    case "ArrowUp":
    case "KeyW":
    case "Space":
      if (state.grounded) {
        state.velY = JUMP_VELOCITY;
        state.grounded = false;
      }
      e.preventDefault();
      break;
  }
});

const clock = new THREE.Clock();

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const isLow = Math.random() < 0.35;
  const height = isLow ? 0.5 : 2.0;
  const color = isLow ? 0xffb347 : 0xff5b7a;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, height, 0.6),
    new THREE.MeshStandardMaterial({ color, emissive: 0x220000 })
  );
  mesh.castShadow = true;
  const halfHeight = height / 2;
  mesh.position.set(LANE_X[lane], halfHeight, -trackLength);
  scene.add(mesh);
  state.obstacles.push({ mesh, halfHeight });
}

function checkCollisions() {
  const px = player.position.x, py = player.position.y, pz = player.position.z;
  for (const o of state.obstacles) {
    const dz = Math.abs(o.mesh.position.z - pz);
    const dx = Math.abs(o.mesh.position.x - px);
    if (dz < 0.55 && dx < 0.9) {
      const top = o.mesh.position.y + o.halfHeight;
      const bottom = o.mesh.position.y - o.halfHeight;
      if (py + 0.4 > bottom && py - 0.4 < top) return true;
    }
  }
  return false;
}

const overlay = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const startBtn = document.getElementById("startBtn");
const highScoreEl = document.getElementById("highScore");

let highScore = Number(localStorage.getItem("laneDodgerHighScore")) || 0;
highScoreEl.textContent = highScore.toString();

function resetGame() {
  for (const o of state.obstacles) scene.remove(o.mesh);
  state.obstacles.length = 0;
  state.lane = 1;
  state.targetX = LANE_X[1];
  player.position.set(0, GROUND_Y, 0);
  state.velY = 0;
  state.grounded = true;
  state.score = 0;
  state.speed = 9;
  state.spawnTimer = 0;
  state.spawnInterval = 1.15;
  scoreEl.textContent = "0";
}

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  state.running = true;
}

function gameOver() {
  state.running = false;

  const finalScore = Math.floor(state.score);
  const isNewHighScore = finalScore > highScore;
  if (isNewHighScore) {
    highScore = finalScore;
    localStorage.setItem("laneDodgerHighScore", highScore.toString());
    highScoreEl.textContent = highScore.toString();
  }

  overlay.innerHTML = `
    <h1>Run Over</h1>
    <p>Score: ${finalScore}${isNewHighScore ? " — New Best!" : ""}</p>
    <p>Best: ${highScore}</p>
    <button id="retryBtn">Try Again</button>
  `;
  overlay.classList.remove("hidden");
  document.getElementById("retryBtn").addEventListener("click", startGame);
}

startBtn.addEventListener("click", startGame);

// ---------- Game loop ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.running) {
    state.speed = 9 + state.score * 0.05;
    state.spawnInterval = Math.max(0.55, 1.15 - state.score * 0.004);

    player.position.x += (state.targetX - player.position.x) * Math.min(1, dt * 12);

    state.velY += GRAVITY * dt;
    player.position.y += state.velY * dt;
    if (player.position.y <= GROUND_Y) {
      player.position.y = GROUND_Y;
      state.velY = 0;
      state.grounded = true;
    }

    for (const o of state.obstacles) o.mesh.position.z += state.speed * dt;
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      if (state.obstacles[i].mesh.position.z > 4) {
        scene.remove(state.obstacles[i].mesh);
        state.obstacles.splice(i, 1);
      }
    }

    state.spawnTimer += dt;
    if (state.spawnTimer >= state.spawnInterval) {
      state.spawnTimer = 0;
      spawnObstacle();
    }

    state.score += dt * 10;
    scoreEl.textContent = Math.floor(state.score).toString();

    if (checkCollisions()) gameOver();
  }

  renderer.render(scene, camera);
}
animate();