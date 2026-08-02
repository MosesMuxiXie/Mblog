const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const state = {
  duration: 60,
  slots: [],
  meeting: null,
  comments: [],
  commentsLoading: false,
  activeReplyId: null,
  timezone: browserTimeZone,
  creating: false,
  submitting: false,
  commenting: false,
  creatorNameEdited: false,
  meetingMessageKey: 'loadingMeeting',
  commentsMessageKey: 'loadingComments'
};
const byId = id => document.getElementById(id);
const t = (key, parameters) => MosankaiI18n.t(`findatime.${key}`, parameters);
const profileStorageKey = 'findatime-profile-v1';
let creatorLayoutFrame = 0;

function syncCreatorLayout() {
  creatorLayoutFrame = 0;
  const creatorVisible = document.body.classList.contains('creator-layout') &&
    !byId('creator-view').classList.contains('hidden');

  document.body.classList.remove('creator-layout-wide');
  if (!creatorVisible || !window.matchMedia('(orientation: landscape)').matches) return;

  // Measure the regular layout first, then use the wider two-column layout only
  // when the creation form would otherwise make the page scroll vertically.
  void byId('creator-view').offsetHeight;
  const pageOverflows = document.documentElement.scrollHeight > window.innerHeight + 1;
  document.body.classList.toggle('creator-layout-wide', pageOverflows);
}

function queueCreatorLayoutSync() {
  if (creatorLayoutFrame) cancelAnimationFrame(creatorLayoutFrame);
  creatorLayoutFrame = requestAnimationFrame(syncCreatorLayout);
}

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

function responseError(message, fallbackKey, code) {
  const translationKey = code || apiErrorKeys[message] || fallbackKey;
  const error = new Error(t(translationKey));
  error.translationKey = translationKey;
  error.code = code || '';
  return error;
}

function participantTokenKey(id) {
  return `findatime-token-${id}`;
}

function participantToken(id) {
  return localStorage.getItem(participantTokenKey(id)) || '';
}

function participantNameKey(id) {
  return `findatime-name-${id}`;
}

function loadProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(profileStorageKey) || '{}');
    const name = typeof profile.name === 'string' ? profile.name : '';
    if (Object.prototype.hasOwnProperty.call(profile, 'email')) saveProfile(name);
    return name;
  } catch {
    return '';
  }
}

function saveProfile(name) {
  localStorage.setItem(profileStorageKey, JSON.stringify({
    name: name.trim()
  }));
}

function fillProfile(nameId) {
  byId(nameId).value = loadProfile();
}

function validateName(nameId, errorTarget) {
  const name = byId(nameId).value.trim();
  if (!name) {
    setError(t('enterParticipantName'), errorTarget, 'enterParticipantName');
    return null;
  }
  return name;
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
  queueCreatorLayoutSync();
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
      step="1"
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
  let snapAnimationFrame = 0;
  const snapDuration = value => Math.min(
    maximumDuration,
    Math.max(minimumDuration, Math.round(value / 30) * 30)
  );
  const updateSliderPresentation = (visualDuration = state.duration) => {
    const duration = durationText(state.duration);
    const progress = ((visualDuration - minimumDuration) / (maximumDuration - minimumDuration)) * 100;
    output.textContent = duration;
    slider.setAttribute('aria-label', t('meetingDuration'));
    slider.setAttribute('aria-valuetext', duration);
    slider.style.setProperty('--duration-progress', `${progress}%`);
  };

  const animateToSnappedDuration = () => {
    cancelAnimationFrame(snapAnimationFrame);
    const startValue = Number(slider.value);
    const targetValue = state.duration;
    if (startValue === targetValue || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slider.value = targetValue;
      updateSliderPresentation();
      return;
    }

    const startedAt = performance.now();
    const animationDuration = 140;
    const step = now => {
      const progress = Math.min(1, (now - startedAt) / animationDuration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const visualDuration = startValue + (targetValue - startValue) * easedProgress;
      slider.value = visualDuration;
      updateSliderPresentation(visualDuration);
      if (progress < 1) snapAnimationFrame = requestAnimationFrame(step);
    };
    snapAnimationFrame = requestAnimationFrame(step);
  };

  updateSliderPresentation();
  slider.addEventListener('input', event => {
    cancelAnimationFrame(snapAnimationFrame);
    const visualDuration = Number(event.target.value);
    const nextDuration = snapDuration(visualDuration);
    const durationChanged = nextDuration !== state.duration;
    state.duration = nextDuration;
    updateSliderPresentation(visualDuration);
    if (durationChanged) renderSlots();
  });
  slider.addEventListener('change', animateToSnappedDuration);
  slider.addEventListener('keydown', event => {
    const direction = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1
    }[event.key];
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const nextDuration = event.key === 'Home'
      ? minimumDuration
      : event.key === 'End'
        ? maximumDuration
        : Math.min(maximumDuration, Math.max(minimumDuration, state.duration + direction * 30));
    if (nextDuration === state.duration) return;
    state.duration = nextDuration;
    slider.value = nextDuration;
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
  queueCreatorLayoutSync();
}

function goToStep(step) {
  byId('step-one').classList.toggle('hidden', step !== 1);
  byId('step-two').classList.toggle('hidden', step !== 2);
  byId('progress-one').classList.toggle('active', step === 1);
  byId('progress-two').classList.toggle('active', step === 2);
  setError('', 'step-one-error');
  setError('', 'step-two-error');
  queueCreatorLayoutSync();
}

function setupCreator() {
  document.body.classList.add('creator-layout');
  renderDurationOptions();
  renderSlots();
  const creatorName = byId('creator-name');
  creatorName.value = t('defaultCreatorName');
  creatorName.addEventListener('input', () => {
    state.creatorNameEdited = true;
  });

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
    if (!validateName('creator-name', 'step-one-error')) return;
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
    const name = validateName('creator-name', 'step-two-error');
    if (!name) return;
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
          name,
          duration: state.duration,
          timezone: state.timezone,
          slots: state.slots
        })
      });
      const result = await response.json();
      if (!response.ok) throw responseError(result.error, 'createFailed', result.code);
      saveProfile(name);
      localStorage.setItem(participantTokenKey(result.id), result.creatorToken);
      localStorage.setItem(participantNameKey(result.id), name);
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
  queueCreatorLayoutSync();
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
  const unavailable = meeting.unavailable || { count: 0, attendees: [] };
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
  const timeOptions = meeting.slots.map(slot => {
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
  const unavailableNames = unavailable.attendees?.length
    ? unavailable.attendees.map(escapeText).join(MosankaiI18n.language === 'zh-CN' ? '、' : ', ')
    : t('noOne');
  byId('vote-list').innerHTML = `${timeOptions}
    <label class="vote-slot vote-slot-unavailable">
      <input id="cannot-attend" type="checkbox" name="unavailable">
      <span class="vote-slot-main unavailable-option-main">
        <span class="slot-date">${t('cannotAttend')}</span>
        <span class="slot-time">${t('cannotAttendHint')}</span>
      </span>
      <span class="vote-details">
        <span class="vote-count">${t(unavailable.count === 1 ? 'oneCannotAttend' : 'peopleCannotAttend', { count: unavailable.count })}</span>
        <span class="attendee-names">${t('cannotAttendBy', { names: unavailableNames })}</span>
      </span>
    </label>`;

  const unavailableInput = byId('cannot-attend');
  const timeInputs = [...document.querySelectorAll('input[name="availability"]')];
  timeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) unavailableInput.checked = false;
    });
  });
  unavailableInput.addEventListener('change', () => {
    if (unavailableInput.checked) timeInputs.forEach(input => { input.checked = false; });
  });
}

function commentDateText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(MosankaiI18n.locale(), {
    timeZone: state.timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function updateConversationAccess(id) {
  const canComment = Boolean(participantToken(id));
  byId('comment-gate').classList.toggle('hidden', canComment);
  byId('comment-form').classList.toggle('hidden', !canComment);
  if (canComment) {
    const name = localStorage.getItem(participantNameKey(id)) || loadProfile() || byId('participant-name').value.trim();
    byId('comment-author').textContent = t('commentingAs', { name });
  } else {
    byId('comment-author').textContent = '';
  }
  return canComment;
}

function renderComments(id) {
  const comments = Array.isArray(state.comments) ? state.comments : [];
  const canComment = Boolean(participantToken(id));
  byId('comment-count').textContent = t(
    comments.length === 1 ? 'oneComment' : 'commentsCount',
    { count: comments.length }
  );

  const repliesByParent = new Map();
  comments.filter(comment => comment.parentId).forEach(reply => {
    if (!repliesByParent.has(reply.parentId)) repliesByParent.set(reply.parentId, []);
    repliesByParent.get(reply.parentId).push(reply);
  });

  const replyMarkup = reply => `
    <article class="reply" aria-label="${escapeText(t('replyFrom', { name: reply.name }))}">
      <header class="comment-header">
        <strong class="comment-name">${escapeText(reply.name)}</strong>
        <time class="comment-time" datetime="${escapeText(reply.createdAt)}">${escapeText(commentDateText(reply.createdAt))}</time>
      </header>
      <p class="comment-text">${escapeText(reply.text)}</p>
    </article>`;

  const roots = comments.filter(comment => !comment.parentId);
  byId('comments-list').innerHTML = roots.length ? roots.map(comment => {
    const replies = repliesByParent.get(comment.id) || [];
    const replyOpen = state.activeReplyId === comment.id;
    const replyButton = canComment ? `
      <button class="reply-toggle" type="button" data-reply-to="${escapeText(comment.id)}" aria-expanded="${replyOpen}">
        ${escapeText(t(replyOpen ? 'cancelReply' : 'reply'))}
      </button>` : '';
    const repliesMarkup = replies.length
      ? `<div class="replies">${replies.map(replyMarkup).join('')}</div>`
      : '';
    const replyForm = canComment && replyOpen ? `
      <form class="reply-form" data-parent-id="${escapeText(comment.id)}" novalidate>
        <label for="reply-text-${escapeText(comment.id)}">${escapeText(t('replyTo', { name: comment.name }))}</label>
        <textarea id="reply-text-${escapeText(comment.id)}" maxlength="1000" rows="3" placeholder="${escapeText(t('replyPlaceholder'))}" required></textarea>
        <div id="reply-error-${escapeText(comment.id)}" class="error" role="alert"></div>
        <div class="comment-actions">
          <button class="button small" type="submit">${escapeText(t('postReply'))}</button>
        </div>
      </form>` : '';

    return `<article class="comment">
      <header class="comment-header">
        <strong class="comment-name">${escapeText(comment.name)}</strong>
        <time class="comment-time" datetime="${escapeText(comment.createdAt)}">${escapeText(commentDateText(comment.createdAt))}</time>
      </header>
      <p class="comment-text">${escapeText(comment.text)}</p>
      ${replyButton}
      ${repliesMarkup}
      ${replyForm}
    </article>`;
  }).join('') : `<div class="comments-empty">${escapeText(t('noComments'))}</div>`;
}

async function loadComments(id) {
  state.commentsLoading = true;
  state.commentsMessageKey = 'loadingComments';
  byId('comments-loading').classList.remove('hidden');
  byId('comments-loading').textContent = t(state.commentsMessageKey);
  delete byId('comments-loading').dataset.findatimeKey;
  try {
    const response = await fetch(`/api/findatime/${encodeURIComponent(id)}?comments=1`);
    const result = await response.json();
    if (!response.ok) throw responseError(result.error, 'commentsLoadFailed', result.code);
    state.comments = Array.isArray(result.comments) ? result.comments : [];
    byId('comments-loading').classList.add('hidden');
    renderComments(id);
  } catch (error) {
    state.commentsMessageKey = error.translationKey || 'commentsLoadFailed';
    byId('comments-loading').textContent = t(state.commentsMessageKey);
    byId('comments-loading').dataset.findatimeKey = state.commentsMessageKey;
  } finally {
    state.commentsLoading = false;
  }
}

async function postComment(id, text, parentId, errorTarget, submitButton) {
  setError('', errorTarget);
  const trimmedText = text.trim();
  if (!trimmedText) {
    setError(t('writeCommentFirst'), errorTarget, 'writeCommentFirst');
    return false;
  }

  submitButton.disabled = true;
  submitButton.textContent = t('postingComment');
  if (!parentId) state.commenting = true;
  try {
    const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'comment',
        text: trimmedText,
        parentId: parentId || null,
        participantToken: participantToken(id)
      })
    });
    const result = await response.json();
    if (!response.ok) throw responseError(result.error, 'commentFailedRetry', result.code);
    state.comments = Array.isArray(result.comments) ? result.comments : state.comments.concat(result.comment);
    state.activeReplyId = null;
    byId('comments-loading').classList.add('hidden');
    byId('comment-success').textContent = t(parentId ? 'replyPosted' : 'commentPosted');
    byId('comment-success').dataset.findatimeKey = parentId ? 'replyPosted' : 'commentPosted';
    renderComments(id);
    return true;
  } catch (error) {
    if (error.code === 'submitAvailabilityFirst') {
      localStorage.removeItem(participantTokenKey(id));
      localStorage.removeItem(participantNameKey(id));
      updateConversationAccess(id);
      renderComments(id);
    } else {
      const errorKey = error.translationKey || 'commentFailedRetry';
      setError(t(errorKey), errorTarget, errorKey);
    }
    return false;
  } finally {
    if (!parentId) state.commenting = false;
    submitButton.disabled = false;
    submitButton.textContent = t(parentId ? 'postReply' : 'postComment');
  }
}

function setupConversation(id) {
  updateConversationAccess(id);

  byId('comment-form').addEventListener('submit', async event => {
    event.preventDefault();
    const textarea = byId('comment-text');
    const posted = await postComment(id, textarea.value, null, 'comment-error', byId('post-comment'));
    if (posted) textarea.value = '';
  });

  byId('comments-list').addEventListener('click', event => {
    const button = event.target.closest('[data-reply-to]');
    if (!button) return;
    const commentId = button.dataset.replyTo;
    state.activeReplyId = state.activeReplyId === commentId ? null : commentId;
    renderComments(id);
    if (state.activeReplyId) requestAnimationFrame(() => byId(`reply-text-${commentId}`)?.focus());
  });

  byId('comments-list').addEventListener('submit', async event => {
    const form = event.target.closest('.reply-form');
    if (!form) return;
    event.preventDefault();
    const parentId = form.dataset.parentId;
    const textarea = form.querySelector('textarea');
    await postComment(id, textarea.value, parentId, `reply-error-${parentId}`, form.querySelector('button[type="submit"]'));
  });
}

async function setupMeeting(id) {
  document.body.classList.remove('creator-layout', 'creator-layout-wide');
  byId('creator-view').classList.add('hidden');
  byId('meeting-view').classList.remove('hidden');
  fillProfile('participant-name');
  setupConversation(id);
  state.meetingMessageKey = 'loadingMeeting';
  byId('meeting-loading').textContent = t(state.meetingMessageKey);
  try {
    const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`);
    const meeting = await response.json();
    if (!response.ok) throw responseError(meeting.error, 'meetingNotFound', meeting.code);
    byId('meeting-loading').classList.add('hidden');
    byId('meeting-content').classList.remove('hidden');
    renderMeeting(meeting);
    loadComments(id);
  } catch (error) {
    state.meetingMessageKey = error.translationKey || 'loadFailed';
    byId('meeting-loading').textContent = t(state.meetingMessageKey);
  }

  byId('vote-form').addEventListener('submit', async event => {
    event.preventDefault();
    setError('', 'vote-error');
    const availability = [...document.querySelectorAll('input[name="availability"]:checked')].map(input => input.value);
    const unavailable = byId('cannot-attend').checked;
    const name = validateName('participant-name', 'vote-error');
    if (!name) return;
    if (!unavailable && !availability.length) return setError(t('chooseAvailability'), 'vote-error', 'chooseAvailability');
    const submit = byId('submit-vote');
    state.submitting = true;
    submit.disabled = true;
    submit.textContent = t('submitting');
    try {
      const tokenKey = participantTokenKey(id);
      const response = await fetch(`/api/findatime/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          availability,
          unavailable,
          participantToken: localStorage.getItem(tokenKey)
        })
      });
      const result = await response.json();
      if (!response.ok) throw responseError(result.error, 'submitFailed', result.code);
      saveProfile(name);
      localStorage.setItem(tokenKey, result.participantToken);
      localStorage.setItem(participantNameKey(id), name);
      renderMeeting(result.meeting);
      updateConversationAccess(id);
      renderComments(id);
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
  if (!state.creatorNameEdited) byId('creator-name').value = t('defaultCreatorName');
  byId('creator-timezone').textContent = t('currentTimezone', { timezone: timeZoneText() });
  byId('create-meeting').textContent = t(state.creating ? 'creating' : 'createAndGetLink');
  byId('submit-vote').textContent = t(state.submitting ? 'submitting' : 'submitAvailability');
  byId('post-comment').textContent = t(state.commenting ? 'postingComment' : 'postComment');
  if (!byId('meeting-loading').classList.contains('hidden')) {
    byId('meeting-loading').textContent = t(state.meetingMessageKey);
  }
  document.querySelectorAll('[data-findatime-key]').forEach(element => {
    element.textContent = t(element.dataset.findatimeKey);
  });
  if (state.meeting) renderMeeting(state.meeting);
  if (match) {
    updateConversationAccess(match[1]);
    renderComments(match[1]);
    if (state.commentsLoading) byId('comments-loading').textContent = t('loadingComments');
  }
  queueCreatorLayoutSync();
});

window.addEventListener('resize', queueCreatorLayoutSync);

trackVisit();
if (match) setupMeeting(match[1]);
else setupCreator();
