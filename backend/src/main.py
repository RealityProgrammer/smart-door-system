from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import router
from src.api.voice_routes import voice_router
from src.api.websockets import websocket_endpoint
from fastapi.staticfiles import StaticFiles
import logging
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Door System API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_path = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Include routes
app.include_router(router, prefix="/api")
app.include_router(voice_router, prefix="/api")

# WebSocket endpoint
app.websocket("/ws")(websocket_endpoint)

@app.get("/")
async def root():
    return {"message": "Smart Door System API is running"}

@app.get("/audio-status")
async def audio_status():
    """Check available audio files"""
    audio_dir = os.path.join(static_path, "audio")
    files = []
    if os.path.exists(audio_dir):
        files = [f for f in os.listdir(audio_dir) if f.endswith('.mp3')]
    return {"available_files": files}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)