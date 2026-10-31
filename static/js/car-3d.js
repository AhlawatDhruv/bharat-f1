/* ==========================================================================
   BMU F1 - 3D FORMULA 1 CAR SCENE & APPLICATION ENGINE
   ========================================================================== */

let scene, camera, renderer, controls;
let carGroup, wheels = [];
let interactiveMeshes = [];
let trackLinesGroup, exhaustSparks;
let isRacing = false;
let autoRotateActive = false;
let currentSpeed = 0, currentRpm = 0;
let baseCarY = 0.55;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Web Audio API Procedural F1 V6 Hybrid Engine Sound
let audioCtx = null;
let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;

// User Session State
let currentUser = null;

// Part Engineering Specs Dictionary
const PARTS_DATA = {
  'front-wing': {
    title: 'Front Wing Assembly',
    category: 'AERODYNAMICS',
    desc: 'Multi-element carbon-composite front wing generating up to 38% of total front-axle downforce. Features adjustable trailing flaps in Indian tricolor livery, sculpted endplates with outwash vortex channels, and titanium leading-edge skid protectors.',
    specs: {
      downforce: '850 kg @ 300 km/h',
      weight: '11.2 kg',
      temp: '35°C ambient',
      power: '4,200 N peak aerodynamic load',
      material: 'Torayca T1000 Carbon Fibre & Titanium'
    }
  },
  'tyre-front': {
    title: 'Front Wheels & Pirelli Slicks',
    category: 'TYRES & BRAKES',
    desc: '18-inch low-profile Pirelli P-Zero racing slicks on forged BBS magnesium-alloy gold rims. Fitted with carbon-ceramic brake discs capable of decelerating the car from 300 to 100 km/h in just 1.8 seconds with 5.2G peak deceleration force.',
    specs: {
      downforce: 'Front Axle Load: 650 kg',
      weight: '10.8 kg per wheel',
      temp: 'Operating window: 95°C - 105°C',
      power: 'Braking power: 1,200 kW thermal',
      material: 'Synthetic Elastomer & Forged Magnesium'
    }
  },
  'cockpit': {
    title: 'Cockpit & Titanium Halo',
    category: 'SAFETY & CHASSIS',
    desc: 'Moulded carbon monocoque survival cell tested to FIA 8860 standards. Features the Grade 5 Titanium Halo head protection structure capable of supporting a 125 kN static load (equivalent to two double-decker buses) and custom driver helmet in BMU Racing livery.',
    specs: {
      downforce: '-12 kg (neutral drag profile)',
      weight: 'Halo: 7.0 kg | Monocoque: 42 kg',
      temp: 'Cockpit internal: 48°C',
      power: '125 kN FIA impact load rating',
      material: 'Grade 5 Aerospace Titanium & Zylon'
    }
  },
  'sidepods': {
    title: 'Sculpted Sidepods & Inlets',
    category: 'AERODYNAMICS & COOLING',
    desc: 'Aggressively sculpted aerodynamic sidepods featuring deep undercut channels to direct high-energy airflow toward the rear diffuser. High-efficiency aluminum core heat exchangers cool both the turbocharged ICE and hybrid ERS batteries.',
    specs: {
      downforce: '320 kg aerodynamic suction',
      weight: '14.5 kg combined',
      temp: 'Radiator: 115°C water / 140°C oil',
      power: 'Heat rejection: 45 kW thermal',
      material: 'Pre-preg Carbon & Aluminium Core'
    }
  },
  'engine': {
    title: 'Hybrid Power Unit & Shark Fin',
    category: 'PROPULSION',
    desc: 'BMU 1.6-litre 90-degree V6 Turbocharged Internal Combustion Engine paired with MGU-K kinetic motor (120 kW) and MGU-H heat energy motor. Features the aerodynamic shark fin with official BMU Racing livery for yaw stability.',
    specs: {
      downforce: 'Low center-of-gravity ballast',
      weight: '150 kg (FIA minimum)',
      temp: 'Exhaust: 980°C | Turbo: 1050°C',
      power: '1,025 BHP combined (ICE 740 + ERS 285)',
      material: 'Cast Iron / Inconel / Carbon Fibre'
    }
  },
  'tyre-rear': {
    title: 'Rear Traction Wheels (Pirelli)',
    category: 'TRACTION & SUSPENSION',
    desc: 'Extra-wide 405 mm Pirelli rear slick tyres providing massive longitudinal traction for over 1,000 BHP launches. Supported by pushrod-actuated rear suspension with anti-squat geometry and carbon-ceramic disc assemblies.',
    specs: {
      downforce: 'Rear Axle Load: 1,150 kg',
      weight: '12.6 kg per wheel',
      temp: 'Operating window: 100°C - 115°C',
      power: 'Transmits 1,025 BHP to tarmac',
      material: 'High-tack polymer & BBS Magnesium'
    }
  },
  'rear-wing': {
    title: 'DRS High-Downforce Rear Wing',
    category: 'AERODYNAMICS',
    desc: 'Dual-element high-downforce rear wing with hydraulically operated Drag Reduction System (DRS). Opens an 85 mm slot gap to reduce aerodynamic drag by 22% on straightaways, granting a +18 km/h top-speed overtaking boost.',
    specs: {
      downforce: '1,250 kg @ 300 km/h',
      weight: '13.8 kg with hydraulic actuator',
      temp: '75°C exhaust heat wash',
      power: 'DRS response: 0.18s actuation',
      material: 'Ultra-high Modulus Carbon Fibre'
    }
  },
  'diffuser': {
    title: 'Ground Effect Floor & Diffuser',
    category: 'GROUND EFFECT',
    desc: 'Full ground-effect Venturi undertray with dual 3D curved venturi tunnels expanding into an upswept rear diffuser. Generates over 60% of total vehicle downforce with minimal induced wake drag using ground effect principles.',
    specs: {
      downforce: '1,850 kg @ 300 km/h',
      weight: '28.0 kg total assembly',
      temp: '65°C underfloor air temp',
      power: 'Ground suction: ~2.4G cornering grip',
      material: 'Carbon honeycomb & Kevlar Skid Plank'
    }
  }
};

/* ==========================================================================
   PROCEDURAL TEXTURES: CARBON FIBER, PIRELLI P-ZERO & BMU DECALS
   ========================================================================== */

function createCarbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141416';
  ctx.fillRect(0, 0, 128, 128);
  const size = 8;
  for (let y = 0; y < 128; y += size) {
    for (let x = 0; x < 128; x += size) {
      const isPattern = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0);
      ctx.fillStyle = isPattern ? '#1c1d22' : '#282930';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = isPattern ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(x, y, size, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createPirelliTyreTexture(isRear) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256, cy = 256;

  // Rubber base
  ctx.fillStyle = '#17171a';
  ctx.fillRect(0, 0, 512, 512);

  // Concentric tyre rubber sidewall grooves
  ctx.strokeStyle = '#222226';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 210, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#101012';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.stroke();

  // Pirelli Soft Red Compound Speed Ring
  ctx.strokeStyle = '#E10600';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, 178, 0, Math.PI * 2);
  ctx.stroke();

  // Draw PIRELLI text arched along the top
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  const brand = "PIRELLI";
  ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#F5A623';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < brand.length; i++) {
    ctx.save();
    const charAngle = (i - (brand.length - 1) / 2) * 0.16;
    ctx.rotate(charAngle);
    ctx.fillText(brand[i], 0, -178);
    ctx.restore();
  }
  ctx.restore();

  // Draw P ZERO text arched along the bottom
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 2);
  const pzero = "P ZERO";
  ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < pzero.length; i++) {
    ctx.save();
    const charAngle = (i - (pzero.length - 1) / 2) * 0.18;
    ctx.rotate(charAngle);
    ctx.fillText(pzero[i], 0, -178);
    ctx.restore();
  }
  ctx.restore();

  // Small FIA wheel spec indicator
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#888892';
  ctx.textAlign = 'center';
  ctx.fillText(isRear ? '405/720 - 18' : '305/720 - 18', cx, cy + 120);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createBmuDecalCanvasTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);

  ctx.font = '900 50px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('BMU RACING', 30, 95);

  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(30, 115, 340, 8);

  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF9933';
  ctx.fillText('BML MUNJAL UNIVERSITY', 30, 155);

  // Number 01 badge
  ctx.fillStyle = '#E10600';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(400, 45, 90, 85, 12);
  } else {
    ctx.rect(400, 45, 90, 85);
  }
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 64px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('01', 445, 112);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/* ==========================================================================
   INITIALIZE THREE.JS SCENE
   ========================================================================== */
function initThreeScene() {
  const container = document.getElementById('canvas-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070709, 0.032);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(7.5, 3.4, 7.5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent camera going below track
  controls.minDistance = 3.5;
  controls.maxDistance = 22;
  controls.target.set(0, 0.7, 0);

  // Studio Lighting Setup: Balanced Studio Illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  // Key Sun Light (Warm White) with Soft Shadows
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunLight.position.set(10, 16, 8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 45;
  const d = 9;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  // Cool Studio Fill Light (from rear left)
  const fillLight = new THREE.DirectionalLight(0xd0e0ff, 0.7);
  fillLight.position.set(-10, 12, -8);
  scene.add(fillLight);

  // Front Key Light for nosecone and wings
  const frontLight = new THREE.DirectionalLight(0xfff8ee, 0.65);
  frontLight.position.set(0, 6, 12);
  scene.add(frontLight);

  // Studio Rim Lights
  const goldRim = new THREE.PointLight(0xF5A623, 1.1, 25);
  goldRim.position.set(-7, 4, 6);
  scene.add(goldRim);

  const blueRim = new THREE.PointLight(0x4090ff, 0.95, 25);
  blueRim.position.set(7, 4, -6);
  scene.add(blueRim);

  // Build Circuit Track Platform & Moving Lines
  buildTrackEnvironment();

  // Build Full 3D Formula 1 Car
  buildFormula1Car();

  // Canvas Event Listeners for Raycasting Click/Touch
  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('touchstart', onCanvasTouch, { passive: true });
}

/* ==========================================================================
   CIRCUIT TRACK PLATFORM & DASHED SPEED LINES
   ========================================================================== */
function buildTrackEnvironment() {
  // Circular asphalt platform
  const trackGeo = new THREE.CylinderGeometry(18, 18, 0.4, 64);
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x121216,
    roughness: 0.85,
    metalness: 0.15
  });
  const track = new THREE.Mesh(trackGeo, trackMat);
  track.position.y = -0.2;
  track.receiveShadow = true;
  scene.add(track);

  // Outer red/white FIA racing kerb ring
  const kerbGeo = new THREE.RingGeometry(16.5, 17.8, 64);
  const kerbMat = new THREE.MeshStandardMaterial({
    color: 0xE10600,
    roughness: 0.7,
    side: THREE.DoubleSide
  });
  const kerb = new THREE.Mesh(kerbGeo, kerbMat);
  kerb.rotation.x = -Math.PI / 2;
  kerb.position.y = 0.01;
  kerb.receiveShadow = true;
  scene.add(kerb);

  // Realistic soft ground ambient occlusion shadow under car
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 512; shadowCanvas.height = 512;
  const sCtx = shadowCanvas.getContext('2d');
  const sGrad = sCtx.createRadialGradient(256, 256, 40, 256, 256, 240);
  sGrad.addColorStop(0, 'rgba(0,0,0,0.88)');
  sGrad.addColorStop(0.35, 'rgba(0,0,0,0.65)');
  sGrad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  sGrad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 512, 512);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const carShadowGeo = new THREE.PlaneGeometry(3.6, 6.4);
  const carShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.82 });
  const carShadow = new THREE.Mesh(carShadowGeo, carShadowMat);
  carShadow.rotation.x = -Math.PI / 2;
  carShadow.position.set(0, 0.012, 0);
  scene.add(carShadow);

  // Moving track dashed lines group (simulates rushing track when racing)
  trackLinesGroup = new THREE.Group();
  for (let z = -20; z <= 20; z += 3.5) {
    const dashGeo = new THREE.PlaneGeometry(0.25, 1.8);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.35 });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.02, z);
    trackLinesGroup.add(dash);

    // Left and right lane bounds
    const sideDashL = dash.clone();
    sideDashL.position.x = -2.8;
    sideDashL.material = new THREE.MeshBasicMaterial({ color: 0xFF9933, transparent: true, opacity: 0.4 });
    trackLinesGroup.add(sideDashL);

    const sideDashR = dash.clone();
    sideDashR.position.x = 2.8;
    sideDashR.material = new THREE.MeshBasicMaterial({ color: 0x138808, transparent: true, opacity: 0.4 });
    trackLinesGroup.add(sideDashR);
  }
  scene.add(trackLinesGroup);

  // Exhaust particle sparks system
  const sparkCount = 60;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    sparkPositions[i * 3] = (Math.random() - 0.5) * 0.4;
    sparkPositions[i * 3 + 1] = 0.4 + Math.random() * 0.3;
    sparkPositions[i * 3 + 2] = -2.6 - Math.random() * 3.5;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xF5A623,
    size: 0.12,
    transparent: true,
    opacity: 0.0
  });
  exhaustSparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(exhaustSparks);
}

/* ==========================================================================
   BUILD COMPLETE REALISTIC 3D FORMULA 1 CAR (BMU F1 CHALLENGER)
   ========================================================================== */
function buildFormula1Car() {
  carGroup = new THREE.Group();
  carGroup.position.y = baseCarY;
  scene.add(carGroup);

  // Procedural Textures
  const carbonTexture = createCarbonTexture();
  const pirelliFrontTexture = createPirelliTyreTexture(false);
  const pirelliRearTexture = createPirelliTyreTexture(true);
  const bmuDecalTexture = createBmuDecalCanvasTexture();
  const textureLoader = new THREE.TextureLoader();
  const bmuLogoTexture = textureLoader.load('bmu-logo.png');

  // Advanced Materials: Clearcoat Lacquers & Metallic Sheens
  const bodyNavyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0A2240, // BMU Deep Sapphire Navy
    metalness: 0.45,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95
  });

  const saffronPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xFF8500, // Racing Saffron
    metalness: 0.35,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06
  });

  const whitePaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xF6F8FA, // Pearl Racing White
    metalness: 0.22,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const greenPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0x0E822E, // Racing Green
    metalness: 0.35,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06
  });

  const goldAccentMat = new THREE.MeshPhysicalMaterial({
    color: 0xD4AF37, // BMU Gold
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181B,
    map: carbonTexture,
    bumpMap: carbonTexture,
    bumpScale: 0.02,
    roughness: 0.45,
    metalness: 0.35
  });

  const carbonGlossMat = new THREE.MeshPhysicalMaterial({
    color: 0x121215,
    map: carbonTexture,
    roughness: 0.25,
    metalness: 0.4,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08
  });

  const tyreTreadMat = new THREE.MeshStandardMaterial({
    color: 0x19191B,
    roughness: 0.92,
    metalness: 0.05
  });

  const pirelliFrontMat = new THREE.MeshStandardMaterial({
    map: pirelliFrontTexture,
    roughness: 0.85,
    metalness: 0.08
  });

  const pirelliRearMat = new THREE.MeshStandardMaterial({
    map: pirelliRearTexture,
    roughness: 0.85,
    metalness: 0.08
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x8E9CA8,
    roughness: 0.22,
    metalness: 0.92
  });

  const exhaustTipMat = new THREE.MeshStandardMaterial({
    color: 0x485872, // Heat-treated burnt blue-grey titanium
    roughness: 0.18,
    metalness: 0.96
  });

  const goldBbsMat = new THREE.MeshStandardMaterial({
    color: 0xD4AF37,
    roughness: 0.22,
    metalness: 0.95
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xE10600,
    roughness: 0.25,
    metalness: 0.8
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x2A2A2E,
    roughness: 0.55,
    metalness: 0.65
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x050C16,
    metalness: 0.98,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0
  });

  const bmuLogoMat = new THREE.MeshBasicMaterial({
    map: bmuLogoTexture,
    transparent: true,
    side: THREE.DoubleSide
  });

  const bmuDecalMat = new THREE.MeshBasicMaterial({
    map: bmuDecalTexture,
    transparent: true,
    side: THREE.DoubleSide
  });

  function tagMesh(mesh, partId) {
    mesh.userData.partId = partId;
    interactiveMeshes.push(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* -------------------------------------------------------------
     1. 4-TIER HIGH-DOWNFORCE FRONT WING (partId: 'front-wing')
     ------------------------------------------------------------- */
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.16, 2.75);

  // Main lower ground-wash aerofoil plane (Carbon fibre)
  const fwBase = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.04, 0.62), carbonMat);
  tagMesh(fwBase, 'front-wing');
  frontWingGroup.add(fwBase);

  // Tier 2 aerodynamic flap (Pearl White)
  const fwFlap2 = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.035, 0.42), whitePaintMat);
  fwFlap2.position.set(0, 0.05, -0.06);
  tagMesh(fwFlap2, 'front-wing');
  frontWingGroup.add(fwFlap2);

  // Tier 3 aerodynamic flap (Metallic Saffron)
  const fwFlap3 = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.035, 0.32), saffronPaintMat);
  fwFlap3.position.set(0, 0.095, -0.12);
  tagMesh(fwFlap3, 'front-wing');
  frontWingGroup.add(fwFlap3);

  // Tier 4 Gurney flap edge (BMU Gold)
  const fwFlap4 = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.03, 0.22), goldAccentMat);
  fwFlap4.position.set(0, 0.14, -0.18);
  tagMesh(fwFlap4, 'front-wing');
  frontWingGroup.add(fwFlap4);

  // Swept aerodynamic vertical endplates with footplate vortex runners
  [-1.7, 1.7].forEach(x => {
    const isRight = x > 0;
    // Main vertical endplate in BMU Navy
    const epGeo = new THREE.BoxGeometry(0.05, 0.42, 0.88);
    const endplate = new THREE.Mesh(epGeo, bodyNavyMat);
    endplate.position.set(x, 0.15, -0.04);
    tagMesh(endplate, 'front-wing');
    frontWingGroup.add(endplate);

    // Outer footplate vortex runner (carbon)
    const footplate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.84), carbonMat);
    footplate.position.set(x + (isRight ? 0.06 : -0.06), 0.02, -0.04);
    tagMesh(footplate, 'front-wing');
    frontWingGroup.add(footplate);

    // Curved outer diveplane flick
    const divePlane = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.28), carbonGlossMat);
    divePlane.position.set(x + (isRight ? 0.1 : -0.1), 0.22, 0.08);
    divePlane.rotation.z = isRight ? -0.22 : 0.22;
    divePlane.rotation.y = isRight ? 0.08 : -0.08;
    tagMesh(divePlane, 'front-wing');
    frontWingGroup.add(divePlane);
  });

  // Dual swan-neck nose mounting pylons
  [-0.22, 0.22].forEach(x => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.38), carbonGlossMat);
    pylon.position.set(x, 0.19, -0.15);
    tagMesh(pylon, 'front-wing');
    frontWingGroup.add(pylon);
  });

  carGroup.add(frontWingGroup);

  /* -------------------------------------------------------------
     2. NOSE CONE & FRONT MONOCOQUE (partId: 'front-wing')
     ------------------------------------------------------------- */
  const noseGroup = new THREE.Group();

  // Sleek downward-sloping needle nosecone
  const noseGeo = new THREE.CylinderGeometry(0.13, 0.38, 1.85, 24);
  const nose = new THREE.Mesh(noseGeo, saffronPaintMat);
  nose.rotation.x = Math.PI / 2 - 0.08;
  nose.position.set(0, 0.34, 1.65);
  tagMesh(nose, 'front-wing');
  noseGroup.add(nose);

  // Lower green aerodynamic nose chin
  const noseChinGeo = new THREE.CylinderGeometry(0.12, 0.34, 1.75, 24);
  const noseChin = new THREE.Mesh(noseChinGeo, greenPaintMat);
  noseChin.rotation.x = Math.PI / 2 - 0.08;
  noseChin.position.set(0, 0.23, 1.65);
  tagMesh(noseChin, 'front-wing');
  noseGroup.add(noseChin);

  // Carbon nose tip impact structure
  const tipGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.22, 16);
  const noseTip = new THREE.Mesh(tipGeo, carbonMat);
  noseTip.rotation.x = Math.PI / 2;
  noseTip.position.set(0, 0.24, 2.58);
  tagMesh(noseTip, 'front-wing');
  noseGroup.add(noseTip);

  // Pitot tube airspeed sensor at extreme nose tip
  const pitotGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8);
  const pitot = new THREE.Mesh(pitotGeo, titaniumMat);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0, 0.25, 2.74);
  noseGroup.add(pitot);

  // Front Bulkhead transition to chassis
  const fBulkGeo = new THREE.CylinderGeometry(0.38, 0.52, 0.9, 24);
  const fBulk = new THREE.Mesh(fBulkGeo, whitePaintMat);
  fBulk.rotation.x = Math.PI / 2;
  fBulk.position.set(0, 0.42, 0.65);
  tagMesh(fBulk, 'front-wing');
  noseGroup.add(fBulk);

  // Official BMU Logo decal on top deck of the nose cone
  const bmuNoseDisc = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), bmuLogoMat);
  bmuNoseDisc.rotation.x = -Math.PI / 2 + 0.12;
  bmuNoseDisc.position.set(0, 0.47, 1.45);
  noseGroup.add(bmuNoseDisc);

  // Race Number 01 decal on nose tip
  const numPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.18), bmuDecalMat);
  numPlane.rotation.x = -Math.PI / 2 + 0.12;
  numPlane.position.set(0, 0.38, 2.05);
  noseGroup.add(numPlane);

  // Left & Right FIA broadcast camera pods
  [-0.28, 0.28].forEach(x => {
    const isRight = x > 0;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), carbonMat);
    stalk.position.set(x, 0.46, 1.6);
    stalk.rotation.z = isRight ? -0.4 : 0.4;
    noseGroup.add(stalk);

    const camPod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 12), carbonGlossMat);
    camPod.position.set(x + (isRight ? 0.04 : -0.04), 0.51, 1.6);
    camPod.rotation.x = Math.PI / 2;
    tagMesh(camPod, 'front-wing');
    noseGroup.add(camPod);
  });

  // Aerodynamic Wing Mirrors on Dual Carbon Stalks
  [-0.68, 0.68].forEach(x => {
    const isRight = x > 0;
    // Mounting stalk
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), carbonMat);
    stalk.position.set(x * 0.85, 0.58, 0.62);
    stalk.rotation.z = isRight ? -0.55 : 0.55;
    noseGroup.add(stalk);

    // Streamlined Mirror Housing in BMU Navy
    const housingGeo = new THREE.BoxGeometry(0.22, 0.11, 0.08);
    const housing = new THREE.Mesh(housingGeo, bodyNavyMat);
    housing.position.set(x, 0.68, 0.62);
    housing.rotation.y = isRight ? -0.22 : 0.22;
    tagMesh(housing, 'front-wing');
    noseGroup.add(housing);

    // Reflective Mirror Glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.08), visorMat);
    glass.position.set(x, 0.68, 0.575);
    glass.rotation.y = isRight ? Math.PI - 0.22 : Math.PI + 0.22;
    noseGroup.add(glass);
  });

  carGroup.add(noseGroup);

  /* -------------------------------------------------------------
     3. COCKPIT, DRIVER & TITANIUM HALO (partId: 'cockpit')
     ------------------------------------------------------------- */
  const cockpitGroup = new THREE.Group();

  // Monocoque survival tub with sleek shoulder transitions
  const tubGeo = new THREE.BoxGeometry(0.88, 0.54, 1.35);
  const tub = new THREE.Mesh(tubGeo, whitePaintMat);
  tub.position.set(0, 0.42, 0.12);
  tagMesh(tub, 'cockpit');
  cockpitGroup.add(tub);

  // Carbon cockpit opening rim & headrest cushion
  const interiorGeo = new THREE.BoxGeometry(0.58, 0.44, 0.82);
  const interior = new THREE.Mesh(interiorGeo, carbonMat);
  interior.position.set(0, 0.52, 0.12);
  tagMesh(interior, 'cockpit');
  cockpitGroup.add(interior);

  // Driver Racing Suit Torso (BMU Navy with Saffron stripes)
  const driverTorso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.36), bodyNavyMat);
  driverTorso.position.set(0, 0.52, 0.08);
  tagMesh(driverTorso, 'cockpit');
  cockpitGroup.add(driverTorso);

  // Racing Harness Safety Straps (Saffron)
  [-0.1, 0.1].forEach(x => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.02), saffronPaintMat);
    strap.position.set(x, 0.54, 0.26);
    cockpitGroup.add(strap);
  });

  // Driver Helmet: Sculpted helmet with chin spoiler
  const helmetGeo = new THREE.SphereGeometry(0.2, 32, 32);
  const helmet = new THREE.Mesh(helmetGeo, saffronPaintMat);
  helmet.position.set(0, 0.82, 0.05);
  tagMesh(helmet, 'cockpit');
  cockpitGroup.add(helmet);

  // Iridescent Dark Mirror Visor
  const visorGeo = new THREE.BoxGeometry(0.24, 0.085, 0.19);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.83, 0.16);
  tagMesh(visor, 'cockpit');
  cockpitGroup.add(visor);

  // Butterfly F1 Steering Wheel
  const wheelBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.03), carbonGlossMat);
  wheelBase.position.set(0, 0.62, 0.38);
  wheelBase.rotation.x = -0.32;
  tagMesh(wheelBase, 'cockpit');
  cockpitGroup.add(wheelBase);

  // Handgrips on steering wheel
  [-0.13, 0.13].forEach(x => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 12), carbonMat);
    grip.position.set(x, 0.62, 0.38);
    grip.rotation.x = -0.32;
    cockpitGroup.add(grip);
  });

  // Central OLED Digital Telemetry Display Screen
  const oledDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.075), new THREE.MeshBasicMaterial({ color: 0x00E676 }));
  oledDisplay.position.set(0, 0.63, 0.398);
  oledDisplay.rotation.x = -0.32;
  cockpitGroup.add(oledDisplay);

  // Shift LEDs above screen
  [-0.05, -0.025, 0, 0.025, 0.05].forEach((x, idx) => {
    const ledColor = idx < 2 ? 0x00E676 : (idx < 4 ? 0xFF0000 : 0x9C27B0);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.012), new THREE.MeshBasicMaterial({ color: ledColor }));
    led.position.set(x, 0.68, 0.382);
    led.rotation.x = -0.32;
    cockpitGroup.add(led);
  });

  // TITANIUM HALO HEAD PROTECTION SYSTEM
  // Central titanium forward pillar
  const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.5, 20), titaniumMat);
  haloPillar.position.set(0, 0.82, 0.42);
  haloPillar.rotation.x = 0.18;
  tagMesh(haloPillar, 'cockpit');
  cockpitGroup.add(haloPillar);

  // Curved Titanium Arch Hoop encircling driver
  const haloArchGeo = new THREE.TorusGeometry(0.39, 0.032, 16, 32, Math.PI + 0.45);
  const haloArch = new THREE.Mesh(haloArchGeo, titaniumMat);
  haloArch.rotation.x = Math.PI / 2 + 0.12;
  haloArch.rotation.z = -Math.PI / 2;
  haloArch.position.set(0, 0.94, 0.11);
  tagMesh(haloArch, 'cockpit');
  cockpitGroup.add(haloArch);

  // Aerodynamic Carbon Fairing Winglet on top of Halo
  const haloFairing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.14), carbonGlossMat);
  haloFairing.position.set(0, 0.98, 0.38);
  haloFairing.rotation.x = 0.18;
  tagMesh(haloFairing, 'cockpit');
  cockpitGroup.add(haloFairing);

  carGroup.add(cockpitGroup);

  /* -------------------------------------------------------------
     4. MODERN DOWNWASH & UNDERCUT SIDEPODS (partId: 'sidepods')
     ------------------------------------------------------------- */
  const sidepodsGroup = new THREE.Group();

  [-0.84, 0.84].forEach(x => {
    const isRight = x > 0;
    // Main contoured sidepod body in BMU Navy
    const spBodyGeo = new THREE.BoxGeometry(0.66, 0.48, 2.35);
    const spBody = new THREE.Mesh(spBodyGeo, bodyNavyMat);
    spBody.position.set(x, 0.36, -0.22);
    tagMesh(spBody, 'sidepods');
    sidepodsGroup.add(spBody);

    // Upper Saffron aerodynamic downwash ramp
    const spRampGeo = new THREE.BoxGeometry(0.64, 0.12, 2.25);
    const spRamp = new THREE.Mesh(spRampGeo, saffronPaintMat);
    spRamp.position.set(x, 0.6, -0.22);
    spRamp.rotation.x = -0.06; // downward slope toward rear beam wing
    tagMesh(spRamp, 'sidepods');
    sidepodsGroup.add(spRamp);

    // Lower aerodynamic undercut channel (Carbon fibre)
    const spUndercutGeo = new THREE.BoxGeometry(0.62, 0.12, 2.3);
    const spUndercut = new THREE.Mesh(spUndercutGeo, carbonMat);
    spUndercut.position.set(x, 0.13, -0.22);
    tagMesh(spUndercut, 'sidepods');
    sidepodsGroup.add(spUndercut);

    // Overbite / Shark-Mouth Air Intake Scoop Rim (Carbon gloss)
    const intakeRimGeo = new THREE.BoxGeometry(0.56, 0.36, 0.14);
    const intakeRim = new THREE.Mesh(intakeRimGeo, carbonGlossMat);
    intakeRim.position.set(x, 0.42, 0.94);
    tagMesh(intakeRim, 'sidepods');
    sidepodsGroup.add(intakeRim);

    // Dark internal radiator cooling matrix
    const intakeHole = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3), new THREE.MeshBasicMaterial({ color: 0x050508 }));
    intakeHole.position.set(x, 0.42, 1.015);
    sidepodsGroup.add(intakeHole);

    // Forward overbite intake upper lip
    const overbiteLip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.18), carbonGlossMat);
    overbiteLip.position.set(x, 0.6, 1.0);
    sidepodsGroup.add(overbiteLip);

    // Sidepod shoulder cooling gill louvers (3 slanted carbon slats)
    [-0.3, -0.1, 0.1].forEach((zPos, idx) => {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.08), carbonGlossMat);
      louver.position.set(x, 0.66, zPos);
      louver.rotation.x = -0.35;
      sidepodsGroup.add(louver);
    });

    // Outer floor edge wing & vortex-generator strakes
    const edgeWing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.6), carbonGlossMat);
    edgeWing.position.set(x + (isRight ? 0.38 : -0.38), 0.15, -0.2);
    tagMesh(edgeWing, 'sidepods');
    sidepodsGroup.add(edgeWing);

    [-0.6, 0.0, 0.5].forEach(zPos => {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.12), carbonGlossMat);
      strake.position.set(x + (isRight ? 0.42 : -0.42), 0.18, zPos);
      strake.rotation.y = isRight ? 0.2 : -0.2;
      sidepodsGroup.add(strake);
    });
  });

  carGroup.add(sidepodsGroup);

  /* -------------------------------------------------------------
     5. ENGINE AIRBOX, SPINE & BMU RACING SHARK FIN (partId: 'engine')
     ------------------------------------------------------------- */
  const engineGroup = new THREE.Group();

  // Tapered engine cover body narrowing into coke-bottle waist
  const engCoverGeo = new THREE.CylinderGeometry(0.22, 0.48, 2.3, 24);
  const engCover = new THREE.Mesh(engCoverGeo, bodyNavyMat);
  engCover.rotation.x = Math.PI / 2;
  engCover.position.set(0, 0.54, -1.05);
  tagMesh(engCover, 'engine');
  engineGroup.add(engCover);

  // Airbox intake scoop above driver helmet in BMU Saffron
  const airboxGeo = new THREE.BoxGeometry(0.36, 0.32, 0.64);
  const airbox = new THREE.Mesh(airboxGeo, saffronPaintMat);
  airbox.position.set(0, 1.06, -0.24);
  tagMesh(airbox, 'engine');
  engineGroup.add(airbox);

  // Triangular airbox intake hole
  const airHole = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  airHole.position.set(0, 1.06, 0.085);
  engineGroup.add(airHole);

  // Central aerodynamic splitter foil inside airbox
  const airSplitter = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.18), carbonGlossMat);
  airSplitter.position.set(0, 1.06, 0.04);
  engineGroup.add(airSplitter);

  // Vertical aerodynamic Shark Fin running along the spine
  const sharkFinGeo = new THREE.BoxGeometry(0.035, 0.58, 1.9);
  const sharkFin = new THREE.Mesh(sharkFinGeo, bodyNavyMat);
  sharkFin.position.set(0, 0.98, -1.05);
  tagMesh(sharkFin, 'engine');
  engineGroup.add(sharkFin);

  // Shark Fin Top Gold Edge Accent
  const finEdge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.9), goldAccentMat);
  finEdge.position.set(0, 1.27, -1.05);
  engineGroup.add(finEdge);

  // Official BMU Logo Badge on BOTH sides of the shark fin
  [-0.022, 0.022].forEach(x => {
    const isRight = x > 0;
    const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.38), bmuLogoMat);
    logoPlane.position.set(x, 1.0, -0.95);
    logoPlane.rotation.y = isRight ? Math.PI / 2 : -Math.PI / 2;
    engineGroup.add(logoPlane);

    // "BMU RACING" team decal plane
    const decalPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.24), bmuDecalMat);
    decalPlane.position.set(x, 0.82, -1.4);
    decalPlane.rotation.y = isRight ? Math.PI / 2 : -Math.PI / 2;
    engineGroup.add(decalPlane);
  });

  // Inconel/Titanium central exhaust tailpipe with heat shield
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.45, 20);
  const exhaust = new THREE.Mesh(exhaustGeo, exhaustTipMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.52, -2.18);
  tagMesh(exhaust, 'engine');
  engineGroup.add(exhaust);

  // Heat shield ring around exhaust
  const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 20), goldAccentMat);
  heatShield.rotation.x = Math.PI / 2;
  heatShield.position.set(0, 0.52, -2.05);
  engineGroup.add(heatShield);

  // Flanking wastegate screamer pipes
  [-0.14, 0.14].forEach(x => {
    const wg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), titaniumMat);
    wg.rotation.x = Math.PI / 2;
    wg.position.set(x, 0.44, -2.12);
    engineGroup.add(wg);
  });

  carGroup.add(engineGroup);

  /* -------------------------------------------------------------
     6. 18" PIRELLI WHEELS & SUSPENSION (partId: 'tyre-front' & 'tyre-rear')
     ------------------------------------------------------------- */
  function createWheelAssembly(radius, width, partId, isRear) {
    const wheelAssembly = new THREE.Group();

    // 1. Slick Tyre vulcanized rubber tread cylinder
    const tyreGeo = new THREE.CylinderGeometry(radius, radius, width - 0.06, 32);
    const tyre = new THREE.Mesh(tyreGeo, tyreTreadMat);
    tyre.rotation.z = Math.PI / 2;
    tagMesh(tyre, partId);
    wheelAssembly.add(tyre);

    // 2. Rounded/chamfered tyre shoulders (torus rings on outer and inner shoulders)
    [-width / 2 + 0.03, width / 2 - 0.03].forEach(xPos => {
      const shoulderGeo = new THREE.TorusGeometry(radius - 0.03, 0.03, 16, 32);
      const shoulder = new THREE.Mesh(shoulderGeo, tyreTreadMat);
      shoulder.position.x = xPos;
      shoulder.rotation.y = Math.PI / 2;
      wheelAssembly.add(shoulder);
    });

    // 3. High-Contrast Pirelli P-Zero Sidewall Rings
    const sidewallMat = isRear ? pirelliRearMat : pirelliFrontMat;
    [-width / 2 - 0.003, width / 2 + 0.003].forEach(xPos => {
      const ringGeo = new THREE.RingGeometry(radius * 0.52, radius * 0.96, 32);
      const ring = new THREE.Mesh(ringGeo, sidewallMat);
      ring.position.x = xPos;
      ring.rotation.y = xPos > 0 ? Math.PI / 2 : -Math.PI / 2;
      wheelAssembly.add(ring);
    });

    // 4. 18" BBS Gold Rim Face & Aero Wheel Cover Ring
    [-width / 2 - 0.006, width / 2 + 0.006].forEach(xPos => {
      // Carbon outer aero rim lip
      const rimLipGeo = new THREE.RingGeometry(radius * 0.5, radius * 0.54, 32);
      const rimLip = new THREE.Mesh(rimLipGeo, carbonMat);
      rimLip.position.x = xPos;
      rimLip.rotation.y = xPos > 0 ? Math.PI / 2 : -Math.PI / 2;
      wheelAssembly.add(rimLip);

      // BBS Magnesium Gold Spoke Wheel Center
      const rimGeo = new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.02, 24);
      const rim = new THREE.Mesh(rimGeo, goldBbsMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = xPos;
      wheelAssembly.add(rim);

      // Anodized racing red center-lock wheel nut
      const nutGeo = new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, 0.06, 12);
      const nut = new THREE.Mesh(nutGeo, caliperMat);
      nut.rotation.z = Math.PI / 2;
      nut.position.x = xPos + (xPos > 0 ? 0.025 : -0.025);
      wheelAssembly.add(nut);
    });

    // 5. Internal Drilled Carbon-Ceramic Brake Rotor
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, 0.03, 24);
    const rotor = new THREE.Mesh(rotorGeo, brakeDiscMat);
    rotor.rotation.z = Math.PI / 2;
    wheelAssembly.add(rotor);

    // 6. Brembo 6-Piston Red Monobloc Brake Caliper
    const caliperGeo = new THREE.BoxGeometry(0.12, radius * 0.32, 0.16);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(0, radius * 0.28, 0);
    wheelAssembly.add(caliper);

    return wheelAssembly;
  }

  // Front Wheels (305 mm width)
  const frontWheelL = createWheelAssembly(0.52, 0.42, 'tyre-front', false);
  frontWheelL.position.set(-1.62, 0.52, 1.8);
  carGroup.add(frontWheelL);
  wheels.push(frontWheelL);

  const frontWheelR = createWheelAssembly(0.52, 0.42, 'tyre-front', false);
  frontWheelR.position.set(1.62, 0.52, 1.8);
  carGroup.add(frontWheelR);
  wheels.push(frontWheelR);

  // Front Carbon Suspension Wishbones & Pushrods
  [-1.62, 1.62].forEach(x => {
    const isRight = x > 0;
    const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.15, 12);
    // Upper A-Arm Wishbone
    const upperArm = new THREE.Mesh(armGeo, carbonGlossMat);
    upperArm.position.set(x * 0.55, 0.56, 1.8);
    upperArm.rotation.z = isRight ? 1.35 : -1.35;
    tagMesh(upperArm, 'tyre-front');
    carGroup.add(upperArm);

    // Lower A-Arm Wishbone
    const lowerArm = new THREE.Mesh(armGeo, carbonGlossMat);
    lowerArm.position.set(x * 0.55, 0.32, 1.8);
    lowerArm.rotation.z = isRight ? 1.45 : -1.45;
    tagMesh(lowerArm, 'tyre-front');
    carGroup.add(lowerArm);

    // Pushrod Strut
    const pushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.25, 8), carbonGlossMat);
    pushrod.position.set(x * 0.52, 0.48, 1.72);
    pushrod.rotation.z = isRight ? 0.95 : -0.95;
    tagMesh(pushrod, 'tyre-front');
    carGroup.add(pushrod);

    // Brake Duct Cooling Scoop
    const duct = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.16), carbonGlossMat);
    duct.position.set(x - (isRight ? 0.18 : -0.18), 0.52, 1.92);
    tagMesh(duct, 'tyre-front');
    carGroup.add(duct);
  });

  // Rear Wheels (405 mm width - massive traction)
  const rearWheelL = createWheelAssembly(0.56, 0.55, 'tyre-rear', true);
  rearWheelL.position.set(-1.68, 0.56, -1.85);
  carGroup.add(rearWheelL);
  wheels.push(rearWheelL);

  const rearWheelR = createWheelAssembly(0.56, 0.55, 'tyre-rear', true);
  rearWheelR.position.set(1.68, 0.56, -1.85);
  carGroup.add(rearWheelR);
  wheels.push(rearWheelR);

  // Rear Suspension Wishbones
  [-1.68, 1.68].forEach(x => {
    const isRight = x > 0;
    const rArmGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.18, 12);
    const rUpperArm = new THREE.Mesh(rArmGeo, carbonGlossMat);
    rUpperArm.position.set(x * 0.55, 0.58, -1.85);
    rUpperArm.rotation.z = isRight ? 1.35 : -1.35;
    tagMesh(rUpperArm, 'tyre-rear');
    carGroup.add(rUpperArm);

    const rLowerArm = new THREE.Mesh(rArmGeo, carbonGlossMat);
    rLowerArm.position.set(x * 0.55, 0.34, -1.85);
    rLowerArm.rotation.z = isRight ? 1.45 : -1.45;
    tagMesh(rLowerArm, 'tyre-rear');
    carGroup.add(rLowerArm);

    // Rear Pushrod
    const rPushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.22, 8), carbonGlossMat);
    rPushrod.position.set(x * 0.52, 0.5, -1.78);
    rPushrod.rotation.z = isRight ? 0.98 : -0.98;
    tagMesh(rPushrod, 'tyre-rear');
    carGroup.add(rPushrod);
  });

  /* -------------------------------------------------------------
     7. DRS HIGH-DOWNFORCE SWAN-NECK REAR WING (partId: 'rear-wing')
     ------------------------------------------------------------- */
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 1.05, -2.4);

  // Dual swan-neck carbon mounting pylons arching from transmission
  [-0.26, 0.26].forEach(x => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, 0.18), carbonGlossMat);
    pylon.position.set(x, -0.22, 0.06);
    pylon.rotation.x = -0.26;
    tagMesh(pylon, 'rear-wing');
    rearWingGroup.add(pylon);
  });

  // Lower carbon beam wing spanning between rear wheel uprights
  const beamWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.035, 0.32), carbonGlossMat);
  beamWing.position.set(0, -0.32, 0.1);
  tagMesh(beamWing, 'rear-wing');
  rearWingGroup.add(beamWing);

  // Main lower curved downforce aerofoil (Saffron & Carbon)
  const rwMain = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.065, 0.56), saffronPaintMat);
  rwMain.position.set(0, 0.12, 0);
  tagMesh(rwMain, 'rear-wing');
  rearWingGroup.add(rwMain);

  // Upper DRS flap (Pearl White with Gold trailing edge)
  const rwDrs = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.045, 0.32), whitePaintMat);
  rwDrs.position.set(0, 0.25, -0.1);
  tagMesh(rwDrs, 'rear-wing');
  rearWingGroup.add(rwDrs);

  // Central hydraulic DRS actuator pod in racing red
  const drsPod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.24), caliperMat);
  drsPod.position.set(0, 0.25, -0.06);
  tagMesh(drsPod, 'rear-wing');
  rearWingGroup.add(drsPod);

  // Large swept vertical endplates in BMU Navy with BMU Logos
  [-1.22, 1.22].forEach(x => {
    const isRight = x > 0;
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.88), bodyNavyMat);
    ep.position.set(x, 0.12, -0.05);
    tagMesh(ep, 'rear-wing');
    rearWingGroup.add(ep);

    // BMU Logo on outer face of endplate
    const epLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.32), bmuLogoMat);
    epLogo.position.set(x + (isRight ? 0.028 : -0.028), 0.12, -0.05);
    epLogo.rotation.y = isRight ? Math.PI / 2 : -Math.PI / 2;
    rearWingGroup.add(epLogo);
  });

  // FIA Rain Safety Flashing Red LED Light
  const fiaLightGeo = new THREE.BoxGeometry(0.18, 0.09, 0.05);
  const fiaLightMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
  const fiaLight = new THREE.Mesh(fiaLightGeo, fiaLightMat);
  fiaLight.position.set(0, -0.56, 0.1);
  rearWingGroup.add(fiaLight);

  carGroup.add(rearWingGroup);

  /* -------------------------------------------------------------
     8. GROUND EFFECT VENTURI FLOOR & DIFFUSER (partId: 'diffuser')
     ------------------------------------------------------------- */
  const floorGroup = new THREE.Group();

  // Wide ground-effect Venturi floor plate in carbon
  const floorGeo = new THREE.BoxGeometry(2.35, 0.05, 5.25);
  const floor = new THREE.Mesh(floorGeo, carbonMat);
  floor.position.set(0, 0.14, 0.1);
  tagMesh(floor, 'diffuser');
  floorGroup.add(floor);

  // Front tea-tray keel splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), carbonGlossMat);
  splitter.position.set(0, 0.13, 1.85);
  tagMesh(splitter, 'diffuser');
  floorGroup.add(splitter);

  // Rear upswept diffuser channels
  const diffuserGeo = new THREE.BoxGeometry(2.05, 0.28, 0.98);
  const diffuser = new THREE.Mesh(diffuserGeo, carbonGlossMat);
  diffuser.position.set(0, 0.22, -2.26);
  diffuser.rotation.x = 0.24;
  tagMesh(diffuser, 'diffuser');
  floorGroup.add(diffuser);

  // Vertical aerodynamic guide fences
  [-0.62, -0.22, 0.22, 0.62].forEach(x => {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.95), carbonGlossMat);
    fence.position.set(x, 0.25, -2.26);
    fence.rotation.x = 0.24;
    tagMesh(fence, 'diffuser');
    floorGroup.add(fence);
  });

  carGroup.add(floorGroup);
}

/* ==========================================================================
   WEB AUDIO API ENGINE PROCEDURAL SOUND
   ========================================================================== */
function toggleEngineAudio(start) {
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (start) {
      if (engineOsc1) return;
      engineOsc1 = audioCtx.createOscillator();
      engineOsc2 = audioCtx.createOscillator();
      engineFilter = audioCtx.createBiquadFilter();
      engineGain = audioCtx.createGain();

      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.setValueAtTime(60, audioCtx.currentTime);

      engineOsc2.type = 'triangle';
      engineOsc2.frequency.setValueAtTime(120, audioCtx.currentTime);

      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(400, audioCtx.currentTime);

      engineGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      engineGain.gain.linearRampToValueAtTime(0.14, audioCtx.currentTime + 0.4);

      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(audioCtx.destination);

      engineOsc1.start();
      engineOsc2.start();
    } else {
      if (engineGain) {
        engineGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        setTimeout(() => {
          if (engineOsc1) {
            try {
              engineOsc1.stop();
              engineOsc2.stop();
            } catch (e) {}
            engineOsc1 = null; engineOsc2 = null; engineGain = null; engineFilter = null;
          }
        }, 320);
      }
    }
  } catch (e) {
    console.warn('Audio synthesis notice:', e);
  }
}

function updateEngineAudioPitch(rpmNorm) {
  if (!audioCtx || !engineOsc1) return;
  try {
    const baseFreq = 58 + rpmNorm * 220; // 58Hz to 278Hz
    engineOsc1.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.05);
    if (engineOsc2) {
      engineOsc2.frequency.setTargetAtTime(baseFreq * 2.05, audioCtx.currentTime, 0.05);
    }
    if (engineFilter) {
      engineFilter.frequency.setTargetAtTime(380 + rpmNorm * 1250, audioCtx.currentTime, 0.05);
    }
  } catch (e) {}
}

/* ==========================================================================
   ANIMATION & RENDER LOOP
   ========================================================================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // OrbitControls update
  controls.update();

  // Auto-Rotate
  controls.autoRotate = autoRotateActive;
  controls.autoRotateSpeed = 2.0;

  // Dynamic Race Mode
  if (isRacing) {
    // 1. Wheels spin rapidly
    wheels.forEach(w => {
      w.rotation.x -= 0.45;
    });

    // 2. Chassis vibrates realistically with engine revs
    carGroup.position.y = baseCarY + Math.sin(elapsedTime * 60) * 0.012;

    // 3. Track dashes rush backwards at 320+ km/h
    if (trackLinesGroup) {
      trackLinesGroup.position.z -= 1.15;
      if (trackLinesGroup.position.z < -7) {
        trackLinesGroup.position.z = 0;
      }
    }

    // 4. Exhaust sparks
    if (exhaustSparks) {
      exhaustSparks.material.opacity = 0.85;
      const positions = exhaustSparks.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] -= 0.35;
        if (positions[i + 2] < -7) {
          positions[i + 2] = -2.6;
          positions[i] = (Math.random() - 0.5) * 0.4;
        }
      }
      exhaustSparks.geometry.attributes.position.needsUpdate = true;
    }

    // 5. Telemetry acceleration
    currentSpeed = Math.min(335, currentSpeed + 4.5);
    currentRpm = Math.min(14800, currentRpm + 220);

    updateEngineAudioPitch(currentRpm / 15000);
    document.getElementById('teleDrs').textContent = 'ACTIVE';
    document.getElementById('teleDrs').style.color = '#00E676';
  } else {
    // Decelerate smoothly to idle/stop
    if (currentSpeed > 0) {
      currentSpeed = Math.max(0, currentSpeed - 8);
      currentRpm = Math.max(0, currentRpm - 350);
      wheels.forEach(w => {
        w.rotation.x -= (currentSpeed / 335) * 0.45;
      });
      if (trackLinesGroup && trackLinesGroup.position.z < 0) {
        trackLinesGroup.position.z += 0.2;
      }
      updateEngineAudioPitch(currentRpm / 15000);
    } else {
      carGroup.position.y = baseCarY;
      if (exhaustSparks) exhaustSparks.material.opacity = 0.0;
      document.getElementById('teleDrs').textContent = 'READY';
      document.getElementById('teleDrs').style.color = '#FFFFFF';
    }
  }

  // Update Telemetry HUD numbers
  document.getElementById('teleSpeed').textContent = Math.round(currentSpeed) + ' KM/H';
  document.getElementById('teleRpm').textContent = Math.round(currentRpm).toLocaleString() + ' RPM';

  renderer.render(scene, camera);
}

/* ==========================================================================
   CAMERA & HUD CONTROLS
   ========================================================================== */
function toggleAutoRotate() {
  autoRotateActive = !autoRotateActive;
  const btn = document.getElementById('btnAutoRotate');
  btn.classList.toggle('active', autoRotateActive);
}

function toggleRaceMode() {
  isRacing = !isRacing;
  const btn = document.getElementById('btnRaceMode');
  btn.classList.toggle('active-race', isRacing);
  toggleEngineAudio(isRacing);

  if (isRacing) {
    showToast('🏎️ Race Mode Activated: Wheels spinning & engine roaring!', 'success');
  } else {
    showToast('🛑 Car decelerating to pit lane stop.', '');
  }
}

function resetCameraView() {
  camera.position.set(7.5, 3.4, 7.5);
  controls.target.set(0, 0.7, 0);
  controls.update();
  showToast('🎯 View Angle Reset', '');
}

/* ==========================================================================
   PART INSPECTION & RAYCASTING
   ========================================================================== */
function onCanvasClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  performRaycast();
}

function onCanvasTouch(event) {
  if (event.touches.length === 1) {
    const rect = renderer.domElement.getBoundingClientRect();
    const touch = event.touches[0];
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    performRaycast();
  }
}

function performRaycast() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveMeshes, false);
  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    if (hitObj.userData && hitObj.userData.partId) {
      inspectPart(hitObj.userData.partId);
      flashMesh(hitObj);
    }
  }
}

function flashMesh(mesh) {
  if (mesh.material && mesh.material.emissive) {
    const origEmissive = mesh.material.emissive.getHex();
    mesh.material.emissive.setHex(0xFF9933);
    setTimeout(() => {
      mesh.material.emissive.setHex(origEmissive);
    }, 300);
  }
}

let activePartId = 'front-wing';

function inspectPart(partId) {
  activePartId = partId;
  const data = PARTS_DATA[partId];
  if (!data) return;

  // Update Part Card
  document.getElementById('partTitle').textContent = data.title;
  document.getElementById('partCategory').textContent = data.category;
  document.getElementById('partDesc').textContent = data.desc;
  document.getElementById('specDownforce').textContent = data.specs.downforce;
  document.getElementById('specWeight').textContent = data.specs.weight;
  document.getElementById('specTemp').textContent = data.specs.temp;
  document.getElementById('specPower').textContent = data.specs.power;
  document.getElementById('specMaterial').textContent = data.specs.material;

  const editBtn = document.getElementById('btnEditPartCard');
  if (editBtn) {
    editBtn.style.display = (currentUser && currentUser.role === 'admin') ? 'inline-flex' : 'none';
  }
  document.getElementById('partCard').classList.add('show');

  // Update active pill in bottom dock
  document.querySelectorAll('.dock-pill').forEach(pill => {
    pill.classList.remove('active');
    if (pill.getAttribute('onclick').includes(partId)) {
      pill.classList.add('active');
    }
  });
}

function closePartCard() {
  document.getElementById('partCard').classList.remove('show');
}
