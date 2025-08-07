import React from 'react';
import './ConversationList.css';

const ConversationList = ({ conversations, onSelectConversation, selectedConversationId, onRefresh }) => {
  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Conversations</h2>
        {onRefresh && (
          <button 
            className="refresh-button" 
            onClick={onRefresh}
            title="Refresh conversations"
          >
            🔄
          </button>
        )}
      </div>
      <div className="conversation-items">
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedConversationId === conversation.id ? 'active' : ''}`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="conversation-avatar">
                {conversation.contactName.charAt(0).toUpperCase()}
              </div>
              <div className="conversation-details">
                <div className="conversation-name">{conversation.contactName}</div>
                <div className="conversation-preview">
                  {conversation.lastMessage?.message || 'No messages'}
                </div>
              </div>
              <div className="conversation-time">
                {conversation.lastMessage?.time || ''}
              </div>
            </div>
          ))
        ) : (
          <div className="no-conversations">No conversations found</div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
