import { useState } from "react";
import "./App.css";
import jerryImage from "./assets/jerry.jpg";

// ✅ Official Pastor Jerry Eze Channel ID
const CHANNEL_ID = "UC8M9xAqK0eQ7bQ8fEzeNSPPD";

function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="container">
      <section className="hero">
        <h1>GLive</h1>
        <p>Watch Nigerian Christian Services & Devotions Live</p>
      </section>

      <h2 className="section-title">🔴 NSPPD Live</h2>

      <div className="card-grid">
        <div className="card active-live">
          <span className="live-badge">LIVE</span>

          <img
            src={jerryImage}
            alt="Pastor Jerry Eze"
            className="pastor-img"
          />

          <h3>NSPPD Live Prayer</h3>
          <p>Pastor Jerry Eze</p>
          <p className="live-time">⏰ 7:00 AM (WAT)</p>

          <button onClick={() => setShowModal(true)}>
            Watch Now
          </button>

          <a
            href="https://www.youtube.com/@pastorjerryeze/live"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="youtube-btn">
              Watch on YouTube
            </button>
          </a>
        </div>
      </div>

      {/* POPUP MODAL */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <span
              className="close"
              onClick={() => setShowModal(false)}
            >
              &times;
            </span>

            <iframe
              src={`https://www.youtube.com/embed/live_stream?channel=${CHANNEL_ID}&autoplay=1`}
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
