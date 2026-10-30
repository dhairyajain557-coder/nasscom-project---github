# Wayfinder: Personalized Travel Itinerary Planner
Generative AI with Google Cloud project. Gemini (Vertex AI) turns destination, budget, pace and interests into a day-by-day itinerary.

## Architecture
Browser (HTML/CSS/JS) -> Flask API (`app.py`) -> `itinerary_service.py` -> Gemini on Vertex AI

## Build order
1. **Google Cloud setup**: create a project, enable billing, enable the Vertex AI API, run `gcloud auth application-default login`.
2. **Project setup**: `python -m venv .venv`, activate it, `pip install -r requirements.txt`, copy `.env.example` to `.env`.
3. **Backend service** (`itinerary_service.py`): settings, input validation, prompt building, Gemini call (JSON output, one retry), output normalising, offline demo generator.
4. **Backend API** (`app.py`): `GET /api/health`, `POST /api/itinerary`, `POST /api/itinerary/day`, error handlers.
5. **Front end** (`static/`): `index.html` (form and layout), `style.css` (design), `app.js` (form -> API -> render, copy, print, redo a day).
6. **Tests**: `python -m unittest discover -s tests -v` (runs offline in demo mode).
7. **Run**: `python app.py`, open http://localhost:8080.
8. **Deploy**: `gcloud run deploy wayfinder --source . --region us-central1 --allow-unauthenticated --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1`
   Grant the Cloud Run service account the "Vertex AI User" role.

## Modes
| Mode | Set in `.env` |
|---|---|
| Vertex AI | `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` |
| Gemini API key | `GEMINI_API_KEY` |
| Demo (no credentials) | leave all empty, or `DEMO_MODE=true` |

## Production hardening ideas
Rate limiting, authentication, response caching, streaming output.
