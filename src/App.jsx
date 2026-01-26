import './App.css';
import { FacebookShareButton, FacebookIcon, WhatsappShareButton, WhatsappIcon } from 'react-share';

function App() {
  const websiteUrl = "https://yourglivewebsite.com"; // replace with your live website URL

  const churches = [
    { name: "RCCG Live", url: "https://www.youtube.com/@rccglive/streams" },
    { name: "Dunamis Live", url: "https://www.youtube.com/@dunamisgospelchurch/streams" },
    { name: "Winners Chapel Live", url: "https://www.youtube.com/@WinnersChapelIntl/streams" },
  ];

  const devotions = [
    { name: "Nathaniel Bassey Devotion", url: "https://www.youtube.com/channel/UCRe2Ir9wtPk_YQjElam7n2w" },
    { name: "Jerry Eze (NSPPD)", url: "https://www.youtube.com/channel/UCLg4NCAJxhIvD4IRV__LOFg" },
  ];

  return (
    <div className="container">
      <header>
        <h1>GLive</h1>
        <p>Nigerian Christian Live Services</p>
      </header>

      <h2>Live Church Services</h2>
      <div className="church-list">
        {churches.map((church) => (
          <div key={church.name} className="church-card">
            <h3>{church.name}</h3>
            <a href={church.url} target="_blank" rel="noreferrer">
              Watch Now
            </a>
          </div>
        ))}
      </div>

      <h2>Morning Devotion</h2>
      <div className="church-list">
        {devotions.map((devotion) => (
          <div key={devotion.name} className="church-card">
            <h3>{devotion.name}</h3>
            <a href={devotion.url} target="_blank" rel="noreferrer">
              Watch Devotion
            </a>
          </div>
        ))}
      </div>

      {/* SINGLE SHARE SECTION */}
      <div className="share-section">
        <span className="share-label">Share GLive:</span>
        <div className="share-buttons">
          <WhatsappShareButton url={websiteUrl} title="Check out GLive - Nigerian Christian Live Services">
            <WhatsappIcon size={40} round />
          </WhatsappShareButton>

          <FacebookShareButton url={websiteUrl} quote="Check out GLive - Nigerian Christian Live Services">
            <FacebookIcon size={40} round />
          </FacebookShareButton>
        </div>
      </div>
    </div>
  );
}

export default App;
