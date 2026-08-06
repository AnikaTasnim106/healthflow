# HealthFlow — Setup Guide

Hospital Management System | CSE 215 Database Project

---

## Ki lagbe

- **PostgreSQL 17+** (pgAdmin shoho) — https://www.postgresql.org/download/windows/
- **Node.js 24 LTS** — https://nodejs.org (LTS button)
- **Git** — https://git-scm.com/downloads

---

## Setup (ekbar korte hobe, ~20 min)

### 1. Repo clone

```bash
git clone <repo-url>
cd healthflow
```

### 2. Database banao

pgAdmin khulo → **Databases** e right-click → **Create → Database** → naam `healthflow` → Save.

Notun `healthflow` database ta **select koro**, tarpor **Tools → Query Tool**.

Query Tool er 📂 icon diye file load kore **F5** press koro, ei order e:

1. `db/schema.sql` — 15 ta table banabe
2. `db/seed.sql` — sample data dhukabe

Check koro kaj korse kina:

```sql
SELECT COUNT(*) FROM appointment;   -- 15 ashar kotha
SELECT COUNT(*) FROM patient;       -- 12
SELECT COUNT(*) FROM bill_item;     -- 27
```

### 3. Backend setup

```bash
cd server
npm install
```

Tarpor `.env.example` file ta **copy kore `.env` naam dao**, ar tomar postgres password bosao:

```
DB_PASSWORD=tomar_asol_password
```

⚠️ `.env` file ta git e uthbe na (`.gitignore` e deya ache). Prottek jon nijer computer e nijer `.env` banabe.

### 4. Server chalao

```bash
npm run dev
```

Terminal e eirokom ashle ✅ sob thik ache:

```
🚀 Server running on http://localhost:5000
✅ PostgreSQL connected — healthflow
```

Browser e `http://localhost:5000/api/patients` e gele 12 ta patient er JSON dekhbe.

---

## Folder structure

```
healthflow/
├── db/
│   ├── schema.sql          ✅ DDL — 15 tables
│   ├── seed.sql            ✅ sample data
│   ├── queries.sql         ⬜ TODO — 20 queries
│   └── triggers.sql        ⬜ TODO — triggers + procedures
│
├── server/
│   ├── db.js               ✅ PostgreSQL pool + query() + withTransaction()
│   ├── index.js            ✅ Express app
│   ├── .env                ⚠️ nijer banate hobe (git e nai)
│   ├── .env.example        ✅ template
│   └── routes/
│       ├── patients.js     ✅ FULL CRUD — ⭐ eta reference, dekhe likho
│       ├── doctors.js      🟡 partial
│       ├── appointments.js 🟡 partial
│       └── billing.js      🟡 partial
│
└── client/                 ⬜ TODO — React (Week 3-4)
```

---

## Route likhar niyom

`routes/patients.js` **puro complete** — baki gulo ei pattern e likho.

**3 ta rule:**

**1. Value always `$1, $2` diye pathabe** — string concat kore query banabe na, SQL injection hobe.

```js
// ✅
db.query('SELECT * FROM patient WHERE patient_id = $1', [id])

// ❌ kokhono na
db.query('SELECT * FROM patient WHERE patient_id = ' + id)
```

**2. Sob route `try/catch` er bhitor, error `next(err)` e pathabe.** `index.js` er error handler dhorbe.

**3. Ekadhik table ekshathe change hole `withTransaction` use korbe.** Example `billing.js` er POST route e ache — bill + bill_item ekshathe insert hoy, ekta fail korle dutoi rollback.

---

## Postgres error code cheat sheet

Route e `err.code` check kore user-friendly message dile marks bhalo pabe:

| Code | Ki hoyeche | Kokhon ashe |
|---|---|---|
| `23505` | UNIQUE violation | Same doctor er same slot e duibar appointment |
| `23503` | FK violation | Jar bill ache emon patient delete korte gele |
| `23514` | CHECK violation | Bhul blood group / gender / room type |
| `23502` | NOT NULL violation | Required field missing |

---

## Kaj bhag

| Anika | Partner |
|---|---|
| `db/queries.sql` | `server/routes/` |
| `db/triggers.sql` | `client/` |

**Eki file e dujon ekshathe hat dibo na.** Kaj shuru korar age group e bole nibo.

Daily:
```bash
git pull          # kaj shurur AGE
# ... kaj ...
git add .
git commit -m "ki korlam"
git push          # kaj sheshe
```

---

## Ekhono baki

- [ ] `db/queries.sql` — 20 ta query (join, aggregation, subquery, window function)
- [ ] `db/triggers.sql` — bill total auto-update, room status update, stock deduct
- [ ] `doctors.js`, `appointments.js`, `billing.js` — baki endpoint gulo
- [ ] React frontend
