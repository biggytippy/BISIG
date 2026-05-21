import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from matcher import SkeletonMatcher

app = FastAPI(title="BISIG Sign to Text Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reference skeletons directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKELETONS_DIR = os.path.join(BASE_DIR, "Backend-API", "skeletons")

# Initialize matcher
matcher = SkeletonMatcher(SKELETONS_DIR)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "templates_loaded": len(matcher.templates),
        "supported_words": [f"{lang}:{word}" for lang, word in matcher.templates.keys()]
    }

@app.post("/reload")
async def reload_templates():
    matcher.load_templates()
    return {"status": "success", "templates_loaded": len(matcher.templates)}

@app.websocket("/ws/match")
async def websocket_match(websocket: WebSocket):
    await websocket.accept()
    print("Sign-to-Text WebSocket client connected")
    
    # Reload templates on new client connection to capture any new text-to-sign cached files
    matcher.load_templates()
    
    # Frame buffer for sliding window
    frame_buffer = []
    max_window_size = 150 # about 5 seconds at 30 fps
    frame_counter = 0
    cooldown_counter = 0
    
    # Matching configurations
    preferred_lang = None
    threshold = 0.3
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "config":
                preferred_lang = data.get("lang", preferred_lang)
                threshold = data.get("threshold", threshold)
                print(f"Config updated: lang={preferred_lang}, threshold={threshold}")
                
            elif msg_type == "reset":
                frame_buffer.clear()
                cooldown_counter = 0
                print("Buffer reset")
                
            elif msg_type == "frame":
                if cooldown_counter > 0:
                    cooldown_counter -= 1
                    continue
                    
                frame = data.get("frame")
                if frame:
                    frame_buffer.append(frame)
                    if len(frame_buffer) > max_window_size:
                        frame_buffer.pop(0)
                        
                    frame_counter += 1
                    
                    # Run matching every 4 frames (around 8-10 times per second)
                    # and only if we have at least 15 frames in the buffer
                    if frame_counter % 4 == 0 and len(frame_buffer) >= 15:
                        word, confidence, candidate, dist = matcher.find_match(
                            frame_buffer, 
                            preferred_lang=preferred_lang, 
                            threshold=threshold
                        )
                        
                        # Send live candidate trace details back to the web client
                        await websocket.send_json({
                            "type": "trace",
                            "candidate": candidate,
                            "distance": dist if dist is not None else 9.99,
                            "threshold": threshold
                        })
                        
                        if word:
                            print(f"Match found: {word} ({confidence:.2f})")
                            await websocket.send_json({
                                "type": "match",
                                "word": word,
                                "confidence": confidence
                            })
                            # Clear buffer and trigger cooldown so user can return to neutral/make next sign
                            frame_buffer.clear()
                            cooldown_counter = 12 # ignore next 12 frames (approx 0.4 seconds)
                            
    except WebSocketDisconnect:
        print("Sign-to-Text WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, log_level="info")
