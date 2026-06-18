import httpx
import asyncio
import base64
import numpy as np

class QwenMatcher:
    def __init__(self, colab_url: str):
        self.colab_url = colab_url.rstrip("/")
        # LocalTunnel requires this header to bypass the 'reminder' page
        self.headers = {"bypass-tunnel-reminder": "true"}
        self.client = httpx.AsyncClient(timeout=60.0, headers=self.headers)

    async def find_match(self, frame_buffer, preferred_lang=None, threshold=0.3):
        if not frame_buffer:
            return None, 0.0, None, 0.0
            
        # Collect frames that HAVE images
        images = []
        for i, f in enumerate(frame_buffer):
            if f.get("image"):
                images.append(f.get("image"))
        
        print(f"[MATCHER] Buffer status: {len(frame_buffer)} total frames, {len(images)} with images.")

        if not images:
            return None, 0.0, "Blind (No Image)", 0.0
            
        # Sub-sample images (Qwen2-VL handles sequence of frames)
        # We'll take up to 12 frames to provide better temporal context
        max_frames = 12
        if len(images) > max_frames:
            indices = [int(i) for i in np.linspace(0, len(images) - 1, max_frames)]
            images = [images[i] for i in indices]

        try:
            # Refined technical prompt to force brevity and focus
            prompt = (
                "You are an expert Sign Language Interpreter. "
                "Analyze the provided sequence of video frames.\n"
                "INSTRUCTIONS:\n"
                "1. MORPHOLOGICAL ANALYSIS: Briefly describe the hand shapes and movement. Ignore background and clothing.\n"
                "2. IDENTIFIED SIGN: Identify the sign. Output ONLY the word or short phrase. No sentences.\n"
                "Format:\n"
                "ANALYSIS: [description]\n"
                "SIGN: [word/phrase]"
            )
            
            content = [{"type": "text", "text": prompt}]
            
            for img_b64 in images:
                if not img_b64.startswith("data:"):
                    img_b64 = f"data:image/jpeg;base64,{img_b64}"
                content.append({"type": "image_url", "image_url": {"url": img_b64}})
            
            payload = {
                "messages": [{"role": "user", "content": content}],
                "stream": False,
                "max_tokens": 100,
                "temperature": 0.1
            }
            
            print(f"[MATCHER] Analyzing {len(images)} frames...")
            response = await self.client.post(f"{self.colab_url}/v1/chat/completions", json=payload)
            
            if response.status_code == 200:
                raw_content = response.json()["choices"][0]["message"]["content"].strip()
                print(f"[MATCHER] AI Response:\n{raw_content}")
                
                prediction = None
                lines = raw_content.split("\n")
                for line in lines:
                    low_line = line.lower()
                    if "sign:" in low_line:
                        # Extract everything after "sign:"
                        raw_pred = line.split(":", 1)[1].strip().lower()
                        
                        # Strip common AI filler phrases
                        fillers = [
                            "the sign is", "the gesture is", "this is the sign for",
                            "appears to be", "is likely", "could be", "sign for"
                        ]
                        for filler in fillers:
                            if raw_pred.startswith(filler):
                                raw_pred = raw_pred.replace(filler, "", 1).strip()
                        
                        # Clean up punctuation but keep spaces between words
                        prediction = "".join(e for e in raw_pred if e.isalnum() or e.isspace()).strip()
                        break
                
                # Final cleanup: if it's still a long sentence, it's likely a hallucination
                if prediction and len(prediction.split()) > 5:
                    # Try to take just the last word or common noun if it looks like a sentence
                    if "sign" in prediction:
                        prediction = prediction.split()[-1]

                if prediction:
                    return prediction, 0.95, prediction, 0.05
            else:
                print(f"Qwen2-VL Server error: {response.status_code}")
                return None, 0.0, f"Error: {response.status_code}", 0.0
        except Exception as e:
            print(f"QwenMatcher error: {e}")
            
        return None, 0.0, None, 0.0
