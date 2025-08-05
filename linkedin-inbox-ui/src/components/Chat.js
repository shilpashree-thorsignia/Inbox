import React, { useRef, useEffect, useState } from 'react';
import Message from './Message';
import api from '../services/api';
import './Chat.css';

const Chat = ({ conversation, currentUser = 'Shilpa Shree', isLoading = false, onMessageSent }) => {
  const messagesEndRef = useRef(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
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
      // Send message via API
      await api.sendMessage({
        conversationId: conversation.id,
        contactName: conversation.contactName,
        message: newMessage.trim(),
        sender: currentUser
      });

      // Clear the input
      setNewMessage('');
      
      // Notify parent component that a message was sent
      if (onMessageSent) {
        onMessageSent(conversation.id);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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
          {conversation.messages.map((message, index) => {
            // Determine if this is the current user's message
            // You can adjust this logic based on your data structure
            const isCurrentUser = message.sender === currentUser || 
                                  message.sender === 'Shilpa Shree' ||
                                  message.sender?.includes('Shilpa');
            
            return (
              <Message
                key={index}
                message={message}
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
