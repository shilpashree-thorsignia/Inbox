const API_BASE_URL = 'http://localhost:5000/api';

// Authentication helper
const getAuthHeaders = () => {
  const token = localStorage.getItem('sessionToken');
  return token ? { 'X-Session-Token': token } : {};
};

const fetchConversations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

const fetchMessages = async (conversationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error);
    throw error;
  }
};

const sendMessage = async ({ conversationId, contactName, message, sender }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        conversationId,
        contactName,
        message,
        sender
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Authentication functions
const login = async (username, linkedinEmail) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, linkedinEmail })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    const data = await response.json();
    
    // Store session token
    if (data.sessionToken) {
      localStorage.setItem('sessionToken', data.sessionToken);
    }
    
    return data;
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};

const getCurrentUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionToken');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

const updateProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(profileData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Profile update failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

const logout = async () => {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    localStorage.removeItem('sessionToken');
  }
};

// Scraping function
const scrapeConversations = async (limit = 5) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scrape-conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ limit })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scraping failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error scraping conversations:', error);
    throw error;
  }
};

// Sync conversations function - fetch latest messages from existing conversations
const syncConversations = async (limit = 5) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sync-conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ limit })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error syncing conversations:', error);
    throw error;
  }
};

// LinkedIn connection functions
const getLinkedInStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/linkedin-status`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting LinkedIn status:', error);
    throw error;
  }
};

const connectToLinkedIn = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/linkedin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'LinkedIn connection failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error connecting to LinkedIn:', error);
    throw error;
  }
};

const detectLinkedInProfile = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/linkedin-detect-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Profile detection failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error detecting LinkedIn profile:', error);
    throw error;
  }
};

const disconnectFromLinkedIn = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/linkedin-logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error disconnecting from LinkedIn:', error);
    throw error;
  }
};

export default {
  fetchConversations,
  fetchMessages,
  sendMessage,
  login,
  getCurrentUser,
  updateProfile,
  logout,
  scrapeConversations,
  syncConversations,
  getLinkedInStatus,
  connectToLinkedIn,
  detectLinkedInProfile,
  disconnectFromLinkedIn
};
