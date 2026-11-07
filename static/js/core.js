/* ==========================================================================
   BMU F1 - CORE APPLICATION CONTROLLER, ROUTER & AUTHENTICATION
   ========================================================================== */

// --- GLOBAL STATE ---
let currentUser = null;
let vehicleHeaderData = {
  title: 'BMU-24 CHALLENGER',
  subtitle: 'BML Munjal University • FIA Spec 2024 Formula 1 Aerodynamic Model'
};

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => {
    t.className = 'toast';
  }, 3200);
}

/* ==========================================================================
   API CLIENT
   ========================================================================== */
async function apiCall(method, path, body = null, requireAuth = true) {
  const opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (requireAuth && currentUser && currentUser.token) {
    opts.headers['Authorization'] = 'Bearer ' + currentUser.token;
  }
  if (body) {
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(path, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data: data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: 'Network error or server unavailable' } };
  }
}

/* ==========================================================================
   AUTHENTICATION LOGIC & MODALS
   ========================================================================== */
function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('show');
  switchModalTab(defaultTab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
  clearAuthErrors();
}

function switchModalTab(tab) {
  clearAuthErrors();
  const tabs = ['admin', 'login', 'signup'];
  tabs.forEach(t => {
    const btn = document.getElementById('modalTabBtn' + capitalize(t));
    const pane = document.getElementById('pane' + capitalize(t));
    if (btn) btn.classList.toggle('active', t === tab);
    if (pane) pane.classList.toggle('active', t === tab);
  });
}

function clearAuthErrors() {
  ['adminError', 'loginError', 'signupError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function doAdminLogin() {
  const u = document.getElementById('adminUsername').value.trim();
  const p = document.getElementById('adminPassword').value;
  clearAuthErrors();

  if (!u || !p) {
    showAuthError('adminError', 'Please enter administrator username and password');
    return;
  }

  const res = await apiCall('POST', '/api/auth/admin-login', { username: u, password: p }, false);
  if (res.ok) {
    handleLoginSuccess(res.data);
    showToast('👑 Welcome Root Administrator ' + res.data.username + '!', 'success');
  } else {
    showAuthError('adminError', res.data.error || 'Invalid administrator credentials');
  }
}

async function doMemberLogin() {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;
  clearAuthErrors();

  if (!u || !p) {
    showAuthError('loginError', 'Please enter username and password');
    return;
  }

  const res = await apiCall('POST', '/api/auth/login', { username: u, password: p }, false);
  if (res.ok) {
    handleLoginSuccess(res.data);
    showToast('🏎️ Welcome back, ' + res.data.username + '!', 'success');
  } else {
    showAuthError('loginError', res.data.error || 'Invalid username or password');
  }
}

async function doSignup() {
  const u = document.getElementById('signupUsername').value.trim();
  const p = document.getElementById('signupPassword').value;
  const c = document.getElementById('signupConfirm').value;
  clearAuthErrors();

  if (!u || !p) {
    showAuthError('signupError', 'Please provide username and password');
    return;
  }
  if (p !== c) {
    showAuthError('signupError', 'Passwords do not match');
    return;
  }
  if (p.length < 4) {
    showAuthError('signupError', 'Password must be at least 4 characters');
    return;
  }

  const res = await apiCall('POST', '/api/auth/signup', { username: u, password: p }, false);
  if (res.ok) {
    handleLoginSuccess(res.data);
    showToast('🎉 Account registered! Welcome to BMU F1, ' + res.data.username, 'success');
  } else {
    showAuthError('signupError', res.data.error || 'Signup failed');
  }
}

async function continueAsGuest() {
  const res = await apiCall('POST', '/api/auth/guest', {}, false);
  if (res.ok) {
    handleLoginSuccess(res.data);
    showToast('👤 Entered as Guest (View-Only)', '');
  }
}

function handleLoginSuccess(user) {
  currentUser = user;
  localStorage.setItem('bharatf1_user', JSON.stringify(currentUser));
  closeAuthModal();
  updateAuthUI();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('bharatf1_user');
  if (typeof toggleCreatePollBox === 'function') toggleCreatePollBox(false);
  updateAuthUI();
  switchView('car');
  showToast('Logged out successfully', '');
}

function updateAuthUI() {
  const navAuth = document.getElementById('navAuthSection');
  const adminTab = document.getElementById('tab-admin');
  const createPollBtn = document.getElementById('btnOpenCreatePoll');
  const guestBanner = document.getElementById('guestBanner');

  if (currentUser) {
    let roleClass = 'role-member';
    if (currentUser.role === 'admin') roleClass = 'role-admin';
    if (currentUser.role === 'guest') roleClass = 'role-guest';

    if (navAuth) {
      navAuth.innerHTML = `
        <div class="user-pill">
          <span class="user-name">${escapeHtml(currentUser.username)}</span>
          <span class="role-badge ${roleClass}">${currentUser.role.toUpperCase()}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
      `;
    }

    if (adminTab) {
      if (currentUser.role === 'admin') adminTab.classList.remove('hidden');
      else adminTab.classList.add('hidden');
    }

    if (createPollBtn) {
      createPollBtn.style.display = (currentUser.role === 'admin') ? 'inline-flex' : 'none';
    }

    const editPartBtn = document.getElementById('btnEditPartCard');
    if (editPartBtn) {
      editPartBtn.style.display = (currentUser.role === 'admin') ? 'inline-flex' : 'none';
    }

    if (typeof updateLiveAuthUI === 'function') {
      updateLiveAuthUI();
    }

    if (guestBanner) {
      guestBanner.style.display = (currentUser.role === 'guest') ? 'flex' : 'none';
    }
  } else {
    if (navAuth) {
      navAuth.innerHTML = `
        <button class="btn btn-admin btn-sm" onclick="openAuthModal('admin')">👑 Admin Login</button>
        <button class="btn btn-red btn-sm" onclick="openAuthModal('login')">Login</button>
        <button class="btn btn-ghost btn-sm" onclick="openAuthModal('signup')">Sign Up</button>
      `;
    }
    if (adminTab) adminTab.classList.add('hidden');
    if (createPollBtn) createPollBtn.style.display = 'none';
    if (guestBanner) guestBanner.style.display = 'none';
  }
}

/* ==========================================================================
   PAGE ROUTING & VIEW SWITCHING
   ========================================================================== */
function switchView(viewName) {
  window.scrollTo(0, 0);

  document.querySelectorAll('.view-pane').forEach(p => {
    p.classList.remove('active');
    p.scrollTop = 0;
  });
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));

  const targetPane = document.getElementById('view-' + viewName);
  const targetTab = document.getElementById('tab-' + viewName);

  if (targetPane) {
    targetPane.classList.add('active');
    targetPane.scrollTop = 0;
  }
  if (targetTab) targetTab.classList.add('active');

  if (window.location.hash !== '#' + viewName) {
    history.replaceState(null, '', '#' + viewName);
  }

  // Audio silencer when navigating away from 3D car visualizer
  if (viewName !== 'car') {
    if (typeof isRacing !== 'undefined' && isRacing && typeof toggleRaceMode === 'function') {
      toggleRaceMode(false);
    }
    if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    }
  }

  // Silence game engine audio when leaving Jeddah game
  if (viewName !== 'game' && typeof pauseGameAudio === 'function') {
    pauseGameAudio();
  }

  // Page-specific initializers
  if (viewName === 'car') {
    setTimeout(() => {
      const container = document.getElementById('canvas-container');
      if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera && container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
      }
    }, 50);
  } else if (viewName === 'game') {
    if (typeof resumeGameAudio === 'function') resumeGameAudio();
    setTimeout(() => {
      if (typeof initGameScene === 'function') initGameScene();
    }, 60);
  } else if (viewName === 'live') {
    if (typeof initLiveView === 'function') initLiveView();
  } else if (viewName === 'polls') {
    if (typeof loadPolls === 'function') loadPolls();
  } else if (viewName === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('⚠️ Administrator access required.', 'error');
      switchView('car');
      return;
    }
    if (typeof loadAdminData === 'function') loadAdminData();
  }
}

/* ==========================================================================
   CAR SPECIFICATIONS LOADER
   ========================================================================== */
async function loadCarSpecsFromAPI() {
  try {
    const res = await fetch('/api/car-specs');
    if (res.ok) {
      const data = await res.json();
      if (data.vehicle) {
        vehicleHeaderData = data.vehicle;
        const titleEl = document.getElementById('carBadgeTitle');
        const subEl = document.getElementById('carBadgeSubtitle');
        if (titleEl && data.vehicle.title) {
          titleEl.innerHTML = escapeHtml(data.vehicle.title).replace('CHALLENGER', '<span style="font-size:0.9rem; color:var(--gold);">CHALLENGER</span>');
        }
        if (subEl && data.vehicle.subtitle) {
          subEl.textContent = data.vehicle.subtitle;
        }
      }
      if (data.parts && typeof PARTS_DATA !== 'undefined') {
        for (const [key, partObj] of Object.entries(data.parts)) {
          if (PARTS_DATA[key]) {
            PARTS_DATA[key].title = partObj.title;
            PARTS_DATA[key].category = partObj.category;
            PARTS_DATA[key].desc = partObj.desc;
            if (partObj.specs) {
              PARTS_DATA[key].specs = Object.assign({}, PARTS_DATA[key].specs, partObj.specs);
            }
          }
        }
        if (typeof activePartId !== 'undefined' && activePartId && typeof inspectPart === 'function') {
          const card = document.getElementById('partCard');
          if (card && card.classList.contains('show')) inspectPart(activePartId);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load car specs from API, falling back to local defaults:', err);
  }
}

/* ==========================================================================
   LIFECYCLE & RESIZE LISTENERS
   ========================================================================== */
window.addEventListener('resize', () => {
  const container = document.getElementById('canvas-container');
  if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera && container) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
});

function bootApp() {
  const savedUser = localStorage.getItem('bharatf1_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      currentUser = null;
    }
  }

  updateAuthUI();

  if (typeof initThreeScene === 'function') initThreeScene();
  if (typeof animate === 'function') animate();

  loadCarSpecsFromAPI();

  const initialHash = (window.location.hash || '').replace('#', '');
  const startView = ['polls', 'car', 'admin', 'live', 'game'].includes(initialHash) ? initialHash : 'car';
  switchView(startView);

  if (startView === 'car') {
    setTimeout(() => {
      if (typeof inspectPart === 'function') inspectPart('front-wing');
    }, 800);
  }

  window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '').replace('#', '');
    if (['polls', 'car', 'admin', 'live', 'game'].includes(hash)) {
      switchView(hash);
    }
  });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootApp();
} else {
  document.addEventListener('DOMContentLoaded', bootApp);
}

