import React, { useRef, useEffect, useState } from 'react';
import Message from './Message';
import api from '../services/api';
import './Chat.css';

const Chat = ({ conversation, currentUser = 'Shilpa Shree', isLoading = false, onMessageSent }) => {
  const messagesEndRef = useRef(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, localMessages]);

  // Update local messages when conversation changes
  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages);
    } else {
      setLocalMessages([]);
    }
  }, [conversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle sending a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending || !conversation) {
      return;
    }

    setIsSending(true);
    
    try {
      // Create a temporary message object for immediate display
      const tempMessage = {
        id: `temp-${Date.now()}`,
        sender: currentUser,
        message: newMessage.trim(),
        time: new Date().toISOString(),
        receiver: conversation.contactName
      };

      // Add the temporary message to local state immediately
      const updatedMessages = [...localMessages, tempMessage];
      setLocalMessages(updatedMessages);

      // Clear the input immediately
      const messageToSend = newMessage.trim();
      setNewMessage('');
      
      // Send message via API
      const result = await api.sendMessage({
        conversationId: conversation.id,
        contactName: conversation.contactName,
        message: messageToSend,
        sender: currentUser
      });

      // If the message was sent successfully, remove the temporary message and refresh
      if (result.success) {
        // Remove the temporary message
        setLocalMessages(prev => prev.filter(msg => !msg.id.toString().startsWith('temp-')));
        
        // Refresh the conversation to get the actual saved message
        setTimeout(() => {
          if (onMessageSent) {
            onMessageSent(conversation.id);
          }
        }, 500);
      } else {
        // If sending failed, remove the temporary message
        setLocalMessages(prev => prev.filter(msg => !msg.id.toString().startsWith('temp-')));
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the temporary message on error
      setLocalMessages(prev => prev.filter(msg => !msg.id.toString().startsWith('temp-')));
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (isLoading) {
    return (
      <div className="chat-container">
        <div className="loading-messages">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="chat-container">
        <div className="no-conversation-selected">
          <div className="welcome-message">
            <h2>Welcome to LinkedIn Inbox</h2>
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  // Use localMessages if available, otherwise use conversation.messages
  const messagesToDisplay = localMessages.length > 0 ? localMessages : conversation.messages;

  // Display messages in the order they come from the backend (already sorted)
  const displayMessages = messagesToDisplay || [];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-contact">
          <div className="contact-avatar">
            {conversation.contactName.charAt(0).toUpperCase()}
          </div>
          <div className="contact-info">
            <h3>{conversation.contactName}</h3>
            <span className="online-status">Active now</span>
          </div>
        </div>
      </div>
      
      <div className="messages-container">
        <div className="messages">
          {displayMessages.map((item, index) => {
            // Determine if this is the current user's message
            const isCurrentUser = 
              item.sender === currentUser || 
              item.sender === 'Shilpa Shree' ||
              item.sender === 'You' ||
              item.sender === 'you' ||
              (item.sender && currentUser && item.sender.toLowerCase() === currentUser.toLowerCase()) ||
              (item.sender && currentUser && item.sender.toLowerCase().includes(currentUser.toLowerCase())) ||
              // Check if the message has a temporary ID (indicating it's a sent message)
              (item.id && item.id.toString().startsWith('temp-')) ||
              // Check if the message sender matches common variations
              (item.sender && (
                item.sender.toLowerCase().includes('shilpa') ||
                item.sender.toLowerCase().includes('shree') ||
                item.sender.toLowerCase() === 'you' ||
                item.sender.toLowerCase() === currentUser?.toLowerCase()
              ));
            
            return (
              <Message
                key={`${item.id || index}-${item.time || Date.now()}`}
                message={item}
                isCurrentUser={isCurrentUser}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="message-input-container">
        <form onSubmit={handleSendMessage} className="message-input-wrapper">
          <input
            type="text"
            placeholder="Type a message..."
            className="message-input"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isSending}
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <div className="sending-spinner">⏳</div>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" fill={!newMessage.trim() ? "#ccc" : "#0073b1"}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
