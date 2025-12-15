const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Basic configuration
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_super_secret_change_me';
const ENC_KEY = crypto.createHash('sha256').update(process.env.MEDDATA_KEY || 'dev_meddata_key_change_me').digest(); // 32 bytes

// Utility: read/write DB
function loadDB() {
  if (!fs.existsSync(DATA_PATH)) {
    const initial = {
      users: [],
      patients: [],
      doctors: [],
      hospitals: [],
      records: [],
      prescriptions: [],
      appointments: [],
      consents: [],
      audits: []
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}
function saveDB(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

// Password hashing (scrypt)
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(key, derived);
}

// Minimal JWT (HS256)
function base64url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
function signJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}
function verifyJWT(token) {
  try {
    const [headerB64, payloadB64, sig] = token.split('.');
    const data = `${headerB64}.${payloadB64}`;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Encryption helpers (AES-256-GCM)
function encryptJSON(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: ciphertext.toString('hex') };
}
function decryptJSON(enc) {
  const iv = Buffer.from(enc.iv, 'hex');
  const tag = Buffer.from(enc.tag, 'hex');
  const data = Buffer.from(enc.data, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString('utf-8'));
}

// Helpers
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
function notFound(res) { json(res, 404, { error: 'Not Found' }); }
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}
function serveStatic(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = u.pathname;
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return notFound(res);
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
  fs.readFile(filePath, (err, content) => {
    if (err) return notFound(res);
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

// ID generators
function genMedicalId() {
  const y = new Date().getFullYear();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MID-${y}-${rand}`;
}
function genId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// Authorization helpers
function requireAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return verifyJWT(token);
}
function hasConsent(db, patientMedicalId, actorId) {
  const consent = db.consents.find(c => c.medicalId === patientMedicalId);
  return consent ? (consent.allowedIds || []).includes(actorId) : false;
}
function logAudit(db, entry) {
  db.audits.push({ id: genId('AUD'), time: Date.now(), ...entry });
}

// Seed admin and sample data if missing
(function initSeed() {
  const db = loadDB();
  let changed = false;
  if (!db.users.find(u => u.role === 'Admin')) {
    db.users.push({ id: genId('USR'), role: 'Admin', username: 'admin', password: hashPassword('admin123') });
    changed = true;
  }
  if (db.hospitals.length === 0) {
    const hUserId = genId('USR');
    db.users.push({ id: hUserId, role: 'Hospital', username: 'citycare', password: hashPassword('hospital123') });
    db.hospitals.push({ userId: hUserId, hospitalId: genId('HOSP'), name: 'CityCare Hospital', govRegNo: 'MOCKREG', licenseNo: 'MOCKLIC', status: 'Pending' });
    changed = true;
  }
  if (db.doctors.length === 0) {
    const dUserId = genId('USR');
    db.users.push({ id: dUserId, role: 'Doctor', username: 'drrao', password: hashPassword('doctor123') });
    db.doctors.push({ userId: dUserId, doctorId: genId('DOC'), name: 'Dr. Rao', specialization: 'Cardiology', status: 'Pending', favorites: [] });
    changed = true;
  }
  if (db.patients.length === 0) {
    const pUserId = genId('USR');
    db.users.push({ id: pUserId, role: 'Patient', username: 'john', password: hashPassword('patient123') });
    const medicalId = genMedicalId();
    db.patients.push({ userId: pUserId, medicalId, aadhaar: 'MOCK', verified: true, profile: { allergies: ['Peanuts'], vaccinations: ['COVID-19'], surgeries: [], notes: [] } });
    db.consents.push({ medicalId, allowedIds: [] });
    changed = true;
  }
  if (changed) saveDB(db);
})();

// Router
const server = http.createServer(async (req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    });
    return res.end();
  }

  // Static files
  if (!req.url.startsWith('/api/')) {
    return serveStatic(req, res);
  }

  const db = loadDB();

  // Auth
  if (req.method === 'POST' && req.url === '/api/register') {
    const body = await parseBody(req);
    const { role, username, password, aadhaar, govRegNo, licenseNo, hospitalName, doctorName, specialization } = body;
    if (!role || !username || !password) return json(res, 400, { error: 'Missing fields' });
    if (db.users.find(u => u.username === username)) return json(res, 400, { error: 'Username exists' });

    const userId = genId('USR');
    const common = { id: userId, role, username, password: hashPassword(password) };
    db.users.push(common);

    if (role === 'Patient') {
      const medicalId = genMedicalId();
      db.patients.push({ userId, medicalId, aadhaar: aadhaar || 'MOCK', verified: true, profile: { allergies: [], vaccinations: [], surgeries: [], notes: [] } });
      db.consents.push({ medicalId, allowedIds: [] });
      saveDB(db);
      return json(res, 201, { message: 'Registered patient', medicalId });
    }
    if (role === 'Hospital') {
      db.hospitals.push({ userId, hospitalId: genId('HOSP'), name: hospitalName || username, govRegNo: govRegNo || 'MOCK', licenseNo: licenseNo || 'MOCK', status: 'Pending' });
      saveDB(db);
      return json(res, 201, { message: 'Registered hospital (pending verification)' });
    }
    if (role === 'Doctor') {
      db.doctors.push({ userId, doctorId: genId('DOC'), name: doctorName || username, specialization: specialization || 'General', status: 'Pending', favorites: [] });
      saveDB(db);
      return json(res, 201, { message: 'Registered doctor (pending verification)' });
    }
    if (role === 'Admin') {
      saveDB(db);
      return json(res, 201, { message: 'Registered admin' });
    }
    return json(res, 400, { error: 'Invalid role' });
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await parseBody(req);
    const { username, password } = body;
    const user = db.users.find(u => u.username === username);
    if (!user || !verifyPassword(password, user.password)) return json(res, 401, { error: 'Invalid credentials' });
    // Additional verification status constraints
    if (user.role === 'Doctor') {
      const d = db.doctors.find(x => x.userId === user.id);
      if (!d || d.status !== 'Active') return json(res, 403, { error: 'Doctor not verified' });
    }
    if (user.role === 'Hospital') {
      const h = db.hospitals.find(x => x.userId === user.id);
      if (!h || h.status !== 'Active') return json(res, 403, { error: 'Hospital not verified' });
    }
    const payload = { sub: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 8 };
    const token = signJWT(payload);
    return json(res, 200, { token, role: user.role });
  }

  // Auth required below
  const auth = requireAuth(req);
  if (!auth) return json(res, 401, { error: 'Unauthorized' });

  // Patient: me
  if (req.method === 'GET' && req.url === '/api/patient/me') {
    if (auth.role !== 'Patient') return json(res, 403, { error: 'Forbidden' });
    const p = db.patients.find(x => x.userId === auth.sub);
    return json(res, 200, { patient: p });
  }

  // Patient: records
  if (req.method === 'GET' && req.url === '/api/patient/records') {
    if (auth.role !== 'Patient') return json(res, 403, { error: 'Forbidden' });
    const p = db.patients.find(x => x.userId === auth.sub);
    const recs = db.records.filter(r => r.medicalId === p.medicalId).map(r => ({ type: r.type, data: decryptJSON(r.encData) }));
    const pres = db.prescriptions.filter(pr => pr.medicalId === p.medicalId);
    return json(res, 200, { medicalId: p.medicalId, records: recs, prescriptions: pres });
  }

  // Patient: add symptoms
  if (req.method === 'POST' && req.url === '/api/patient/symptoms') {
    if (auth.role !== 'Patient') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const p = db.patients.find(x => x.userId === auth.sub);
    const record = { id: genId('REC'), medicalId: p.medicalId, type: 'symptoms', encData: encryptJSON({ symptoms: body.symptoms || [], createdAt: Date.now() }) };
    db.records.push(record);
    logAudit(db, { actorId: auth.sub, action: 'CREATE_SYMPTOMS', medicalId: p.medicalId });
    saveDB(db);
    return json(res, 201, { message: 'Symptoms added' });
  }

  // Patient: book appointment
  if (req.method === 'POST' && req.url === '/api/patient/appointments') {
    if (auth.role !== 'Patient') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const p = db.patients.find(x => x.userId === auth.sub);
    const appt = { id: genId('APT'), medicalId: p.medicalId, doctorId: body.doctorId || null, hospitalId: body.hospitalId || null, time: body.time || Date.now(), status: 'Booked' };
    db.appointments.push(appt);
    logAudit(db, { actorId: auth.sub, action: 'BOOK_APPOINTMENT', medicalId: p.medicalId });
    saveDB(db);
    return json(res, 201, { message: 'Appointment booked', appointmentId: appt.id });
  }

  // Patient: consents
  if (req.method === 'PUT' && req.url === '/api/patient/consents') {
    if (auth.role !== 'Patient') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const p = db.patients.find(x => x.userId === auth.sub);
    const c = db.consents.find(c => c.medicalId === p.medicalId);
    c.allowedIds = Array.isArray(body.allowedIds) ? body.allowedIds : [];
    logAudit(db, { actorId: auth.sub, action: 'UPDATE_CONSENT', medicalId: p.medicalId });
    saveDB(db);
    return json(res, 200, { message: 'Consent updated', allowedIds: c.allowedIds });
  }

  // Doctor: view patient
  if (req.method === 'GET' && req.url.startsWith('/api/doctor/patient/')) {
    if (auth.role !== 'Doctor') return json(res, 403, { error: 'Forbidden' });
    const doctor = db.doctors.find(d => d.userId === auth.sub);
    const medicalId = decodeURIComponent(req.url.split('/').pop());
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const emergency = urlObj.searchParams.get('emergency') === 'true';
    const reason = urlObj.searchParams.get('reason') || '';

    const allowed = hasConsent(db, medicalId, doctor.doctorId);
    if (!allowed && !emergency) return json(res, 403, { error: 'No consent' });

    const recs = db.records.filter(r => r.medicalId === medicalId).map(r => ({ type: r.type, data: decryptJSON(r.encData) }));
    const pres = db.prescriptions.filter(pr => pr.medicalId === medicalId);
    logAudit(db, { actorId: doctor.doctorId, action: emergency ? 'EMERGENCY_VIEW' : 'VIEW_PATIENT', medicalId, reason });
    saveDB(db);
    return json(res, 200, { medicalId, records: recs, prescriptions: pres });
  }

  // Doctor: create prescription
  if (req.method === 'POST' && req.url === '/api/doctor/prescriptions') {
    if (auth.role !== 'Doctor') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const doctor = db.doctors.find(d => d.userId === auth.sub);
    const medicalId = body.medicalId;
    const allowed = hasConsent(db, medicalId, doctor.doctorId);
    if (!allowed) return json(res, 403, { error: 'No consent' });
    const pr = { id: genId('PRC'), medicalId, doctorId: doctor.doctorId, createdAt: Date.now(), notes: body.notes || '', medicines: body.medicines || [] };
    db.prescriptions.push(pr);
    logAudit(db, { actorId: doctor.doctorId, action: 'CREATE_PRESCRIPTION', medicalId });
    saveDB(db);
    return json(res, 201, { message: 'Prescription saved' });
  }

  // Hospital: upload report
  if (req.method === 'POST' && req.url === '/api/hospital/reports') {
    if (auth.role !== 'Hospital') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const hospital = db.hospitals.find(h => h.userId === auth.sub);
    const medicalId = body.medicalId;
    const allowed = hasConsent(db, medicalId, hospital.hospitalId);
    if (!allowed) return json(res, 403, { error: 'No consent' });
    const record = { id: genId('REC'), medicalId, type: body.type || 'report', encData: encryptJSON({ report: body.report || {}, uploadedBy: hospital.hospitalId, createdAt: Date.now() }) };
    db.records.push(record);
    logAudit(db, { actorId: hospital.hospitalId, action: 'UPLOAD_REPORT', medicalId });
    saveDB(db);
    return json(res, 201, { message: 'Report uploaded' });
  }

  // Admin: list pending
  if (req.method === 'GET' && req.url === '/api/admin/pending') {
    if (auth.role !== 'Admin') return json(res, 403, { error: 'Forbidden' });
    const pendingDoctors = db.doctors.filter(d => d.status === 'Pending');
    const pendingHospitals = db.hospitals.filter(h => h.status === 'Pending');
    return json(res, 200, { pendingDoctors, pendingHospitals });
  }

  // Admin: approve entity
  if (req.method === 'POST' && req.url === '/api/admin/approve') {
    if (auth.role !== 'Admin') return json(res, 403, { error: 'Forbidden' });
    const body = await parseBody(req);
    const { type, id } = body; // type: 'Doctor' or 'Hospital', id: doctorId/hospitalId
    if (type === 'Doctor') {
      const d = db.doctors.find(x => x.doctorId === id);
      if (!d) return json(res, 404, { error: 'Doctor not found' });
      d.status = 'Active';
      saveDB(db);
      return json(res, 200, { message: 'Doctor approved' });
    }
    if (type === 'Hospital') {
      const h = db.hospitals.find(x => x.hospitalId === id);
      if (!h) return json(res, 404, { error: 'Hospital not found' });
      h.status = 'Active';
      saveDB(db);
      return json(res, 200, { message: 'Hospital approved' });
    }
    return json(res, 400, { error: 'Invalid type' });
  }

  // Admin: audit logs
  if (req.method === 'GET' && req.url === '/api/admin/audit') {
    if (auth.role !== 'Admin') return json(res, 403, { error: 'Forbidden' });
    return json(res, 200, { audits: db.audits });
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});