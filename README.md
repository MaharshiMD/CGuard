# CodeGuard AI

This repository contains the CodeGuard AI project with a Firebase-hosted frontend and a self-contained Express backend for code similarity analysis.

## Render Deployment for Backend

1. Sign up at https://render.com.
2. Create a new **Web Service** and connect your GitHub repository.
3. Set the service root to the `backend/` folder.
4. Set the build command to:
   ```bash
   npm install
   ```
5. Set the start command to:
   ```bash
   npm start
   ```
6. Add environment variables in Render:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `PORT` = `10000` (or leave blank for Render default)
   - `NODE_ENV` = `production`
7. Deploy and note the service URL, e.g. `https://codeguard-backend.onrender.com`.

## Frontend Configuration

Update `frontend/script.js`:

```js
const BACKEND_BASE_URL = "https://your-app.onrender.com";
```

Replace that URL with your Render service URL.

## Backend Files

- `backend/server.js` — Express server entrypoint
- `backend/src/app.js` — app setup with security middleware
- `backend/src/routes/analysisRoutes.js` — API routes
- `backend/src/controllers/analysisController.js` — controller logic
- `backend/src/services/plagiarismService.js` — analysis orchestration
- `backend/src/engines/astEngine.js` — AST comparison
- `backend/src/engines/fingerprintEngine.js` — k-gram fingerprinting
- `backend/src/engines/stylometryEngine.js` — stylometry scoring
- `backend/src/engines/tokenizer.js` — token normalization
- `backend/src/models/Submission.js` — MongoDB submission model

## Notes

- The frontend currently uses the new backend for group compare scans when `BACKEND_BASE_URL` is configured.
- The backend uses only open-source libraries and no external AI APIs.
- The backend is ready for MongoDB Atlas and Render deployment.
