/* ==========================================================================
   BMU F1 - JEDDAH CORNICHE CIRCUIT (SAUDI ARABIA) RACING SIMULATOR
   Authentic FIA 5-Red-Lights Standing Grid Start Sequence (Zero Auto-Start!)
   True Player-Controlled Free-Steering Physics • Real F1 Broadcast Timing Tower
   Dynamic 4-Car Grid Race against Leclerc #16, Hamilton #44 & Norris #4
   Slipstream Drafting • Overtake Banners • High-Fidelity Arabian Night Environment
   ========================================================================== */

let gameScene, gameCamera, gameRenderer;
let gameRunning = false;
let gameAnimId = null;
let cameraMode = 'cockpit'; // Default: First-Person Open-Wheel Cockpit POV
let gameAudioEnabled = true;

// Race Game State: 'grid', 'countdown', 'racing', 'finished'
let raceState = 'grid';
let countdownStep = 0;
let countdownTimer = null;
let playerPosition = 4;
let lastOvertakeTime = 0;

// Track & Circuit Environment
let trackCurve = null;
let trackPoints = [];
let trackLength = 0;
let trackMesh = null;
let roadTexture = null;
let curbsGroup = null;
let barriersGroup = null;
let floodlightsGroup = null;
let palmTreesGroup = null;
let grandstandsGroup = null;
let citySkylineGroup = null;
let trackMarkingsGroup = null;
let sparkParticles = null;
let windParticles = null;
let skyDomeMesh = null;
let starPoints = null;

// Player Vehicle 3D Model & Meshes
let playerCarMesh = null;
let wheelMeshes = [];
let frontLeftWheelPivot = null, frontRightWheelPivot = null;
let drsFlapMesh = null;
let carHeadlightL = null, carHeadlightR = null;

// Cockpit Open-Wheel Elements (Visible from Driver Seat!)
let cockpitGroup = null;
let cockpitLeftWheelPivot = null, cockpitRightWheelPivot = null;
let cockpitWheelMeshes = [];
let cockpitLeftTyreStripe = null, cockpitRightTyreStripe = null;
let steeringWheelMesh = null;
let shiftLeds = [];
let dashCanvas = null, dashCtx = null, dashTexture = null;

// AI Competitor Racers on Track
let aiCars = [];

// Player Vehicle Dynamics & Physics State (Full Player Control!)
let carState = {
  pos: new THREE.Vector3(3.0, 0.12, 25.0), // Starts in P4 grid slot on the main straight!
  yaw: 0,                                 // World Heading in Radians (0 = straight along +Z)
  speed: 0,                               // Forward velocity in m/s (1 m/s = 3.6 km/h)
  gear: 1,                                // 1 to 8
  rpm: 4500,                              // 4000 to 13500
  steerAngle: 0,                          // -1 (Left) to +1 (Right)
  throttle: 0,                            // 0 to 1
  brake: 0,                               // 0 to 1
  drsActive: false,
  drsEligible: false,
  slipstreamActive: false,
  distance: 25.0,                         // Progress along track spline in meters
  trackSplineIdx: 4,                      // Cached closest spline index
  tyreCompound: 'soft',                   // 'soft', 'medium', 'hard'
  horsePower: 980,                        // 750 to 1100 BHP
  brakePower: 75,                         // 40% to 100%
  downforce: 50,                          // 10% to 100%
  gearRatio: 3.8,                         // 3.0 to 4.8
  suspension: 65,                         // 30% to 100%
  ersPower: 120,                          // 50 to 180 kW
  liveryAccent: '#FF9933'
};

// 1-Lap Race & Timing State
let lapStartTime = null;
let currentLapTime = 0;
let bestLapTime = null;
let raceFinished = false;
let topSpeedThisLap = 0;
let lastCheckpoints = [];
const TOTAL_CHECKPOINTS = 14;

// Leaderboard Display Mode (PR vs All)
let leaderboardPRMode = true;

// Input Key Map
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  drs: false
};

// Procedural V6 Sound Engine
let gameAudioCtx = null;
let gameOsc1 = null, gameOsc2 = null, gameOscTurbo = null, gameGain = null, gameFilter = null;

/* ==========================================================================
   1. JEDDAH CORNICHE CIRCUIT SPLINE GEOMETRY
   Full 4.26 km fast street circuit along the Red Sea waterfront
   ========================================================================== */
function buildJeddahSpline() {
  const rawPoints = [
    // Main Straight & Turn 1-2 Chicane
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 180),
    new THREE.Vector3(-18, 0, 260),
    new THREE.Vector3(22, 0, 310),

    // Turns 3 to 10 - High-Speed Fast S-Curves
    new THREE.Vector3(75, 0, 420),
    new THREE.Vector3(45, 0, 560),
    new THREE.Vector3(110, 0, 710),
    new THREE.Vector3(60, 0, 870),
    new THREE.Vector3(125, 0, 1020),
    new THREE.Vector3(80, 0, 1160),

    // Turn 13 - Banked Hairpin
    new THREE.Vector3(160, 1.2, 1310),
    new THREE.Vector3(260, 1.8, 1360),
    new THREE.Vector3(340, 1.2, 1290),
    new THREE.Vector3(330, 0, 1180),

    // Fast Waterfront Straight & Sweeping Bends (DRS Zone 2)
    new THREE.Vector3(290, 0, 980),
    new THREE.Vector3(320, 0, 780),
    new THREE.Vector3(260, 0, 600),
    new THREE.Vector3(295, 0, 440),
    new THREE.Vector3(230, 0, 280),
    new THREE.Vector3(250, 0, 140),

    // Turns 22 to 26 - High G-Force Ess Curves
    new THREE.Vector3(180, 0, -20),
    new THREE.Vector3(210, 0, -180),
    new THREE.Vector3(150, 0, -320),
    new THREE.Vector3(190, 0, -450),

    // Turn 27 - Final Apex & Entry onto Main Straight (DRS Zone 1)
    new THREE.Vector3(110, 0, -560),
    new THREE.Vector3(10, 0, -540),
    new THREE.Vector3(-30, 0, -420),
    new THREE.Vector3(-10, 0, -260),
    new THREE.Vector3(0, 0, -120)
  ];

  trackCurve = new THREE.CatmullRomCurve3(rawPoints, true, 'centripetal', 0.5);
  trackLength = trackCurve.getLength();
  trackPoints = trackCurve.getPoints(700);
}

/* ==========================================================================
   2. THREE.JS ENGINE INITIALIZATION & ATMOSPHERIC NIGHT ENVIRONMENT
   ========================================================================== */
function initGameScene() {
  const container = document.getElementById('game-canvas-container');
  if (!container) return;

  const width = Math.max(container.clientWidth || 960, 480);
  const height = Math.max(container.clientHeight || 560, 400);

  if (gameScene && gameRenderer) {
    onGameWindowResize();
    if (!gameRunning) {
      gameRunning = true;
      lastFrameTime = performance.now();
      if (gameAnimId) cancelAnimationFrame(gameAnimId);
      gameAnimId = requestAnimationFrame(gameLoop);
    }
    return;
  }

  // 1. Atmosphere & Fog (Deep Arabian Night)
  gameScene = new THREE.Scene();
  gameScene.background = new THREE.Color(0x060c18);
  gameScene.fog = new THREE.FogExp2(0x07111e, 0.00095);

  // 2. Camera Setup (First-Person Cockpit POV)
  gameCamera = new THREE.PerspectiveCamera(68, width / height, 0.1, 4000);

  // 3. WebGL Renderer with High-Performance Tone Mapping
  gameRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  gameRenderer.setSize(width, height);
  gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  gameRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  gameRenderer.toneMappingExposure = 1.28;

  container.innerHTML = '';
  container.appendChild(gameRenderer.domElement);

  // 4. Vibrant Night Stadium Lighting Rig with Deep Contrast
  const ambientLight = new THREE.AmbientLight(0x283850, 0.55);
  gameScene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x446699, 0x0c1420, 0.45);
  gameScene.add(hemiLight);

  const stadiumLight1 = new THREE.DirectionalLight(0xffeedd, 2.1);
  stadiumLight1.position.set(250, 380, 200);
  gameScene.add(stadiumLight1);

  const stadiumLight2 = new THREE.DirectionalLight(0x5588dd, 1.2);
  stadiumLight2.position.set(-250, 280, -200);
  gameScene.add(stadiumLight2);

  // 5. Build Environment, Track Details, Grandstands, Buildings & Car
  buildJeddahSpline();
  buildArabianSkyDome();
  buildTwinklingStars();
  buildCrescentMoon();
  buildGroundAndRedSea();
  buildCitySkyline();
  buildJeddahTrackMesh();
  buildTrackMarkings();
  buildGrandstands();
  buildStartFinishGantry();
  buildDrsArches();
  buildPalmTrees();
  buildTracksideDistanceMarkers();
  buildPlayerCar();
  buildCockpitPOV();
  buildAiCompetitors();
  buildSparkParticles();
  buildWindStreakParticles();

  gameScene.add(gameCamera);

  // Park Player on Starting Grid (P4 slot: X = 3.0, Z = 25.0, Facing forward along +Z)
  resetGridPositions();

  // 6. Setup Controls, Garage Setup & Leaderboard
  setupGameInputListeners();
  loadUserGarageSetup();
  loadGameLeaderboard();

  window.addEventListener('resize', onGameWindowResize);

  // 7. Start Animation Loop
  gameRunning = true;
  lastFrameTime = performance.now();
  if (gameAnimId) cancelAnimationFrame(gameAnimId);
  gameAnimId = requestAnimationFrame(gameLoop);
}

function onGameWindowResize() {
  const container = document.getElementById('game-canvas-container');
  if (!container || !gameRenderer || !gameCamera) return;
  const w = Math.max(container.clientWidth || 960, 480);
  const h = Math.max(container.clientHeight || 560, 400);
  gameCamera.aspect = w / h;
  gameCamera.updateProjectionMatrix();
  gameRenderer.setSize(w, h);
}

/* ==========================================================================
   3. ARABIAN SKY DOME, 1600 TWINKLING STARS & CRESCENT MOON
   ========================================================================== */
function buildArabianSkyDome() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#02050e');
  grad.addColorStop(0.4, '#060f22');
  grad.addColorStop(0.75, '#0d1d3c');
  grad.addColorStop(0.95, '#192b4d');
  grad.addColorStop(1.0, '#22385e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  const tex = new THREE.CanvasTexture(canvas);
  const domeGeom = new THREE.SphereGeometry(3200, 32, 24);
  const domeMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    fog: false
  });
  skyDomeMesh = new THREE.Mesh(domeGeom, domeMat);
  gameScene.add(skyDomeMesh);
}

function buildTwinklingStars() {
  const starCount = 1600;
  const starGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85 + 0.15);
    const r = 3000 + Math.random() * 100;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const isCyan = Math.random() < 0.25;
    colors[i * 3] = isCyan ? 0.8 : 1.0;
    colors[i * 3 + 1] = isCyan ? 0.95 : 0.98;
    colors[i * 3 + 2] = 1.0;
  }

  starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 4.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    fog: false
  });
  starPoints = new THREE.Points(starGeom, starMat);
  gameScene.add(starPoints);
}

function buildCrescentMoon() {
  const moonGroup = new THREE.Group();
  moonGroup.position.set(700, 1200, -1800);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffeedd,
    transparent: true,
    opacity: 0.22,
    fog: false
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(52, 32), haloMat);
  moonGroup.add(halo);

  const moonMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6, fog: false });
  const moonBody = new THREE.Mesh(new THREE.CircleGeometry(36, 32), moonMat);
  moonGroup.add(moonBody);

  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x060f22, fog: false });
  const moonShadow = new THREE.Mesh(new THREE.CircleGeometry(34, 32), shadowMat);
  moonShadow.position.set(14, 6, 0.5);
  moonGroup.add(moonShadow);

  gameScene.add(moonGroup);
}

/* ==========================================================================
   4. JEDDAH WATERFRONT, RED SEA & CITY SKYLINE TOWERS
   ========================================================================== */
function buildGroundAndRedSea() {
  const groundGeom = new THREE.PlaneGeometry(6000, 6000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0c111c, roughness: 0.92 });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(150, -0.05, 600);
  gameScene.add(ground);

  const seaGeom = new THREE.PlaneGeometry(5500, 5500);
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x06142a,
    roughness: 0.15,
    metalness: 0.88
  });
  const sea = new THREE.Mesh(seaGeom, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(1300, -0.35, 600);
  gameScene.add(sea);

  const yachtMat = new THREE.MeshStandardMaterial({ color: 0xF4F6F9, roughness: 0.3 });
  const yachtGlassMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  for (let y = 0; y < 9; y++) {
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 22), yachtMat);
    hull.position.y = 0.8;
    yacht.add(hull);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 12), yachtMat);
    cabin.position.set(0, 2.6, -1);
    yacht.add(cabin);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 11, 8), yachtMat);
    mast.position.set(0, 7.5, 1);
    yacht.add(mast);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), yachtGlassMat);
    beacon.position.set(0, 13.0, 1);
    yacht.add(beacon);

    yacht.position.set(380 + (y % 3) * 35, 0, 420 + y * 95);
    yacht.rotation.y = 0.25 + (y * 0.18);
    gameScene.add(yacht);
  }
}

function buildCitySkyline() {
  citySkylineGroup = new THREE.Group();

  const buildingColors = [0x121929, 0x162238, 0x101726, 0x1a263d];
  const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const neonGoldMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
  const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xE02080 });

  const numBuildings = 42;
  for (let b = 0; b < numBuildings; b++) {
    const height = 65 + (b * 23) % 115;
    const width = 22 + (b * 9) % 30;
    const depth = 20 + (b * 7) % 24;

    const bMat = new THREE.MeshStandardMaterial({
      color: buildingColors[b % buildingColors.length],
      metalness: 0.8,
      roughness: 0.28
    });
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bMat);

    const angle = (b / numBuildings) * Math.PI * 1.8 - 0.5;
    const dist = 340 + ((b * 53) % 310);
    const bx = 160 + Math.sin(angle) * dist;
    const bz = 600 + Math.cos(angle) * dist;

    bMesh.position.set(bx, height / 2, bz);
    citySkylineGroup.add(bMesh);

    const crownMat = (b % 3 === 0) ? neonCyanMat : ((b % 3 === 1) ? neonGoldMat : neonMagentaMat);
    const roofNeon = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.6, 1.6, depth + 0.6),
      crownMat
    );
    roofNeon.position.set(bx, height + 0.8, bz);
    citySkylineGroup.add(roofNeon);

    if (b % 4 === 0) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.45, 24, 8),
        new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9 })
      );
      spire.position.set(bx, height + 12, bz);
      citySkylineGroup.add(spire);

      const redBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xE10600 })
      );
      redBeacon.position.set(bx, height + 24, bz);
      citySkylineGroup.add(redBeacon);
    }

    for (let w = 0; w < 5; w++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, 1.5), windowGlowMat);
      win.position.set(bx, height * (0.22 + w * 0.16), bz + depth / 2 + 0.1);
      citySkylineGroup.add(win);
    }
  }

  gameScene.add(citySkylineGroup);
}

function buildGrandstands() {
  grandstandsGroup = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x222836, roughness: 0.82 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xF4F6F9, roughness: 0.25, metalness: 0.25 });
  const seatMat = new THREE.MeshBasicMaterial({ color: 0xE10600 });
  const yellowSeatMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

  const standLength = 190;
  for (let tier = 0; tier < 7; tier++) {
    const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(standLength, 1.3, 2.2), concreteMat);
    tierMesh.position.set(-16.8 - tier * 1.8, 0.65 + tier * 1.3, 90);
    grandstandsGroup.add(tierMesh);

    const sMat = (tier % 2 === 0) ? seatMat : yellowSeatMat;
    const seats = new THREE.Mesh(new THREE.BoxGeometry(standLength * 0.98, 0.38, 1.4), sMat);
    seats.position.set(-16.8 - tier * 1.8, 1.45 + tier * 1.3, 90);
    grandstandsGroup.add(seats);
  }

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(standLength, 0.65, 18), canopyMat);
  canopy.position.set(-23, 12.2, 90);
  canopy.rotation.z = -0.12;
  grandstandsGroup.add(canopy);

  const pitWallMat = new THREE.MeshStandardMaterial({ color: 0x1a212e, metalness: 0.8 });
  const pitWall = new THREE.Mesh(new THREE.BoxGeometry(standLength, 1.4, 0.9), pitWallMat);
  pitWall.position.set(10.5, 0.7, 90);
  grandstandsGroup.add(pitWall);

  const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const neonOrange = new THREE.MeshBasicMaterial({ color: 0xFF9933 });
  for (let p = 0; p < 9; p++) {
    const perch = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.4, 2.0), pitWallMat);
    perch.position.set(11.6, 1.6, 20 + p * 18);
    grandstandsGroup.add(perch);

    const screenMat = (p % 2 === 0) ? neonCyan : neonOrange;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.3), screenMat);
    screen.position.set(10.55, 2.15, 20 + p * 18);
    screen.rotation.y = -Math.PI / 2;
    grandstandsGroup.add(screen);
  }

  gameScene.add(grandstandsGroup);
}

function buildPalmTrees() {
  palmTreesGroup = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x145218, roughness: 0.55 });
  const uplightMat = new THREE.MeshBasicMaterial({ color: 0xffd277 });

  for (let i = 310; i < 480; i += 6) {
    const u = i / 600;
    const pt = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 8.0, 6), trunkMat);
    trunk.position.y = 4.0;
    palm.add(trunk);

    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 7), leafMat);
    leaves.position.y = 8.0;
    palm.add(leaves);

    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), uplightMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(0, 0.05, 0);
    palm.add(spot);

    palm.position.copy(pt).add(normal.clone().multiplyScalar(15.8));
    palmTreesGroup.add(palm);
  }
  gameScene.add(palmTreesGroup);
}

/* ==========================================================================
   5. PROCEDURAL RACING ASPHALT & REAL F1 SPONSOR LIGHTBOARDS
   ========================================================================== */
function createProceduralRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#242b3a';
  ctx.fillRect(0, 0, 1024, 2048);

  ctx.fillStyle = '#1c2230';
  for (let g = 0; g < 9000; g++) {
    const gx = Math.random() * 1024;
    const gy = Math.random() * 2048;
    ctx.fillRect(gx, gy, 2, 2);
  }

  const rubberGradL = ctx.createLinearGradient(260, 0, 420, 0);
  rubberGradL.addColorStop(0, 'rgba(14, 18, 26, 0)');
  rubberGradL.addColorStop(0.5, 'rgba(10, 14, 20, 0.90)');
  rubberGradL.addColorStop(1, 'rgba(14, 18, 26, 0)');
  ctx.fillStyle = rubberGradL;
  ctx.fillRect(260, 0, 160, 2048);

  const rubberGradR = ctx.createLinearGradient(604, 0, 764, 0);
  rubberGradR.addColorStop(0, 'rgba(14, 18, 26, 0)');
  rubberGradR.addColorStop(0.5, 'rgba(10, 14, 20, 0.90)');
  rubberGradR.addColorStop(1, 'rgba(14, 18, 26, 0)');
  ctx.fillStyle = rubberGradR;
  ctx.fillRect(604, 0, 160, 2048);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(32, 0, 20, 2048);
  ctx.fillRect(972, 0, 20, 2048);

  ctx.fillStyle = '#ffffff';
  for (let d = 0; d < 2048; d += 120) {
    ctx.fillRect(504, d, 16, 68);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 140);
  return tex;
}

function createF1SponsorTexture(brandName, bgColor, fgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = fgColor;
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 122, 512, 6);

  ctx.fillStyle = fgColor;
  ctx.font = '900 52px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandName, 256, 66);

  return new THREE.CanvasTexture(canvas);
}

function buildJeddahTrackMesh() {
  const trackWidth = 14;
  const segments = 600;

  const roadGeom = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const point = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const left = point.clone().add(normal.clone().multiplyScalar(-trackWidth / 2));
    const right = point.clone().add(normal.clone().multiplyScalar(trackWidth / 2));

    positions.push(left.x, left.y + 0.05, left.z);
    positions.push(right.x, right.y + 0.05, right.z);

    uvs.push(0, u);
    uvs.push(1, u);

    if (i < segments) {
      const idx = i * 2;
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx + 1, idx + 3, idx + 2);
    }
  }

  roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeom.setIndex(indices);
  roadGeom.computeVertexNormals();

  roadTexture = createProceduralRoadTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.62,
    metalness: 0.18,
    side: THREE.DoubleSide
  });
  trackMesh = new THREE.Mesh(roadGeom, roadMat);
  gameScene.add(trackMesh);

  curbsGroup = new THREE.Group();
  barriersGroup = new THREE.Group();
  floodlightsGroup = new THREE.Group();

  const curbGeom = new THREE.BoxGeometry(1.1, 0.18, 2.6);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xE10600, roughness: 0.35 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.35 });
  const saudiGreenMat = new THREE.MeshStandardMaterial({ color: 0x006C35, roughness: 0.35 });

  const barrierGeom = new THREE.BoxGeometry(0.5, 1.45, 4.2);
  const barrierBodyMat = new THREE.MeshStandardMaterial({ color: 0x1b202c, metalness: 0.7 });

  const sponsorBoards = [
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('PIRELLI', '#D80000', '#FFEA00') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('ARAMCO', '#002B49', '#00A3E0') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('ROLEX', '#004B28', '#D4AF37') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('DHL', '#FFCC00', '#D40511') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('stc', '#4F008C', '#FF375F') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('SAUDIA', '#003319', '#C0A062') }),
    new THREE.MeshBasicMaterial({ map: createF1SponsorTexture('BMU F1', '#08172E', '#FF8500') })
  ];

  for (let i = 0; i < segments; i += 2) {
    const u = i / segments;
    const pt = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const curbMatL = (i % 6 < 2) ? redMat : ((i % 6 < 4) ? whiteMat : saudiGreenMat);
    const curbLeft = new THREE.Mesh(curbGeom, curbMatL);
    curbLeft.position.copy(pt).add(normal.clone().multiplyScalar(-trackWidth / 2 - 0.55));
    curbLeft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    curbsGroup.add(curbLeft);

    const curbMatR = (i % 6 < 2) ? whiteMat : ((i % 6 < 4) ? saudiGreenMat : redMat);
    const curbRight = new THREE.Mesh(curbGeom, curbMatR);
    curbRight.position.copy(pt).add(normal.clone().multiplyScalar(trackWidth / 2 + 0.55));
    curbRight.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    curbsGroup.add(curbRight);

    if (i % 3 === 0) {
      const sponsorMat = sponsorBoards[(i / 3) % sponsorBoards.length];

      const barLeft = new THREE.Mesh(barrierGeom, barrierBodyMat);
      barLeft.position.copy(pt).add(normal.clone().multiplyScalar(-trackWidth / 2 - 1.45));
      barLeft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      const signL = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.95), sponsorMat);
      signL.position.set(0.26, 0.42, 0);
      signL.rotation.y = Math.PI / 2;
      barLeft.add(signL);
      barriersGroup.add(barLeft);

      const barRight = new THREE.Mesh(barrierGeom, barrierBodyMat);
      barRight.position.copy(pt).add(normal.clone().multiplyScalar(trackWidth / 2 + 1.45));
      barRight.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      const signR = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.95), sponsorMat);
      signR.position.set(-0.26, 0.42, 0);
      signR.rotation.y = -Math.PI / 2;
      barRight.add(signR);
      barriersGroup.add(barRight);
    }

    if (i % 16 === 0) {
      const tower = buildFloodlightTower();
      tower.position.copy(pt).add(normal.clone().multiplyScalar(trackWidth / 2 + 4.5));
      tower.position.y = 0;
      floodlightsGroup.add(tower);
    }
  }

  gameScene.add(curbsGroup);
  gameScene.add(barriersGroup);
  gameScene.add(floodlightsGroup);
}

function buildFloodlightTower() {
  const g = new THREE.Group();

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.35, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.85, roughness: 0.25 })
  );
  mast.position.y = 8;
  g.add(mast);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.8, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x111624, metalness: 0.9 })
  );
  head.position.y = 16;
  g.add(head);

  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
  for (let l = -2; l <= 2; l++) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), lampGlowMat);
    lamp.position.set(l * 0.65, 16, -0.56);
    g.add(lamp);
  }

  return g;
}

function buildTrackMarkings() {
  trackMarkingsGroup = new THREE.Group();
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

  for (let slot = 0; slot < 10; slot++) {
    const isOdd = slot % 2 === 1;
    const zOffset = 25 + slot * 15;
    const xOffset = isOdd ? -3.0 : 3.0;

    const box = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.0), whiteMat);
    box.rotation.x = -Math.PI / 2;
    box.position.set(xOffset, 0.08, zOffset);
    trackMarkingsGroup.add(box);

    const innerAsphalt = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.6), new THREE.MeshBasicMaterial({ color: 0x2e3648 }));
    innerAsphalt.rotation.x = -Math.PI / 2;
    innerAsphalt.position.set(xOffset, 0.09, zOffset);
    trackMarkingsGroup.add(innerAsphalt);

    const poleLine = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.24), yellowMat);
    poleLine.rotation.x = -Math.PI / 2;
    poleLine.position.set(xOffset, 0.10, zOffset + 2.4);
    trackMarkingsGroup.add(poleLine);
  }

  gameScene.add(trackMarkingsGroup);
}

function buildStartFinishGantry() {
  const gantryGroup = new THREE.Group();
  const p0 = trackCurve.getPointAt(0);
  const tan0 = trackCurve.getTangentAt(0).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const norm0 = new THREE.Vector3().crossVectors(tan0, up).normalize();

  const pillarGeom = new THREE.BoxGeometry(0.9, 9.5, 0.9);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, metalness: 0.85 });

  const pL = new THREE.Mesh(pillarGeom, pillarMat);
  pL.position.copy(p0).add(norm0.clone().multiplyScalar(-9.5)).setY(4.75);
  gantryGroup.add(pL);

  const pR = new THREE.Mesh(pillarGeom, pillarMat);
  pR.position.copy(p0).add(norm0.clone().multiplyScalar(9.5)).setY(4.75);
  gantryGroup.add(pR);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.8, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0f1520, metalness: 0.9 })
  );
  beam.position.copy(p0).setY(8.6);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm0);
  gantryGroup.add(beam);

  for (let i = -2; i <= 2; i++) {
    const bulb = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 14),
      new THREE.MeshBasicMaterial({ color: 0x220000 })
    );
    bulb.position.copy(p0).setY(7.8).add(norm0.clone().multiplyScalar(i * 1.15));
    gantryGroup.add(bulb);
  }

  const checkCanvas = document.createElement('canvas');
  checkCanvas.width = 256;
  checkCanvas.height = 64;
  const cctx = checkCanvas.getContext('2d');
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 8; c++) {
      cctx.fillStyle = ((r + c) % 2 === 0) ? '#ffffff' : '#111318';
      cctx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const checkTex = new THREE.CanvasTexture(checkCanvas);
  const startLine = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 2.6),
    new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide })
  );
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.copy(p0).setY(0.08);
  startLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan0);
  startLine.rotateX(-Math.PI / 2);
  gantryGroup.add(startLine);

  gameScene.add(gantryGroup);
}

function buildDrsArches() {
  const drsUValues = [0.05, 0.55, 0.88];
  drsUValues.forEach(u => {
    const pt = trackCurve.getPointAt(u);
    const tan = trackCurve.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const norm = new THREE.Vector3().crossVectors(tan, up).normalize();

    const arch = new THREE.Group();

    const pMat = new THREE.MeshStandardMaterial({ color: 0x1a212e, metalness: 0.8 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), pMat);
    p1.position.copy(pt).add(norm.clone().multiplyScalar(-8.2)).setY(3.75);
    arch.add(p1);

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), pMat);
    p2.position.copy(pt).add(norm.clone().multiplyScalar(8.2)).setY(3.75);
    arch.add(p2);

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(17, 1.2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00E676 })
    );
    beam.position.copy(pt).setY(7.2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
    arch.add(beam);

    gameScene.add(arch);
  });
}

function buildTracksideDistanceMarkers() {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x111318 });

  const brakeZones = [
    { u: 0.04, label: 'T1' },
    { u: 0.35, label: 'T13' },
    { u: 0.94, label: 'T27' }
  ];

  brakeZones.forEach(zone => {
    [200, 150, 100, 50].forEach(dist => {
      const uMarker = (zone.u - (dist / trackLength) + 1.0) % 1.0;
      const pt = trackCurve.getPointAt(uMarker);
      const tan = trackCurve.getTangentAt(uMarker).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const norm = new THREE.Vector3().crossVectors(tan, up).normalize();

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.6), whiteMat);
      board.position.copy(pt).add(norm.clone().multiplyScalar(8.8)).setY(0.7);
      board.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 1.5), blackMat);
      stripe.position.set(0, 0.15, 0);
      board.add(stripe);

      g.add(board);
    });
  });

  gameScene.add(g);
}

/* ==========================================================================
   6. HIGH-VELOCITY PARTICLES (TITANIUM SPARKS & HYPERSPEED STREAKS)
   ========================================================================== */
function buildSparkParticles() {
  const count = 75;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.9;
    positions[i * 3 + 1] = Math.random() * 0.22;
    positions[i * 3 + 2] = -Math.random() * 2.8;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xFFD700,
    size: 0.28,
    transparent: true,
    opacity: 0.92
  });
  sparkParticles = new THREE.Points(geom, mat);
  sparkParticles.visible = false;
  gameScene.add(sparkParticles);
}

function buildWindStreakParticles() {
  const count = 60;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 6.0;
    positions[i * 3 + 1] = 0.2 + Math.random() * 2.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 16.0;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.18,
    transparent: true,
    opacity: 0.5
  });
  windParticles = new THREE.Points(geom, mat);
  windParticles.visible = false;
  gameCamera.add(windParticles);
}

/* ==========================================================================
   7. 3D FORMULA 1 RACECAR MODELS (PLAYER & 3 AI COMPETITORS)
   ========================================================================== */
function createFormula1CarModel(liveryColorHex, accentColorHex) {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: liveryColorHex,
    metalness: 0.85,
    roughness: 0.25
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    metalness: 0.55,
    roughness: 0.35
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x11141a,
    metalness: 0.9,
    roughness: 0.3
  });
  const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x14161b,
    roughness: 0.88
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xD4AF37,
    metalness: 0.9,
    roughness: 0.2
  });
  const redBrakeMat = new THREE.MeshBasicMaterial({ color: 0xE10600 });

  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.45, 3.4), bodyMat);
  tub.position.y = 0.34;
  g.add(tub);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.8, 12), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.28, 2.2);
  g.add(nose);

  const podL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 1.8), bodyMat);
  podL.position.set(-0.62, 0.32, -0.15);
  g.add(podL);

  const podR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 1.8), bodyMat);
  podR.position.set(0.62, 0.32, -0.15);
  g.add(podR);

  const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.55), accentMat);
  fWing.position.set(0, 0.15, 2.75);
  g.add(fWing);

  const rWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.42), carbonMat);
  rWingMain.position.set(0, 0.82, -1.8);
  g.add(rWingMain);

  const flap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.22), accentMat);
  flap.position.set(0, 0.90, -1.72);
  g.add(flap);

  const rainLed = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), redBrakeMat);
  rainLed.position.set(0, 0.35, -1.95);
  g.add(rainLed);

  const wheels = [];
  function createWheel(isRear) {
    const wg = new THREE.Group();
    const radius = isRear ? 0.36 : 0.33;
    const width = isRear ? 0.42 : 0.35;

    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    wg.add(tyre);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.01, 14), rimMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    wheels.push(tyre);
    return wg;
  }

  const pFL = new THREE.Group();
  pFL.position.set(-0.95, 0.33, 1.55);
  pFL.add(createWheel(false));
  g.add(pFL);

  const pFR = new THREE.Group();
  pFR.position.set(0.95, 0.33, 1.55);
  pFR.add(createWheel(false));
  g.add(pFR);

  const pRL = createWheel(true);
  pRL.position.set(-0.98, 0.36, -1.35);
  g.add(pRL);

  const pRR = createWheel(true);
  pRR.position.set(0.98, 0.36, -1.35);
  g.add(pRR);

  return { mesh: g, wheels: wheels, pivotFL: pFL, pivotFR: pFR, drsFlap: flap };
}

function buildPlayerCar() {
  const car = createFormula1CarModel(0x0A2240, 0xFF8500); // BMU Navy & Saffron Livery
  playerCarMesh = car.mesh;
  wheelMeshes = car.wheels;
  frontLeftWheelPivot = car.pivotFL;
  frontRightWheelPivot = car.pivotFR;
  drsFlapMesh = car.drsFlap;

  carHeadlightL = new THREE.SpotLight(0xfffaea, 2.6, 65, Math.PI / 6, 0.35, 1.2);
  carHeadlightL.position.set(-0.55, 0.45, 1.8);
  carHeadlightL.target.position.set(-0.55, 0.1, 28);
  playerCarMesh.add(carHeadlightL);
  playerCarMesh.add(carHeadlightL.target);

  carHeadlightR = new THREE.SpotLight(0xfffaea, 2.6, 65, Math.PI / 6, 0.35, 1.2);
  carHeadlightR.position.set(0.55, 0.45, 1.8);
  carHeadlightR.target.position.set(0.55, 0.1, 28);
  playerCarMesh.add(carHeadlightR);
  playerCarMesh.add(carHeadlightR.target);

  gameScene.add(playerCarMesh);
}

function buildAiCompetitors() {
  aiCars = [];

  // Rival 1: Scuderia Ferrari #16 (Charles Leclerc) - P1 Pole
  const car1 = createFormula1CarModel(0xE10600, 0xFFFFFF);
  gameScene.add(car1.mesh);
  aiCars.push({
    model: car1,
    name: 'LEC',
    fullName: 'Scuderia 16 (Leclerc)',
    gridZ: 70.0,
    gridOffset: -3.0,
    distance: 70.0,
    speed: 0,
    targetSpeed: 84, // ~302 km/h
    lateralOffset: -2.4,
    reactionDelay: 0.25
  });

  // Rival 2: Mercedes Silver Arrow #44 (Lewis Hamilton) - P2
  const car2 = createFormula1CarModel(0x28323e, 0x00E5FF);
  gameScene.add(car2.mesh);
  aiCars.push({
    model: car2,
    name: 'HAM',
    fullName: 'Arrow 44 (Hamilton)',
    gridZ: 55.0,
    gridOffset: 3.0,
    distance: 55.0,
    speed: 0,
    targetSpeed: 83,
    lateralOffset: 2.2,
    reactionDelay: 0.30
  });

  // Rival 3: McLaren Papaya #4 (Lando Norris) - P3
  const car3 = createFormula1CarModel(0xFF8000, 0x00B0FF);
  gameScene.add(car3.mesh);
  aiCars.push({
    model: car3,
    name: 'NOR',
    fullName: 'Papaya 4 (Norris)',
    gridZ: 40.0,
    gridOffset: -3.0,
    distance: 40.0,
    speed: 0,
    targetSpeed: 81,
    lateralOffset: -1.8,
    reactionDelay: 0.38
  });
}

function resetGridPositions() {
  // Player sits on Starting Grid in P4 slot (X = 3.0, Z = 25.0)
  carState.pos.set(3.0, 0.12, 25.0);
  carState.yaw = 0; // Pointing forward along +Z straightaway!
  carState.speed = 0;
  carState.steerAngle = 0;
  carState.throttle = 0;
  carState.brake = 0;
  carState.distance = 25.0;
  carState.trackSplineIdx = 4;
  playerPosition = 4;

  // Position AI cars in their starting grid slots (P1, P2, P3)
  aiCars.forEach(ai => {
    ai.speed = 0;
    ai.distance = ai.gridZ;
    const aiU = ai.distance / trackLength;
    const aiPos = trackCurve.getPointAt(aiU);
    const aiTan = trackCurve.getTangentAt(aiU).normalize();
    const upVec = new THREE.Vector3(0, 1, 0);
    const aiRight = new THREE.Vector3().crossVectors(upVec, aiTan).normalize();

    ai.model.mesh.position.copy(aiPos).add(aiRight.clone().multiplyScalar(ai.gridOffset));
    ai.model.mesh.position.y = aiPos.y + 0.12;
    ai.model.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aiTan);
  });

  updateTimingTower();
}

/* ==========================================================================
   8. FIRST-PERSON OPEN-WHEEL COCKPIT POV (TRUE F1 EXPERIENCE)
   ========================================================================== */
function buildCockpitPOV() {
  cockpitGroup = new THREE.Group();
  cockpitWheelMeshes = [];

  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x141820, metalness: 0.85, roughness: 0.32 });
  const saffronMat = new THREE.MeshStandardMaterial({ color: 0xFF8500, metalness: 0.45, roughness: 0.25 });
  const tyreRubberMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.88 });
  const rimGoldMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.22 });

  // 1. Sleek Lower Carbon Nose Cone (Low profile, wide panoramic view of track)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.2, 14), carbonMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.48, -1.8);
  cockpitGroup.add(nose);

  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 2.0), saffronMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, -0.28, -1.8);
  cockpitGroup.add(stripe);

  // 2. Open-Wheel Front Pirelli Tyres Visible from Cockpit Seat
  function createCockpitWheel(isLeft) {
    const wg = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.32, 16), tyreRubberMat);
    tyre.rotation.z = Math.PI / 2;
    wg.add(tyre);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xE10600 });
    const tyreStripe = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.28, 16), stripeMat);
    tyreStripe.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;
    tyreStripe.position.x = isLeft ? -0.165 : 0.165;
    wg.add(tyreStripe);

    if (isLeft) cockpitLeftTyreStripe = stripeMat;
    else cockpitRightTyreStripe = stripeMat;

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.33, 12), rimGoldMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    cockpitWheelMeshes.push(tyre);
    return wg;
  }

  cockpitLeftWheelPivot = new THREE.Group();
  cockpitLeftWheelPivot.position.set(-0.95, -0.16, -1.75);
  cockpitLeftWheelPivot.add(createCockpitWheel(true));
  cockpitGroup.add(cockpitLeftWheelPivot);

  cockpitRightWheelPivot = new THREE.Group();
  cockpitRightWheelPivot.position.set(0.95, -0.16, -1.75);
  cockpitRightWheelPivot.add(createCockpitWheel(false));
  cockpitGroup.add(cockpitRightWheelPivot);

  // 3. Carbon Suspension Wishbone Rods
  const wishboneMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, metalness: 0.9, roughness: 0.2 });
  const wbUL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.72, 8), wishboneMat);
  wbUL.position.set(-0.58, -0.12, -1.75);
  wbUL.rotation.z = Math.PI / 2 + 0.12;
  cockpitGroup.add(wbUL);

  const wbUR = wbUL.clone();
  wbUR.position.x = 0.58;
  wbUR.rotation.z = -Math.PI / 2 - 0.12;
  cockpitGroup.add(wbUR);

  // 4. Front Wing Mainplane visible at nose tip
  const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.45), carbonMat);
  fWing.position.set(0, -0.38, -2.6);
  cockpitGroup.add(fWing);

  // 5. Left and Right Wing Mirrors
  const mirrorGeom = new THREE.BoxGeometry(0.24, 0.12, 0.08);
  const mirrorGlassMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd });
  const mirrorL = new THREE.Mesh(mirrorGeom, mirrorGlassMat);
  mirrorL.position.set(-0.62, -0.05, -0.92);
  cockpitGroup.add(mirrorL);

  const mirrorR = new THREE.Mesh(mirrorGeom, mirrorGlassMat);
  mirrorR.position.set(0.62, -0.05, -0.92);
  cockpitGroup.add(mirrorR);

  // 6. Sleek Overhead Halo Arch (Center pillar removed for crystal-clear apex view)
  const haloArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.024, 10, 24, Math.PI * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x363d4a, metalness: 0.9, roughness: 0.25 })
  );
  haloArch.rotation.x = Math.PI / 2;
  haloArch.position.set(0, 0.58, -0.65);
  cockpitGroup.add(haloArch);

  // 7. Interactive F1 Steering Wheel with Digital LCD & Shift LEDs
  steeringWheelMesh = new THREE.Group();
  steeringWheelMesh.position.set(0, -0.18, -0.52);

  const wheelBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.22, 0.038),
    new THREE.MeshStandardMaterial({ color: 0x1f232d, roughness: 0.5, metalness: 0.5 })
  );
  steeringWheelMesh.add(wheelBody);

  const gripL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x0f1116, roughness: 0.9 })
  );
  gripL.position.set(-0.19, 0, 0);
  steeringWheelMesh.add(gripL);

  const gripR = gripL.clone();
  gripR.position.x = 0.19;
  steeringWheelMesh.add(gripR);

  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xFF8500, roughness: 0.7 });
  const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.07), gloveMat);
  gloveL.position.set(-0.19, 0, 0.02);
  steeringWheelMesh.add(gloveL);

  const gloveR = gloveL.clone();
  gloveR.position.x = 0.19;
  steeringWheelMesh.add(gloveR);

  dashCanvas = document.createElement('canvas');
  dashCanvas.width = 512;
  dashCanvas.height = 256;
  dashCtx = dashCanvas.getContext('2d');
  dashTexture = new THREE.CanvasTexture(dashCanvas);

  const dashScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.20, 0.10),
    new THREE.MeshBasicMaterial({ map: dashTexture })
  );
  dashScreen.position.set(0, 0.015, 0.022);
  steeringWheelMesh.add(dashScreen);

  shiftLeds = [];
  for (let i = 0; i < 15; i++) {
    const led = new THREE.Mesh(
      new THREE.CircleGeometry(0.0055, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a202c })
    );
    led.position.set(-0.075 + i * 0.011, 0.082, 0.022);
    steeringWheelMesh.add(led);
    shiftLeds.push(led);
  }

  cockpitGroup.add(steeringWheelMesh);

  const cockpitFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.35, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 })
  );
  cockpitFill.position.set(0, -0.32, -0.6);
  cockpitGroup.add(cockpitFill);

  gameCamera.add(cockpitGroup);
}

let lastDashUpdate = 0;
function updateSteeringWheelDash() {
  if (!dashCtx || !dashTexture) return;

  // Steering Wheel: Immediate rotation response every frame
  if (steeringWheelMesh) {
    steeringWheelMesh.rotation.z = -carState.steerAngle * 1.5;
  }

  // Shift LEDs color update every frame
  const rpmNorm = (carState.rpm - 8000) / (13500 - 8000);
  const activeCount = Math.floor(rpmNorm * 15);
  for (let i = 0; i < 15; i++) {
    if (i < activeCount) {
      if (i < 5) shiftLeds[i].material.color.setHex(0x00E676);
      else if (i < 10) shiftLeds[i].material.color.setHex(0xFFD600);
      else shiftLeds[i].material.color.setHex(0xE10600);
    } else {
      shiftLeds[i].material.color.setHex(0x1a202c);
    }
  }

  // Throttle 2D canvas text rasterization to 20 fps to avoid GPU pipeline bottlenecks
  const now = performance.now();
  if (now - lastDashUpdate < 50) return;
  lastDashUpdate = now;

  dashCtx.fillStyle = '#060912';
  dashCtx.fillRect(0, 0, 512, 256);

  dashCtx.fillStyle = '#161d30';
  dashCtx.fillRect(0, 0, 512, 42);
  dashCtx.fillStyle = '#FF9933';
  dashCtx.font = 'bold 22px monospace';
  dashCtx.fillText(`BMU F1 • POS: P${playerPosition}/4`, 18, 30);

  if (carState.drsActive) {
    dashCtx.fillStyle = '#00E676';
    dashCtx.fillRect(360, 6, 134, 30);
    dashCtx.fillStyle = '#000';
    dashCtx.font = 'bold 18px sans-serif';
    dashCtx.fillText('DRS OPEN', 380, 28);
  } else if (carState.drsEligible) {
    dashCtx.fillStyle = '#FF9933';
    dashCtx.fillRect(360, 6, 134, 30);
    dashCtx.fillStyle = '#000';
    dashCtx.font = 'bold 16px sans-serif';
    dashCtx.fillText('DRS READY', 376, 28);
  } else {
    dashCtx.fillStyle = '#263045';
    dashCtx.fillRect(360, 6, 134, 30);
    dashCtx.fillStyle = '#778899';
    dashCtx.font = 'bold 16px sans-serif';
    dashCtx.fillText('DRS OFF', 388, 28);
  }

  dashCtx.fillStyle = '#ffffff';
  dashCtx.font = 'bold 92px monospace';
  dashCtx.textAlign = 'center';
  dashCtx.fillText(carState.gear.toString(), 256, 150);

  const kmh = Math.round(carState.speed * 3.6);
  dashCtx.font = 'bold 38px monospace';
  dashCtx.fillStyle = carState.slipstreamActive ? '#00E5FF' : '#ffffff';
  dashCtx.fillText(`${kmh}`, 110, 125);
  dashCtx.font = 'bold 18px monospace';
  dashCtx.fillStyle = '#88a';
  dashCtx.fillText('KM/H', 110, 155);

  dashCtx.font = 'bold 22px monospace';
  dashCtx.fillStyle = '#FFD700';
  dashCtx.fillText(`${Math.round(carState.rpm)} RPM`, 110, 195);

  const lapStr = formatGameTime(currentLapTime);
  dashCtx.font = 'bold 26px monospace';
  dashCtx.fillStyle = '#fff';
  dashCtx.fillText(lapStr, 400, 125);

  dashCtx.font = 'bold 16px sans-serif';
  dashCtx.fillStyle = (carState.tyreCompound === 'soft') ? '#E10600' : (carState.tyreCompound === 'medium' ? '#FFD700' : '#FFF');
  dashCtx.fillText(`${carState.tyreCompound.toUpperCase()} • ${carState.horsePower} BHP`, 400, 175);

  dashCtx.textAlign = 'left';
  dashTexture.needsUpdate = true;

  const tyreColorHex = (carState.tyreCompound === 'soft') ? 0xE10600 : (carState.tyreCompound === 'medium' ? 0xFFD700 : 0xFFFFFF);
  if (cockpitLeftTyreStripe) cockpitLeftTyreStripe.color.setHex(tyreColorHex);
  if (cockpitRightTyreStripe) cockpitRightTyreStripe.color.setHex(tyreColorHex);
}

/* ==========================================================================
   9. FIA 5-RED-LIGHTS STARTING GRID SEQUENCE
   Zero Auto-Starting! Player explicitly starts the Grand Prix!
   ========================================================================== */
function playBeep(freq, duration) {
  if (!gameAudioEnabled || !gameAudioCtx) return;
  try {
    const osc = gameAudioCtx.createOscillator();
    const gain = gameAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, gameAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, gameAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, gameAudioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(gameAudioCtx.destination);
    osc.start();
    osc.stop(gameAudioCtx.currentTime + duration);
  } catch (e) {}
}

function launchRace() {
  if (raceState === 'racing') return;
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  initGameAudio();
  raceState = 'racing';
  if (!lapStartTime) lapStartTime = Date.now();

  const overlay = document.getElementById('hudStartGantryOverlay');
  const btn = document.getElementById('btnStartRace');
  const msg = document.getElementById('gantryMessage');
  if (btn) btn.style.display = 'none';
  if (msg) {
    msg.textContent = '🟢 LIGHTS OUT AND AWAY WE GO!';
    msg.style.color = '#00E676';
  }
  for (let i = 1; i <= 5; i++) {
    const b = document.getElementById(`gBulb${i}`);
    if (b) {
      b.classList.remove('red');
      b.classList.add('green');
    }
  }
  playBeep(1760, 0.45);

  setTimeout(() => {
    if (overlay) overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 350);
  }, 1100);
}

function startRaceCountdown() {
  if (raceState === 'racing') return;
  if (raceState === 'countdown') {
    launchRace();
    return;
  }
  initGameAudio();
  raceState = 'countdown';

  const btn = document.getElementById('btnStartRace');
  if (btn) btn.style.display = 'none';

  const msg = document.getElementById('gantryMessage');
  if (msg) {
    msg.textContent = 'GET READY... PRESS W OR ENTER TO LAUNCH!';
    msg.style.color = 'var(--gold)';
  }

  function setBulb(n, on) {
    const b = document.getElementById(`gBulb${n}`);
    if (b) {
      if (on) b.classList.add('red');
      else b.classList.remove('red', 'green');
    }
  }

  // Snappy 5-light sequence (250ms each = 1.25s total)
  let light = 1;
  countdownTimer = setInterval(() => {
    if (light <= 5) {
      setBulb(light, true);
      playBeep(880, 0.12);
      light++;
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      setTimeout(() => {
        launchRace();
      }, 300);
    }
  }, 250);
}

/* ==========================================================================
   10. VEHICLE DYNAMICS: TRUE FREE-STEERING (ZERO AUTO-TURNING!)
   Hands Off = Straight Line • Realistic F1 Grip & Deflection Mechanics
   ========================================================================== */
function updatePhysics(dt) {
  dt = Math.min(dt, 0.1);

  // In 'grid' or 'countdown' state: Car is locked on grid until player presses throttle (W / Up) or launches!
  if (raceState === 'grid' || raceState === 'countdown') {
    if (keys.up) {
      // Immediate launch! Car moves right away upon throttle!
      launchRace();
    } else {
      carState.throttle = Math.max(0, carState.throttle - dt * 6.0);
      carState.rpm = Math.max(4500, carState.rpm - dt * 12000);
      carState.speed = 0; // ZERO SPEED - CAR WILL NEVER MOVE ON ITS OWN!
      updateSteeringWheelDash();
      updateEngineSound();
      return;
    }
  }

  // 1. Throttle & Braking Input during active racing
  if (raceState === 'racing') {
    if (keys.up) carState.throttle = Math.min(1, carState.throttle + dt * 6.0);
    else carState.throttle = Math.max(0, carState.throttle - dt * 7.0);

    const brakeMultiplier = carState.brakePower / 75.0;
    if (keys.down) carState.brake = Math.min(1, carState.brake + dt * 6.5 * brakeMultiplier);
    else carState.brake = Math.max(0, carState.brake - dt * 7.0);
  }

  // 2. Direct Player Steering (A = Left, D = Right)
  // steerAngle: -1.0 (Full Left) to +1.0 (Full Right)
  const steerResponse = 4.8;
  if (keys.left) {
    carState.steerAngle = Math.max(-1, carState.steerAngle - dt * steerResponse);
  } else if (keys.right) {
    carState.steerAngle = Math.min(1, carState.steerAngle + dt * steerResponse);
  } else {
    // Smooth auto-centering
    if (carState.steerAngle > 0) carState.steerAngle = Math.max(0, carState.steerAngle - dt * 7.0);
    else if (carState.steerAngle < 0) carState.steerAngle = Math.min(0, carState.steerAngle + dt * 7.0);
  }

  // 3. DRS Zones Detection
  const normDist = carState.distance / trackLength;
  const inDrsZone = (normDist >= 0.05 && normDist <= 0.18) ||
                    (normDist >= 0.55 && normDist <= 0.72) ||
                    (normDist >= 0.88 && normDist <= 0.99);

  carState.drsEligible = inDrsZone && raceState === 'racing';
  carState.drsActive = inDrsZone && keys.drs && raceState === 'racing';

  // 4. Slipstream Drafting Behind AI Competitors
  carState.slipstreamActive = false;
  aiCars.forEach(ai => {
    const distDiff = (ai.distance - carState.distance + trackLength) % trackLength;
    if (distDiff > 2.0 && distDiff < 24.0) {
      carState.slipstreamActive = true;
    }
  });

  const slipstreamBadge = document.getElementById('hudSlipstreamBadge');
  if (slipstreamBadge) {
    slipstreamBadge.style.display = carState.slipstreamActive ? 'block' : 'none';
  }

  // 5. Powertrain Acceleration & Aerodynamics
  const hpBoost = (carState.horsePower - 900) * 0.075;
  const ersBoost = (carState.ersPower - 120) * 0.04;
  const downforceDrag = (carState.downforce - 50) * 0.14;
  const gearBonus = (3.8 - carState.gearRatio) * 6.0;
  const slipstreamBonus = carState.slipstreamActive ? 4.5 : 0;
  const tyreTopBonus = (carState.tyreCompound === 'hard') ? 1.5 : (carState.tyreCompound === 'soft' ? -1.0 : 0);

  const topSpeedMax = (carState.drsActive ? 98.0 : 92.0) + hpBoost + ersBoost - downforceDrag + gearBonus + slipstreamBonus + tyreTopBonus;
  const baseAccel = 22.0 * (carState.horsePower / 950.0) * (carState.gearRatio / 3.8);
  const aeroDrag = 0.0014 * (carState.speed * carState.speed) * (carState.drsActive ? 0.72 : (carState.slipstreamActive ? 0.78 : 1.0));

  if (carState.throttle > 0 && carState.speed < topSpeedMax && raceState === 'racing') {
    const powerCurve = Math.max(0.25, 1.0 - (carState.speed / topSpeedMax) * 0.72);
    carState.speed += (baseAccel * carState.throttle * powerCurve - aeroDrag) * dt;
  }

  // 6. Braking Deceleration & Reverse Gear
  const brakeDecel = 48.0 * (carState.brakePower / 75.0);
  if (carState.brake > 0) {
    if (carState.speed > 0.5) {
      // Forward Braking
      carState.speed = Math.max(0, carState.speed - (brakeDecel * carState.brake + aeroDrag) * dt);
    } else {
      // Reverse Gear when holding Down / S from standstill
      carState.speed = Math.max(-12.0, carState.speed - 12.0 * carState.brake * dt);
    }
  } else if (carState.speed < 0) {
    // Coast back to zero from reverse
    carState.speed = Math.min(0, carState.speed + 12.0 * dt);
  } else if (carState.throttle === 0) {
    // Engine braking deceleration
    carState.speed = Math.max(0, carState.speed - (4.0 + aeroDrag) * dt);
  }

  const kmh = Math.round(carState.speed * 3.6);
  if (kmh > topSpeedThisLap) topSpeedThisLap = kmh;

  // 7. Gearbox & Engine RPM
  if (carState.speed < -0.2) {
    carState.gear = 'R';
    carState.rpm = 5500 + Math.abs(carState.speed) * 380;
  } else {
    if (kmh < 40) carState.gear = 1;
    else if (kmh < 90) carState.gear = 2;
    else if (kmh < 140) carState.gear = 3;
    else if (kmh < 190) carState.gear = 4;
    else if (kmh < 240) carState.gear = 5;
    else if (kmh < 285) carState.gear = 6;
    else if (kmh < 320) carState.gear = 7;
    else carState.gear = 8;

    const gearMinSpeed = [0, 0, 11, 25, 39, 53, 66, 79, 89][carState.gear];
    const gearMaxSpeed = [0, 11, 25, 39, 53, 66, 79, 89, 105][carState.gear];
    const speedRatioInGear = (carState.speed - gearMinSpeed) / (gearMaxSpeed - gearMinSpeed);
    carState.rpm = 8500 + Math.max(0, Math.min(1, speedRatioInGear)) * 4800;
  }

  // 8. TRUE FREE-STEERING YAW ROTATION (ZERO AUTO-TURNING!)
  // In camera view looking down +Z: +X is Left on screen, -X is Right on screen.
  // Steer Left (keys.left -> steerAngle < 0): yaw increases -> moves towards +X (screen LEFT!)
  // Steer Right (keys.right -> steerAngle > 0): yaw decreases -> moves towards -X (screen RIGHT!)
  // Hands off keys = yaw NEVER changes!
  const tyreGrip = (carState.tyreCompound === 'soft') ? 1.18 : (carState.tyreCompound === 'hard' ? 0.88 : 1.0);
  const dfGrip = 0.85 + (carState.downforce / 100.0) * 0.35;
  const suspGrip = 0.90 + (carState.suspension / 100.0) * 0.20;

  const speedMag = Math.abs(carState.speed);
  const turnSpeedFactor = Math.min(1.0, speedMag / 5.0);
  const turnRate = 0.92 * tyreGrip * dfGrip * suspGrip * turnSpeedFactor;
  const steerDirSign = (carState.speed < -0.2) ? 1.0 : -1.0;

  carState.yaw += steerDirSign * carState.steerAngle * turnRate * dt;

  // 9. Move Car in 3D Space along its Forward Direction
  carState.pos.x += carState.speed * Math.sin(carState.yaw) * dt;
  carState.pos.z += carState.speed * Math.cos(carState.yaw) * dt;

  // 10. Smooth Track Local Spline Query & Lateral Barrier Deflection
  const N = trackPoints.length;
  const baseIdx = carState.trackSplineIdx || 0;
  let winnerIdx = baseIdx;
  let minDSq = Infinity;

  // Search locally forward & backward without wild jumps or wrap-around teleportation
  for (let offset = -4; offset <= 8; offset++) {
    const idx = (baseIdx + offset + N) % N;
    const pt = trackPoints[idx];
    const dx = pt.x - carState.pos.x;
    const dz = pt.z - carState.pos.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDSq) {
      minDSq = dSq;
      winnerIdx = idx;
    }
  }
  carState.trackSplineIdx = winnerIdx;
  const closestPt = trackPoints[winnerIdx];
  const nextPt = trackPoints[(winnerIdx + 1) % N];
  const u = winnerIdx / N;
  carState.distance = u * trackLength;

  // Terrain height
  carState.pos.y = closestPt.y + 0.12;

  // Lateral distance across track (perpendicular to track centerline direction)
  const tanX = nextPt.x - closestPt.x;
  const tanZ = nextPt.z - closestPt.z;
  const tanLen = Math.hypot(tanX, tanZ) || 1;
  const rX = -tanZ / tanLen;
  const rZ = tanX / tanLen;

  const toCarX = carState.pos.x - closestPt.x;
  const toCarZ = carState.pos.z - closestPt.z;
  const lateralDist = toCarX * rX + toCarZ * rZ;

  // 15m wide track => 7.2m barrier boundary
  const trackLimit = 7.2;
  const absLatDist = Math.abs(lateralDist);
  if (absLatDist > trackLimit) {
    // Deflect purely LATERAL across track width — NEVER pull backward along the track!
    const excess = (absLatDist - trackLimit) * Math.sign(lateralDist);
    carState.pos.x -= rX * excess;
    carState.pos.z -= rZ * excess;
    carState.speed *= 0.96; // slight barrier scrub

    if (sparkParticles && Math.abs(carState.speed) > 10) {
      sparkParticles.visible = true;
      sparkParticles.position.copy(carState.pos).add(new THREE.Vector3(0, 0.05, 0));
    }
  } else {
    if (sparkParticles) {
      if (carState.speed > 84 && Math.random() < 0.3) {
        sparkParticles.visible = true;
        sparkParticles.position.copy(carState.pos).add(new THREE.Vector3(0, 0.05, -1.2));
      } else {
        sparkParticles.visible = false;
      }
    }
  }

  // 11. Update Cockpit Open-Wheel Front Tyres (Turn with Steering & Spin with Speed)
  if (cockpitLeftWheelPivot && cockpitRightWheelPivot) {
    const steerPivotAngle = -carState.steerAngle * 0.42;
    cockpitLeftWheelPivot.rotation.y = steerPivotAngle;
    cockpitRightWheelPivot.rotation.y = steerPivotAngle;

    const spin = (carState.speed / 0.34) * dt;
    cockpitWheelMeshes.forEach(w => { w.rotation.x += spin; });
  }

  // 12. Update Player Car External Mesh
  if (playerCarMesh) {
    playerCarMesh.position.copy(carState.pos);
    playerCarMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), carState.yaw);
    playerCarMesh.rotateZ(-carState.steerAngle * 0.08);

    const spin = (carState.speed / 0.34) * dt;
    wheelMeshes.forEach(w => { w.rotation.x += spin; });

    if (frontLeftWheelPivot) frontLeftWheelPivot.rotation.y = -carState.steerAngle * 0.42;
    if (frontRightWheelPivot) frontRightWheelPivot.rotation.y = -carState.steerAngle * 0.42;

    if (drsFlapMesh) {
      drsFlapMesh.rotation.x = carState.drsActive ? -0.45 : 0;
    }
  }

  // 13. Dynamic AI Competitor Racecraft
  if (raceState === 'racing') {
    aiCars.forEach(ai => {
      // AI accelerates toward target race pace
      if (ai.speed < ai.targetSpeed) ai.speed += dt * 8.2;
      ai.distance = (ai.distance + ai.speed * dt) % trackLength;

      const aiU = ai.distance / trackLength;
      const aiPos = trackCurve.getPointAt(aiU);
      const aiTan = trackCurve.getTangentAt(aiU).normalize();
      const upVec = new THREE.Vector3(0, 1, 0);
      const aiRight = new THREE.Vector3().crossVectors(upVec, aiTan).normalize();

      ai.model.mesh.position.copy(aiPos).add(aiRight.clone().multiplyScalar(ai.lateralOffset));
      ai.model.mesh.position.y = aiPos.y + 0.12;
      ai.model.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aiTan);

      const aiSpin = (ai.speed / 0.34) * dt;
      ai.model.wheels.forEach(w => { w.rotation.x += aiSpin; });
    });

    // Check Overtakes & Position Tracking
    checkRacePositions();
  }

  // 14. Wind Particles at High Speed
  if (windParticles) {
    windParticles.visible = (carState.speed > 78);
  }

  // 15. Camera Positioning (Cockpit POV vs Chase)
  const forwardVec = new THREE.Vector3(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));

  if (cameraMode === 'cockpit') {
    if (playerCarMesh) playerCarMesh.visible = false;
    if (cockpitGroup) cockpitGroup.visible = true;

    const eyePos = carState.pos.clone().add(new THREE.Vector3(0, 0.52, 0));

    // High-speed chassis vibration (only above 180 km/h = 50 m/s)
    if (carState.speed > 50) {
      const shakeAmt = 0.003 * Math.min(1, (carState.speed - 50) / 40);
      eyePos.x += (Math.random() - 0.5) * shakeAmt;
      eyePos.y += (Math.random() - 0.5) * shakeAmt;
    }

    gameCamera.position.copy(eyePos);
    gameCamera.up.set(0, 1, 0);

    const lookTarget = eyePos.clone().add(forwardVec.clone().multiplyScalar(40)).add(new THREE.Vector3(0, 0.25, 0));
    gameCamera.lookAt(lookTarget);

    const bankAngle = -carState.steerAngle * 0.045 * Math.min(1, Math.abs(carState.speed) / 30);
    gameCamera.rotateZ(bankAngle);

    const targetFov = 68 + Math.min(1, Math.max(0, carState.speed) / 92) * 12;
    if (Math.abs(gameCamera.fov - targetFov) > 0.4) {
      gameCamera.fov = targetFov;
      gameCamera.updateProjectionMatrix();
    }

    updateSteeringWheelDash();
  } else {
    // Chase Cam
    if (playerCarMesh) playerCarMesh.visible = true;
    if (cockpitGroup) cockpitGroup.visible = false;

    const camOffset = forwardVec.clone().multiplyScalar(-8.2).add(new THREE.Vector3(0, 3.2, 0));
    gameCamera.position.copy(carState.pos).add(camOffset);
    gameCamera.up.set(0, 1, 0);
    const lookTarget = carState.pos.clone().add(forwardVec.clone().multiplyScalar(22)).add(new THREE.Vector3(0, 0.6, 0));
    gameCamera.lookAt(lookTarget);
  }

  // 16. Timing, Radar & Audio
  updateLapTimer(dt, u);
  updateEngineSound();
  updateOnscreenTelemetryHUD();
  drawMinimapRadar(u);
}

/* ==========================================================================
   11. LIVE F1 TIMING TOWER & OVERTAKE SYSTEM
   ========================================================================== */
function checkRacePositions() {
  const currentTotalDist = carState.distance;

  // Count how many AI cars are ahead of player
  let carsAhead = 0;
  aiCars.forEach(ai => {
    if (ai.distance > currentTotalDist) carsAhead++;
  });

  const newPos = carsAhead + 1;
  if (newPos < playerPosition) {
    // Player executed an OVERTAKE!
    const oldPos = playerPosition;
    playerPosition = newPos;
    triggerOvertakeBanner(oldPos, newPos);
  } else {
    playerPosition = newPos;
  }

  updateTimingTower();
}

function triggerOvertakeBanner(oldPos, newPos) {
  const banner = document.getElementById('hudOvertakeBanner');
  const oldEl = document.getElementById('overtakeOldPos');
  const newEl = document.getElementById('overtakeNewPos');

  if (oldEl) oldEl.textContent = `P${oldPos}`;
  if (newEl) newEl.textContent = `P${newPos}`;
  if (banner) {
    banner.style.display = 'block';
    playBeep(1200, 0.15);
    setTimeout(() => playBeep(1600, 0.25), 150);

    setTimeout(() => {
      banner.style.display = 'none';
    }, 2800);
  }
}

function updateTimingTower() {
  // Sort all drivers by distance along track (descending)
  const drivers = [
    { name: 'YOU', team: 'bmu', isPlayer: true, dist: carState.distance },
    { name: aiCars[0]?.name || 'LEC', team: 'ferrari', isPlayer: false, dist: aiCars[0]?.distance || 70 },
    { name: aiCars[1]?.name || 'HAM', team: 'mercedes', isPlayer: false, dist: aiCars[1]?.distance || 55 },
    { name: aiCars[2]?.name || 'NOR', team: 'mclaren', isPlayer: false, dist: aiCars[2]?.distance || 40 }
  ];

  drivers.sort((a, b) => b.dist - a.dist);

  const leaderDist = drivers[0].dist;
  for (let i = 0; i < 4; i++) {
    const d = drivers[i];
    const row = document.getElementById(`towerRow${i + 1}`);
    const posEl = document.getElementById(`tPos${i + 1}`);
    const nameEl = document.getElementById(`tName${i + 1}`);
    const gapEl = document.getElementById(`tGap${i + 1}`);

    if (posEl) posEl.textContent = i + 1;
    if (nameEl) nameEl.textContent = d.name;
    if (row) {
      if (d.isPlayer) row.classList.add('player');
      else row.classList.remove('player');
    }
    if (gapEl) {
      if (i === 0) gapEl.textContent = 'LEADER';
      else {
        const gapSec = ((leaderDist - d.dist) / 80).toFixed(1);
        gapEl.textContent = `+${gapSec}s`;
      }
    }
  }
}

/* ==========================================================================
   12. 1-LAP RACE COMPLETION & OFFICIAL PODIUM SCORECARD
   ========================================================================== */
function updateLapTimer(dt, u) {
  if (raceFinished || raceState !== 'racing') return;

  if (lapStartTime) {
    currentLapTime = Date.now() - lapStartTime;
  }

  const currentCheckpoint = Math.floor(u * TOTAL_CHECKPOINTS);
  if (!lastCheckpoints.includes(currentCheckpoint)) {
    lastCheckpoints.push(currentCheckpoint);
  }

  // Cross start/finish after visiting sectors and driving > 40 seconds
  if (lastCheckpoints.length >= TOTAL_CHECKPOINTS - 2 && u < 0.03 && currentLapTime > 40000) {
    finishRaceLap(currentLapTime);
  }
}

async function finishRaceLap(finalLapMs) {
  raceFinished = true;
  raceState = 'finished';
  const lapStr = formatGameTime(finalLapMs);
  const avgSpeedKmh = Math.round((trackLength / (finalLapMs / 1000)) * 3.6);

  pauseGameAudio();

  let rank = 1, isPR = true, isRecord = false;
  if (typeof apiCall === 'function') {
    try {
      const res = await apiCall('POST', '/api/game/lap-time', {
        lap_time_ms: finalLapMs,
        top_speed_kmh: topSpeedThisLap,
        tyre_compound: carState.tyreCompound,
        aero_setup: `${carState.downforce}% Downforce`,
        horse_power: carState.horsePower,
        brake_power: carState.brakePower
      }, true);

      if (res.ok && res.data) {
        rank = res.data.rank || 1;
        isPR = res.data.is_pr;
        isRecord = res.data.is_record;
      }
    } catch (e) {}
  }

  const lapTimeEl = document.getElementById('finishLapTimeVal');
  const rankBadgeEl = document.getElementById('finishRankBadge');
  const prBadgeEl = document.getElementById('finishPrBadge');
  const topSpeedEl = document.getElementById('finishTopSpeed');
  const avgSpeedEl = document.getElementById('finishAvgSpeed');
  const carSetupEl = document.getElementById('finishCarSetup');
  const modal = document.getElementById('raceFinishModal');
  const subTitle = document.getElementById('finishSubTitle');

  if (lapTimeEl) lapTimeEl.textContent = lapStr;

  // Podium & Victory Banner
  if (subTitle) {
    if (playerPosition === 1) subTitle.textContent = '🏆 1ST PLACE — GRAND PRIX WINNER!';
    else if (playerPosition === 2) subTitle.textContent = '🥈 2ND PLACE — PODIUM FINISH!';
    else if (playerPosition === 3) subTitle.textContent = '🥉 3RD PLACE — PODIUM FINISH!';
    else subTitle.textContent = `Official 1-Lap Race Finished — P${playerPosition}`;
  }

  if (rankBadgeEl) rankBadgeEl.textContent = isRecord ? '👑 TRACK RECORD (P1)' : `GRID FINISH: P${playerPosition} (LEADERBOARD P${rank})`;
  if (prBadgeEl) {
    prBadgeEl.style.display = isPR ? 'inline-block' : 'none';
    prBadgeEl.textContent = isPR ? '⭐ NEW PERSONAL RECORD' : '';
  }
  if (topSpeedEl) topSpeedEl.textContent = `${topSpeedThisLap} KM/H`;
  if (avgSpeedEl) avgSpeedEl.textContent = `${avgSpeedKmh} KM/H`;
  if (carSetupEl) carSetupEl.textContent = `${carState.horsePower} BHP • ${carState.brakePower}% Brakes • ${carState.downforce}% Aero • ${carState.gearRatio.toFixed(1)}:1`;

  if (modal) modal.classList.add('show');
  loadGameLeaderboard();
}

function restartRaceLap() {
  if (countdownTimer) clearInterval(countdownTimer);
  raceFinished = false;
  raceState = 'grid';
  countdownStep = 0;
  lapStartTime = null;
  currentLapTime = 0;
  topSpeedThisLap = 0;
  lastCheckpoints = [];

  // Re-park player and rivals on grid
  resetGridPositions();

  // Reset starting gantry overlay
  const overlay = document.getElementById('hudStartGantryOverlay');
  const btn = document.getElementById('btnStartRace');
  const msg = document.getElementById('gantryMessage');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  }
  if (btn) btn.style.display = 'inline-block';
  if (msg) {
    msg.textContent = 'JEDDAH CORNICHE GP • PRESS W OR ENTER TO LAUNCH!';
    msg.style.color = 'var(--gold)';
  }
  for (let i = 1; i <= 5; i++) {
    const b = document.getElementById(`gBulb${i}`);
    if (b) b.classList.remove('red', 'green');
  }

  closeFinishModal();
  resumeGameAudio();
  if (typeof showToast === 'function') showToast('🏁 On Starting Grid (P4) — Press W or Enter to Launch!', 'success');
}

function closeFinishModal() {
  const modal = document.getElementById('raceFinishModal');
  if (modal) modal.classList.remove('show');
}

function closeFinishModalAndOpenGarage() {
  closeFinishModal();
  openGarageModal();
}

function formatGameTime(ms) {
  if (!ms || ms <= 0) return '00:00.000';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = Math.floor(ms % 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${mil.toString().padStart(3, '0')}`;
}

/* ==========================================================================
   13. MINIMAP TRACK RADAR HUD
   ========================================================================== */
function drawMinimapRadar(u) {
  const canvas = document.getElementById('gameMinimapCanvas');
  if (!canvas || !trackPoints || trackPoints.length === 0) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(6, 12, 24, 0.88)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#00E5FF';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('JEDDAH GPS', 8, 14);

  let minX = -100, maxX = 400, minZ = -150, maxZ = 1400;

  function toRadar(pt) {
    const pad = 18;
    const nx = (pt.x - minX) / (maxX - minX);
    const nz = (pt.z - minZ) / (maxZ - minZ);
    return {
      x: pad + nx * (w - pad * 2),
      y: (h - pad) - nz * (h - pad * 2)
    };
  }

  ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < trackPoints.length; i += 4) {
    const rPt = toRadar(trackPoints[i]);
    if (i === 0) ctx.moveTo(rPt.x, rPt.y);
    else ctx.lineTo(rPt.x, rPt.y);
  }
  ctx.closePath();
  ctx.stroke();

  const p0 = toRadar(trackPoints[0]);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(p0.x - 3, p0.y - 3, 6, 6);

  // AI Competitor dots on radar
  aiCars.forEach(ai => {
    const aiPt = trackCurve.getPointAt(ai.distance / trackLength);
    const aiR = toRadar(aiPt);
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.arc(aiR.x, aiR.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player car dot on radar
  const pRadar = toRadar(carState.pos);
  ctx.fillStyle = 'rgba(255, 153, 51, 0.4)';
  ctx.beginPath();
  ctx.arc(pRadar.x, pRadar.y, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FF8500';
  ctx.beginPath();
  ctx.arc(pRadar.x, pRadar.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/* ==========================================================================
   14. MULTI-LAYERED V6 TURBO SOUND ENGINE - ZERO IDLE BUZZ
   ========================================================================== */
function initGameAudio() {
  if (gameAudioCtx) {
    if (gameAudioCtx.state === 'suspended' && gameAudioEnabled) {
      gameAudioCtx.resume();
    }
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    gameAudioCtx = new AudioContextClass();

    gameOsc1 = gameAudioCtx.createOscillator();
    gameOsc2 = gameAudioCtx.createOscillator();
    gameOscTurbo = gameAudioCtx.createOscillator();
    gameGain = gameAudioCtx.createGain();
    gameFilter = gameAudioCtx.createBiquadFilter();

    gameOsc1.type = 'sawtooth';
    gameOsc2.type = 'triangle';
    gameOscTurbo.type = 'sine';

    gameFilter.type = 'lowpass';
    gameFilter.frequency.value = 2200;

    gameGain.gain.value = 0.0;

    gameOsc1.connect(gameFilter);
    gameOsc2.connect(gameFilter);
    gameOscTurbo.connect(gameFilter);
    gameFilter.connect(gameGain);
    gameGain.connect(gameAudioCtx.destination);

    gameOsc1.start();
    gameOsc2.start();
    gameOscTurbo.start();
  } catch (e) {}
}

function updateEngineSound() {
  if (!gameAudioEnabled || !gameAudioCtx || !gameGain || raceFinished) return;

  if (carState.speed < 1.0 && carState.throttle < 0.05 && raceState !== 'grid' && raceState !== 'countdown') {
    gameGain.gain.setTargetAtTime(0.0, gameAudioCtx.currentTime, 0.08);
    return;
  }

  const rpmNorm = (carState.rpm - 4500) / (13500 - 4500);
  const baseFreq = 95 + Math.max(0, rpmNorm) * 440;

  gameOsc1.frequency.setTargetAtTime(baseFreq, gameAudioCtx.currentTime, 0.05);
  gameOsc2.frequency.setTargetAtTime(baseFreq * 1.5, gameAudioCtx.currentTime, 0.05);
  if (gameOscTurbo) {
    gameOscTurbo.frequency.setTargetAtTime(baseFreq * 4.2, gameAudioCtx.currentTime, 0.05);
  }

  const throttleVolume = (raceState === 'grid' || raceState === 'countdown')
    ? 0.04 + carState.throttle * 0.18
    : 0.03 + carState.throttle * 0.16;

  gameGain.gain.setTargetAtTime(throttleVolume, gameAudioCtx.currentTime, 0.05);
}

function pauseGameAudio() {
  if (gameGain && gameAudioCtx) {
    gameGain.gain.setValueAtTime(0, gameAudioCtx.currentTime);
  }
  if (gameAudioCtx && gameAudioCtx.state === 'running') {
    gameAudioCtx.suspend().catch(() => {});
  }
}

function resumeGameAudio() {
  if (gameAudioEnabled && gameAudioCtx && gameAudioCtx.state === 'suspended') {
    gameAudioCtx.resume().catch(() => {});
  }
}

function toggleGameAudio() {
  gameAudioEnabled = !gameAudioEnabled;
  const btn = document.getElementById('btnGameAudioToggle');

  if (gameAudioEnabled) {
    initGameAudio();
    if (gameAudioCtx && gameAudioCtx.state === 'suspended') gameAudioCtx.resume();
    if (btn) btn.textContent = '🔊 Sound: ON';
    if (typeof showToast === 'function') showToast('Game audio unmuted', '');
  } else {
    pauseGameAudio();
    if (btn) btn.textContent = '🔇 Sound: OFF';
    if (typeof showToast === 'function') showToast('Game audio muted', '');
  }
}

function toggleGameCamera() {
  cameraMode = (cameraMode === 'cockpit') ? 'chase' : 'cockpit';
  const btn = document.getElementById('btnGameCameraToggle');
  if (btn) {
    btn.textContent = (cameraMode === 'cockpit') ? '🏎️ View: Cockpit (C)' : '📹 View: Chase (C)';
  }
  if (typeof showToast === 'function') {
    showToast(`Camera View: ${cameraMode === 'cockpit' ? 'First-Person FPS Cockpit' : 'Third-Person Chase'}`, '');
  }
}

/* ==========================================================================
   15. GAME LOOP & INPUT CONTROLS
   ========================================================================== */
let lastFrameTime = performance.now();

function gameLoop(now) {
  if (!gameRunning) return;
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  try {
    updatePhysics(dt);
    if (gameRenderer && gameScene && gameCamera) {
      gameRenderer.render(gameScene, gameCamera);
    }
  } catch (err) {
    console.error('Frame render exception:', err);
  }

  gameAnimId = requestAnimationFrame(gameLoop);
}

let listenersAttached = false;
function setupGameInputListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  window.addEventListener('keydown', (e) => {
    // Ignore keypresses if user is typing in a form or input
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

    const gamePane = document.getElementById('view-game');
    const isGameActive = (gamePane && gamePane.classList.contains('active')) || window.location.hash === '#game';
    if (!isGameActive) return;

    if (gameAudioEnabled) initGameAudio();

    if (e.code === 'Enter') {
      if (raceState === 'grid' || raceState === 'countdown') {
        launchRace();
      }
      e.preventDefault();
      return;
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      keys.up = true;
      if (raceState === 'grid' || raceState === 'countdown') {
        launchRace();
      }
      e.preventDefault();
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    if (e.code === 'Space') { keys.drs = true; e.preventDefault(); }
    if (e.code === 'KeyC') {
      toggleGameCamera();
    }
    if (e.code === 'KeyR') {
      restartRaceLap();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'Space') keys.drs = false;
  });

  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.drs = false;
  });
}

function updateOnscreenTelemetryHUD() {
  const kmh = Math.round(carState.speed * 3.6);
  const speedEl = document.getElementById('hudSpeedValue');
  const gearEl = document.getElementById('hudGearValue');
  const timeEl = document.getElementById('hudLapTimeValue');
  const drsEl = document.getElementById('hudDrsBadge');

  if (speedEl) speedEl.textContent = kmh;
  if (gearEl) gearEl.textContent = carState.gear;
  if (timeEl) timeEl.textContent = formatGameTime(currentLapTime);

  if (drsEl) {
    if (carState.drsActive) {
      drsEl.className = 'drs-badge active';
      drsEl.textContent = 'DRS ACTIVE (SPACE)';
    } else if (carState.drsEligible) {
      drsEl.className = 'drs-badge ready';
      drsEl.textContent = 'DRS AVAILABLE (PRESS SPACE)';
    } else {
      drsEl.className = 'drs-badge off';
      drsEl.textContent = 'DRS UNAVAILABLE';
    }
  }
}

/* ==========================================================================
   16. DRIVER PERSONAL RECORDS (PR) SCOREBOARD
   ========================================================================== */
function switchLeaderboardMode(isPR) {
  leaderboardPRMode = isPR;
  const btnPR = document.getElementById('btnLeaderboardPR');
  const btnAll = document.getElementById('btnLeaderboardAll');

  if (btnPR && btnAll) {
    btnPR.className = isPR ? 'btn btn-sm btn-gold' : 'btn btn-sm btn-ghost';
    btnAll.className = !isPR ? 'btn btn-sm btn-gold' : 'btn btn-sm btn-ghost';
  }

  loadGameLeaderboard();
}

async function loadGameLeaderboard() {
  const tbody = document.getElementById('gameLeaderboardTbody');
  if (!tbody || typeof apiCall !== 'function') return;

  try {
    const url = `/api/game/leaderboard?pr=${leaderboardPRMode}`;
    const res = await apiCall('GET', url, null, false);
    if (!res.ok) return;

    const laps = res.data || [];
    if (laps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No recorded lap times yet. Set the first PR!</td></tr>';
      return;
    }

    let html = '';
    laps.forEach(l => {
      const isP1 = l.rank === 1;
      const rankBadge = isP1 ? '👑 P1' : `P${l.rank}`;
      const roleBadge = l.role === 'admin' ? '<span class="role-badge role-admin">ADMIN</span>' : '<span class="role-badge role-member">MEMBER</span>';
      const escape = (typeof escapeHtml === 'function') ? escapeHtml : (str => str);

      html += `
        <tr class="${isP1 ? 'leaderboard-record-row' : ''}">
          <td style="font-weight:700; color:${isP1 ? 'var(--gold)' : '#fff'};">${rankBadge}</td>
          <td><strong>${escape(l.username)}</strong> ${roleBadge}</td>
          <td style="font-family:monospace; font-size:1.05rem; font-weight:700; color:var(--saffron);">${l.lap_time_str}</td>
          <td>${l.top_speed_kmh} KM/H</td>
          <td><span style="color:#00E5FF; font-weight:700;">${l.horse_power || 980} BHP</span></td>
          <td>${l.brake_power || 75}%</td>
          <td><span class="tyre-chip ${l.tyre_compound}">${l.tyre_compound ? l.tyre_compound.toUpperCase() : 'SOFT'}</span></td>
          <td style="color:var(--text-muted); font-size:0.8rem;">${l.aero_setup || 'Balanced'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (e) {}
}

/* ==========================================================================
   17. INTERLINKED DYNAMIC CAR GARAGE & MULTI-SLIDER UPGRADES
   ========================================================================== */
function onGarageSliderChange(param) {
  const hpEl = document.getElementById('garageHpInput');
  const bpEl = document.getElementById('garageBpInput');
  const dfEl = document.getElementById('garageDfInput');
  const gearEl = document.getElementById('garageGearRatioInput');
  const suspEl = document.getElementById('garageSuspInput');
  const ersEl = document.getElementById('garageErsInput');
  const autoLinkCheck = document.getElementById('garageAutoLinkCheck');

  const autoLink = autoLinkCheck ? autoLinkCheck.checked : true;

  let hp = parseInt(hpEl?.value || 980);
  let bp = parseInt(bpEl?.value || 75);
  let df = parseInt(dfEl?.value || 50);
  let gear = parseFloat(gearEl?.value || 3.8);
  let susp = parseInt(suspEl?.value || 65);
  let ers = parseInt(ersEl?.value || 120);

  if (autoLink) {
    if (param === 'hp') {
      const targetBp = Math.round(50 + ((hp - 750) / 350) * 45);
      bp = Math.max(40, Math.min(100, Math.round(targetBp / 5) * 5));
      if (bpEl) bpEl.value = bp;

      const targetErs = Math.round(70 + ((hp - 750) / 350) * 100);
      ers = Math.max(50, Math.min(180, targetErs));
      if (ersEl) ersEl.value = ers;
    } else if (param === 'df') {
      const targetGear = (4.5 - ((df - 10) / 90) * 1.2).toFixed(1);
      gear = parseFloat(targetGear);
      if (gearEl) gearEl.value = gear;

      const targetSusp = Math.round(40 + ((df - 10) / 90) * 55);
      susp = Math.max(30, Math.min(100, Math.round(targetSusp / 5) * 5));
      if (suspEl) suspEl.value = susp;
    } else if (param === 'gear') {
      const targetDf = Math.round(100 - ((gear - 3.0) / 1.8) * 80);
      df = Math.max(10, Math.min(100, Math.round(targetDf / 5) * 5));
      if (dfEl) dfEl.value = df;
    } else if (param === 'susp') {
      const targetDf = Math.round(10 + ((susp - 30) / 70) * 80);
      df = Math.max(10, Math.min(100, Math.round(targetDf / 5) * 5));
      if (dfEl) dfEl.value = df;
    } else if (param === 'ers') {
      const targetHp = Math.round(800 + ((ers - 50) / 130) * 280);
      hp = Math.max(750, Math.min(1100, Math.round(targetHp / 10) * 10));
      if (hpEl) hpEl.value = hp;
    }
  }

  updateGarageInterlinkedStats();
}

function updateGarageInterlinkedStats() {
  const hpInput = document.getElementById('garageHpInput');
  const bpInput = document.getElementById('garageBpInput');
  const dfInput = document.getElementById('garageDfInput');
  const gearInput = document.getElementById('garageGearRatioInput');
  const suspInput = document.getElementById('garageSuspInput');
  const ersInput = document.getElementById('garageErsInput');
  const tyreSelect = document.getElementById('garageTyreSelect');

  const hp = parseInt(hpInput?.value || 980);
  const bp = parseInt(bpInput?.value || 75);
  const df = parseInt(dfInput?.value || 50);
  const gear = parseFloat(gearInput?.value || 3.8);
  const susp = parseInt(suspInput?.value || 65);
  const ers = parseInt(ersInput?.value || 120);
  const tyre = tyreSelect?.value || 'soft';

  const hpDisp = document.getElementById('hpDisplayVal');
  const bpDisp = document.getElementById('bpDisplayVal');
  const dfDisp = document.getElementById('dfDisplayVal');
  const gearDisp = document.getElementById('gearDisplayVal');
  const suspDisp = document.getElementById('suspDisplayVal');
  const ersDisp = document.getElementById('ersDisplayVal');

  if (hpDisp) hpDisp.textContent = `${hp} BHP`;
  if (bpDisp) bpDisp.textContent = `${bp}% (${(3.4 + (bp / 100) * 2.2).toFixed(1)}G)`;
  if (dfDisp) dfDisp.textContent = `${df}%`;
  if (gearDisp) gearDisp.textContent = `${gear.toFixed(2)}:1`;
  if (suspDisp) suspDisp.textContent = `${susp}%`;
  if (ersDisp) ersDisp.textContent = `${ers} kW (+${Math.round(ers * 1.36)} BHP)`;

  const tyreSpeedBonus = (tyre === 'hard') ? 5 : (tyre === 'soft' ? -3 : 0);
  const gearSpeedBonus = Math.round((3.8 - gear) * 18);
  const estTopSpeed = Math.round(338 + (hp - 900) * 0.08 + (ers - 120) * 0.05 - (df - 50) * 0.42 + gearSpeedBonus + tyreSpeedBonus);
  const est0200 = (4.5 - (hp - 900) * 0.0028 - (gear - 3.8) * 0.25).toFixed(1);
  const estBraking = Math.round(112 - (bp - 40) * 0.42 + (hp - 900) * 0.032);
  const tyreGripAdd = (tyre === 'soft') ? 0.6 : (tyre === 'hard' ? -0.4 : 0);
  const suspGripAdd = (susp - 50) * 0.01;
  const estGrip = (4.0 + (df / 100.0) * 1.2 + tyreGripAdd + suspGripAdd).toFixed(1);

  const statTopSpeed = document.getElementById('statCalcTopSpeed');
  const statAccel = document.getElementById('statCalcAccel');
  const statBraking = document.getElementById('statCalcBraking');
  const statGrip = document.getElementById('statCalcGrip');
  const warningEl = document.getElementById('garageBalanceWarning');

  if (statTopSpeed) statTopSpeed.textContent = `${estTopSpeed} KM/H`;
  if (statAccel) statAccel.textContent = `${est0200}s`;
  if (statBraking) statBraking.textContent = `${estBraking}m`;
  if (statGrip) statGrip.textContent = `${estGrip} G`;

  if (warningEl) {
    if (hp >= 1040 && bp <= 60) {
      warningEl.textContent = '⚠️ Severe Brake Hazard: Over 1,000 BHP requires 75%+ Brake Power for Turn 1 & 27!';
      warningEl.style.display = 'block';
    } else if (df >= 85 && hp <= 820) {
      warningEl.textContent = 'ℹ️ High Drag Notice: Maximum downforce with low BHP will limit straightaway speeds to ~315 KM/H.';
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }
}

async function loadUserGarageSetup() {
  if (typeof currentUser === 'undefined' || !currentUser || currentUser.role === 'guest' || typeof apiCall !== 'function') return;

  try {
    const res = await apiCall('GET', '/api/game/garage', null, true);
    if (res.ok && res.data) {
      const g = res.data;
      carState.horsePower = g.horse_power || 980;
      carState.brakePower = g.brake_power || 75;
      carState.downforce = g.downforce || 50;
      carState.tyreCompound = g.tyre_compound || 'soft';

      const hpInput = document.getElementById('garageHpInput');
      const bpInput = document.getElementById('garageBpInput');
      const dfInput = document.getElementById('garageDfInput');
      const tyreSelect = document.getElementById('garageTyreSelect');

      if (hpInput) hpInput.value = carState.horsePower;
      if (bpInput) bpInput.value = carState.brakePower;
      if (dfInput) dfInput.value = carState.downforce;
      if (tyreSelect) tyreSelect.value = carState.tyreCompound;

      updateGarageInterlinkedStats();
    }
  } catch (e) {}
}

async function saveUserGarageSetup() {
  const hp = parseInt(document.getElementById('garageHpInput')?.value || 980);
  const bp = parseInt(document.getElementById('garageBpInput')?.value || 75);
  const df = parseInt(document.getElementById('garageDfInput')?.value || 50);
  const gear = parseFloat(document.getElementById('garageGearRatioInput')?.value || 3.8);
  const susp = parseInt(document.getElementById('garageSuspInput')?.value || 65);
  const ers = parseInt(document.getElementById('garageErsInput')?.value || 120);
  const tyre = document.getElementById('garageTyreSelect')?.value || 'soft';

  carState.horsePower = hp;
  carState.brakePower = bp;
  carState.downforce = df;
  carState.gearRatio = gear;
  carState.suspension = susp;
  carState.ersPower = ers;
  carState.tyreCompound = tyre;

  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'guest' && typeof apiCall === 'function') {
    const res = await apiCall('POST', '/api/game/garage', {
      horse_power: hp,
      brake_power: bp,
      downforce: df,
      tyre_compound: tyre,
      livery_accent: carState.liveryAccent
    }, true);
    if (res.ok) {
      if (typeof showToast === 'function') showToast(`🔧 Applied: ${hp} BHP • ${bp}% Brakes • ${df}% Aero • ${gear.toFixed(1)}:1 • ${tyre.toUpperCase()}`, 'success');
      closeGarageModal();
    }
  } else {
    if (typeof showToast === 'function') showToast(`🔧 Applied: ${hp} BHP • ${bp}% Brakes • ${df}% Aero • ${gear.toFixed(1)}:1 (${tyre.toUpperCase()})`, 'success');
    closeGarageModal();
  }
}

function openGarageModal() {
  const modal = document.getElementById('garageModal');
  if (modal) {
    modal.classList.add('show');
    updateGarageInterlinkedStats();
  }
}

function closeGarageModal() {
  const modal = document.getElementById('garageModal');
  if (modal) modal.classList.remove('show');
}

function resetCarOnTrack() {
  restartRaceLap();
}

// Expose key UI hooks to global window scope for inline HTML handlers
window.initGameScene = initGameScene;
window.launchRace = launchRace;
window.startRaceCountdown = startRaceCountdown;
window.resetCarOnTrack = resetCarOnTrack;
window.restartRaceLap = restartRaceLap;
window.toggleGameAudio = toggleGameAudio;
window.toggleGameCamera = toggleGameCamera;
window.openGarageModal = openGarageModal;
window.closeGarageModal = closeGarageModal;
window.onGarageSliderChange = onGarageSliderChange;
window.updateGarageInterlinkedStats = updateGarageInterlinkedStats;
window.saveUserGarageSetup = saveUserGarageSetup;
window.switchLeaderboardMode = switchLeaderboardMode;
window.closeFinishModal = closeFinishModal;
window.closeFinishModalAndOpenGarage = closeFinishModalAndOpenGarage;
