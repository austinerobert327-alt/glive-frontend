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
import { usePaystackPayment } from "react-paystack";

import Login from "./pages/Login";
import Register from "./pages/Register";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BACKEND_URL = "https://glive-backend.onrender.com";

const streams = [
  { id: 0, title: "NSPPD", handle: "pastorjerryeze", thumb: jerryImage },
  { id: 1, title: "Hallelujah Challenge", handle: "NathanielBasseyMusic", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", handle: "DrPastorEnenche", thumb: dunamisImage },
  { id: 3, title: "RCCG", handle: "RCCGWorldwide", thumb: rccgImage },
  { id: 4, title: "Winners Chapel", handle: "LivingFaithChurchWorldwide", thumb: winnersImage }
];

function WatchPage() {
  const navigate = useNavigate();

  return (
    <div className="watch-page">
      <div className="live-grid">
        {streams.map(stream => (
          <div key={stream.id} className="live-card" onClick={() => navigate(`/live/${stream.id}`)}>
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
  const scrollRef = useRef(null);

  const userIdRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [videos, setVideos] = useState({});
  const [views, setViews] = useState({});

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);

  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");

  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const rechargeAmount = 1000;

  /* ================= AUTH ================= */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u) {
        userIdRef.current = u.uid;
        console.log("✅ USER ID LOCKED:", u.uid);
      }
    });
  }, []);

  /* ================= WALLET ================= */
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCoins(snap.data().coins || 0);
      } else {
        setDoc(ref, { email: user.email, coins: 0 });
      }
    });

    return () => unsub();
  }, [user]);

  /* ================= PAYSTACK ================= */
  const paystackConfig = user ? {
    reference: new Date().getTime().toString(),
    email: user.email,
    amount: rechargeAmount * 100,
    publicKey: "pk_live_019365ea37124e26f8baec964658b07837520356"
  } : null;

  const initializePayment = paystackConfig ? usePaystackPayment(paystackConfig) : null;

  /* ================= PAYMENT ================= */
  const rechargeWallet = () => {

    if (!userIdRef.current) {
      alert("User not ready");
      return navigate("/login");
    }

    const userId = userIdRef.current;

    if (!initializePayment) {
      alert("Payment not ready");
      return;
    }

    console.log("🚀 Starting payment for:", userId);

    initializePayment(
      async (response) => {
        console.log("✅ Payment success:", response);

        try {
          const res = await fetch(`${BACKEND_URL}/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reference: response.reference,
              userId,
            }),
          });

          const data = await res.json();

          console.log("🔥 Backend response:", data);

          if (!res.ok) {
            alert(`❌ Error: ${data.error || "Verification failed"}`);
            return;
          }

          if (data.success) {
            alert(`✅ Wallet credited! New balance: ${data.coins}`);
          } else {
            alert("❌ Payment verification failed");
          }

        } catch (err) {
          console.error("❌ Backend error:", err);
          alert("Server error");
        }
      },
      () => console.log("❌ Payment closed")
    );
  };

  /* ================= COMMENTS ================= */
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "asc"), limit(100));
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

  const sendGift = async (cost) => {
    if (!user) return navigate("/login");
    if (coins < cost) return alert("Insufficient coins");

    await setDoc(doc(db, "users", user.uid), { coins: increment(-cost) }, { merge: true });
  };

  return (
    <div ref={scrollRef} className="live-scroll-container">
      {streams.map((stream, index) => (
        <div key={stream.id} className="live-stream-page">

          {videos[stream.id] && index === activeIndex && (
            <iframe src={`https://www.youtube.com/embed/${videos[stream.id]}?autoplay=1&mute=1`} allow="autoplay" />
          )}

          <div className="top-bar">
            <span>👁 {views[stream.id] || 1000}</span>
            <span onClick={rechargeWallet}>🪙 {coins}</span>
          </div>

          <div className="right-icons">
            <button>❤️</button>
            <button onClick={() => setShowGiftPanel(!showGiftPanel)}>🎁</button>
          </div>

          <div className="comment-overlay">
            {comments.map((c, i) => (
              <div key={i}><strong>{c.username}</strong> {c.text}</div>
            ))}
          </div>

          <div className="bottom-bar">
            <input value={input} onChange={e => setInput(e.target.value)} />
            <button onClick={sendMessage}>Send</button>
          </div>

          {showGiftPanel && (
            <div>
              <button onClick={() => sendGift(5)}>5</button>
              <button onClick={() => sendGift(20)}>20</button>
              <button onClick={() => sendGift(50)}>50</button>
            </div>
          )}

        </div>
      ))}
    </div>
  );
}

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