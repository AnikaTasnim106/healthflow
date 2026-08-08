# HealthFlow Backend - Setup Guide

## ১. PostgreSQL এ ডাটাবেজ বানাও
```bash
psql -U postgres
CREATE DATABASE healthflow;
\q
```

## ২. Schema রান করো
```bash
psql -U postgres -d healthflow -f schema_postgres.sql
```

## ৩. Dependencies ইনস্টল করো
```bash
cd healthflow-backend
npm install
```

## ৪. Environment variable সেট করো
`.env.example` ফাইলটাকে `.env` নামে কপি করো, তারপর নিজের PostgreSQL password/credential বসাও:
```bash
cp .env.example .env
```

## ৫. সার্ভার চালাও
```bash
npm run dev
```
সার্ভার চালু হলে টার্মিনালে দেখবে: `🚀 Server running on http://localhost:5000`

## ৬. টেস্ট করো (Postman / Thunder Client দিয়ে)
- `GET http://localhost:5000/api/patients` → সব patient দেখাবে (প্রথমে খালি array আসবে, ডাটা নাই এখনো)
- `POST http://localhost:5000/api/patients` → body তে JSON দিয়ে নতুন patient add করো:
```json
{
  "name": "Rahim Uddin",
  "address": "Dhaka",
  "dob": "1995-05-10",
  "gender": "Male",
  "blood_group": "B+",
  "phone": "01700000000"
}
```
- `GET http://localhost:5000/api/patients/1` → id দিয়ে একজন patient দেখাবে
- `PUT http://localhost:5000/api/patients/1` → update করবে
- `DELETE http://localhost:5000/api/patients/1` → delete করবে

## এরপর কী করবে (Step by step, সিনিয়রের এডভাইস অনুযায়ী)
এই Patient module-টা একটা **টেমপ্লেট**। এখন একই প্যাটার্নে বাকি entity গুলোর জন্য controller + route বানাও:
1. `controllers/doctorController.js` + `routes/doctorRoutes.js`
2. `controllers/appointmentController.js` + `routes/appointmentRoutes.js`
3. `controllers/billController.js` + `routes/billRoutes.js`
... ইত্যাদি

প্রতিটার জন্য `server.js`-এ নতুন route line যোগ করবে:
```js
const doctorRoutes = require('./routes/doctorRoutes');
app.use('/api/doctors', doctorRoutes);
```

একটা একটা করে module বানাও, সাথে সাথে Postman দিয়ে টেস্ট করো — পুরোটা একসাথে করতে যেও না।
