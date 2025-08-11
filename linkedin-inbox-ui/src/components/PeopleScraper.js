import React, { useState } from 'react';
import './PeopleScraper.css';
import api from '../services/api';

const PeopleScraper = ({ onScrapeComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastScrapeResult, setLastScrapeResult] = useState(null);
  const [error, setError] = useState(null);
  const [companyUrl, setCompanyUrl] = useState('');
  const [peopleLimit, setPeopleLimit] = useState(10);
  const [isValidUrl, setIsValidUrl] = useState(false);

  // Validate LinkedIn company URL
  const validateCompanyUrl = (url) => {
    const linkedinCompanyPattern = /^https?:\/\/www\.linkedin\.com\/company\/[^\/]+\/people\/?$/;
    return linkedinCompanyPattern.test(url);
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setCompanyUrl(url);
    setIsValidUrl(validateCompanyUrl(url));
  };

  const handleScrapePeople = async () => {
    if (!isValidUrl) {
      setError('Please enter a valid LinkedIn company people page URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.scrapePeople(companyUrl, parseInt(peopleLimit));

      if (data.success) {
        setLastScrapeResult(data.data);
        setError(null);
        
        // Call the callback to refresh data if needed
        if (onScrapeComplete && typeof onScrapeComplete === 'function') {
          onScrapeComplete();
        }
      } else {
        setError(data.message || 'Failed to scrape people');
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
    <div className="people-scraper">
      <div className="scraper-header">
        <h3>👥 Company People Scraper</h3>
        <div className="scraper-info">
          Scrape people from LinkedIn company pages and extract their information
        </div>
      </div>

      <div className="scraper-controls">
        <div className="url-control">
          <label htmlFor="company-url">Company People Page URL:</label>
          <input
            type="url"
            id="company-url"
            value={companyUrl}
            onChange={handleUrlChange}
            placeholder="https://www.linkedin.com/company/companyname/people/"
            className={companyUrl && !isValidUrl ? 'invalid' : ''}
            disabled={isLoading}
          />
          {companyUrl && !isValidUrl && (
            <div className="url-error">Please enter a valid LinkedIn company people page URL</div>
          )}
        </div>

        <div className="limit-control">
          <label htmlFor="people-limit">Number of people to scrape:</label>
          <select 
            id="people-limit"
            value={peopleLimit} 
            onChange={(e) => setPeopleLimit(e.target.value)}
            disabled={isLoading}
          >
            <option value={1}>1 person</option>
            <option value={2}>2 people</option>
            <option value={3}>3 people</option>
            <option value={5}>5 people</option>
            <option value={10}>10 people</option>
            <option value={20}>20 people</option>
            <option value={50}>50 people</option>
            <option value={100}>100 people</option>
          </select>
        </div>

        <button 
          className={`scrape-button ${isLoading ? 'loading' : ''}`}
          onClick={handleScrapePeople}
          disabled={isLoading || !isValidUrl}
        >
          {isLoading ? (
            <>
              <div className="scrape-spinner"></div>
              Scraping People...
            </>
          ) : (
            <>
              🔍 Scrape People
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
            <div className="results-timestamp">
              {formatTimestamp(lastScrapeResult.timestamp)}
            </div>
          </div>
          
          <div className="results-stats">
            <div className="stat-item">
              <span className="stat-label">Company:</span>
              <span className="stat-value">{lastScrapeResult.companyName}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Found:</span>
              <span className="stat-value">{lastScrapeResult.totalPeople}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Successfully Scraped:</span>
              <span className="stat-value success">{lastScrapeResult.scrapedPeople}</span>
            </div>
            {lastScrapeResult.errors && lastScrapeResult.errors.length > 0 && (
              <div className="stat-item">
                <span className="stat-label">Errors:</span>
                <span className="stat-value error">{lastScrapeResult.errors.length}</span>
              </div>
            )}
          </div>

          {lastScrapeResult.people && lastScrapeResult.people.length > 0 && (
            <div className="scraped-people">
              <div className="people-title">Scraped People:</div>
              <div className="people-list">
                {lastScrapeResult.people.map((person, index) => (
                  <div key={index} className="person-item">
                    <div className="person-header">
                      <div className="person-name">{person.name}</div>
                      {person.title && (
                        <div className="person-title">{person.title}</div>
                      )}
                    </div>
                    {person.location && (
                      <div className="person-location">📍 {person.location}</div>
                    )}
                    {person.linkedinUrl && (
                      <div className="person-linkedin">
                        <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          View Profile
                        </a>
                      </div>
                    )}
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
          <li>Use the exact company people page URL (e.g., /company/companyname/people/)</li>
          <li>Start with a small number of people (1-5) to test</li>
          <li>The scraper will extract names, titles, locations, and profile URLs</li>
          <li>Be respectful of LinkedIn's rate limits and terms of service</li>
          <li>This tool is for legitimate business research purposes only</li>
        </ul>
      </div>
    </div>
  );
};

export default PeopleScraper;
