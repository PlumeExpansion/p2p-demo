// --- NETWORK & GAME STATE MANAGEMENT ---
let peer = null;
let conn = null;
let isHost = false;

// Coordinates are now (x, z) because Y represents height in 3D space
const players = {
  host: { x: -5, z: 0, mesh: null },
  guest: { x: 5, z: 0, mesh: null }
};

const keyboardState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const guestInputs = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// UI Elements
const statusText = document.getElementById('status');
const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const joinIdInput = document.getElementById('joinIdInput');

// --- PEERJS NETWORKING SETUP ---

hostBtn.addEventListener('click', () => {
  isHost = true;
  peer = new Peer();

  peer.on('open', (id) => {
    statusText.innerText = `Hosting! Share ID: ${id}`;
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    statusText.innerText = 'Player 2 connected! Playing game...';
  });
});

joinBtn.addEventListener('click', () => {
  const hostId = joinIdInput.value.trim();
  if (!hostId) return alert('Please enter a Host ID');

  isHost = false;
  peer = new Peer();

  peer.on('open', () => {
    conn = peer.connect(hostId);
    setupConnection();
    statusText.innerText = 'Connecting to Host...';
  });
});

function setupConnection() {
  conn.on('open', () => {
    statusText.innerText = 'Connected! Use Arrow Keys to move in 3D.';
  });

  conn.on('data', (data) => {
    if (isHost) {
      if (data.type === 'INPUT') {
        guestInputs[data.key] = data.isDown;
      }
    } else {
      if (data.type === 'STATE') {
        players.host.x = data.host.x;
        players.host.z = data.host.z;
        players.guest.x = data.guest.x;
        players.guest.z = data.guest.z;
      }
    }
  });
}

// --- THREE.JS INITIALIZATION ---

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

// 1. Camera & Renderer Setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 15); // Position camera high above ground pointing down
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Lights & Ground Grid
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

const gridHelper = new THREE.GridHelper(30, 30);
scene.add(gridHelper);

// 3. Create Player Meshes (Spheres instead of 2D circles)
const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32);

// Host = Red Sphere, Guest = Blue Sphere
players.host.mesh = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xff4444 }));
players.guest.mesh = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0x4488ff }));

scene.add(players.host.mesh);
scene.add(players.guest.mesh);

// --- KEYBOARD LISTENERS ---

window.addEventListener('keydown', (e) => handleKeyChange(e.code, true));
window.addEventListener('keyup', (e) => handleKeyChange(e.code, false));

function handleKeyChange(key, isDown) {
  if (keyboardState.hasOwnProperty(key)) {
    keyboardState[key] = isDown;

    // Guest forwards arrow key states to the Host
    if (!isHost && conn && conn.open) {
      conn.send({ type: 'INPUT', key, isDown });
    }
  }
}

// Handle Window Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- MAIN GAME LOOP ---

const SPEED = 0.15;

function animate() {
  requestAnimationFrame(animate);

  if (isHost) {
    // --- HOST GAME LOGIC (GROUND TRUTH) ---

    // Move Host Sphere (P1)
    if (keyboardState.ArrowLeft) players.host.x -= SPEED;
    if (keyboardState.ArrowRight) players.host.x += SPEED;
    if (keyboardState.ArrowUp) players.host.z -= SPEED;
    if (keyboardState.ArrowDown) players.host.z += SPEED;

    // Move Guest Sphere (P2) using inputs received over WebRTC
    if (guestInputs.ArrowLeft) players.guest.x -= SPEED;
    if (guestInputs.ArrowRight) players.guest.x += SPEED;
    if (guestInputs.ArrowUp) players.guest.z -= SPEED;
    if (guestInputs.ArrowDown) players.guest.z += SPEED;

    // Broadcast updated 3D coordinates to Guest
    if (conn && conn.open) {
      conn.send({
        type: 'STATE',
        host: { x: players.host.x, z: players.host.z },
        guest: { x: players.guest.x, z: players.guest.z }
      });
    }
  }

  // Render 3D positions
  players.host.mesh.position.set(players.host.x, 0.8, players.host.z);
  players.guest.mesh.position.set(players.guest.x, 0.8, players.guest.z);

  // Render frame
  renderer.render(scene, camera);
}

// Start game loop
animate();