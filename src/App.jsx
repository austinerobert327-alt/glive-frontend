import { useEffect, useRef, useState, useCallback } from "react";
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
} from "firebase/firestore";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const HANDLE = "pastorjerryeze";

function App() {
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [floatingLikes, setFloatingLikes] = useState([]);

  const commentRef = useRef(null);

  // ==========================
  // FETCH YOUTUBE VIDEO
  // ==========================
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${HANDLE}&key=${API_KEY}`
        );
        const channelData = await channelRes.json();
        if (!channelData.items?.length) return;

        const channelId = channelData.items[0].id.channelId;

        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
        );
        const liveData = await liveRes.json();

        if (liveData.items?.length > 0) {
          setVideoId(liveData.items[0].id.videoId);
          setIsLive(true);
        } else {
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
        console.log("YouTube fetch error:", err);
      }
    };

    fetchVideo();
  }, []);

  // ==========================
  // REALTIME COMMENTS (LIMITED)
  // ==========================
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      orderBy("createdAt", "asc"),
      limit(50) // 🔥 Prevent Firebase overload
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => doc.data()));
    });

    return () => unsub();
  }, []);

  // ==========================
  // SMART AUTO SCROLL
  // ==========================
  useEffect(() => {
    const container = commentRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 20;

    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [comments]);

  // ==========================
  // SEND MESSAGE
  // ==========================
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    await addDoc(collection(db, "comments"), {
      text: input,
      createdAt: new Date(),
    });

    setInput("");
  }, [input]);

  // ==========================
  // FLOATING HEARTS (LIMITED)
  // ==========================
  const sendLike = () => {
    if (floatingLikes.length > 25) return; // 🔥 performance protection

    const id = Date.now();
    const colors = ["#ff2d55", "#ff5e3a", "#ff9500", "#ff3b30", "#ff1493"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    setFloatingLikes((prev) => [
      ...prev,
      { id, color: randomColor, left: Math.random() * 60 }
    ]);

    setTimeout(() => {
      setFloatingLikes((prev) =>
        prev.filter((like) => like.id !== id)
      );
    }, 3000);
  };

  return (
    <div className="mobile-container">
      <div className="card">
        {isLive && <span className="live-badge">LIVE</span>}
        <img src={jerryImage} alt="NSPPD" />
        <button onClick={() => setShowModal(true)}>
          {isLive ? "Watch Live" : "Watch Latest"}
        </button>
      </div>

      {showModal && (
        <div className="live-screen">

          {/* VIDEO */}
          <div className="video-wrapper">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Live"
            />
          </div>

          {/* COMMENTS */}
          <div className="comment-section" ref={commentRef}>
            {comments.map((c, i) => (
              <div key={i} className="comment">
                {c.text}
              </div>
            ))}
          </div>

          {/* FLOATING HEARTS */}
          <div className="floating-container">
            {floatingLikes.map((heart) => (
              <div
                key={heart.id}
                className="floating-heart"
                style={{
                  left: `${heart.left}%`,
                  color: heart.color
                }}
              >
                ❤️
              </div>
            ))}
          </div>

          {/* BOTTOM BAR */}
          <div className="bottom-bar">
            <div className="input-wrapper">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send message..."
              />
              <span onClick={sendMessage}>➤</span>
            </div>

            <button onClick={sendLike}>❤️</button>
            <button>🎁</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;