import { useEffect, useState } from "react";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const HANDLE = "pastorjerryeze";

function App() {
  const [videoId, setVideoId] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchChannelAndVideos = async () => {
      try {
        // 1️⃣ Get real channel ID from handle
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${HANDLE}&key=${API_KEY}`
        );

        const channelData = await channelRes.json();

        if (!channelData.items || channelData.items.length === 0) {
          throw new Error("Channel not found");
        }

        const channelId = channelData.items[0].id.channelId;

        // 2️⃣ Check if LIVE
        const liveRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`
        );

        const liveData = await liveRes.json();

        if (liveData.items && liveData.items.length > 0) {
          setVideoId(liveData.items[0].id.videoId);
          setIsLive(true);
        } else {
          // 3️⃣ If not live → get latest upload
          const latestRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${API_KEY}`
          );

          const latestData = await latestRes.json();

          if (latestData.items && latestData.items.length > 0) {
            setVideoId(latestData.items[0].id.videoId);
            setIsLive(false);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("YouTube API Error:", error);
        setLoading(false);
      }
    };

    fetchChannelAndVideos();
  }, []);

  return (
    <div className="container">
      <section className="hero">
        <h1>GLive</h1>
        <p>Watch Nigerian Christian Services & Devotions Live</p>
      </section>

      <h2 className="section-title">🔴 NSPPD</h2>

      <div className="card-grid">
        <div className={`card ${isLive ? "active-live" : "offline"}`}>
          {isLive ? (
            <span className="live-badge">LIVE</span>
          ) : (
            <span className="offline-badge">OFFLINE</span>
          )}

          <img
            src={jerryImage}
            alt="Pastor Jerry Eze"
            className="pastor-img"
          />

          <h3>NSPPD Prayer Service</h3>
          <p>Pastor Jerry Eze</p>
          <p className="live-time">⏰ 7:00 AM (WAT)</p>

          {loading ? (
            <button disabled>Checking Status...</button>
          ) : (
            <button
              disabled={!videoId}
              onClick={() => setShowModal(true)}
            >
              {isLive ? "Watch Live" : "Watch Latest Service"}
            </button>
          )}
        </div>
      </div>

      {showModal && videoId && (
        <div className="modal">
          <div className="modal-content">
            <span
              className="close"
              onClick={() => setShowModal(false)}
            >
              &times;
            </span>

            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="NSPPD Stream"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
