import os
import json
import asyncio
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from qwen_matcher import QwenMatcher

# URL Persistence
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "colab_config.json")

def get_persisted_url():
    # 1. Prioritize environment variables first so URL won't leak in the git repository
    env_url = os.environ.get("COLAB_URL") or os.environ.get("VISION_SERVER_URL")
    if env_url:
        return env_url
        
    # 2. Load from colab_config.json and expand environment variables inside the string
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                url = data.get("colab_url")
                if url:
                    expanded = os.path.expandvars(url)
                    # Verify if the environment variable was resolved (no remaining unresolved '$')
                    if "$" not in expanded:
                        return expanded
        except:
            return None
    return None

def save_persisted_url(url):
    # Only save to file if not already set or overriding environment variable
    with open(CONFIG_FILE, "w") as f:
        json.dump({"colab_url": url}, f)

def has_hand_activity(frames):
    """
    Detects dynamic hand movement. Returns True if hands are moving 
    significantly, not just present.
    """
    if len(frames) < 10:
        return False
        
    wrist_positions = []
    for f in frames:
        # We track the wrist (landmark 0) to detect general hand movement
        rh = f.get("right_hand")
        lh = f.get("left_hand")
        
        pos = []
        if rh and len(rh) > 0:
            pos.append((rh[0]['x'], rh[0]['y']))
        if lh and len(lh) > 0:
            pos.append((lh[0]['x'], lh[0]['y']))
        
        if pos:
            wrist_positions.append(pos)

    if len(wrist_positions) < 5:
        return False

    # Check for movement: calculate the spread of wrist positions
    # If the hand stays in the same 2% area of the screen, it's "idle"
    xs = [p[0][0] for p in wrist_positions]
    ys = [p[0][1] for p in wrist_positions]
    
    movement_x = max(xs) - min(xs)
    movement_y = max(ys) - min(ys)
    
    # Threshold: 0.05 (5% of screen movement) is a decent "signing" threshold
    return movement_x > 0.04 or movement_y > 0.04

qwen_matcher = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global qwen_matcher
    
    print("\n" + "="*45)
    print("      BISIG AI VISION INTERFACE")
    print("="*45)
    
    url = get_persisted_url()
    
    # If a valid URL is configured, use it directly to prevent blocking in background environments
    if url and url != "THE url OF THE LMM Visual":
        print(f"Loaded Vision Server URL from config: {url}")
    else:
        # Only prompt if stdin is interactive (a TTY)
        if sys.stdin.isatty():
            try:
                while not url or url == "THE url OF THE LMM Visual":
                    url = input("Enter Vision Server (Colab) URL: ").strip()
                save_persisted_url(url)
            except (EOFError, KeyboardInterrupt):
                url = "http://localhost:8000" # fallback placeholder
        else:
            print("[WARNING] Vision Server URL not configured. You can update it dynamically from the Frontend.")
            url = "http://localhost:8000" # fallback placeholder
            
    print(f"\nSTATUS: Initializing with Vision Server @ {url}")
    qwen_matcher = QwenMatcher(url)
    print("="*45 + "\n")
    yield

app = FastAPI(title="BISIG AI Vision Sign-to-Text API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "Running",
        "interface": "AI Vision (Qwen2-VL)",
        "instruction": "Connect via the Frontend UI."
    }

@app.get("/health")
async def health():
    return {
        "interface": "AI Vision (Qwen2-VL)",
        "ai_active": qwen_matcher is not None,
        "colab_url": qwen_matcher.colab_url if qwen_matcher else None
    }

@app.websocket("/ws/match")
async def websocket_match(websocket: WebSocket):
    global qwen_matcher
    await websocket.accept()
    print("[SERVER] WebSocket Client Connected")
    
    frame_buffer = []
    max_window_size = 120 
    frame_counter = 0
    cooldown_counter = 0
    
    # Configuration defaults
    preferred_lang = "all"
    threshold = 0.3
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "config":
                preferred_lang = data.get("lang", preferred_lang)
                threshold = data.get("threshold", threshold)
                
                # Signal frontend to capture images
                await websocket.send_json({"type": "config_ack", "use_llm": True})
                
                new_url = data.get("colab_url") or data.get("colabUrl")
                if new_url and (not qwen_matcher or qwen_matcher.colab_url != new_url):
                    qwen_matcher = QwenMatcher(new_url)
                    save_persisted_url(new_url)
                    print(f"[SERVER] Vision Endpoint Updated: {new_url}")
                
            elif msg_type == "reset":
                frame_buffer.clear()
                cooldown_counter = 0
                
            elif msg_type == "frame":
                if cooldown_counter > 0:
                    cooldown_counter -= 1
                    continue
                    
                frame = data.get("frame")
                if frame:
                    # Debug logging
                    if frame_counter % 20 == 0:
                        has_img = "YES" if frame.get("image") else "NO"
                        print(f"[DEBUG] Frame {frame_counter}: Image Data: {has_img}")

                    frame_buffer.append(frame)
                    if len(frame_buffer) > max_window_size:
                        frame_buffer.pop(0)
                        
                    frame_counter += 1
                    
                    if frame_counter % 30 == 0 and len(frame_buffer) >= 20:
                        word, confidence, candidate, dist = None, 0.0, None, 0.0
                        
                        if qwen_matcher:
                            if has_hand_activity(frame_buffer[-20:]):
                                print("[ANALYSIS] Hand activity detected. Invoking vision model...")
                                word, confidence, candidate, dist = await qwen_matcher.find_match(
                                    frame_buffer, 
                                    preferred_lang=preferred_lang, 
                                    threshold=threshold
                                )
                            else:
                                candidate = "Monitoring..."
                        else:
                            candidate = "Vision Server Offline"
                        
                        await websocket.send_json({
                            "type": "trace",
                            "candidate": candidate,
                            "distance": 0.0,
                            "threshold": threshold,
                            "method": "vision-analysis"
                        })
                        
                        if word:
                            print(f"[RESULT] Sign Recognized: {word.upper()}")
                            await websocket.send_json({
                                "type": "match",
                                "word": word,
                                "confidence": confidence,
                                "method": "ai-vision"
                            })
                            frame_buffer.clear()
                            cooldown_counter = 45
                            
    except WebSocketDisconnect:
        print("[SERVER] WebSocket Client Disconnected")
    except Exception as e:
        print(f"[ERROR] WebSocket Loop: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005, log_level="info")
