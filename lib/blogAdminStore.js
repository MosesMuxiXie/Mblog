const fs = require('fs');
const path = require('path');

const ADMIN_DATA_FILE = process.env.BLOG_ADMIN_DATA_FILE
  || path.join(process.cwd(), 'blog-admin.json');
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const CREDENTIALS_KEY = 'blog:admin:credentials';
const SITE_SETTINGS_KEY = 'site:settings';

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

function readLocal() {
  if (!fs.existsSync(ADMIN_DATA_FILE)) return { credentials: null, siteSettings: null };
  try {
    const data = JSON.parse(fs.readFileSync(ADMIN_DATA_FILE, 'utf8'));
    return {
      credentials: data.credentials || null,
      siteSettings: data.siteSettings || null
    };
  } catch {
    return { credentials: null, siteSettings: null };
  }
}

function writeLocal(data) {
  fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function getCredentialRecord() {
  if (hasRedis()) {
    const raw = await redis(['GET', CREDENTIALS_KEY]);
    return raw ? JSON.parse(raw) : null;
  }
  return readLocal().credentials;
}

async function createCredentialRecord(record) {
  if (hasRedis()) {
    const result = await redis(['SET', CREDENTIALS_KEY, JSON.stringify(record), 'NX']);
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
    await redis(['SET', CREDENTIALS_KEY, JSON.stringify(record)]);
    return;
  }
  const data = readLocal();
  data.credentials = record;
  writeLocal(data);
}

async function getSiteSettingsRecord() {
  if (hasRedis()) {
    const raw = await redis(['GET', SITE_SETTINGS_KEY]);
    return raw ? JSON.parse(raw) : null;
  }
  return readLocal().siteSettings;
}

async function setSiteSettingsRecord(record) {
  if (hasRedis()) {
    await redis(['SET', SITE_SETTINGS_KEY, JSON.stringify(record)]);
    return;
  }
  const data = readLocal();
  data.siteSettings = record;
  writeLocal(data);
}

module.exports = {
  createCredentialRecord,
  getCredentialRecord,
  getSiteSettingsRecord,
  hasRedis,
  setCredentialRecord,
  setSiteSettingsRecord
};
