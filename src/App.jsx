import { useEffect, useState } from "react";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const HANDLE = "pastorjerryeze";

function App() {
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [floatingLikes, setFloatingLikes] = useState([]);

  // Fetch YouTube
  useEffect(() => {
    const fetchVideo = async () => {
      const channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${HANDLE}&key=${API_KEY}`
      );
      const channelData = await channelRes.json();
      const channelId = channelData.items[0].id.channelId;

      const liveRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
      );
      const liveData = await liveRes.json();

      if (liveData.items.length > 0) {
        setVideoId(liveData.items[0].id.videoId);
        setIsLive(true);
      } else {
        const latestRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`
        );
        const latestData = await latestRes.json();
        setVideoId(latestData.items[0].id.videoId);
        setIsLive(false);
      }
    };

    fetchVideo();
  }, []);

  // Realtime comments
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => doc.data()));
    });
    return () => unsub();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "comments"), {
      text: input,
      createdAt: new Date(),
    });
    setInput("");
  };

  // Floating like animation
  const sendLike = () => {
    const id = Date.now();
    setFloatingLikes((prev) => [...prev, id]);

    setTimeout(() => {
      setFloatingLikes((prev) => prev.filter((like) => like !== id));
    }, 3000);
  };

  return (
    <div className="page">
      {/* PRE PAGE */}
      <div className="card">
        {isLive && <span className="live-badge">LIVE</span>}
        <img src={jerryImage} alt="NSPPD" />
        <button onClick={() => setShowModal(true)}>
          {isLive ? "Watch Live" : "Watch Latest"}
        </button>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-top">
            <span className="close" onClick={() => setShowModal(false)}>
              ×
            </span>

            {/* VIDEO */}
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              allow="autoplay"
              allowFullScreen
              title="Live"
            />

            {/* COMMENTS */}
            <div className="comment-section">
              {comments.map((c, i) => (
                <div key={i} className="comment">
                  {c.text}
                </div>
              ))}
            </div>

            {/* FLOATING HEARTS */}
            <div className="floating-container">
              {floatingLikes.map((id) => (
                <div key={id} className="floating-heart">
                  ❤️
                </div>
              ))}
            </div>

            {/* BOTTOM BAR */}
            <div className="bottom-action-bar">
              <div className="input-wrapper">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Send message..."
                />
                <span className="send-inside" onClick={sendMessage}>
                  ➤
                </span>
              </div>

              <button className="icon-btn" onClick={sendLike}>
                ❤️
              </button>

              <button
                className="icon-btn"
                onClick={() => setShowGiftPanel(true)}
              >
                🎁
              </button>
            </div>
          </div>

          {/* GIFT PANEL */}
          <div className={`gift-panel ${showGiftPanel ? "show" : ""}`}>
            <span>🌟</span>
            <span>🔥</span>
            <span>👑</span>
            <button onClick={() => setShowGiftPanel(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;