import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Languages,
  Camera,
  Video,
  Type,
  Settings2,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Volume2,
  History,
  BookOpen,
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  Github,
  ExternalLink,
  Mail,
  User,
  Mic,
  Star,
  ThumbsUp,
  ThumbsDown,
  X,
  Play,
  Trophy,
  Sliders,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Heart,
  LogIn,
  UserPlus,
  LogOut,
  Activity,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  MapPin,
  Award,
  TrendingUp,
  Calendar,
  Info,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import dictionaryData from "./data/fsl_dictionary.json";
import verifiedSigns from "./data/verified_signs.json";
import SkeletonPlayer from "./components/SkeletonPlayer";
import SignToText from "./components/SignToText";
import { TiltCard, BackgroundOrbs } from "./components/TiltCard";
import { TEAM_MEMBERS, FEATURES } from "./constants";

const LOCAL_API = "/api";
const VM_API = "/vm-api";

/* --- Helper Utilities --- */

const interpolateFrames = (frameA: any, frameB: any, count = 15) => {
  const interpolated: any[] = [];
  const LEFT_WRIST = 15,
    RIGHT_WRIST = 16;
  for (let i = 1; i <= count; i++) {
    const alpha = i / (count + 1);
    const newFrame: any = {
      pose: null,
      left_hand: null,
      right_hand: null,
      face: null,
    };
    ["pose", "left_hand", "right_hand", "face"].forEach((key) => {
      let lmsA = frameA[key],
        lmsB = frameB[key];
      if (key === "left_hand" || key === "right_hand") {
        const wristIdx = key === "left_hand" ? LEFT_WRIST : RIGHT_WRIST;
        if (!lmsA && lmsB && frameA.pose) {
          const w = frameA.pose[wristIdx];
          lmsA = Array(21)
            .fill(null)
            .map(() => ({ x: w.x, y: w.y, z: w.z || 0 }));
        } else if (!lmsB && lmsA && frameB.pose) {
          const w = frameB.pose[wristIdx];
          lmsB = Array(21)
            .fill(null)
            .map(() => ({ x: w.x, y: w.y, z: w.z || 0 }));
        }
      }
      if (lmsA && lmsB && lmsA.length === lmsB.length) {
        newFrame[key] = lmsA.map((la: any, idx: number) => {
          const lb = lmsB[idx];
          const res: any = {
            x: la.x * (1 - alpha) + lb.x * alpha,
            y: la.y * (1 - alpha) + lb.y * alpha,
            z: (la.z || 0) * (1 - alpha) + (lb.z || 0) * alpha,
          };
          if (la.visibility !== undefined)
            res.visibility =
              la.visibility * (1 - alpha) + lb.visibility * alpha;
          return res;
        });
      } else if (lmsA) newFrame[key] = lmsA;
      else if (lmsB) newFrame[key] = lmsB;
    });
    interpolated.push(newFrame);
  }
  return interpolated;
};

/* --- Shared Layout Components --- */

const Nav = ({ page, setPage, onOpenPanel, user, onLogout }: any) => (
  <motion.header
    initial={{ y: -100 }}
    animate={{ y: 0 }}
    style={{
      position: "sticky",
      top: 0,
      zIndex: 1000,
      width: "100%",
      background: "rgba(15, 23, 42, 0.7)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
      padding: "1rem 0",
    }}
  >
    <div
      className="container"
      style={{ maxWidth: "1400px", padding: "0 4rem" }}
    >
      <div
        className="flex justify-between items-center"
        style={{ maxWidth: "1200px", margin: "0 auto" }}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex"
          onClick={() => setPage("home")}
          style={{ cursor: "pointer", gap: "12px" }}
        >
          <div
            style={{
              background: "var(--accent)",
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)",
              overflow: "hidden",
            }}
          >
            <img 
              src="/logo.png" 
              alt="BISIG" 
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "cover",
                filter: "brightness(0)" 
              }} 
            />
          </div>
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 900,
              letterSpacing: "-1px",
              margin: 0,
            }}
          >
            BISIG
          </h2>
        </motion.div>
        <nav className="flex items-center" style={{ gap: "2rem" }}>
          <div
            className="hidden md-flex"
            style={{ display: "flex", gap: "0.25rem" }}
          >
            {["home", "translator", "learn", "directory", "about"].map((p) => (
              <motion.button
                key={p}
                whileHover={{ background: "rgba(255,255,255,0.05)" }}
                className={`btn ghost ${page === p ? "active" : ""}`}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.6rem 1.2rem",
                  border:
                    page === p
                      ? "1px solid rgba(34, 197, 94, 0.3)"
                      : "1px solid transparent",
                  color: page === p ? "var(--accent)" : "var(--fg)",
                }}
                onClick={() => setPage(p)}
              >
                {p === "learn"
                  ? "Dictionary"
                  : p === "about"
                    ? "Research"
                    : p.charAt(0).toUpperCase() + p.slice(1)}
              </motion.button>
            ))}
            {user && (
              <motion.button
                whileHover={{ background: "rgba(255,255,255,0.05)" }}
                className={`btn ghost ${page === "dashboard" ? "active" : ""}`}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.6rem 1.2rem",
                  border:
                    page === "dashboard"
                      ? "1px solid rgba(34, 197, 94, 0.3)"
                      : "1px solid transparent",
                  color:
                    page === "dashboard" ? "var(--accent)" : "var(--tertiary)",
                }}
                onClick={() => setPage("dashboard")}
              >
                Dashboard
              </motion.button>
            )}
            {user?.isAdmin && (
              <motion.button
                whileHover={{ background: "rgba(255,255,255,0.05)" }}
                className={`btn ghost ${page === "admin" ? "active" : ""}`}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.6rem 1.2rem",
                  border:
                    page === "admin"
                      ? "1px solid #ef4444"
                      : "1px solid transparent",
                  color: "#ef4444",
                }}
                onClick={() => setPage("admin")}
              >
                Admin
              </motion.button>
            )}
          </div>
          <div
            className="flex"
            style={{
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              paddingLeft: "1.5rem",
              gap: "0.75rem",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.1, background: "rgba(255,255,255,0.05)" }}
              className="btn ghost"
              onClick={() => onOpenPanel("history")}
              style={{ padding: "0.6rem", borderRadius: "12px" }}
              title="Activity"
            >
              <History size={20} />
            </motion.button>
            {user ? (
              <div className="flex gap-3 items-center">
                <motion.div
                  whileHover={{ scale: 1.05, borderColor: "var(--accent)" }}
                  onClick={() => onOpenPanel("profile")}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.1)",
                    background: "var(--surface-lighter)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <User size={18} />
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.1, color: "#ef4444" }}
                  className="btn ghost"
                  onClick={onLogout}
                  style={{ padding: "0.6rem" }}
                >
                  <LogOut size={20} />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)",
                }}
                whileTap={{ scale: 0.95 }}
                className="btn primary"
                onClick={() => onOpenPanel("auth", "login")}
                style={{
                  padding: "0.6rem 1.5rem",
                  fontSize: "0.85rem",
                  borderRadius: "12px",
                }}
              >
                Sign In
              </motion.button>
            )}
          </div>
        </nav>
      </div>
    </div>
  </motion.header>
);

const Foot = () => (
  <footer className="container" style={{ padding: "4rem 0" }}>
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="card hero-gradient"
      style={{ padding: "3rem" }}
    >
      <div className="grid grid-2">
        <div>
          <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
            Bridge the Gap.
          </h2>
          <p
            style={{
              color: "var(--muted)",
              marginBottom: "2rem",
              maxWidth: "400px",
            }}
          >
            A university initiative empowering the Filipino deaf community
            through AI-driven translation.
          </p>
          <div className="flex">
            <button
              className="btn primary"
              onClick={() => (window.location.href = "mailto:benjo@pro.space")}
            >
              Get Involved
            </button>
            <button
              className="btn ghost"
              onClick={() => window.open("/paper.pdf", "_blank")}
            >
              Documentation
            </button>
          </div>
        </div>
        <div
          className="flex-col"
          style={{ borderLeft: "1px solid var(--border)", paddingLeft: "2rem" }}
        >
          <p
            style={{
              fontWeight: 800,
              fontSize: "0.7rem",
              color: "var(--muted)",
              marginBottom: "1rem",
              textTransform: "uppercase",
            }}
          >
            Connect With Us
          </p>
          <div className="flex" style={{ gap: "1rem" }}>
            <Github
              size={20}
              style={{ cursor: "pointer" }}
              onClick={() => window.open("https://github.com/Golgrax/BISIG", "_blank")}
            />
            <ExternalLink
              size={20}
              style={{ cursor: "pointer" }}
              onClick={() => window.open("https://huggingface.co/datasets/Golgrax/bisig-fsl-dataset", "_blank")}
            />
            <Mail
              size={20}
              style={{ cursor: "pointer" }}
              onClick={() => (window.location.href = "mailto:benjo@pro.space")}
            />
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--muted)",
              marginTop: "2rem",
            }}
          >
            © 2026 BISIG Initiative. All rights reserved.
          </p>
        </div>
      </div>
    </motion.div>
  </footer>
);

const SidePanel = ({
  isOpen,
  type,
  onClose,
  data,
  user,
  onLogin,
  onSignup,
  initialAuthMode,
}: any) => {
  const [authMode, setAuthMode] = useState(initialAuthMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (isOpen && initialAuthMode) setAuthMode(initialAuthMode);
    if (isOpen) setCurrentPage(1); // Reset page on open
  }, [isOpen, initialAuthMode]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    if (authMode === "login") await onLogin(email, password);
    else await onSignup(email, password);
    setLoading(false);
  };

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const currentData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="panel-overlay open"
            onClick={onClose}
          ></motion.div>
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="side-panel open"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                {type === "history"
                  ? "Activity"
                  : type === "auth"
                    ? authMode === "login"
                      ? "Welcome Back"
                      : "Create Account"
                    : "Profile"}
              </h2>
              <button
                className="btn ghost"
                onClick={onClose}
                style={{ padding: "0.5rem" }}
              >
                <X size={24} />
              </button>
            </div>
            {type === "history" ? (
              <div
                className="flex-col gap-4"
                style={{ flex: 1, overflow: "hidden" }}
              >
                <div
                  className="flex flex-col gap-4"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    paddingRight: "5px",
                    maxHeight: "calc(100vh - 250px)",
                  }}
                >
                  {data.length === 0 ? (
                    <div className="text-center mt-12">
                      <History
                        size={48}
                        style={{ opacity: 0.1, margin: "0 auto 1rem" }}
                      />
                      <p style={{ color: "var(--muted)" }}>
                        No recent activity found.
                      </p>
                    </div>
                  ) : (
                    currentData.map((item: any, i: number) => (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={`${item.text}-${item.time}-${i}`}
                        className="card"
                        style={{ padding: "1.25rem" }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="badge">
                            {item.mode === "s2t"
                              ? "Sign to Text"
                              : "Text to Sign"}
                          </span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--muted)",
                            }}
                          >
                            {item.time}
                          </span>
                        </div>
                        <p style={{ fontWeight: 600 }}>{item.text}</p>
                      </motion.div>
                    ))
                  )}
                </div>

                {totalPages > 1 && (
                  <div
                    className="flex justify-between items-center mt-6 pt-4"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <button
                      className="btn ghost"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      style={{ fontSize: "0.8rem", opacity: currentPage === 1 ? 0.3 : 1 }}
                    >
                      <ChevronLeft size={18} /> Previous
                    </button>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 700,
                      }}
                    >
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      className="btn ghost"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      style={{ fontSize: "0.8rem", opacity: currentPage === totalPages ? 0.3 : 1 }}
                    >
                      Next <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            ) : type === "auth" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="settings-group">
                  <label className="settings-label">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className="pop-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="settings-group">
                  <label className="settings-label">PASSWORD</label>
                  <input
                    type="password"
                    className="pop-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn primary w-full mt-4"
                  disabled={loading}
                >
                  {loading
                    ? "Authenticating..."
                    : authMode === "login"
                      ? "Sign In"
                      : "Join BISIG"}
                </button>
                <p className="text-center mt-4" style={{ fontSize: "0.9rem" }}>
                  {authMode === "login" ? "New here?" : "Already a member?"}
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ color: "var(--accent)", padding: "0 0.5rem" }}
                    onClick={() =>
                      setAuthMode(authMode === "login" ? "signup" : "login")
                    }
                  >
                    {authMode === "login" ? "Create account" : "Log in"}
                  </button>
                </p>
              </form>
            ) : (
              <div className="flex-col gap-6">
                <div
                  className="card"
                  style={{
                    padding: "2rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      margin: "0 auto 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <User size={32} />
                  </div>
                  <h3 style={{ fontSize: "1rem", wordBreak: "break-all" }}>
                    {user?.username || "Guest Signer"}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Member since 2026
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const HeroSlideshow = () => {
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [nextVideo, setNextVideo] = useState<any>(null);
  const [key, setKey] = useState(0);
  const getRandom = () =>
    dictionaryData[Math.floor(Math.random() * dictionaryData.length)];
  useEffect(() => {
    const first = getRandom();
    const second = getRandom();
    setCurrentVideo(first);
    setNextVideo(second);
  }, []);
  const handleVideoEnd = () => {
    setCurrentVideo(nextVideo);
    setNextVideo(getRandom());
    setKey((prev) => prev + 1);
  };
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "var(--rd-sm)",
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {nextVideo && (
        <video
          key={`buffer-${nextVideo.word}`}
          src={`/videos/${encodeURIComponent(nextVideo.word)}.mp4`}
          preload="auto"
          muted
          style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
        />
      )}
      <AnimatePresence>
        {currentVideo && (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(5px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <video
              ref={(el) => {
                if (el) el.playbackRate = 0.8;
              }}
              src={`/videos/${encodeURIComponent(currentVideo.word)}.mp4`}
              autoPlay
              muted
              onEnded={handleVideoEnd}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "1.5rem",
                left: "1.5rem",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
                padding: "8px 18px",
                borderRadius: "12px",
                fontSize: "0.8rem",
                color: "var(--accent)",
                fontWeight: 900,
                border: "1px solid rgba(34, 197, 94, 0.4)",
                letterSpacing: "1px",
              }}
            >
              {currentVideo.word.toUpperCase()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!currentVideo && <div className="loading-spinner"></div>}
    </div>
  );
};

const LandingPage = ({ setPage }: any) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  return (
    <div className="animate-pop">
      <section
        className="container hero-gradient"
        style={{
          maxWidth: "1400px",
          padding: "8rem 4rem",
          borderRadius: "var(--rd-lg)",
          marginTop: "2rem",
          overflow: "hidden",
        }}
      >
        <div
          className="grid grid-2 items-center"
          style={{ maxWidth: "1200px", margin: "0 auto" }}
        >
          <motion.div style={{ y: y1, paddingRight: "2rem" }}>
            <motion.h1
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                fontSize: "4.5rem",
                marginBottom: "1.5rem",
                lineHeight: 1.1,
                fontWeight: 800,
              }}
            >
              Signs to Speech,{" "}
              <span style={{ color: "var(--accent)" }}>Instantly.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: "1.25rem",
                color: "var(--muted)",
                marginBottom: "3rem",
                maxWidth: "500px",
              }}
            >
              The bidirectional interface for Filipino Sign Language. Powered by
              real-time pose estimation.
            </motion.p>
            <motion.div
              className="flex"
              style={{ gap: "1rem" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn primary"
                style={{ padding: "1rem 2rem" }}
                onClick={() => setPage("translator")}
              >
                Launch App <ArrowRight size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn"
                style={{ padding: "1rem 2rem" }}
                onClick={() => setPage("learn")}
              >
                View Dictionary
              </motion.button>
            </motion.div>
          </motion.div>
          <motion.div
            className="hidden md-block"
            style={{ y: y2, position: "relative" }}
          >
            <motion.div
              className="card featured"
              style={{ padding: "0", height: "520px", overflow: "hidden" }}
            >
              <HeroSlideshow />
            </motion.div>
          </motion.div>
        </div>
      </section>
      <section className="container grid grid-3" style={{ padding: "6rem 0" }}>
        {FEATURES.map((f, i) => (
          <TiltCard
            key={f.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
            viewport={{ once: true }}
          >
            <div
              style={{
                background: "var(--accent-soft)",
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem",
              }}
            >
              {f.id === "realtime" ? (
                <Zap size={24} color="var(--accent)" />
              ) : f.id === "privacy" ? (
                <Shield size={24} color="var(--accent)" />
              ) : (
                <Globe size={24} color="var(--accent)" />
              )}
            </div>
            <h3 className="mb-2">{f.title}</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {f.description}
            </p>
          </TiltCard>
        ))}
      </section>
    </div>
  );
};

const TranslatorPage = ({ addToHistory, user, fetchHistory }: any) => {
  const [activeTab, setActiveTab] = useState<string>("t2s");
  const [inputText, setInputText] = useState("");
  const [tokens, setTokens] = useState<any[]>([]); // Array<{ text: string, isPill: boolean }>
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [format, setFormat] = useState("skeleton");
  const [lang, setLang] = useState("fsl");
  const [mode, setMode] = useState("mixed");
  const [frames, setFrames] = useState<any[]>([]);
  const [videoPlaylist, setVideoPlaylist] = useState<any[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showReference, setShowReference] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const API_BASE = VM_API;
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);

  // Dynamic Word Suggester (Google Translate style)
  useEffect(() => {
    const fullInput = inputText.toLowerCase().trim();
    if (!fullInput) {
      setSuggestions([]);
      return;
    }

    const words = fullInput.split(/\s+/);
    const lastTypedWord = words[words.length - 1];

    if (lastTypedWord.length < 1) {
      setSuggestions([]);
      return;
    }

    // Simple Levenshtein-like distance for "closeness"
    const getDistance = (s1: string, s2: string) => {
      const track = Array(s2.length + 1)
        .fill(null)
        .map(() => Array(s1.length + 1).fill(null));
      for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
      for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
      for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
          const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
          track[j][i] = Math.min(
            track[j][i - 1] + 1,
            track[j - 1][i] + 1,
            track[j - 1][i - 1] + indicator,
          );
        }
      }
      return track[s2.length][s1.length];
    };

    // Filter and SORT by closeness + length penalty
    const scoredMatches = dictionaryData
      .map((item: any) => {
        const word = item.word.toLowerCase();
        const cleanWord = word.replace(/\s*\(variant\s+[a-z]\)\s*/g, "").trim();
        let score = 100;
        let isPhraseMatch = false;

        // Priority 1: Exact match with full input (ignoring variants)
        if (cleanWord === fullInput || word === fullInput) {
          score = 0;
          isPhraseMatch = true;
        }
        // Priority 2: Starts with full input
        else if (word.startsWith(fullInput)) {
          score = 2;
          isPhraseMatch = true;
        }
        // Priority 3: Exact match with last word
        else if (word === lastTypedWord || cleanWord === lastTypedWord) {
          score = 5;
        }
        // Priority 4: Starts with last word
        else if (word.startsWith(lastTypedWord)) {
          score = 10;
        }
        // Priority 5: Contains last word
        else if (word.includes(lastTypedWord)) {
          score = 15;
        } else {
          const dist = getDistance(lastTypedWord, word);
          if (dist <= 2) score = 25 + dist;
        }

        // Length penalty calculation
        // If it's a phrase match, compare against full input length
        // Otherwise compare against last word length
        const baseLength = isPhraseMatch ? fullInput.length : lastTypedWord.length;
        score += (word.length - baseLength) * 0.2;

        // Bonus: favor clean words
        if (word.includes("(")) score += 1;

        return { word: item.word, score, isExact: score < 5 };
      })
      .filter((item) => item.score < 40)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    setSuggestions(scoredMatches as any);
  }, [inputText]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
        setInputText(transcript);
        if (event.results[0].isFinal && wsRef.current?.readyState === WebSocket.OPEN) {
          const words = transcript.trim().split(/\s+/);
          sendToWS(words[words.length - 1]);
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      setStatus("Listening...");
    }
  };
  const sentWordsCountRef = useRef<number>(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendToWS = (word: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ word, lang, mode }));
      setStatus(`Streaming: ${word}`);
    }
  };

  const stopAll = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsPlaying(false);
    setFrames([]);
    setVideoPlaylist([]);
    setPreviewUrl("");
    setTokens([]);
    setInputText("");
    sentWordsCountRef.current = 0;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setStatus("Stopped");
  };
  const startRealtime = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const word = inputText.trim();
      if (word) {
        const words = word.split(/\s+/).filter((w) => w.length > 0);
        while (sentWordsCountRef.current < words.length) {
          sendToWS(words[sentWordsCountRef.current]);
          sentWordsCountRef.current++;
        }
      }
      return;
    }
    stopAll();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/vm-api/ws/translate`;
    wsRef.current = new WebSocket(wsUrl);
    setStatus("Connecting...");
    wsRef.current.onopen = () => {
      setStatus("Live Mode Active - Just start typing!");
      const word = inputText.trim();
      if (word) {
        const words = word.split(/\s+/).filter((w) => w.length > 0);
        while (sentWordsCountRef.current < words.length) {
          sendToWS(words[sentWordsCountRef.current]);
          sentWordsCountRef.current++;
        }
      }
    };
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.frames) {
        setFrames((prev) => [...prev, ...data.frames]);
        setIsPlaying(true);
      }
      if (data.word) setStatus(`Signing: ${data.word}`);
      else if (data.type === "idle") setStatus("Live (Neutral Pose)");
    };
    wsRef.current.onclose = () => {
      setStatus("WebSocket closed.");
      wsRef.current = null;
    };
    wsRef.current.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setStatus("Connection Error");
    };
  };

  const commitSuggestion = (word: string) => {
    const parts = inputText.trim().split(/\s+/);
    const leadWords = parts.slice(0, -1);

    setTokens((prev) => {
      const newTokens = [...prev];
      leadWords.forEach((w) => {
        if (w) newTokens.push({ text: w, isPill: false });
      });
      newTokens.push({ text: word, isPill: true });
      return newTokens;
    });

    setInputText("");
    setSuggestions([]);
    addToHistory({ mode: "t2s", text: word }); // ADD TO HISTORY
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendToWS(word);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CONNECTING)
        return;
      startRealtime();
      return;
    }

    // Space commits whatever was in the box as raw text (not a pill)
    if (val.endsWith(" ")) {
      const newWord = val.trim();
      if (newWord) {
        setTokens((prev) => [...prev, { text: newWord, isPill: false }]);
        addToHistory({ mode: "t2s", text: newWord }); // ADD TO HISTORY
        sendToWS(newWord);
        setInputText("");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Backspace" && inputText === "" && tokens.length > 0) {
      e.preventDefault();
      setTokens((prev) => prev.slice(0, -1));
      if (tokens.length === 1) stopAll();
    }

    if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      const best = suggestions[0];
      const word = typeof best === "string" ? best : (best as any).word;
      commitSuggestion(word);
    }
  };
  const playCurrentVideoInPlaylist = (playlist: any[], index: number) => {
    if (!videoRef.current || index >= playlist.length) return;
    const videoData = playlist[index];
    const originalSource =
      typeof videoData === "string"
        ? videoData
        : videoData.url || videoData.local_url;
    const word =
      typeof videoData === "object" && videoData.word ? videoData.word : "";
    let finalSource = originalSource;
    if (word) finalSource = `/videos/${encodeURIComponent(word)}.mp4`;
    else if (originalSource && originalSource.includes("134.185.92.120:8000")) {
      try {
        const urlObj = new URL(originalSource);
        const fileName = urlObj.pathname.split("/").pop();
        if (fileName?.endsWith(".mp4")) finalSource = `/videos/${fileName}`;
        else finalSource = `${VM_API}${urlObj.pathname}${urlObj.search}`;
      } catch (e) {
        console.error(e);
      }
    }
    videoRef.current.src = finalSource;
    videoRef.current.play().catch((e) => {
      if (finalSource.startsWith("/videos/")) {
        videoRef.current!.src = originalSource.startsWith("http")
          ? `${VM_API}${new URL(originalSource).pathname}`
          : originalSource;
        videoRef.current!.play().catch(() => {});
      }
    });
    if (videoData.url || videoData.remote_url) {
      const pUrl = videoData.remote_url || videoData.url;
      try {
        const urlObj = new URL(pUrl);
        setPreviewUrl(`/videos/${urlObj.pathname.split("/").pop()}`);
      } catch (e) {
        setPreviewUrl(`${VM_API}${new URL(pUrl).pathname}`);
      }
    }
  };
  const translateText = async () => {
    const fullText = [...tokens.map((t) => t.text), inputText.trim()]
      .join(" ")
      .trim();
    if (!fullText) return;
    
    // Stop playback only, don't clear tokens/input
    setIsPlaying(false);
    setFrames([]);
    setVideoPlaylist([]);
    setPreviewUrl("");
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    setIsTranslating(true);
    setStatus("Translating...");
    try {
      const response = await fetch(
        `${API_BASE}/translate?text=${encodeURIComponent(fullText)}&lang=${lang}&mode=${mode}&format=${format}`,
      );
      const parsed = await response.json();
      if (parsed.error || parsed.detail)
        throw new Error(parsed.error || parsed.detail);
      if (parsed.video_blob) {
        setVideoPlaylist([parsed.video_blob]);
        setCurrentVideoIndex(0);
        setIsPlaying(true);
        playCurrentVideoInPlaylist([parsed.video_blob], 0);
        return;
      }
      if (parsed.results && Array.isArray(parsed.results)) {
        if (format === "video") {
          setVideoPlaylist(parsed.results);
          setCurrentVideoIndex(0);
          setIsPlaying(true);
          playCurrentVideoInPlaylist(parsed.results, 0);
        } else {
          let extractedFrames: any[] = [];
          parsed.results.forEach((res: any) => {
            if (res.skeleton && res.skeleton.length > 0) {
              if (extractedFrames.length > 0)
                extractedFrames = extractedFrames.concat(
                  interpolateFrames(
                    extractedFrames[extractedFrames.length - 1],
                    res.skeleton[0],
                    15,
                  ),
                );
              extractedFrames = extractedFrames.concat(res.skeleton);
            }
          });
          if (extractedFrames.length > 0) {
            setFrames(extractedFrames);
            if (parsed.results[0]?.url || parsed.results[0]?.remote_url) {
              const pUrl =
                parsed.results[0].remote_url || parsed.results[0].url;
              try {
                setPreviewUrl(
                  `/videos/${new URL(pUrl).pathname.split("/").pop()}`,
                );
              } catch (e) {
                setPreviewUrl(`${VM_API}${new URL(pUrl).pathname}`);
              }
            }
            setIsPlaying(true);
          } else throw new Error("No results");
        }
        addToHistory({ mode: "t2s", text: fullText, time: "Just now" });
      } else {
        let directFrames = Array.isArray(parsed)
          ? parsed
          : parsed.frames || parsed.skeleton;
        if (directFrames && directFrames.length > 0) {
          setFrames(directFrames);
          setIsPlaying(true);
        } else throw new Error("No signs found for this phrase.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };
  const handleVideoEnd = () => {
    if (currentVideoIndex < videoPlaylist.length - 1) {
      const nextIndex = currentVideoIndex + 1;
      setCurrentVideoIndex(nextIndex);
      playCurrentVideoInPlaylist(videoPlaylist, nextIndex);
    } else {
      setIsPlaying(false);
      setStatus("Finished");
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container"
      style={{ padding: "2rem 0" }}
    >
      <div className="grid grid-12 gap-8">
        {activeTab === "t2s" ? (
          <>
            <div className="col-6" style={{ gridColumn: "span 5" }}>
              <motion.div
                initial={{ x: -50 }}
                animate={{ x: 0 }}
                className="card h-full flex-col"
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="switcher-pill" style={{ margin: 0 }}>
                    <button
                      className="btn ghost active"
                      onClick={() => setActiveTab("t2s")}
                    >
                      Text-to-Sign
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => setActiveTab("s2t")}
                    >
                      Sign-to-Text
                    </button>
                  </div>
                  <button
                    className={`btn ghost ${isListening ? "mic-active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleListening();
                    }}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "50%",
                      background: isListening
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.05)",
                      color: isListening ? "black" : "white",
                      boxShadow: isListening ? "0 0 15px var(--accent)" : "none",
                      transition: "all 0.3s ease",
                      zIndex: 10,
                    }}
                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                  >
                    <Mic size={22} />
                  </button>
                </div>
                <div className="flex-col gap-4 flex-1">
                  <div
                    className="pop-input"
                    style={{
                      flex: 1,
                      minHeight: "150px",
                      display: "flex",
                      flexWrap: "wrap",
                      alignContent: "flex-start",
                      gap: "8px",
                      padding: "1rem",
                      cursor: "text",
                      position: "relative",
                      background: "rgba(255,255,255,0.02)",
                      border: "none",
                    }}
                    onClick={() => document.getElementById("hiddenInput")?.focus()}
                  >
                    <AnimatePresence>
                      {tokens.map((token, idx) =>
                        token.isPill ? (
                          <motion.div
                            key={idx}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="badge accent"
                            style={{
                              padding: "0.5rem 1rem",
                              borderRadius: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "rgba(34, 197, 94, 0.15)",
                              border: "2px solid var(--accent)",
                              boxShadow: "0 0 15px rgba(34, 197, 94, 0.3)",
                              color: "var(--accent)",
                              fontWeight: 800,
                              fontSize: "0.9rem",
                            }}
                          >
                            {token.text}
                            <X
                              size={14}
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTokens(tokens.filter((_, i) => i !== idx));
                              }}
                            />
                          </motion.div>
                        ) : (
                          <span
                            key={idx}
                            style={{
                              padding: "0.5rem 0",
                              fontSize: "1.5rem",
                              fontWeight: 700,
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {token.text}
                          </span>
                        ),
                      )}
                    </AnimatePresence>
                    <textarea
                      id="hiddenInput"
                      style={{
                        flex: 1,
                        minWidth: "150px",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "white",
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        resize: "none",
                        padding: 0,
                        height: "40px",
                      }}
                      placeholder={tokens.length === 0 ? "Enter phrase..." : ""}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="grid grid-2 gap-4">
                    <div className="settings-group">
                      <label className="settings-label">LANGUAGE</label>
                      <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                      >
                        <option value="fsl">FSL (Filipino)</option>
                        <option value="asl">ASL (American)</option>
                      </select>
                    </div>
                    <div className="settings-group">
                      <label className="settings-label">OUTPUT FORMAT</label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                      >
                        <option value="skeleton">Skeleton Data</option>
                        <option value="video">Original Video</option>
                        <option value="full_skeleton_video">
                          Combined Video
                        </option>
                      </select>
                    </div>
                    <div
                      className="settings-group"
                      style={{
                        gridColumn: "span 2",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        id="showRef"
                        checked={showReference}
                        onChange={(e) => setShowReference(e.target.checked)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "var(--accent)",
                        }}
                      />
                      <label
                        htmlFor="showRef"
                        className="settings-label"
                        style={{ marginBottom: 0, cursor: "pointer" }}
                      >
                        SHOW HUMAN REFERENCE VIDEO
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn primary flex-1"
                      onClick={translateText}
                      disabled={isTranslating}
                    >
                      {isTranslating ? (
                        "Working..."
                      ) : (
                        <>
                          <Play size={18} /> TRANSLATE
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn secondary flex-1"
                      onClick={startRealtime}
                    >
                      <Activity size={18} /> LIVE (WS)
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn ghost"
                      onClick={stopAll}
                    >
                      <StopCircle size={18} /> STOP
                    </motion.button>
                  </div>
                </div>
                <div
                  className="mt-6 pt-4 flex flex-col gap-4"
                  style={{
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 800 }}>
                        {suggestions.length > 0 ? "DID YOU MEAN?" : "QUICK STARTERS"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(suggestions.length > 0
                        ? suggestions
                        : [
                            "Hello",
                            "How are you",
                            "Thank you",
                            "Please",
                            "I love you",
                          ]
                      ).map((item: any) => {
                        const word = typeof item === "string" ? item : item.word;
                        const isExact = typeof item === "object" && item.isExact;
                        return (
                          <button
                            key={word}
                            className="btn ghost"
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.4rem 0.9rem",
                              border: isExact
                                ? "2px solid var(--accent)"
                                : suggestions.length > 0
                                  ? "1px solid var(--accent)"
                                  : "1px solid var(--border)",
                              background: isExact
                                ? "rgba(34, 197, 94, 0.15)"
                                : suggestions.length > 0
                                  ? "rgba(34, 197, 94, 0.05)"
                                  : "rgba(255,255,255,0.02)",
                              color:
                                suggestions.length > 0
                                  ? "var(--accent)"
                                  : "var(--fg)",
                              borderRadius: "20px",
                              boxShadow: isExact
                                ? "0 0 15px rgba(34, 197, 94, 0.3)"
                                : "none",
                              fontWeight: isExact ? 800 : 500,
                              transition: "all 0.3s ease",
                            }}
                            onClick={() => {
                              commitSuggestion(word);
                            }}
                          >
                            {word}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <div className="col-6" style={{ gridColumn: "span 7" }}>
              <motion.div
                initial={{ x: 50 }}
                animate={{ x: 0 }}
                className="card featured h-full"
                style={{
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  position: 'relative'
                }}
              >
                <div style={{ 
                  position: 'absolute', 
                  top: '2rem', 
                  right: '2rem', 
                  zIndex: 100,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: (status.includes('Streaming') || status.includes('Signing') || status.includes('Connected')) ? 'var(--accent)' : status.includes('Listening') ? '#3b82f6' : '#ef4444',
                    boxShadow: (status.includes('Streaming') || status.includes('Signing') || status.includes('Connected')) ? '0 0 10px var(--accent)' : status.includes('Listening') ? '0 0 10px #3b82f6' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white', letterSpacing: '1px' }}>
                    {status.includes('Connected') ? 'LIVE READY' : status.toUpperCase()}
                  </span>
                </div>
                <div className="view-port" style={{ flex: 1, background: "#000" }}>
                  <SkeletonPlayer
                    frames={frames}
                    isPlaying={
                      isPlaying &&
                      (format === "skeleton" || format === "full_skeleton_video")
                    }
                    onEnded={() => setStatus("Finished")}
                  />
                  <video
                    ref={videoRef}
                    className={format === "video" ? "" : "hidden"}
                    autoPlay
                    onEnded={handleVideoEnd}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "top center",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  />
                  <AnimatePresence>
                    {previewUrl &&
                      showReference &&
                      (format === "skeleton" ||
                        format === "full_skeleton_video") && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          style={{
                            position: "absolute",
                            bottom: "1rem",
                            right: "1rem",
                            width: "200px",
                            borderRadius: "12px",
                            border: "2px solid var(--accent)",
                            overflow: "hidden",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                            zIndex: 10,
                          }}
                        >
                          <div
                            style={{
                              padding: "4px",
                              background: "var(--accent)",
                              fontSize: "0.6rem",
                              color: "black",
                              fontWeight: 900,
                              textAlign: "center",
                            }}
                          >
                            HUMAN REFERENCE
                          </div>
                          <video
                            src={previewUrl}
                            autoPlay
                            loop
                            muted
                            style={{ width: "100%", display: "block" }}
                          />
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>
                <div className="flex justify-end items-center mt-4 px-2">
                  <div className="badge accent">
                    {format === "skeleton"
                      ? "AI SKELETON"
                      : format === "video"
                        ? "HUMAN VIDEO"
                        : "COMBINED VIEW"}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        ) : (
          <SignToText
            userId={user ? user.userId : null}
            onNewHistoryEntry={() => user && fetchHistory(user.userId)}
            renderTabSwitcher={() => (
              <div className="flex justify-between items-center mb-6">
                <div className="switcher-pill" style={{ margin: 0 }}>
                  <button
                    className="btn ghost"
                    onClick={() => setActiveTab("t2s")}
                  >
                    Text-to-Sign
                  </button>
                  <button
                    className="btn ghost active"
                    onClick={() => setActiveTab("s2t")}
                  >
                    Sign-to-Text
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>
    </motion.div>
  );
};

const DictionaryPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("a-z");
  const [filterCategory, setFilterCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReal, setIsReal] = useState<boolean | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem("bisig_favs") || "[]")),
  );
  const itemsPerPage = 12;
  const toggleFavorite = (e: any, word: string) => {
    e.stopPropagation();
    const newFavs = new Set(favorites);
    if (newFavs.has(word)) newFavs.delete(word);
    else newFavs.add(word);
    setFavorites(newFavs);
    localStorage.setItem("bisig_favs", JSON.stringify(Array.from(newFavs)));
  };
  const categories = useMemo(() => {
    const cats = new Set(dictionaryData.map((item) => item.category));
    return ["All", ...Array.from(cats)].sort();
  }, []);
  const filteredData = useMemo(() => {
    let data = [...dictionaryData].filter(
      (item) =>
        (filterCategory === "All" || item.category === filterCategory) &&
        item.word.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (sortBy === "a-z") data.sort((a, b) => a.word.localeCompare(b.word));
    else if (sortBy === "z-a")
      data.sort((a, b) => b.word.localeCompare(a.word));
    else if (sortBy === "category")
      data.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.word.localeCompare(b.word),
      );
    return data;
  }, [searchTerm, sortBy, filterCategory]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, filterCategory]);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const handleShare = async (word: any) => {
    const url = `${window.location.origin}/videos/${encodeURIComponent(word.word)}.mp4`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `FSL: ${word.word}`, url });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(url);
      alert("Copied!");
    }
  };

  const submitVerification = async (user: any) => {
    if (!user) {
      alert("Please sign in!");
      return;
    }
    if (isReal === null) {
      alert("Please select if sign is real or not!");
      return;
    }
    try {
      await fetch(`${LOCAL_API}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId || user.id,
          word: selectedWord.word,
          isReal,
          feedback: feedbackText,
        }),
      });
      alert("Feedback recorded! +50 Points.");
      setIsVerifying(false);
      setIsReal(null);
      setFeedbackText("");
    } catch (e) {
      console.error(e);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const maxVisible = 7;
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end === totalPages) start = Math.max(1, end - maxVisible + 1);
    return (
      <div className="flex flex-col items-center mt-12 gap-4">
        <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> -{" "}
          <strong>
            {Math.min(currentPage * itemsPerPage, filteredData.length)}
          </strong>{" "}
          of <strong>{filteredData.length}</strong>
        </p>
        <div className="flex gap-2">
          {currentPage > 1 && (
            <button
              className="btn ghost"
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              Prev
            </button>
          )}
          {Array.from({ length: end - start + 1 }).map((_, i) => (
            <button
              key={start + i}
              className={`btn ${currentPage === start + i ? "primary" : "ghost"}`}
              style={{ minWidth: "45px" }}
              onClick={() => setCurrentPage(start + i)}
            >
              {start + i}
            </button>
          ))}
          {currentPage < totalPages && (
            <button
              className="btn ghost"
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container"
      style={{ padding: "4rem 0" }}
    >
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: 800 }}>
            FSL <span style={{ color: "var(--accent)" }}>Dictionary</span>
          </h1>
        </div>
        <div className="flex gap-4 items-center">
          <div className="settings-group">
            <label className="settings-label">FILTER</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ minWidth: "140px" }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-group">
            <label className="settings-label">SORT</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ minWidth: "140px" }}
            >
              <option value="a-z">A-Z</option>
              <option value="z-a">Z-A</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div
            className="settings-group"
            style={{ marginBottom: 0, width: "250px" }}
          >
            <label className="settings-label">SEARCH</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="pop-input"
                placeholder="Search..."
                style={{ paddingLeft: "3rem" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.3,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="dictionary-grid">
        <AnimatePresence mode="popLayout">
          {currentData.map((item: any) => (
            <TiltCard
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ padding: "1rem", cursor: "pointer" }}
              onClick={() => setSelectedWord(item)}
            >
              <div
                style={{
                  background: "#000",
                  borderRadius: "var(--rd-sm)",
                  aspectRatio: "4/3",
                  marginBottom: "1rem",
                  overflow: "hidden",
                }}
              >
                <video
                  src={`/videos/${encodeURIComponent(item.word)}.mp4`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  muted
                  loop
                  onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                  onMouseOut={(e) => {
                    const v = e.target as HTMLVideoElement;
                    v.pause();
                    v.currentTime = 0;
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <h4
                  style={{
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.word}
                </h4>
                <div className="flex gap-2 items-center">
                  {!verifiedSigns.includes(item.word) && (
                  <span title="Pending Verification">
                    <AlertCircle size={14} color="#eab308" />
                  </span>
                  )}
                  <Heart
                    size={14}
                    fill={favorites.has(item.word) ? "#ef4444" : "none"}
                    color={
                      favorites.has(item.word) ? "#ef4444" : "var(--muted)"
                    }
                    onClick={(e) => toggleFavorite(e, item.word)}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </TiltCard>
          ))}
        </AnimatePresence>
      </div>
      {renderPagination()}
      <AnimatePresence>
        {selectedWord && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWord(null)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.9)",
                backdropFilter: "blur(10px)",
              }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card featured"
              style={{
                width: "100%",
                maxWidth: "800px",
                padding: "2rem",
                zIndex: 2001,
                border: "1px solid var(--accent)",
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    {selectedWord.word}{" "}
                    {!verifiedSigns.includes(selectedWord.word) && (
                      <AlertCircle size={24} color="#eab308" />
                    )}
                  </h2>
                  <span className="badge accent">{selectedWord.category}</span>
                </div>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setSelectedWord(null);
                    setIsVerifying(false);
                  }}
                >
                  <X size={32} />
                </button>
              </div>
              {!isVerifying ? (
                <>
                  <div
                    style={{
                      background: "#000",
                      borderRadius: "12px",
                      overflow: "hidden",
                      aspectRatio: "16/9",
                      marginBottom: "2rem",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    }}
                  >
                    <video
                      src={`/videos/${encodeURIComponent(selectedWord.word)}.mp4`}
                      style={{ width: "100%", height: "100%" }}
                      controls
                      autoPlay
                      loop
                    />
                  </div>
                  <div className="flex gap-4">
                    <a
                      href={`/videos/${encodeURIComponent(selectedWord.word)}.mp4`}
                      download
                      className="btn primary flex-1"
                    >
                      Download
                    </a>
                    <button
                      className="btn secondary flex-1"
                      onClick={() => handleShare(selectedWord)}
                    >
                      Share
                    </button>
                    {!verifiedSigns.includes(selectedWord.word) && (
                      <button
                        className="btn ghost flex-1"
                        onClick={() => setIsVerifying(true)}
                      >
                        <Shield size={16} /> Verify Sign
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-col gap-6"
                >
                  <h3 className="mb-4">Is this sign correct?</h3>
                  <div className="flex gap-4 mb-6">
                    <button
                      className={`btn flex-1 ${isReal === true ? "primary" : "ghost"}`}
                      onClick={() => setIsReal(true)}
                      style={{ gap: "10px" }}
                    >
                      <ThumbsUp size={20} /> AUTHENTIC
                    </button>
                    <button
                      className={`btn flex-1 ${isReal === false ? "secondary" : "ghost"}`}
                      onClick={() => setIsReal(false)}
                      style={{
                        background: isReal === false ? "#ef4444" : "",
                        border: isReal === false ? "none" : "",
                        gap: "10px",
                      }}
                    >
                      <ThumbsDown size={20} /> INCORRECT
                    </button>
                  </div>
                  <textarea
                    className="pop-input mb-6"
                    style={{ minHeight: "120px" }}
                    placeholder="Add your feedback or comments here..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn primary flex-1"
                      onClick={() =>
                        submitVerification(
                          JSON.parse(
                            localStorage.getItem("bisig_user") || "null",
                          ),
                        )
                      }
                    >
                      Submit Feedback
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => setIsVerifying(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const DirectoryPage = () => {
  const [interpreters, setInterpreters] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    fetch(`${LOCAL_API}/interpreters`)
      .then((r) => r.json())
      .then(setInterpreters);
    fetch(`${LOCAL_API}/establishments`)
      .then((r) => r.json())
      .then(setSpots);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container"
      style={{ padding: "4rem 0" }}
    >
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: 800 }}>
            Sign-Link <span style={{ color: "var(--accent)" }}>Directory</span>
          </h1>
          <p style={{ color: "var(--muted)" }}>
            Certified FSL professionals and inclusive spaces.
          </p>
        </div>
      </div>
      <div className="grid grid-2 gap-12">
        <div>
          <h3 className="mb-6 flex items-center gap-3">
            <Users size={24} color="var(--accent)" /> FSL Interpreters
          </h3>
          <div className="flex flex-col gap-4">
            <TiltCard
              className="text-center"
              style={{
                padding: "3rem 2rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.1)",
              }}
            >
              <Users
                size={48}
                opacity={0.1}
                style={{ margin: "0 auto 1rem" }}
              />
              <h4 style={{ margin: 0, color: "var(--muted)" }}>
                Registry Opening Soon
              </h4>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  marginTop: "0.5rem",
                }}
              >
                We are currently verifying certified FSL interpreters.
              </p>
            </TiltCard>
          </div>
        </div>
        <div>
          <h3 className="mb-6 flex items-center gap-3">
            <Globe size={24} color="var(--accent)" /> Inclusive Spaces
          </h3>
          <div className="flex flex-col gap-4">
            <TiltCard
              className="text-center"
              style={{
                padding: "3rem 2rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.1)",
              }}
            >
              <MapPin
                size={48}
                opacity={0.1}
                style={{ margin: "0 auto 1rem" }}
              />
              <h4 style={{ margin: 0, color: "var(--muted)" }}>
                No Spaces Listed Yet
              </h4>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--muted)",
                  marginTop: "0.5rem",
                }}
              >
                Stay tuned! Partnership in progress.
              </p>
            </TiltCard>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "6rem", borderTop: "1px solid var(--border)", paddingTop: "4rem" }}>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Globe size={28} className="text-accent" />
          Trusted External ASL Resources
        </h2>
        
        <div className="dictionary-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          <TiltCard style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Gallaudet University ASL Connect</h3>
              <ExternalLink size={16} className="text-accent" />
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
              Comprehensive courses and learning materials from Gallaudet University, the world's premier institution for Deaf education.
            </p>
            <a href="https://gallaudet.edu/asl-connect/" target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ marginTop: "auto", fontSize: "0.8rem", padding: "0.5rem" }}>
              Visit Site
            </a>
          </TiltCard>

          <TiltCard style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>National Association of the Deaf</h3>
              <ExternalLink size={16} className="text-accent" />
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
              Authoritative resources on American Sign Language, Deaf culture, language rights, and advocacy.
            </p>
            <a href="https://nad.org/resources/american-sign-language/" target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ marginTop: "auto", fontSize: "0.8rem", padding: "0.5rem" }}>
              Visit Site
            </a>
          </TiltCard>

          <TiltCard style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Lifeprint ASL University</h3>
              <ExternalLink size={16} className="text-accent" />
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
              Extensive ASL lessons, dictionary references, and high-quality educational material from Dr. Bill Vicars.
            </p>
            <a href="https://lifeprint.com/" target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ marginTop: "auto", fontSize: "0.8rem", padding: "0.5rem" }}>
              Visit Site
            </a>
          </TiltCard>

          <TiltCard style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>INC Sign Language</h3>
              <ExternalLink size={16} className="text-accent" />
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
              Inclusive sign language resources and application provided by the Christian Era Broadcasting Service International.
            </p>
            <div className="flex gap-2" style={{ marginTop: "auto" }}>
              <a href="https://signlanguage.iglesianicristo.net/" target="_blank" rel="noopener noreferrer" className="btn ghost flex-1" style={{ fontSize: "0.8rem", padding: "0.5rem" }}>
                Web
              </a>
              <a href="https://play.google.com/store/apps/details?id=org.iglesianicristo.cfo.csd.incsignlanguageapp" target="_blank" rel="noopener noreferrer" className="btn ghost flex-1" style={{ fontSize: "0.8rem", padding: "0.5rem" }}>
                Android
              </a>
            </div>
          </TiltCard>
        </div>
      </div>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${LOCAL_API}/admin/feedbacks`)
      .then((r) => r.json())
      .then((data) => {
        setFeedbacks(data);
        setLoading(false);
      });
  }, []);
  const adminAction = async (
    id: number,
    word: string,
    action: "APPROVE" | "REJECT",
  ) => {
    try {
      await fetch(`${LOCAL_API}/admin/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, word, action }),
      });
      alert(`Word "${word}" has been ${action.toLowerCase()}d.`);
      fetch(`${LOCAL_API}/admin/feedbacks`)
        .then((r) => r.json())
        .then(setFeedbacks);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading)
    return (
      <div
        className="container"
        style={{
          padding: "12rem 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div className="loading-spinner"></div>
      </div>
    );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container"
      style={{ padding: "4rem 0" }}
    >
      <div className="mb-12">
        <h1 style={{ fontSize: "3.5rem", fontWeight: 800 }}>
          Admin <span style={{ color: "#ef4444" }}>Control Panel</span>
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Reviewing community feedback and sign verifications.
        </p>
      </div>
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "var(--muted)",
              fontSize: "0.8rem",
            }}
          >
            <tr>
              <th style={{ padding: "1.5rem" }}>WORD</th>
              <th style={{ padding: "1.5rem" }}>USER</th>
              <th style={{ padding: "1.5rem" }}>STATUS</th>
              <th style={{ padding: "1.5rem" }}>FEEDBACK</th>
              <th style={{ padding: "1.5rem" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((f, i) => (
              <tr
                key={i}
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <td style={{ padding: "1.5rem", fontWeight: 800 }}>{f.word}</td>
                <td style={{ padding: "1.5rem" }}>{f.username}</td>
                <td style={{ padding: "1.5rem" }}>
                  {f.is_real ? (
                    <span style={{ color: "var(--accent)" }}>AUTHENTIC</span>
                  ) : (
                    <span style={{ color: "#ef4444" }}>INCORRECT</span>
                  )}
                </td>
                <td
                  style={{
                    padding: "1.5rem",
                    color: "var(--muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  {f.feedback || "No comments"}
                </td>
                <td style={{ padding: "1.5rem" }}>
                  <div className="flex gap-2">
                    <button
                      className="btn primary"
                      style={{ fontSize: "0.7rem", padding: "0.4rem 0.8rem" }}
                      onClick={() => adminAction(f.id, f.word, "APPROVE")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn secondary"
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.4rem 0.8rem",
                        background: "#ef4444",
                      }}
                      onClick={() => adminAction(f.id, f.word, "REJECT")}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {feedbacks.length === 0 && (
          <div className="text-center p-12 color-var(--muted)">
            No pending feedback records.
          </div>
        )}
      </div>
    </motion.div>
  );
};

const DashboardPage = ({ user }: any) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetch(`${LOCAL_API}/user-stats/${user.userId || user.id}`)
        .then(async (r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          setStats(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);
  if (!user) return null;
  if (loading || !stats)
    return (
      <div
        className="container"
        style={{
          padding: "12rem 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <div className="loading-spinner"></div>
        <p
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "1px",
          }}
        >
          SYNCING YOUR PROGRESS...
        </p>
      </div>
    );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container"
      style={{ padding: "4rem 0" }}
    >
      <div className="flex justify-between items-start mb-12">
        <div>
          <h1 style={{ fontSize: "3.5rem", fontWeight: 800 }}>
            Mabuhay,{" "}
            <span style={{ color: "var(--accent)" }}>{user.username}</span>!
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>
            You are a <strong>Level {stats.level} Bridge Builder</strong>.
          </p>
        </div>
        <div
          className="card"
          style={{ padding: "1rem 2rem", display: "flex", gap: "2rem" }}
        >
          <div className="text-center">
            <p className="settings-label">POINTS</p>
            <h3 style={{ margin: 0, color: "var(--accent)" }}>
              {stats.points.toLocaleString()}
            </h3>
          </div>
          <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }} />
          <div className="text-center">
            <p className="settings-label">RANK</p>
            <h3 style={{ margin: 0 }}>{stats.rank}</h3>
          </div>
        </div>
      </div>
      <div className="grid grid-2 gap-8 mb-12">
        <TiltCard
          className="text-center featured"
          style={{ padding: "4rem 2rem" }}
        >
          <Trophy
            size={64}
            color="var(--tertiary)"
            style={{ margin: "0 auto 1.5rem" }}
          />
          <h3 style={{ fontSize: "4rem", margin: 0 }}>{stats.streak}</h3>
          <p
            style={{
              color: "var(--muted)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Day Streak
          </p>
        </TiltCard>
        <TiltCard className="text-center" style={{ padding: "4rem 2rem" }}>
          <Award
            size={64}
            color="var(--accent)"
            style={{ margin: "0 auto 1.5rem" }}
          />
          <h3 style={{ fontSize: "4rem", margin: 0 }}>{stats.points}</h3>
          <p
            style={{
              color: "var(--muted)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Contribution Points
          </p>
        </TiltCard>
      </div>
    </motion.div>
  );
};

const ResearchPage = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="container"
    style={{ padding: "4rem 0" }}
  >
    <div className="grid grid-2 items-center mb-12">
      <motion.div initial={{ x: -50 }} whileInView={{ x: 0 }}>
        <h1
          style={{ fontSize: "3.5rem", fontWeight: 800, marginBottom: "2rem" }}
        >
          Research & <span style={{ color: "var(--accent)" }}>Impact.</span>
        </h1>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "1.1rem",
            marginBottom: "2rem",
          }}
        >
          BISIG is a university-led research initiative focused on digital
          inclusivity.
        </p>
        <div className="flex">
          <button
            className="btn primary"
            onClick={() => window.open("/paper.pdf", "_blank")}
          >
            Read Paper
          </button>
          <button
            className="btn"
            onClick={() =>
              window.open(
                "https://huggingface.co/datasets/Golgrax/bisig-fsl-dataset",
                "_blank"
              )
            }
          >
            Dataset
          </button>
        </div>
      </motion.div>
      <motion.div
        initial={{ x: 50, rotate: 5 }}
        whileInView={{ x: 0, rotate: 1 }}
        className="card featured"
      >
        <h3 className="mb-4">Data Driven</h3>
        <p style={{ color: "var(--muted)" }}>
          MediaPipe robust pose estimation.
        </p>
      </motion.div>
    </div>
    <div className="text-center mb-8">
      <h2 style={{ fontSize: "2rem" }}>The Research Team</h2>
    </div>
    <div className="grid grid-4">
      {TEAM_MEMBERS.map((m, i) => (
        <TiltCard
          key={m.name}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="text-center"
          style={{ padding: "1.5rem" }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              background: "var(--bg)",
              borderRadius: "50%",
              margin: "0 auto 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={30} opacity={0.3} />
          </div>
          <h4 style={{ fontSize: "0.9rem" }}>{m.name.split(",")[1]}</h4>
          <p
            style={{
              fontSize: "0.7rem",
              color: "var(--muted)",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            {m.role}
          </p>
        </TiltCard>
      ))}
    </div>
  </motion.div>
);

const App = () => {
  const [page, setPage] = useState("home");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("history");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    const savedUser = localStorage.getItem("bisig_user");
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      fetchHistory(u.userId);
    }
  }, []);
  const fetchHistory = async (userId: string) => {
    try {
      const response = await fetch(`${LOCAL_API}/history/${userId}`);
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };
  const onLogin = async (email: string, pass: string) => {
    try {
      const response = await fetch(`${LOCAL_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: pass }),
      });
      const data = await response.json();
      if (data.success) {
        const u = {
          userId: data.userId,
          username: data.username,
          isAdmin: data.isAdmin,
        };
        setUser(u);
        localStorage.setItem("bisig_user", JSON.stringify(u));
        fetchHistory(data.userId);
        setIsPanelOpen(false);
      } else alert(data.message);
    } catch (err) {
      alert("Error");
    }
  };
  const onSignup = async (email: string, pass: string) => {
    try {
      const response = await fetch(`${LOCAL_API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: pass }),
      });
      const data = await response.json();
      if (data.success) onLogin(email, pass);
      else alert(data.message);
    } catch (err) {
      alert("Error");
    }
  };
  const onLogout = () => {
    setUser(null);
    setHistory([]);
    localStorage.removeItem("bisig_user");
    setIsPanelOpen(false);
  };
  const addToHistory = async (entry: any) => {
    const normalizedText = entry.text.trim();
    if (user) {
      try {
        await fetch(`${LOCAL_API}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.userId,
            mode: entry.mode,
            text: normalizedText,
          }),
        });
        await fetchHistory(user.userId);
      } catch (err) {
        console.error(err);
      }
    } else {
      setHistory((prev) => {
        // De-duplicate: remove existing entry with same normalized text and mode
        const filtered = prev.filter(
          (item) =>
            !(
              item.text.trim().toLowerCase() === normalizedText.toLowerCase() &&
              item.mode === entry.mode
            ),
        );
        return [{ ...entry, text: normalizedText, time: "Just now" }, ...filtered];
      });
    }
  };
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <BackgroundOrbs />
      <Nav
        page={page}
        setPage={setPage}
        onOpenPanel={(t: any, m?: string) => {
          setActivePanel(t);
          if (m) setAuthMode(m);
          setIsPanelOpen(true);
        }}
        user={user}
        onLogout={onLogout}
      />
      <main style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {page === "home" && <LandingPage setPage={setPage} />}
            {page === "translator" && (
              <TranslatorPage 
                addToHistory={addToHistory} 
                user={user} 
                fetchHistory={fetchHistory} 
              />
            )}
            {page === "learn" && <DictionaryPage />}
            {page === "directory" && <DirectoryPage />}
            {page === "about" && <ResearchPage />}
            {page === "dashboard" && <DashboardPage user={user} />}
            {page === "admin" && <AdminDashboard />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Foot />
      <SidePanel
        isOpen={isPanelOpen}
        type={activePanel}
        initialAuthMode={authMode}
        onClose={() => setIsPanelOpen(false)}
        data={history}
        user={user}
        onLogin={onLogin}
        onSignup={onSignup}
      />
    </div>
  );
};
export default App;
