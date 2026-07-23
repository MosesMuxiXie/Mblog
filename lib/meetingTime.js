function validTimeZone(value) {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function normalizeTimestamp(value, allowLegacyShanghai = false) {
  if (typeof value !== 'string' || value.length > 40) return null;
  let timestamp = value;
  if (allowLegacyShanghai && /^\d{4}-\d{2}-\d{2}T\d{2}:(00|30)$/.test(value)) {
    timestamp = `${value}:00+08:00`;
  } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCSeconds() !== 0 || parsed.getUTCMilliseconds() !== 0) {
    return null;
  }
  return parsed.toISOString();
}

function normalizeMeetingSlots(values, allowLegacyShanghai = false) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map(value => normalizeTimestamp(String(value), allowLegacyShanghai));
  if (normalized.some(value => !value)) return null;
  return [...new Set(normalized)].sort();
}

module.exports = { normalizeMeetingSlots, validTimeZone };
