import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";

import jerryImage from "./assets/jerry.jpg";
import hallelujahImage from "./assets/hallelujah.jpg";
import dunamisImage from "./assets/dunamis.jpg";
import rccgImage from "./assets/rccg.jpg";
import winnersImage from "./assets/winners.jpg";

import giftSound from "./assets/gift.mp3";

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
import { usePaystackPayment } from "react-paystack";

import Login from "./pages/Login";
import Register from "./pages/Register";

const BACKEND_URL = "https://glive-backend.onrender.com";
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

/* 🔥 STRICT CHRISTIAN STREAMS */
const streams = [
  { id: 0, title: "NSPPD", videoId: "5Yc9g5dGqK0", thumb: jerryImage },
  { id: 1, title: "Hallelujah Challenge", videoId: "hHW1oY26kxQ", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", videoId: "ysz5S6PUM-U", thumb: dunamisImage },
  { id: 3, title: "RCCG", videoId: "aqz-KE-bpKQ", thumb: rccgImage },
  { id: 4, title: "Winners Chapel", videoId: "ScMzIvxBSi4", thumb: winnersImage }
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
            onClick={() => navigate("/live")}
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
  const navigate = useNavigate();

  const userIdRef = useRef(null);
  const audioRef = useRef(null);

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [showGiftPanel, setShowGiftPanel] = useState(false);

  const rechargeAmount = 1000;

  /* AUTH */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) userIdRef.current = u.uid;
    });
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
  const paystackConfig = user
    ? {
      reference: new Date().getTime().toString(),
      email: user.email,
      amount: rechargeAmount * 100,
      publicKey: PAYSTACK_PUBLIC_KEY,
    }
    : null;

  const initializePayment = paystackConfig ? usePaystackPayment(paystackConfig) : null;

  const rechargeWallet = () => {
    if (!userIdRef.current) return navigate("/login");

    initializePayment({
      onSuccess: async (response) => {
        await fetch(`${BACKEND_URL}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: response.reference,
            userId: userIdRef.current
          }),
        });
      }
    });
  };

  /* GIFT */
  const triggerGiftAnimation = (cost) => {
    const el = document.createElement("div");
    el.className = "gift-center";
    el.innerText = `🎁 x${cost}`;
    document.body.appendChild(el);

    audioRef.current?.play().catch(() => { });

    setTimeout(() => el.remove(), 1500);
  };

  const sendGift = async (cost) => {
    if (!user) return navigate("/login");
    if (coins < cost) return alert("Insufficient coins");

    await setDoc(doc(db, "users", user.uid), {
      coins: increment(-cost)
    }, { merge: true });

    triggerGiftAnimation(cost);
    setShowGiftPanel(false);
  };

  return (
    <div className="live-scroll-container">

      <audio ref={audioRef} src={giftSound} />

      {streams.map((stream) => (
        <div key={stream.id} className="live-stream-page">

          {/* VIDEO FRAME */}
          <div className="video-frame">
            <iframe
              src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media"
            />
          </div>

          {/* TOP */}
          <div className="top-bar">
            <span onClick={rechargeWallet}>🪙 {coins}</span>
          </div>

          {/* RIGHT */}
          <div className="right-icons">
            <button>❤️</button>
            <button onClick={() => setShowGiftPanel(true)}>🎁</button>
          </div>

          {/* COMMENTS */}
          <div className="comment-overlay">
            {comments.map((c, i) => (
              <div key={i} className="comment">
                <strong>{c.username}</strong> {c.text}
              </div>
            ))}
          </div>

          {/* INPUT */}
          <div className="bottom-bar">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>➤</button>
          </div>

          {/* GIFT MODAL */}
          <div className={`gift-modal ${showGiftPanel ? "active" : ""}`}>
            <div className="gift-grid">
              <div onClick={() => sendGift(5)}>🎁 5</div>
              <div onClick={() => sendGift(20)}>💎 20</div>
              <div onClick={() => sendGift(50)}>🏆 50</div>
            </div>

            <button
              className="close-btn"
              onClick={() => setShowGiftPanel(false)}
            >
              Close
            </button>
          </div>

        </div>
      ))}

    </div>
  );
}

/* ================= ROUTES ================= */
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