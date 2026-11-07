/* ==========================================================================
   BMU F1 - LIVE STREAM & PIT WALL REAL-TIME COMMENTARY MODULE
   PAGE: Live Stream View (#view-live)
   ========================================================================== */

let liveStreamPollTimer = null;
let activeMediaStream = null;
let isBroadcastingOrStarting = false;
let currentStreamData = null;
let frameCaptureTimer = null;
let captureCanvas = null;
let viewerFeedTimer = null;

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
  const res = await apiCall('GET', '/api/live/stream/status', null, false);
  if (!res.ok) return;

  const data = res.data;
  currentStreamData = data;

  const navBadge = document.getElementById('liveNavBadge');
  if (navBadge) {
    navBadge.style.display = data.is_live ? 'inline-block' : 'none';
  }

  const titleDisplay = document.getElementById('streamTitleDisplay');
  const hostName = document.getElementById('streamHostName');
  const startedTime = document.getElementById('streamStartedTime');
  const statusPill = document.getElementById('streamStatusPill');
  const statusText = document.getElementById('streamStatusText');
  const viewerCount = document.getElementById('streamViewerCount');

  if (titleDisplay) titleDisplay.textContent = data.title || 'BMU F1 Official Trackside & Pit Wall Live';
  if (hostName) hostName.textContent = data.host_name || 'Dhruv (Root Admin)';
  if (viewerCount) {
    const count = data.is_live ? Math.max(1, 12 + Math.floor(Math.sin(Date.now() / 10000) * 4)) : 0;
    viewerCount.textContent = count;
  }

  if (data.is_live) {
    if (statusPill) statusPill.className = 'stream-status-pill live';
    if (statusText) statusText.textContent = 'LIVE';
    if (startedTime) {
      const dt = data.started_at ? new Date(data.started_at) : new Date();
      startedTime.textContent = 'Live since ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    applyActivePlayerDisplay(data);
  } else {
    if (statusPill) statusPill.className = 'stream-status-pill offline';
    if (statusText) statusText.textContent = 'OFFLINE';
    if (startedTime) startedTime.textContent = 'Offline';
    resetToOfflineStandby();
  }

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
    if (iframe) iframe.style.display = 'none';

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
  if (switcher) {
    switcher.style.display = 'none';
  }
  if (standby) {
    standby.style.display = 'flex';
  }
}

async function getCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera API not accessible. Ensure you are accessing via https:// or http://localhost in Chrome/Edge.');
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e1) {
    console.warn('HD webcam constraint failed, trying basic video constraint:', e1);
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (e2) {
    console.warn('Minimal constraint failed, trying video: {}', e2);
  }

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

        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() warning:', playErr);
          video.play().catch(() => {});
        }
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
      console.error('Camera access failed completely:', err);
      let errorMsg = 'Could not access device camera: ' + (err.message || err.name);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = '⚠️ Camera permission was blocked by your browser! Please click the camera/lock icon in your browser URL bar, set Camera to "Allow", and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = '⚠️ Camera is being used by another application. Please close other apps and try again.';
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
    showToast('⚠️ Administrator login required to stop broadcast', 'error');
    openAuthModal('admin');
    return;
  }

  showToast('⏳ Ending live broadcast & stopping camera...', '');
  isBroadcastingOrStarting = false;
  resetToOfflineStandby(true);

  try {
    const res = await apiCall('POST', '/api/live/stop', {}, true);
    if (res.ok) {
      showToast('⏹️ Camera deactivated & Live Broadcast ended successfully', 'success');
      await checkLiveStatus();
    } else {
      showToast((res.data && res.data.error) || 'Failed to end stream on server', 'error');
    }
  } catch (err) {
    console.error('endLiveStream API call error:', err);
    showToast('Network error while stopping stream', 'error');
  }
}

async function loadLiveComments(silent = false) {
  const container = document.getElementById('chatMessagesContainer');
  const countBadge = document.getElementById('chatCountBadge');
  if (!container) return;

  const res = await apiCall('GET', '/api/live/comments', null, false);
  if (!res.ok) return;

  const comments = Array.isArray(res.data) ? res.data : (res.data.comments || []);
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

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    checkLiveStatus();
  }, 800);
});

