import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import "./App.css";

import jerryImage from "./assets/jerry.jpg";
import hallelujahImage from "./assets/hallelujah.jpg";
import dunamisImage from "./assets/dunamis.jpg";
import rccgImage from "./assets/rccg.jpg";
import winnersImage from "./assets/winners.jpg";

import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  increment
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const BACKEND_URL = "https://glive-backend.onrender.com";

/* STREAMS */
const streams = [
  { id: 0, title: "NSPPD", videoId: "5Yc9g5dGqK0", thumb: jerryImage },
  { id: 1, title: "Hallelujah", videoId: "hHW1oY26kxQ", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", videoId: "ysz5S6PUM-U", thumb: dunamisImage },
  { id: 3, title: "RCCG", videoId: "aqz-KE-bpKQ", thumb: rccgImage },
  { id: 4, title: "Winners", videoId: "ScMzIvxBSi4", thumb: winnersImage }
];

/* ================= WATCH PAGE ================= */
function WatchPage() {
  const navigate = useNavigate();

  return (
    <div className="watch-page">
      <div className="live-grid">
        {streams.map(stream => (
          <div
            key={stream.id}
            className="live-card"
            onClick={() => navigate(`/live/${stream.id}`)}
          >
            <img src={stream.thumb} />
            <div className="live-card-title">{stream.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= LIVE VIEW ================= */
function LiveViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const stream = streams.find(s => s.id === Number(id));

  const [videoError, setVideoError] = useState(false);
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");

  const commentRef = useRef(null);

  /* AUTH */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  /* WALLET */
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setCoins(snap.data().coins || 0);
      else setDoc(ref, { email: user.email, coins: 0 });
    });
  }, [user]);

  /* COMMENTS */
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt"), limit(50));
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => d.data()));
    });
  }, []);

  useEffect(() => {
    if (commentRef.current) {
      commentRef.current.scrollTop = commentRef.current.scrollHeight;
    }
  }, [comments]);

  const sendMessage = async () => {
    if (!user) return navigate("/login");
    if (!input.trim()) return;

    await addDoc(collection(db, "comments"), {
      text: input,
      username: user.email,
      createdAt: serverTimestamp()
    });

    setInput("");
  };

  /* PAYSTACK */
  const recharge = () => {
    if (!user) return navigate("/login");

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email,
      amount: 1000 * 100,
      ref: "GLIVE_" + Date.now(),
      callback: function () { }
    });

    handler.openIframe();
  };

  return (
    <div className="live-container">

      {/* VIDEO */}
      {!videoError ? (
        <iframe
          src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&mute=0&playsinline=1`}
          allow="autoplay"
          onError={() => setVideoError(true)}
        />
      ) : (
        <div className="video-error">Live not available</div>
      )}

      {/* WALLET */}
      <div className="top-bar">
        <span onClick={recharge}>🪙 {coins}</span>
      </div>

      {/* COMMENTS */}
      <div className="comment-overlay" ref={commentRef}>
        {comments.map((c, i) => (
          <div key={i} className="comment">
            <strong>{c.username}</strong> {c.text}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="bottom-bar">
        <div className="input-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Comment..."
          />
          <button className="send-btn" onClick={sendMessage}>Send</button>
        </div>
      </div>

    </div>
  );
}

/* ROUTES */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WatchPage />} />
      <Route path="/live/:id" element={<LiveViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}