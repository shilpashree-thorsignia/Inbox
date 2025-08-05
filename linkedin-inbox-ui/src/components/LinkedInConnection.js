import React, { useState, useEffect } from 'react';
import './LinkedInConnection.css';
import api from '../services/api';

const LinkedInConnection = ({ onConnectionChange, standalone = false }) => {
  // Conversation Scraper state and logic
  const [scrapeLimit, setScrapeLimit] = useState(2);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [scrapeError, setScrapeError] = useState(null);

  const handleScrapeConversations = async () => {
    setScrapeLoading(true);
    setScrapeError(null);
    try {
      const data = await api.scrapeConversations(parseInt(scrapeLimit));
      if (data.success) {
        setScrapeResult(data.data);
        setScrapeError(null);
        // Optionally, call a parent callback if needed (e.g. refresh conversations)
        if (onConnectionChange && typeof onConnectionChange === 'function') {
          onConnectionChange({ type: 'scrape', result: data.data });
        }
      } else {
        setScrapeError(data.message || 'Failed to scrape conversations');
        setScrapeResult(null);
      }
    } catch (err) {
      setScrapeError('Network error: ' + err.message);
      setScrapeResult(null);
    } finally {
      setScrapeLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  const [status, setStatus] = useState({
    isLoggedIn: false,
    hasActiveBrowser: false,
    linkedInProfile: null,
    loading: true
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Check LinkedIn connection status
  const checkStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      const data = await api.getLinkedInStatus();
      setStatus({
        isLoggedIn: data.isLoggedIn,
        hasActiveBrowser: data.hasActiveBrowser,
        linkedInProfile: data.linkedInProfile,
        loading: false
      });
      
      // In standalone mode, if profile is detected, automatically create/login user
      if (standalone && data.linkedInProfile && data.isLoggedIn) {
        try {
          // Auto-create user based on LinkedIn profile
          const loginData = await api.login(
            data.linkedInProfile.name || data.linkedInProfile.email || 'linkedin-user',
            data.linkedInProfile.email
          );
          
          // Store auth token
          localStorage.setItem('authToken', loginData.token);
          
          // Notify parent of successful connection and login
          if (onConnectionChange) {
            onConnectionChange({
              isConnected: true,
              profile: data.linkedInProfile,
              user: loginData.user
            });
          }
          
          setMessage('Successfully connected! Redirecting to dashboard...');
          
          // Reload to enter authenticated state
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          
        } catch (loginError) {
          console.error('Auto-login failed:', loginError);
          setError('Failed to create user account. Please try again.');
        }
      } else {
        // Notify parent component of connection status
        if (onConnectionChange) {
          onConnectionChange({
            isConnected: data.isLoggedIn,
            profile: data.linkedInProfile
          });
        }
      }
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
      setStatus(prev => ({ ...prev, loading: false }));
      setError('Failed to check LinkedIn connection status');
    }
  };

  // Connect to LinkedIn
  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    setMessage('');
    
    try {
      const result = await api.connectToLinkedIn();
      
      if (result.success) {
        setMessage(result.message);
        // Check status after a delay to see if user logged in
        setTimeout(() => {
          checkStatus();
        }, 5000);
      } else {
        setError(result.message || 'Failed to connect to LinkedIn');
      }
    } catch (error) {
      setError('Connection failed: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Detect LinkedIn profile after manual login
  const handleDetectProfile = async () => {
    setIsDetecting(true);
    setError('');
    setMessage('');
    
    try {
      const result = await api.detectLinkedInProfile();
      
      if (result.success) {
        setMessage(result.message);
        await checkStatus(); // Refresh status
      } else {
        setError(result.message || 'Failed to detect LinkedIn profile');
      }
    } catch (error) {
      setError('Profile detection failed: ' + error.message);
    } finally {
      setIsDetecting(false);
    }
  };

  // Disconnect from LinkedIn
  const handleDisconnect = async () => {
    try {
      await api.disconnectFromLinkedIn();
      
      // Reset all state to disconnected
      setStatus({
        isLoggedIn: false,
        hasActiveBrowser: false,
        linkedInProfile: null,
        loading: false
      });
      
      // Reset scraper state
      setScrapeResult(null);
      setScrapeError(null);
      setScrapeLoading(false);
      
      // Clear any stored auth tokens
      localStorage.removeItem('authToken');
      localStorage.removeItem('sessionToken');
      
      // Notify parent of disconnection
      if (onConnectionChange) {
        onConnectionChange({
          isConnected: false,
          profile: null
        });
      }
      
      setMessage('Disconnected from LinkedIn successfully');
      setError('');
    } catch (error) {
      setError('Failed to disconnect: ' + error.message);
    }
  };

  // Check status on component mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status.loading) {
    return (
      <div className="linkedin-connection loading">
        <div className="loading-spinner"></div>
        <p>Checking LinkedIn connection...</p>
      </div>
    );
  }

  return (
    <div className="linkedin-connection">
      <div className="connection-header">
        <div className="linkedin-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <h3>LinkedIn Connection</h3>
      </div>

      {!status.isLoggedIn ? (
        <div className="connection-content">
          <div className="connection-status disconnected">
            <div className="status-indicator"></div>
            <span>Not connected to LinkedIn</span>
          </div>
          
          <div className="connection-message">
            <p>🚀 <strong>Connect to LinkedIn to automate your conversations!</strong></p>
            <ul>
              <li>View and manage your LinkedIn messages</li>
              <li>Send messages directly through the dashboard</li>
              <li>Scrape conversation history automatically</li>
              <li>Access your personalized LinkedIn data</li>
            </ul>
          </div>

          <button 
            className="connect-button"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="loading-spinner small"></span>
                Connecting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Connect to LinkedIn
              </>
            )}
          </button>

          {status.hasActiveBrowser && !status.isLoggedIn && (
            <div className="manual-login-section">
              <p className="manual-login-text">
                Already logged in to LinkedIn manually? 
              </p>
              <button 
                className="detect-button"
                onClick={handleDetectProfile}
                disabled={isDetecting}
              >
                {isDetecting ? 'Detecting...' : 'Detect My Profile'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="connection-content">
          <div className="connection-status connected">
            <div className="status-indicator"></div>
            <span>Connected to LinkedIn</span>
          </div>

          {status.linkedInProfile && (
            <div className="profile-info">
              <div className="profile-avatar">
                {status.linkedInProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="profile-details">
                <h4>{status.linkedInProfile.name}</h4>
                {status.linkedInProfile.profileUrl && (
                  <a 
                    href={status.linkedInProfile.profileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="profile-link"
                  >
                    View LinkedIn Profile
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="connected-features">
            <p>✅ <strong>Your LinkedIn is now connected!</strong></p>
            <ul>
              <li>✅ Access to your LinkedIn conversations</li>
              <li>✅ Automated message sending</li>
              <li>✅ Conversation scraping enabled</li>
              <li>‼️ Real-time message synchronization</li>
            </ul>

            {/* Conversation Scraper Button & Feedback */}
            <div className="sidebar-scraper-controls">
              <div className="scraper-label">
  <span className="scraper-label-icon" role="img" aria-label="sync">🔄</span>
  <span className="scraper-label-text">Select chat threads to sync:</span>
</div>
              <div className="scraper-row">
                <select 
                  id="scrape-limit"
                  value={scrapeLimit} 
                  onChange={(e) => setScrapeLimit(e.target.value)}
                  disabled={scrapeLoading}
                  className="scraper-dropdown"
                >
                  <option value={2}>2 chats</option>
                  <option value={5}>5 chats</option>
                  <option value={10}>10 chats</option>
                  <option value={20}>20 chats</option>
                  <option value={50}>50 chats</option>
                </select>
                <button 
                  className={`scrape-button ${scrapeLoading ? 'loading' : ''}`}
                  onClick={handleScrapeConversations}
                  disabled={scrapeLoading}
                >
                {scrapeLoading ? (
                  <>
                    <div className="scrape-spinner"></div>
                    Scraping...
                  </>
                ) : (
                  <>🔄 Scrape</>
                )}
              </button>
              </div>
              {scrapeError && <div className="scraper-error">{scrapeError}</div>}
              {scrapeResult && (
                <div className="scraper-result">
                  <div><strong>Scraped:</strong> {scrapeResult.scraped} / {scrapeResult.total} conversations</div>
                  <div><strong>Contacts:</strong> {scrapeResult.contacts?.length || 0}</div>
                  <div><strong>Last scrape:</strong> {formatTimestamp(scrapeResult.timestamp)}</div>
                </div>
              )}
            </div>
            {/* End Conversation Scraper Button & Feedback */}
          </div>

          <button 
            className="disconnect-button"
            onClick={handleDisconnect}
          >
            Disconnect LinkedIn
          </button>
        </div>
      )}

      {message && (
        <div className="connection-message success">
          {message}
        </div>
      )}

      {error && (
        <div className="connection-message error">
          {error}
        </div>
      )}
    </div>
  );
};

export default LinkedInConnection;
