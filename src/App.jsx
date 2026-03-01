import { useEffect, useRef, useState, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const HANDLE = "pastorjerryeze";

function LiveApp() {
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [floatingLikes, setFloatingLikes] = useState([]);
  const [user, setUser] = useState(null);

  const commentRef = useRef(null);
  const navigate = useNavigate();

  /* AUTH */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  /* FETCH YOUTUBE */
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${HANDLE}&key=${API_KEY}`
        );
        const channelData = await channelRes.json();
        if (!channelData.items?.length) return;

        const channelId = channelData.items[0].id.channelId;

        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
        );
        const liveData = await liveRes.json();

        if (liveData.items?.length > 0) {
          setVideoId(liveData.items[0].id.videoId);
          setIsLive(true);
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchVideo();
  }, []);

  /* COMMENTS */
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => doc.data()));
    });
  }, []);

  /* AUTO SCROLL */
  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments]);

  /* SEND MESSAGE */
  const sendMessage = useCallback(async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!input.trim()) return;

    await addDoc(collection(db, "comments"), {
      text: input,
      username: user.displayName || user.email,
      uid: user.uid,
      createdAt: serverTimestamp(),
    });

    setInput("");
  }, [input, user]);

  /* HEARTS */
  const sendLike = () => {
    if (floatingLikes.length > 25) return;

    const id = Date.now();
    const colors = ["#ff2d55", "#ff5e3a", "#ff9500"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    setFloatingLikes((prev) => [
      ...prev,
      { id, color: randomColor, left: Math.random() * 60 },
    ]);

    setTimeout(() => {
      setFloatingLikes((prev) => prev.filter((h) => h.id !== id));
    }, 3000);
  };

  return (
    <div className="mobile-container">
      {!showModal && (
        <div className="card">
          {isLive && <span className="live-badge">LIVE</span>}
          <img src={jerryImage} alt="Live preview" />
          <button onClick={() => setShowModal(true)}>
            Watch Live
          </button>
        </div>
      )}

      {showModal && (
        <div className="live-screen">
          <div className="video-wrapper">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`}
              allow="autoplay"
              allowFullScreen
              title="Live"
            />
          </div>

          <div className="top-overlay">
            {isLive && <span className="live-badge">LIVE</span>}
            <span className="viewer-count">👁 1.2K</span>
          </div>

          <div className="close-btn" onClick={() => setShowModal(false)}>
            ✕
          </div>

          <div className="comment-overlay" ref={commentRef}>
            {comments.map((c, i) => (
              <div key={i} className="comment">
                <strong>{c.username}:</strong> {c.text}
              </div>
            ))}
          </div>

          <div className="right-actions">
            <button onClick={sendLike}>❤️</button>
            <button disabled={!user}>🎁</button>
          </div>

          <div className="floating-container">
            {floatingLikes.map((heart) => (
              <div
                key={heart.id}
                className="floating-heart"
                style={{
                  left: `${heart.left}%`,
                  color: heart.color,
                }}
              >
                ❤️
              </div>
            ))}
          </div>

          <div className="bottom-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add comment..."
            />
            <button onClick={sendMessage}>
              {user ? "Send" : "Login"}
            </button>
          </div>

          {user && (
            <button
              style={{ position: "fixed", top: 15, right: 60 }}
              onClick={() => signOut(getAuth())}
            >
              Logout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LiveApp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}