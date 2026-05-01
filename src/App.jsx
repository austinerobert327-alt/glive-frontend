import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import "./App.css";

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

async function fetchYouTubeSearch(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data.items || [];
}

function getUploadsPlaylistId(channelId) {
  return channelId?.startsWith("UC") ? `UU${channelId.slice(2)}` : null;
}

function getLiveEmbedUrl(channelId) {
  return `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&playsinline=1`;
}

function getPlaylistEmbedUrl(playlistId) {
  return `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&playsinline=1`;
}

/* STREAMS */
const streams = [
  {
    id: 0,
    title: "NSPPD",
    channelId: "UCLg4NCAJxhIvD4IRV__LOFg"
  }
];

/* WATCH PAGE */
function WatchPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const handleLogout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    let active = true;
    const nsppd = streams[0];

    const fetchNsppdVideos = async () => {
      setLoadingVideos(true);

      if (!API_KEY) {
        if (active) {
          setVideos([]);
          setLoadingVideos(false);
        }
        return;
      }

      try {
        const [liveItems, latestItems] = await Promise.all([
          fetchYouTubeSearch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${nsppd.channelId}&eventType=live&order=date&maxResults=1&type=video&key=${API_KEY}`
          ),
          fetchYouTubeSearch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${nsppd.channelId}&order=date&maxResults=10&type=video&key=${API_KEY}`
          )
        ]);

        const liveVideoId = liveItems[0]?.id?.videoId || null;
        const mergedVideos = [
          ...liveItems.map((item) => ({ ...item, isLive: true })),
          ...latestItems.filter((item) => item.id?.videoId !== liveVideoId)
        ].slice(0, 10);

        if (!active) return;
        setVideos(mergedVideos);
      } catch (error) {
        console.error("Unable to fetch NSPPD videos:", error);
        if (active) setVideos([]);
      } finally {
        if (active) setLoadingVideos(false);
      }
    };

    fetchNsppdVideos();
    const interval = window.setInterval(fetchNsppdVideos, 60000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="watch-page">
      <div className="watch-header">
        <h1>Streamsofjoy TV</h1>
      </div>

      <div className="video-list">
        {loadingVideos && <div className="empty-state">Loading NSPPD videos...</div>}

        {!loadingVideos && videos.length === 0 && (
          <div className="empty-state">No NSPPD videos available right now.</div>
        )}

        {videos.map((video) => (
          <div
            key={video.id.videoId}
            className="video-list-item"
            onClick={() => navigate(`/live/${video.id.videoId}`)}
          >
            <div className="video-thumb-wrap">
              {video.isLive && <div className="live-badge">LIVE</div>}
              <img
                src={video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url}
                alt=""
              />
            </div>
            <div className="video-list-title">{video.snippet?.title}</div>
          </div>
        ))}
      </div>

      <div className="watch-footer">
        <button type="button" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}

/* LIVE VIEW */
function LiveViewer() {
  const { id } = useParams();
  const matchedStream = streams.find(s => String(s.id) === id);
  const routeVideoId = matchedStream ? null : id;
  const stream = matchedStream || streams[0];

  const [videoId, setVideoId] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(true);

  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [testimonies, setTestimonies] = useState([]);
  const [input, setInput] = useState("");
  const [amens, setAmens] = useState([]);
  const [showGift, setShowGift] = useState(false);
  const [giftAnim, setGiftAnim] = useState(null);
  const [viewers, setViewers] = useState(10000);
  const [isRecharging, setIsRecharging] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showPrayerForm, setShowPrayerForm] = useState(false);
  const [showTestimoniesPanel, setShowTestimoniesPanel] = useState(false);
  const [showTestimonyForm, setShowTestimonyForm] = useState(false);
  const [prayerName, setPrayerName] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [testimonyName, setTestimonyName] = useState("");
  const [testimonyText, setTestimonyText] = useState("");

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

  const sendAmen = () => {
    const id = Date.now();
    const colors = ["#f9d66d", "#ffffff", "#9ff3c8"];

    setAmens(prev => [...prev, {
      id,
      color: colors[Math.floor(Math.random() * colors.length)]
    }]);

    setTimeout(() => {
      setAmens(prev => prev.filter(a => a.id !== id));
    }, 2500);
  };

  const shareStream = async () => {
    const shareData = {
      title: "NSPPD on GLive",
      text: "Join this NSPPD stream.",
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Unable to share stream:", error);
      }
    }
  };

  const submitPrayer = async (event) => {
    event.preventDefault();
    requireLogin(async () => {
      if (!prayerText.trim()) return;

      await addDoc(collection(db, "prayers"), {
        name: prayerName.trim(),
        text: prayerText.trim(),
        createdAt: serverTimestamp()
      });

      setPrayerName("");
      setPrayerText("");
      setShowPrayerForm(false);
      setShowMenuSheet(false);
    });
  };

  const submitTestimony = async (event) => {
    event.preventDefault();
    requireLogin(async () => {
      if (!testimonyText.trim()) return;

      await addDoc(collection(db, "testimonies"), {
        name: testimonyName.trim(),
        text: testimonyText.trim(),
        createdAt: serverTimestamp()
      });

      setTestimonyName("");
      setTestimonyText("");
      setShowTestimonyForm(false);
      setShowMenuSheet(false);
      setShowTestimoniesPanel(false);
    });
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
    const q = query(collection(db, "testimonies"), orderBy("createdAt"), limit(20));
    return onSnapshot(q, (snap) => {
      setTestimonies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (commentRef.current) {
      commentRef.current.scrollTop = commentRef.current.scrollHeight;
    }
  }, [comments]);

  useEffect(() => {
    const fetchVideo = async () => {
      setLoadingVideo(true);
      setVideoId(null);
      setVideoSrc(null);

      if (routeVideoId) {
        setVideoId(routeVideoId);
        setVideoSrc(`https://www.youtube.com/embed/${routeVideoId}?autoplay=1&playsinline=1`);
        setLoadingVideo(false);
        return;
      }

      const channelId = stream.channelId;
      const uploadsPlaylistId = getUploadsPlaylistId(channelId);

      if (!channelId) {
        setLoadingVideo(false);
        return;
      }

      if (!API_KEY) {
        setVideoSrc(uploadsPlaylistId ? getPlaylistEmbedUrl(uploadsPlaylistId) : getLiveEmbedUrl(channelId));
        setLoadingVideo(false);
        return;
      }

      try {
        const liveItems = await fetchYouTubeSearch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=1&key=${API_KEY}`
        );

        if (liveItems.length > 0) {
          const nextVideoId = liveItems[0].id.videoId;
          setVideoId(nextVideoId);
          setVideoSrc(`https://www.youtube.com/embed/${nextVideoId}?autoplay=1&playsinline=1`);
          setLoadingVideo(false);
          return;
        }

        const completedLiveItems = await fetchYouTubeSearch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=completed&type=video&order=date&videoEmbeddable=true&videoSyndicated=true&maxResults=1&key=${API_KEY}`
        );

        if (completedLiveItems.length > 0) {
          const nextVideoId = completedLiveItems[0].id.videoId;
          setVideoId(nextVideoId);
          setVideoSrc(`https://www.youtube.com/embed/${nextVideoId}?autoplay=1&playsinline=1`);
          setLoadingVideo(false);
          return;
        }

        const latestVideoItems = await fetchYouTubeSearch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=1&key=${API_KEY}`
        );

        const nextVideoId = latestVideoItems[0]?.id?.videoId || null;
        setVideoId(nextVideoId);
        setVideoSrc(
          nextVideoId
            ? `https://www.youtube.com/embed/${nextVideoId}?autoplay=1&playsinline=1`
            : uploadsPlaylistId
              ? getPlaylistEmbedUrl(uploadsPlaylistId)
              : getLiveEmbedUrl(channelId)
        );
        setLoadingVideo(false);
      } catch {
        setVideoId(null);
        setVideoSrc(uploadsPlaylistId ? getPlaylistEmbedUrl(uploadsPlaylistId) : getLiveEmbedUrl(channelId));
        setLoadingVideo(false);
      }
    };

    fetchVideo();
  }, [routeVideoId, stream]);

  return (
    <div className="live-stream-page">
      {showLogin && (
        <div className="login-overlay">
          <div className="login-card">
            <h3>Login to continue</h3>

            <button onClick={handleGoogleLogin}>
              Continue with Google
            </button>

            <button onClick={() => setShowLogin(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="video-container">
        {loadingVideo ? (
          <div className="no-video">Loading...</div>
        ) : videoSrc ? (
          <iframe
            src={videoSrc}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="no-video">Live not available</div>
        )}
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

      <div className="amen-container">
        {amens.map(a => (
          <span key={a.id} className="amen" style={{ color: a.color }}>
            Amen
          </span>
        ))}
      </div>

      {giftAnim && (
        <div className="gift-center">
          <span>{giftAnim}</span>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      )}

      {testimonies.length > 0 && (
        <div className="testimony-ticker">
          <div className="testimony-track">
            {[...testimonies, ...testimonies].map((item, index) => (
              <div className="testimony-item" key={`${item.id}-${index}`}>
                <strong>{item.name || "Anonymous"}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <button className="amen-btn" onClick={sendAmen}>Amen</button>
        <button className="share-btn" type="button" onClick={shareStream}>Share</button>
        <button className="menu-btn" type="button" onClick={() => setShowMenuSheet(true)}>☰</button>
      </div>

      <div className={`gift-modal ${showGift ? "active" : ""}`}>
        <div className="sheet-handle" />
        <div className="gift-balance">
          <span>Balance: {coins}</span>
          <button type="button" onClick={recharge} disabled={isRecharging}>
            {isRecharging ? "Loading..." : "Recharge"}
          </button>
        </div>
        <div className="gift-grid">
          <div onClick={() => sendGift(5, "🎁")}>🎁 5</div>
          <div onClick={() => sendGift(20, "💎")}>💎 20</div>
          <div onClick={() => sendGift(50, "🏆")}>🏆 50</div>
        </div>
        <button className="close-btn" onClick={() => setShowGift(false)}>Close</button>
      </div>

      <div className={`bottom-sheet ${showMenuSheet ? "active" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-options">
          <button type="button" onClick={() => setShowPrayerForm(true)}>Prayer Request</button>
          <button type="button" onClick={() => setShowTestimoniesPanel(true)}>Testimonies</button>
        </div>
        <button className="close-btn" type="button" onClick={() => setShowMenuSheet(false)}>
          Close
        </button>
      </div>

      <div className={`bottom-sheet testimonies-panel ${showTestimoniesPanel ? "active" : ""}`}>
        <div className="sheet-handle" />
        <h3>Testimonies</h3>
        <div className="testimony-sheet-list">
          {testimonies.length === 0 ? (
            <div className="empty-state">No testimonies yet.</div>
          ) : (
            <div className="testimony-track">
              {[...testimonies, ...testimonies].map((item, index) => (
                <div className="testimony-item" key={`sheet-${item.id}-${index}`}>
                  <strong>{item.name || "Anonymous"}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="write-btn" type="button" onClick={() => setShowTestimonyForm(true)}>
          Write Testimony
        </button>
        <button className="close-btn" type="button" onClick={() => setShowTestimoniesPanel(false)}>
          Close
        </button>
      </div>

      {showPrayerForm && (
        <div className="form-sheet">
          <form onSubmit={submitPrayer}>
            <h3>Prayer Request</h3>
            <input
              placeholder="Name (optional)"
              value={prayerName}
              onChange={(event) => setPrayerName(event.target.value)}
            />
            <textarea
              placeholder="Your prayer request"
              value={prayerText}
              onChange={(event) => setPrayerText(event.target.value)}
            />
            <button type="submit">Submit</button>
            <button type="button" onClick={() => setShowPrayerForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {showTestimonyForm && (
        <div className="form-sheet">
          <form onSubmit={submitTestimony}>
            <h3>Write Testimony</h3>
            <input
              placeholder="Name (optional)"
              value={testimonyName}
              onChange={(event) => setTestimonyName(event.target.value)}
            />
            <textarea
              placeholder="Your testimony"
              value={testimonyText}
              onChange={(event) => setTestimonyText(event.target.value)}
            />
            <button type="submit">Submit</button>
            <button type="button" onClick={() => setShowTestimonyForm(false)}>Cancel</button>
          </form>
        </div>
      )}
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
