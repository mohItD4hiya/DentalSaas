# SmileCraft Dental Clinic

A dental clinic management demo tailored to Indian practices. It includes appointment scheduling, patient records, treatment tracking, INR billing, inventory, reports, and a clinic-data assistant.

## Features

- **Dashboard:** patient and appointment counts, pending treatments, monthly paid revenue, upcoming appointments, and low-stock alerts.
- **Appointments:** create appointments and update their status (Booked, Confirmed, Completed, or Cancelled).
- **Patients:** manage patient names, ages, phone numbers, and medical history.
- **Treatments:** record procedures, clinical notes, follow-up dates, and Pending/Done status.
- **Billing:** create invoices in Indian rupees (INR), record an insurer or Self Pay, and update Unpaid/Paid status.
- **Inventory:** maintain item quantities and reorder thresholds; edit quantities directly or use **Use 1** to record consumption.
- **Reports:** view monthly revenue and treatment mix.
- **AI Assistant:** ask about clinic schedule, revenue, pending treatments, and low stock. It works with built-in rule-based responses; an Anthropic API key enables Claude responses.

This is a starter/demo application, not a complete clinical or accounting system. Review its security, privacy, backup, and regulatory requirements before using it with real patient information.

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
ANTHROPIC_API_KEY=
```

- Keep `MONGO_URI` pointed at the local database or replace it with the Atlas URI.
- Use a unique, long random value for `JWT_SECRET`; do not use the example value for a deployed app.
- `ANTHROPIC_API_KEY` is optional. Leave it blank to use the built-in assistant.

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
| `GET`, `POST` | `/api/patients` | List or add patients |
| `PUT`, `DELETE` | `/api/patients/:id` | Edit or remove a patient |
| `GET`, `POST` | `/api/appointments` | List or book appointments |
| `PUT`, `DELETE` | `/api/appointments/:id` | Edit appointment details/status or remove an appointment |
| `GET`, `POST` | `/api/treatments` | List or add treatment records |
| `PUT`, `DELETE` | `/api/treatments/:id` | Edit or remove a treatment |
| `GET`, `POST` | `/api/invoices` | List or add invoices |
| `PUT`, `DELETE` | `/api/invoices/:id` | Edit invoice details/status or remove an invoice |
| `GET`, `POST` | `/api/inventory` | List or add inventory items |
| `PUT`, `DELETE` | `/api/inventory/:id` | Edit stock/item details or remove an item |
| `GET` | `/api/stats` | Dashboard and report summary data |
| `POST` | `/api/ai` | Ask the clinic assistant (`{ "q": "..." }`) |

Dates are stored as `YYYY-MM-DD` strings and appointment times as 24-hour `HH:mm` strings. Currency amounts are rupees.

## Database notes

The server uses `MONGO_URI` from `server/.env`. If it is unset, it falls back to the local `dentalsaas` database. The collections are managed through Mongoose models in `server/models.js`.

The `mongodb-memory-server` development dependency can provide an in-memory MongoDB for development or tests, but the normal `npm start` command does not start it automatically. The standard run steps above require a separate local MongoDB instance or an Atlas database.

## Troubleshooting

- **MongoDB connection error:** confirm the MongoDB service is running and `MONGO_URI` is correct; ensure an Atlas network access rule permits your connection.
- **Login fails:** run `npm run seed` from `server` to recreate the demo account. This replaces all sample collections, so only do this on a disposable demo database.
- **Frontend cannot reach the API:** start the backend on port `5000`; check that the Vite proxy in `client/vite.config.js` points to the same host and port.
- **Port already in use:** choose another backend `PORT` in `server/.env` and update the Vite proxy in `client/vite.config.js`, or stop the process already using that port.
- **AI uses simple built-in replies:** configure a valid `ANTHROPIC_API_KEY` in `server/.env` and restart the backend to enable the optional Claude integration.

## Deployment notes

For deployment, use MongoDB Atlas or another secured MongoDB service, set production secrets through the hosting provider's environment configuration, and never expose `.env` or API keys in the frontend. Build the frontend with `npm run build` from `client`. The development Vite proxy is not a production API proxy; configure the production web server/hosting platform to route `/api` to the Express backend (or add a suitable API base URL/proxy configuration). Use HTTPS and review authentication, authorization, patient-data privacy, backups, and applicable Indian healthcare/data-protection requirements before production use.
