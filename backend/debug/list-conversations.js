const UserManager = require('../userManager.js');

async function listConversations() {
  try {
    const userManager = new UserManager();
    
    // Wait a moment for the database to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== CONVERSATIONS TABLE ===\n');
    
    // Get all conversations with user information
    const conversations = await new Promise((resolve, reject) => {
      userManager.db.all(
        `SELECT c.*, u.username, u.display_name 
         FROM conversations c 
         LEFT JOIN users u ON c.user_id = u.id 
         ORDER BY c.last_updated DESC`,
        [],
        (err, conversations) => {
          if (err) reject(err);
          else resolve(conversations);
        }
      );
    });
    
    if (conversations.length === 0) {
      console.log('No conversations found in the database.');
    } else {
      console.log(`Found ${conversations.length} conversation(s):\n`);
      
      conversations.forEach((conversation, index) => {
        console.log(`=== Conversation ${index + 1} ===`);
        console.log(`ID: ${conversation.id}`);
        console.log(`Contact Name: ${conversation.contact_name}`);
        console.log(`User ID: ${conversation.user_id || 'N/A'}`);
        console.log(`Username: ${conversation.username || 'N/A'}`);
        console.log(`Display Name: ${conversation.display_name || 'N/A'}`);
        console.log(`LinkedIn Account ID: ${conversation.linkedin_account_id || 'N/A'}`);
        console.log(`Last Updated: ${conversation.last_updated || 'N/A'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
  }
}

listConversations();
