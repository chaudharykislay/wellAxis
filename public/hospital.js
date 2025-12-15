const API = 'http://localhost:3002/api';
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const authorized = !!token && role === 'Hospital';

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
  showAuthBanner('Please log in as Hospital to use this page.');
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

document.getElementById('hospital-upload-report').addEventListener('click', async () => {
  const medicalId = document.getElementById('rep-medicalId').value.trim();
  const type = document.getElementById('rep-type').value.trim();
  const reportText = document.getElementById('rep-content').value.trim();
  const out = await api('/hospital/reports', 'POST', { medicalId, type, report: { text: reportText } });
  // Mirror to localStorage for cross-dashboard demo
  const reports = lsGet('reports', []);
  reports.push({ medicalId, type, text: reportText, uploadedAt: new Date().toISOString() });
  lsSet('reports', reports);
  document.getElementById('hospital-actions-result').textContent = JSON.stringify(out, null, 2);
});