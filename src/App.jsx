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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Chat + Interaction
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [username, setUsername] = useState("");
  const [likes, setLikes] = useState(0);

  // ---------------- YOUTUBE FETCH ----------------
  useEffect(() => {
    const fetchChannelAndVideos = async () => {
      try {
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

        setLoading(false);
      } catch (error) {
        console.error("YouTube API Error:", error);
        setLoading(false);
      }
    };

    fetchChannelAndVideos();
  }, []);

  // ---------------- REALTIME COMMENTS ----------------
  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => doc.data()));
    });

    return () => unsubscribe();
  }, []);

  const sendComment = async () => {
    if (!commentInput || !username) return;

    await addDoc(collection(db, "comments"), {
      name: username,
      text: commentInput,
      createdAt: new Date(),
    });

    setCommentInput("");
  };

  // ---------------- LIKES ----------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "likes"), (snapshot) => {
      setLikes(snapshot.size);
    });

    return () => unsub();
  }, []);

  const sendLike = async () => {
    await addDoc(collection(db, "likes"), {
      createdAt: new Date(),
    });
  };

  // ---------------- GIFTS (Paystack) ----------------
  const payGift = (amount) => {
    const generatedEmail = `supporter${Date.now()}@glive.com`;

    const handler = window.PaystackPop.setup({
      key: "pk_live_019365ea37124e26f8baec964658b07837520356",
      email: generatedEmail,
      amount: amount * 100,
      currency: "NGN",
      callback: async function () {
        await addDoc(collection(db, "gifts"), {
          amount,
          createdAt: new Date(),
        });

        alert("Thank you for your gift ❤️");
      },
      onClose: function () {
        console.log("Payment closed");
      },
    });

    handler.openIframe();
  };

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

          {loading ? (
            <button disabled>Checking Status...</button>
          ) : (
            <button onClick={() => setShowModal(true)}>
              {isLive ? "Watch Live" : "Watch Latest Service"}
            </button>
          )}
        </div>
      </div>

      {/* VIDEO MODAL */}
      {showModal && videoId && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowModal(false)}>
              &times;
            </span>

            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="NSPPD Stream"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            ></iframe>

            {/* INTERACTION SECTION */}
            <div className="interaction">

              <button onClick={sendLike}>
                ❤️ {likes}
              </button>

              <div className="gift-buttons">
                <button onClick={() => payGift(500)}>🌟 ₦500</button>
                <button onClick={() => payGift(1000)}>🔥 ₦1000</button>
                <button onClick={() => payGift(5000)}>👑 ₦5000</button>
              </div>

              <div className="chat-box">
                <h3>Live Chat</h3>

                <input
                  placeholder="Your Name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <div className="messages">
                  {comments.map((c, index) => (
                    <p key={index}>
                      <strong>{c.name}:</strong> {c.text}
                    </p>
                  ))}
                </div>

                <input
                  placeholder="Type a message..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                />

                <button onClick={sendComment}>Send</button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
