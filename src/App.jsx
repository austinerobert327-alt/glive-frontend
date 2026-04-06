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
const PAYSTACK_PUBLIC_KEY = String(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);

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
            <img src={stream.thumb} alt={stream.title} />
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
  const giftContainerRef = useRef(null);

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
      if (u) userIdRef.current = u.uid;
    });
  }, []);

  /* ================= WALLET ================= */
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setCoins(snap.data().coins || 0);
      else setDoc(ref, { email: user.email, coins: 0 });
    });

    return () => unsub();
  }, [user]);

  /* ================= PAYSTACK ================= */
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
    if (!initializePayment) return;

    initializePayment({
      onSuccess: async (response) => {
        try {
          const res = await fetch(`${BACKEND_URL}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, userId: userIdRef.current }),
          });

          const data = await res.json();
          if (!res.ok) alert(`❌ Error: ${data.error}`);
          else if (data.success) alert(`✅ Wallet credited! Balance: ${data.coins}`);
          else alert("❌ Verification failed");
        } catch {
          alert("Server error");
        }
      },
      onClose: () => console.log("Payment closed"),
    });
  };

  /* ================= COMMENTS ================= */
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "asc"), limit(100));
    return onSnapshot(q, (snap) => setComments(snap.docs.map(d => d.data())));
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

  /* ================= GIFT LOGIC ================= */
  const triggerGiftAnimation = (cost) => {
    if (!giftContainerRef.current) return;
    const giftEl = document.createElement("div");
    giftEl.className = "gift-animation";
    giftEl.innerText = `🎁 x${cost}`;
    giftContainerRef.current.appendChild(giftEl);

    giftEl.style.left = `${Math.random() * 80 + 10}%`;

    giftEl.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(-200px)", opacity: 0 }
      ],
      { duration: 2000, easing: "ease-out" }
    );

    setTimeout(() => giftEl.remove(), 2000);
  };

  const sendGift = async (cost) => {
    if (!user) return navigate("/login");
    if (coins < cost) return alert("Insufficient coins");

    try {
      await setDoc(doc(db, "users", user.uid), { coins: increment(-cost) }, { merge: true });
      await addDoc(collection(db, "gifts"), {
        userId: user.uid,
        cost,
        timestamp: serverTimestamp(),
      });
      triggerGiftAnimation(cost);
    } catch (err) {
      alert("Error sending gift");
      console.error(err);
    }
  };

  return (
    <div ref={scrollRef} className="live-scroll-container">
      <div ref={giftContainerRef} className="gift-animation-container"></div>
      {streams.map((stream) => (
        <div key={stream.id} className="live-stream-page">

          <div className="top-bar">
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

          {/* ================= GIFT PANEL ================= */}
          <div className={`gift-panel ${showGiftPanel ? "slide-in" : "slide-out"}`}>
            <button onClick={() => sendGift(5)}>5</button>
            <button onClick={() => sendGift(20)}>20</button>
            <button onClick={() => sendGift(50)}>50</button>
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
      <Route path="/live/:id" element={<LiveViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}