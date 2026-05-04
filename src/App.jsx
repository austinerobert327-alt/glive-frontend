import { useEffect, useMemo, useRef, useState } from "react";
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
const NSPPD_CHANNEL_ID = "UCLg4NCAJxhIvD4IRV__LOFg";
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

const streams = [
  {
    id: "nsppd",
    title: "NSPPD",
    channelId: NSPPD_CHANNEL_ID
  },
  {
    id: "winners",
    title: "Winners Chapel",
    channelId: "UCyUKtrMdDilf74SPkCCKKtw"
  },
  {
    id: "rccg",
    title: "RCCG",
    channelId: "UCHp4qCAPmz7-5BJ601FDFnA"
  },
  {
    id: "dunamis",
    title: "Dunamis",
    channelId: "UC0pFEFO86OwhVUcqAQ4ICjQ"
  },
  {
    id: "koinonia",
    title: "Koinonia Global",
    channelId: "UCq2ueL6wl7slTuInRbFpe7w"
  },
  {
    id: "omega-fire",
    title: "Omega Fire Ministry",
    channelId: "UCrF3Zv8PGIT4R4f2LMQvQSQ"
  },
  {
    id: "light-nation",
    title: "Light Nation Church",
    channelId: "UCgXEDFzk3TwStyRnlUJrMVA"
  }
];

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

function getVideoEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;
}

function getThumb(video, preferred = "high") {
  return (
    video?.snippet?.thumbnails?.[preferred]?.url ||
    video?.snippet?.thumbnails?.medium?.url ||
    video?.snippet?.thumbnails?.default?.url ||
    ""
  );
}

function getVideoId(video) {
  return video?.id?.videoId;
}

function addStreamToVideo(video, stream, isLive = false) {
  return {
    ...video,
    isLive,
    streamId: stream.id,
    streamTitle: stream.title
  };
}

function Header() {
  return (
    <header className="app-header">
      <div className="brand-title">StreamofJoy TV</div>
      <button className="icon-button search-button" type="button" aria-label="Search">
        <span />
      </button>
    </header>
  );
}

function BottomSheet({ open, children, className = "" }) {
  return (
    <div className={`bottom-sheet ${className} ${open ? "active" : ""}`}>
      <div className="sheet-handle" />
      {children}
    </div>
  );
}

function WatchFooter({ onLogout }) {
  return (
    <footer className="watch-footer">
      <button type="button" onClick={onLogout}>Logout</button>
    </footer>
  );
}

function WatchPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [activeHero, setActiveHero] = useState(0);

  const heroVideos = useMemo(() => videos.slice(0, Math.min(videos.length, 5)), [videos]);
  const recentVideos = useMemo(() => videos, [videos]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const openVideo = (video) => {
    const videoId = getVideoId(video);
    if (videoId) navigate(`/live/${videoId}`);
  };

  useEffect(() => {
    let active = true;

    const fetchWatchVideos = async () => {
      setLoadingVideos(true);

      if (!API_KEY) {
        if (active) {
          setVideos([]);
          setLoadingVideos(false);
        }
        return;
      }

      try {
        const streamVideoGroups = await Promise.all(
          streams.map(async (stream) => {
            const [liveItems, latestItems] = await Promise.all([
              fetchYouTubeSearch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${stream.channelId}&eventType=live&order=date&maxResults=1&type=video&key=${API_KEY}`
              ),
              fetchYouTubeSearch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${stream.channelId}&order=date&maxResults=3&type=video&key=${API_KEY}`
              )
            ]);

            const liveVideoId = liveItems[0]?.id?.videoId || null;
            return [
              ...liveItems.map((item) => addStreamToVideo(item, stream, true)),
              ...latestItems
                .filter((item) => item.id?.videoId !== liveVideoId)
                .map((item) => addStreamToVideo(item, stream))
            ];
          })
        );

        const uniqueVideos = new Map();
        streamVideoGroups.flat().forEach((video) => {
          const videoId = getVideoId(video);
          if (videoId && !uniqueVideos.has(videoId)) {
            uniqueVideos.set(videoId, video);
          }
        });

        const mergedVideos = Array.from(uniqueVideos.values())
          .sort((a, b) => {
            const aDate = new Date(a.snippet?.publishedAt || 0).getTime();
            const bDate = new Date(b.snippet?.publishedAt || 0).getTime();
            return bDate - aDate;
          })
          .slice(0, 18);

        if (!active) return;
        setVideos(mergedVideos);
        setActiveHero(0);
      } catch (error) {
        console.error("Unable to fetch watch videos:", error);
        if (active) setVideos([]);
      } finally {
        if (active) setLoadingVideos(false);
      }
    };

    fetchWatchVideos();
    const interval = window.setInterval(fetchWatchVideos, 300000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="watch-page">
      <Header />

      <main className="watch-content">
        {loadingVideos && <div className="empty-state">Loading church videos...</div>}

        {!loadingVideos && videos.length === 0 && (
          <div className="empty-state">No church videos available right now.</div>
        )}

        {heroVideos.length > 0 && (
          <section className="hero-section" aria-label="Highlights">
            <div
              className="hero-carousel"
              onScroll={(event) => {
                const width = event.currentTarget.clientWidth || 1;
                setActiveHero(Math.round(event.currentTarget.scrollLeft / width));
              }}
            >
              {heroVideos.map((video) => (
                <button
                  type="button"
                  className="hero-card"
                  key={getVideoId(video)}
                  onClick={() => openVideo(video)}
                >
                  <img src={getThumb(video)} alt="" />
                  <span className="hero-shade" />
                  {video.isLive && <span className="live-badge">LIVE</span>}
                  {video.streamTitle && <span className="video-source">{video.streamTitle}</span>}
                  <span className="hero-title">{video.snippet?.title}</span>
                </button>
              ))}
            </div>

            <div className="carousel-dots" aria-hidden="true">
              {heroVideos.map((video, index) => (
                <span
                  key={`${getVideoId(video)}-dot`}
                  className={index === activeHero ? "active" : ""}
                />
              ))}
            </div>
          </section>
        )}

        <section className="church-section">
          <h2>Live Churches</h2>
          <div className="church-scroll">
            {streams.map((stream) => (
              <button
                type="button"
                key={stream.id}
                className="church-card"
                onClick={() => navigate(`/live/stream/${stream.id}`)}
              >
                <span className="church-live-dot" aria-hidden="true" />
                <span>{stream.title}</span>
              </button>
            ))}
          </div>
        </section>

        {videos.length > 0 && (
          <section className="recent-section">
            <h2>Recently Added</h2>
            <div className="recent-scroll">
              {recentVideos.map((video) => (
                <button
                  type="button"
                  key={getVideoId(video)}
                  className="recent-card"
                  onClick={() => openVideo(video)}
                >
                  <span className="recent-thumb">
                    <img src={getThumb(video, "medium")} alt="" />
                    {video.isLive && <span className="live-badge">LIVE</span>}
                  </span>
                  {video.streamTitle && <span className="recent-source">{video.streamTitle}</span>}
                  <span className="recent-title">{video.snippet?.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <WatchFooter onLogout={handleLogout} />
    </div>
  );
}

function LiveViewer() {
  const params = useParams();
  const routeParam = params.videoId || params.id;
  const matchedStream = streams.find((s) => String(s.id) === routeParam);
  const routeVideoId = matchedStream ? null : routeParam;
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
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [showPrayerForm, setShowPrayerForm] = useState(false);
  const [showTestimoniesPanel, setShowTestimoniesPanel] = useState(false);
  const [showTestimonyForm, setShowTestimonyForm] = useState(false);
  const [prayerName, setPrayerName] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [testimonyName, setTestimonyName] = useState("");
  const [testimonyText, setTestimonyText] = useState("");

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

    setAmens((prev) => [...prev, {
      id,
      color: colors[Math.floor(Math.random() * colors.length)]
    }]);

    setTimeout(() => {
      setAmens((prev) => prev.filter((amen) => amen.id !== id));
    }, 2500);
  };

  const shareStream = async () => {
    const shareData = {
      title: `${stream.title} on GLive`,
      text: `Join this ${stream.title} stream.`,
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

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    setShowLogoutSheet(false);
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
      setShowLogoutSheet(false);
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
      setShowLogoutSheet(false);
      setShowTestimoniesPanel(false);
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt"), limit(50));
    return onSnapshot(q, (snap) => {
      const filtered = snap.docs.map((d) => d.data()).filter((comment) => {
        if (!comment.createdAt) return false;
        return comment.createdAt.toMillis() >= sessionStart;
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
        setVideoSrc(getVideoEmbedUrl(routeVideoId));
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
          setVideoSrc(getVideoEmbedUrl(nextVideoId));
          setLoadingVideo(false);
          return;
        }

        const completedLiveItems = await fetchYouTubeSearch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=completed&type=video&order=date&videoEmbeddable=true&videoSyndicated=true&maxResults=1&key=${API_KEY}`
        );

        if (completedLiveItems.length > 0) {
          const nextVideoId = completedLiveItems[0].id.videoId;
          setVideoId(nextVideoId);
          setVideoSrc(getVideoEmbedUrl(nextVideoId));
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
            ? getVideoEmbedUrl(nextVideoId)
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
            <button type="button" onClick={handleGoogleLogin}>Continue with Google</button>
            <button type="button" onClick={() => setShowLogin(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="video-container">
        {loadingVideo ? (
          <div className="no-video">Loading...</div>
        ) : videoSrc ? (
          <iframe
            title={videoId ? `${stream.title} video ${videoId}` : `${stream.title} live stream`}
            src={videoSrc}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="no-video">Live not available</div>
        )}
      </div>

      <div className="top-right">
        <span className="viewer-eye" aria-hidden="true" />
        {viewers.toLocaleString()}
      </div>

      <div className="comment-overlay" ref={commentRef}>
        {comments.map((comment, index) => (
          <div key={index} className="comment">
            <strong>{comment.username}</strong> {comment.text}
          </div>
        ))}
      </div>

      <div className="amen-container">
        {amens.map((amen) => (
          <span key={amen.id} className="amen" style={{ color: amen.color }}>
            <span aria-hidden="true">{"\uD83D\uDE4F"}</span>
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
            onChange={(event) => setInput(event.target.value)}
          />
          <button className="send-btn" type="button" onClick={sendMessage}>Send</button>
        </div>

        <div className="action-row">
          <button className="gift-btn" type="button" onClick={() => setShowGift(true)} aria-label="Send gift">
            {"\uD83C\uDF81"}
          </button>
          <button className="amen-btn" type="button" onClick={sendAmen}>
            <span aria-hidden="true">{"\uD83D\uDE4F"}</span>
            Amen
          </button>
          <button className="share-btn" type="button" onClick={shareStream}>Share</button>
          <button className="hamburger-btn" type="button" onClick={() => setShowLogoutSheet(true)} aria-label="Menu">
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <BottomSheet open={showGift} className="gift-modal">
        <div className="gift-balance">
          <span>Balance: {coins}</span>
          <button type="button" onClick={recharge} disabled={isRecharging}>
            {isRecharging ? "Loading..." : "Recharge"}
          </button>
        </div>
        <div className="gift-grid">
          <button type="button" onClick={() => sendGift(5, "\uD83C\uDF81")}>{"\uD83C\uDF81"} 5</button>
          <button type="button" onClick={() => sendGift(20, "\uD83D\uDC8E")}>{"\uD83D\uDC8E"} 20</button>
          <button type="button" onClick={() => sendGift(50, "\uD83C\uDFC6")}>{"\uD83C\uDFC6"} 50</button>
        </div>
        <button className="close-btn" type="button" onClick={() => setShowGift(false)}>Close</button>
      </BottomSheet>

      <BottomSheet open={showLogoutSheet} className="menu-sheet">
        <div className="logout-sheet-content">
          <button className="logout-action" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <button className="close-btn" type="button" onClick={() => setShowLogoutSheet(false)}>
          Close
        </button>
      </BottomSheet>

      <BottomSheet open={showTestimoniesPanel} className="testimonies-panel">
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
      </BottomSheet>

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WatchPage />} />
      <Route path="/live/:videoId" element={<LiveViewer />} />
      <Route path="/live/stream/:id" element={<LiveViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
