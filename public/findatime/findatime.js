const state = { duration: 60, slots: [], meeting: null };
const byId = id => document.getElementById(id);

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function durationText(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function parseShanghai(value) {
  const [datePart, timePart] = value.slice(0, 16).split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function timeText(value, includeYear = false) {
  const { year, month, day, hour, minute } = parseShanghai(value);
  const period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 13 ? '中午' : hour < 18 ? '下午' : '晚上';
  const twelveHour = hour % 12 || 12;
  const minuteText = minute ? `${String(minute).padStart(2, '0')}分` : '';
  return `${includeYear ? `${year}年` : ''}${month}月${day}日${period}${twelveHour}点${minuteText}`;
}

function slotParts(value) {
  const { month, day, hour, minute } = parseShanghai(value);
  return { date: `${month}月${day}日`, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function setError(message, target = 'step-two-error') {
  const element = byId(target);
  if (element) element.textContent = message || '';
}

function renderDurationOptions() {
  byId('duration-options').innerHTML = Array.from({ length: 16 }, (_, index) => (index + 1) * 30).map(minutes => `
    <label class="duration-option">
      <input type="radio" name="duration" value="${minutes}" ${minutes === state.duration ? 'checked' : ''}>
      <span>${durationText(minutes)}</span>
    </label>
  `).join('');
  document.querySelectorAll('input[name="duration"]').forEach(input => {
    input.addEventListener('change', event => { state.duration = Number(event.target.value); });
  });
}

function renderSlots() {
  byId('slot-count').textContent = `已选择 ${state.slots.length} / 10 个时间`;
  byId('slot-list').innerHTML = state.slots.length ? state.slots.map((value, index) => {
    const parts = slotParts(value);
    return `<div class="slot-row">
      <span class="slot-date">${parts.date}</span>
      <span class="slot-time">${parts.time}</span>
      <button class="slot-remove" type="button" data-index="${index}" aria-label="移除 ${timeText(value)}">×</button>
    </div>`;
  }).join('') : '<div class="empty-state">还没有时间选项，先在上方添加一个。</div>';
  document.querySelectorAll('.slot-remove').forEach(button => {
    button.addEventListener('click', () => {
      state.slots.splice(Number(button.dataset.index), 1);
      renderSlots();
    });
  });
}

function goToStep(step) {
  byId('step-one').classList.toggle('hidden', step !== 1);
  byId('step-two').classList.toggle('hidden', step !== 2);
  byId('progress-one').classList.toggle('active', step === 1);
  byId('progress-two').classList.toggle('active', step === 2);
  setError('', 'step-one-error');
  setError('', 'step-two-error');
}

function setupCreator() {
  renderDurationOptions();
  renderSlots();

  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  byId('slot-date').min = today;
  byId('slot-date').value = today;
  byId('slot-time').innerHTML = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 ? '30' : '00';
    const value = `${String(hour).padStart(2, '0')}:${minute}`;
    return `<option value="${value}" ${value === '10:00' ? 'selected' : ''}>${value}</option>`;
  }).join('');

  byId('next-step').addEventListener('click', () => {
    if (!byId('meeting-title').value.trim()) return setError('请先填写约会名称', 'step-one-error');
    goToStep(2);
  });
  byId('back-step').addEventListener('click', () => goToStep(1));
  byId('add-slot').addEventListener('click', () => {
    setError('');
    const date = byId('slot-date').value;
    const time = byId('slot-time').value;
    if (!date || !time) return setError('请选择日期和时间');
    const value = `${date}T${time}`;
    if (state.slots.includes(value)) return setError('这个时间已经添加过了');
    if (state.slots.length >= 10) return setError('最多可以添加 10 个时间');
    state.slots.push(value);
    state.slots.sort();
    renderSlots();
  });

  byId('create-meeting').addEventListener('click', async () => {
    if (!state.slots.length) return setError('请至少添加一个时间');
    const button = byId('create-meeting');
    button.disabled = true;
    button.textContent = '正在创建…';
    try {
      const response = await fetch('/api/findatime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: byId('meeting-title').value.trim(), duration: state.duration, slots: state.slots })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '创建失败');
      localStorage.setItem(`findatime-token-${result.id}`, result.creatorToken);
      const fullUrl = `${window.location.origin}${result.url}`;
      byId('share-link').value = fullUrl;
      byId('view-meeting').href = result.url;
      byId('share-modal').classList.remove('hidden');
    } catch (error) {
      setError(error.message || '创建失败，请稍后重试');
    } finally {
      button.disabled = false;
      button.textContent = '创建并获取链接';
    }
  });

  byId('copy-link').addEventListener('click', async () => {
    await navigator.clipboard.writeText(byId('share-link').value);
    byId('copy-link').textContent = '已复制';
  });
}

function summaryValues(meeting) {
  const maxVotes = Math.max(...meeting.slots.map(slot => slot.votes));
  const best = meeting.slots.filter(slot => slot.votes === maxVotes);
  const times = best.map(slot => timeText(slot.start)).join('、');
  return { maxVotes, times };
}

function renderMeeting(meeting) {
  state.meeting = meeting;
  const summary = summaryValues(meeting);
  byId('meeting-title-view').textContent = meeting.title;
  byId('summary-option-count').textContent = meeting.slots.length;
  byId('summary-best-times').textContent = summary.times;
  byId('summary-attendance').textContent = `${summary.maxVotes}/${meeting.participantCount}`;
  byId('meeting-duration').textContent = `时长：${durationText(meeting.duration)}`;
  byId('meeting-timezone').textContent = '时区：中国标准时间（GMT+8）';
  byId('participant-total').textContent = `${meeting.participantCount} 人已回应`;
  byId('vote-list').innerHTML = meeting.slots.map(slot => {
    const parts = slotParts(slot.start);
    const attendeeText = slot.attendees?.length ? slot.attendees.map(escapeText).join('、') : '暂无人选择';
    return `<label class="vote-slot">
      <input type="checkbox" name="availability" value="${escapeText(slot.id)}">
      <span class="vote-slot-main">
        <span class="slot-date">${parts.date}</span>
        <span class="slot-time">${parts.time}</span>
      </span>
      <span class="vote-details">
        <span class="vote-count">${slot.votes} 票</span>
        <span class="attendee-names">选择者：${attendeeText}</span>
      </span>
    </label>`;
  }).join('');
}

async function setupMeeting(id) {
  byId('creator-view').classList.add('hidden');
  byId('meeting-view').classList.remove('hidden');
  try {
    const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`);
    const meeting = await response.json();
    if (!response.ok) throw new Error(meeting.error || '找不到这个约会');
    byId('meeting-loading').classList.add('hidden');
    byId('meeting-content').classList.remove('hidden');
    renderMeeting(meeting);
  } catch (error) {
    byId('meeting-loading').textContent = error.message || '加载失败';
  }

  byId('vote-form').addEventListener('submit', async event => {
    event.preventDefault();
    setError('', 'vote-error');
    const availability = [...document.querySelectorAll('input[name="availability"]:checked')].map(input => input.value);
    const name = byId('participant-name').value.trim();
    if (!name) return setError('请输入姓名', 'vote-error');
    if (!availability.length) return setError('请至少选择一个方便的时间', 'vote-error');
    const submit = byId('submit-vote');
    submit.disabled = true;
    submit.textContent = '正在提交…';
    try {
      const tokenKey = `findatime-token-${id}`;
      const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, availability, participantToken: localStorage.getItem(tokenKey) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '提交失败');
      localStorage.setItem(tokenKey, result.participantToken);
      renderMeeting(result.meeting);
      byId('vote-success').textContent = '已保存你的时间，汇总结果已更新。';
    } catch (error) {
      setError(error.message || '提交失败，请稍后重试', 'vote-error');
    } finally {
      submit.disabled = false;
      submit.textContent = '提交我的时间';
    }
  });
}

const match = window.location.pathname.match(/^\/findatime\/uuid\/(ua[a-f0-9]{14})\/?$/);
if (match) setupMeeting(match[1]);
else setupCreator();
