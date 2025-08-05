import React from 'react';
import './Message.css';

const Message = ({ message, isCurrentUser }) => {
  return (
    <div className={`message ${isCurrentUser ? 'sent' : 'received'}`}>
      <div className="message-content">
        <div className="message-sender">
          <span className="sender-name">{message.sender}</span>
          <span className="message-time">{message.time || 'No time'}</span>
        </div>
        <div className="message-text">{message.message}</div>
      </div>
    </div>
  );
};

export default Message;
