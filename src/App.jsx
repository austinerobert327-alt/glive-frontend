import { useEffect, useRef, useState } from "react";
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
  const [floatingLikes, setFloatingLikes] = useState([]);

  const commentRef = useRef(null);

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

  // AUTO SCROLL when comments update
  useEffect(() => {
    if (commentRef.current) {
      commentRef.current.scrollTop = commentRef.current.scrollHeight;
    }
  }, [comments]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, "comments"), {
      text: input,
      createdAt: new Date(),
    });
    setInput("");
  };

  // Floating hearts
  const sendLike = () => {
    const id = Date.now();
    const colors = ["#ff2d55", "#ff5e3a", "#ff9500", "#ff3b30", "#ff1493"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    setFloatingLikes((prev) => [
      ...prev,
      { id, color: randomColor, left: Math.random() * 40 }
    ]);

    setTimeout(() => {
      setFloatingLikes((prev) => prev.filter((like) => like.id !== id));
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
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              allow="autoplay"
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
                  left: `${heart.left}px`,
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