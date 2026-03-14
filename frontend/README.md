# FoodSave Frontend

React + TypeScript client for the FoodSave platform.

## Overview

This app provides role-based UI for donors, NGOs, volunteers, and admins, including:

- authentication (email/password, phone OTP, Google)
- donation and pickup workflows
- analytics dashboards
- AI tools panel
- leaderboard and prize redemption

## Tech Stack

- React 18
- TypeScript
- React Router
- Axios
- Tailwind CSS
- Create React App build tooling

## Setup

From the `frontend` directory:

```bash
npm install
npm start
```

App runs on `http://localhost:3000`.

## Environment Variables

Create `frontend/.env` (or `.env.local`) with:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

This should point to the backend API base.

## Scripts

- `npm start` — start dev server
- `npm run build` — create production build in `build/`
- `npm test` — run tests

## App Structure

- `src/pages/` — route-level screens (dashboard, donations, pickups, leaderboard, auth, admin pages)
- `src/components/` — reusable UI and route guards
- `src/contexts/` — auth state management (`AuthContext`)
- `src/services/` — API client and endpoint wrappers
- `src/firebase/` — Firebase auth integration helpers
- `src/data/` — static datasets (for example Odisha locations)

## API Integration

The frontend uses `src/services/api.ts` to call backend route groups:

- `/auth/*`
- `/donations/*`
- `/analytics/*`

JWT tokens are stored in local storage and attached via axios interceptors.

## Build Validation

Use this before deployment:

```bash
npm run build
```

## Notes

- Ensure backend is running before using authenticated flows.
- In local development, CORS and API URL must align with backend settings.
