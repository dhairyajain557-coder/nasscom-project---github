"""Wayfinder web server: serves the front end and exposes a small JSON API.

Routes
  GET  /                   the single-page front end
  GET  /api/health         which AI mode is active (vertex / api_key / demo)
  POST /api/itinerary      generate a full itinerary
  POST /api/itinerary/day  regenerate one day of an existing itinerary
"""
import logging
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()  # read .env before Settings.from_env() runs

from itinerary_service import (  # noqa: E402  (must come after load_dotenv)
    GenerationError,
    ItineraryService,
    ValidationError,
    validate_trip,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def create_app(service: ItineraryService | None = None) -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config["MAX_CONTENT_LENGTH"] = 256 * 1024  # itineraries are small; reject big bodies
    svc = service or ItineraryService()

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        return response

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", mode=svc.settings.mode, model=svc.settings.model)

    @app.post("/api/itinerary")
    def create_itinerary():
        trip = validate_trip(request.get_json(silent=True))
        return jsonify(trip=trip, itinerary=svc.generate(trip))

    @app.post("/api/itinerary/day")
    def regenerate_day():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise ValidationError("Send a JSON object.")
        trip = validate_trip(body.get("trip"))
        try:
            day = int(body.get("day"))
        except (TypeError, ValueError):
            raise ValidationError("Day must be a whole number.") from None
        itinerary = svc.regenerate_day(trip, body.get("itinerary"), day, body.get("feedback", ""))
        return jsonify(trip=trip, itinerary=itinerary)

    @app.errorhandler(ValidationError)
    def handle_validation(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(GenerationError)
    def handle_generation(error):
        return jsonify(error=str(error)), 502

    @app.errorhandler(413)
    def handle_too_large(_):
        return jsonify(error="That request is too large."), 413

    @app.errorhandler(404)
    def handle_not_found(_):
        return jsonify(error="Not found."), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")), debug=os.getenv("FLASK_DEBUG") == "1")
