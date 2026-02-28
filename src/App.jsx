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
  const [likes, setLikes] = useState(0);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const [showGiftAnim, setShowGiftAnim] = useState(null);

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

  // Chat realtime
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

  // Likes realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "likes"), (snap) => {
      setLikes(snap.size);
    });
    return () => unsub();
  }, []);

  const sendLike = async () => {
    await addDoc(collection(db, "likes"), { createdAt: new Date() });
    setShowLikeAnim(true);
    setTimeout(() => setShowLikeAnim(false), 800);
  };

  // Gift
  const sendGift = (emoji, amount) => {
    const handler = window.PaystackPop.setup({
      key: "pk_live_019365ea37124e26f8baec964658b07837520356",
      email: `user${Date.now()}@glive.com`,
      amount: amount * 100,
      currency: "NGN",
      callback: async function () {
        await addDoc(collection(db, "gifts"), {
          amount,
          createdAt: new Date(),
        });
        setShowGiftAnim(emoji);
        setTimeout(() => setShowGiftAnim(null), 1000);
      },
    });
    handler.openIframe();
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

            <span className="close" onClick={() => setShowModal(false)}>×</span>

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
                <div key={i} className="comment">{c.text}</div>
              ))}
            </div>

            {/* BOTTOM BAR */}
            <div className="bottom-action-bar">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send message..."
              />

              <button className="icon-btn" onClick={sendMessage}>➤</button>

              <button className="icon-btn" onClick={sendLike}>
                ❤️ {likes}
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
            <span onClick={() => sendGift("🌟", 500)}>🌟</span>
            <span onClick={() => sendGift("🔥", 1000)}>🔥</span>
            <span onClick={() => sendGift("👑", 5000)}>👑</span>
            <button onClick={() => setShowGiftPanel(false)}>Close</button>
          </div>

          {/* CENTER ANIMATIONS */}
          {showLikeAnim && <div className="center-anim">❤️</div>}
          {showGiftAnim && <div className="center-anim">{showGiftAnim}</div>}

        </div>
      )}
    </div>
  );
}

export default App;