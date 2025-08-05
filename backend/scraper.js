const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

puppeteer.use(StealthPlugin());

// SQLite DB setup with new schema
const db = new sqlite3.Database(path.resolve(__dirname, "linkedin_messages_v3.db"));

// Initialize database with new schema
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Use serialized mode to ensure sequential execution
    db.serialize(() => {
      // Enable foreign key constraints
      db.run('PRAGMA foreign_keys = ON');
      
      // Create conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_name TEXT NOT NULL,
          last_updated TEXT,
          UNIQUE(contact_name)
        )`,
        (err) => {
          if (err) return reject(err);
          
          // Create messages table with foreign key to conversations
          db.run(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              conversation_id INTEGER,
              sender TEXT NOT NULL,
              receiver TEXT NOT NULL,
              message TEXT NOT NULL,
              time TEXT,
              FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
            )`,
            (err) => {
              if (err) return reject(err);
              
              // Create index for faster lookups
              db.run(
                "CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id)",
                (err) => {
                  if (err) return reject(err);
                  
                  db.run(
                    "CREATE INDEX IF NOT EXISTS idx_contact_name ON conversations(contact_name)",
                    (err) => {
                      if (err) return reject(err);
                      resolve();
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
};

// Helper function to ensure a conversation exists and get its ID
const getOrCreateConversation = (contactName) => {
  return new Promise((resolve, reject) => {
    if (!contactName) {
      return reject(new Error('Contact name is required'));
    }

    // Use serialized mode to ensure sequential execution
    db.serialize(() => {
      // First, try to find existing conversation
      db.get(
        "SELECT id FROM conversations WHERE contact_name = ?",
        [contactName],
        (err, row) => {
          if (err) {
            console.error('Error finding conversation:', err);
            return reject(err);
          }
          
          if (row) {
            return resolve(row.id);
          }
          
          // If not found, create a new conversation
          db.run(
            "INSERT INTO conversations (contact_name, last_updated) VALUES (?, datetime('now'))",
            [contactName],
            function(err) {
              if (err) {
                console.error('Error creating conversation:', err);
                return reject(err);
              }
              
              if (!this.lastID) {
                return reject(new Error('Failed to get last insert ID'));
              }
              
              console.log(`Created new conversation for ${contactName} with ID ${this.lastID}`);
              resolve(this.lastID);
            }
          );
        }
      );
    });
  });
};

// Save messages to database
const saveMessages = async (contactName, messages) => {
  try {
    const conversationId = await getOrCreateConversation(contactName);
    
    if (!conversationId) {
      throw new Error(`Failed to get or create conversation for ${contactName}`);
    }
    
    return new Promise((resolve, reject) => {
      // Use serialized mode to ensure sequential execution
      db.serialize(() => {
        // Begin transaction
        db.run('BEGIN TRANSACTION');
        
        // Prepare the insert statement
        const stmt = db.prepare(
          "INSERT INTO messages (conversation_id, sender, receiver, message, time) VALUES (?, ?, ?, ?, ?)",
          (err) => {
            if (err) return reject(err);
          }
        );
        
        // Insert each message
        let error = null;
        for (const msg of messages) {
          stmt.run(
            conversationId, 
            msg.sender, 
            msg.receiver, 
            msg.message, 
            msg.time,
            function(err) {
              if (err) {
                error = err;
                console.error('Error inserting message:', err);
              }
            }
          );
        }
        
        // Finalize the statement
        stmt.finalize(err => {
          if (err) error = err;
          
          if (error) {
            return db.run('ROLLBACK', () => reject(error));
          }
          
          // Update the last_updated timestamp for the conversation
          db.run(
            "UPDATE conversations SET last_updated = datetime('now') WHERE id = ?",
            [conversationId],
            function(err) {
              if (err) {
                return db.run('ROLLBACK', () => reject(err));
              }
              
              // Commit the transaction
              db.run('COMMIT', (err) => {
                if (err) return reject(err);
                resolve(conversationId);
              });
            }
          );
        });
      });
    });
  } catch (error) {
    console.error('Error in saveMessages:', error);
    throw error;
  }
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    // Initialize database
    await initDatabase();
    console.log("✅ Database initialized with new schema");
    
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36");

    await page.goto("https://www.linkedin.com/login");
    console.log("👉 Please log in manually and then press Enter here.");
    await new Promise(resolve => process.stdin.once("data", resolve));

    await page.goto("https://www.linkedin.com/messaging/");
    await page.waitForSelector(".msg-conversations-container__conversations-list");
    await delay(3000);

    const conversations = await page.$$(".msg-conversation-listitem");
    const limit = 2; // Adjust as needed

    for (let i = 0; i < Math.min(limit, conversations.length); i++) {
      try {
        console.log(`🕵️ Scraping conversation ${i + 1}...`);
        await conversations[i].click();
        await delay(5000);

        // Get messages first and extract contact name from them
        const conversationData = await page.evaluate(() => {
          const messages = [];
          const messageElements = document.querySelectorAll('.msg-s-message-list__event');
          
          // Set to collect unique sender names (excluding account owner)
          const senderNames = new Set();
          const accountOwnerNames = ['You', 'Shilpa Shree', 'Shilpa']; // Add variations of account owner name
          
          messageElements.forEach(msg => {
            // Try to get the sender's name
            let sender = msg.querySelector('.msg-s-message-group__name')?.innerText?.trim();
            if (!sender) {
              const avatar = msg.querySelector('[aria-label]');
              sender = avatar?.getAttribute('aria-label') || 'You';
            }
            
            // Clean up the sender name
            sender = sender.replace(/^You\s*/, '').trim() || 'You';
            
            // Add to sender names if it's not the account owner
            if (!accountOwnerNames.some(name => 
              sender.toLowerCase().includes(name.toLowerCase()) || 
              name.toLowerCase().includes(sender.toLowerCase())
            ) && sender !== 'You' && sender.length > 1) {
              senderNames.add(sender);
            }
            
            // Get message content
            const messageElement = msg.querySelector('.msg-s-event-listitem__body');
            let message = messageElement?.innerText?.trim() || '';
            
            // Get message time
            const timeElement = msg.querySelector('time');
            const time = timeElement?.getAttribute('datetime') || '';
            
            // Get reactions if any
            const reactions = Array.from(msg.querySelectorAll('.msg-reactions__reaction-item span'))
              .map(span => span.textContent.trim())
              .filter(Boolean);
              
            if (reactions.length > 0) {
              message += ` (Reactions: ${reactions.join(' ')})`;
            }
            
            messages.push({
              sender,
              receiver: sender === 'You' ? 'Contact' : 'You', // Will be updated below
              message,
              time
            });
          });
          
          // Determine the contact name from collected sender names
          let contactName = 'Unknown';
          if (senderNames.size > 0) {
            // If there's only one other sender, use that
            if (senderNames.size === 1) {
              contactName = Array.from(senderNames)[0];
            } else {
              // If multiple senders, join them or pick the most frequent one
              contactName = Array.from(senderNames).join(' & ');
            }
          }
          
          // Update receiver field in messages
          messages.forEach(msg => {
            if (msg.sender === 'You') {
              msg.receiver = contactName;
            } else {
              msg.receiver = 'You';
            }
          });
          
          return {
            contactName,
            messages,
            senderNames: Array.from(senderNames)
          };
        });
        
        console.log(`  Contact: ${conversationData.contactName}`);
        console.log(`  Detected senders: ${conversationData.senderNames.join(', ')}`);

        if (conversationData.contactName !== 'Unknown' && conversationData.messages.length > 0) {
          await saveMessages(conversationData.contactName, conversationData.messages);
          console.log(`✅ Saved ${conversationData.messages.length} messages for ${conversationData.contactName}`);
        } else {
          console.log(`⚠️ Skipping conversation - Contact: ${conversationData.contactName}, Messages: ${conversationData.messages.length}`);
        }

        await delay(2000 + Math.random() * 2000);
      } catch (err) {
        console.error(`⚠️ Failed to scrape conversation ${i + 1}:`, err.message);
      }
    }

    console.log("✅ All conversations processed");
    await browser.close();
    db.close();
  } catch (error) {
    console.error("❌ Error:", error);
    db.close();
    process.exit(1);
  }
})();