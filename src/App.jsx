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
const PAYSTACK_KEY =
  import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
  import.meta.env.VITE_PAYSTACK_KEY ||
  import.meta.env.VITE_PUBLIC_PAYSTACK_KEY ||
  "pk_live_019365ea37124e26f8baec964658b07837520356";
const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  "https://glive-backend.onrender.com"
).replace(/\/$/, "");
const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";

function loadPaystackScript() {
  if (window.PaystackPop) {
    return Promise.resolve(window.PaystackPop);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const existingScript = document.querySelector(`script[src="${PAYSTACK_SCRIPT_SRC}"]`);

    const handleLoad = () => {
      if (window.PaystackPop) {
        finish(() => resolve(window.PaystackPop));
      } else {
        finish(() => reject(new Error("Paystack script loaded but PaystackPop is unavailable.")));
      }
    };

    const handleError = () => {
      finish(() => reject(new Error("Unable to load Paystack script.")));
    };

    if (existingScript) {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
        return;
      }

      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });

      window.setTimeout(() => {
        if (window.PaystackPop) {
          finish(() => resolve(window.PaystackPop));
        }
      }, 300);

      window.setTimeout(() => {
        finish(() => reject(new Error("Timed out while waiting for Paystack script.")));
      }, 5000);
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_SRC;
    script.async = true;
    script.onload = handleLoad;
    script.onerror = handleError;
    document.body.appendChild(script);

    window.setTimeout(() => {
      finish(() => reject(new Error("Timed out while loading Paystack script.")));
    }, 5000);
  });
}

async function verifyPaymentOnBackend(reference, userId) {
  const response = await fetch(`${BACKEND_URL}/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reference, userId })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || "Payment verification failed.");
  }

  return data;
}

async function processRechargeVerification(reference, userId, fallbackRef, setIsRecharging) {
  try {
    const paymentRef = reference || fallbackRef;
    await verifyPaymentOnBackend(paymentRef, userId);
  } catch (error) {
    console.error("Recharge verification failed:", error);
    alert(`Payment was completed, but wallet verification failed. Reference: ${reference || fallbackRef}`);
  } finally {
    setIsRecharging(false);
  }
}

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

      {/* 🔥 LOGOUT */}
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
  const [isRecharging, setIsRecharging] = useState(false);

  const [showLogin, setShowLogin] = useState(false);

  const commentRef = useRef(null);
  const [sessionStart] = useState(Date.now());

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

  /* GOOGLE LOGIN */
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

  const requireLogin = (action) => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    action();
  };

  const sendMessage = async () => {
    requireLogin(async () => {
      if (!input.trim()) return;

      await addDoc(collection(db, "comments"), {
        text: input,
        username: user.email,
        createdAt: serverTimestamp()
      });

      setInput("");
    });
  };

  const recharge = () => {
    requireLogin(async () => {
      if (isRecharging) return;
      if (!PAYSTACK_KEY) {
        alert("Paystack public key is missing. Add VITE_PAYSTACK_PUBLIC_KEY to the frontend environment and redeploy.");
        return;
      }

      const rechargeAmount = 1000;
      const txRef = "GLIVE_" + Date.now();

      setIsRecharging(true);

      try {
        const PaystackPop = await loadPaystackScript();
        const handlePaystackSuccess = function (response) {
          processRechargeVerification(response?.reference, user.uid, txRef, setIsRecharging);
        };

        const handlePaystackClose = function () {
          setIsRecharging(false);
        };

        const handler = PaystackPop.setup({
          key: PAYSTACK_KEY,
          email: user.email,
          amount: rechargeAmount * 100,
          ref: txRef,
          currency: "NGN",
          metadata: {
            userId: user.uid,
            email: user.email
          },
          callback: handlePaystackSuccess,
          onClose: handlePaystackClose
        });

        handler.openIframe();
      } catch (error) {
        console.error("Unable to launch Paystack:", error);
        alert(error?.message || "Payment service is not available right now.");
        setIsRecharging(false);
      }
    });
  };

  const sendGift = async (cost, emoji) => {
    requireLogin(async () => {
      if (coins < cost) return recharge();

      await setDoc(doc(db, "users", user.uid), {
        coins: increment(-cost)
      }, { merge: true });

      setGiftAnim(emoji);
      setTimeout(() => setGiftAnim(null), 1500);
      setShowGift(false);
    });
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
    const interval = setInterval(() => {
      setViewers(v => v + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  /* VIDEO FETCH (UNCHANGED) */
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
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.9)",
          zIndex: 1000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <div style={{
            background: "#111",
            padding: "20px",
            borderRadius: "12px",
            width: "80%",
            maxWidth: "300px",
            textAlign: "center"
          }}>
            <h3>Login to continue</h3>

            <button onClick={handleGoogleLogin}
              style={{
                marginTop: "15px",
                padding: "12px",
                width: "100%",
                borderRadius: "8px",
                background: "#fff",
                color: "#000",
                fontWeight: "bold"
              }}>
              Continue with Google
            </button>

            <button onClick={() => setShowLogin(false)}
              style={{
                marginTop: "10px",
                background: "transparent",
                color: "#ccc",
                border: "none"
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
        <button className="wallet-btn" type="button" onClick={recharge} disabled={isRecharging}>
          🪙 {isRecharging ? "Loading..." : coins}
        </button>
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

        <button className="gift-btn" onClick={() => setShowGift(true)}>🎁</button>
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
