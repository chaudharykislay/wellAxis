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

// Helper to support new/old IDs after UI refresh
const getEl = (a, b) => document.getElementById(a) || document.getElementById(b);
const getOut = (...ids) => ids.map(id => document.getElementById(id)).find(Boolean);

const logoutEl = document.getElementById('logout');
if (logoutEl) {
  logoutEl.addEventListener('click', () => {
    sessionStorage.clear();
  });
}

const pendingBtn = getEl('admin-view-pending', 'admin-pending');
if (pendingBtn) {
  pendingBtn.addEventListener('click', async () => {
    const out = await api('/admin/pending', 'GET');
    const outEl = getOut('admin-pending', 'admin-pending-result', 'admin-output');
    if (outEl) outEl.textContent = JSON.stringify(out, null, 2);
  });
}

const approveBtn = document.getElementById('admin-approve');
if (approveBtn) {
  approveBtn.addEventListener('click', async () => {
    const idEl = getEl('admin-approve-id', 'approve-id');
    const typeEl = document.getElementById('approve-type');
    const id = idEl ? idEl.value.trim() : '';
    let type = typeEl ? typeEl.value.trim() : (id.startsWith('DOC') ? 'Doctor' : id.startsWith('HOSP') ? 'Hospital' : '');
    const outEl = getOut('admin-actions-result', 'admin-pending-result', 'admin-output');
    if (!id || !type) {
      if (outEl) outEl.textContent = JSON.stringify({ error: 'Provide type (Doctor/Hospital) or enter an ID starting with DOC/HOSP.' }, null, 2);
      return;
    }
    const out = await api('/admin/approve', 'POST', { type, id });
    if (outEl) outEl.textContent = JSON.stringify(out, null, 2);
  });
}

const logsBtn = getEl('admin-view-logs', 'admin-audit');
if (logsBtn) {
  logsBtn.addEventListener('click', async () => {
    const out = await api('/admin/audit', 'GET');
    const outEl = getOut('admin-logs', 'admin-audit-result', 'admin-output');
    if (outEl) outEl.textContent = JSON.stringify(out, null, 2);
  });
}