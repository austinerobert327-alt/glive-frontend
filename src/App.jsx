import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [activeVideo, setActiveVideo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // Set your NSPPD live start time (replace with actual time)
  const liveStartTime = new Date("2026-02-16T08:00:00Z"); // UTC time

  // NSPPD Live info
  const nsppdLive = {
    name: "NSPPD Live (Jerry Eze)",
    videoId: "REPLACE_WITH_CURRENT_LIVE_VIDEO_ID", // update when live starts
    thumbnail: "https://i.imgur.com/3yZJg7B.jpg", // placeholder image of Pastor Jerry Eze
    isLive: false,
  };

  // Countdown timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = liveStartTime - now;

      if (diff <= 0) {
        setTimeLeft(null);
        nsppdLive.isLive = true; // live started
        setActiveVideo(nsppdLive.videoId); // auto open modal when live starts
        clearInterval(timer);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const openModal = (videoId) => setActiveVideo(videoId);
  const closeModal = () => setActiveVideo(null);

  return (
    <div className="container">

      {/* HERO */}
      <section className="hero">
        <h1>GLive</h1>
        <p>Watch Nigerian Christian Services & Devotions Live</p>
      </section>

      {/* LIVE NOW / COUNTDOWN */}
      <h2 className="section-title">🔴 NSPPD Live</h2>
      <div className="card-grid">
        <div className="card">
          <img src={nsppdLive.thumbnail} alt={nsppdLive.name} className="card-image" />
          <h3>{nsppdLive.name}</h3>

          {timeLeft ? (
            <p className="countdown">⏳ Live starts in: {formatTime(timeLeft)}</p>
          ) : (
            <button onClick={() => openModal(nsppdLive.videoId)}>Watch Now</button>
          )}
        </div>
      </div>

      {/* Modal */}
      {activeVideo && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>&times;</span>
            <iframe
              width="100%"
              height="400"
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
              title="NSPPD Live Stream"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            ></iframe>
            <div className="donation">
              <h3>🙏 Support This Ministry</h3>
              <button className="donate-btn">Donate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
