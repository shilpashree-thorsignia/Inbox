import React, { useState } from 'react';
import './ConversationList.css';

const ConversationList = ({ conversations, onSelectConversation, selectedConversationId, onSync, isSyncing = false, onDeleteConversation }) => {
  const [syncLimit, setSyncLimit] = useState(5);
  const [deletingConversationId, setDeletingConversationId] = useState(null);

  const handleSync = () => {
    if (onSync) {
      // If "All chats" is selected, use the actual number of conversations
      const actualLimit = syncLimit >= 100 ? conversations.length : Math.min(syncLimit, conversations.length);
      onSync(actualLimit);
    }
  };

  const handleDeleteConversation = async (e, conversationId, conversationName) => {
    e.stopPropagation(); // Prevent conversation selection when clicking delete
    
    if (!onDeleteConversation) return;
    
    // Show confirmation dialog
    const isConfirmed = window.confirm(`Are you sure you want to delete the conversation with "${conversationName}"? This will remove all messages from the database and cannot be undone.`);
    
    if (isConfirmed) {
      try {
        setDeletingConversationId(conversationId);
        await onDeleteConversation(conversationId);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        alert(`Failed to delete conversation: ${error.message}`);
      } finally {
        setDeletingConversationId(null);
      }
    }
  };

  // Get the display text for the sync limit
  const getSyncLimitText = () => {
    if (syncLimit >= 100) {
      return `All chats (${conversations.length})`;
    }
    const actualLimit = Math.min(syncLimit, conversations.length);
    return `${actualLimit} chats`;
  };

  // Get available sync options based on conversation count
  const getSyncOptions = () => {
    if (conversations.length === 0) {
      return [{ value: 5, label: '5' }];
    }
    
    const options = [
      { value: 2, label: '2' },
      { value: 5, label: '5' },
      { value: 10, label: '10' },
      { value: 20, label: '20' },
      { value: 50, label: '50' },
      { value: 100, label: `All (${conversations.length})` }
    ];
    
    // Filter out options that exceed the conversation count
    return options.filter(option => option.value <= Math.max(conversations.length, 2));
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Conversations</h2>
        <div className="conversation-list-actions">
          {onSync && conversations.length > 0 && (
            <div className="sync-controls">
              <select 
                className="sync-limit-select"
                value={syncLimit}
                onChange={(e) => setSyncLimit(parseInt(e.target.value))}
                disabled={isSyncing}
              >
                {getSyncOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button 
                className={`sync-button ${isSyncing ? 'syncing' : ''}`}
                onClick={handleSync}
                disabled={isSyncing}
                title={`Sync ${getSyncLimitText()}`}
              >
                {isSyncing ? '⏳' : 'Sync 🔄'}
              </button>
            </div>
          )}
        </div>
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
              <div className="conversation-actions">
                <div className="conversation-time">
                  {conversation.lastMessage?.time || ''}
                </div>
                {onDeleteConversation && (
                  <button
                    className={`delete-button ${deletingConversationId === conversation.id ? 'deleting' : ''}`}
                    onClick={(e) => handleDeleteConversation(e, conversation.id, conversation.contactName)}
                    disabled={deletingConversationId === conversation.id}
                    title={`Delete conversation with ${conversation.contactName}`}
                  >
                    {deletingConversationId === conversation.id ? '⏳' : '🗑'}
                  </button>
                )}
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