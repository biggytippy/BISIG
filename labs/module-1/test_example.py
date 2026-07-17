import pytest
import os
import sys
import json
import re
import httpx
import threading
import time
import uvicorn
from typing import List, Dict

# Workspace paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DICTIONARY_JSON = os.path.join(ROOT_DIR, "Frontend/src/data/dictionary.json")
FSL_DICTIONARY_JSON = os.path.join(ROOT_DIR, "Frontend/src/data/fsl_dictionary.json")
VERIFIED_SIGNS_JSON = os.path.join(ROOT_DIR, "Frontend/src/data/verified_signs.json")

MEDIAPIPE_MODELS = [
    os.path.join(ROOT_DIR, "Backend-API/models/pose_landmarker.task"),
    os.path.join(ROOT_DIR, "Backend-API/models/hand_landmarker.task"),
    os.path.join(ROOT_DIR, "Backend-API/models/face_landmarker.task")
]

# Dedicated server port
TEST_PORT = 8000
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

# ----------------------------------------------------
# Background Test Server Thread
# ----------------------------------------------------

class UvicornTestServer(threading.Thread):
    """Spawns the actual FastAPI translation service in a background daemon thread."""
    def __init__(self, app, host="127.0.0.1", port=8000):
        super().__init__()
        config = uvicorn.Config(app, host=host, port=port, log_level="error")
        self.server = uvicorn.Server(config)
        self.daemon = True

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True

@pytest.fixture(scope="session", autouse=True)
def live_backend_server():
    """Session fixture that automatically starts and teardowns the FastAPI app if not already running."""
    server_already_running = False
    try:
        # Check if the translation server is already running on port 8000
        res = httpx.get(BASE_URL, timeout=1.0)
        if res.status_code == 200:
            server_already_running = True
    except Exception:
        pass

    if server_already_running:
        # Re-use the existing active server
        yield
    else:
        # Append Backend-API to path so the app imports internal services cleanly
        backend_path = os.path.join(ROOT_DIR, "Backend-API")
        sys.path.append(backend_path)
        
        from main import app
        
        thread = UvicornTestServer(app, host="127.0.0.1", port=TEST_PORT)
        thread.start()
        
        # Wait for the uvicorn server to bind and start listening
        time.sleep(1.5)
        
        yield
        
        thread.stop()
        thread.join(timeout=3.0)

# ----------------------------------------------------
# Core functions under test (local helpers)
# ----------------------------------------------------

def sanitize_text(text: str) -> str:
    """
    Cleans up user query by converting to lowercase, stripping outer whitespace,
    and removing standard punctuation characters.
    """
    if not text:
        return ""
    cleaned = text.strip().lower()
    cleaned = re.sub(r'[^\w\s-]', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned

def tokenize_sentence(sentence: str) -> List[str]:
    """
    Splits a sanitized sentence into individual word tokens.
    """
    cleaned = sanitize_text(sentence)
    if not cleaned:
        return []
    return cleaned.split(" ")

# ----------------------------------------------------
# 1. VM Filesystem Integrity (Iterating All Sign Files)
# ----------------------------------------------------

class TestVMFilesystemIntegrity:
    """Scans and verifies every single physical video and skeleton coordinate file in the VM."""

    def test_all_videos_on_vm(self):
        """Crawls the entire Backend-API/videos folder and checks that every file is a non-empty MP4."""
        videos_dir = os.path.join(ROOT_DIR, "Backend-API/videos")
        assert os.path.exists(videos_dir), f"Videos directory missing: {videos_dir}"
        
        mp4_files = []
        for root, dirs, files in os.walk(videos_dir):
            for file in files:
                if file.endswith(".mp4"):
                    mp4_files.append(os.path.join(root, file))
                    
        assert len(mp4_files) > 0, "No video files found in the backend database"
        
        for path in mp4_files:
            assert os.path.getsize(path) > 0, f"Empty video file detected on VM: {path}"

    def test_all_skeletons_on_vm(self):
        """Crawls the entire Backend-API/skeletons folder and checks that every JSON coordinate file is valid."""
        skeletons_dir = os.path.join(ROOT_DIR, "Backend-API/skeletons")
        assert os.path.exists(skeletons_dir), f"Skeletons directory missing: {skeletons_dir}"
        
        json_files = []
        for root, dirs, files in os.walk(skeletons_dir):
            for file in files:
                if file.endswith(".json") and file != "README.md":
                    json_files.append(os.path.join(root, file))
                    
        assert len(json_files) > 0, "No skeleton JSON files found in the backend database"
        
        for path in json_files:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            assert isinstance(data, list), f"Coordinate file is not a valid list: {path}"
            assert len(data) > 0, f"Coordinate file has zero frames: {path}"
            first_frame = data[0]
            assert "pose" in first_frame or "right_hand" in first_frame, f"Invalid frame schema in coordinate file: {path}"

    def test_mediapipe_model_assets(self):
        """Verifies that the required MediaPipe model task binaries exist on disk and are not empty."""
        for path in MEDIAPIPE_MODELS:
            assert os.path.exists(path), f"MediaPipe model asset missing at: {path}"
            assert os.path.getsize(path) > 1000000, f"MediaPipe model file size seems too small: {path}"

    def test_mediapipe_joint_extraction_on_fly(self):
        """Runs the real frame-by-frame pose landmark tracking using MediaPipe on the VM."""
        import asyncio
        sys.path.append(os.path.join(ROOT_DIR, "Backend-API"))
        from services import skeleton_service
        
        video_path = os.path.join(ROOT_DIR, "Backend-API/videos/asl/hello.mp4")
        assert os.path.exists(video_path)
        
        # Run real, heavy CPU MediaPipe extraction on the VM!
        skeleton_data = asyncio.run(skeleton_service.extract_skeleton(video_path))
        
        assert isinstance(skeleton_data, list)
        assert len(skeleton_data) > 0
        first_frame = skeleton_data[0]
        assert "pose" in first_frame
        assert len(first_frame["pose"]) == 33
        assert "x" in first_frame["pose"][0]


# ----------------------------------------------------
# 2. Live VM Endpoint Integration Verification (Direct VM Testing)
# ----------------------------------------------------

class TestLiveVMEndpoints:
    """Queries the dynamically spawned FastAPI translation service on the VM to verify live responses."""

    def test_live_root_endpoint(self):
        """Pings the root endpoint of the running server to verify metadata."""
        res = httpx.get(BASE_URL, timeout=5.0)
        assert res.status_code == 200
        data = res.json()
        assert "api_name" in data or "name" in data or "version" in data

    def test_live_translation_video(self):
        """Queries the running translation service for standard video mappings."""
        res = httpx.get(f"{BASE_URL}/translate?text=hello&format=video&lang=asl", timeout=5.0)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list) or isinstance(data, dict)

    def test_live_translation_skeleton(self):
        """Queries the running translation service for coordinate frame outputs."""
        res = httpx.get(f"{BASE_URL}/translate?text=hello&format=full_skeleton&lang=asl", timeout=5.0)
        assert res.status_code == 200
        data = res.json()
        assert "original_text" in data
        assert "format" in data
        assert "frames" in data
        assert isinstance(data["frames"], list)

    def test_live_translation_bad_request(self):
        """Queries the running translation service with empty text and asserts rejection."""
        res = httpx.get(f"{BASE_URL}/translate?text=&format=video", timeout=5.0)
        assert res.status_code == 400

    def test_asl_cdn_connectivity(self):
        """Checks connectivity directly to the ASL Amazon S3 storage CDN."""
        try:
            res = httpx.head("https://pocketsign.s3-us-west-2.amazonaws.com/", timeout=5.0)
            assert res.status_code in [200, 403, 307, 301]
        except (httpx.ConnectError, httpx.TimeoutException):
            pytest.skip("ASL Amazon S3 CDN is currently unreachable")

    def test_fsl_hosting_connectivity(self):
        """Checks connectivity directly to the FSL local hosting server port."""
        try:
            res = httpx.get("http://161.118.197.176:8080/", timeout=5.0)
            assert res.status_code in [200, 403, 404, 301]
        except (httpx.ConnectError, httpx.TimeoutException):
            pytest.skip("FSL local hosting server (161.118.197.176:8080) is currently unreachable")


# ----------------------------------------------------
# 3. Codebase Dictionary Parsing Validation
# ----------------------------------------------------

class TestCoreDictionaryFiles:
    """Tests the integrity and schema of all actual sign dictionaries in the codebase."""

    def test_dictionary_json_structure(self):
        """Verifies Frontend's dictionary.json exists and every entry is complete."""
        assert os.path.exists(DICTIONARY_JSON), f"File missing: {DICTIONARY_JSON}"
        with open(DICTIONARY_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        assert isinstance(data, list), "dictionary.json must be a JSON array"
        assert len(data) > 0, "dictionary.json should contain sign items"
        
        for item in data:
            assert "word" in item, "Item missing 'word' key"
            assert "videoUrl" in item, "Item missing 'videoUrl' key"
            assert "category" in item, "Item missing 'category' key"

    def test_fsl_dictionary_json_structure(self):
        """Verifies Frontend's fsl_dictionary.json parses cleanly and matches the database schema."""
        assert os.path.exists(FSL_DICTIONARY_JSON), f"File missing: {FSL_DICTIONARY_JSON}"
        with open(FSL_DICTIONARY_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        assert isinstance(data, list), "fsl_dictionary.json must be a JSON array"
        assert len(data) > 0, "fsl_dictionary.json should contain sign items"
        
        for item in data:
            assert "word" in item, "FSL Item missing 'word'"
            assert "videoUrl" in item, "FSL Item missing 'videoUrl'"

    def test_verified_signs_list(self):
        """Verifies verified_signs.json contains valid non-empty signs."""
        assert os.path.exists(VERIFIED_SIGNS_JSON), f"File missing: {VERIFIED_SIGNS_JSON}"
        with open(VERIFIED_SIGNS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        assert isinstance(data, list), "verified_signs.json must be a JSON array"
        for entry in data:
            assert isinstance(entry, str)
            assert len(entry.strip()) > 0


class TestLogicExecutionOnRealDictionaryWords:
    """Runs sanitation and tokenization on all words from the actual database."""

    def test_sanitization_on_all_dictionary_words(self):
        """Checks sanitization logic works on every word in the dictionary."""
        with open(DICTIONARY_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for item in data:
            word = item["word"]
            sanitized = sanitize_text(word)
            assert sanitized == sanitized.lower()
            assert not re.search(r'[^\w\s-]', sanitized)

    def test_tokenization_on_all_dictionary_words(self):
        """Checks tokenization logic works on every word in the dictionary."""
        with open(DICTIONARY_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for item in data:
            word = item["word"]
            tokens = tokenize_sentence(word)
            assert isinstance(tokens, list)
            assert len(tokens) > 0

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__]))
