import { useState, useEffect } from "react";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";

function App() {
  const [activeVideo, setActiveVideo] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  // 🔴 SET DAILY LIVE TIME (7:00 AM WAT)
  const getNextLiveTime = () => {
    const now = new Date();

    // WAT is UTC+1
    const liveTime = new Date();
    liveTime.setUTCHours(6, 0, 0, 0); // 6:00 UTC = 7:00 AM WAT

    // If already past today’s live time, set for tomorrow
    if (now > liveTime) {
      liveTime.setUTCDate(liveTime.getUTCDate() + 1);
    }

    return liveTime;
  };

  const [liveStartTime, setLiveStartTime] = useState(getNextLiveTime());

  // 🔴 Replace with real live ID when stream starts
  const liveVideoId = "REPLACE_WITH_LIVE_VIDEO_ID";

  // Countdown + Auto Live Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = liveStartTime - now;

      if (difference <= 0) {
        setIsLive(true);
        setTimeLeft(null);
      } else {
        setIsLive(false);
        setTimeLeft(difference);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [liveStartTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const churches = [
    {
      name: "NSPPD Live",
      videoId: liveVideoId,
      isLive: isLive,
      pastor: "Pastor Jerry Eze",
      time: "7:00 AM (WAT)",
      image: jerryImage,
    },
    {
      name: "RCCG Live",
      videoId: "dQw4w9WgXcQ",
      isLive: false,
    },
  ];

  const openModal = (videoId) => {
    if (isLive) {
      setActiveVideo(videoId);
    }
  };

  const closeModal = () => {
    setActiveVideo(null);
  };

  const sortedChurches = [...churches].sort((a, b) => b.isLive - a.isLive);

  return (
    <div className="container">
      <section className="hero">
        <h1>GLive</h1>
        <p>Watch Nigerian Christian Services & Devotions Live</p>
      </section>

      <h2 className="section-title">🔴 Live Now</h2>

      <div className="card-grid">
        {sortedChurches.map((church) => (
          <div
            key={church.name}
            className={`card ${church.isLive ? "active-live" : ""}`}
          >
            {church.isLive && <span className="live-badge">LIVE</span>}

            {church.image && (
              <img
                src={church.image}
                alt={church.pastor}
                className="pastor-img"
              />
            )}

            <h3>{church.name}</h3>

            {church.pastor && <p>{church.pastor}</p>}

            {church.time && (
              <p className="live-time">⏰ {church.time}</p>
            )}

            {/* COUNTDOWN BEFORE LIVE */}
            {!church.isLive && church.name === "NSPPD Live" && timeLeft && (
              <p className="countdown">
                ⏳ Starts in: {formatTime(timeLeft)}
              </p>
            )}

            {/* WATCH BUTTON ONLY WHEN LIVE */}
            {church.isLive && (
              <button onClick={() => openModal(church.videoId)}>
                Watch Now
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {activeVideo && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>
              &times;
            </span>

            <iframe
              width="100%"
              height="400"
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
              title="Live Stream"
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
