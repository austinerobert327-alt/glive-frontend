import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import "./App.css";

import { auth, authPersistenceReady, db } from "./firebase";
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
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";

const NSPPD_CHANNEL_ID = "UCLg4NCAJxhIvD4IRV__LOFg";

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

async function fetchBackendVideos(path) {
  const response = await fetch(`${BACKEND_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Backend fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  // Backend may return { success: true, streams: [...] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.streams)) return data.streams;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getLiveEmbedUrl(channelId) {
  return `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&playsinline=1`;
}

function getVideoEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;
}

function getVideoThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestElementFullscreen(element) {
  if (element.requestFullscreen) return element.requestFullscreen();
  if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
  return Promise.reject(new Error("Fullscreen is not supported."));
}

async function lockLandscapeOrientation() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    // Browsers can reject orientation lock unless fullscreen was started by a tap.
  }
}

function unlockOrientation() {
  try {
    if (screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
  } catch {
    // Ignore unsupported orientation APIs.
  }
}

function getThumb(video, preferred = "high") {
  return (
    video?.thumbnail ||
    video?.snippet?.thumbnails?.[preferred]?.url ||
    video?.snippet?.thumbnails?.medium?.url ||
    video?.snippet?.thumbnails?.default?.url ||
    ""
  );
}

function getVideoId(video) {
  // Prefer backend-provided `videoId`, fallback to legacy `id.videoId`.
  return video?.videoId || video?.id?.videoId || null;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isNsppdVideo(video) {
  if (!video) return false;
  const churchName = video.churchName;
  const channelTitle = video.channelTitle || video?.snippet?.channelTitle;
  const title = video.title || video?.snippet?.title;
  const combinedText = normalizeText(`${churchName} ${channelTitle} ${title}`);

  if (
    combinedText.includes("koinonia") ||
    combinedText.includes("joshua selman") ||
    combinedText.includes("apostle selman")
  ) {
    return false;
  }

  return (
    churchName === "NSPPD" ||
    normalizeText(channelTitle).includes("nsppd") ||
    normalizeText(title).includes("nsppd")
  );
}

const NSPPD_FALLBACK_VIDEOS = [
  {
    videoId: "98g8-KXP_dU",
    title: "NSPPD Previous Stream 1",
    thumbnail: getVideoThumbnailUrl("98g8-KXP_dU"),
    embedUrl: getVideoEmbedUrl("98g8-KXP_dU"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "vW6VlXmwDs0",
    title: "NSPPD Previous Stream 2",
    thumbnail: getVideoThumbnailUrl("vW6VlXmwDs0"),
    embedUrl: getVideoEmbedUrl("vW6VlXmwDs0"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "KaGNwVxojvQ",
    title: "NSPPD Previous Stream 3",
    thumbnail: getVideoThumbnailUrl("KaGNwVxojvQ"),
    embedUrl: getVideoEmbedUrl("KaGNwVxojvQ"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "YuMknWruBRo",
    title: "NSPPD Previous Stream 4",
    thumbnail: getVideoThumbnailUrl("YuMknWruBRo"),
    embedUrl: getVideoEmbedUrl("YuMknWruBRo"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "knu8shzz4Hg",
    title: "NSPPD Previous Stream 5",
    thumbnail: getVideoThumbnailUrl("knu8shzz4Hg"),
    embedUrl: getVideoEmbedUrl("knu8shzz4Hg"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "VLnTfhYpUuI",
    title: "NSPPD Previous Stream 6",
    thumbnail: getVideoThumbnailUrl("VLnTfhYpUuI"),
    embedUrl: getVideoEmbedUrl("VLnTfhYpUuI"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "YAeHodqjz30",
    title: "NSPPD Previous Stream 7",
    thumbnail: getVideoThumbnailUrl("YAeHodqjz30"),
    embedUrl: getVideoEmbedUrl("YAeHodqjz30"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "q7BtnCL3PS8",
    title: "NSPPD Previous Stream 8",
    thumbnail: getVideoThumbnailUrl("q7BtnCL3PS8"),
    embedUrl: getVideoEmbedUrl("q7BtnCL3PS8"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "qsebg7XQpBQ",
    title: "NSPPD Previous Stream 9",
    thumbnail: getVideoThumbnailUrl("qsebg7XQpBQ"),
    embedUrl: getVideoEmbedUrl("qsebg7XQpBQ"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  },
  {
    videoId: "Lu_eXP8Jz_c",
    title: "NSPPD Previous Stream 10",
    thumbnail: getVideoThumbnailUrl("Lu_eXP8Jz_c"),
    embedUrl: getVideoEmbedUrl("Lu_eXP8Jz_c"),
    churchName: "NSPPD",
    isLive: false,
    streamTitle: "NSPPD"
  }
];

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

      try {
        const liveResponse = await fetch(`${BACKEND_URL}/live-streams`);
        const recentResponse = await fetch(`${BACKEND_URL}/sync-recent-streams`);

        const liveData = liveResponse.ok ? await liveResponse.json() : { streams: [] };
        const recentData = recentResponse.ok ? await recentResponse.json() : { streams: [] };

        const liveStreams = (liveData.streams || [])
          .map((video) => ({
            ...video,
            isLive: true
          }))
          .filter(isNsppdVideo);

        const recentStreams = (recentData.streams || [])
          .map((video) => ({
            ...video,
            isLive: false
          }))
          .filter(isNsppdVideo);

        const sortedRecent = recentStreams
          .filter((video) => getVideoId(video))
          .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

        const liveVideoIds = new Set(
          liveStreams.map((video) => getVideoId(video)).filter(Boolean)
        );

        const uniqueRecent = sortedRecent.filter((video) => {
          const videoId = getVideoId(video);
          return videoId && !liveVideoIds.has(videoId);
        });

        const mergedVideos = [
          ...liveStreams,
          ...uniqueRecent,
          ...NSPPD_FALLBACK_VIDEOS
        ].slice(0, 10);

        if (!active) return;
        setVideos(mergedVideos);
        setActiveHero(0);
      } catch (error) {
        console.error("Unable to fetch watch videos:", error);
        if (active) {
          setVideos(NSPPD_FALLBACK_VIDEOS.slice(0, 10));
        }
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
                  <span className="hero-title">{video.title}</span>
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
                  <span className="recent-title">{video.title}</span>
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
  const routeVideoId = params.videoId || null;
  const fallbackVideoId = "98g8-KXP_dU";
  const fallbackVideoSrc = `https://www.youtube.com/embed/${fallbackVideoId}?autoplay=1&playsinline=1`;
  const stream = { title: "NSPPD" };

  const [videoId, setVideoId] = useState(fallbackVideoId);
  const [videoSrc, setVideoSrc] = useState(fallbackVideoSrc);
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
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPrayerForm, setShowPrayerForm] = useState(false);
  const [showTestimoniesPanel, setShowTestimoniesPanel] = useState(false);
  const [showTestimonyForm, setShowTestimonyForm] = useState(false);
  const [prayerName, setPrayerName] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [testimonyName, setTestimonyName] = useState("");
  const [testimonyText, setTestimonyText] = useState("");

  const commentRef = useRef(null);
  const videoFrameRef = useRef(null);
  const [sessionStart] = useState(Date.now());

  useEffect(() => {
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
      await authPersistenceReady;
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      if (!result?.user) {
        throw new Error("Google login completed without a user.");
      }

      setUser(result.user);
      setShowLogin(false);

      try {
        await setDoc(doc(db, "users", result.user.uid), {
          email: result.user.email,
          coins: 0
        }, { merge: true });
      } catch (walletError) {
        console.error("Unable to sync user wallet after Google login:", walletError);
      }
    } catch (error) {
      console.error("Google login error:", error);
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

  const shareToWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Watch this stream: ${window.location.href}`)}`;
    window.open(url, "_blank");
    setShowShareSheet(false);
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank");
    setShowShareSheet(false);
  };

  const shareToTikTok = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.open("https://www.tiktok.com/", "_blank");
      alert("Link copied to clipboard. Paste it into TikTok.");
    } catch (error) {
      console.error("Unable to copy link for TikTok:", error);
      alert("Unable to copy link. Please try again.");
    }
    setShowShareSheet(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
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
    const setFallbackVideo = () => {
      setVideoId(fallbackVideoId);
      setVideoSrc(
        `https://www.youtube.com/embed/${fallbackVideoId}?autoplay=1&playsinline=1`
      );
    };

    const fetchVideo = async () => {
      setLoadingVideo(true);

      if (routeVideoId) {
        setVideoId(routeVideoId);
        setVideoSrc(getVideoEmbedUrl(routeVideoId));
        setLoadingVideo(false);
        return;
      }

      try {
        const [liveVideos, recentVideos] = await Promise.all([
          fetchBackendVideos("/live-streams"),
          fetchBackendVideos("/sync-recent-streams")
        ]);

        const nsppdLiveVideos = (liveVideos || []).filter(isNsppdVideo);
        const nsppdRecentVideos = (recentVideos || []).filter(isNsppdVideo);

        // 1) Prefer NSPPD live stream
        if (nsppdLiveVideos && nsppdLiveVideos.length > 0) {
          const liveId = getVideoId(nsppdLiveVideos[0]);
          if (liveId) {
            setVideoId(liveId);
            setVideoSrc(getVideoEmbedUrl(liveId));
            setLoadingVideo(false);
            return;
          }
        }

        // 2) Fallback to latest NSPPD recent sermon
        if (nsppdRecentVideos && nsppdRecentVideos.length > 0) {
          const recentId = getVideoId(nsppdRecentVideos[0]);
          if (recentId) {
            setVideoId(recentId);
            setVideoSrc(getVideoEmbedUrl(recentId));
            setLoadingVideo(false);
            return;
          }
        }

        // 3) Hard fallback video
        setFallbackVideo();
      } catch (error) {
        console.error("Unable to fetch NSPPD video from backend:", error);
        setFallbackVideo();
      } finally {
        setLoadingVideo(false);
      }
    };

    fetchVideo();
  }, [routeVideoId, fallbackVideoSrc]);

  useEffect(() => {
    if (!videoId || !videoSrc) {
      setVideoId(fallbackVideoId);
      setVideoSrc(
        `https://www.youtube.com/embed/${fallbackVideoId}?autoplay=1&playsinline=1`
      );
    }
  }, [videoId, videoSrc]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (getFullscreenElement()) {
        lockLandscapeOrientation();
      } else {
        unlockOrientation();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      unlockOrientation();
    };
  }, []);

  const expandVideo = async () => {
    if (!videoFrameRef.current) return;

    try {
      await requestElementFullscreen(videoFrameRef.current);
      await lockLandscapeOrientation();
    } catch (error) {
      console.error("Unable to expand video:", error);
    }
  };

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

      <div className="video-container" ref={videoFrameRef}>
        <iframe
          title="NSPPD Stream"
          src={videoSrc || fallbackVideoSrc}
          width="100%"
          height="100%"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
        {loadingVideo && <div className="no-video">Loading...</div>}
        <button className="video-expand-btn" type="button" onClick={expandVideo} aria-label="Expand video">
          <span />
        </button>
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
          <button className="send-btn" type="button" onClick={sendMessage} aria-label="Send comment">
            <span />
          </button>
        </div>

        <div className="action-row">
          <button className="gift-btn" type="button" onClick={() => setShowGift(true)} aria-label="Send gift">
            {"\uD83C\uDF81"}
          </button>
          <button className="amen-btn" type="button" onClick={sendAmen}>
            <span aria-hidden="true">{"\uD83D\uDE4F"}</span>
            Amen
          </button>
          <button className="share-icon-btn" type="button" onClick={() => setShowShareSheet(true)} aria-label="Share">
            <span className="share-icon" />
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

      <BottomSheet open={showShareSheet} className="share-sheet">
        <div className="share-sheet-content">
          <button className="share-option whatsapp-btn" type="button" onClick={shareToWhatsApp}>
            <span>🟢</span>
            WhatsApp
          </button>
          <button className="share-option facebook-btn" type="button" onClick={shareToFacebook}>
            <span>📘</span>
            Facebook
          </button>
          <button className="share-option tiktok-btn" type="button" onClick={shareToTikTok}>
            <span>🎵</span>
            TikTok
          </button>
        </div>
        <button className="close-btn" type="button" onClick={() => setShowShareSheet(false)}>
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
