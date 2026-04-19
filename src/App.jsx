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

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

/* STREAMS */
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

/* LIVE VIEW */
function LiveViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const commentRef = useRef(null);
  const [sessionStart] = useState(Date.now());

  /* VIEWERS */
  useEffect(() => {
    const interval = setInterval(() => {
      setViewers(v => v + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* 🔥 FIXED VIDEO FETCH (ULTRA RELIABLE) */
  useEffect(() => {
    let isMounted = true;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    const fetchVideo = async () => {
      setLoadingVideo(true);

      try {
        let channelId = null;

        // STEP 1: ALWAYS USE SEARCH (MOST RELIABLE)
        const searchChannel = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${stream.username}&type=channel&maxResults=1&key=${API_KEY}`
        );
        const channelData = await searchChannel.json();
        channelId = channelData.items?.[0]?.snippet?.channelId;

        if (!channelId) {
          if (isMounted) {
            setVideoId(null);
            setLoadingVideo(false);
          }
          return;
        }

        // STEP 2: TRY LIVE (with retry)
        let liveVideo = null;

        for (let i = 0; i < 3; i++) {
          const liveRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
          );
          const liveData = await liveRes.json();

          if (liveData.items?.length > 0) {
            liveVideo = liveData.items[0].id.videoId;
            break;
          }

          await sleep(800); // retry delay
        }

        if (liveVideo) {
          if (isMounted) {
            setVideoId(liveVideo);
            setLoadingVideo(false);
          }
          return;
        }

        // STEP 3: FALLBACK (LATEST VIDEO)
        const latestRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`
        );
        const latestData = await latestRes.json();

        if (isMounted) {
          setVideoId(latestData.items?.[0]?.id?.videoId || null);
          setLoadingVideo(false);
        }

      } catch (err) {
        console.log(err);
        if (isMounted) {
          setVideoId(null);
          setLoadingVideo(false);
        }
      }
    };

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [stream]);

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
      const filtered = snap.docs.map(d => d.data()).filter(c => {
        if (!c.createdAt) return false;
        return c.createdAt.toMillis() >= sessionStart;
      });
      setComments(filtered);
    });
  }, [sessionStart]);

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
      callback: function () { }
    });

    handler.openIframe();
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

  const sendGift = async (cost, emoji) => {
    if (!user) return navigate("/login");
    if (coins < cost) return recharge();

    await setDoc(doc(db, "users", user.uid), {
      coins: increment(-cost)
    }, { merge: true });

    setGiftAnim(emoji);
    setTimeout(() => setGiftAnim(null), 1500);
    setShowGift(false);
  };

  return (
    <div className="live-stream-page">

      <div className="video-container">
        {loadingVideo ? (
          <div className="no-video">Loading...</div>
        ) : videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="no-video">Live not available</div>
        )}
      </div>

      <div className="top-left">
        <span onClick={recharge}>🪙 {coins}</span>
      </div>

      <div className="top-right">
        👁 {viewers.toLocaleString()}
      </div>

      <div className="comment-overlay" ref={commentRef}>
        {comments.map((c, i) => (
          <div key={i} className="comment">
            <strong>{c.username}</strong> {c.text}
          </div>
        ))}
      </div>

      <div className="like-container">
        {likes.map(l => (
          <span key={l.id} className="heart" style={{ color: l.color }}>
            ❤️
          </span>
        ))}
      </div>

      {giftAnim && <div className="gift-center">{giftAnim}</div>}

      <div className="bottom-bar">
        <div className="input-box">
          <input
            placeholder="Comment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="send-btn" onClick={sendMessage}>Send</button>
        </div>

        <button className="gift-btn" onClick={() => (coins === 0 ? recharge() : setShowGift(true))}>🎁</button>
        <button className="like-btn" onClick={sendLike}>❤️</button>
      </div>

      <div className={`gift-modal ${showGift ? "active" : ""}`}>
        <div className="gift-grid">
          <div onClick={() => sendGift(5, "🎁")}>🎁 5</div>
          <div onClick={() => sendGift(20, "💎")}>💎 20</div>
          <div onClick={() => sendGift(50, "🏆")}>🏆 50</div>
        </div>
        <button className="close-btn" onClick={() => setShowGift(false)}>Close</button>
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