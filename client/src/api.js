// ============================================================
//  api.js — backend er sathe kotha bolar ek matro jayga
//  Kono component e direct axios import korbe na, ekhan theke nibe.
// ============================================================

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// ============================================================
//  ⚙️  ADJUST HERE  —  backend er auth ready hole SHUDHU EI
//     BLOCK TA palte hobe. Onno kono file e hat dite hobe na.
// ============================================================

// 1) Endpoint er path
const AUTH = {
  login:    '/auth/login',
  register: '/auth/register',
  logout:   '/auth/logout',
  me:       '/auth/me',
};

// 2) Login response theke token ar user kivabe ber korbo.
//    Backend jodi { token, user } pathay — ei duita thik ache.
//    Cookie use korle readToken ke () => null kore dao ar
//    api.create e { withCredentials: true } add koro.
const readToken = (data) => data.token;
const readUser  = (data) => data.user;

// 3) Protected request e header kivabe jabe
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ============================================================

const TOKEN_KEY = 'healthflow_token';

export const getToken   = () => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Protita request e token ta apni-apni juḱte jay
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) Object.assign(config.headers, authHeader(token));
  return config;
});

// 401 ashle token ta purano/revoked — mucche dei
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) clearToken();
    return Promise.reject(err);
  }
);

// ---------- AUTH ----------
export const apiLogin = async (email, password) => {
  const res = await api.post(AUTH.login, { email, password });
  const token = readToken(res.data);
  if (token) setToken(token);
  return readUser(res.data);
};

export const apiRegister = async (payload) => {
  const res = await api.post(AUTH.register, payload);
  return res.data;
};

export const apiLogout = async () => {
  try {
    await api.post(AUTH.logout);
  } finally {
    clearToken();          // server fail korleo local token muchi
  }
};

export const apiMe = async () => {
  const res = await api.get(AUTH.me);
  return readUser(res.data);
};

// ---------- PATIENTS ----------
export const getPatients   = (search = '') => api.get('/patients', { params: { search } });
export const getPatient    = (id)          => api.get(`/patients/${id}`);
export const createPatient = (data)        => api.post('/patients', data);
export const updatePatient = (id, data)    => api.put(`/patients/${id}`, data);
export const deletePatient = (id)          => api.delete(`/patients/${id}`);

// ---------- DEPARTMENTS ----------
export const getDepartments = () => api.get('/departments');

// ---------- DOCTORS ----------
export const getDoctors        = ()   => api.get('/doctors');
export const getDoctor         = (id) => api.get(`/doctors/${id}`);
export const getDoctorSchedule = (id) => api.get(`/doctors/${id}/schedule`);
export const createDoctor      = (data)     => api.post('/doctors', data);
export const updateDoctor      = (id, data) => api.put(`/doctors/${id}`, data);
export const deleteDoctor      = (id)       => api.delete(`/doctors/${id}`);

// ---------- APPOINTMENTS ----------
export const getAppointments  = (params = {}) => api.get('/appointments', { params });
export const getAppointment   = (id)          => api.get(`/appointments/${id}`);
export const bookAppointment  = (data)        => api.post('/appointments', data);
export const updateApptStatus = (id, status)  => api.patch(`/appointments/${id}/status`, { status });

// ---------- BILLING ----------
export const getBills   = ()         => api.get('/billing');
export const getBill    = (id)       => api.get(`/billing/${id}`);
export const getDueBills = ()        => api.get('/billing/due');
export const createBill = (data)     => api.post('/billing', data);
export const addPayment = (id, data) => api.post(`/billing/${id}/payment`, data);

// ---------- ADMISSIONS ----------
export const getAdmissions    = ()         => api.get('/admissions');
export const getAdmission     = (id)       => api.get(`/admissions/${id}`);
export const getAvailableRooms = ()        => api.get('/admissions/available-rooms');
export const admitPatient     = (data)     => api.post('/admissions', data);
export const dischargePatient = (id, data) => api.patch(`/admissions/${id}/discharge`, data);

// ---------- LAB TESTS ----------
export const getTestCatalog   = ()   => api.get('/labtests/catalog');
export const getPendingTests  = ()   => api.get('/labtests/pending');
export const getPatientTests  = (id) => api.get(`/labtests/patient/${id}`);
export const assignTest       = (data) => api.post('/labtests', data);
export const addTestResult    = (patientId, testId, testDate, result) =>
  api.patch(`/labtests/${patientId}/${testId}/${testDate}`, { result });

// ---------- MEDICINES ----------
export const getMedicines = () => api.get('/medicines');
export const getLowStock  = () => api.get('/medicines/low-stock');

// ---------- PRESCRIPTIONS ----------
export const getPrescription        = (id) => api.get(`/prescriptions/${id}`);
export const getPatientPrescriptions = (id) => api.get(`/prescriptions/patient/${id}`);
export const createPrescription     = (data) => api.post('/prescriptions', data);

export default api;