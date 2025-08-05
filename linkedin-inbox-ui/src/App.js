import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import ConversationList from './components/ConversationList';
import Chat from './components/Chat';
import LinkedInConnection from './components/LinkedInConnection';
import ConversationScraper from './components/ConversationScraper';


import api from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [linkedInConnection, setLinkedInConnection] = useState({
    isConnected: false,
    profile: null
  });
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  // Handle conversation selection
  const handleSelectConversation = useCallback(async (conversationId) => {
    try {
      setIsLoadingMessages(true);
      
      // Find the conversation in the list
      const conversation = conversations.find(conv => conv.id === conversationId);
      if (!conversation) return;
      
      // Fetch the full conversation with messages
      const fullConversation = await api.fetchMessages(conversationId);
      
      // Update the selected conversation with the full data
      setSelectedConversation(fullConversation);
      
      // Update the last message in the conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, lastMessage: fullConversation.messages[fullConversation.messages.length - 1] } 
            : conv
        )
      );
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation. Please try again.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [conversations]);

  // Load all conversations function
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Authentication functions


  // Handle LinkedIn connection status change
  const handleLinkedInConnectionChange = useCallback((connectionStatus) => {
    setLinkedInConnection(connectionStatus);
    
    // If LinkedIn is connected, load conversations
    if (connectionStatus.isConnected && user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Set default user on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we already have a session token
        const existingToken = localStorage.getItem('sessionToken');
        if (existingToken) {
          // Try to get current user with existing token
          try {
            const currentUser = await api.getCurrentUser();
            setUser(currentUser);
            setIsAuthenticating(false);
            return;
          } catch (error) {
            // Token is invalid, remove it
            localStorage.removeItem('sessionToken');
          }
        }
        
        // Create a guest user session
        const loginData = await api.login('guest-user', 'guest@example.com');
        setUser(loginData.user);
        setIsAuthenticating(false);
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
        // Fallback to basic guest user
        setUser({ username: 'guest', displayName: 'Guest User' });
        setIsAuthenticating(false);
      }
    };
    
    initializeAuth();
  }, []);

  // Select first conversation when conversations are loaded
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      handleSelectConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation, handleSelectConversation]);

  // Handle when a message is sent
  const handleMessageSent = useCallback(async (conversationId) => {
    // Refresh the conversation to show the new message
    await handleSelectConversation(conversationId);
  }, [handleSelectConversation]);



  // Show loading while checking authentication
  if (isAuthenticating) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to LinkedIn...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <div className="error-message">{error}</div>
        <button onClick={() => window.location.reload()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>LinkedIn Inbox Dashboard</h1>
        </div>
      </header>
      
      <div className="app-content">
        <div className="conversation-sidebar">
          <LinkedInConnection 
            onConnectionChange={handleLinkedInConnectionChange}
          />
          {linkedInConnection.isConnected ? (
            <>
              <ConversationList 
                conversations={conversations}
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversation?.id}
              />
            </>
          ) : (
            <div className="connection-required">
              <div className="connection-message">
                <h3>🔗 Connect to LinkedIn First</h3>
                <p>Please connect your LinkedIn account above to view and manage your conversations.</p>
                <ul>
                  <li>Access your LinkedIn messages</li>
                  <li>Send messages through the dashboard</li>
                  <li>Scrape conversation history</li>
                  <li>Automate your LinkedIn workflow</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        
        <div className="chat-container">
          <Chat 
            conversation={selectedConversation} 
            currentUser={user.displayName || user.username}
            isLoading={isLoadingMessages}
            onMessageSent={handleMessageSent}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
