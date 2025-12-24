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
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn eventlet

# Copy backend code
COPY backend/ ./backend/
COPY database/ ./database/
COPY api.py .
COPY tests.json .

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./static/

# Create directories
RUN mkdir -p release

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5050/api/stats || exit 1

# Run with gunicorn + eventlet for production
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5050", "api:app"]
