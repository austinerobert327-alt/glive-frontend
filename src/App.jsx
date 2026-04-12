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
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";

/* ENV */
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const BACKEND_URL = "https://glive-backend.onrender.com";

const HANDLE = "pastorjerryeze";

function LiveApp() {
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [giftAnimation, setGiftAnimation] = useState(null);

  const commentRef = useRef(null);
  const navigate = useNavigate();

  /* ================= AUTH ================= */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  /* ================= WALLET ================= */
  useEffect(() => {
    if (!user) return;

    const loadWallet = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setCoins(snap.data().coins || 0);
      } else {
        await setDoc(ref, {
          email: user.email,
          coins: 0,
          createdAt: serverTimestamp()
        });
        setCoins(0);
      }
    };

    loadWallet();
  }, [user]);

  /* ================= FETCH YOUTUBE ================= */
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${HANDLE}&key=${API_KEY}`
        );

        const channelData = await channelRes.json();
        const channelId = channelData.items?.[0]?.id?.channelId;

        if (!channelId) return;

        /* CHECK LIVE */
        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
        );

        const liveData = await liveRes.json();

        if (liveData.items?.length > 0) {
          setVideoId(liveData.items[0].id.videoId);
          setIsLive(true);
        } else {
          /* FALLBACK TO LATEST */
          const latestRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`
          );

          const latestData = await latestRes.json();

          if (latestData.items?.length > 0) {
            setVideoId(latestData.items[0].id.videoId);
            setIsLive(false);
          }
        }
      } catch (err) {
        console.log("YouTube error:", err);
      }
    };

    fetchVideo();
  }, []);

  /* ================= COMMENTS ================= */
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => doc.data()));
    });
  }, []);

  /* AUTO SCROLL */
  useEffect(() => {
    const el = commentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
      username: user.email,
      createdAt: serverTimestamp()
    });

    setInput("");
  }, [input, user]);

  /* ================= GIFT ================= */
  const triggerGiftAnimation = () => {
    setGiftAnimation("🎁");
    setTimeout(() => setGiftAnimation(null), 1500);
  };

  const sendGift = async (cost) => {
    if (!user) return navigate("/login");
    if (coins < cost) return alert("Insufficient coins");

    const ref = doc(db, "users", user.uid);

    await updateDoc(ref, {
      coins: increment(-cost)
    });

    setCoins(prev => prev - cost);
    triggerGiftAnimation();
    setShowGiftPanel(false);
  };

  /* ================= PAYSTACK ================= */
  const rechargeCoins = () => {
    if (!user) return navigate("/login");

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email,
      amount: 1000 * 100,
      currency: "NGN",
      ref: "GLIVE_" + Date.now(),

      callback: async function (response) {
        await fetch(`${BACKEND_URL}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: response.reference,
            userId: user.uid
          })
        });
      },

      onClose: function () {
        console.log("Payment closed");
      }
    });

    handler.openIframe();
  };

  return (
    <div className="live-container">

      {/* VIDEO */}
      {videoId && (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`}
          allow="autoplay"
        />
      )}

      {/* TOP */}
      <div className="top-bar">
        <span onClick={rechargeCoins}>🪙 {coins}</span>
        <span>{isLive ? "🔴 LIVE" : "▶️ Replay"}</span>
      </div>

      {/* RIGHT */}
      <div className="right-icons">
        <button onClick={() => setShowGiftPanel(true)}>🎁</button>
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
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Comment..."
        />
        <button onClick={sendMessage}>➤</button>
      </div>

      {/* GIFT PANEL */}
      <div className={`gift-modal ${showGiftPanel ? "active" : ""}`}>
        <div className="gift-grid">
          <div onClick={() => sendGift(5)}>🎁 5</div>
          <div onClick={() => sendGift(20)}>💎 20</div>
          <div onClick={() => sendGift(50)}>🏆 50</div>
        </div>

        <button onClick={() => setShowGiftPanel(false)}>Close</button>
      </div>

      {/* GIFT ANIMATION */}
      {giftAnimation && (
        <div className="gift-center">{giftAnimation}</div>
      )}

    </div>
  );
}

/* ================= ROUTES ================= */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LiveApp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}