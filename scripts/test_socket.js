const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { io } = require('socket.io-client');

dotenv.config();

const API_BASE = process.env.API_BASE || 'https://api-test.indealeg.com/api/v1';
const SOCKET_URL = process.env.SOCKET_URL || 'wss://api-test.indealeg.com';
const OUTPUT_PATH =
  process.env.SOCKET_TEST_OUTPUT || path.resolve(__dirname, 'output', 'socket_test_results.json');

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@indeal.local';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
const SEED_TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || 'Password123!';
const SEED_TEST_AGENT_PREFIX = process.env.SEED_TEST_AGENT_PREFIX || 'agent';
const SEED_TEST_EMAIL_DOMAIN = process.env.SEED_TEST_EMAIL_DOMAIN || 'indeal.test';
const SEED_TEST_COMPANY_COUNT = Number.parseInt(process.env.SEED_TEST_COMPANY_COUNT || '20', 10);

const AGENT1_EMAIL = process.env.SOCKET_AGENT1_EMAIL || null;
const AGENT2_EMAIL = process.env.SOCKET_AGENT2_EMAIL || null;
const AGENT_PASSWORD = process.env.SOCKET_AGENT_PASSWORD || SEED_TEST_PASSWORD;
const MAX_AGENT_CANDIDATES = Number.parseInt(process.env.SOCKET_AGENT_CANDIDATES || '20', 10);
const SOCKET_MIN_USERS = Number.parseInt(process.env.SOCKET_MIN_USERS || '7', 10);

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
};

const logSocketAction = (entry) => {
  if (!entry?.action || !entry.action.startsWith('socket.')) return;
  const parts = [
    `[socket-action] ${entry.action}`,
    entry.role ? `role=${entry.role}` : null,
    entry.ok !== undefined ? `ok=${entry.ok}` : null,
    entry.error ? `error=${entry.error}` : null,
    entry.meta ? `meta=${safeStringify(entry.meta)}` : null,
  ].filter(Boolean);
  console.log(parts.join(' '));
};

const logSocketEvent = (label, event, payload) => {
  const payloadText = payload ? `payload=${safeStringify(payload)}` : '';
  const line = `[socket-event] ${label} ${event} ${payloadText}`.trim();
  console.log(line);
};

const record = (entry) => {
  results.push({ timestamp: nowIso(), ...entry });
  logSocketAction(entry);
};

const extractToken = (response) =>
  response?.json?.data?.accessToken ||
  response?.json?.data?.token ||
  response?.json?.accessToken ||
  response?.json?.token;

const fetchJson = async (url, options = {}) => {
  const start = Date.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    durationMs: Date.now() - start,
    json,
    text,
  };
};

const loginAgent = async (email, password) => {
  const candidates = [email, `updated_${email}`];
  let lastResponse = null;

  for (const candidate of candidates) {
    const response = await fetchJson(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: candidate, password }),
    });

    record({
      role: candidate,
      action: 'auth.login',
      ok: response.ok,
      status: response.status,
      durationMs: response.durationMs,
      ...(response.ok ? {} : { error: response.json?.message || response.text }),
    });

    lastResponse = response;
    const token = extractToken(response);
    if (response.ok && token) {
      return { token, email: candidate };
    }
  }

  const status = lastResponse?.status ?? 'unknown';
  throw new Error(`Login failed for ${email}: ${status}`);
};

const loginAdmin = async () => {
  const response = await fetchJson(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD }),
  });

  record({
    role: 'admin',
    action: 'auth.admin.login',
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    ...(response.ok ? {} : { error: response.json?.message || response.text }),
  });

  if (!response.ok) {
    return null;
  }

  return extractToken(response);
};

const fetchAdminCompanies = async (token) => {
  const response = await fetchJson(`${API_BASE}/admin/companies`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  record({
    role: 'admin',
    action: 'admin.companies.list',
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    ...(response.ok ? {} : { error: response.json?.message || response.text }),
  });

  if (!response.ok) {
    return [];
  }

  const data = response.json?.data;
  return Array.isArray(data) ? data : data?.companies || [];
};

const fetchAdminCompanyDetail = async (token, companyId) => {
  const response = await fetchJson(`${API_BASE}/admin/companies/${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  record({
    role: 'admin',
    action: 'admin.companies.detail',
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    ...(response.ok ? {} : { error: response.json?.message || response.text }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json?.data || response.json;
};

const resolveAgentEmailsFromAdmin = async (token, count = 2) => {
  const companies = await fetchAdminCompanies(token);
  const emails = [];
  const seen = new Set();

  for (const company of companies) {
    if (emails.length >= count) break;
    if (!company?.id) continue;
    const detail = await fetchAdminCompanyDetail(token, company.id);
    const email =
      detail?.agent?.email || detail?.company?.agent?.email || detail?.company?.email || null;
    if (email && !seen.has(email)) {
      seen.add(email);
      emails.push(email);
    }
  }

  return emails;
};

const buildSeedEmail = (index) =>
  `${SEED_TEST_AGENT_PREFIX}${index}@${SEED_TEST_EMAIL_DOMAIN}`.toLowerCase();

const resolveAgentCandidates = async (minUsers = 2) => {
  const candidates = [];

  if (AGENT1_EMAIL) candidates.push(AGENT1_EMAIL);
  if (AGENT2_EMAIL && AGENT2_EMAIL !== AGENT1_EMAIL) candidates.push(AGENT2_EMAIL);

  if (candidates.length >= minUsers) {
    return candidates;
  }

  const adminToken = await loginAdmin();
  if (adminToken) {
    const adminEmails = await resolveAgentEmailsFromAdmin(adminToken, minUsers);
    for (const email of adminEmails) {
      if (!candidates.includes(email)) {
        candidates.push(email);
      }
    }
  }

  const count = Number.isFinite(SEED_TEST_COMPANY_COUNT)
    ? Math.max(SEED_TEST_COMPANY_COUNT, 2)
    : 20;
  const maxCandidates = Math.min(MAX_AGENT_CANDIDATES, count);
  for (let i = 1; candidates.length < maxCandidates; i += 1) {
    if (i > count) break;
    const email = buildSeedEmail(i);
    if (!candidates.includes(email)) {
      candidates.push(email);
    }
  }

  return candidates;
};

const loginAnyAgent = async (candidates, minUsers = 2) => {
  const auths = [];
  for (const email of candidates) {
    try {
      const auth = await loginAgent(email, AGENT_PASSWORD);
      if (!auths.find((item) => item.email === auth.email)) {
        auths.push(auth);
      }
      if (auths.length >= minUsers) break;
    } catch (err) {
      record({
        role: email,
        action: 'auth.login.skip',
        ok: false,
        error: err.message,
      });
    }
  }

  if (auths.length < minUsers) {
    throw new Error(`Unable to login ${minUsers} seeded agents. Check seed credentials.`);
  }

  return auths;
};

const getMyCompany = async (token, role) => {
  const response = await fetchJson(`${API_BASE}/companies/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  record({
    role,
    action: 'companies.me',
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    ...(response.ok ? {} : { error: response.json?.message || response.text }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load company for ${role}: ${response.status} ${response.json?.message || ''}`.trim()
    );
  }

  const company = response.json?.data?.company || response.json?.company;
  if (!company) {
    throw new Error(`Company payload missing for ${role}`);
  }

  return company;
};

const createRoom = async (token, role, targetCompanyId) => {
  const response = await fetchJson(`${API_BASE}/chats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetCompanyId }),
  });

  record({
    role,
    action: 'chats.create',
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${response.status}`);
  }

  return response.json?.data || response.json;
};

const waitForEvent = (socket, event, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });

const connectSocket = async (token, role) => {
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: false,
  });

  console.log(`[socket] Connecting socket for ${role}...`);

  const start = Date.now();

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connect timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  record({
    role,
    action: 'socket.connect',
    ok: true,
    durationMs: Date.now() - start,
  });

  const ready = await waitForEvent(socket, 'chat:ready').catch((err) => {
    record({
      role,
      action: 'socket.chat:ready',
      ok: false,
      error: err.message,
    });
    throw err;
  });

  record({
    role,
    action: 'socket.chat:ready',
    ok: true,
    payload: ready,
  });

  return socket;
};

const main = async () => {
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const minUsers = Number.isFinite(SOCKET_MIN_USERS) && SOCKET_MIN_USERS > 1 ? SOCKET_MIN_USERS : 2;
  const candidates = await resolveAgentCandidates(minUsers);
  const auths = await loginAnyAgent(candidates, minUsers);

  const companies = [];
  for (const auth of auths) {
    const company = await getMyCompany(auth.token, auth.email);
    companies.push({ ...auth, company });
  }

  const rooms = [];
  const host = companies[0];
  for (const target of companies.slice(1)) {
    const room = await createRoom(host.token, host.email, target.company.id);
    rooms.push({ room, host, target });
  }

  const sockets = [];
  for (const auth of auths) {
    const socket = await connectSocket(auth.token, auth.email);
    sockets.push({ ...auth, socket });
  }

  const events = Object.fromEntries(auths.map((auth) => [auth.email, []]));

  const capture = (label, event) => (payload) => {
    events[label].push({ event, payload, at: nowIso() });
    logSocketEvent(label, event, payload);
  };

  for (const item of sockets) {
    const label = item.email;
    item.socket.on('chat:message', capture(label, 'chat:message'));
    item.socket.on('chat:read', capture(label, 'chat:read'));
    item.socket.on('chat:typing', capture(label, 'chat:typing'));
    item.socket.on('chat:error', capture(label, 'chat:error'));
  }

  for (const { room, host: roomHost, target } of rooms) {
    const sender = sockets.find((item) => item.email === roomHost.email);
    const receiver = sockets.find((item) => item.email === target.email);
    if (!sender || !receiver) continue;

    const messageText = `Socket test message ${nowIso()} (${room.id})`;
    const sendStart = Date.now();
    sender.socket.emit('chat:message', { roomId: room.id, messageText });
    record({
      role: sender.email,
      action: 'socket.emit.chat:message',
      ok: true,
      durationMs: Date.now() - sendStart,
      meta: { roomId: room.id },
    });

    let receivedMessage = null;
    try {
      receivedMessage = await waitForEvent(receiver.socket, 'chat:message');
      record({
        role: receiver.email,
        action: 'socket.recv.chat:message',
        ok: true,
        payload: receivedMessage,
        meta: { roomId: room.id },
      });
    } catch (err) {
      record({
        role: receiver.email,
        action: 'socket.recv.chat:message',
        ok: false,
        error: err.message,
        meta: { roomId: room.id },
      });
    }

    receiver.socket.emit('chat:typing', { roomId: room.id, isTyping: true });
    await sleep(150);
    receiver.socket.emit('chat:typing', { roomId: room.id, isTyping: false });
    record({
      role: receiver.email,
      action: 'socket.emit.chat:typing',
      ok: true,
      meta: { roomId: room.id },
    });

    const messageId = receivedMessage?.id || receivedMessage?.messageId;
    receiver.socket.emit('chat:read', {
      roomId: room.id,
      ...(messageId ? { messageId } : {}),
    });
    record({
      role: receiver.email,
      action: 'socket.emit.chat:read',
      ok: true,
      meta: { roomId: room.id },
    });

    try {
      const readAck = await waitForEvent(sender.socket, 'chat:read');
      record({
        role: sender.email,
        action: 'socket.recv.chat:read',
        ok: true,
        payload: readAck,
        meta: { roomId: room.id },
      });
    } catch (err) {
      record({
        role: sender.email,
        action: 'socket.recv.chat:read',
        ok: false,
        error: err.message,
        meta: { roomId: room.id },
      });
    }
  }

  for (const item of sockets) {
    item.socket.disconnect();
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: nowIso(), results, events }, null, 2)
  );

  console.log(`✅ Socket test results saved to ${OUTPUT_PATH}`);
};

main().catch((err) => {
  record({ action: 'fatal', ok: false, error: err.message });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: nowIso(), results }, null, 2));
  console.error(`❌ Socket test failed: ${err.message}`);
  process.exit(1);
});
