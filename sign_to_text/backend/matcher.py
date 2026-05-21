import os
import json
import numpy as np
import glob

def resample_sequence(seq: np.ndarray, target_len: int) -> np.ndarray:
    L = seq.shape[0]
    if L == target_len:
        return seq
    indices = np.linspace(0, L - 1, target_len).astype(int)
    return seq[indices]

class SkeletonMatcher:
    def __init__(self, skeletons_dir: str, target_len: int = 30):
        self.skeletons_dir = skeletons_dir
        self.target_len = target_len
        self.templates = {} # word -> { "lang": str, "features": np.ndarray, "has_lh": bool, "has_rh": bool }
        self.load_templates()

    def get_hand_features(self, hand_landmarks):
        if not hand_landmarks or len(hand_landmarks) < 21:
            return np.zeros((20, 3), dtype=np.float32)
        
        # Landmark 0 is the wrist
        wrist = np.array([hand_landmarks[0]['x'], hand_landmarks[0]['y'], hand_landmarks[0]['z']], dtype=np.float32)
        # Landmark 5 is the index finger knuckle (MCP)
        mcp = np.array([hand_landmarks[5]['x'], hand_landmarks[5]['y'], hand_landmarks[5]['z']], dtype=np.float32)
        
        scale = np.linalg.norm(mcp - wrist)
        if scale < 1e-4:
            scale = 1.0
            
        features = []
        for i in range(1, 21):
            pt = np.array([hand_landmarks[i]['x'], hand_landmarks[i]['y'], hand_landmarks[i]['z']], dtype=np.float32)
            features.append((pt - wrist) / scale)
        return np.array(features, dtype=np.float32)

    def get_pose_features(self, pose_landmarks):
        # We focus on upper body/arm tracking: shoulders, elbows, wrists
        # 11: left_shoulder, 12: right_shoulder, 13: left_elbow, 14: right_elbow, 15: left_wrist, 16: right_wrist
        if not pose_landmarks or len(pose_landmarks) < 17:
            return np.zeros((6, 3), dtype=np.float32)
            
        pts = {}
        for idx in [11, 12, 13, 14, 15, 16]:
            pts[idx] = np.array([pose_landmarks[idx]['x'], pose_landmarks[idx]['y'], pose_landmarks[idx]['z']], dtype=np.float32)
            
        shoulder_center = (pts[11] + pts[12]) / 2.0
        scale = np.linalg.norm(pts[11] - pts[12])
        if scale < 1e-4:
            scale = 1.0
            
        features = []
        for idx in [11, 12, 13, 14, 15, 16]:
            features.append((pts[idx] - shoulder_center) / scale)
        return np.array(features, dtype=np.float32)

    def extract_sequence_features(self, frames):
        seq_features = []
        has_lh_any = False
        has_rh_any = False

        for frame in frames:
            pose_lms = frame.get('pose')
            lh_lms = frame.get('left_hand')
            rh_lms = frame.get('right_hand')

            # Check if hands are present (non-empty/non-collapsed)
            lh_present = lh_lms is not None and len(lh_lms) >= 21
            rh_present = rh_lms is not None and len(rh_lms) >= 21

            if lh_present:
                # Exclude collapsed/stabilized hands at wrist to prevent false-positives
                if abs(lh_lms[4]['x'] - lh_lms[20]['x']) > 0.01:
                    has_lh_any = True
            if rh_present:
                if abs(rh_lms[4]['x'] - rh_lms[20]['x']) > 0.01:
                    has_rh_any = True

            pose_feat = self.get_pose_features(pose_lms)
            lh_feat = self.get_hand_features(lh_lms)
            rh_feat = self.get_hand_features(rh_lms)

            frame_feat = np.concatenate([pose_feat.flatten(), lh_feat.flatten(), rh_feat.flatten()])
            seq_features.append(frame_feat)

        return np.array(seq_features, dtype=np.float32), has_lh_any, has_rh_any

    def load_templates(self):
        print("Loading skeleton templates...")
        self.templates = {}
        
        # Look for saved skeletons in both asl and fsl subdirectories
        for lang in ['asl', 'fsl']:
            lang_dir = os.path.join(self.skeletons_dir, lang)
            if not os.path.exists(lang_dir):
                continue
                
            json_files = glob.glob(os.path.join(lang_dir, "*.json"))
            for filepath in json_files:
                word = os.path.basename(filepath).replace(".json", "")
                try:
                    with open(filepath, 'r') as f:
                        frames = json.load(f)
                    
                    if not frames or len(frames) < 5:
                        continue
                        
                    features, has_lh, has_rh = self.extract_sequence_features(frames)
                    
                    # Resample template features to fixed target length
                    features_resampled = resample_sequence(features, self.target_len)
                    
                    # Store template
                    self.templates[(lang, word)] = {
                        "word": word,
                        "lang": lang,
                        "features": features_resampled,
                        "has_lh": has_lh,
                        "has_rh": has_rh
                    }
                except Exception as e:
                    print(f"Error loading template {filepath}: {e}")
                    
        print(f"Successfully loaded and resampled {len(self.templates)} templates to {self.target_len} frames.")

    def compute_dtw(self, R: np.ndarray, T: np.ndarray, num_active_dims: int = 138) -> float:
        """
        Fast Dynamic Time Warping distance between reference R (M, D) and test T (N, D).
        """
        M, D = R.shape
        N, _ = T.shape
        
        # Pairwise Euclidean distances normalized by active dimensions (RMS)
        diff = R[:, np.newaxis, :] - T[np.newaxis, :, :]
        dist = np.linalg.norm(diff, axis=-1) / np.sqrt(num_active_dims)
        
        # DP matrix
        dp = np.zeros((M, N), dtype=np.float32)
        dp[0, 0] = dist[0, 0]
        
        for j in range(1, N):
            dp[0, j] = dp[0, j-1] + dist[0, j]
        for i in range(1, M):
            dp[i, 0] = dp[i-1, 0] + dist[i, 0]
            
        for i in range(1, M):
            for j in range(1, N):
                dp[i, j] = dist[i, j] + min(dp[i-1, j], dp[i, j-1], dp[i-1, j-1])
                
        return float(dp[M-1, N-1] / (M + N))

    def find_match(self, input_frames, preferred_lang: str = None, threshold: float = 0.25):
        if len(input_frames) < 15:
            return None, 0.0, None, 0.0

        # Extract features for the entire input sequence
        input_features, input_lh, input_rh = self.extract_sequence_features(input_frames)
        
        L = len(input_features)
        
        # Test different window sizes ending at the current frame
        window_sizes = [40, 60, 80, 100, 120]
        if L >= 15 and L not in window_sizes:
            window_sizes.append(L)
            
        # Only use window sizes <= L
        window_sizes = [w for w in window_sizes if w <= L]
        
        best_word = None
        min_dist = float('inf')
        best_w = None
        
        for w in window_sizes:
            # Slice the last w frames of input features
            window_feat = input_features[-w:]
            window_resampled = resample_sequence(window_feat, self.target_len)
            
            for (lang, word), temp in self.templates.items():
                if preferred_lang and preferred_lang != "all" and temp["lang"] != preferred_lang:
                    continue
                    
                if temp["has_lh"] and not input_lh:
                    continue
                if temp["has_rh"] and not input_rh:
                    continue
                
                # Zero out user hand features that are not expected by the template
                feat_to_compare = window_resampled.copy()
                if not temp["has_lh"]:
                    feat_to_compare[:, 18:78] = 0.0
                if not temp["has_rh"]:
                    feat_to_compare[:, 78:138] = 0.0
                    
                # Calculate active dimensions
                num_active_dims = 18 + (60 if temp["has_lh"] else 0) + (60 if temp["has_rh"] else 0)
                dist = self.compute_dtw(temp["features"], feat_to_compare, num_active_dims)
                
                if dist < min_dist:
                    min_dist = dist
                    best_word = word
                    best_w = w
                    
        # Log best candidate trace to console to aid testing/strictness adjustment
        if best_word:
            print(f"[Matcher Trace] Best candidate: '{best_word}' (dist: {min_dist:.4f}, thresh: {threshold}, window: {best_w})")
            
        if best_word and min_dist <= threshold:
            confidence = 1.0 - (min_dist / threshold)
            return best_word, confidence, best_word, min_dist
            
        return None, 0.0, best_word, min_dist

