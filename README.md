Student Learning Recovery Planner: 
        A full-stack web application that helps students identify learning gaps, plan recovery strategies,
track study tasks, and manage structured learning notes.

🚀 Tech Stack

    Frontend: React.js

    Backend: Node.js + Express.js

    Database: MySQL

    Authentication: JWT

Database Schema

The application uses the following tables:

    users – Stores user authentication details

    subjects – Subjects added for recovery

    tasks – Daily learning tasks

    learning_gaps – Weak / Average / Good topic tracking

    recovery_plans – Structured recovery strategies

    learning_resources – Notes for learning concepts/ refer for vidoes 

✨ Features

    🔐 Secure login & signup (JWT-based)

    📚 Add and manage subjects

    📝 Create and track daily study tasks

    📊 Learning gap assessment (Weak / Average / Good)

    📈 Progress tracking dashboard

    📒 Structured learning notes (Basic / Medium / Advanced)

⚙️ Setup
Backend
    cd backend
    npm install
    npm start

Frontend
    cd frontend
    npm install
    npm start

🎯 Purpose
        This project helps students systematically recover weak topics, improve consistency, 
and monitor academic progress using a structured planning approach.
=======
# Student Learning Recovery Planner

A full-stack web application that helps students detect learning gaps, create recovery plans, track tasks, and monitor progress.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Auth: JWT
- API Docs: Swagger UI + Postman
- CI/CD: GitHub Actions
- Hosting target: Vercel (frontend) + Render (backend)

## Project Structure

- `frontend/`: React client
- `backend/`: Express API
- `docs/postman/`: Postman collection
- `.github/workflows/`: CI/CD pipelines
- `render.yaml`: Render service configuration

## Local Setup

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Backend runs on `http://localhost:5000` by default.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

## Environment Variables

### Backend (`backend/.env`)

- `PORT`
- `JWT_SECRET`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `CORS_ORIGIN`
- `YOUTUBE_API_KEY`
- `PUBLIC_API_URL` (optional, used by Swagger server URL)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL` (example: `https://your-backend.onrender.com`)

## API Documentation

- Swagger UI: `http://localhost:5000/api/docs`
- Postman collection: `docs/postman/Student_Learning_Recovery_Planner.postman_collection.json`

## Testing

### Frontend

```bash
cd frontend
npm run test
```

### Backend

```bash
cd backend
npm run test
```

## Deployment

### Frontend (Vercel)

- Config file: `frontend/vercel.json`
- Build command: `npm run build`
- Output dir: `dist`
- Required env var on Vercel: `VITE_API_BASE_URL`

### Backend (Render)

- Config file: `render.yaml`
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Configure all backend env vars in Render dashboard.

## CI/CD

GitHub Actions workflows:

- `.github/workflows/ci.yml`
  - Frontend: install, lint, test, build
  - Backend: install, test
- `.github/workflows/deploy.yml`
  - Vercel deploy (requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
  - Render deploy hook trigger (requires `RENDER_DEPLOY_HOOK_URL`)

## Live URLs (fill after deployment)

- Frontend URL: `https://<your-vercel-app>.vercel.app`
- Backend URL: `https://<your-render-service>.onrender.com`
- Swagger URL: `https://<your-render-service>.onrender.com/api/docs`

## Viva Notes

- Code splitting implemented with lazy loaded routes.
- Unit/integration tests added for frontend and backend.
- API docs available in Swagger + Postman.
- Deployment configs and CI/CD pipelines are included.
>>>>>>> 82fcc66 (Fix deploy workflow)
