import React, { useState } from 'react';
import './ConversationScraper.css';
import api from '../services/api';

const ConversationScraper = ({ onScrapeComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastScrapeResult, setLastScrapeResult] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(1);

  const handleScrapeConversations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.scrapeConversations(parseInt(limit));

      if (data.success) {
        setLastScrapeResult(data.data);
        setError(null);
        
        // Call the callback to refresh conversations list
        if (onScrapeComplete && typeof onScrapeComplete === 'function') {
          onScrapeComplete();
        }
      } else {
        setError(data.message || 'Failed to scrape conversations');
        setLastScrapeResult(null);
      }
    } catch (err) {
      setError('Network error: ' + err.message);
      setLastScrapeResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="conversation-scraper">
      <div className="scraper-header">
        <h3>📥 Conversation Scraper</h3>
        <div className="scraper-info">
          Fetch and sync LinkedIn conversations to the dashboard
        </div>
      </div>

      <div className="scraper-controls">
        <div className="limit-control">
          <label htmlFor="scrape-limit">Conversations to scrape:</label>
          <select 
            id="scrape-limit"
            value={limit} 
            onChange={(e) => setLimit(e.target.value)}
            disabled={isLoading}
          >
            <option value={2}>2 conversations</option>
            <option value={5}>5 conversations</option>
            <option value={10}>10 conversations</option>
            <option value={20}>20 conversations</option>
            <option value={50}>50 conversations</option>
          </select>
        </div>

        <button 
          className={`scrape-button ${isLoading ? 'loading' : ''}`}
          onClick={handleScrapeConversations}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="scrape-spinner"></div>
              Scraping...
            </>
          ) : (
            <>
              🔄 Scrape Conversations
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="scraper-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {lastScrapeResult && (
        <div className="scraper-results">
          <div className="results-header">
            <div className="results-icon">✅</div>
            <div className="results-title">Last Scrape Results</div>
          </div>
          
          <div className="results-stats">
            <div className="stat-item">
              <span className="stat-label">Total Found:</span>
              <span className="stat-value">{lastScrapeResult.totalConversations}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Successfully Scraped:</span>
              <span className="stat-value success">{lastScrapeResult.scrapedConversations}</span>
            </div>
            {lastScrapeResult.errors && lastScrapeResult.errors.length > 0 && (
              <div className="stat-item">
                <span className="stat-label">Errors:</span>
                <span className="stat-value error">{lastScrapeResult.errors.length}</span>
              </div>
            )}
          </div>

          {lastScrapeResult.conversations && lastScrapeResult.conversations.length > 0 && (
            <div className="scraped-conversations">
              <div className="conversations-title">Scraped Conversations:</div>
              <div className="conversations-list">
                {lastScrapeResult.conversations.map((conv, index) => (
                  <div key={index} className="conversation-item">
                    <div className="conversation-name">{conv.contactName}</div>
                    <div className="conversation-count">{conv.messageCount} messages</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastScrapeResult.errors && lastScrapeResult.errors.length > 0 && (
            <div className="scraper-errors">
              <div className="errors-title">Errors encountered:</div>
              <div className="errors-list">
                {lastScrapeResult.errors.map((error, index) => (
                  <div key={index} className="error-item">{error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="scraper-tips">
        <div className="tips-title">💡 Tips:</div>
        <ul className="tips-list">
          <li>Make sure you're logged in to LinkedIn first</li>
          <li>Start with a small number of conversations (2-5)</li>
          <li>The scraper will automatically detect contact names</li>
          <li>Scraped messages will appear in your conversations list</li>
          <li>Use this to sync your latest LinkedIn conversations</li>
        </ul>
      </div>
    </div>
  );
};

export default ConversationScraper;
