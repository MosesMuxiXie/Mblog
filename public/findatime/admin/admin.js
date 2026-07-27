const byId = id => document.getElementById(id);
const APPEARANCE_KEY = 'findatime-admin-appearance-v1';
const DEFAULT_APPEARANCE = { image: '', shade: 72, textOpacity: 100 };
const PERIOD_ICONS = ['●', '7', '30', '∞'];

let chartData = [];
let resizeTimer = null;
let savedAppearance = loadSavedAppearance();
let pendingBackground = savedAppearance.image;

function setLoginError(message) {
  byId('login-error').textContent = message || '';
}

function setSetupError(message) {
  byId('setup-error').textContent = message || '';
}

function loadSavedAppearance() {
  try {
    const value = JSON.parse(localStorage.getItem(APPEARANCE_KEY));
    return {
      image: typeof value?.image === 'string' ? value.image : '',
      shade: Number.isFinite(Number(value?.shade))
        ? Math.min(90, Math.max(35, Number(value.shade)))
        : DEFAULT_APPEARANCE.shade,
      textOpacity: Number.isFinite(Number(value?.textOpacity))
        ? Math.min(100, Math.max(55, Number(value.textOpacity)))
        : DEFAULT_APPEARANCE.textOpacity
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function applyAppearance(appearance) {
  const background = byId('ambient-background');
  const image = appearance?.image || '';
  if (image) {
    background.style.backgroundImage = `url(${JSON.stringify(image)})`;
    background.classList.add('has-custom-background');
  } else {
    background.style.removeProperty('background-image');
    background.classList.remove('has-custom-background');
  }
  const shade = Math.min(90, Math.max(35, Number(appearance?.shade) || DEFAULT_APPEARANCE.shade));
  const textOpacity = Math.min(100, Math.max(55,
    Number(appearance?.textOpacity) || DEFAULT_APPEARANCE.textOpacity));
  document.documentElement.style.setProperty('--shade-opacity', (shade / 100).toFixed(2));
  document.documentElement.style.setProperty('--text-opacity', (textOpacity / 100).toFixed(2));
  if (byId('shade-output')) byId('shade-output').value = `${shade}%`;
  if (byId('text-opacity-output')) byId('text-opacity-output').value = `${textOpacity}%`;
}

function validBackgroundUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || '请求失败，请稍后重试');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setCurrentUser(username) {
  const displayName = String(username || '管理员');
  byId('account-name').textContent = displayName;
  byId('account-avatar').textContent = (displayName[0] || 'A').toUpperCase();
}

function showLogin(message = '') {
  byId('dashboard-view').classList.add('hidden');
  byId('setup-view').classList.add('hidden');
  byId('login-view').classList.remove('hidden');
  setLoginError(message);
  window.requestAnimationFrame(() => byId('username').focus());
}

function showSetup(message = '') {
  byId('dashboard-view').classList.add('hidden');
  byId('login-view').classList.add('hidden');
  byId('setup-view').classList.remove('hidden');
  setSetupError(message);
  window.requestAnimationFrame(() => byId('setup-token').focus());
}

function showDashboard() {
  byId('login-view').classList.add('hidden');
  byId('setup-view').classList.add('hidden');
  byId('dashboard-view').classList.remove('hidden');
}

function numberText(value) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatMeetingDateTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric'
  }).format(new Date(`${value}T00:00:00Z`));
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

function renderDashboard(data) {
  byId('updated-at').textContent = `数据更新于 ${formatDateTime(data.generatedAt)}`;
  byId('summary-cards').innerHTML = data.periods.map((period, index) => `
    <article class="summary-card" data-index="${index}">
      <div class="summary-card-top">
        <span class="summary-label">${escapeText(period.label)}创建的约会</span>
        <span class="summary-icon">${PERIOD_ICONS[index] || '·'}</span>
      </div>
      <div class="summary-number-row">
        <strong class="summary-number">${numberText(period.meetingCount)}</strong>
        <span class="summary-unit">场会议</span>
      </div>
      <div class="summary-meta">
        <span>访问用户<strong>${numberText(period.visitorCount)}</strong></span>
        <span>参与人数<strong>${numberText(period.participantCount)}</strong></span>
      </div>
    </article>
  `).join('');

  byId('meeting-table-body').innerHTML = data.meetings?.length
    ? data.meetings.map(meeting => `
      <tr>
        <td class="uuid-cell">
          <a href="/findatime/uuid/${encodeURIComponent(meeting.id)}" target="_blank" rel="noopener">
            ${escapeText(meeting.id)}
          </a>
        </td>
        <td class="created-cell">${escapeText(formatMeetingDateTime(meeting.createdAt))}</td>
        <td><span class="participant-badge">${numberText(meeting.participantCount)} 人</span></td>
        <td class="title-cell">${escapeText(meeting.title)}</td>
      </tr>
    `).join('')
    : '<tr><td class="empty-table" colspan="4">暂无会议数据</td></tr>';

  chartData = data.chart || [];
  drawChart();
}

async function loadDashboard() {
  byId('updated-at').textContent = '正在同步最新数据…';
  try {
    const data = await api('/api/findatime/admin/dashboard');
    showDashboard();
    renderDashboard(data);
  } catch (error) {
    if (error.status === 401) showLogin('登录已过期，请重新登录');
    else byId('updated-at').textContent = error.message;
  }
}

function drawChart() {
  const canvas = byId('trend-chart');
  if (!canvas || byId('dashboard-view').classList.contains('hidden')) return;
  const visibleData = chartData;
  byId('chart-empty').classList.toggle('hidden', visibleData.length > 0);
  if (!visibleData.length) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const margin = { top: 22, right: 18, bottom: 42, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...visibleData.flatMap(point => [
    point.meetings,
    point.visitors,
    point.participants
  ]));
  const ceiling = Math.max(4, Math.ceil(maxValue / 4) * 4);

  context.clearRect(0, 0, width, height);
  context.font = '11px Inter, system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.strokeStyle = 'rgba(147, 163, 190, .13)';
  context.fillStyle = '#6e7a8f';
  context.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = margin.top + plotHeight * (index / 4);
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(width - margin.right, y);
    context.stroke();
    context.textAlign = 'right';
    context.fillText(String(Math.round(ceiling * (1 - index / 4))), margin.left - 9, y);
  }

  const labelCount = Math.min(5, visibleData.length);
  for (let index = 0; index < labelCount; index += 1) {
    const dataIndex = labelCount === 1
      ? 0
      : Math.round(index * (visibleData.length - 1) / (labelCount - 1));
    const x = visibleData.length === 1
      ? margin.left + plotWidth / 2
      : margin.left + plotWidth * (dataIndex / (visibleData.length - 1));
    context.textAlign = index === 0 ? 'left' : index === labelCount - 1 ? 'right' : 'center';
    context.fillText(formatDate(visibleData[dataIndex].date), x, height - 17);
  }

  const series = [
    { key: 'meetings', color: '#ff745f' },
    { key: 'visitors', color: '#52d3c4' },
    { key: 'participants', color: '#759dff' }
  ];
  series.forEach(({ key, color }) => {
    context.beginPath();
    visibleData.forEach((point, index) => {
      const x = visibleData.length === 1
        ? margin.left + plotWidth / 2
        : margin.left + plotWidth * (index / (visibleData.length - 1));
      const y = margin.top + plotHeight * (1 - point[key] / ceiling);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = 2.35;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.shadowColor = color;
    context.shadowBlur = 8;
    context.stroke();
    context.shadowBlur = 0;

    if (visibleData.length <= 60) {
      visibleData.forEach((point, index) => {
        const x = visibleData.length === 1
          ? margin.left + plotWidth / 2
          : margin.left + plotWidth * (index / (visibleData.length - 1));
        const y = margin.top + plotHeight * (1 - point[key] / ceiling);
        context.beginPath();
        context.arc(x, y, 2.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      });
    }
  });
}

function closeSidebar() {
  byId('sidebar').classList.remove('is-open');
  byId('sidebar-scrim').classList.remove('is-open');
}

function openAppearance() {
  const dialog = byId('appearance-dialog');
  pendingBackground = savedAppearance.image;
  byId('background-url').value = savedAppearance.image.startsWith('data:image/')
    ? ''
    : savedAppearance.image;
  byId('background-file').value = '';
  byId('shade-strength').value = String(savedAppearance.shade);
  byId('text-opacity').value = String(savedAppearance.textOpacity);
  byId('appearance-message').textContent = savedAppearance.image.startsWith('data:image/')
    ? '当前正在使用已上传的本地图片。'
    : '';
  byId('appearance-message').className = 'form-message';
  applyAppearance(savedAppearance);
  dialog.showModal();
}

function restoreAppearanceAndClose(dialog) {
  applyAppearance(savedAppearance);
  dialog.close();
}

byId('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  setLoginError('');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = '正在验证…';
  try {
    const result = await api('/api/findatime/admin/auth', {
      method: 'POST',
      body: JSON.stringify({
        username: byId('username').value.trim(),
        password: byId('password').value
      })
    });
    setCurrentUser(result.username);
    byId('password').value = '';
    await loadDashboard();
  } catch (error) {
    setLoginError(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '进入数据后台 <span>→</span>';
  }
});

byId('setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  setSetupError('');
  const password = byId('setup-password').value;
  if (password !== byId('setup-confirm-password').value) {
    setSetupError('两次输入的密码不一致');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = '正在创建…';
  try {
    const result = await api('/api/findatime/admin/setup', {
      method: 'POST',
      body: JSON.stringify({
        setupToken: byId('setup-token').value,
        username: byId('setup-username').value.trim(),
        password
      })
    });
    setCurrentUser(result.username);
    event.currentTarget.reset();
    await loadDashboard();
  } catch (error) {
    if (error.status === 409) showLogin(error.message);
    else setSetupError(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '创建并进入后台 <span>→</span>';
  }
});

byId('logout-button').addEventListener('click', async () => {
  await api('/api/findatime/admin/auth', { method: 'DELETE' }).catch(() => {});
  closeSidebar();
  showLogin();
});

byId('refresh-button').addEventListener('click', loadDashboard);
byId('menu-button').addEventListener('click', () => {
  byId('sidebar').classList.add('is-open');
  byId('sidebar-scrim').classList.add('is-open');
});
byId('sidebar-scrim').addEventListener('click', closeSidebar);
document.querySelectorAll('.nav-item[href]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[href]').forEach(link => link.classList.remove('active'));
    item.classList.add('active');
    closeSidebar();
  });
});

document.querySelectorAll('[data-open-security]').forEach(button => {
  button.addEventListener('click', () => {
    closeSidebar();
    byId('password-message').textContent = '';
    byId('password-message').className = 'form-message';
    byId('password-form').reset();
    byId('security-dialog').showModal();
  });
});

document.querySelectorAll('[data-open-appearance]').forEach(button => {
  button.addEventListener('click', () => {
    closeSidebar();
    openAppearance();
  });
});

document.querySelectorAll('[data-close-dialog]').forEach(button => {
  button.addEventListener('click', () => {
    const dialog = byId(button.dataset.closeDialog);
    if (dialog.id === 'appearance-dialog') restoreAppearanceAndClose(dialog);
    else dialog.close();
  });
});

byId('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = byId('password-message');
  const newPassword = byId('new-password').value;
  if (newPassword !== byId('confirm-password').value) {
    message.textContent = '两次输入的新密码不一致';
    message.className = 'form-message error';
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/findatime/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: byId('current-password').value,
        newPassword
      })
    });
    event.currentTarget.reset();
    message.textContent = '密码已更新，其他旧会话已失效。';
    message.className = 'form-message success';
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  } finally {
    button.disabled = false;
  }
});

byId('preview-background').addEventListener('click', () => {
  const message = byId('appearance-message');
  const image = validBackgroundUrl(byId('background-url').value);
  if (!image) {
    message.textContent = '请输入有效的 http 或 https 图片地址。';
    message.className = 'form-message error';
    return;
  }
  pendingBackground = image;
  applyAppearance({
    image,
    shade: Number(byId('shade-strength').value),
    textOpacity: Number(byId('text-opacity').value)
  });
  message.textContent = '正在预览此背景，点击“保存外观”后生效。';
  message.className = 'form-message success';
});

byId('background-file').addEventListener('change', event => {
  const file = event.target.files?.[0];
  const message = byId('appearance-message');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.textContent = '请选择图片文件。';
    message.className = 'form-message error';
    return;
  }
  if (file.size > 2.5 * 1024 * 1024) {
    message.textContent = '图片超过 2.5 MB，请压缩后重试。';
    message.className = 'form-message error';
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    pendingBackground = String(reader.result || '');
    byId('background-url').value = '';
    applyAppearance({
      image: pendingBackground,
      shade: Number(byId('shade-strength').value),
      textOpacity: Number(byId('text-opacity').value)
    });
    message.textContent = `正在预览：${file.name}`;
    message.className = 'form-message success';
  });
  reader.addEventListener('error', () => {
    message.textContent = '无法读取这张图片，请重试。';
    message.className = 'form-message error';
  });
  reader.readAsDataURL(file);
});

byId('shade-strength').addEventListener('input', event => {
  const shade = Number(event.target.value);
  byId('shade-output').value = `${shade}%`;
  applyAppearance({
    image: pendingBackground,
    shade,
    textOpacity: Number(byId('text-opacity').value)
  });
});

byId('text-opacity').addEventListener('input', event => {
  const textOpacity = Number(event.target.value);
  byId('text-opacity-output').value = `${textOpacity}%`;
  applyAppearance({
    image: pendingBackground,
    shade: Number(byId('shade-strength').value),
    textOpacity
  });
});

byId('appearance-form').addEventListener('submit', event => {
  event.preventDefault();
  const message = byId('appearance-message');
  const typedUrl = byId('background-url').value.trim();
  if (typedUrl) {
    const image = validBackgroundUrl(typedUrl);
    if (!image) {
      message.textContent = '背景图片地址无效。';
      message.className = 'form-message error';
      return;
    }
    pendingBackground = image;
  }
  const nextAppearance = {
    image: pendingBackground || '',
    shade: Number(byId('shade-strength').value),
    textOpacity: Number(byId('text-opacity').value)
  };
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(nextAppearance));
    savedAppearance = nextAppearance;
    applyAppearance(savedAppearance);
    byId('appearance-dialog').close();
  } catch {
    message.textContent = '浏览器存储空间不足，请使用更小的图片或改用图片网址。';
    message.className = 'form-message error';
  }
});

byId('reset-background').addEventListener('click', () => {
  localStorage.removeItem(APPEARANCE_KEY);
  savedAppearance = { ...DEFAULT_APPEARANCE };
  pendingBackground = '';
  byId('background-url').value = '';
  byId('background-file').value = '';
  byId('shade-strength').value = String(DEFAULT_APPEARANCE.shade);
  byId('text-opacity').value = String(DEFAULT_APPEARANCE.textOpacity);
  applyAppearance(savedAppearance);
  byId('appearance-message').textContent = '已恢复默认暗色背景。';
  byId('appearance-message').className = 'form-message success';
});

byId('appearance-dialog').addEventListener('cancel', event => {
  event.preventDefault();
  restoreAppearanceAndClose(byId('appearance-dialog'));
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(drawChart, 120);
  if (window.innerWidth > 800) closeSidebar();
});

applyAppearance(savedAppearance);
api('/api/findatime/admin/auth')
  .then(status => {
    if (status.authenticated) {
      setCurrentUser(status.username);
      return loadDashboard();
    }
    if (status.configured) return showLogin();
    return showSetup();
  })
  .catch(() => showLogin('暂时无法连接服务器'));
