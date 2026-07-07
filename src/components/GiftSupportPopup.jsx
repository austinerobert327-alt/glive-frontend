import React from "react";

export default function GiftSupportPopup({ open, onSendNow, onIgnore }) {
    if (!open) return null;

    return (
        <div className="gift-support-overlay">
            <div className="gift-support-card" role="dialog" aria-modal="true" aria-labelledby="gift-support-title">
                <h2 id="gift-support-title">🙏 Support This Live Broadcast</h2>
                <p>Send a gift to support this live broadcast and help us continue reaching lives through prayer.</p>
                <div className="gift-support-actions">
                    <button type="button" className="gift-support-primary" onClick={onSendNow}>
                        Send Now
                    </button>
                    <button type="button" className="gift-support-secondary" onClick={onIgnore}>
                        Ignore
                    </button>
                </div>
            </div>
        </div>
    );
}
