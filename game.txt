// --- NETWORK & GAME STATE MANAGEMENT ---
let peer = null;
let conn = null;
let isHost = false;
let gameScene = null;

// Local Player State
const players = {
  host: { x: 200, y: 300, circle: null },
  guest: { x: 600, y: 300, circle: null }
};

const guestInputs = { up: false, down: false, left: false, right: false };

// UI Elements
const statusText = document.getElementById('status');
const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const joinIdInput = document.getElementById('joinIdInput');

// --- PEERJS NETWORKING SETUP ---

// 1. Host Initializer
hostBtn.addEventListener('click', () => {
  isHost = true;
  peer = new Peer(); // Generates a random Peer ID using PeerJS's free signaling server

  peer.on('open', (id) => {
	statusText.innerText = `Hosting! Share this ID with Player 2: ${id}`;
  });

  peer.on('connection', (connection) => {
	conn = connection;
	setupConnection();
	statusText.innerText = 'Player 2 connected! Playing game...';
  });
});

// 2. Guest Initializer
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

// 3. Connection Event Handlers
function setupConnection() {
  conn.on('open', () => {
	statusText.innerText = 'Connected! Use Arrow Keys to Move.';
  });

  conn.on('data', (data) => {
	if (isHost) {
	  // Host receives directional input from Guest
	  if (data.type === 'INPUT') {
		guestInputs[data.key] = data.isDown;
	  }
	} else {
	  // Guest receives position updates from Host
	  if (data.type === 'STATE') {
		players.host.x = data.host.x;
		players.host.y = data.host.y;
		players.guest.x = data.guest.x;
		players.guest.y = data.guest.y;
	  }
	}
  });
}

// --- PHASER 3 GAME LOGIC ---

class MainScene extends Phaser.Scene {
  constructor() {
	super({ key: 'MainScene' });
  }

  create() {
	gameScene = this;

	// Create Circle Graphics
	// Red Circle = Host, Blue Circle = Guest
	players.host.circle = this.add.circle(players.host.x, players.host.y, 20, 0xff4444);
	players.guest.circle = this.add.circle(players.guest.x, players.guest.y, 20, 0x4488ff);

	// Setup Cursor Keys (Arrow Keys)
	this.cursors = this.input.keyboard.createCursorKeys();

	// Listen to Keyboard Press/Release Events
	const keys = ['up', 'down', 'left', 'right'];
	keys.forEach((key) => {
	  this.cursors[key].on('down', () => this.handleKeyChange(key, true));
	  this.cursors[key].on('up', () => this.handleKeyChange(key, false));
	});
  }

  handleKeyChange(key, isDown) {
	if (!conn || !conn.open) return;

	if (!isHost) {
	  // Guest sends key states to the Host
	  conn.send({ type: 'INPUT', key, isDown });
	}
  }

  update() {
	const SPEED = 5;

	if (isHost) {
	  // --- HOST GAME LOGIC (GROUND TRUTH) ---
	  
	  // Move Host Player (P1) based on local arrow keys
	  if (this.cursors.left.isDown) players.host.x -= SPEED;
	  if (this.cursors.right.isDown) players.host.x += SPEED;
	  if (this.cursors.up.isDown) players.host.y -= SPEED;
	  if (this.cursors.down.isDown) players.host.y += SPEED;

	  // Move Guest Player (P2) based on inputs received over PeerJS
	  if (guestInputs.left) players.guest.x -= SPEED;
	  if (guestInputs.right) players.guest.x += SPEED;
	  if (guestInputs.up) players.guest.y -= SPEED;
	  if (guestInputs.down) players.guest.y += SPEED;

	  // Broadcast position updates to Guest at 60 FPS
	  if (conn && conn.open) {
		conn.send({
		  type: 'STATE',
		  host: { x: players.host.x, y: players.host.y },
		  guest: { x: players.guest.x, y: players.guest.y }
		});
	  }
	}

	// Render positions on screen for both Host and Guest
	if (players.host.circle && players.guest.circle) {
	  players.host.circle.setPosition(players.host.x, players.host.y);
	  players.guest.circle.setPosition(players.guest.x, players.guest.y);
	}
  }
}

// Phaser Game Configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#222222',
  scene: MainScene
};

const game = new Phaser.Game(config);