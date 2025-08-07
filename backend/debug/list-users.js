const UserManager = require('../userManager.js');

async function listUsers() {
  try {
    const userManager = new UserManager();
    
    // Wait a moment for the database to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== USERS TABLE ===\n');
    
    // Get all users with all columns
    const users = await new Promise((resolve, reject) => {
      userManager.db.all(
        `SELECT * FROM users ORDER BY id`,
        [],
        (err, users) => {
          if (err) reject(err);
          else resolve(users);
        }
      );
    });
    
    if (users.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log(`Found ${users.length} user(s):\n`);
      
      users.forEach((user, index) => {
        console.log(`=== User ${index + 1} ===`);
        console.log(`ID: ${user.id}`);
        console.log(`Username: ${user.username}`);
        console.log(`Display Name: ${user.display_name || 'N/A'}`);
        console.log(`LinkedIn Email: ${user.linkedin_email || 'N/A'}`);
        console.log(`LinkedIn Profile URL: ${user.linkedin_profile_url || 'N/A'}`);
        console.log(`Session Token: ${user.session_token ? user.session_token.substring(0, 8) + '...' : 'N/A'}`);
        console.log(`Created At: ${user.created_at || 'N/A'}`);
        console.log(`Last Login: ${user.last_login || 'Never'}`);
        console.log(`Is Active: ${user.is_active ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

listUsers();
