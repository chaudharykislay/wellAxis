// Home page logic: patient registration + role logins wired to backend
(function(){
  const API_BASE = 'http://localhost:3002/api';
  const API = {
    registerPatient: async (payload) => {
      const res = await fetch(API_BASE + '/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, role: 'Patient' })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    login: async (username, password) => {
      const res = await fetch(API_BASE + '/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  };

  function setLoginState(token, role){
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('role', role);
    switch(role){
      case 'Patient': window.location.href = 'patient.html'; break;
      case 'Doctor': window.location.href = 'doctor.html'; break;
      case 'Hospital': window.location.href = 'hospital.html'; break;
      case 'Admin': window.location.href = 'admin.html'; break;
      default: window.location.href = 'index.html';
    }
  }

  // Patient registration
  const regForm = document.getElementById('patient-register-form');
  const regResult = document.getElementById('patient-register-result');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      regResult.textContent = 'Registering patient...';
      const formData = new FormData(regForm);
      const payload = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        age: Number(formData.get('age')),
        gender: formData.get('gender'),
        address: formData.get('address')
      };
      try {
        const data = await API.registerPatient(payload);
        regResult.textContent = `Registered: ${JSON.stringify(data, null, 2)}`;
      } catch (err) {
        regResult.textContent = `Error: ${err.message}`;
      }
    });
  }

  // Patient login
  const patientLoginForm = document.getElementById('patient-login-form');
  const patientLoginResult = document.getElementById('patient-login-result');
  if (patientLoginForm) {
    patientLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      patientLoginResult.textContent = 'Logging in as patient...';
      const fd = new FormData(patientLoginForm);
      const username = fd.get('username');
      const password = fd.get('password');
      try {
        const data = await API.login(username, password);
        setLoginState(data.token, data.role);
      } catch (err) {
        patientLoginResult.textContent = `Error: ${err.message}`;
      }
    });
  }

  // Doctor login
  const doctorLoginForm = document.getElementById('doctor-login-form');
  const doctorLoginResult = document.getElementById('doctor-login-result');
  if (doctorLoginForm) {
    doctorLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      doctorLoginResult.textContent = 'Logging in as doctor...';
      const fd = new FormData(doctorLoginForm);
      const username = fd.get('username');
      const password = fd.get('password');
      try {
        const data = await API.login(username, password);
        setLoginState(data.token, data.role);
      } catch (err) {
        doctorLoginResult.textContent = `Error: ${err.message}`;
      }
    });
  }

  // Hospital login
  const hospitalLoginForm = document.getElementById('hospital-login-form');
  const hospitalLoginResult = document.getElementById('hospital-login-result');
  if (hospitalLoginForm) {
    hospitalLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hospitalLoginResult.textContent = 'Logging in as hospital...';
      const fd = new FormData(hospitalLoginForm);
      const username = fd.get('username');
      const password = fd.get('password');
      try {
        const data = await API.login(username, password);
        setLoginState(data.token, data.role);
      } catch (err) {
        hospitalLoginResult.textContent = `Error: ${err.message}`;
      }
    });
  }
})();