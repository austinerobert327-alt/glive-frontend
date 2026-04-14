import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
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

const streams = [
  { id: 0, title: "NSPPD", videoId: "5Yc9g5dGqK0", thumb: jerryImage },
  { id: 1, title: "Hallelujah", videoId: "hHW1oY26kxQ", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", videoId: "ysz5S6PUM-U", thumb: dunamisImage },
  { id: 3, title: "RCCG", videoId: "aqz-KE-bpKQ", thumb: rccgImage },
  { id: 4, title: "Winners", videoId: "ScMzIvxBSi4", thumb: winnersImage }
];

function WatchPage() {
  const navigate = useNavigate();
  return (
    <div className="watch-page">
      <div className="live-grid">
        {streams.map(stream => (
          <div key={stream.id} className="live-card" onClick={() => navigate("/live")}>
            <img src={stream.thumb} />
            <div className="live-card-title">{stream.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveViewer() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [likes, setLikes] = useState([]);
  const [giftAnim, setGiftAnim] = useState(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);

  const commentRef = useRef(null);

  useEffect(() => {
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setCoins(snap.data().coins || 0);
      else setDoc(ref, { email: user.email, coins: 0 });
    });
  }, [user]);

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

  const recharge = () => {
    if (!user) return navigate("/login");

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email,
      amount: 1000 * 100,
      ref: "GLIVE_" + Date.now(),

      callback: function (res) {
        fetch(`${BACKEND_URL}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: res.reference,
            userId: user.uid
          })
        });
      }
    });

    handler.openIframe();
  };

  const sendLike = () => {
    const id = Date.now();
    const colors = ["#ff2d55", "#ff9500", "#00e676", "#ffcc00"];

    setLikes(prev => [
      ...prev,
      { id, color: colors[Math.floor(Math.random() * colors.length)], left: Math.random() * 80 }
    ]);

    setTimeout(() => {
      setLikes(prev => prev.filter(l => l.id !== id));
    }, 2500);
  };

  const triggerGift = (emoji) => {
    setGiftAnim(emoji);
    setTimeout(() => setGiftAnim(null), 1500);
  };

  const sendGift = async (cost, emoji) => {
    if (!user) return navigate("/login");

    if (coins < cost) {
      recharge();
      return;
    }

    await setDoc(doc(db, "users", user.uid), {
      coins: increment(-cost)
    }, { merge: true });

    triggerGift(emoji);
    setShowGiftPanel(false);
  };

  return (
    <div className="live-scroll-container">

      {streams.map(stream => (
        <div key={stream.id} className="live-stream-page">

          {/* VIDEO */}
          <iframe
            src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&mute=1&playsinline=1`}
            allow="autoplay"
          />

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

          {/* LIKES */}
          <div className="like-container">
            {likes.map(l => (
              <span key={l.id} className="heart" style={{ left: `${l.left}%`, color: l.color }}>
                ❤️
              </span>
            ))}
          </div>

          {/* GIFT ANIMATION */}
          {giftAnim && <div className="gift-center">{giftAnim}</div>}

          {/* BOTTOM BAR */}
          <div className="bottom-bar">

            <div className="input-box">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Comment..."
              />
              <button className="send-btn" onClick={sendMessage}>Send</button>
            </div>

            <button className="gift-btn"
              onClick={() => (coins === 0 ? recharge() : setShowGiftPanel(true))}>
              🎁
            </button>

            {/* ✅ LIKE MOVED TO EXTREME RIGHT */}
            <button className="like-btn" onClick={sendLike}>❤️</button>

          </div>

          {/* GIFT PANEL */}
          <div className={`gift-modal ${showGiftPanel ? "active" : ""}`}>
            <div className="gift-grid">
              <div onClick={() => sendGift(5, "🎁")}>🎁 5</div>
              <div onClick={() => sendGift(20, "💎")}>💎 20</div>
              <div onClick={() => sendGift(50, "🏆")}>🏆 50</div>
            </div>

            <button className="close-btn" onClick={() => setShowGiftPanel(false)}>Close</button>
          </div>

        </div>
      ))}

    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WatchPage />} />
      <Route path="/live" element={<LiveViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}