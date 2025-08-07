const UserManager = require('../userManager.js');

async function listMessages() {
  try {
    const userManager = new UserManager();
    
    // Wait a moment for the database to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== MESSAGES TABLE ===\n');
    
    // Get all messages with conversation and user information
    const messages = await new Promise((resolve, reject) => {
      userManager.db.all(
        `SELECT m.*, c.contact_name, u.username, u.display_name 
         FROM messages m 
         LEFT JOIN conversations c ON m.conversation_id = c.id 
         LEFT JOIN users u ON c.user_id = u.id 
         ORDER BY m.time DESC 
         LIMIT 50`,
        [],
        (err, messages) => {
          if (err) reject(err);
          else resolve(messages);
        }
      );
    });
    
    if (messages.length === 0) {
      console.log('No messages found in the database.');
    } else {
      console.log(`Found ${messages.length} message(s) (showing latest 50):\n`);
      
      messages.forEach((message, index) => {
        console.log(`=== Message ${index + 1} ===`);
        console.log(`ID: ${message.id}`);
        console.log(`Conversation ID: ${message.conversation_id}`);
        console.log(`Contact Name: ${message.contact_name || 'N/A'}`);
        console.log(`User: ${message.username || 'N/A'} (${message.display_name || 'N/A'})`);
        console.log(`Sender: ${message.sender}`);
        console.log(`Receiver: ${message.receiver || 'N/A'}`);
        console.log(`Time: ${message.time || 'N/A'}`);
        console.log(`Message: ${message.message ? (message.message.length > 100 ? message.message.substring(0, 100) + '...' : message.message) : 'N/A'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

listMessages();
