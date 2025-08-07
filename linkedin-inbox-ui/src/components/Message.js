import React from 'react';
import './Message.css';

const Message = ({ message, isCurrentUser }) => {
  // Format timestamp - display time as stored in database
  const formatTime = (timeString) => {
    if (!timeString || timeString === 'No time' || timeString === '') return '';
    
    try {
      // If it's already a formatted time (like "11:09 AM"), return as is
      if (typeof timeString === 'string' && timeString.match(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)) {
        return timeString;
      }
      
      // If it's an ISO timestamp or other date format, parse and format it
      if (typeof timeString === 'string') {
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) {
          // Format as HH:MM AM/PM
          return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
        }
      } else if (timeString instanceof Date) {
        return timeString.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      }
      
      // If all else fails, return the original string
      return timeString.toString();
    } catch (error) {
      return timeString || '';
    }
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return '?';
    
    const parts = trimmedName.split(' ').filter(part => part.length > 0);
    if (parts.length === 0) return '?';
    
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className={`message ${isCurrentUser ? 'sent' : 'received'}`}>
      <div className="message-avatar">
        <div className="avatar-circle">
          {getInitials(message.sender)}
        </div>
      </div>
      <div className="message-content-wrapper">
        <div className="message-header">
          <span className="sender-name">{message.sender}</span>
          <span className="message-time">{formatTime(message.time)}</span>
        </div>
        <div className="message-content">
          <div className="message-text">{message.message}</div>
        </div>
      </div>
    </div>
  );
};

export default Message;