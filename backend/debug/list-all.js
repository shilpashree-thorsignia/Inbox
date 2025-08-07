const UserManager = require('../userManager.js');

async function listAllTables() {
  try {
    const userManager = new UserManager();
    
    // Wait a moment for the database to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== DATABASE OVERVIEW ===\n');
    
    // Get table counts
    const counts = await Promise.all([
      new Promise((resolve) => {
        userManager.db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
          resolve({ table: 'users', count: err ? 0 : result.count });
        });
      }),
      new Promise((resolve) => {
        userManager.db.get('SELECT COUNT(*) as count FROM user_sessions', (err, result) => {
          resolve({ table: 'user_sessions', count: err ? 0 : result.count });
        });
      }),
      new Promise((resolve) => {
        userManager.db.get('SELECT COUNT(*) as count FROM conversations', (err, result) => {
          resolve({ table: 'conversations', count: err ? 0 : result.count });
        });
      }),
      new Promise((resolve) => {
        userManager.db.get('SELECT COUNT(*) as count FROM messages', (err, result) => {
          resolve({ table: 'messages', count: err ? 0 : result.count });
        });
      })
    ]);
    
    console.log('Table Summary:');
    counts.forEach(({ table, count }) => {
      console.log(`  ${table}: ${count} records`);
    });
    console.log('');
    
    // List users
    console.log('=== USERS ===');
    const users = await new Promise((resolve, reject) => {
      userManager.db.all('SELECT id, username, display_name, linkedin_email, created_at, last_login FROM users ORDER BY id', (err, users) => {
        if (err) reject(err);
        else resolve(users);
      });
    });
    
    if (users.length > 0) {
      console.log(`Found ${users.length} user(s):`);
      users.forEach(user => {
        console.log(`  ${user.id}. ${user.username} (${user.display_name || user.username}) - ${user.linkedin_email || 'N/A'}`);
      });
    } else {
      console.log('No users found.');
    }
    console.log('');
    
    // List conversations
    console.log('=== CONVERSATIONS ===');
    const conversations = await new Promise((resolve, reject) => {
      userManager.db.all('SELECT id, contact_name, user_id, linkedin_account_id, last_updated FROM conversations ORDER BY last_updated DESC LIMIT 10', (err, conversations) => {
        if (err) reject(err);
        else resolve(conversations);
      });
    });
    
    if (conversations.length > 0) {
      console.log(`Found ${conversations.length} conversation(s) (showing latest 10):`);
      conversations.forEach(conv => {
        console.log(`  ${conv.id}. ${conv.contact_name} (User: ${conv.user_id || 'N/A'}, Account: ${conv.linkedin_account_id || 'N/A'}) - ${conv.last_updated || 'N/A'}`);
      });
    } else {
      console.log('No conversations found.');
    }
    console.log('');
    
    // List messages summary
    console.log('=== MESSAGES SUMMARY ===');
    const messageStats = await new Promise((resolve, reject) => {
      userManager.db.all(`
        SELECT 
          c.contact_name,
          COUNT(m.id) as message_count,
          MAX(m.time) as last_message_time
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id, c.contact_name
        ORDER BY last_message_time DESC
        LIMIT 10
      `, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });
    
    if (messageStats.length > 0) {
      console.log('Conversations with message counts (showing top 10):');
      messageStats.forEach(stat => {
        console.log(`  ${stat.contact_name}: ${stat.message_count} messages (last: ${stat.last_message_time || 'N/A'})`);
      });
    } else {
      console.log('No messages found.');
    }
    console.log('');
    
    // List user sessions
    console.log('=== USER SESSIONS ===');
    const sessions = await new Promise((resolve, reject) => {
      userManager.db.all('SELECT id, user_id, linkedin_logged_in, last_activity, expires_at FROM user_sessions ORDER BY last_activity DESC LIMIT 5', (err, sessions) => {
        if (err) reject(err);
        else resolve(sessions);
      });
    });
    
    if (sessions.length > 0) {
      console.log(`Found ${sessions.length} session(s) (showing latest 5):`);
      sessions.forEach(session => {
        console.log(`  ${session.id}. User: ${session.user_id}, LinkedIn: ${session.linkedin_logged_in ? 'Yes' : 'No'}, Last: ${session.last_activity || 'N/A'}`);
      });
    } else {
      console.log('No user sessions found.');
    }
    
  } catch (error) {
    console.error('Error fetching database overview:', error);
  }
}

listAllTables();
