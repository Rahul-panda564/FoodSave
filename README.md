# 🥗 FoodSave — AI-Powered Food Redistribution Platform

**🚀 Live Demo: [https://food-save-eight.vercel.app/](https://food-save-eight.vercel.app/)**

<p align="center">
	<a href="https://github.com/Rahul-panda564/FoodSave"><img alt="Repository" src="https://img.shields.io/badge/Repository-FoodSave-0f766e"></a>
	<img alt="Frontend" src="https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-2563eb">
	<img alt="Backend" src="https://img.shields.io/badge/Backend-Django%20%2B%20DRF-166534">
	<img alt="Google Services" src="https://img.shields.io/badge/Google-Firebase%20Auth%20%2B%20OAuth2-ea4335">
	<img alt="Database" src="https://img.shields.io/badge/Database-PostgreSQL-6b7280">
	<img alt="Status" src="https://img.shields.io/badge/Status-Production%20Ready-blueviolet">
</p>

---

## 🎯 Chosen Vertical

**Food Redistribution & Waste Prevention**

Food waste and food insecurity often coexist in the same city. In India alone, ~68 million tonnes of food is wasted annually while 190 million people go hungry. The core gap is **coordination** — surplus food must be listed, matched, assigned, picked up, and delivered quickly enough to remain safe and usable.

FoodSave addresses this with an AI-assisted platform that connects **Donors** (restaurants, hotels, individuals), **NGOs**, and **Volunteers** through intelligent matching, real-time coordination, and data-driven decision making.

---

## 💡 Approach and Logic

### Smart, Dynamic Assistant

FoodSave acts as an intelligent orchestration layer:

1. **AI Food Safety Prediction** — Uses scikit-learn ML models to predict food safety scores based on storage conditions, time elapsed, and food type, helping NGOs make informed pickup decisions.
2. **Nearest NGO Matching** — Haversine-based geospatial algorithm finds the closest available NGOs to a donation, optimizing pickup logistics.
3. **Donation Priority Queue** — Algorithmic ranking system that prioritizes donations by expiry urgency, quantity, and safety score to ensure high-risk food gets rescued first.
4. **Smart NGO Recommendations** — Context-aware recommendation engine suggesting the best-fit NGOs based on capacity, proximity, and past performance.
5. **Automated Notification Triggers** — Event-driven notification system that alerts relevant parties when new donations appear, pickups are assigned, or statuses change.

### Logical Decision Making

- **Role-based workflows**: Each user type (Donor, NGO, Volunteer, Admin) sees a tailored dashboard with role-specific stats, actions, and suggestions
- **Expiry-aware prioritization**: Donations nearing expiry are automatically surfaced with higher urgency
- **Gamification**: Leaderboard and points system incentivizes sustained participation

### Architecture

```mermaid
flowchart LR
  U[Users] --> FE[React + TypeScript Frontend]
  FE -->|JWT / REST| API[Django REST API]
  API --> ACC[accounts — Auth, Profile, Leaderboard]
  API --> DON[donations — Listings, Pickups, Routes]
  API --> ANA[analytics — Dashboards, AI Endpoints]
  API --> DB[(SQLite / PostgreSQL)]
  FE --> GAUTH[Google Firebase Auth]
  API --> ML[scikit-learn ML Models]
```

---

## 🔧 How the Solution Works

### Donation Lifecycle

```mermaid
sequenceDiagram
  participant Donor
  participant App as React App
  participant API as Django API
  participant NGO
  participant Volunteer

  Donor->>App: Create donation (food details + image + location)
  App->>API: POST /api/donations/
  API-->>App: Donation listed as AVAILABLE
  NGO->>App: Browse nearby donations
  App->>API: GET /api/donations/nearby/
  NGO->>App: Request pickup
  App->>API: POST /api/donations/pickups/
  Volunteer->>App: Accept delivery assignment
  App->>API: POST /api/donations/pickups/:id/decision/
  API-->>App: Status → DELIVERED, analytics updated
```

### Authentication Flow

- **Email/Password** — Standard JWT-based registration and login
- **Google Sign-In** — Firebase Authentication with Google OAuth2; Firebase ID tokens are verified server-side using `google-auth` library
- **Phone OTP** — Backend-generated OTP with Twilio SMS delivery (falls back to debug mode when Twilio is unconfigured)

### Google Services Integration

| Service | Purpose |
|---------|---------|
| **Firebase Authentication** | Google Sign-In (popup with redirect fallback), phone auth infrastructure |
| **Firebase App Config** | Centralized client-side app configuration and initialization |
| **Google OAuth2 Token Verification** | Server-side verification of Firebase ID tokens via `google.oauth2.id_token` |
| **Google Cloud Platform** | OAuth2 client credentials management for the Firebase project |

---

## 📋 Assumptions Made

1. **Local Development** — SQLite is used for local development; PostgreSQL is supported for production via `dj-database-url`
2. **Twilio Optional** — Phone OTP works in debug mode without Twilio credentials (OTP returned in response for testing)
3. **Firebase Config Required** — Google Sign-In requires valid Firebase project credentials in `frontend/.env`
4. **Single Branch** — The repository operates on a single `main` branch
5. **Indian Context** — Phone number normalization defaults to India (+91) country code
6. **Food Safety ML** — The food safety prediction model uses heuristic scoring in development; production would use trained models with real data
7. **Media Storage** — Donation and profile images are stored locally in `backend/media/`; production would use cloud storage

---

## 🏗️ Tech Stack

### Frontend
- React 19, TypeScript, React Router 7
- Tailwind CSS, Framer Motion
- Firebase SDK (Auth)
- Chart.js
- Google Maps Embed API (Maps)
- Axios (HTTP client)

### Backend
- Django 6.0.3, Django REST Framework
- Simple JWT (authentication)
- google-auth (Firebase token verification)
- scikit-learn, NumPy, pandas (AI/ML)
- Twilio (SMS OTP)
- WhiteNoise (static files)

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+, Node.js 18+, npm

### Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```powershell
cd frontend
npm install
npm start
```

### Environment Variables

**`backend/.env`**
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
GOOGLE_CLIENT_ID=your-firebase-web-client-id
```

**`frontend/.env`**
```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_FIREBASE_API_KEY=your-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

---

## 🌍 Deployment Guide

The codebase is production-ready. Ensure all environment variables are correctly populated on your hosting provider.

### Backend (Render / Heroku)
1. Add a PostgreSQL database to your hosting environment
2. Set environment variables:
   - `DATABASE_URL` (e.g., `postgres://user:pass@host:port/dbname`)
   - `DEBUG=False`
   - `SECRET_KEY` (a secure random string)
   - `ALLOWED_HOSTS` (your backend URL, e.g., `your-api.onrender.com`)
   - `CORS_ALLOWED_ORIGINS` (your frontend URL, e.g., `https://your-frontend.vercel.app`)
   - `GOOGLE_CLIENT_ID`
3. Configure your build/start commands:
   - **Build Command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command:** `gunicorn foodsave.wsgi:application`

### Frontend (Vercel / Netlify)
1. Link your GitHub repository
2. Set the Root Directory to `frontend/`
3. Add all `REACT_APP_*` environment variables matching your Firebase project
4. Ensure `REACT_APP_API_URL` points to your deployed backend (e.g., `https://your-api.onrender.com/api`)
5. **Build Command:** `npm run build`
6. **Output Directory:** `build`

### Post-Deployment Checklist
- [ ] Add the production frontend URL to Firebase Auth **Authorized Domains**
- [ ] Add the production frontend URL to Google Cloud Platform **OAuth 2.0 Client IDs** Authorized JavaScript origins
- [ ] Ensure the Google Maps Embed API is enabled and allowed for the Firebase API key in GCP
- [ ] Create an admin superuser: `python manage.py createsuperuser` via host console

---

## ✅ Quality Checklist

| Category | Implementation |
|----------|---------------|
| **Code Quality** | TypeScript strict types, clean component architecture, reusable hooks, DRF serializers with validation |
| **Security** | JWT with refresh rotation, password validation, safe logging (no token/PII leaks), CORS configured, `.env` for secrets |
| **Efficiency** | Memoized computations, paginated API responses, optimized database queries with annotations |
| **Testing** | Backend test suite covering auth, Google auth, OTP, leaderboard, prizes; Frontend test scaffolding |
| **Accessibility** | Semantic HTML, ARIA labels, proper heading hierarchy, keyboard navigation, focus states, sufficient contrast |
| **Google Services** | Firebase Auth (Google Sign-In), server-side token verification, Google Cloud OAuth2 credentials |

---

## 📁 Repository Structure

```text
FoodSave/
├── backend/
│   ├── accounts/      # Auth, profile, leaderboard, prizes
│   ├── donations/     # Donation CRUD, pickups, routes
│   ├── analytics/     # Dashboard stats, AI endpoints, feedback
│   ├── foodsave/      # Django settings, root URLs
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # Layout, routing guards
│   │   ├── contexts/      # AuthContext (state management)
│   │   ├── pages/         # All page components
│   │   ├── services/      # API client with interceptors
│   │   ├── hooks/         # Custom hooks
│   │   ├── firebase/      # Firebase config and auth service
│   │   └── assets/        # Images and static assets
│   └── package.json
├── README.md
└── LICENSE
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

