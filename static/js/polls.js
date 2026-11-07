/* ==========================================================================
   BMU F1 - COMMUNITY POLLING & VOTING MODULE
   PAGE: Polls View (#view-polls)
   ========================================================================== */

async function loadPolls() {
  const container = document.getElementById('pollsListContainer');
  if (!container) return;

  // Auto guest login if no active user session
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

  // Support both array and { polls: [...] } response formats
  const polls = Array.isArray(res.data) ? res.data : (res.data.polls || []);
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
              <span>Created: ${poll.created_at ? new Date(poll.created_at).toLocaleDateString() : 'Active'}</span>
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
  if (!box) return;
  if (forceState !== undefined) {
    box.classList.toggle('open', forceState);
  } else {
    box.classList.toggle('open');
  }
}

function addOptionRow() {
  const container = document.getElementById('pollOptionsContainer');
  if (!container) return;
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
  if (!container) return;
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

