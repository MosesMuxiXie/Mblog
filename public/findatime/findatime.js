const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const state = {
  duration: 60,
  slots: [],
  meeting: null,
  timezone: browserTimeZone,
  creating: false,
  submitting: false,
  meetingMessageKey: 'loadingMeeting'
};
const byId = id => document.getElementById(id);
const t = (key, parameters) => MosankaiI18n.t(`findatime.${key}`, parameters);

const apiErrorKeys = {
  '请输入约会名称': 'enterMeetingName',
  '时长必须为 30 分钟到 8 小时，并以 30 分钟递增': 'invalidDuration',
  '无效时长': 'invalidDuration',
  '浏览器时区无效': 'invalidTimezone',
  '请选择 1–10 个有效的整点或半点时间': 'invalidSlots',
  '无效时间选项': 'invalidSlots',
  '暂时无法创建约会，请稍后重试': 'createFailedRetry',
  '找不到这个约会': 'meetingNotFound',
  '暂时无法读取约会': 'loadFailed',
  '请输入姓名': 'enterParticipantName',
  '请至少选择一个方便的时间': 'chooseAvailability',
  '暂时无法保存，请稍后重试': 'submitFailedRetry'
};

function responseError(message, fallbackKey) {
  const translationKey = apiErrorKeys[message] || fallbackKey;
  const error = new Error(t(translationKey));
  error.translationKey = translationKey;
  return error;
}

function trackVisit() {
  const storageKey = 'findatime-visitor-id';
  let visitorId = localStorage.getItem(storageKey);
  if (!visitorId) {
    visitorId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, visitorId);
  }
  fetch('/api/findatime/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
    keepalive: true
  }).catch(() => {});
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function durationText(minutes) {
  if (minutes < 60) return t('minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (minutes % 60 === 0) return t(hours === 1 ? 'hour' : 'hours', { count: hours });
  return t(hours === 1 ? 'hourMinutes' : 'hoursMinutes', {
    hours,
    minutes: minutes % 60
  });
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateTimeToIso(dateValue, timeValue) {
  const candidate = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(candidate.getTime())) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day || candidate.getHours() !== hour || candidate.getMinutes() !== minute) {
    return null;
  }
  return candidate.toISOString();
}

function timeZoneText() {
  const now = new Date();
  const locale = MosankaiI18n.locale();
  const zoneName = new Intl.DateTimeFormat(locale, {
    timeZone: state.timezone,
    timeZoneName: 'long'
  }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || state.timezone;
  const offset = new Intl.DateTimeFormat(locale, {
    timeZone: state.timezone,
    timeZoneName: 'longOffset'
  }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value;
  return offset && offset !== zoneName ? `${zoneName} (${offset})` : zoneName;
}

function dateText(value, includeYear = false) {
  const date = value instanceof Date ? value : new Date(value);
  const locale = MosankaiI18n.locale();
  const datePart = new Intl.DateTimeFormat(locale, {
    timeZone: state.timezone,
    ...(includeYear ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric'
  }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone: state.timezone,
    weekday: 'long'
  }).format(date);
  return `${datePart} ${weekday}`;
}

function clockText(value) {
  return new Intl.DateTimeFormat(MosankaiI18n.locale(), {
    timeZone: state.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(value);
}

function slotParts(value, duration = state.duration, includeYear = false) {
  const start = new Date(value);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const startDate = dateText(start, includeYear);
  const endDate = dateText(end, includeYear);
  return {
    date: startDate,
    time: startDate === endDate
      ? `${clockText(start)}—${clockText(end)}`
      : `${clockText(start)}—${endDate} ${clockText(end)}`
  };
}

function timeText(value, duration = state.duration, includeYear = false) {
  const parts = slotParts(value, duration, includeYear);
  return `${parts.date} ${parts.time}`;
}

function setError(message, target = 'step-two-error', translationKey = '') {
  const element = byId(target);
  if (!element) return;
  element.textContent = message || '';
  if (translationKey) element.dataset.findatimeKey = translationKey;
  else delete element.dataset.findatimeKey;
}

function renderDurationOptions() {
  const minimumDuration = 30;
  const maximumDuration = 480;
  const durationOptions = byId('duration-options');
  durationOptions.innerHTML = `
    <div class="duration-display">
      <output id="duration-value" class="duration-value" for="duration-range">${durationText(state.duration)}</output>
    </div>
    <input
      id="duration-range"
      class="duration-range"
      type="range"
      min="${minimumDuration}"
      max="${maximumDuration}"
      step="30"
      value="${state.duration}"
      aria-describedby="duration-hint"
    >
    <div class="duration-scale" aria-hidden="true">
      <span>${durationText(minimumDuration)}</span>
      <span>${durationText(maximumDuration)}</span>
    </div>
  `;

  const slider = byId('duration-range');
  const output = byId('duration-value');
  const updateSliderPresentation = () => {
    const duration = durationText(state.duration);
    const progress = ((state.duration - minimumDuration) / (maximumDuration - minimumDuration)) * 100;
    output.textContent = duration;
    slider.setAttribute('aria-label', t('meetingDuration'));
    slider.setAttribute('aria-valuetext', duration);
    slider.style.setProperty('--duration-progress', `${progress}%`);
  };

  updateSliderPresentation();
  slider.addEventListener('input', event => {
    state.duration = Number(event.target.value);
    updateSliderPresentation();
    renderSlots();
  });
}

function renderSlots() {
  byId('slot-count').textContent = t('selectedSlots', { count: state.slots.length });
  byId('slot-list').innerHTML = state.slots.length ? state.slots.map((value, index) => {
    const parts = slotParts(value, state.duration);
    return `<div class="slot-row">
      <span class="slot-date">${parts.date}</span>
      <span class="slot-time">${parts.time}</span>
      <button class="slot-remove" type="button" data-index="${index}" aria-label="${t('removeTime', { time: timeText(value, state.duration) })}">×</button>
    </div>`;
  }).join('') : `<div class="empty-state">${t('noSlots')}</div>`;
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

  byId('creator-timezone').textContent = t('currentTimezone', { timezone: timeZoneText() });
  const today = localDateValue();
  byId('slot-date').min = today;
  byId('slot-date').value = today;
  byId('slot-time').innerHTML = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 ? '30' : '00';
    const value = `${String(hour).padStart(2, '0')}:${minute}`;
    return `<option value="${value}" ${value === '10:00' ? 'selected' : ''}>${value}</option>`;
  }).join('');

  byId('next-step').addEventListener('click', () => {
    if (!byId('meeting-title').value.trim()) {
      return setError(t('enterMeetingName'), 'step-one-error', 'enterMeetingName');
    }
    goToStep(2);
  });
  byId('back-step').addEventListener('click', () => goToStep(1));
  byId('add-slot').addEventListener('click', () => {
    setError('');
    const date = byId('slot-date').value;
    const time = byId('slot-time').value;
    if (!date || !time) return setError(t('chooseDateTime'), 'step-two-error', 'chooseDateTime');
    const value = localDateTimeToIso(date, time);
    if (!value) return setError(t('invalidLocalTime'), 'step-two-error', 'invalidLocalTime');
    if (state.slots.includes(value)) return setError(t('duplicateTime'), 'step-two-error', 'duplicateTime');
    if (state.slots.length >= 10) return setError(t('maximumTimes'), 'step-two-error', 'maximumTimes');
    state.slots.push(value);
    state.slots.sort();
    renderSlots();
  });

  byId('create-meeting').addEventListener('click', async () => {
    if (!state.slots.length) return setError(t('addAtLeastOne'), 'step-two-error', 'addAtLeastOne');
    const button = byId('create-meeting');
    state.creating = true;
    button.disabled = true;
    button.textContent = t('creating');
    try {
      const response = await fetch('/api/findatime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: byId('meeting-title').value.trim(),
          duration: state.duration,
          timezone: state.timezone,
          slots: state.slots
        })
      });
      const result = await response.json();
      if (!response.ok) throw responseError(result.error, 'createFailed');
      localStorage.setItem(`findatime-token-${result.id}`, result.creatorToken);
      const fullUrl = `${window.location.origin}${result.url}`;
      byId('share-link').value = fullUrl;
      byId('view-meeting').href = result.url;
      byId('share-modal').classList.remove('hidden');
    } catch (error) {
      const errorKey = error.translationKey || 'createFailedRetry';
      setError(t(errorKey), 'step-two-error', errorKey);
    } finally {
      state.creating = false;
      button.disabled = false;
      button.textContent = t('createAndGetLink');
    }
  });

  byId('copy-link').addEventListener('click', async () => {
    await navigator.clipboard.writeText(byId('share-link').value);
    byId('copy-link').textContent = t('copied');
  });
}

function summaryValues(meeting) {
  const maxVotes = Math.max(...meeting.slots.map(slot => slot.votes));
  const best = meeting.slots.filter(slot => slot.votes === maxVotes);
  const times = best.map(slot => timeText(slot.start, meeting.duration)).join('、');
  return { maxVotes, times };
}

function renderMeeting(meeting) {
  state.meeting = meeting;
  const summary = summaryValues(meeting);
  byId('meeting-title-view').textContent = meeting.title;
  byId('summary-option-count').textContent = meeting.slots.length;
  byId('summary-best-times').textContent = summary.times;
  byId('summary-attendance').textContent = `${summary.maxVotes}/${meeting.participantCount}`;
  byId('meeting-duration').textContent = t('durationLabel', { duration: durationText(meeting.duration) });
  byId('meeting-timezone').textContent = t('timezoneLabel', { timezone: timeZoneText() });
  byId('participant-total').textContent = t(
    meeting.participantCount === 1 ? 'onePersonResponded' : 'peopleResponded',
    { count: meeting.participantCount }
  );
  byId('vote-list').innerHTML = meeting.slots.map(slot => {
    const parts = slotParts(slot.start, meeting.duration);
    const attendeeText = slot.attendees?.length
      ? slot.attendees.map(escapeText).join(MosankaiI18n.language === 'zh-CN' ? '、' : ', ')
      : t('noOne');
    return `<label class="vote-slot">
      <input type="checkbox" name="availability" value="${escapeText(slot.id)}">
      <span class="vote-slot-main">
        <span class="slot-date">${parts.date}</span>
        <span class="slot-time">${parts.time}</span>
      </span>
      <span class="vote-details">
        <span class="vote-count">${t(slot.votes === 1 ? 'oneVote' : 'votes', { count: slot.votes })}</span>
        <span class="attendee-names">${t('selectedBy', { names: attendeeText })}</span>
      </span>
    </label>`;
  }).join('');
}

async function setupMeeting(id) {
  byId('creator-view').classList.add('hidden');
  byId('meeting-view').classList.remove('hidden');
  state.meetingMessageKey = 'loadingMeeting';
  byId('meeting-loading').textContent = t(state.meetingMessageKey);
  try {
    const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`);
    const meeting = await response.json();
    if (!response.ok) throw responseError(meeting.error, 'meetingNotFound');
    byId('meeting-loading').classList.add('hidden');
    byId('meeting-content').classList.remove('hidden');
    renderMeeting(meeting);
  } catch (error) {
    state.meetingMessageKey = error.translationKey || 'loadFailed';
    byId('meeting-loading').textContent = t(state.meetingMessageKey);
  }

  byId('vote-form').addEventListener('submit', async event => {
    event.preventDefault();
    setError('', 'vote-error');
    const availability = [...document.querySelectorAll('input[name="availability"]:checked')].map(input => input.value);
    const name = byId('participant-name').value.trim();
    if (!name) return setError(t('enterParticipantName'), 'vote-error', 'enterParticipantName');
    if (!availability.length) return setError(t('chooseAvailability'), 'vote-error', 'chooseAvailability');
    const submit = byId('submit-vote');
    state.submitting = true;
    submit.disabled = true;
    submit.textContent = t('submitting');
    try {
      const tokenKey = `findatime-token-${id}`;
      const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, availability, participantToken: localStorage.getItem(tokenKey) })
      });
      const result = await response.json();
      if (!response.ok) throw responseError(result.error, 'submitFailed');
      localStorage.setItem(tokenKey, result.participantToken);
      renderMeeting(result.meeting);
      byId('vote-success').textContent = t('availabilitySaved');
      byId('vote-success').dataset.findatimeKey = 'availabilitySaved';
    } catch (error) {
      const errorKey = error.translationKey || 'submitFailedRetry';
      setError(t(errorKey), 'vote-error', errorKey);
    } finally {
      state.submitting = false;
      submit.disabled = false;
      submit.textContent = t('submitAvailability');
    }
  });
}

const match = window.location.pathname.match(/^\/findatime\/uuid\/(ua[a-f0-9]{14})\/?$/);
window.addEventListener('mosankai:languagechange', () => {
  renderDurationOptions();
  renderSlots();
  byId('creator-timezone').textContent = t('currentTimezone', { timezone: timeZoneText() });
  byId('create-meeting').textContent = t(state.creating ? 'creating' : 'createAndGetLink');
  byId('submit-vote').textContent = t(state.submitting ? 'submitting' : 'submitAvailability');
  if (!byId('meeting-loading').classList.contains('hidden')) {
    byId('meeting-loading').textContent = t(state.meetingMessageKey);
  }
  document.querySelectorAll('[data-findatime-key]').forEach(element => {
    element.textContent = t(element.dataset.findatimeKey);
  });
  if (state.meeting) renderMeeting(state.meeting);
});

trackVisit();
if (match) setupMeeting(match[1]);
else setupCreator();
