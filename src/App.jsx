import { useState } from "react";
import "./App.css";

function App() {
  const [activeVideo, setActiveVideo] = useState(null);

  const churches = [
    {
      name: "NSPPD Live (Jerry Eze)",
      channelId: "UCi6v8ZL2yV8iZc3kxQwE7KQ", // NSPPD channel ID
      isLive: true,
    },
    {
      name: "RCCG Live",
      videoId: "dQw4w9WgXcQ", // placeholder
      isLive: false,
    },
  ];

  const openModal = (church) => {
    if (church.channelId) {
      setActiveVideo(`https://www.youtube.com/embed/live_stream?channel=${church.channelId}&autoplay=1`);
    } else {
      setActiveVideo(`https://www.youtube.com/embed/${church.videoId}?autoplay=1`);
    }
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
          <div key={church.name} className={`card ${church.isLive ? "active-live" : ""}`}>
            {church.isLive && <span className="live-badge">LIVE</span>}
            <h3>{church.name}</h3>
            <button onClick={() => openModal(church)}>Watch Now</button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {activeVideo && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>&times;</span>

            <iframe
              width="100%"
              height="400"
              src={activeVideo}
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
