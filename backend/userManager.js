const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class UserManager {
  constructor() {
    this.dbPath = path.resolve(__dirname, 'linkedin_messages_v3.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.initializeUserTables();
    
    // Store active user sessions and their browser instances
    this.userSessions = new Map(); // userId -> { browser, page, isLoggedIn, lastActivity }
  }

  // Initialize user-related database tables
  initializeUserTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            linkedin_email TEXT,
            linkedin_profile_url TEXT,
            display_name TEXT,
            session_token TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1
          )
        `, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            return reject(err);
          }
        });

        // Create user_sessions table for managing LinkedIn sessions
        this.db.run(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_data TEXT,
            linkedin_logged_in BOOLEAN DEFAULT 0,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating user_sessions table:', err);
            return reject(err);
          }
        });

        // Update conversations table to include user_id
        this.db.run(`
          ALTER TABLE conversations ADD COLUMN user_id INTEGER REFERENCES users(id)
        `, (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding user_id to conversations:', err);
          }
        });

        // Create index for user-specific queries
        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)
        `, (err) => {
          if (err) {
            console.error('Error creating user index:', err);
            return reject(err);
          }
          resolve();
        });
      });
    });
  }

  // Generate a secure session token
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create or login user
  async createOrLoginUser(username, linkedinEmail = null) {
    return new Promise((resolve, reject) => {
      const sessionToken = this.generateSessionToken();
      const now = new Date().toISOString();

      // First, try to find existing user
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, user) => {
          if (err) {
            return reject(err);
          }

          if (user) {
            // Update existing user's session token and last login
            this.db.run(
              'UPDATE users SET session_token = ?, last_login = ? WHERE id = ?',
              [sessionToken, now, user.id],
              (err) => {
                if (err) {
                  return reject(err);
                }
                resolve({
                  userId: user.id,
                  username: user.username,
                  sessionToken,
                  displayName: user.display_name || user.username,
                  linkedinEmail: user.linkedin_email,
                  isNewUser: false
                });
              }
            );
          } else {
            // Create new user
            this.db.run(
              `INSERT INTO users (username, linkedin_email, display_name, session_token, last_login) 
               VALUES (?, ?, ?, ?, ?)`,
              [username, linkedinEmail, username, sessionToken, now],
              function(err) {
                if (err) {
                  return reject(err);
                }
                resolve({
                  userId: this.lastID,
                  username,
                  sessionToken,
                  displayName: username,
                  linkedinEmail,
                  isNewUser: true
                });
              }
            );
          }
        }
      );
    });
  }

  // Validate session token and get user
  async validateSession(sessionToken) {
    return new Promise((resolve, reject) => {
      if (!sessionToken) {
        return resolve(null);
      }

      this.db.get(
        'SELECT * FROM users WHERE session_token = ? AND is_active = 1',
        [sessionToken],
        (err, user) => {
          if (err) {
            return reject(err);
          }
          resolve(user);
        }
      );
    });
  }

  // Get user by ID
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [userId],
        (err, user) => {
          if (err) {
            return reject(err);
          }
          resolve(user);
        }
      );
    });
  }

  // Get user by session token (alias for validateSession)
  async getUserBySessionToken(sessionToken) {
    return this.validateSession(sessionToken);
  }

  // Update user's LinkedIn profile information
  async updateLinkedInProfile(userId, profileData) {
    return new Promise((resolve, reject) => {
      const { linkedinEmail, profileUrl, displayName } = profileData;
      
      this.db.run(
        `UPDATE users SET 
         linkedin_email = COALESCE(?, linkedin_email),
         linkedin_profile_url = COALESCE(?, linkedin_profile_url),
         display_name = COALESCE(?, display_name)
         WHERE id = ?`,
        [linkedinEmail, profileUrl, displayName, userId],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  // Store user session data (browser session info)
  async storeUserSession(userId, sessionData) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      this.db.run(
        `INSERT OR REPLACE INTO user_sessions 
         (user_id, session_data, last_activity, expires_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [userId, JSON.stringify(sessionData), expiresAt],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  // Get user session data
  async getUserSession(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM user_sessions 
         WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP 
         ORDER BY last_activity DESC LIMIT 1`,
        [userId],
        (err, session) => {
          if (err) {
            return reject(err);
          }
          if (session && session.session_data) {
            try {
              session.session_data = JSON.parse(session.session_data);
            } catch (e) {
              console.error('Error parsing session data:', e);
            }
          }
          resolve(session);
        }
      );
    });
  }

  // Update LinkedIn login status for user
  async updateLinkedInLoginStatus(userId, isLoggedIn) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE user_sessions SET 
         linkedin_logged_in = ?, 
         last_activity = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
        [isLoggedIn ? 1 : 0, userId],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  // Get all active users (for admin purposes)
  async getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, display_name, linkedin_email, 
                linkedin_profile_url, created_at, last_login 
         FROM users WHERE is_active = 1 
         ORDER BY last_login DESC`,
        [],
        (err, users) => {
          if (err) {
            return reject(err);
          }
          resolve(users);
        }
      );
    });
  }

  // Clean up expired sessions
  async cleanupExpiredSessions() {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP',
        [],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  // Logout user (invalidate session)
  async logoutUser(sessionToken) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET session_token = NULL WHERE session_token = ?',
        [sessionToken],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  // Store browser session for user
  setBrowserSession(userId, browserData) {
    this.userSessions.set(userId, {
      ...browserData,
      lastActivity: new Date()
    });
  }

  // Get browser session for user
  getBrowserSession(userId) {
    return this.userSessions.get(userId);
  }

  // Remove browser session for user
  removeBrowserSession(userId) {
    const session = this.userSessions.get(userId);
    if (session && session.browser) {
      // Close browser if it exists
      session.browser.close().catch(console.error);
    }
    this.userSessions.delete(userId);
  }

  // Clean up inactive browser sessions
  cleanupInactiveBrowserSessions(maxInactiveMinutes = 30) {
    const now = new Date();
    for (const [userId, session] of this.userSessions.entries()) {
      const inactiveMinutes = (now - session.lastActivity) / (1000 * 60);
      if (inactiveMinutes > maxInactiveMinutes) {
        console.log(`Cleaning up inactive session for user ${userId}`);
        this.removeBrowserSession(userId);
      }
    }
  }
}

module.exports = UserManager;
