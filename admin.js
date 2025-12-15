const API = 'http://localhost:3002/api';
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const authorized = !!token && role === 'Admin';

function showAuthBanner(text) {
  const banner = document.createElement('div');
  banner.textContent = text;
  banner.style.cssText = 'background:#fffbcc;color:#5c4b00;padding:12px;text-align:center;border-bottom:1px solid #e6d96d;';
  document.body.insertBefore(banner, document.body.firstChild);
}

if (!authorized) {
  showAuthBanner('Please log in as Admin to use this page.');
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

document.getElementById('admin-pending').addEventListener('click', async () => {
  const out = await api('/admin/pending', 'GET');
  document.getElementById('admin-output').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('admin-approve').addEventListener('click', async () => {
  const type = document.getElementById('approve-type').value.trim();
  const entityId = document.getElementById('approve-id').value.trim();
  const out = await api('/admin/approve', 'POST', { type, entityId });
  document.getElementById('admin-output').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('admin-audit').addEventListener('click', async () => {
  const out = await api('/admin/audits', 'GET');
  document.getElementById('admin-output').textContent = JSON.stringify(out, null, 2);
});