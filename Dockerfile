# Backend-only image for the chatbox handoff API (staging).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Ship only what the API needs (no frontend assets in the API-only deploy).
COPY backend/ ./backend/

# API-only by default; cross-origin access is opt-in via CORS_ALLOW_ORIGINS.
ENV SERVE_STATIC=false \
    APP_ENV=staging \
    PORT=8000

EXPOSE 8000

# Bind to the platform-provided $PORT (Render/Railway/Fly set this).
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
