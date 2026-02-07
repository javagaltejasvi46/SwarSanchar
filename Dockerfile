# Stage 1: Build the React Frontend
FROM node:18-alpine as frontend_builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Setup the Python Backend
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (FFmpeg is required)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the entire backend code
COPY backend/ ./backend/

# Copy the built frontend from Stage 1 into the backend folder
# We place it in /app/frontend/build so the backend code (modified to look at ../frontend/build or frontend/build) can find it
COPY --from=frontend_builder /app/frontend/build ./frontend/build

# Expose the specific port for Hugging Face Spaces
EXPOSE 7860

# Set working directory to backend so relative imports work naturally
WORKDIR /app/backend

# Create necessary directories for the app to function
RUN mkdir -p /app/data/temp /app/data/stems /app/data/SwarsancharMedia

# Set environment variables
# HOME is where the app will look for config if using Path.home()
ENV HOME=/app/data
ENV APPDATA=/app/data
ENV FLASK_PORT=7860

# Command to run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
