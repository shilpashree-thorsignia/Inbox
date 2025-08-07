const UserManager = require('../userManager.js');

async function listUserSessions() {
  try {
    const userManager = new UserManager();
    
    // Wait a moment for the database to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== USER_SESSIONS TABLE ===\n');
    
    // Get all user sessions with user information
    const sessions = await new Promise((resolve, reject) => {
      userManager.db.all(
        `SELECT us.*, u.username, u.display_name 
         FROM user_sessions us 
         LEFT JOIN users u ON us.user_id = u.id 
         ORDER BY us.last_activity DESC`,
        [],
        (err, sessions) => {
          if (err) reject(err);
          else resolve(sessions);
        }
      );
    });
    
    if (sessions.length === 0) {
      console.log('No user sessions found in the database.');
    } else {
      console.log(`Found ${sessions.length} user session(s):\n`);
      
      sessions.forEach((session, index) => {
        console.log(`=== Session ${index + 1} ===`);
        console.log(`ID: ${session.id}`);
        console.log(`User ID: ${session.user_id}`);
        console.log(`Username: ${session.username || 'N/A'}`);
        console.log(`Display Name: ${session.display_name || 'N/A'}`);
        console.log(`LinkedIn Logged In: ${session.linkedin_logged_in ? 'Yes' : 'No'}`);
        console.log(`Last Activity: ${session.last_activity || 'N/A'}`);
        console.log(`Expires At: ${session.expires_at || 'N/A'}`);
        
        if (session.session_data) {
          try {
            const sessionData = JSON.parse(session.session_data);
            console.log(`Session Data Keys: ${Object.keys(sessionData).join(', ')}`);
          } catch (e) {
            console.log(`Session Data: ${session.session_data.substring(0, 100)}...`);
          }
        } else {
          console.log(`Session Data: N/A`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error fetching user sessions:', error);
  }
}

listUserSessions();
