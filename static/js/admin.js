/* ==========================================================================
   BMU F1 - ADMINISTRATOR DASHBOARD & CAR SPECS MANAGEMENT MODULE
   PAGE: Admin Panel View (#view-admin)
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
    const users = usersRes.data || [];
    const statUsers = document.getElementById('statTotalUsers');
    const statAdmins = document.getElementById('statTotalAdmins');
    if (statUsers) statUsers.textContent = users.length;
    const adminsCount = users.filter(u => u.role === 'admin').length;
    if (statAdmins) statAdmins.textContent = adminsCount;
  }

  if (pollsRes.ok) {
    const statPolls = document.getElementById('statTotalPolls');
    const pollList = Array.isArray(pollsRes.data) ? pollsRes.data : (pollsRes.data.polls || []);
    if (statPolls) statPolls.textContent = pollList.length;
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

  const users = res.data || [];
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
        <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
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
  if (typeof startLiveStream === 'function') {
    await startLiveStream();
  }
}

/* ==========================================================================
   CAR SPECIFICATIONS EDITING (MODALS & ACTIONS)
   ========================================================================== */
function openEditActivePartModal() {
  if (typeof activePartId !== 'undefined' && activePartId) {
    openEditPartModal(activePartId);
  }
}

function openEditPartModal(partId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('⚠️ Administrator access required to edit car specifications.', 'error');
    return;
  }
  if (typeof PARTS_DATA === 'undefined') return;
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
  const modal = document.getElementById('editPartModal');
  if (modal) modal.classList.remove('show');
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
    if (typeof PARTS_DATA !== 'undefined' && PARTS_DATA[partId]) {
      PARTS_DATA[partId].title = title;
      PARTS_DATA[partId].category = category;
      PARTS_DATA[partId].desc = desc;
      PARTS_DATA[partId].specs = { downforce, weight, temp, power, material };
    }

    if (typeof activePartId !== 'undefined' && activePartId === partId && typeof inspectPart === 'function') {
      const card = document.getElementById('partCard');
      if (card && card.classList.contains('show')) inspectPart(partId);
    }

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
  const modal = document.getElementById('editVehicleModal');
  if (modal) modal.classList.remove('show');
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
  if (!tbody || typeof PARTS_DATA === 'undefined') return;

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

