#!/bin/bash

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Terminating all background service processes..."
    # Kill background jobs
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM

# Clean up any existing processes on our service ports to prevent "Address already in use" errors
echo "Checking and cleaning up any stale background services on ports 8000, 8005, 8080, 3001, 5173..."
for port in 8000 8005 8080 3001 5173; do
    if lsof -t -i:$port >/dev/null 2>&1; then
        echo "Killing stale process on port $port..."
        kill -9 $(lsof -t -i:$port) 2>/dev/null || true
    fi
done

echo "Initializing BISIG ecosystem installation checks and service runner..."

# 1. Install system library dependencies if missing
echo "Verifying system library prerequisites (libgles2, libegl1, libgl1, libglib2.0-0)..."
for pkg in libgles2 libegl1 libgl1 libglib2.0-0; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        echo "Installing missing system packages using apt-get..."
        sudo apt-get update && sudo apt-get install -y libgles2 libegl1 libgl1 libglib2.0-0
        break
    fi
done

# 2. Setup Python virtual environment and dependencies
if [ ! -d "/workspaces/BISIG/.venv" ]; then
    echo "Python virtual environment not detected. Creating virtual environment at /workspaces/BISIG/.venv..."
    python3 -m venv /workspaces/BISIG/.venv
fi

echo "Activating Python virtual environment..."
source /workspaces/BISIG/.venv/bin/activate

echo "Upgrading Python package installer (pip) and installing project dependencies..."
pip install --upgrade pip --quiet
pip install -r /workspaces/BISIG/Backend-API/requirements.txt -r /workspaces/BISIG/sign_to_text/backend/requirements.txt --quiet

# 3. Setup Frontend Node.js dependencies
echo "Verifying Frontend Node.js dependencies (node_modules)..."
cd /workspaces/BISIG/Frontend
if [ ! -d "node_modules" ]; then
    echo "Node.js dependencies not found. Installing Node.js packages..."
    npm install --silent
fi

# 4. Setup Go dependencies
echo "Downloading Go compiler packages..."
cd /workspaces/BISIG/FSL-Datasets
go mod download

# 5. Fetch Hugging Face metadata if missing
if [ ! -f "/workspaces/BISIG/FSL-Datasets/metadata/api.json" ]; then
    echo "Downloading Filipino Sign Language dataset metadata index from Hugging Face..."
    mkdir -p /workspaces/BISIG/FSL-Datasets/metadata
    curl -L -o /workspaces/BISIG/FSL-Datasets/metadata/api.json https://huggingface.co/datasets/Golgrax/bisig-fsl-dataset/resolve/main/metadata/api.json
fi

# 6. Build Frontend static assets if missing
cd /workspaces/BISIG/Frontend
if [ ! -d "dist" ]; then
    echo "Frontend build directory not found. Compiling production static assets..."
    npm run build
fi

# 7. Create symlink for Go server if missing
if [ ! -L "/workspaces/BISIG/FSL-Datasets/dist" ] && [ ! -d "/workspaces/BISIG/FSL-Datasets/dist" ]; then
    echo "Creating symlink to link the frontend production build with the Go Unified Server..."
    ln -s /workspaces/BISIG/Frontend/dist /workspaces/BISIG/FSL-Datasets/dist
fi

echo "Launching all ecosystem microservices in the background..."

# 1. Start Python API (Backend-API) on port 8000
echo "Starting Text-to-Sign translation service (Backend-API) on http://localhost:8000..."
cd /workspaces/BISIG/Backend-API
nohup /workspaces/BISIG/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > backend_api.log 2>&1 &
BACKEND_API_PID=$!

# 2. Start Python sign_to_text backend on port 8005
echo "Starting Sign-to-Text vision recognition service on http://localhost:8005..."
cd /workspaces/BISIG/sign_to_text/backend
nohup /workspaces/BISIG/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8005 > sign_to_text.log 2>&1 &
SIGN_TO_TEXT_PID=$!

# 3. Start Go Unified Server on port 8080
echo "Starting Go Unified Media & Proxy Server on http://localhost:8080..."
cd /workspaces/BISIG/FSL-Datasets
nohup go run main.go > go_server.log 2>&1 &
GO_SERVER_PID=$!

# 4. Start Frontend (Express server + Vite) on ports 3001 and 5173
echo "Starting React frontend dev server (port 5173) and Node auth server (port 3001)..."
cd /workspaces/BISIG/Frontend
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "Initialization complete. All background services have started successfully."
echo "Access Endpoints:"
echo "  Frontend interface (Vite): http://localhost:5173"
echo "  Authentication API (Node): http://localhost:3001"
echo "  Translation API (Python Backend): http://localhost:8000"
echo "  Sign-to-Text API (Python Vision): http://localhost:8005"
echo "  Go Unified Server (Go entrypoint): http://localhost:8080"
echo ""
echo "Service execution logs are being redirected to the following files:"
echo "   - /workspaces/BISIG/Backend-API/backend_api.log"
echo "   - /workspaces/BISIG/sign_to_text/backend/sign_to_text.log"
echo "   - /workspaces/BISIG/FSL-Datasets/go_server.log"
echo "   - /workspaces/BISIG/Frontend/frontend.log"
echo ""
echo "Press [Ctrl + C] to terminate all background service processes."

# Keep script running to maintain background processes
wait
