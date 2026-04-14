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
          <div key={stream.id} className="live-card" onClick={() => navigate("/live")}>
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

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [likes, setLikes] = useState([]);

  const commentRef = useRef(null);

  /* LOAD PAYSTACK SCRIPT */
  useEffect(() => {
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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

  /* AUTO SCROLL */
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

  /* ✅ PAYSTACK FIXED */
  const recharge = () => {
    if (!user) return navigate("/login");

    if (!window.PaystackPop) {
      alert("Payment system loading...");
      return;
    }

    console.log("🔍 Paystack ready:", !!window.PaystackPop);
    console.log("🔑 Key:", PAYSTACK_KEY);

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email,
      amount: 1000 * 100,
      currency: "NGN",
      ref: "GLIVE_" + Date.now(),

      callback: function (response) {
        console.log("✅ Payment success:", response);

        fetch(`${BACKEND_URL}/verify-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            reference: response.reference,
            userId: user.uid
          })
        })
          .then(res => res.json())
          .then(data => {
            console.log("🔥 Backend:", data);
            alert("Payment successful");
          })
          .catch(err => {
            console.log("❌ Backend error:", err);
          });
      },

      onClose: function () {
        console.log("❌ Payment closed");
      }
    });

    handler.openIframe();
  };

  /* ❤️ LIKE */
  const sendLike = () => {
    const id = Date.now();
    const colors = ["#ff2d55", "#ff9500", "#00e676"];

    setLikes(prev => [
      ...prev,
      { id, color: colors[Math.floor(Math.random() * colors.length)], left: Math.random() * 80 }
    ]);

    setTimeout(() => {
      setLikes(prev => prev.filter(l => l.id !== id));
    }, 2000);
  };

  /* 🎁 GIFT */
  const sendGift = async (cost) => {
    if (!user) return navigate("/login");

    if (coins < cost) {
      recharge(); // 🔥 OPEN PAYSTACK
      return;
    }

    await setDoc(doc(db, "users", user.uid), {
      coins: increment(-cost)
    }, { merge: true });

    setShowGiftPanel(false);
  };

  return (
    <div className="live-scroll-container">

      {streams.map(stream => (
        <div key={stream.id} className="live-stream-page">

          <iframe
            src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&mute=1&playsinline=1`}
            allow="autoplay"
          />

          <div className="top-bar">
            <span onClick={recharge}>🪙 {coins}</span>
          </div>

          <div className="comment-overlay" ref={commentRef}>
            {comments.map((c, i) => (
              <div key={i} className="comment">
                <strong>{c.username}</strong> {c.text}
              </div>
            ))}
          </div>

          <div className="like-container">
            {likes.map(like => (
              <span key={like.id} className="heart" style={{ left: `${like.left}%`, color: like.color }}>
                ❤️
              </span>
            ))}
          </div>

          <div className="bottom-bar">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Comment..." />
            <button onClick={sendLike}>❤️</button>
            <button onClick={() => (coins === 0 ? recharge() : setShowGiftPanel(true))}>🎁</button>
            <button onClick={sendMessage}>Send</button>
          </div>

          <div className={`gift-modal ${showGiftPanel ? "active" : ""}`}>
            <div className="gift-grid">
              <div onClick={() => sendGift(5)}>🎁 5</div>
              <div onClick={() => sendGift(20)}>💎 20</div>
              <div onClick={() => sendGift(50)}>🏆 50</div>
            </div>

            <button onClick={() => setShowGiftPanel(false)}>Close</button>
          </div>

        </div>
      ))}

    </div>
  );
}

/* ROUTES */
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