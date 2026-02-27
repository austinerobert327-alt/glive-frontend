import { useEffect, useState, useRef } from "react";
import "./App.css";
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
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [likes, setLikes] = useState(0);
  const [showGifts, setShowGifts] = useState(false);
  const chatRef = useRef(null);

  // 🔴 FETCH YOUTUBE LIVE OR LATEST
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
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${API_KEY}`
        );
        const latestData = await latestRes.json();
        setVideoId(latestData.items[0].id.videoId);
        setIsLive(false);
      }
    };

    fetchVideo();
  }, []);

  // 💬 REALTIME CHAT
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => doc.data()));
      setTimeout(() => {
        chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
      }, 100);
    });
    return () => unsub();
  }, []);

  const sendMessage = async () => {
    if (!input) return;
    await addDoc(collection(db, "comments"), {
      text: input,
      createdAt: new Date(),
    });
    setInput("");
  };

  // ❤️ LIKES
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "likes"), (snap) => {
      setLikes(snap.size);
    });
    return () => unsub();
  }, []);

  const sendLike = async () => {
    await addDoc(collection(db, "likes"), {
      createdAt: new Date(),
    });
  };

  // 🎁 PAYSTACK
  const sendGift = (amount) => {
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
        alert("Thank you for supporting ❤️");
      },
    });
    handler.openIframe();
  };

  return (
    <div className="live-container">

      {/* VIDEO */}
      {videoId && (
        <iframe
          className="live-video"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Live Stream"
        />
      )}

      {/* TOP BAR */}
      <div className="top-bar">
        {isLive && <span className="live-badge">LIVE</span>}
        <span className="viewer-count">❤️ {likes}</span>
      </div>

      {/* CHAT OVERLAY */}
      <div className="chat-overlay" ref={chatRef}>
        {comments.map((c, i) => (
          <div key={i} className="chat-bubble">
            {c.text}
          </div>
        ))}
      </div>

      {/* RIGHT ACTIONS */}
      <div className="right-actions">
        <button className="action-btn" onClick={sendLike}>❤️</button>
        <button className="action-btn" onClick={() => setShowGifts(!showGifts)}>🎁</button>
      </div>

      {/* GIFT PANEL */}
      {showGifts && (
        <div className="gift-panel">
          <span onClick={() => sendGift(500)}>🌟</span>
          <span onClick={() => sendGift(1000)}>🔥</span>
          <span onClick={() => sendGift(5000)}>👑</span>
        </div>
      )}

      {/* BOTTOM INPUT */}
      <div className="bottom-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a chat..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;