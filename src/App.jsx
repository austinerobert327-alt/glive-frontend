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

import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

const streams = [
  { id: 0, title: "NSPPD", username: "pastorjerryeze", thumb: jerryImage },
  { id: 1, title: "Hallelujah", username: "NathanielBasseyMusic", thumb: hallelujahImage },
  { id: 2, title: "Dunamis", username: "DrPastorEnenche", thumb: dunamisImage },
  { id: 3, title: "RCCG", username: "RCCGWorldwide", thumb: rccgImage },
  { id: 4, title: "Winners", username: "LivingFaithChurchWorldwide", thumb: winnersImage }
];

/* WATCH PAGE */
function WatchPage() {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

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

      <div
        onClick={handleLogout}
        style={{
          position: "absolute",
          bottom: "10px",
          width: "100%",
          textAlign: "center",
          fontSize: "13px",
          color: "#aaa",
          cursor: "pointer"
        }}
      >
        Logout
      </div>
    </div>
  );
}

/* LIVE VIEW */
function LiveViewer() {
  const { id } = useParams();
  const stream = streams.find(s => s.id === Number(id)) || streams[0];

  const [videoId, setVideoId] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [likes, setLikes] = useState([]);
  const [showGift, setShowGift] = useState(false);
  const [giftAnim, setGiftAnim] = useState(null);
  const [viewers, setViewers] = useState(10000);
  const [showLogin, setShowLogin] = useState(false);

  const commentRef = useRef(null);
  const [sessionStart] = useState(Date.now());

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

  const handleGoogleLogin = async () => {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      await setDoc(doc(db, "users", res.user.uid), {
        email: res.user.email,
        coins: 0
      }, { merge: true });

      setShowLogin(false);
    } catch {
      alert("Login failed");
    }
  };

  const sendMessage = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    if (!input.trim()) return;

    await addDoc(collection(db, "comments"), {
      text: input,
      username: user.email,
      createdAt: serverTimestamp()
    });

    setInput("");
  };

  /* 🔥 FIXED PAYSTACK */
  const recharge = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: user.email,
      amount: 1000 * 100,
      ref: "GLIVE_" + Date.now(),

      callback: async function (response) {
        try {
          await fetch("http://localhost:5000/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              reference: response.reference,
              userId: user.uid
            })
          });
        } catch (err) {
          console.log(err);
        }
      }
    });

    handler.openIframe();
  };

  const sendGift = async (cost, emoji) => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    if (coins < cost) return recharge();

    await setDoc(doc(db, "users", user.uid), {
      coins: increment(-cost)
    }, { merge: true });

    setGiftAnim(emoji);
    setTimeout(() => setGiftAnim(null), 1500);
    setShowGift(false);
  };

  const sendLike = () => {
    const id = Date.now();
    const colors = ["#ff2d55", "#ff9500", "#00e676"];

    setLikes(prev => [...prev, {
      id,
      color: colors[Math.floor(Math.random() * colors.length)]
    }]);

    setTimeout(() => {
      setLikes(prev => prev.filter(l => l.id !== id));
    }, 2500);
  };

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${stream.username}&type=channel&key=${API_KEY}`
        );
        const data = await res.json();
        const channelId = data.items?.[0]?.snippet?.channelId;

        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
        );
        const liveData = await liveRes.json();

        if (liveData.items?.length > 0) {
          setVideoId(liveData.items[0].id.videoId);
        } else {
          const latestRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`
          );
          const latestData = await latestRes.json();
          setVideoId(latestData.items?.[0]?.id?.videoId || null);
        }

        setLoadingVideo(false);
      } catch {
        setVideoId(null);
        setLoadingVideo(false);
      }
    };

    fetchVideo();
  }, [stream]);

  return (
    <div className="live-stream-page">

      {showLogin && (
        <div className="login-overlay">
          <div className="login-box">
            <h3>Login to continue</h3>
            <button onClick={handleGoogleLogin}>Continue with Google</button>
          </div>
        </div>
      )}

      <div className="video-container">
        {loadingVideo ? (
          <div>Loading...</div>
        ) : videoId ? (
          <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} />
        ) : (
          <div>Live not available</div>
        )}
      </div>

      <div className="top-left">
        <span onClick={recharge}>🪙 {coins}</span>
      </div>

      <div className="top-right">👁 {viewers}</div>

      <div className="bottom-bar">
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={sendMessage}>Send</button>

        <button onClick={() => {
          if (!user) return setShowLogin(true);
          coins === 0 ? recharge() : setShowGift(true);
        }}>🎁</button>

        <button onClick={sendLike}>❤️</button>
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