const API = 'http://localhost:3002/api';
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const authorized = !!token && role === 'Doctor';

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

if (!authorized) {
  showAuthBanner('Please log in as Doctor to use this page.');
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

document.getElementById('doctor-view-patient').addEventListener('click', async () => {
  const mId = document.getElementById('doctor-medicalId').value.trim();
  const reason = document.getElementById('doctor-emergency-reason').value.trim();
  const emergency = reason ? '?emergency=true&reason=' + encodeURIComponent(reason) : '';
  const out = await api('/doctor/patient/' + encodeURIComponent(mId) + emergency);
  document.getElementById('doctor-patient-view').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('doctor-save-prescription').addEventListener('click', async () => {
  const medicalId = document.getElementById('pr-medicalId').value.trim();
  const notes = document.getElementById('pr-notes').value.trim();
  const medicines = document.getElementById('pr-medicines').value.split(',').map(x => x.trim()).filter(Boolean);
  const out = await api('/doctor/prescriptions', 'POST', { medicalId, notes, medicines });
  document.getElementById('doctor-actions-result').textContent = JSON.stringify(out, null, 2);
});

// View appointments mirrored from localStorage by patient bookings
const viewApptsBtn = document.getElementById('doctor-view-appointments');
if (viewApptsBtn) {
  viewApptsBtn.addEventListener('click', () => {
    const appts = lsGet('appointments', []);
    document.getElementById('doctor-appointments').textContent = JSON.stringify(appts, null, 2);
  });
}