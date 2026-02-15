import { useState } from "react";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";

function App() {
  const [activeVideo, setActiveVideo] = useState(null);

  const churches = [
    {
      name: "NSPPD Live",
      videoId: "dQw4w9WgXcQ", // replace with real live ID in morning
      isLive: true,
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
    setActiveVideo(videoId);
  };

  const closeModal = () => {
    setActiveVideo(null);
  };

  // Put active live at top
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

            <button onClick={() => openModal(church.videoId)}>
              Watch Now
            </button>
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
