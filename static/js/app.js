/* ==========================================================================
   VIEW SWITCHING
   ========================================================================== */
function switchView(viewName) {
  // Always scroll window to top to eliminate blank vertical gaps
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

  // When leaving 3D car model, immediately silence 3D car audio to prevent background buzzing!
  if (viewName !== 'car') {
    if (typeof isRacing !== 'undefined' && isRacing && typeof toggleRaceMode === 'function') {
      toggleRaceMode(false);
    }
    if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    }
  }

  // When leaving game tab, immediately silence game engine
  if (viewName !== 'game' && typeof pauseGameAudio === 'function') {
    pauseGameAudio();
  }

  if (viewName === 'car') {
    // Resize 3D canvas accurately
    setTimeout(() => {
      const container = document.getElementById('canvas-container');
      if (renderer && container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
      }
    }, 50);
  } else if (viewName === 'game') {
    if (typeof resumeGameAudio === 'function') resumeGameAudio();
    setTimeout(() => {
      initGameScene();
    }, 60);
  } else if (viewName === 'live') {
    initLiveView();
  } else if (viewName === 'polls') {
    loadPolls();
  } else if (viewName === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('⚠️ Administrator access required.', 'error');
      switchView('car');
      return;
    }
    loadAdminData();
  }
}

/* ==========================================================================
   TOAST NOTIFICATIONS & API CALLS
   ========================================================================== */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => {
    t.className = 'toast';
  }, 3200);
}

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
   AUTHENTICATION LOGIC & MODAL
   ========================================================================== */
function openAuthModal(defaultTab = 'login') {
  document.getElementById('authModal').classList.add('show');
  switchModalTab(defaultTab);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('show');
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

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  toggleCreatePollBox(false);
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
    // Show user info pill
    let roleClass = 'role-member';
    if (currentUser.role === 'admin') roleClass = 'role-admin';
    if (currentUser.role === 'guest') roleClass = 'role-guest';

    navAuth.innerHTML = `
      <div class="user-pill">
        <span class="user-name">${escapeHtml(currentUser.username)}</span>
        <span class="role-badge ${roleClass}">${currentUser.role.toUpperCase()}</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
    `;

    // Admin privileges
    if (currentUser.role === 'admin') {
      adminTab.classList.remove('hidden');
      if (createPollBtn) createPollBtn.style.display = 'inline-flex';
    } else {
      adminTab.classList.add('hidden');
      if (createPollBtn) createPollBtn.style.display = 'none';
    }
    const editPartBtn = document.getElementById('btnEditPartCard');
    if (editPartBtn) {
      editPartBtn.style.display = (currentUser && currentUser.role === 'admin') ? 'inline-flex' : 'none';
    }

    // Live Stream controls & chat input visibility
    updateLiveAuthUI();

    // Guest Banner
    if (guestBanner) {
      guestBanner.style.display = (currentUser.role === 'guest') ? 'flex' : 'none';
    }
  } else {
    // Logged out
    navAuth.innerHTML = `
      <button class="btn btn-admin btn-sm" onclick="openAuthModal('admin')">👑 Admin Login</button>
      <button class="btn btn-red btn-sm" onclick="openAuthModal('login')">Login</button>
      <button class="btn btn-ghost btn-sm" onclick="openAuthModal('signup')">Sign Up</button>
    `;
    adminTab.classList.add('hidden');
    if (createPollBtn) createPollBtn.style.display = 'none';
    if (guestBanner) guestBanner.style.display = 'none';
  }
}

/* ==========================================================================
   POLLS VIEW LOGIC
   ========================================================================== */
async function loadPolls() {
  const container = document.getElementById('pollsListContainer');
  if (!container) return;

  // If no session exists yet, automatically initialize guest session so polls are visible
  if (!currentUser) {
    try {
      const gRes = await apiCall('POST', '/api/auth/guest', {}, false);
      if (gRes.ok) {
        currentUser = gRes.data;
        localStorage.setItem('bharatf1_user', JSON.stringify(currentUser));
        updateAuthUI();
      }
    } catch(e) {}
  }

  const res = await apiCall('GET', '/api/polls');
  if (!res.ok) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem; color:var(--text-muted);">
        Please <a href="#" onclick="openAuthModal('login')" style="color:var(--gold);">log in</a> or 
        <a href="#" onclick="continueAsGuest()" style="color:var(--saffron);">continue as guest</a> to view community polls.
      </div>
    `;
    return;
  }

  const polls = res.data;
  if (!polls || polls.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem; color:var(--text-muted);">
        No active polls found. Admins can create the first community poll!
      </div>
    `;
    return;
  }

  let html = '';
  polls.forEach(poll => {
    const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
    const maxVotes = Math.max(...poll.options.map(o => o.votes || 0));
    const userHasVoted = !!poll.user_vote;
    const isGuest = currentUser && currentUser.role === 'guest';
    const isAdmin = currentUser && currentUser.role === 'admin';

    html += `
      <div class="poll-card" id="pollCard-${poll.id}">
        <div class="poll-top">
          <div>
            <div class="poll-question">${escapeHtml(poll.question)}</div>
            <div class="poll-meta">
              <span>Total Votes: <strong>${totalVotes}</strong></span>
              <span>&bull;</span>
              <span>Created: ${new Date(poll.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          ${isAdmin ? `<button class="poll-delete-btn" onclick="deletePoll(${poll.id})">🗑️ Delete</button>` : ''}
        </div>

        <div class="poll-options-container">
    `;

    poll.options.forEach(opt => {
      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
      const isTop = opt.votes > 0 && opt.votes === maxVotes;
      const isUserChoice = poll.user_vote === opt.id;

      if (!userHasVoted && !isGuest && currentUser) {
        // Active Voting Button
        html += `
          <button class="vote-option-btn" onclick="votePoll(${poll.id}, ${opt.id})">
            <span class="vote-opt-content">
              <span>⚪</span>
              <span>${escapeHtml(opt.text)}</span>
            </span>
            <span class="vote-opt-stats">
              <span>Click to vote</span>
            </span>
          </button>
        `;
      } else {
        // Result Bar Display
        html += `
          <div class="vote-option-btn" disabled>
            <div class="vote-progress-fill ${isTop ? 'top-pick' : ''}" style="width: ${pct}%"></div>
            <div class="vote-opt-content">
              <span>${isUserChoice ? '✅' : '⚪'}</span>
              <span>${escapeHtml(opt.text)}</span>
              ${isUserChoice ? '<span class="voted-badge">Your Vote</span>' : ''}
            </div>
            <div class="vote-opt-stats">
              <strong>${pct}%</strong>
              <span>(${opt.votes} votes)</span>
            </div>
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function votePoll(pollId, optionId) {
  if (!currentUser || currentUser.role === 'guest') {
    showToast('Please log in as a member to vote', 'error');
    openAuthModal('login');
    return;
  }

  const res = await apiCall('POST', `/api/polls/${pollId}/vote`, { option_id: optionId });
  if (res.ok) {
    showToast('🎉 Vote recorded!', 'success');
    loadPolls();
  } else {
    showToast(res.data.error || 'Voting failed', 'error');
  }
}

function toggleCreatePollBox(forceState) {
  if (forceState !== false && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Administrator privileges required to create polls', 'error');
    return;
  }
  const box = document.getElementById('createPollBox');
  if (forceState !== undefined) {
    box.classList.toggle('open', forceState);
  } else {
    box.classList.toggle('open');
  }
}

function addOptionRow() {
  const container = document.getElementById('pollOptionsContainer');
  const count = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'poll-opt-row';
  row.innerHTML = `
    <input type="text" class="form-control" placeholder="Option ${count}" required>
    <button type="button" class="btn-remove-opt" onclick="removeOptionRow(this)">&times;</button>
  `;
  container.appendChild(row);
}

function removeOptionRow(btn) {
  const container = document.getElementById('pollOptionsContainer');
  if (container.children.length <= 2) {
    showToast('A poll must have at least 2 options', 'error');
    return;
  }
  btn.parentElement.remove();
}

async function submitNewPoll() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Administrator privileges required to create polls', 'error');
    return;
  }
  const q = document.getElementById('newPollQuestion').value.trim();
  const errEl = document.getElementById('createPollError');
  errEl.style.display = 'none';

  if (!q) {
    errEl.textContent = 'Please enter a poll question';
    errEl.style.display = 'block';
    return;
  }

  const inputs = document.querySelectorAll('#pollOptionsContainer input');
  const options = [];
  inputs.forEach(inp => {
    if (inp.value.trim()) options.push(inp.value.trim());
  });

  if (options.length < 2) {
    errEl.textContent = 'Please provide at least 2 non-empty options';
    errEl.style.display = 'block';
    return;
  }

  const res = await apiCall('POST', '/api/polls', { question: q, options: options });
  if (res.ok) {
    showToast('🚀 New Poll Published!', 'success');
    document.getElementById('newPollQuestion').value = '';
    inputs.forEach(inp => inp.value = '');
    toggleCreatePollBox(false);
    loadPolls();
  } else {
    errEl.textContent = res.data.error || 'Failed to create poll';
    errEl.style.display = 'block';
  }
}

async function deletePoll(pollId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Administrator privileges required to delete polls', 'error');
    return;
  }
  if (!confirm('Are you sure you want to permanently delete this poll?')) return;
  const res = await apiCall('DELETE', `/api/polls/${pollId}`);
  if (res.ok) {
    showToast('Poll deleted', '');
    loadPolls();
  } else {
    showToast(res.data.error || 'Delete failed', 'error');
  }
}

/* ==========================================================================
   ADMIN DASHBOARD LOGIC
   ========================================================================== */
async function loadAdminData() {
  await Promise.all([loadAdminUsers(), loadAdminStats(), loadAdminCarSpecs()]);
}

async function loadAdminStats() {
  const [usersRes, pollsRes] = await Promise.all([
    apiCall('GET', '/api/admin/users'),
    apiCall('GET', '/api/polls')
  ]);

  if (usersRes.ok) {
    const users = usersRes.data;
    document.getElementById('statTotalUsers').textContent = users.length;
    const adminsCount = users.filter(u => u.role === 'admin').length;
    document.getElementById('statTotalAdmins').textContent = adminsCount;
  }

  if (pollsRes.ok) {
    document.getElementById('statTotalPolls').textContent = pollsRes.data.length;
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTbody');
  if (!tbody) return;

  const res = await apiCall('GET', '/api/admin/users');
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#ff5252;">${res.data.error || 'Access denied'}</td></tr>`;
    return;
  }

  const users = res.data;
  let html = '';
  const isCurrentMainAdmin = currentUser && (currentUser.username.toLowerCase() === 'dhruv' || currentUser.username.toLowerCase() === 'ahlawatdhruv');

  users.forEach(u => {
    const isTargetMainAdmin = u.username.toLowerCase() === 'dhruv' || u.username.toLowerCase() === 'ahlawatdhruv';
    const roleBadge = u.role === 'admin' 
      ? '<span class="role-badge role-admin">ADMIN</span>' 
      : '<span class="role-badge role-member">MEMBER</span>';

    let actionBtn = '';
    if (isTargetMainAdmin) {
      actionBtn = '<span style="color:var(--gold); font-weight:800; font-size:0.82rem;">👑 Main Admin (Protected)</span>';
    } else if (u.role === 'admin') {
      if (isCurrentMainAdmin) {
        actionBtn = `<button class="btn btn-red btn-sm" onclick="demoteUser(${u.id}, '${escapeHtml(u.username)}')">🔻 Un-Admin (Demote)</button>`;
      } else {
        actionBtn = `<span style="color:var(--text-muted); font-size:0.8rem;">🔒 Main Admin Only</span>`;
      }
    } else {
      if (isCurrentMainAdmin) {
        actionBtn = `<button class="btn btn-admin btn-sm" onclick="promoteUser(${u.id}, '${escapeHtml(u.username)}')">👑 Promote to Admin</button>`;
      } else {
        actionBtn = `<span style="color:var(--text-muted); font-size:0.8rem;">🔒 Main Admin Only</span>`;
      }
    }

    html += `
      <tr>
        <td>#${u.id}</td>
        <td><strong>${escapeHtml(u.username)}</strong> ${isTargetMainAdmin ? '<span style="color:var(--gold); font-size:0.75rem;">(Main Admin)</span>' : ''}</td>
        <td>${roleBadge}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function promoteUser(userId, username) {
  if (!confirm(`Promote ${username} to Administrator?`)) return;
  const res = await apiCall('POST', `/api/admin/users/${userId}/promote`);
  if (res.ok) {
    showToast(`👑 ${username} promoted to Administrator`, 'success');
    loadAdminData();
  } else {
    showToast(res.data.error || 'Promotion failed', 'error');
  }
}

async function demoteUser(userId, username) {
  if (!confirm(`Are you sure you want to un-admin ${username} and demote them back to Member?`)) return;
  const res = await apiCall('POST', `/api/admin/users/${userId}/demote`);
  if (res.ok) {
    showToast(`🔻 ${username} has been un-admined (demoted to Member)`, 'success');
    loadAdminData();
  } else {
    showToast(res.data.error || 'Un-admin action failed', 'error');
  }
}

async function quickStartStreamFromPanel() {
  switchView('live');
  await startLiveStream();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

/* ==========================================================================
   WINDOW RESIZE & STARTUP
   ========================================================================== */
window.addEventListener('resize', () => {
  const container = document.getElementById('canvas-container');
  if (renderer && camera && container) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
});

/* ==========================================================================
   CAR SPECIFICATIONS & VEHICLE INFO (API & ADMIN EDITING)
   ========================================================================== */

let vehicleHeaderData = {
  title: 'BMU-24 CHALLENGER',
  subtitle: 'BML Munjal University • FIA Spec 2024 Formula 1 Aerodynamic Model'
};

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
      if (data.parts) {
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
        // Refresh active inspection card if visible
        if (activePartId && document.getElementById('partCard').classList.contains('show')) {
          inspectPart(activePartId);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load car specs from API, falling back to local defaults:', err);
  }
}

function openEditActivePartModal() {
  openEditPartModal(activePartId);
}

function openEditPartModal(partId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ Administrator access required to edit car specifications.', 'error');
    return;
  }
  const part = PARTS_DATA[partId];
  if (!part) return;

  document.getElementById('editPartId').value = partId;
  document.getElementById('editPartTitle').value = part.title || '';
  document.getElementById('editPartCategory').value = part.category || '';
  document.getElementById('editPartDesc').value = part.desc || '';
  document.getElementById('editPartDownforce').value = (part.specs && part.specs.downforce) || '';
  document.getElementById('editPartWeight').value = (part.specs && part.specs.weight) || '';
  document.getElementById('editPartTemp').value = (part.specs && part.specs.temp) || '';
  document.getElementById('editPartPower').value = (part.specs && part.specs.power) || '';
  document.getElementById('editPartMaterial').value = (part.specs && part.specs.material) || '';
  document.getElementById('editPartModalSubtitle').textContent = `Editing: ${part.title} (${partId})`;

  document.getElementById('editPartModal').classList.add('show');
}

function closeEditPartModal() {
  document.getElementById('editPartModal').classList.remove('show');
}

async function savePartSpecs() {
  if (!currentUser || currentUser.role !== 'admin') return;

  const partId = document.getElementById('editPartId').value;
  const title = document.getElementById('editPartTitle').value.trim();
  const category = document.getElementById('editPartCategory').value.trim();
  const desc = document.getElementById('editPartDesc').value.trim();
  const downforce = document.getElementById('editPartDownforce').value.trim();
  const weight = document.getElementById('editPartWeight').value.trim();
  const temp = document.getElementById('editPartTemp').value.trim();
  const power = document.getElementById('editPartPower').value.trim();
  const material = document.getElementById('editPartMaterial').value.trim();

  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  const btn = document.getElementById('btnSavePartSpecs');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    title,
    category,
    desc,
    specs: { downforce, weight, temp, power, material }
  };

  const res = await apiCall('PUT', `/api/admin/car-specs/${partId}`, payload);
  btn.disabled = false;
  btn.textContent = '💾 Save Specifications';

  if (res.ok) {
    // Update local dictionary
    if (PARTS_DATA[partId]) {
      PARTS_DATA[partId].title = title;
      PARTS_DATA[partId].category = category;
      PARTS_DATA[partId].desc = desc;
      PARTS_DATA[partId].specs = { downforce, weight, temp, power, material };
    }

    // Refresh inspection card
    if (activePartId === partId && document.getElementById('partCard').classList.contains('show')) {
      inspectPart(partId);
    }

    // Refresh admin table if open
    loadAdminCarSpecs();

    closeEditPartModal();
    showToast(`✅ Saved specifications for "${title}"!`, 'success');
  } else {
    showToast(res.data.error || 'Failed to update specifications', 'error');
  }
}

function openEditVehicleModal() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ Administrator access required.', 'error');
    return;
  }
  document.getElementById('editVehicleTitle').value = vehicleHeaderData.title || 'BMU-24 CHALLENGER';
  document.getElementById('editVehicleSubtitle').value = vehicleHeaderData.subtitle || '';
  document.getElementById('editVehicleModal').classList.add('show');
}

function closeEditVehicleModal() {
  document.getElementById('editVehicleModal').classList.remove('show');
}

async function saveVehicleInfo() {
  if (!currentUser || currentUser.role !== 'admin') return;

  const title = document.getElementById('editVehicleTitle').value.trim();
  const subtitle = document.getElementById('editVehicleSubtitle').value.trim();

  if (!title) {
    showToast('Vehicle title is required', 'error');
    return;
  }

  const btn = document.getElementById('btnSaveVehicleInfo');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const res = await apiCall('PUT', '/api/admin/car-specs/vehicle-info', { title, subtitle });
  btn.disabled = false;
  btn.textContent = '💾 Save Vehicle Header';

  if (res.ok) {
    vehicleHeaderData.title = title;
    vehicleHeaderData.subtitle = subtitle;

    const titleEl = document.getElementById('carBadgeTitle');
    const subEl = document.getElementById('carBadgeSubtitle');
    if (titleEl) {
      titleEl.innerHTML = escapeHtml(title).replace('CHALLENGER', '<span style="font-size:0.9rem; color:var(--gold);">CHALLENGER</span>');
    }
    if (subEl) {
      subEl.textContent = subtitle;
    }

    closeEditVehicleModal();
    showToast('✅ Vehicle header updated!', 'success');
  } else {
    showToast(res.data.error || 'Failed to update vehicle header', 'error');
  }
}

async function loadAdminCarSpecs() {
  const tbody = document.getElementById('adminCarSpecsTbody');
  if (!tbody) return;

  const partKeys = ['front-wing', 'tyre-front', 'cockpit', 'sidepods', 'engine', 'tyre-rear', 'rear-wing', 'diffuser'];
  let html = '';

  partKeys.forEach(key => {
    const p = PARTS_DATA[key];
    if (!p) return;
    const specsSummary = `Downforce: ${p.specs?.downforce || 'N/A'} • Weight: ${p.specs?.weight || 'N/A'} • Material: ${p.specs?.material || 'N/A'}`;
    html += `
      <tr>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(p.title)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">ID: ${escapeHtml(key)}</div>
        </td>
        <td>
          <span style="font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; background:rgba(255,153,51,0.15); color:var(--saffron); border:1px solid rgba(255,153,51,0.3);">
            ${escapeHtml(p.category)}
          </span>
        </td>
        <td style="font-size:0.85rem; color:var(--text-secondary); max-width:320px;">
          ${escapeHtml(specsSummary)}
        </td>
        <td>
          <button class="btn btn-gold btn-sm" onclick="openEditPartModal('${escapeHtml(key)}')">
            ✏️ Edit Specs
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  // Restore persisted session if available
  const savedUser = localStorage.getItem('bharatf1_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      currentUser = null;
    }
  }

  updateAuthUI();
  initThreeScene();
  animate();

  // Fetch dynamic car specs from server DB
  loadCarSpecsFromAPI();

  // Hash-based navigation (e.g. #polls)
  const initialHash = (window.location.hash || '').replace('#', '');
  if (['polls', 'car', 'admin', 'live', 'game'].includes(initialHash)) {
    switchView(initialHash);
  } else {
    // Show front wing info initially after 1 second if on car view
    setTimeout(() => {
      inspectPart('front-wing');
    }, 1000);
  }

  window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '').replace('#', '');
    if (['polls', 'car', 'admin', 'live', 'game'].includes(hash)) {
      switchView(hash);
    }
  });
});


/* ==========================================================================
   LIVE STREAM & PIT WALL REAL-TIME COMMENTARY MODULE
   ========================================================================== */

let liveStreamPollTimer = null;
let activeMediaStream = null;
let isBroadcastingOrStarting = false;
let currentStreamData = null;

function updateLiveAuthUI() {
  const studio = document.getElementById('adminLiveStudio');
  const chatForm = document.getElementById('liveChatForm');
  const guestPrompt = document.getElementById('liveChatGuestPrompt');
  const standbyGoLive = document.getElementById('btnStandbyGoLive');

  const isAdmin = currentUser && currentUser.role === 'admin';
  const isMemberOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member');
  const isLive = currentStreamData && Boolean(currentStreamData.is_live);

  if (studio) studio.style.display = isAdmin ? 'block' : 'none';
  if (standbyGoLive) standbyGoLive.style.display = (isAdmin && !isLive) ? 'inline-flex' : 'none';

  if (chatForm) chatForm.style.display = isMemberOrAdmin ? 'flex' : 'none';
  if (guestPrompt) guestPrompt.style.display = isMemberOrAdmin ? 'none' : 'flex';

  const stopButtons = [
    document.getElementById('btnAdminEndStream'),
    document.getElementById('btnAdminEndStreamRow'),
    document.getElementById('btnOverlayEndStream'),
    document.getElementById('btnHudEndStream'),
    document.getElementById('btnMetaEndStream'),
    document.getElementById('btnAdminPanelEndStream')
  ];

  const startButtons = [
    document.getElementById('btnAdminStartStream'),
    document.getElementById('btnStandbyGoLive'),
    document.getElementById('btnAdminPanelStartStream')
  ];

  stopButtons.forEach(btn => {
    if (btn) btn.style.display = (isAdmin && isLive) ? 'inline-flex' : 'none';
  });

  startButtons.forEach(btn => {
    if (btn) btn.style.display = (isAdmin && !isLive) ? 'inline-flex' : 'none';
  });
}

function handleStreamSourceChange() {
  const sel = document.getElementById('liveStreamSourceSelect');
  const urlField = document.getElementById('liveStreamUrlField');
  if (sel && urlField) {
    urlField.style.display = (sel.value === 'url') ? 'block' : 'none';
  }
}

async function initLiveView() {
  updateLiveAuthUI();
  await checkLiveStatus();
  await loadLiveComments();

  if (liveStreamPollTimer) clearInterval(liveStreamPollTimer);
  liveStreamPollTimer = setInterval(async () => {
    const pane = document.getElementById('view-live');
    if (pane && pane.classList.contains('active')) {
      await checkLiveStatus();
      await loadLiveComments(true);
    }
  }, 1200);
}

async function checkLiveStatus(isManual = false) {
  const res = await apiCall('GET', '/api/live/status', null, false);
  if (!res.ok) return;

  const data = res.data;
  currentStreamData = data;

  // Update navbar badge
  const navBadge = document.getElementById('liveNavBadge');
  if (navBadge) {
    navBadge.style.display = data.is_live ? 'inline-block' : 'none';
  }

  // Update stream title & info
  const titleDisplay = document.getElementById('streamTitleDisplay');
  const hostName = document.getElementById('streamHostName');
  const startedTime = document.getElementById('streamStartedTime');
  const statusPill = document.getElementById('streamStatusPill');
  const statusText = document.getElementById('streamStatusText');
  const viewerCount = document.getElementById('streamViewerCount');
  const btnStart = document.getElementById('btnAdminStartStream');
  const btnEnd = document.getElementById('btnAdminEndStream');

  if (titleDisplay) titleDisplay.textContent = data.title || 'BMU F1 Official Trackside & Pit Wall Live';
  if (hostName) hostName.textContent = data.host_name || 'Dhruv (Root Admin)';
  if (viewerCount) {
    const count = data.is_live ? Math.max(1, 12 + Math.floor(Math.sin(Date.now() / 10000) * 4)) : 0;
    viewerCount.textContent = count;
  }

  if (data.is_live) {
    if (statusPill) { statusPill.className = 'stream-status-pill live'; }
    if (statusText) statusText.textContent = 'LIVE';
    if (startedTime) {
      const dt = data.started_at ? new Date(data.started_at) : new Date();
      startedTime.textContent = 'Live since ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    applyActivePlayerDisplay(data);
  } else {
    if (statusPill) { statusPill.className = 'stream-status-pill offline'; }
    if (statusText) statusText.textContent = 'OFFLINE';
    if (startedTime) startedTime.textContent = 'Offline';
    resetToOfflineStandby();
  }

  // Synchronize ALL Live Start & Stop buttons across the entire UI
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isLive = Boolean(data.is_live);

  const stopButtons = [
    document.getElementById('btnAdminEndStream'),
    document.getElementById('btnAdminEndStreamRow'),
    document.getElementById('btnOverlayEndStream'),
    document.getElementById('btnHudEndStream'),
    document.getElementById('btnMetaEndStream'),
    document.getElementById('btnAdminPanelEndStream')
  ];

  const startButtons = [
    document.getElementById('btnAdminStartStream'),
    document.getElementById('btnStandbyGoLive'),
    document.getElementById('btnAdminPanelStartStream')
  ];

  stopButtons.forEach(btn => {
    if (btn) btn.style.display = (isAdmin && isLive) ? 'inline-flex' : 'none';
  });

  startButtons.forEach(btn => {
    if (btn) btn.style.display = (isAdmin && !isLive) ? 'inline-flex' : 'none';
  });

  
  // Sync Admin Panel stream card if present
  const panelStatus = document.getElementById('adminPanelStreamStatus');
  const panelStatusText = document.getElementById('adminPanelStreamStatusText');
  const panelTitle = document.getElementById('adminPanelStreamTitle');
  const panelHost = document.getElementById('adminPanelStreamHost');
  const panelViewers = document.getElementById('adminPanelStreamViewers');
  const panelBtnStart = document.getElementById('btnAdminPanelStartStream');
  const panelBtnEnd = document.getElementById('btnAdminPanelEndStream');

  if (panelTitle) panelTitle.textContent = data.title || 'BMU F1 Trackside Live';
  if (panelHost) panelHost.textContent = data.host_name || 'Dhruv';
  if (panelViewers) panelViewers.textContent = data.is_live ? Math.max(1, 14) : 0;

  if (data.is_live) {
    if (panelStatus) panelStatus.className = 'stream-status-pill live';
    if (panelStatusText) panelStatusText.textContent = 'LIVE';
    if (panelBtnStart) panelBtnStart.style.display = 'none';
    if (panelBtnEnd) panelBtnEnd.style.display = 'inline-flex';
  } else {
    if (panelStatus) panelStatus.className = 'stream-status-pill offline';
    if (panelStatusText) panelStatusText.textContent = 'OFFLINE';
    if (panelBtnStart) panelBtnStart.style.display = 'inline-flex';
    if (panelBtnEnd) panelBtnEnd.style.display = 'none';
  }

  if (isManual) {
    showToast(data.is_live ? '🔴 Stream is currently LIVE!' : 'Stream is currently offline', data.is_live ? 'success' : '');
  }
}

let viewerFeedTimer = null;

function startViewerFeed() {
  if (viewerFeedTimer) return;
  const imgFeed = document.getElementById('liveStreamFeedImg');
  if (!imgFeed) return;

  let isFetching = false;
  viewerFeedTimer = setInterval(() => {
    if (isFetching) return;
    isFetching = true;
    const nextImg = new Image();
    nextImg.onload = () => {
      imgFeed.src = nextImg.src;
      imgFeed.style.display = 'block';
      imgFeed.style.zIndex = '14';
      isFetching = false;
    };
    nextImg.onerror = () => {
      isFetching = false;
    };
    nextImg.src = '/api/live/stream/frame/latest?t=' + Date.now();
  }, 100);
}

function stopViewerFeed() {
  if (viewerFeedTimer) {
    clearInterval(viewerFeedTimer);
    viewerFeedTimer = null;
  }
  const imgFeed = document.getElementById('liveStreamFeedImg');
  if (imgFeed) {
    imgFeed.src = '';
    imgFeed.style.display = 'none';
  }
}

function applyActivePlayerDisplay(data) {
  const standby = document.getElementById('playerOfflineStandby');
  const video = document.getElementById('liveVideoPlayer');
  const imgFeed = document.getElementById('liveStreamFeedImg');
  const iframe = document.getElementById('liveIframePlayer');
  const switcher = document.getElementById('playerSourceSwitcher');

  if (standby) standby.style.display = 'none';

  if (switcher) {
    switcher.style.display = (currentUser && currentUser.role === 'admin') ? 'flex' : 'none';
  }

  // Sync active switcher button
  const currentMode = data.stream_type || 'camera';
  const btnCam = document.getElementById('btnSwitchCamera');
  const btnScr = document.getElementById('btnSwitchScreen');
  if (btnCam) btnCam.classList.toggle('active', currentMode === 'camera');
  if (btnScr) btnScr.classList.toggle('active', currentMode === 'screen');

  if (data.stream_type === 'url' && data.stream_url) {
    stopViewerFeed();
    if (video) video.style.display = 'none';
    if (imgFeed) imgFeed.style.display = 'none';

    let embedUrl = data.stream_url;
    if (embedUrl.includes('youtube.com/watch?v=')) {
      embedUrl = embedUrl.replace('watch?v=', 'embed/');
    } else if (embedUrl.includes('youtu.be/')) {
      embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
    }

    if (iframe) {
      if (iframe.src !== embedUrl) iframe.src = embedUrl;
      iframe.style.display = 'block';
    }
  } else {
    // Camera or Screen mode
    if (iframe) iframe.style.display = 'none';

    // If local client has active camera stream (Broadcaster view)
    if (activeMediaStream && activeMediaStream.active && video) {
      stopViewerFeed();
      if (imgFeed) imgFeed.style.display = 'none';
      video.style.display = 'block';
      video.style.zIndex = '15';
      if (video.srcObject !== activeMediaStream) {
        video.srcObject = activeMediaStream;
      }
      video.play().catch(() => {});
    } else {
      // Remote viewer:
      if (video) video.style.display = 'none';
      startViewerFeed();
    }
  }
}

async function switchActiveSource(newSource) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const sel = document.getElementById('liveStreamSourceSelect');
  if (sel) sel.value = newSource;

  if (newSource === 'camera' || newSource === 'screen') {
    await startLiveStream();
  }
}

function resetToOfflineStandby(forceShutdown = false) {
  // If local user is currently starting or broadcasting, do NOT kill camera feed!
  if (!forceShutdown) {
    if (isBroadcastingOrStarting) return;
    if (activeMediaStream && activeMediaStream.active) return;
  }

  stopViewerFeed();

  if (forceShutdown && activeMediaStream) {
    try {
      activeMediaStream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    } catch(e) {}
    activeMediaStream = null;
  }

  if (forceShutdown && frameCaptureTimer) {
    clearInterval(frameCaptureTimer);
    frameCaptureTimer = null;
  }

  const standby = document.getElementById('playerOfflineStandby');
  const video = document.getElementById('liveVideoPlayer');
  const iframe = document.getElementById('liveIframePlayer');
    const imgFeed = document.getElementById('liveStreamFeedImg');
  const switcher = document.getElementById('playerSourceSwitcher');

  if (video) {
    video.style.display = 'none';
    if (forceShutdown && video.srcObject) {
      try { video.srcObject.getTracks().forEach(t => t.stop()); } catch(e) {}
      video.srcObject = null;
    }
    video.pause();
  }
  if (iframe) {
    iframe.style.display = 'none';
    iframe.src = '';
  }
  if (imgFeed) {
    imgFeed.style.display = 'none';
    imgFeed.src = '';
  }
  if (canvas) {
    canvas.style.display = 'none';
  }
  if (switcher) {
    switcher.style.display = 'none';
  }
  if (standby) {
    standby.style.display = 'flex';
  }
}

let frameCaptureTimer = null;
let captureCanvas = null;

async function getCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera API not accessible. Ensure you are accessing via https:// or http://localhost in Chrome/Edge.');
  }

  // 1. Try ideal HD webcam
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e1) {
    console.warn('HD webcam constraint failed, trying basic video constraint:', e1);
  }

  // 2. Try minimal video: true
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (e2) {
    console.warn('Minimal constraint failed, trying video: {}', e2);
  }

  // 3. Last fallback
  return await navigator.mediaDevices.getUserMedia({ video: {} });
}

async function startLiveStream() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ Administrator privileges required to broadcast', 'error');
    openAuthModal('admin');
    return;
  }

  isBroadcastingOrStarting = true;

  const titleInput = document.getElementById('liveStreamTitleInput');
  const sourceSel = document.getElementById('liveStreamSourceSelect');
  const urlInput = document.getElementById('liveStreamUrlInput');

  const title = (titleInput ? titleInput.value.trim() : '') || 'BMU F1 Trackside Live & Telemetry Review';
  const source = sourceSel ? sourceSel.value : 'camera';
  const url = (urlInput && source === 'url') ? urlInput.value.trim() : '';

  const video = document.getElementById('liveVideoPlayer');
  const standby = document.getElementById('playerOfflineStandby');
  const imgFeed = document.getElementById('liveStreamFeedImg');
  
  // Activate device camera
  if (source === 'camera') {
    try {
      showToast('📹 Opening device camera...', '');
      activeMediaStream = await getCameraStream();

      if (video) {
        video.srcObject = activeMediaStream;
        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;
        video.playsInline = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.style.display = 'block';
        video.style.zIndex = '15';

        // Wait for metadata and play
        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() warning:', playErr);
          // Retry on user interaction if autoplay policy required it
          video.play().catch(() => {});
        }
      }

      // Hide all overlays and offline screens
      if (standby) standby.style.display = 'none';
      if (imgFeed) imgFeed.style.display = 'none';
      
      // Start continuous frame transmission to server for remote viewers
      if (!captureCanvas) {
        captureCanvas = document.createElement('canvas');
        captureCanvas.width = 640;
        captureCanvas.height = 360;
      }
      const captureCtx = captureCanvas.getContext('2d');

      if (frameCaptureTimer) clearInterval(frameCaptureTimer);
      frameCaptureTimer = setInterval(() => {
        if (!activeMediaStream || !video || video.readyState < 2) return;
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        captureCanvas.toBlob(async (blob) => {
          if (!blob || !activeMediaStream) return;
          try {
            await fetch('/api/live/stream/frame', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + (currentUser ? currentUser.token : ''),
                'Content-Type': 'image/jpeg'
              },
              body: blob
            });
          } catch (e) {}
        }, 'image/jpeg', 0.6);
      }, 85); // 12-14 FPS

    } catch (err) {
      isBroadcastingOrStarting = false;
      console.error('Camera access failed completely:', err);
      let errorMsg = 'Could not access device camera: ' + (err.message || err.name);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = '⚠️ Camera permission was blocked by your browser! Please click the camera/lock icon in your browser URL bar, set Camera to "Allow", and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = '⚠️ Camera is being used by another application (Zoom, Teams, etc.). Please close other apps and try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = '⚠️ No camera hardware found on this device.';
      }
      alert(errorMsg);
      showToast(errorMsg, 'error');
      return;
    }
  } else if (source === 'screen') {
    try {
      activeMediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (video) {
        video.srcObject = activeMediaStream;
        video.muted = true;
        video.style.display = 'block';
        video.style.zIndex = '15';
        await video.play();
      }
      if (standby) standby.style.display = 'none';
      if (imgFeed) imgFeed.style.display = 'none';
      
      if (!captureCanvas) {
        captureCanvas = document.createElement('canvas');
        captureCanvas.width = 640;
        captureCanvas.height = 360;
      }
      const captureCtx = captureCanvas.getContext('2d');

      if (frameCaptureTimer) clearInterval(frameCaptureTimer);
      frameCaptureTimer = setInterval(() => {
        if (!activeMediaStream || !video || video.readyState < 2) return;
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        captureCanvas.toBlob(async (blob) => {
          if (!blob || !activeMediaStream) return;
          try {
            await fetch('/api/live/stream/frame', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + (currentUser ? currentUser.token : ''),
                'Content-Type': 'image/jpeg'
              },
              body: blob
            });
          } catch (e) {}
        }, 'image/jpeg', 0.6);
      }, 85);

    } catch (err) {
      isBroadcastingOrStarting = false;
      console.warn('Screen share cancelled:', err);
      showToast('Screen share cancelled', '');
      return;
    }
  }

  // Notify backend that stream is live
  const res = await apiCall('POST', '/api/live/start', {
    title: title,
    stream_type: source,
    stream_url: url
  }, true);

  if (res.ok) {
    showToast('🔴 Camera is LIVE! You are broadcasting on the website.', 'success');
    currentStreamData = res.data;
    await checkLiveStatus();
  } else {
    isBroadcastingOrStarting = false;
    showToast(res.data.error || 'Failed to start live stream', 'error');
  }
}

async function endLiveStream() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ Administrator login (Dhruv) required to stop broadcast', 'error');
    openAuthModal('admin');
    return;
  }

  showToast('⏳ Ending live broadcast & stopping camera...', '');
  isBroadcastingOrStarting = false;

  // Force shutdown hardware and displays
  resetToOfflineStandby(true);

  // Notify backend API to set is_live = 0
  try {
    const res = await apiCall('POST', '/api/live/stop', {}, true);
    if (res.ok) {
      showToast('⏹️ Camera deactivated & Live Broadcast ended successfully', 'success');
      await checkLiveStatus();
    } else {
      if (res.status === 401 || res.status === 403) {
        showToast('⚠️ Session expired. Please log in as Dhruv to stop broadcast.', 'error');
        openAuthModal('admin');
      } else {
        showToast((res.data && res.data.error) || 'Failed to end stream on server', 'error');
      }
    }
  } catch (err) {
    console.error('endLiveStream API call error:', err);
    showToast('Network error while stopping stream', 'error');
  }
}

// Comments
async function loadLiveComments(silent = false) {
  const container = document.getElementById('chatMessagesContainer');
  const countBadge = document.getElementById('chatCountBadge');
  if (!container) return;

  const res = await apiCall('GET', '/api/live/comments', null, false);
  if (!res.ok) return;

  const comments = res.data || [];
  if (countBadge) countBadge.textContent = comments.length + ' message' + (comments.length === 1 ? '' : 's');

  if (comments.length === 0) {
    container.innerHTML = `
      <div class="chat-empty-state">
        🏎️ Welcome to the Pit Wall Live Chat! Be the first to join the conversation.
      </div>
    `;
    return;
  }

  const wasNearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

  let html = '';
  comments.forEach(c => {
    const isOwner = currentUser && (currentUser.username === c.username || currentUser.role === 'admin');
    const roleClass = (c.role === 'admin') ? 'admin' : 'member';
    const roleLabel = (c.role === 'admin') ? '👑 ADMIN' : '🏎️ MEMBER';
    const timeStr = c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    html += `
      <div class="chat-msg-row">
        <div class="chat-msg-header">
          <div class="chat-user-badge-wrap">
            <span class="chat-username">${escapeHtml(c.username)}</span>
            <span class="chat-badge ${roleClass}">${roleLabel}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="chat-time">${timeStr}</span>
            ${(currentUser && currentUser.role === 'admin') ? `<button class="chat-delete-btn" onclick="deleteLiveComment(${c.id})" title="Delete message">&times;</button>` : ''}
          </div>
        </div>
        <div class="chat-body">${escapeHtml(c.message)}</div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (wasNearBottom || !silent) {
    container.scrollTop = container.scrollHeight;
  }
}

async function submitLiveComment(e) {
  if (e) e.preventDefault();

  if (!currentUser || currentUser.role === 'guest') {
    openAuthModal('login');
    showToast('🔒 Please log in to comment', '');
    return;
  }

  const input = document.getElementById('liveCommentInput');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;

  const res = await apiCall('POST', '/api/live/comments', { message: msg }, true);
  if (res.ok) {
    if (input) input.value = '';
    await loadLiveComments();
  } else {
    showToast(res.data.error || 'Failed to post comment', 'error');
  }
}

function quickSendReaction(emoji) {
  if (!currentUser || currentUser.role === 'guest') {
    openAuthModal('login');
    showToast('🔒 Please log in to react', '');
    return;
  }
  const input = document.getElementById('liveCommentInput');
  if (input) {
    input.value = (input.value ? input.value + ' ' : '') + emoji;
    input.focus();
  }
}

async function deleteLiveComment(commentId) {
  if (!currentUser || currentUser.role !== 'admin') return;
  const res = await apiCall('DELETE', '/api/live/comments/' + commentId, null, true);
  if (res.ok) {
    showToast('Comment deleted', '');
    await loadLiveComments();
  }
}

async function clearLiveChatPrompt() {
  if (!currentUser || currentUser.role !== 'admin') return;
  if (!confirm('Are you sure you want to clear all chat messages in the live room?')) return;

  const res = await apiCall('DELETE', '/api/live/comments', null, true);
  if (res.ok) {
    showToast('Live chat room cleared', 'success');
    await loadLiveComments();
  }
}

// On initial boot, check live status for the header badge
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    checkLiveStatus();
  }, 800);
});
