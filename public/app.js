const API = location.origin + '/api';
let token = null;
let role = null;

function showRoleFields() {
  const val = document.getElementById('reg-role').value;
  document.querySelectorAll('.role-field').forEach(el => el.style.display = 'none');
  if (val === 'Patient') document.getElementById('aadhaar-row').style.display = 'block';
  if (val === 'Hospital') {
    document.getElementById('hospital-row').style.display = 'block';
    document.getElementById('govreg-row').style.display = 'block';
    document.getElementById('license-row').style.display = 'block';
  }
  if (val === 'Doctor') {
    document.getElementById('doctor-row').style.display = 'block';
    document.getElementById('spec-row').style.display = 'block';
  }
}

document.getElementById('reg-role').addEventListener('change', showRoleFields);
showRoleFields();

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

function setLoginState(r, t) {
  sessionStorage.setItem('role', r);
  sessionStorage.setItem('token', t);
  const target = r === 'Patient' ? 'patient.html'
    : r === 'Doctor' ? 'doctor.html'
    : r === 'Hospital' ? 'hospital.html'
    : r === 'Admin' ? 'admin.html'
    : 'index.html';
  location.href = target;
}

// Register
document.getElementById('register-btn').addEventListener('click', async () => {
  const role = document.getElementById('reg-role').value;
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const aadhaar = document.getElementById('reg-aadhaar').value;
  const hospitalName = document.getElementById('reg-hospital-name').value;
  const govRegNo = document.getElementById('reg-govreg').value;
  const licenseNo = document.getElementById('reg-license').value;
  const doctorName = document.getElementById('reg-doctor-name').value;
  const specialization = document.getElementById('reg-spec').value;
  const out = await api('/register', 'POST', { role, username, password, aadhaar, hospitalName, govRegNo, licenseNo, doctorName, specialization });
  document.getElementById('register-result').textContent = JSON.stringify(out, null, 2);
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const out = await api('/login', 'POST', { username, password });
  document.getElementById('login-result').textContent = JSON.stringify(out, null, 2);
  if (out.token) setLoginState(out.role, out.token);
});

// Patient actions
document.getElementById('patient-me').addEventListener('click', async () => {
  const out = await api('/patient/me');
  document.getElementById('patient-profile').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('patient-records').addEventListener('click', async () => {
  const out = await api('/patient/records');
  document.getElementById('patient-records-result').textContent = JSON.stringify(out, null, 2);
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
  document.getElementById('patient-actions-result').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('update-consent').addEventListener('click', async () => {
  const allowedIds = document.getElementById('allowed-ids').value.split(',').map(x => x.trim()).filter(Boolean);
  const out = await api('/patient/consents', 'PUT', { allowedIds });
  document.getElementById('patient-actions-result').textContent = JSON.stringify(out, null, 2);
});

// Doctor actions
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

// Hospital actions
document.getElementById('hospital-upload-report').addEventListener('click', async () => {
  const medicalId = document.getElementById('rep-medicalId').value.trim();
  const type = document.getElementById('rep-type').value.trim();
  const reportText = document.getElementById('rep-content').value.trim();
  const out = await api('/hospital/reports', 'POST', { medicalId, type, report: { text: reportText } });
  document.getElementById('hospital-actions-result').textContent = JSON.stringify(out, null, 2);
});

// Admin actions
document.getElementById('admin-pending').addEventListener('click', async () => {
  const out = await api('/admin/pending');
  document.getElementById('admin-pending-result').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('admin-approve').addEventListener('click', async () => {
  const type = document.getElementById('approve-type').value.trim();
  const id = document.getElementById('approve-id').value.trim();
  const out = await api('/admin/approve', 'POST', { type, id });
  document.getElementById('admin-pending-result').textContent = JSON.stringify(out, null, 2);
});

document.getElementById('admin-audit').addEventListener('click', async () => {
  const out = await api('/admin/audit');
  document.getElementById('admin-audit-result').textContent = JSON.stringify(out, null, 2);
});