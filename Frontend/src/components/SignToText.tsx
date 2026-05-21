import React, { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Shield, StopCircle, RefreshCw, Layers, HelpCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper script loader
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
};

interface SignToTextProps {
  userId: number | null;
  onNewHistoryEntry?: () => void;
  renderTabSwitcher?: () => React.ReactNode;
}

export default function SignToText({ userId, onNewHistoryEntry, renderTabSwitcher }: SignToTextProps) {
  const [status, setStatus] = useState<"idle" | "loading_libs" | "loading_models" | "active" | "error">("idle");
  const [lang, setLang] = useState<"asl" | "fsl" | "all">("asl");
  const [strictness, setStrictness] = useState<number>(60);
  const threshold = 0.60 - (strictness / 200);
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [transcripts, setTranscripts] = useState<{ word: string; time: string; confidence: number }[]>([]);
  const [handsVisible, setHandsVisible] = useState<boolean>(true);
  const [liveTrace, setLiveTrace] = useState<{ candidate: string | null; distance: number; threshold: number } | null>(null);
  const [showTips, setShowTips] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const holisticRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastResultsRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handsVisibleRef = useRef<boolean>(true);
  const lastHandSeenRef = useRef<number>(Date.now());

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Initialize MediaPipe and Camera
  const initializeMediaPipe = async () => {
    // Clean up any stale streams or loops first
    stopTracking();

    try {
      setStatus("loading_libs");

      // 1. Request camera permission immediately to trigger the browser prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.error("Initial camera check failed:", err);
        setStatus("error");
        setErrorMessage("Camera permission denied or camera device not found. Please ensure you have granted camera access in your browser and are not inside an embedded preview iframe.");
        return;
      }
      
      // 2. Load CDN scripts sequentially (no camera_utils.js needed since we use custom getUserMedia loop)
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js");
      
      setStatus("loading_models");
      await setupTracker();
    } catch (err) {
      console.error("Failed to load MediaPipe libs from CDN:", err);
      setStatus("error");
      setErrorMessage("Could not load tracking libraries. Check your internet connection.");
    }
  };

  const setupTracker = async () => {
    const win = window as any;
    if (!win.Holistic) {
      setStatus("error");
      setErrorMessage("MediaPipe Holistic is not available in window context.");
      return;
    }

    try {
      // 1. Initialize Holistic
      const holistic = new win.Holistic({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
      });

      holistic.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        refineFaceLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      holistic.onResults((results: any) => {
        lastResultsRef.current = results;
        isProcessingRef.current = false;
        
        // Send coordinates to WebSocket for matching
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "frame",
            frame: {
              pose: results.poseLandmarks || null,
              left_hand: results.leftHandLandmarks || null,
              right_hand: results.rightHandLandmarks || null,
              face: results.faceLandmarks || null
            }
          }));
        }
      });
      holisticRef.current = holistic;

      // 2. Start webcam stream
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // Wait for video metadata to play
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject(new Error("Video element not found"));
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => resolve()).catch(err => reject(err));
          };
          if (videoRef.current.readyState >= 2) {
            videoRef.current.play().then(() => resolve()).catch(err => reject(err));
          }
        });

        setStatus("active");
        connectWebSocket();
        lastHandSeenRef.current = Date.now();
        handsVisibleRef.current = true;
        setHandsVisible(true);

        // Start requestAnimationFrame loop
        startRenderLoop();
      }
    } catch (err: any) {
      console.error("Holistic setup error:", err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to initialize skeleton tracking models or access camera. Please ensure your camera is connected and not in use by another app.");
    }
  };

  const startRenderLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const run = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // If the stream is stopped or elements are missing, terminate the loop
      if (!streamRef.current || !video || !canvas) {
        animationFrameRef.current = null;
        return;
      }

      // Check if video has enough frames to draw
      if (video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Mirrored draw for natural self-view
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Overlay skeletal landmarks
          if (lastResultsRef.current) {
            drawSkeleton(ctx, lastResultsRef.current);
          }
        }

        // Evaluate hands visibility to warn the user if hands are out of frame
        const now = Date.now();
        const hasLh = !!(lastResultsRef.current?.leftHandLandmarks && lastResultsRef.current.leftHandLandmarks.length > 0);
        const hasRh = !!(lastResultsRef.current?.rightHandLandmarks && lastResultsRef.current.rightHandLandmarks.length > 0);
        
        if (hasLh || hasRh) {
          lastHandSeenRef.current = now;
        }
        
        const isVisible = (now - lastHandSeenRef.current) < 1500;
        if (isVisible !== handsVisibleRef.current) {
          handsVisibleRef.current = isVisible;
          setHandsVisible(isVisible);
        }

        // Asynchronous inference call
        if (holisticRef.current && !isProcessingRef.current) {
          isProcessingRef.current = true;
          try {
            holisticRef.current.send({ image: video });
          } catch (e) {
            console.error("MediaPipe frame send error:", e);
            isProcessingRef.current = false;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(run);
    };

    animationFrameRef.current = requestAnimationFrame(run);
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, results: any) => {
    const win = window as any;
    const drawConnectors = win.drawConnectors;
    const drawLandmarks = win.drawLandmarks;
    const POSE_CONNECTIONS = win.POSE_CONNECTIONS;
    const HAND_CONNECTIONS = win.HAND_CONNECTIONS;
    const FACEMESH_CONTOURS = win.FACEMESH_CONTOURS;

    ctx.save();
    
    // Mirror landmarker points to match mirrored camera output
    const mirrorLandmarks = (lms: any[]) => {
      if (!lms) return null;
      return lms.map(lm => ({
        ...lm,
        x: 1.0 - lm.x
      }));
    };

    const pose = mirrorLandmarks(results.poseLandmarks);
    const leftHand = mirrorLandmarks(results.leftHandLandmarks);
    const rightHand = mirrorLandmarks(results.rightHandLandmarks);
    const face = mirrorLandmarks(results.faceLandmarks);

    // 1. Pose connections (Neon Green)
    if (pose && drawConnectors) {
      drawConnectors(ctx, pose, POSE_CONNECTIONS, { color: "#00FF64", lineWidth: 3 });
      drawLandmarks(ctx, pose, { color: "#00FF00", lineWidth: 1, radius: 4 });
    }

    // 2. Left Hand (Magenta)
    if (leftHand && drawConnectors) {
      drawConnectors(ctx, leftHand, HAND_CONNECTIONS, { color: "#FF00FF", lineWidth: 2 });
      drawLandmarks(ctx, leftHand, { color: "#FFFFFF", lineWidth: 1, radius: 2 });
    }

    // 3. Right Hand (Cyan)
    if (rightHand && drawConnectors) {
      drawConnectors(ctx, rightHand, HAND_CONNECTIONS, { color: "#00FFFF", lineWidth: 2 });
      drawLandmarks(ctx, rightHand, { color: "#FFFFFF", lineWidth: 1, radius: 2 });
    }

    // 4. FaceContours (Soft White/Slate)
    if (face && drawConnectors && FACEMESH_CONTOURS) {
      drawConnectors(ctx, face, FACEMESH_CONTOURS, { color: "rgba(226, 232, 240, 0.35)", lineWidth: 1 });
    }

    ctx.restore();
  };

  // Connect WebSocket
  const connectWebSocket = () => {
    setWsStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws-match`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsStatus("connected");
        ws.send(JSON.stringify({ type: "config", lang, threshold }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "trace") {
          setLiveTrace({
            candidate: data.candidate,
            distance: data.distance,
            threshold: data.threshold
          });
        } else if (data.type === "match") {
          const newWord = data.word;
          const confidence = data.confidence;
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          setTranscripts((prev) => [{ word: newWord, time, confidence }, ...prev]);
          
          // Log history to API if user is logged in
          if (userId) {
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, mode: "s2t", text: newWord }),
            })
              .then(() => onNewHistoryEntry?.())
              .catch((e) => console.error("Error saving search history:", e));
          }
        }
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        console.log("WebSocket matching socket closed.");
      };

      ws.onerror = (err) => {
        console.error("WebSocket matching error:", err);
        setWsStatus("disconnected");
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("WebSocket connection failure:", err);
      setWsStatus("disconnected");
    }
  };

  // Sync config options with the websocket server
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "config", lang, threshold }));
    }
  }, [lang, threshold]);

  const stopTracking = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    lastResultsRef.current = null;
    isProcessingRef.current = false;
    setHandsVisible(true);
    handsVisibleRef.current = true;
    setLiveTrace(null);
    setStatus("idle");
    setWsStatus("disconnected");
  };

  const resetBuffer = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reset" }));
    }
    setLiveTrace(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <>
      {/* LEFT COLUMN: Controls, Loading, transcripts */}
      <div className="col-6" style={{ gridColumn: "span 5" }}>
        <motion.div 
          className="card h-full flex-col" 
          initial={{ x: -50 }}
          animate={{ x: 0 }}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {renderTabSwitcher && renderTabSwitcher()}

          {status === "idle" && (
            <div className="flex-1 flex-col items-center justify-center text-center p-6 min-h-[350px]" style={{ display: "flex", justifyContent: "center" }}>
              {isInIframe && (
                <div 
                  style={{
                    background: "rgba(234, 179, 8, 0.15)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    color: "#f59e0b",
                    padding: "1rem",
                    borderRadius: "var(--rd-sm)",
                    fontSize: "0.85rem",
                    maxWidth: "420px",
                    margin: "0 auto 1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    textAlign: "left",
                    lineHeight: "1.4"
                  }}
                >
                  <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    VS CODE PREVIEW DETECTED
                  </div>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
                    Webcam access is blocked inside the embedded editor preview panel. Please open this app in an <strong>external browser window</strong> by clicking the <strong>"Open in Browser"</strong> icon in the top-right corner of your preview tab.
                  </p>
                </div>
              )}
              <div style={{ position: "relative", marginBottom: "1.5rem" }}>
                <CameraIcon size={64} className="opacity-20" />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                  <Shield size={24} className="text-accent" />
                </div>
              </div>
              <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>
                SIGN-TO-TEXT <span className="badge secondary" style={{ verticalAlign: "middle", marginLeft: "0.5rem" }}>LIVE</span>
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", maxWidth: "320px", margin: "0 auto 2rem" }}>
                Allow camera access to capture skeleton movements and perform real-time matching.
              </p>
              <button className="btn primary" style={{ gap: "10px" }} onClick={initializeMediaPipe}>
                <CameraIcon size={20} /> ENABLE CAMERA
              </button>
            </div>
          )}

          {(status === "loading_libs" || status === "loading_models") && (
            <div className="flex-1 flex-col items-center justify-center text-center p-6 min-h-[350px]" style={{ display: "flex", justifyContent: "center" }}>
              <div className="mb-6">
                <RefreshCw size={48} className="text-accent animate-spin" />
              </div>
              <h4 style={{ fontWeight: 800 }}>
                {status === "loading_libs" ? "LOADING UTILITY LIBRARIES..." : "INITIALIZING AI MODELS..."}
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", maxWidth: "300px", margin: "0.5rem auto 0" }}>
                Downloading tracker modules from CDN. This can take a few seconds...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex-1 flex-col items-center justify-center text-center p-6 min-h-[350px]" style={{ display: "flex", justifyContent: "center" }}>
              <div className="badge accent mb-4" style={{ borderColor: "#ef4444", color: "#ef4444" }}>ERROR</div>
              <h4 style={{ fontWeight: 800 }}>SKELETON TRACKING ERROR</h4>
              <p style={{ fontSize: "0.85rem", color: "#f87171", maxWidth: "340px", margin: "0.5rem auto 2rem" }}>
                {errorMessage}
              </p>
              <button className="btn" onClick={() => setStatus("idle")}>
                TRY AGAIN
              </button>
            </div>
          )}

          {status === "active" && (
            <div className="flex-col gap-4 flex-1" style={{ display: "flex" }}>
              <div className="flex-col gap-2" style={{ display: "flex" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--muted)" }}>TARGET DICTIONARY</label>
                <div className="switcher-pill" style={{ margin: 0, width: "100%" }}>
                  <button
                    className={`btn ghost flex-1 ${lang === "asl" ? "active" : ""}`}
                    onClick={() => setLang("asl")}
                    style={{ fontSize: "0.8rem", padding: "0.4rem" }}
                  >
                    Asl
                  </button>
                  <button
                    className={`btn ghost flex-1 ${lang === "fsl" ? "active" : ""}`}
                    onClick={() => setLang("fsl")}
                    style={{ fontSize: "0.8rem", padding: "0.4rem" }}
                  >
                    Fsl
                  </button>
                  <button
                    className={`btn ghost flex-1 ${lang === "all" ? "active" : ""}`}
                    onClick={() => setLang("all")}
                    style={{ fontSize: "0.8rem", padding: "0.4rem" }}
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="flex-col gap-2" style={{ display: "flex" }}>
                <div className="flex justify-between items-center" style={{ display: "flex" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--muted)" }}>MATCH THRESHOLD</label>
                    <button 
                      onClick={() => setShowTips(true)}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        padding: 0, 
                        cursor: "pointer", 
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center"
                      }}
                      title="Posing Tips"
                    >
                      <HelpCircle size={14} />
                    </button>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700 }}>
                    {strictness}% strictness
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="95"
                  step="5"
                  value={strictness}
                  onChange={(e) => setStrictness(parseInt(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--accent)",
                    background: "var(--border)",
                    height: "6px",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                />
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "1rem",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0 // Allow container to shrink
                }}
              >
                <span className="mb-3" style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--muted)" }}>
                  LIVE TRANSCRIPT
                </span>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: "220px", // Limits to roughly 3 items
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    paddingRight: "4px" // Space for scrollbar
                  }}
                >                  <AnimatePresence initial={false}>
                    {transcripts.length === 0 ? (
                      <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                        <Layers size={32} className="opacity-20 mb-2 mx-auto" style={{ display: "block" }} />
                        Make sign language movements in front of the camera to translate...
                      </div>
                    ) : (
                      transcripts.map((t, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex justify-between items-center"
                          style={{
                            padding: "0.6rem 1rem",
                            background: idx === 0 ? "var(--accent-soft)" : "rgba(255, 255, 255, 0.02)",
                            borderRadius: "var(--rd-sm)",
                            borderLeft: idx === 0 ? "3px solid var(--accent)" : "1px solid var(--border)",
                          }}
                        >
                          <div className="flex-col" style={{ alignItems: "flex-start", gap: "0.1rem", display: "flex" }}>
                            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: idx === 0 ? "var(--accent)" : "white" }}>
                              {t.word.toUpperCase()}
                            </span>
                            <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                              Confidence: {Math.round(t.confidence * 100)}%
                            </span>
                          </div>
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{t.time}</span>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* RIGHT COLUMN: Camera feed viewport or placeholders */}
      <div className="col-6" style={{ gridColumn: "span 7" }}>
        <motion.div 
          className="card featured h-full" 
          initial={{ x: 50 }}
          animate={{ x: 0 }}
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            height: "100%", 
            minHeight: "550px",
            position: "relative",
            padding: "1.5rem"
          }}
        >
          <div className="view-port" style={{ flex: 1, background: "#000", position: "relative", borderRadius: "var(--rd-sm)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* The video element must always be mounted to keep videoRef active */}
            <video
              ref={videoRef}
              style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "640px", height: "480px" }}
              playsInline
              muted
            />

            {/* The canvas element must always be mounted to keep canvasRef active */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "var(--rd-sm)",
                display: status === "active" ? "block" : "none"
              }}
            />

            {/* Hand Warning Overlay */}
            <AnimatePresence>
              {!handsVisible && status === "active" && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  style={{
                    position: "absolute",
                    top: "4.5rem",
                    left: 0,
                    right: 0,
                    margin: "0 auto",
                    width: "fit-content",
                    background: "rgba(239, 68, 68, 0.95)",
                    border: "1px solid #ef4444",
                    boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
                    color: "white",
                    padding: "0.75rem 1.25rem",
                    borderRadius: "var(--rd-sm)",
                    zIndex: 20,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap"
                  }}
                >
                  RAISE YOUR HANDS INTO THE CAMERA FRAME
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overlays / Badges */}
            <div style={{ position: "absolute", top: "1rem", left: "1rem", display: "flex", gap: "0.5rem", zIndex: 10 }}>
              {status === "active" ? (
                <>
                  <span className="badge accent" style={{ background: "rgba(15,23,42,0.8)" }}>
                    CAM ACTIVE
                  </span>
                  <span 
                    className={`badge ${wsStatus === "connected" ? "accent" : wsStatus === "connecting" ? "secondary" : ""}`}
                    style={{ 
                      background: "rgba(15,23,42,0.8)",
                      borderColor: wsStatus === "connected" ? "var(--accent)" : wsStatus === "connecting" ? "var(--secondary)" : "#ef4444",
                      color: wsStatus === "connected" ? "var(--accent)" : wsStatus === "connecting" ? "var(--secondary)" : "#ef4444"
                    }}
                  >
                    WS {wsStatus.toUpperCase()}
                  </span>
                </>
              ) : (
                <span className="badge" style={{ background: "rgba(15,23,42,0.8)", borderColor: "var(--border)" }}>
                  CAM INACTIVE
                </span>
              )}
            </div>

            {/* Live Matcher Trace Overlay */}
            {status === "active" && liveTrace && liveTrace.candidate && (
              <div
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--rd-sm)",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.7rem",
                  color: "white",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                  fontFamily: "monospace"
                }}
              >
                <div style={{ fontWeight: 800, color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                  CURRENT CANDIDATE:
                </div>
                <div>
                  Word: <span style={{ color: "#38bdf8", fontWeight: 700 }}>{liveTrace.candidate.toUpperCase()}</span>
                </div>
                <div>
                  Distance: <span style={{ color: liveTrace.distance <= liveTrace.threshold ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                    {liveTrace.distance.toFixed(4)}
                  </span>
                </div>
                <div>
                  Threshold: <span style={{ color: "var(--muted)" }}>{liveTrace.threshold.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Floating Last Recognized Word Overlay */}
            {transcripts.length > 0 && status === "active" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                key={transcripts[0].word}
                style={{
                  position: "absolute",
                  bottom: "2rem",
                  left: 0,
                  right: 0,
                  margin: "0 auto",
                  width: "fit-content",
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "2px solid var(--accent)",
                  borderRadius: "var(--rd-sm)",
                  padding: "0.5rem 1.5rem",
                  color: "var(--accent)",
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  boxShadow: "0 0 20px var(--accent-soft)",
                  zIndex: 10,
                  pointerEvents: "none"
                }}
              >
                {transcripts[0].word}
              </motion.div>
            )}

            {/* Inactive / Loading / Error Overlay */}
            {status !== "active" && (
              <div 
                style={{ 
                  position: "absolute", 
                  top: 0, 
                  left: 0, 
                  width: "100%", 
                  height: "100%", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  background: "#000",
                  zIndex: 5
                }}
              >
                {status.startsWith("loading") ? (
                  <div className="flex-col items-center justify-center text-center" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RefreshCw size={48} className="text-accent animate-spin mb-4" />
                    <p style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 700 }}>
                      {status === "loading_libs" ? "LOADING LIBRARIES..." : "INITIALIZING MODELS..."}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", maxWidth: "250px", marginTop: "0.5rem" }}>
                      Downloading AI trackers from CDN. Please wait...
                    </p>
                  </div>
                ) : status === "error" ? (
                  <div className="flex-col items-center justify-center text-center opacity-80" style={{ color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CameraIcon size={64} className="mb-4" />
                    <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>WEBCAM UNRESOLVED</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", maxWidth: "300px", marginTop: "0.5rem" }}>
                      {errorMessage || "Error setting up skeletal models or camera access. Check permissions."}
                    </p>
                  </div>
                ) : (
                  <div className="flex-col items-center justify-center text-center opacity-40" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CameraIcon size={64} className="mb-4" />
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Camera Feed Inactive</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", maxWidth: "300px", marginTop: "0.5rem" }}>
                      Click "Enable Camera" in the controls panel to start tracking skeleton movements.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {status === "active" && (
            <div className="flex justify-between items-center gap-3 mt-4" style={{ display: "flex" }}>
              <button className="btn ghost" onClick={resetBuffer} title="Reset current movement sequence">
                <RefreshCw size={16} /> RESET SEQUENCE
              </button>
              <button className="btn ghost" onClick={stopTracking} style={{ color: "#f87171" }}>
                <StopCircle size={16} /> STOP RECORDING
              </button>
            </div>
          )}
        </motion.div>
      </div>
      {/* Posing Tips Modal */}
      <AnimatePresence>
        {showTips && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem"
            }}
            onClick={() => setShowTips(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--rd-lg)",
                width: "100%",
                maxWidth: "400px",
                padding: "2rem",
                position: "relative",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowTips(false)}
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)"
                }}
              >
                <X size={20} />
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--accent)" }}>
                  <HelpCircle size={24} />
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Posing Tips</h3>
                </div>

                <div style={{ color: "var(--muted)", lineHeight: "1.6" }}>
                  <p style={{ marginBottom: "1rem" }}>For the best accuracy when signing, please follow these guidelines:</p>
                  <ul style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingLeft: "1.2rem", margin: 0 }}>
                    <li>
                      <strong style={{ color: "white" }}>Body Position:</strong> Sit or stand back so your entire upper body (head to waist) is visible in the frame.
                    </li>
                    <li>
                      <strong style={{ color: "white" }}>Hand Visibility:</strong> Ensure <strong>both hands</strong> remain inside the camera viewport at all times.
                    </li>
                    <li>
                      <strong style={{ color: "white" }}>Clear Movements:</strong> Move your hands clearly and at a moderate pace. 
                    </li>
                    <li>
                      <strong style={{ color: "white" }}>Neutral Pose:</strong> Return your hands to a neutral position (at your sides or on your lap) after finishing a sign.
                    </li>
                  </ul>
                </div>

                <button
                  className="btn accent"
                  onClick={() => setShowTips(false)}
                  style={{ marginTop: "1rem", width: "100%" }}
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
