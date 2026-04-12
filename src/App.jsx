import { useEffect, useRef, useState } from "react";
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
  setDoc,
  updateDoc
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";

/* ENV */
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const CHANNEL_HANDLE = "pastorjerryeze";

/* ================= WATCH PAGE ================= */
function WatchPage() {
  const navigate = useNavigate();
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${CHANNEL_HANDLE}&key=${API_KEY}`
        );
        const data = await res.json();

        if (data.items?.length > 0) {
          setVideoId(data.items[0].id.videoId);
          setIsLive(true);
        }
      } catch (e) {
        console.log(e);
      }
    };

    fetchLive();
  }, []);

  return (
    <div className="watch-page">
      <div className="live-card" onClick={() => navigate("/live")}>
        <img src={jerryImage} />
        <div className="live-card-title">
          NSPPD {isLive && <span className="live-badge">LIVE</span>}
        </div>
      </div>
    </div>
  );
}

/* ================= LIVE ================= */
function LiveViewer() {
  const navigate = useNavigate();
  const [videoId, setVideoId] = useState(null);
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [hearts, setHearts] = useState([]);

  const userRef = useRef(null);

  /* PAYSTACK SCRIPT */
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    document.body.appendChild(script);
  }, []);

  /* AUTH */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) userRef.current = u.uid;
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
      setComments(snap.docs.map((d) => d.data()));
    });
  }, []);

  /* FETCH VIDEO (LIVE OR FALLBACK) */
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${CHANNEL_HANDLE}&key=${API_KEY}`
        );
        const data = await res.json();

        if (data.items?.length > 0) {
          setVideoId(data.items[0].id.videoId);
        }
      } catch (e) {
        console.log(e);
      }
    };

    fetchVideo();
  }, []);

  /* SEND COMMENT */
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

  /* PAYSTACK POPUP */
  const recharge = () => {
    if (!user) return navigate("/login");

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: 1000 * 100,
      currency: "NGN",
      ref: "GLIVE_" + Date.now(),
      callback: async () => {
        const refDoc = doc(db, "users", user.uid);
        await updateDoc(refDoc, { coins: coins + 50 });
      }
    });

    handler.openIframe();
  };

  /* GIFT */
  const sendGift = (cost) => {
    if (coins < cost) return recharge();

    const refDoc = doc(db, "users", user.uid);
    updateDoc(refDoc, { coins: coins - cost });
  };

  /* HEARTS */
  const sendHeart = () => {
    const id = Date.now();
    setHearts((prev) => [...prev, id]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h !== id));
    }, 2000);
  };

  return (
    <div className="live-scroll-container">

      <div className="live-stream-page">

        {/* VIDEO */}
        <div className="video-frame">
          {videoId && (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`}
              allow="autoplay"
            />
          )}
        </div>

        {/* COINS */}
        <div className="top-bar">
          <span onClick={recharge}>🪙 {coins}</span>
        </div>

        {/* COMMENTS */}
        <div className="comment-overlay">
          {comments.map((c, i) => (
            <div key={i} className="comment">
              <strong>{c.username}</strong> {c.text}
            </div>
          ))}
        </div>

        {/* HEARTS */}
        {hearts.map((h) => (
          <div key={h} className="heart">❤️</div>
        ))}

        {/* INPUT */}
        <div className="bottom-bar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Comment..."
          />

          <button className="send-btn" onClick={sendMessage}>➤</button>

          <button className="icon-btn" onClick={sendHeart}>❤️</button>

          <button className="icon-btn" onClick={() => sendGift(10)}>🎁</button>
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
      <Route path="/live" element={<LiveViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}