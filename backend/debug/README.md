# Database Debug Scripts

This folder contains scripts to inspect and debug the LinkedIn Inbox database.

## Available Scripts

### 1. `list-all.js` - Complete Database Overview
Shows a comprehensive overview of all tables with counts and summaries.
```bash
node debug/list-all.js
```

### 2. `list-users.js` - User Details
Shows detailed information about all users including session tokens, profile URLs, and login history.
```bash
node debug/list-users.js
```

### 3. `list-user-sessions.js` - User Sessions
Shows all user sessions with session data, login status, and expiration times.
```bash
node debug/list-user-sessions.js
```

### 4. `list-conversations.js` - Conversations
Shows all LinkedIn conversations with contact names, user associations, and last update times.
```bash
node debug/list-conversations.js
```

### 5. `list-messages.js` - Messages
Shows the latest 50 messages with conversation and user information.
```bash
node debug/list-messages.js
```

## Database Schema

### Tables

1. **users** - User accounts and authentication
   - `id` - Primary key
   - `username` - Unique username
   - `linkedin_email` - LinkedIn email address
   - `linkedin_profile_url` - LinkedIn profile URL
   - `display_name` - Display name
   - `session_token` - Authentication token
   - `created_at` - Account creation time
   - `last_login` - Last login time
   - `is_active` - Account status

2. **user_sessions** - User session data
   - `id` - Primary key
   - `user_id` - Foreign key to users
   - `session_data` - JSON session data
   - `linkedin_logged_in` - LinkedIn login status
   - `last_activity` - Last activity time
   - `expires_at` - Session expiration time

3. **conversations** - LinkedIn conversations
   - `id` - Primary key
   - `contact_name` - Contact name
   - `user_id` - Foreign key to users
   - `linkedin_account_id` - LinkedIn account ID
   - `last_updated` - Last update time

4. **messages** - Messages within conversations
   - `id` - Primary key
   - `conversation_id` - Foreign key to conversations
   - `sender` - Message sender
   - `receiver` - Message receiver
   - `message` - Message content
   - `time` - Message timestamp

## Usage Examples

### Quick Overview
```bash
# Get a complete overview of all data
node debug/list-all.js
```

### Check Specific Data
```bash
# Check users only
node debug/list-users.js

# Check conversations only
node debug/list-conversations.js

# Check messages only
node debug/list-messages.js
```

### Troubleshooting
If you encounter any errors, make sure:
1. You're running the scripts from the `backend` directory
2. The database file `linkedin_inbox.db` exists
3. You have the required Node.js dependencies installed

## Notes
- All scripts use the UserManager class for database access
- Scripts automatically handle database initialization and migrations
- Sensitive data like session tokens are truncated for security
- Large message content is truncated to 100 characters for readability
