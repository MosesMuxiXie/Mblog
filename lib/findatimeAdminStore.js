const fs = require('fs');
const path = require('path');

const ADMIN_DATA_FILE = process.env.FINDATIME_ADMIN_DATA_FILE
  || path.join(process.cwd(), 'findatime-admin.json');
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function hasRedis() {
  return Boolean(redisUrl && redisToken);
}

async function redis(command) {
  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function scanKeys(pattern) {
  let cursor = '0';
  const keys = [];
  do {
    const result = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 500]);
    cursor = String(result?.[0] || '0');
    keys.push(...(result?.[1] || []));
  } while (cursor !== '0');
  return keys;
}

function readLocal() {
  if (!fs.existsSync(ADMIN_DATA_FILE)) return { visitorsByDay: {}, credentials: null };
  try {
    const data = JSON.parse(fs.readFileSync(ADMIN_DATA_FILE, 'utf8'));
    return {
      visitorsByDay: data.visitorsByDay || {},
      credentials: data.credentials || null
    };
  } catch {
    return { visitorsByDay: {}, credentials: null };
  }
}

function writeLocal(data) {
  fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function shanghaiDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value);
}

async function recordVisit(visitorId, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(visitorId)) return false;
  const day = shanghaiDateKey(now);
  if (hasRedis()) {
    await redis(['SADD', `findatime:visitors:day:${day}`, visitorId]);
    return true;
  }

  const data = readLocal();
  const visitors = new Set(data.visitorsByDay[day] || []);
  visitors.add(visitorId);
  data.visitorsByDay[day] = [...visitors];
  writeLocal(data);
  return true;
}

async function getVisitorsByDay() {
  if (hasRedis()) {
    const keys = await scanKeys('findatime:visitors:day:*');
    const entries = await Promise.all(keys.map(async key => [
      key.slice('findatime:visitors:day:'.length),
      await redis(['SMEMBERS', key])
    ]));
    return Object.fromEntries(entries);
  }
  return readLocal().visitorsByDay;
}

async function getCredentialRecord() {
  if (hasRedis()) {
    const raw = await redis(['GET', 'findatime:admin:credentials']);
    return raw ? JSON.parse(raw) : null;
  }
  return readLocal().credentials;
}

async function createCredentialRecord(record) {
  if (hasRedis()) {
    const result = await redis(['SET', 'findatime:admin:credentials', JSON.stringify(record), 'NX']);
    return result === 'OK';
  }
  const data = readLocal();
  if (data.credentials) return false;
  data.credentials = record;
  writeLocal(data);
  return true;
}

async function setCredentialRecord(record) {
  if (hasRedis()) {
    await redis(['SET', 'findatime:admin:credentials', JSON.stringify(record)]);
    return;
  }
  const data = readLocal();
  data.credentials = record;
  writeLocal(data);
}

module.exports = {
  createCredentialRecord,
  getCredentialRecord,
  getVisitorsByDay,
  hasRedis,
  recordVisit,
  setCredentialRecord,
  shanghaiDateKey
};
