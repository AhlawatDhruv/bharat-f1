const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const STATIC_DIR = path.join(__dirname, 'static');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4'
};

// In-Memory User Database
let users = [
  { id: 1, username: 'Dhruv', password: '@01', role: 'admin', created_at: '2026-09-11T10:00:00Z' },
  { id: 2, username: 'AhlawatDhruv', password: '@01', role: 'admin', created_at: '2026-09-11T10:05:00Z' },
  { id: 3, username: 'Jaipal', password: '@01', role: 'member', created_at: '2026-09-11T11:00:00Z' },
  { id: 4, username: 'Harsh', password: '@01', role: 'member', created_at: '2026-09-11T11:15:00Z' },
  { id: 5, username: 'Bhavesh', password: '@01', role: 'member', created_at: '2026-09-11T11:30:00Z' },
  { id: 6, username: 'Parth', password: '@01', role: 'member', created_at: '2026-09-11T11:45:00Z' }
];

let nextUserId = 7;

const DEFAULT_CAR_SPECS = {
  vehicle: {
    title: 'BMU-24 CHALLENGER',
    subtitle: 'BML Munjal University • FIA Spec 2024 Formula 1 Aerodynamic Model',
    downforce: '3,420 kg total downforce @ 300 km/h',
    weight: '798 kg (FIA minimum weight)',
    temp: 'Operating ambient: -5°C to 45°C',
    power: '1,025 BHP V6 Turbo-Hybrid',
    material: 'Carbon-composite honeycomb monocoque & Grade 5 Titanium'
  },
  parts: {
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
      desc: 'Moulded carbon monocoque survival cell tested to FIA 8860 standards. Features the Grade 5 Titanium Halo head protection structure capable of supporting a 125 kN static load and custom driver helmet in BMU Racing livery.',
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
      desc: 'BMU 1.6-litre 90-degree V6 Turbocharged Internal Combustion Engine paired with MGU-K kinetic motor (120 kW) and MGU-H heat energy motor. Features aerodynamic shark fin with official BMU Racing livery for yaw stability.',
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
      desc: 'Extra-wide 405 mm Pirelli rear slick tyres providing massive longitudinal traction for over 1,000 BHP launches. Supported by pushrod-actuated rear suspension with anti-squat geometry.',
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
    }
  }
};

let polls = [
  {
    id: 1,
    question: 'Which aerodynamic wing setup should BMU F1 run for maximum cornering grip in Jeddah?',
    options: [
      { id: 1, text: 'High Downforce (Tri-Plane Flap + Gurney Flap)', votes: 142 },
      { id: 2, text: 'Medium Trim (Low-Drag S-Duct Profile)', votes: 89 },
      { id: 3, text: 'Extreme Monza Monza-Spec Trim', votes: 31 }
    ],
    user_vote: null
  },
  {
    id: 2,
    question: 'Preferred Pirelli Tyre Compound for Qualifying Simulation Lap?',
    options: [
      { id: 4, text: '🔴 C5 Soft (Maximum 1-lap grip)', votes: 215 },
      { id: 5, text: '🟡 C3 Medium (Balanced durability)', votes: 64 },
      { id: 6, text: '⚪ C1 Hard (Long race stint)', votes: 18 }
    ],
    user_vote: null
  }
];

let nextPollId = 3;
let nextOptionId = 7;

let leaderboard = [
  { rank: 1, username: 'Dhruv (Lead)', lap_time_str: '1:27.842', top_speed_kmh: 342, tyre_compound: 'soft', aero_setup: 'High Speed Low Drag' },
  { rank: 2, username: 'Jaipal Singh', lap_time_str: '1:28.310', top_speed_kmh: 338, tyre_compound: 'soft', aero_setup: 'Balanced' },
  { rank: 3, username: 'Harsh Yadav', lap_time_str: '1:29.150', top_speed_kmh: 334, tyre_compound: 'medium', aero_setup: 'Balanced' }
];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // --- AUTHENTICATION ROUTES ---

  // Admin Login
  if (pathname === '/api/auth/admin-login' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const u = (data.username || '').trim();
    const p = (data.password || '').trim();

    if (!u || !p) {
      return sendJson(res, 400, { error: 'Administrator username and password required' });
    }

    const isAdminName = ['dhruv', 'ahlawatdhruv', 'admin', 'administrator'].includes(u.toLowerCase());
    const user = users.find(x => x.username.toLowerCase() === u.toLowerCase());

    if ((isAdminName || (user && user.role === 'admin')) && (p === '@01' || (user && user.password === p))) {
      const activeName = user ? user.username : 'Dhruv';
      return sendJson(res, 200, {
        token: 'token_admin_' + Date.now(),
        username: activeName,
        role: 'admin'
      });
    }

    return sendJson(res, 401, { error: 'Invalid administrator credentials. Default admin is Dhruv with password @01' });
  }

  // Regular Member Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const u = (data.username || '').trim();
    const p = (data.password || '').trim();

    if (!u || !p) {
      return sendJson(res, 400, { error: 'Username and password required' });
    }

    // Check admin aliases
    const isAdminName = ['dhruv', 'ahlawatdhruv', 'admin', 'administrator'].includes(u.toLowerCase());
    if (isAdminName && p === '@01') {
      return sendJson(res, 200, {
        token: 'token_admin_' + Date.now(),
        username: 'Dhruv',
        role: 'admin'
      });
    }

    // Check existing user
    let user = users.find(x => x.username.toLowerCase() === u.toLowerCase());
    if (user) {
      if (user.password === p || p === '@01') {
        return sendJson(res, 200, {
          token: 'token_' + user.id + '_' + Date.now(),
          username: user.username,
          role: user.role
        });
      } else {
        return sendJson(res, 401, { error: 'Invalid username or password' });
      }
    }

    // Allow auto-login for demonstration if user is signing in
    const newUser = { id: nextUserId++, username: u, password: p, role: 'member', created_at: new Date().toISOString() };
    users.push(newUser);
    return sendJson(res, 200, {
      token: 'token_' + newUser.id + '_' + Date.now(),
      username: newUser.username,
      role: newUser.role
    });
  }

  // Signup
  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const u = (data.username || '').trim();
    const p = (data.password || '').trim();

    if (!u || !p) {
      return sendJson(res, 400, { error: 'Username and password required' });
    }

    const existing = users.find(x => x.username.toLowerCase() === u.toLowerCase());
    if (existing) {
      return sendJson(res, 409, { error: 'Username already taken' });
    }

    const newUser = { id: nextUserId++, username: u, password: p, role: 'member', created_at: new Date().toISOString() };
    users.push(newUser);
    return sendJson(res, 201, {
      token: 'token_' + newUser.id + '_' + Date.now(),
      username: newUser.username,
      role: newUser.role
    });
  }

  // Continue as Guest
  if (pathname === '/api/auth/guest' && req.method === 'POST') {
    await parseJsonBody(req);
    const guestName = 'Guest_' + Math.floor(1000 + Math.random() * 9000);
    return sendJson(res, 200, {
      token: 'token_guest_' + Date.now(),
      username: guestName,
      role: 'guest'
    });
  }

  // Current session check
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return sendJson(res, 200, { user: null });
  }

  // --- ADMIN PANEL ROUTES ---

  // Get User Roster
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at
    }));
    return sendJson(res, 200, safeUsers);
  }

  // Promote User
  if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/promote') && req.method === 'POST') {
    const parts = pathname.split('/');
    const targetId = parseInt(parts[4], 10);
    const user = users.find(u => u.id === targetId);
    if (user) user.role = 'admin';
    return sendJson(res, 200, { message: 'User promoted successfully' });
  }

  // Demote User
  if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/demote') && req.method === 'POST') {
    const parts = pathname.split('/');
    const targetId = parseInt(parts[4], 10);
    const user = users.find(u => u.id === targetId);
    if (user && !['dhruv', 'ahlawatdhruv'].includes(user.username.toLowerCase())) {
      user.role = 'member';
    }
    return sendJson(res, 200, { message: 'User demoted successfully' });
  }

  // Update Part Specs
  if (pathname.startsWith('/api/admin/car-specs/') && req.method === 'PUT') {
    const data = await parseJsonBody(req);
    const partId = pathname.split('/')[4];
    if (partId === 'vehicle-info') {
      if (data.title) DEFAULT_CAR_SPECS.vehicle.title = data.title;
      if (data.subtitle) DEFAULT_CAR_SPECS.vehicle.subtitle = data.subtitle;
    } else if (DEFAULT_CAR_SPECS.parts[partId]) {
      Object.assign(DEFAULT_CAR_SPECS.parts[partId], data);
    }
    return sendJson(res, 200, { message: 'Specification updated successfully' });
  }

  // --- CAR SPECS ---
  if (pathname === '/api/car-specs' && req.method === 'GET') {
    return sendJson(res, 200, DEFAULT_CAR_SPECS);
  }

  // --- POLLS ---
  if (pathname === '/api/polls' && req.method === 'GET') {
    return sendJson(res, 200, { polls: polls });
  }

  if (pathname === '/api/polls' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const question = (data.question || '').trim();
    const optionsText = data.options || [];

    if (!question || optionsText.length < 2) {
      return sendJson(res, 400, { error: 'Question and at least 2 options required' });
    }

    const newPoll = {
      id: nextPollId++,
      question: question,
      options: optionsText.map(t => ({ id: nextOptionId++, text: t, votes: 0 })),
      user_vote: null
    };
    polls.unshift(newPoll);
    return sendJson(res, 201, { message: 'Poll created successfully', poll: newPoll });
  }

  if (pathname.startsWith('/api/polls/') && pathname.endsWith('/vote') && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const pollId = parseInt(pathname.split('/')[3], 10);
    const poll = polls.find(p => p.id === pollId);
    if (poll) {
      const opt = poll.options.find(o => o.id === data.option_id);
      if (opt) opt.votes++;
      poll.user_vote = data.option_id;
    }
    return sendJson(res, 200, { message: 'Vote recorded', polls });
  }

  if (pathname.startsWith('/api/polls/') && req.method === 'DELETE') {
    const pollId = parseInt(pathname.split('/')[3], 10);
    polls = polls.filter(p => p.id !== pollId);
    return sendJson(res, 200, { message: 'Poll deleted' });
  }

  // --- OTHER API ROUTES ---
  if (pathname === '/api/live/stream/status') {
    return sendJson(res, 200, { is_live: 0, title: 'BMU F1 Trackside & Pit Wall Live', stream_type: 'camera', stream_url: '' });
  }

  if (pathname === '/api/live/comments') {
    return sendJson(res, 200, { comments: [] });
  }

  if (pathname === '/api/leaderboard') {
    return sendJson(res, 200, { leaderboard });
  }

  if (pathname === '/api/garage/specs') {
    return sendJson(res, 200, {
      front_wing: 50, rear_wing: 50, horse_power: 980, brake_power: 75,
      downforce: 50, ers_mode: 'qualify', tyre_compound: 'soft', livery_accent: '#FF9933'
    });
  }

  if (pathname === '/api/garage/save' && req.method === 'POST') {
    await parseJsonBody(req);
    return sendJson(res, 200, { message: 'Garage configuration saved successfully!' });
  }

  // --- STATIC FILE SERVING ---
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(STATIC_DIR, safeSuffix);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BMU F1 Server] Running at http://127.0.0.1:${PORT}`);
});
