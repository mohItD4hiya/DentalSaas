# SmileCraft Dental Clinic

A dental clinic management demo tailored to Indian practices. It includes appointment scheduling, patient records, treatment tracking, INR billing, inventory, reports, and a clinic-data assistant.

## Features

- **Dashboard:** patient and appointment counts, pending treatments, monthly paid revenue, upcoming appointments, and low-stock alerts.
- **Appointments:** create appointments and update their status (Booked, Confirmed, Completed, or Cancelled).
- **Patient portal:** patients can request, reschedule, and cancel eligible appointments; opt in or out of a planned WhatsApp/SMS reminder 24 hours before appointments; view their visits, treatment history, clinical notes, and prescription PDFs; review invoice totals and print/save invoice PDFs; read general post-treatment guidance; and use the SmileCraft Assistant for navigation and general dental-care FAQs. Reminder delivery requires the clinic to configure MSG91 and approved messaging templates. The patient assistant responds locally and does not send patient records to Gemini. Emergency call and WhatsApp links can be configured with `VITE_CLINIC_PHONE`.
- **Patients:** manage patient names, ages, 10-digit phone numbers, and known health issues; open each patient's visit notebook to review or record visit dates, prescriptions, and clinical notes.
- **Patient visit notebooks:** keep visit dates, treatment details, prescriptions, and clinical notes together in each patient record.
- **Billing:** create itemized invoices in Indian rupees (INR), add multiple services with quantity and rate, optionally enter a GST rate per bill, record an insurer or Self Pay, update Unpaid/Paid status, and preview or print bills.
- **Inventory:** maintain item quantities and reorder thresholds; edit quantities directly or use **Use 1** to record consumption.
- **Reports:** view monthly revenue and treatment mix, plus an appointments bar chart filtered by date range and grouped by day, week, or month.
- **AI Assistant:** ask for a local list of patients with active follow-up dates, including follow-ups scheduled this week, clinic metrics, and general oral-health education. Follow-up names and dates are read directly from the clinic database and are never sent to Gemini. Voice questions use browser speech recognition where supported; transcripts are handled like typed questions. With a Gemini API key, the assistant can answer broader general-knowledge questions; without one, a limited rule-based assistant remains available. It does not diagnose or prescribe.

This is a starter/demo application, not a complete clinical or accounting system. Review its security, privacy, backup, and regulatory requirements before using it with real patient information.

## Contributors

- [mohItD4hiya](https://github.com/mohItD4hiya)

## Technology

- Frontend: React 18, Vite, Chart.js
- Backend: Node.js, Express, Mongoose
- Database: MongoDB (local MongoDB Community Server or MongoDB Atlas)
- Authentication: JWT

## Requirements

- Node.js 18 or newer and npm
- MongoDB running locally, or a MongoDB Atlas connection string
- Git is optional if you downloaded the project as an archive

## Project layout

```text
dentalsaas/
├── client/                 # React/Vite frontend
│   ├── src/
│   ├── index.html
│   └── package.json
├── server/                 # Express API and MongoDB models
│   ├── .env.example
│   ├── index.js
│   ├── models.js
│   ├── seed.js
│   └── package.json
└── README.md
```

## Local setup

### 1. Start MongoDB

For a local database, install MongoDB Community Server and make sure its service is running. The default connection is:

```text
mongodb://127.0.0.1:27017/dentalsaas
```

Alternatively, create a database in MongoDB Atlas and use its connection string in `server/.env`. URL-encode special characters in the database username or password.

### 2. Configure and install the backend

Run these commands from the project directory.

**Windows PowerShell**

```powershell
cd .\server
Copy-Item .env.example .env
npm install
```

**macOS/Linux (or Git Bash)**

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env` if needed:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/dentalsaas
JWT_SECRET=replace-this-with-a-long-random-secret
PORT=5000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

- Keep `MONGO_URI` pointed at the local database or replace it with the Atlas URI.
- Use a unique, long random value for `JWT_SECRET`; do not use the example value for a deployed app.
- `GEMINI_API_KEY` is optional. Create a key through [Google AI Studio](https://aistudio.google.com/app/apikey) and keep it private in `server/.env`; the server never sends it to the frontend.
- `GEMINI_MODEL` is optional. The default is `gemini-3.5-flash-lite`; use a model enabled for your AI Studio project. Free-tier availability, model access, rate limits, and terms depend on Google's current policy and your project.
- Clinic metric questions are answered locally. Gemini receives only other general questions; the integration sets `store: false` and does not send clinic stats or patient/appointment data. Do not include patient names, contact details, prescriptions, or other identifiable health information in questions. Review Google's current data-use terms before using the service.

### 3. Seed the demo data

In the `server` directory:

```bash
npm run seed
```

This creates the demo user and sample patients, appointments, treatments, invoices, and inventory items. **Seeding deletes all existing documents in these collections before recreating the sample data. Do not run it against a database containing data you need to keep.**

Demo login:

```text
Email:    dr.smith@dentalsaas.com
Password: smile123
```

Demo patient portal login:

```text
Email:    aarav.patient@dentalsaas.com
Password: patient123
```

Patients can also choose **Patient registration** on the sign-in page to create a patient account. New patient accounts are linked to a patient record and can access only their own appointments and patient records. Invoice PDF actions open a print dialog where the patient can print or choose **Save as PDF**.

### 4. Start the API

Keep the terminal in `server` and run:

```bash
npm start
```

The API listens at `http://localhost:5000` by default. Keep this terminal open.

### 5. Start the frontend

Open a second terminal in the project directory:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. During development, Vite forwards `/api` requests to `http://localhost:5000`.
To show the patient portal's emergency call and WhatsApp actions, optionally copy `client/.env.example` to `client/.env` and set `VITE_CLINIC_PHONE` to the public clinic phone number with its country code. Restart Vite after changing this value. This is public frontend configuration, not a secret.

## Useful commands

Run from the relevant subdirectory:

| Directory | Command | Purpose |
| --- | --- | --- |
| `server` | `npm start` | Start the Express API |
| `server` | `npm run seed` | Replace database contents with demo data |
| `client` | `npm run dev` | Start the Vite development server |
| `client` | `npm run build` | Create a production frontend build in `client/dist` |

## API overview

All routes other than login require a JWT. The frontend adds the token as a Bearer authorization header.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in; returns a token and user name |
| `POST` | `/api/auth/patient/register` | Register a patient account and patient record |
| `GET`, `POST` | `/api/patients` | List or add patients |
| `PUT`, `DELETE` | `/api/patients/:id` | Edit or remove a patient |
| `GET`, `POST` | `/api/patients/:id/visits` | List or record a patient's visit, prescription, and clinical notes |
| `GET`, `POST` | `/api/appointments` | List or book appointments |
| `PUT`, `DELETE` | `/api/appointments/:id` | Edit appointment details/status or remove an appointment |
| `GET`, `POST` | `/api/patient/appointments` | Patient-only: list the signed-in patient's requests or create a new request (always Booked pending staff confirmation) |
| `PATCH` | `/api/patient/appointments/:id` | Patient-only: reschedule or cancel their own pending/confirmed appointment |
| `GET` | `/api/patient/records` | Patient-only: list the signed-in patient's visits, treatments, prescriptions, and invoices |
| `GET`, `POST` | `/api/treatments` | List or add treatment records |
| `PUT`, `DELETE` | `/api/treatments/:id` | Edit or remove a treatment |
| `GET`, `POST` | `/api/invoices` | List or add invoices |
| `PUT`, `DELETE` | `/api/invoices/:id` | Edit invoice details/status or remove an invoice |
| `GET`, `POST` | `/api/inventory` | List or add inventory items |
| `PUT`, `DELETE` | `/api/inventory/:id` | Edit stock/item details or remove an item |
| `GET` | `/api/stats` | Dashboard and report summary data |
| `POST` | `/api/ai` | Ask the clinic assistant (`{ "q": "..." }`) |

Dates are stored as `YYYY-MM-DD` strings and appointment times as 24-hour `HH:mm` strings. Currency amounts are rupees. New invoices store the pre-tax subtotal, optional GST rate and amount, and the final total. The GST rate is blank/0% unless entered; confirm the applicable tax treatment with a qualified accountant before issuing real invoices. A printed bill uses the configured demo clinic name and does not yet include a clinic address, GSTIN, or other statutory invoice details. The demo seed includes a few example patient visits with sample notes and prescriptions. Existing treatment records still contribute to the dashboard's pending-treatment metric.

Clinic-wide records and doctor routes require a doctor account. Patient record and appointment routes are scoped to the signed-in patient's linked patient record. Older appointments, treatments, and invoices without a patient reference are included only when the exact patient name is unique. Patient booking and rescheduling requests are created as `Booked` (shown as Pending in the portal); a doctor/staff member must confirm them. Patients may reschedule or cancel only future appointments that are still Booked or Confirmed.

## Database notes

The server uses `MONGO_URI` from `server/.env`. If it is unset, it falls back to the local `dentalsaas` database. The collections are managed through Mongoose models in `server/models.js`.

The `mongodb-memory-server` development dependency can provide an in-memory MongoDB for development or tests, but the normal `npm start` command does not start it automatically. The standard run steps above require a separate local MongoDB instance or an Atlas database.

## Troubleshooting

- **MongoDB connection error:** confirm the MongoDB service is running and `MONGO_URI` is correct; ensure an Atlas network access rule permits your connection.
- **Login fails:** run `npm run seed` from `server` to recreate the demo account. This replaces all sample collections, so only do this on a disposable demo database.
- **Frontend cannot reach the API:** start the backend on port `5000`; check that the Vite proxy in `client/vite.config.js` points to the same host and port.
- **Port already in use:** choose another backend `PORT` in `server/.env` and update the Vite proxy in `client/vite.config.js`, or stop the process already using that port.
- **AI uses simple built-in replies:** configure a valid `GEMINI_API_KEY` in `server/.env` and restart the backend. If Gemini reports an error, check the key, configured model, project access, and current quota.

## Deployment notes

For deployment, use MongoDB Atlas or another secured MongoDB service, set production secrets through the hosting provider's environment configuration, and never expose `.env` or API keys in the frontend. Build the frontend with `npm run build` from `client`. The development Vite proxy is not a production API proxy; configure the production web server/hosting platform to route `/api` to the Express backend (or add a suitable API base URL/proxy configuration). Use HTTPS and review authentication, authorization, patient-data privacy, backups, and applicable Indian healthcare/data-protection requirements before production use.
