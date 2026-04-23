const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { io } = require('socket.io-client');

dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const OUTPUT_PATH =
  process.env.SOCKET_TEST_OUTPUT || path.resolve(__dirname, 'output', 'socket_test_results.json');

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];

const record = (entry) => {
  results.push({ timestamp: nowIso(), ...entry });
};

const fetchJson = async (url, options = {}) => {
  const startedAt = Date.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    durationMs: Date.now() - startedAt,
    json,
    text,
  };
};

const extractToken = (resp) =>
  resp?.json?.data?.token || resp?.json?.data?.accessToken || resp?.json?.token || null;

const extractData = (resp) => resp?.json?.data || null;

const buildRegisterPayload = (email, password, fileId) => ({
  user: {
    username: email.split('@')[0].slice(0, 40),
    email,
    password,
    firstName: 'Socket',
    lastName: 'User',
  },
  company: {
    name: `Socket Co ${email.slice(0, 8)}`,
    description: 'Created by test_socket.js',
    documents: [{ fileId, docType: 'commercial-register', description: 'Socket doc' }],
  },
});

const registerActor = async (label, email, password) => {
  const uploadResp = await fetchJson(`${API_BASE}/auth/register/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: `${label}-registration.pdf`,
      fileType: 'application/pdf',
      fileSize: 4096,
    }),
  });

  record({
    role: label,
    action: 'register.upload-url',
    status: uploadResp.status,
    ok: uploadResp.ok,
  });
  if (!uploadResp.ok) throw new Error(`${label}: failed register upload-url`);

  const fileId = extractData(uploadResp)?.file?.id;
  const registerResp = await fetchJson(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRegisterPayload(email, password, fileId)),
  });

  record({
    role: label,
    action: 'register.create',
    status: registerResp.status,
    ok: registerResp.ok,
  });
  if (!registerResp.ok) throw new Error(`${label}: register failed (${registerResp.status})`);

  const token = extractToken(registerResp);
  if (!token) throw new Error(`${label}: missing auth token after registration`);

  const meResp = await fetchJson(`${API_BASE}/companies/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  record({ role: label, action: 'companies.me', status: meResp.status, ok: meResp.ok });
  if (!meResp.ok) throw new Error(`${label}: companies/me failed (${meResp.status})`);

  const company = extractData(meResp)?.company || extractData(meResp);
  const companyId = company?.id;
  if (!companyId) throw new Error(`${label}: missing company id`);

  return { label, email, token, companyId };
};

const waitForEvent = (socket, event, timeoutMs = 10000) =>
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

const connectSocket = async (actor) => {
  const socket = io(SOCKET_URL, {
    auth: { token: actor.token },
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: false,
  });

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

  const ready = await waitForEvent(socket, 'chat:ready', 10000);
  record({ role: actor.label, action: 'socket.connect', ok: true, ready });
  return socket;
};

const createRoom = async (owner, targetCompanyId) => {
  const resp = await fetchJson(`${API_BASE}/chats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${owner.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetCompanyId }),
  });

  record({ role: owner.label, action: 'chats.create', status: resp.status, ok: resp.ok });
  if (!resp.ok) throw new Error(`Create room failed: ${resp.status}`);

  const data = extractData(resp);
  return data?.id || data?.roomId;
};

const main = async () => {
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ts = Date.now();
  const password = `Password123!${ts}`;

  const actorA = await registerActor('socket_a', `v1.socket.a.${ts}@indeal.test`, password);
  const actorB = await registerActor('socket_b', `v1.socket.b.${ts}@indeal.test`, password);

  const roomId = await createRoom(actorA, actorB.companyId);

  const socketA = await connectSocket(actorA);
  const socketB = await connectSocket(actorB);

  const events = { [actorA.label]: [], [actorB.label]: [] };

  const capture = (label, event) => (payload) => {
    events[label].push({ event, payload, at: nowIso() });
  };

  socketA.on('chat:message', capture(actorA.label, 'chat:message'));
  socketA.on('chat:read', capture(actorA.label, 'chat:read'));
  socketA.on('chat:typing', capture(actorA.label, 'chat:typing'));

  socketB.on('chat:message', capture(actorB.label, 'chat:message'));
  socketB.on('chat:read', capture(actorB.label, 'chat:read'));
  socketB.on('chat:typing', capture(actorB.label, 'chat:typing'));

  const text = `socket message ${nowIso()}`;
  socketA.emit('chat:message', { roomId, messageText: text });
  record({ role: actorA.label, action: 'socket.emit.chat:message', ok: true, roomId });

  const received = await waitForEvent(socketB, 'chat:message', 10000);
  record({
    role: actorB.label,
    action: 'socket.recv.chat:message',
    ok: true,
    roomId,
    payload: received,
  });

  socketB.emit('chat:typing', { roomId, isTyping: true });
  await sleep(200);
  socketB.emit('chat:typing', { roomId, isTyping: false });
  record({ role: actorB.label, action: 'socket.emit.chat:typing', ok: true, roomId });

  const messageId = received?.id || received?.messageId;
  socketB.emit('chat:read', { roomId, ...(messageId ? { messageId } : {}) });
  record({ role: actorB.label, action: 'socket.emit.chat:read', ok: true, roomId });

  const readAck = await waitForEvent(socketA, 'chat:read', 10000);
  record({
    role: actorA.label,
    action: 'socket.recv.chat:read',
    ok: true,
    roomId,
    payload: readAck,
  });

  socketA.disconnect();
  socketB.disconnect();

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: nowIso(),
        meta: {
          scenario: 'v1_socket_flow',
          actorEmails: [actorA.email, actorB.email],
          roomId,
        },
        summary: {
          totalSteps: results.length,
          failures: results.filter((item) => item.ok === false).length,
        },
        results,
        events,
      },
      null,
      2
    )
  );

  console.log(`Socket test results saved to ${OUTPUT_PATH}`);
};

main().catch((err) => {
  record({ action: 'fatal', ok: false, error: err.message });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: nowIso(), results }, null, 2));
  console.error(`Socket test failed: ${err.message}`);
  process.exit(1);
});
