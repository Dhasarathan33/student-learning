# Student Learning Recovery Planner

Student Learning Recovery Planner is a full-stack self-learning support system that helps students identify weak topics through assessments, generate recovery plans, use targeted learning resources, and track improvement through retests and progress analytics.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Authentication: JWT
- External API: YouTube Data API
- API Docs: Swagger UI + Postman
- CI/CD: GitHub Actions
- Deployment: Vercel (frontend) + Render (backend)

## Self-Learning Workflow

1. Student takes an assessment quiz.
2. System detects weak topics automatically.
3. Weak topics are stored in the learning gaps module.
4. System generates recovery plans.
5. Student studies using learning resources and YouTube videos.
6. Student takes a retest.
7. System updates progress automatically.

## Core Features

- Secure signup/login (JWT)
- Subject management
- Task management
- Learning gap detection (Weak/Average/Good)
- Recovery plan generation
- Learning resources + YouTube integration
- Retest workflow
- Progress dashboard and analytics
- Structured learning notes (Basic/Medium/Advanced)

## Project Structure

- `frontend/`: React client
- `backend/`: Express API
- `docs/postman/`: Postman collection
- `.github/workflows/`: CI/CD workflows
- `render.yaml`: Render backend deployment config

## Local Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Backend runs at `http://localhost:5000`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

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


### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL`  
  Example: `https://student-learning-recovery-backend.onrender.com`

## API Documentation

- Swagger: `https://student-learning-recovery-backend.onrender.com/api/docs`
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

- Config: `frontend/vercel.json`
- Build command: `npm run build`
- Output directory: `dist`
- Required env var: `VITE_API_BASE_URL`

### Backend (Render)

- Config: `render.yaml`
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Configure backend env vars in Render dashboard.

## CI/CD

GitHub Actions workflows:

- `.github/workflows/ci.yml`
  - Frontend: install, lint, test, build
  - Backend: install, test
- `.github/workflows/deploy.yml`
  - Vercel deploy (requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
  - Render deploy hook trigger (requires `RENDER_DEPLOY_HOOK_URL`)

## Live URLs

- Frontend: `https://student-learning-recovery-planner.vercel.app`
- Backend: `https://student-learning-recovery-backend.onrender.com`
- Swagger: `https://student-learning-recovery-backend.onrender.com/api/docs`

## Purpose

The platform supports self-directed learning by helping students:

- Identify weak topics
- Access targeted resources
- Follow structured recovery plans
- Retest understanding
- Monitor progress continuously
