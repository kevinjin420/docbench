# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY control-panel/package*.json ./
RUN npm ci
COPY control-panel/ ./
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# Stage 2: Backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash appuser

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn eventlet

# Copy backend code
COPY --chown=appuser:appuser backend/ ./backend/
COPY --chown=appuser:appuser database/ ./database/
COPY --chown=appuser:appuser api.py .
COPY --chown=appuser:appuser tests.json .

# Copy built frontend
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist ./static/

# Create directories with proper ownership
RUN mkdir -p release && chown appuser:appuser release

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5050/api/health || exit 1

# Run with gunicorn + eventlet for production
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5050", "--timeout", "120", "api:app"]
