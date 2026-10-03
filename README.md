# HealthFlow

Hospital management system — CSE 216 (Database Sessional) project.

PostgreSQL + Express + React. Raw SQL throughout, no ORM. Runs locally.

---

## What it does

Covers the full patient journey in three shapes:

- **Outpatient** — book an appointment, see a doctor, get a prescription, pay for the visit
- **Admission** — take a room, run up charges through the stay, settle one bill on discharge
- **Pharmacy** — fill a prescription at the hospital, or buy over the counter

Four roles see four different systems. All access rules are enforced on the server.

---

## Setup

### Requirements

- PostgreSQL 17+ with pgAdmin
- Node.js 22+ (LTS)

### 1. Database

Create a database called `healthflow`, then run these in pgAdmin's Query Tool
**in this order** — later files depend on earlier ones:

| # | File | What it creates |
|---|---|---|
| 1 | `db/schema.sql` | 15 core tables, constraints, indexes |
| 2 | `db/seed.sql` | Sample patients, doctors, rooms, medicines |
| 3 | `db/auth_schema.sql` | `app_user`, `auth_sessions`, demo logins |
| 4 | `db/Pharmacy.sql` | `dispense` table, stock trigger |
| 5 | `db/pharmacy_link.sql` | Links a dispense to its exact bill line |
| 6 | `db/opd.sql` | Over-the-counter sales, outpatient bill procedure |
| 7 | `db/functions.sql` | Computed-value functions |
| 8 | `db/triggers.sql` | Triggers and stored procedures |

> `db/schema.sql` starts with `DROP TABLE` — running it again wipes everything.
> If you do, re-run all eight files.

Check it worked:

```sql
SELECT COUNT(*) FROM patient;            -- 12
SELECT COUNT(*) FROM app_user;           -- 6
SELECT trigger_name FROM information_schema.triggers
  WHERE trigger_schema = 'public';       -- 4
SELECT proname FROM pg_proc
  WHERE proname LIKE 'fn_%' OR proname LIKE 'sp_%';
```

### 2. Backend

```bash
cd server
npm install
```

Create `server/.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD="your_password"
DB_NAME=healthflow
PORT=5000
JWT_SECRET=healthflow_dev_secret_2026
```

> Quote the password if it contains `#` or a space — dotenv treats `#`
> as the start of a comment and silently drops the rest.

```bash
npm run dev
```

Expect `Server running on http://localhost:5000` and `PostgreSQL connected`.

### 3. Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

> On Windows, if `npm install` reports "running scripts is disabled",
> switch the VS Code terminal to Command Prompt, or run once in PowerShell:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## Demo accounts

Password for all of them: `Pass@123`

| Email | Role |
|---|---|
| `admin@healthflow.com` | admin |
| `reception@healthflow.com` | receptionist |
| `rezaul.karim@healthflow.com` | doctor (Dr. Rezaul Karim) |
| `aminul.haque@healthflow.com` | doctor (Dr. Aminul Haque) |
| `rahim.uddin@mail.com` | patient (Rahim Uddin) |
| `fatema.khatun@mail.com` | patient (Fatema Khatun) |

The two patient accounts are useful together — signing in as one and asking
for the other's records returns 403.

---

## Roles

| | admin | receptionist | doctor | patient |
|---|---|---|---|---|
| Patients | full | register, edit | own patients only | own record |
| Doctors | full | view | view | — |
| Departments | full | — | — | — |
| Schedules | any doctor | — | own only | — |
| Appointments | full | book, cancel | own only | own, cancel |
| Admissions | full | admit, discharge | — | own |
| Rooms | full | status only | — | — |
| Prescriptions | full | — | write, own only | own |
| Lab tests | full | order, results | own orders only | own results |
| Medicines | full | restock | add to catalog | — |
| Pharmacy | full | dispense, sell | — | — |
| Billing | full | bill, take payment | — | own bills |
| Reports | full | — | — | — |

Hiding a menu item is presentation only. Every rule above is also checked in
`server/middleware/auth.js` and in each route, so hitting the API directly
with Postman gives the same 401 / 403.

---

## Project structure

```
healthflow/
├── db/                  all SQL — schema, seed, auth, triggers, functions
├── server/
│   ├── db.js            connection pool, query(), withTransaction()
│   ├── index.js         express app, route registration
│   ├── middleware/
│   │   └── auth.js      requireAuth, requireRole, requirePatientAccess
│   └── routes/          13 route modules — all SQL lives here
└── client/
    └── src/
        ├── api.js       every API call, token storage, interceptors
        ├── auth.jsx     logged-in user, role → menu mapping
        ├── App.jsx      login gate and sidebar
        └── pages/       15 screens
```

No SQL in the frontend. No `pg` import outside `server/db.js`.

---

## Design notes

**Weak entity.** `bill_item` has no identity without its bill. `item_no` is a
partial key, unique only inside one bill, so the primary key is
`(bill_id, item_no)` and the rows cascade when the bill is deleted.

**Relationship attributes.** `dosage`, `frequency` and `duration` live on
`presc_medicine`, not on `medicine` or `prescription` — the dose belongs to
the pairing, not to either side.

**Partial unique index.** `uq_room_active` allows one active admission per
room while keeping the room's full history:

```sql
CREATE UNIQUE INDEX uq_room_active ON admission(room_no)
  WHERE discharge_date IS NULL;
```

`uq_dispense_line` uses the same idea so a prescription line can be dispensed
once, while over-the-counter sales of the same medicine can repeat.

**Prescribing is not dispensing.** A prescription is an instruction; stock only
moves when the pharmacy hands the medicine over. The stock trigger fires on
`dispense`, not on `presc_medicine`, so a patient filling the prescription
somewhere else leaves the hospital's stock untouched.

**One stay, one bill.** The bill opens when the patient is admitted and
collects charges through the stay. On discharge the stored procedure adds the
room charge, lab tests and doctor fees to that same bill.

**Transactions.** Every insert, update and delete runs inside
`withTransaction` — `BEGIN`, `COMMIT`, `ROLLBACK` on failure.

**Parameterised queries.** Every value goes through `$1`, `$2`. No string
concatenation anywhere.

**Logout is real.** A login writes a row to `auth_sessions` and the token
carries its id. Logout deletes the row, so the old token fails on the next
request — the middleware checks the session exists, not just that the
signature is valid.

---

## Known limitations

- The database records income only. Salaries, purchase costs and utilities are
  not stored, so net profit cannot be derived — the reports show billed,
  collected and outstanding instead.
- A few endpoints are action-shaped rather than resource-shaped, for example
  `POST /billing/from-admission/:id`. A stricter REST reading would express
  these as filters or sub-resources.
- Reversing a dispense restores stock and removes the charge, but only while
  the bill is still unpaid. Once money has been taken it becomes a refund,
  which is out of scope.
- Tokens are kept in `localStorage`, which is exposed to XSS. An `httpOnly`
  cookie would be safer but needs CSRF protection to go with it.
