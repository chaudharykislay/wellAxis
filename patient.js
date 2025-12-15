const API = 'http://localhost:3002/api';
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const authorized = !!token && role === 'Patient';

function showAuthBanner(text) {
  const banner = document.createElement('div');
  banner.textContent = text;
  banner.style.cssText = 'background:#fffbcc;color:#5c4b00;padding:12px;text-align:center;border-bottom:1px solid #e6d96d;';
  document.body.insertBefore(banner, document.body.firstChild);
}

// LocalStorage helpers
function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

if (!authorized) {
  showAuthBanner('Please log in as Patient to use this page.');
  document.querySelectorAll('button').forEach(b => b.disabled = true);
}

function api(path, method = 'GET', body) {
  if (!authorized) return Promise.resolve({ error: 'Unauthorized: login required' });
  return fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined
  }).then(r => r.json());
}

document.getElementById('logout').addEventListener('click', () => {
  sessionStorage.clear();
});

document.getElementById('patient-me').addEventListener('click', async () => {
  const out = await api('/patient/me');
  document.getElementById('patient-profile').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('patient-records').addEventListener('click', async () => {
  const out = await api('/patient/records');
  const localReports = lsGet('reports', []);
  const combined = { serverRecords: out, localReports };
  document.getElementById('patient-records-result').textContent = JSON.stringify(combined, null, 2);
});

document.getElementById('add-symptoms').addEventListener('click', async () => {
  const s = document.getElementById('symptoms').value;
  const out = await api('/patient/symptoms', 'POST', { symptoms: s.split(',').map(x => x.trim()).filter(Boolean) });
  document.getElementById('patient-actions-result').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('book-appt').addEventListener('click', async () => {
  const doctorId = document.getElementById('appt-doctor').value || null;
  const hospitalId = document.getElementById('appt-hospital').value || null;
  const out = await api('/patient/appointments', 'POST', { doctorId, hospitalId });
  // Mirror to localStorage for cross-dashboard demo
  const appts = lsGet('appointments', []);
  appts.push({ doctorId, hospitalId, requestedAt: new Date().toISOString() });
  lsSet('appointments', appts);
  document.getElementById('patient-actions-result').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('update-consent').addEventListener('click', async () => {
  const allowedIds = document.getElementById('allowed-ids').value.split(',').map(x => x.trim()).filter(Boolean);
  const out = await api('/patient/consents', 'PUT', { allowedIds });
  document.getElementById('patient-actions-result').textContent = JSON.stringify(out, null, 2);
});