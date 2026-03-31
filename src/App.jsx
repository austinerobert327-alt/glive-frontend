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

/* ✅ PRODUCTION BACKEND */
const BACKEND_URL = "https://glive-backend.onrender.com";

const streams = [
  { id: 0, title: "NSPPD", handle: "pastorjerryeze", thumb: jerryImage },
  { id: 1, title: "Hallelujah Challenge", handle: "NathanielBasseyMusic", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", handle: "DrPastorEnenche", thumb: dunamisImage },
  { id: 3, title: "RCCG", handle: "RCCGWorldwide", thumb: rccgImage },
  { id: 4, title: "Winners Chapel", handle: "LivingFaithChurchWorldwide", thumb: winnersImage }
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

/* ================= LIVE VIEWER ================= */

function LiveViewer() {

  const navigate = useNavigate();
  const scrollRef = useRef(null);

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
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  /* ================= WALLET REALTIME ================= */
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
  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: user?.email || "test@email.com",
    amount: rechargeAmount * 100,
    publicKey: "pk_live_019365ea37124e26f8baec964658b07837520356"
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const rechargeWallet = () => {
    if (!user) {
      alert("Login first");
      return navigate("/login");
    }

    console.log("🚀 Starting payment...");

    initializePayment(
      async (response) => {
        console.log("✅ Payment success FULL:", response);

        const reference = response.reference;
        const userId = user.uid;

        console.log("📤 Sending to backend:", {
          reference,
          userId
        });

        try {
          const res = await fetch(`${BACKEND_URL}/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reference: reference,
              userId: userId,
            }),
          });

          const data = await res.json();

          console.log("🔥 Backend response:", data);

          if (data.success) {
            alert(`✅ Wallet credited! New balance: ${data.newBalance}`);
          } else {
            alert("❌ Verification failed");
          }

        } catch (err) {
          console.error("❌ Backend error:", err);
          alert("Server not reachable");
        }
      },
      () => {
        console.log("❌ Payment closed");
      }
    );
  };

  /* ================= FETCH VIDEOS ================= */
  useEffect(() => {
    const load = async () => {
      const result = {};
      const viewData = {};

      for (let s of streams) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${s.handle}&key=${API_KEY}`
          );
          const data = await res.json();
          const channelId = data.items?.[0]?.id?.channelId;

          const videoRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`
          );

          const videoData = await videoRes.json();

          if (videoData.items?.length > 0) {
            result[s.id] = videoData.items[0].id.videoId;
            viewData[s.id] = Math.floor(Math.random() * 5000) + 1000;
          }

        } catch (err) {
          console.log("Video fetch error:", err);
        }
      }

      setVideos(result);
      setViews(viewData);
    };

    load();
  }, []);

  /* ================= SCROLL ================= */
  useEffect(() => {
    const handleScroll = () => {
      const index = Math.round(
        scrollRef.current.scrollTop / window.innerHeight
      );
      setActiveIndex(index);
    };

    const el = scrollRef.current;
    el.addEventListener("scroll", handleScroll);

    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  /* ================= COMMENTS ================= */
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

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

  /* ================= GIFT ================= */
  const sendGift = async (cost) => {
    if (!user) return navigate("/login");
    if (coins < cost) return alert("Insufficient coins");

    await setDoc(
      doc(db, "users", user.uid),
      { coins: increment(-cost) },
      { merge: true }
    );
  };

  return (
    <div ref={scrollRef} className="live-scroll-container">

      {streams.map((stream, index) => (
        <div key={stream.id} className="live-stream-page">

          {videos[stream.id] && index === activeIndex && (
            <iframe
              src={`https://www.youtube.com/embed/${videos[stream.id]}?autoplay=1&mute=1`}
              allow="autoplay"
            />
          )}

          {/* TOP */}
          <div className="top-bar">
            <span>👁 {views[stream.id] || 1000}</span>
            <span onClick={rechargeWallet}>🪙 {coins}</span>
          </div>

          {/* RIGHT */}
          <div className="right-icons">
            <button>❤️</button>
            <button onClick={() => setShowGiftPanel(!showGiftPanel)}>🎁</button>
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
            <div className="comment-form">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Write a comment..."
              />
              <button onClick={sendMessage}>➤</button>
            </div>
          </div>

          {/* GIFTS */}
          {showGiftPanel && (
            <div className="gift-panel">
              <button onClick={() => sendGift(5)}>🌸 5</button>
              <button onClick={() => sendGift(20)}>💎 20</button>
              <button onClick={() => sendGift(50)}>🚀 50</button>
            </div>
          )}

        </div>
      ))}

    </div>
  );
}

/* ================= ROUTER ================= */

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