
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});


const AUTH = {
  login:    '/auth/login',
  register: '/auth/register',
  logout:   '/auth/logout',
  me:       '/auth/me',
};

const readToken = (data) => data.token;
const readUser  = (data) => data.user;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });


const TOKEN_KEY = 'healthflow_token';

export const getToken   = () => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) Object.assign(config.headers, authHeader(token));
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) clearToken();
    return Promise.reject(err);
  }
);

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
    clearToken();          
  }
};

export const apiMe = async () => {
  const res = await api.get(AUTH.me);
  return readUser(res.data);
};

export const getPatients   = (search = '') => api.get('/patients', { params: { search } });
export const getPatient    = (id)          => api.get(`/patients/${id}`);
export const createPatient = (data)        => api.post('/patients', data);
export const updatePatient = (id, data)    => api.put(`/patients/${id}`, data);
export const deletePatient = (id)          => api.delete(`/patients/${id}`);
export const updateContact = (id, data)    => api.patch(`/patients/${id}/contact`, data);

export const getDepartments = () => api.get('/departments');

export const getDoctors        = ()   => api.get('/doctors');
export const getDoctor         = (id) => api.get(`/doctors/${id}`);
export const getDoctorSchedule = (id) => api.get(`/doctors/${id}/schedule`);
export const getFullSchedule    = (id) => api.get(`/doctors/${id}/schedule`, { params: { all: true } });
export const addScheduleSlot    = (id, data) => api.post(`/doctors/${id}/schedule`, data);
export const toggleScheduleSlot = (id, scheduleId, is_active) =>
  api.patch(`/doctors/${id}/schedule/${scheduleId}`, { is_active });
export const deleteScheduleSlot = (id, scheduleId) =>
  api.delete(`/doctors/${id}/schedule/${scheduleId}`);
export const createDoctor      = (data)     => api.post('/doctors', data);
export const updateDoctor      = (id, data) => api.put(`/doctors/${id}`, data);
export const deleteDoctor      = (id)       => api.delete(`/doctors/${id}`);

export const getAppointments  = (params = {}) => api.get('/appointments', { params });
export const getAppointment   = (id)          => api.get(`/appointments/${id}`);
export const bookAppointment  = (data)        => api.post('/appointments', data);
export const updateApptStatus = (id, status)  => api.patch(`/appointments/${id}/status`, { status });

export const getBills   = ()         => api.get('/billing');
export const getBill    = (id)       => api.get(`/billing/${id}`);
export const getDueBills = ()        => api.get('/billing/due');
export const createBill = (data)     => api.post('/billing', data);
export const addPayment = (id, data) => api.post(`/billing/${id}/payment`, data);

export const getAdmissions    = ()         => api.get('/admissions');
export const getAdmission     = (id)       => api.get(`/admissions/${id}`);
export const getAvailableRooms = ()        => api.get('/admissions/available-rooms');
export const admitPatient     = (data)     => api.post('/admissions', data);
export const dischargePatient = (id, data) => api.patch(`/admissions/${id}/discharge`, data);

export const getTestCatalog   = ()   => api.get('/labtests/catalog');
export const getPendingTests  = ()   => api.get('/labtests/pending');
export const getPatientTests  = (id) => api.get(`/labtests/patient/${id}`);
export const assignTest       = (data) => api.post('/labtests', data);
export const addTestResult    = (patientId, testId, testDate, result) =>
  api.patch(`/labtests/${patientId}/${testId}/${testDate}`, { result });

export const getMedicines = () => api.get('/medicines');
export const getLowStock  = () => api.get('/medicines/low-stock');

export const getPrescription        = (id) => api.get(`/prescriptions/${id}`);
export const getPatientPrescriptions = (id) => api.get(`/prescriptions/patient/${id}`);
export const createPrescription     = (data) => api.post('/prescriptions', data);

export default api;