const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserManager = require('./userManager');
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize User Manager
const userManager = new UserManager();

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to extract user from session token
const authenticateUser = async (req, res, next) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-token'];
  
  if (sessionToken) {
    try {
      const user = await userManager.validateSession(sessionToken);
      req.user = user;
    } catch (error) {
      console.error('Error validating session:', error);
    }
  }
  
  next();
};

// Apply authentication middleware to all routes
app.use(authenticateUser);

// Database connection
const dbPath = path.resolve(__dirname, 'linkedin_messages_v3.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper function to wrap db operations in promises
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// ===== USER AUTHENTICATION ENDPOINTS =====

// User login/register endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, linkedinEmail } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const userResult = await userManager.createOrLoginUser(username, linkedinEmail);
    
    res.json({
      success: true,
      user: {
        id: userResult.userId,
        username: userResult.username,
        displayName: userResult.displayName,
        linkedinEmail: userResult.linkedinEmail,
        isNewUser: userResult.isNewUser
      },
      sessionToken: userResult.sessionToken
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    id: req.user.id,
    username: req.user.username,
    displayName: req.user.display_name || req.user.username,
    linkedinEmail: req.user.linkedin_email,
    linkedinProfileUrl: req.user.linkedin_profile_url,
    lastLogin: req.user.last_login
  });
});

// Update user profile
app.put('/api/auth/profile', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { linkedinEmail, profileUrl, displayName } = req.body;
    
    await userManager.updateLinkedInProfile(req.user.id, {
      linkedinEmail,
      profileUrl,
      displayName
    });
    
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-session-token'];
  
  if (sessionToken) {
    try {
      await userManager.logoutUser(sessionToken);
      // Also cleanup browser session
      if (req.user) {
        userManager.removeBrowserSession(req.user.id);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// ===== USER-SPECIFIC API ROUTES =====

// API Routes
app.get('/api/conversations', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const conversations = await dbAll(
      `SELECT c.id, c.contact_name as contactName, c.last_updated as lastUpdated,
              (SELECT message FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.time DESC, m.id DESC LIMIT 1) as lastMessage,
              (SELECT time FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.time DESC, m.id DESC LIMIT 1) as lastMessageTime,
              (SELECT sender FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.time DESC, m.id DESC LIMIT 1) as lastMessageSender,
              (SELECT COUNT(*) FROM messages m 
               WHERE m.conversation_id = c.id) as messageCount
       FROM conversations c 
       WHERE c.user_id = ? OR c.user_id IS NULL
       ORDER BY c.last_updated DESC`,
      [req.user.id]
    );

    // Format the response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      contactName: conv.contactName,
      lastMessage: {
        message: conv.lastMessage || 'No messages',
        time: conv.lastMessageTime || '',
        sender: conv.lastMessageSender || ''
      },
      messageCount: conv.messageCount
    }));

    res.json(formattedConversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { id } = req.params;
    
    // First get the conversation details (ensure it belongs to the user)
    const [conversation] = await dbAll(
      'SELECT id, contact_name as contactName FROM conversations WHERE id = ? AND (user_id = ? OR user_id IS NULL)', 
      [id, req.user.id]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all messages for this conversation
    const messages = await dbAll(
      `SELECT id, sender, message, time 
       FROM messages 
       WHERE conversation_id = ? 
       ORDER BY time, id`,
      [id]
    );

    // Format the response
    const response = {
      id: conversation.id,
      contactName: conversation.contactName,
      messages: messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        message: msg.message,
        time: msg.time || 'No time',
        receiver: msg.sender === 'You' ? conversation.contactName : 'You'
      }))
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Helper function to scrape LinkedIn messages
const scrapeLinkedInMessages = async (limit) => {
  let browser;
  try {
    // Launch browser with stealth settings
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--start-maximized'
      ],
      defaultViewport: null,
      ignoreHTTPSErrors: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set extra headers to make the browser appear more like a real user
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    });

    // Bypass bot detection
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `languages` property to use a valid value
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Overwrite the `plugins` property to use a fake plugin
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Overwrite the `webdriver` property to return false
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Navigate to LinkedIn login page first
    console.log('Navigating to LinkedIn login page with increased timeout');
    try {
      await page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      console.log('Direct navigation failed, trying alternative approach:', error.message);
      // Try navigating to homepage first
      await page.goto('https://www.linkedin.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await randomDelay(2000, 4000);
      await page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }

    // Wait for manual login
    console.log('Please log in to LinkedIn in the browser window...');
    
    // Wait for navigation to the messages page after login
    try {
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 300000, // 5 minutes timeout for login
      });
      
      // Additional check to ensure we're on the messages page
      await page.waitForSelector('.msg-conversations-container__conversations-list', { 
        timeout: 60000,
        visible: true,
      });
      
      console.log('Successfully logged in and navigated to messages.');
    } catch (error) {
      console.error('Error during login or navigation to messages:', error);
      throw new Error('Failed to navigate to messages after login. Please ensure you completed the login process.');
    }

    // Helper function to wait for a short random time to mimic human behavior
    const randomDelay = (min = 1000, max = 3000) => 
      new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
    
    // Wait for conversations to load
    console.log('Waiting for conversations to load...');
    await page.waitForSelector('.msg-conversations-container__conversations-list', { 
      timeout: 30000,
      visible: true,
    });
    
    // Get all conversation elements with retry logic
    const getConversations = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const conversations = await page.$$eval(
            '.msg-conversations-container__conversations-list li',
            (items) => {
              return items.map((item) => {
                const name = item.querySelector('.msg-conversation-listitem__participant-names')?.innerText.trim() || 'Unknown';
                const unread = !!item.querySelector('.msg-conversation-listitem--unread');
                const time = item.querySelector('.msg-conversation-listitem__time')?.getAttribute('title') || '';
                return { name, unread, time };
              });
            }
          );
          if (conversations.length > 0) return conversations;
        } catch (error) {
          console.warn(`Attempt ${attempt} failed to get conversations:`, error.message);
          if (attempt === maxRetries) throw error;
        }
        await randomDelay(1000, 2000);
      }
      return [];
    };

    // Get conversations with retry
    const conversations = await getConversations();
    if (conversations.length === 0) {
      throw new Error('No conversations found. Please ensure you have conversations in your inbox.');
    }

    // Apply limit if specified
    const conversationsToProcess = limit ? conversations.slice(0, parseInt(limit, 10)) : conversations;
    
    console.log(`Found ${conversations.length} conversations. Processing ${conversationsToProcess.length} (${limit ? 'limited' : 'unlimited'})`);
    
    // For each conversation, click and scrape messages
    for (const [index, conv] of conversationsToProcess.entries()) {
      try {
        console.log(`Processing conversation ${index + 1}/${conversationsToProcess.length}: ${conv.name}`);
        
        // Click on the conversation with retry
        let clicked = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const selector = `.msg-conversations-container__conversations-list li:nth-child(${index + 1})`;
            await page.waitForSelector(selector, { timeout: 10000 });
            await page.click(selector);
            await randomDelay(1000, 2000);
            clicked = true;
            break;
          } catch (error) {
            console.warn(`Attempt ${attempt} to click conversation failed:`, error.message);
            if (attempt === 3) throw error;
          }
        }
        
        if (!clicked) continue;
        
        // Wait for messages to load with retry
        let messagesLoaded = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await page.waitForSelector('.msg-s-message-list', { 
              timeout: 10000,
              visible: true,
            });
            messagesLoaded = true;
            break;
          } catch (error) {
            console.warn(`Attempt ${attempt} to load messages failed:`, error.message);
            if (attempt === 3) throw error;
            await randomDelay(1000, 2000);
          }
        }
        
        if (!messagesLoaded) continue;
        
        // Scroll to load more messages (if any)
        try {
          const messageList = await page.$('.msg-s-message-list');
          if (messageList) {
            await page.evaluate((el) => {
              el.scrollTop = 0;
            }, messageList);
            await randomDelay(1000, 2000); // Wait for any lazy loading
          }
        } catch (error) {
          console.warn('Error while scrolling message list:', error.message);
          // Continue even if scrolling fails
        }
        
        // Scrape messages with retry
        const getMessages = async (maxRetries = 3) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await page.$$eval(
                '.msg-s-message-list__event',
                (items, contactName) => {
                  return items.map((item) => {
                    const sender = item.querySelector('.msg-s-message-group__name')?.innerText.trim() || 'You';
                    const message = item.querySelector('.msg-s-event-listitem__body')?.innerText.trim() || '';
                    const time = item.querySelector('.msg-s-message-group__timestamp')?.getAttribute('title') || '';
                    
                    return {
                      sender: sender.includes('You') ? 'You' : sender,
                      receiver: sender.includes('You') ? contactName : 'You',
                      message,
                      time
                    };
                  });
                },
                conv.name
              );
            } catch (error) {
              console.warn(`Attempt ${attempt} to get messages failed:`, error.message);
              if (attempt === maxRetries) throw error;
              await randomDelay(1000, 2000);
            }
          }
          return [];
        };
        
        const messages = await getMessages();

        // Save messages to database if any found
        if (messages.length > 0) {
          await saveMessages(conv.name, messages);
          console.log(`✅ Saved ${messages.length} messages for ${conv.name}`);
        } else {
          console.warn(`⚠️ No messages found for ${conv.name}`);
        }
        
        // Add a small delay between conversations to avoid rate limiting
        await randomDelay(2000, 4000);
        
      } catch (error) {
        console.error(`Error processing conversation ${conv.name}:`, error);
        // Continue with next conversation even if one fails
      }
    }

    return { success: true, message: 'Successfully rescraped all conversations' };
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    
    // Take a screenshot if possible to help with debugging
    try {
      if (browser) {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const screenshotPath = `error-${Date.now()}.png`;
          await pages[0].screenshot({ path: screenshotPath });
          console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        }
      }
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError);
    }
    
    throw error;
  } finally {
    try {
      if (browser) {
        // Get all pages and close them
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.close().catch(e => console.warn('Error closing page:', e))));
        
        // Close the browser
        await browser.close();
        console.log('✅ Browser closed successfully');
      }
    } catch (browserCloseError) {
      console.error('Error while closing browser:', browserCloseError);
      
      // Force kill the browser process if it's still running
      try {
        if (browser && browser.process()) {
          browser.process().kill('SIGKILL');
        }
      } catch (killError) {
        console.error('Error force killing browser process:', killError);
      }
    }
  }
};

// Add the saveMessages function from scraper.js
const saveMessages = async (contactName, messages, userId = null) => {
  const dbPath = path.resolve(__dirname, 'linkedin_messages_v3.db');
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Begin transaction
      db.run('BEGIN TRANSACTION');
      
      // First, get or create conversation (user-specific)
      const query = userId 
        ? "SELECT id FROM conversations WHERE contact_name = ? AND (user_id = ? OR user_id IS NULL)"
        : "SELECT id FROM conversations WHERE contact_name = ?";
      const params = userId ? [contactName, userId] : [contactName];
      
      db.get(
        query,
        params,
        (err, row) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          
          const conversationId = row ? row.id : null;
          
          if (!conversationId) {
            // Create new conversation
            const insertQuery = userId 
              ? "INSERT INTO conversations (contact_name, last_updated, user_id) VALUES (?, datetime('now'), ?)"
              : "INSERT INTO conversations (contact_name, last_updated) VALUES (?, datetime('now'))";
            const insertParams = userId ? [contactName, userId] : [contactName];
            
            db.run(
              insertQuery,
              insertParams,
              function(err) {
                if (err) return db.run('ROLLBACK', () => reject(err));
                
                const newConversationId = this.lastID;
                insertMessages(newConversationId, messages, db, resolve, reject);
              }
            );
          } else {
            // Update existing conversation
            db.run(
              "UPDATE conversations SET last_updated = datetime('now') WHERE id = ?",
              [conversationId],
              (err) => {
                if (err) return db.run('ROLLBACK', () => reject(err));
                
                // Delete existing messages for this conversation
                db.run(
                  "DELETE FROM messages WHERE conversation_id = ?",
                  [conversationId],
                  (err) => {
                    if (err) return db.run('ROLLBACK', () => reject(err));
                    
                    insertMessages(conversationId, messages, db, resolve, reject);
                  }
                );
              }
            );
          }
        }
      );
    });
  });
};

// Helper function to insert messages
const insertMessages = (conversationId, messages, db, resolve, reject) => {
  if (messages.length === 0) {
    return db.run('COMMIT', (err) => {
      db.close();
      if (err) reject(err);
      else resolve();
    });
  }
  
  const stmt = db.prepare(
    "INSERT INTO messages (conversation_id, sender, receiver, message, time) VALUES (?, ?, ?, ?, ?)"
  );
  
  let error = null;
  messages.forEach(msg => {
    stmt.run(
      conversationId,
      msg.sender,
      msg.receiver,
      msg.message,
      msg.time,
      (err) => { if (err) error = err; }
    );
  });
  
  stmt.finalize(err => {
    if (err || error) {
      db.run('ROLLBACK', () => {
        db.close();
        reject(err || error);
      });
    } else {
      db.run('COMMIT', (err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    }
  });
};

// Helper function to add random delays to mimic human behavior
const humanDelay = (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// === ADVANCED HUMAN BEHAVIOR SIMULATION ===
// Enhanced human-like mouse movement with Bezier curves and micro-movements
const humanMouseMove = async (page, targetX, targetY) => {
  const currentPosition = await page.evaluate(() => {
    return { x: window.mouseX || 0, y: window.mouseY || 0 };
  });
  
  const startX = currentPosition.x;
  const startY = currentPosition.y;
  const steps = Math.floor(Math.random() * 15) + 10; // 10-25 steps for more realism
  
  // Create control points for Bezier curve (more human-like movement)
  const controlX1 = startX + (targetX - startX) * 0.25 + (Math.random() - 0.5) * 100;
  const controlY1 = startY + (targetY - startY) * 0.25 + (Math.random() - 0.5) * 100;
  const controlX2 = startX + (targetX - startX) * 0.75 + (Math.random() - 0.5) * 100;
  const controlY2 = startY + (targetY - startY) * 0.75 + (Math.random() - 0.5) * 100;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Bezier curve calculation for natural movement
    const currentX = Math.floor(
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * controlX1 +
      3 * (1 - t) * Math.pow(t, 2) * controlX2 +
      Math.pow(t, 3) * targetX
    );
    
    const currentY = Math.floor(
      Math.pow(1 - t, 3) * startY +
      3 * Math.pow(1 - t, 2) * t * controlY1 +
      3 * (1 - t) * Math.pow(t, 2) * controlY2 +
      Math.pow(t, 3) * targetY
    );
    
    // Add micro-movements and jitter
    const jitterX = (Math.random() - 0.5) * 2;
    const jitterY = (Math.random() - 0.5) * 2;
    
    await page.mouse.move(currentX + jitterX, currentY + jitterY);
    
    // Store current mouse position
    await page.evaluate((x, y) => {
      window.mouseX = x;
      window.mouseY = y;
    }, currentX, currentY);
    
    // Variable speed - slower at start/end, faster in middle
    const speed = Math.sin(t * Math.PI) * 30 + 20;
    await new Promise(resolve => setTimeout(resolve, speed + Math.random() * 20));
    
    // Occasional micro-pauses (human hesitation)
    if (Math.random() < 0.1) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
  }
  
  // Final micro-adjustment to exact target
  await page.mouse.move(targetX, targetY);
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
};

// Simulate realistic human scrolling
const humanScroll = async (page, direction = 'down', distance = 300) => {
  const scrollDistance = direction === 'down' ? distance : -distance;
  const steps = Math.floor(Math.random() * 5) + 3; // 3-8 scroll steps
  
  for (let i = 0; i < steps; i++) {
    await page.evaluate((scroll) => {
      window.scrollBy(0, scroll / steps + Math.random() * 20 - 10);
    }, scrollDistance);
    await humanDelay(100, 300);
  }
};

// Enhanced human typing with realistic patterns
const humanType = async (page, selector, text) => {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element ${selector} not found`);
  
  // Click with slight delay and mouse movement
  const box = await element.boundingBox();
  if (box) {
    await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await humanDelay(200, 500);
  }
  
  await element.click();
  await humanDelay(300, 800);
  
  // Clear existing text with realistic selection
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await humanDelay(100, 300);
  
  // Type with realistic human patterns
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Type word character by character
    for (const char of word) {
      await page.keyboard.type(char);
      
      // Realistic typing delays (faster for common letters)
      const commonChars = 'etaoinshrdlu';
      const baseDelay = commonChars.includes(char.toLowerCase()) ? 80 : 120;
      const variation = Math.random() * 60;
      await new Promise(resolve => setTimeout(resolve, baseDelay + variation));
      
      // Occasional typos and corrections (5% chance)
      if (Math.random() < 0.05 && char !== ' ') {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        await page.keyboard.type(wrongChar);
        await humanDelay(200, 500);
        await page.keyboard.press('Backspace');
        await humanDelay(100, 300);
        await page.keyboard.type(char);
      }
    }
    
    // Add space between words (except for last word)
    if (i < words.length - 1) {
      await page.keyboard.type(' ');
      await humanDelay(150, 400); // Longer pause between words
    }
  }
  
  // Random pause after typing (thinking time)
  await humanDelay(500, 1500);
};

// Advanced human reading behavior with realistic eye movement patterns
const humanRead = async (page, baseDuration = 2000) => {
  const pattern = getBehaviorPattern();
  const readingTime = Math.random() * (pattern.readingTime.max - pattern.readingTime.min) + pattern.readingTime.min;
  
  // Get page content dimensions for realistic eye movement
  const contentArea = await page.evaluate(() => {
    const content = document.querySelector('main, .feed-container, .messaging-conversation-content, body');
    if (content) {
      const rect = content.getBoundingClientRect();
      return {
        left: rect.left + 50,
        top: rect.top + 100,
        width: Math.min(rect.width - 100, 800),
        height: Math.min(rect.height - 200, 600)
      };
    }
    return { left: 100, top: 150, width: 600, height: 400 };
  });
  
  const startTime = Date.now();
  let currentLine = 0;
  const totalLines = Math.floor(contentArea.height / 25); // Approximate lines
  
  while (Date.now() - startTime < readingTime) {
    // Simulate reading line by line with saccadic eye movements
    const lineY = contentArea.top + (currentLine * 25) + Math.random() * 10;
    const startX = contentArea.left + Math.random() * 20;
    const endX = contentArea.left + contentArea.width * (0.7 + Math.random() * 0.2);
    
    // Reading across the line (left to right)
    for (let i = 0; i < 5; i++) {
      const progressX = startX + (endX - startX) * (i / 4);
      const microY = lineY + (Math.random() - 0.5) * 3; // Small vertical jitter
      
      await humanMouseMove(page, progressX, microY);
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
    }
    
    // Return sweep to next line (realistic eye movement)
    currentLine++;
    if (currentLine >= totalLines) {
      currentLine = 0;
      // Scroll down to continue reading
      await humanScroll(page, 'down', 100 + Math.random() * 100);
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    }
    
    // Pause between lines (natural reading rhythm)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
    
    // Occasional re-reading or backtracking
    if (Math.random() < 0.15) {
      currentLine = Math.max(0, currentLine - 1 - Math.floor(Math.random() * 2));
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
    }
    
    // Occasional longer pauses (thinking/processing)
    if (Math.random() < 0.1) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    }
  }
  
  // Final micro-movements to simulate finishing reading
  for (let i = 0; i < 3; i++) {
    const finalX = contentArea.left + Math.random() * contentArea.width;
    const finalY = contentArea.top + Math.random() * contentArea.height;
    await humanMouseMove(page, finalX, finalY);
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }
};

// Dynamic human delay based on behavior pattern
const smartHumanDelay = (multiplier = 1) => {
  const behaviorPattern = getBehaviorPattern();
  const min = behaviorPattern.pauseBetweenActions.min * multiplier;
  const max = behaviorPattern.pauseBetweenActions.max * multiplier;
  return humanDelay(min, max);
};

// Global browser instance for session persistence
let globalBrowser = null;
let globalPage = null;
let isLoggedIn = false;
let lastActivityTime = Date.now();

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// === ADVANCED ANTI-DETECTION: RATE LIMITING & BEHAVIOR TRACKING ===
const messageHistory = [];
const conversationHistory = [];
const sessionHistory = [];

// Conservative rate limits to avoid detection
const MAX_MESSAGES_PER_HOUR = 12; // Very conservative
const MAX_MESSAGES_PER_DAY = 40;
const MIN_MESSAGE_INTERVAL = 3 * 60 * 1000; // 3 minutes between messages

// Conversation scraping limits
const MAX_CONVERSATIONS_PER_HOUR = 20;
const MAX_CONVERSATIONS_PER_DAY = 100;
const MIN_CONVERSATION_SCRAPE_INTERVAL = 5 * 60 * 1000; // 5 minutes between scrapes

// Session activity limits
const MAX_ACTIONS_PER_HOUR = 50; // Total actions (messages + scrapes + logins)
const MAX_SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours max session
const MIN_SESSION_BREAK = 30 * 60 * 1000; // 30 minutes break between long sessions

// Behavioral randomization factors
const BEHAVIOR_RANDOMIZATION = {
  messageInterval: { min: 0.7, max: 1.5 }, // Multiply base interval by this range
  scrapeInterval: { min: 0.8, max: 1.3 },
  actionDelay: { min: 0.5, max: 2.0 },
  sessionBreak: { min: 0.6, max: 1.8 }
};

// Track different types of activities
const activityTracker = {
  messages: [],
  conversations: [],
  logins: [],
  totalActions: []
};

// Behavior patterns for different times of day
const getBehaviorPattern = () => {
  const hour = new Date().getHours();
  
  if (hour >= 9 && hour <= 17) {
    // Business hours - more active
    return {
      readingTime: { min: 3000, max: 8000 },
      typingSpeed: { min: 80, max: 150 },
      pauseBetweenActions: { min: 1500, max: 4000 }
    };
  } else if (hour >= 18 && hour <= 22) {
    // Evening - moderate activity
    return {
      readingTime: { min: 4000, max: 10000 },
      typingSpeed: { min: 100, max: 200 },
      pauseBetweenActions: { min: 2000, max: 5000 }
    };
  } else {
    // Night/early morning - slower, more deliberate
    return {
      readingTime: { min: 5000, max: 12000 },
      typingSpeed: { min: 120, max: 250 },
      pauseBetweenActions: { min: 3000, max: 8000 }
    };
  }
};

// === ADVANCED MULTI-ACTIVITY RATE LIMITING SYSTEM ===
// Clean old activity records
const cleanOldRecords = () => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Clean all activity trackers
  Object.keys(activityTracker).forEach(key => {
    activityTracker[key] = activityTracker[key].filter(time => time > oneDayAgo);
  });
  
  // Clean legacy arrays
  messageHistory.splice(0, messageHistory.length, ...messageHistory.filter(time => time > oneDayAgo));
  conversationHistory.splice(0, conversationHistory.length, ...conversationHistory.filter(time => time > oneDayAgo));
};

// Check if we can send a message (enhanced rate limiting)
const canSendMessage = () => {
  cleanOldRecords();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check message-specific limits
  const messagesLastHour = activityTracker.messages.filter(time => time > oneHourAgo).length;
  if (messagesLastHour >= MAX_MESSAGES_PER_HOUR) {
    return { allowed: false, reason: 'Message hourly limit exceeded', waitTime: getNextAllowedTime('message') };
  }
  
  if (activityTracker.messages.length >= MAX_MESSAGES_PER_DAY) {
    return { allowed: false, reason: 'Message daily limit exceeded', waitTime: getNextAllowedTime('message') };
  }
  
  // Check total activity limits
  const totalActionsLastHour = activityTracker.totalActions.filter(time => time > oneHourAgo).length;
  if (totalActionsLastHour >= MAX_ACTIONS_PER_HOUR) {
    return { allowed: false, reason: 'Total activity limit exceeded', waitTime: getNextAllowedTime('total') };
  }
  
  // Check minimum interval with behavioral randomization
  const lastMessage = activityTracker.messages[activityTracker.messages.length - 1];
  if (lastMessage) {
    const randomMultiplier = BEHAVIOR_RANDOMIZATION.messageInterval.min + 
      Math.random() * (BEHAVIOR_RANDOMIZATION.messageInterval.max - BEHAVIOR_RANDOMIZATION.messageInterval.min);
    const adjustedInterval = MIN_MESSAGE_INTERVAL * randomMultiplier;
    
    if ((now - lastMessage) < adjustedInterval) {
      return { 
        allowed: false, 
        reason: 'Too soon after last message', 
        waitTime: lastMessage + adjustedInterval - now 
      };
    }
  }
  
  // Check session duration limits
  const sessionStart = sessionHistory[0];
  if (sessionStart && (now - sessionStart) > MAX_SESSION_DURATION) {
    return { 
      allowed: false, 
      reason: 'Session duration limit exceeded - take a break', 
      waitTime: MIN_SESSION_BREAK 
    };
  }
  
  return { allowed: true, confidence: calculateConfidenceScore() };
};

// Check if we can scrape conversations
const canScrapeConversations = () => {
  cleanOldRecords();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check conversation scraping limits
  const conversationsLastHour = activityTracker.conversations.filter(time => time > oneHourAgo).length;
  if (conversationsLastHour >= MAX_CONVERSATIONS_PER_HOUR) {
    return { allowed: false, reason: 'Conversation scraping hourly limit exceeded', waitTime: getNextAllowedTime('conversation') };
  }
  
  if (activityTracker.conversations.length >= MAX_CONVERSATIONS_PER_DAY) {
    return { allowed: false, reason: 'Conversation scraping daily limit exceeded', waitTime: getNextAllowedTime('conversation') };
  }
  
  // Check minimum interval with randomization
  const lastScrape = activityTracker.conversations[activityTracker.conversations.length - 1];
  if (lastScrape) {
    const randomMultiplier = BEHAVIOR_RANDOMIZATION.scrapeInterval.min + 
      Math.random() * (BEHAVIOR_RANDOMIZATION.scrapeInterval.max - BEHAVIOR_RANDOMIZATION.scrapeInterval.min);
    const adjustedInterval = MIN_CONVERSATION_SCRAPE_INTERVAL * randomMultiplier;
    
    if ((now - lastScrape) < adjustedInterval) {
      return { 
        allowed: false, 
        reason: 'Too soon after last conversation scrape', 
        waitTime: lastScrape + adjustedInterval - now 
      };
    }
  }
  
  // Check total activity limits
  const totalActionsLastHour = activityTracker.totalActions.filter(time => time > oneHourAgo).length;
  if (totalActionsLastHour >= MAX_ACTIONS_PER_HOUR) {
    return { allowed: false, reason: 'Total activity limit exceeded', waitTime: getNextAllowedTime('total') };
  }
  
  return { allowed: true, confidence: calculateConfidenceScore() };
};

// Calculate confidence score based on current activity patterns
const calculateConfidenceScore = () => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  const recentMessages = activityTracker.messages.filter(time => time > oneHourAgo).length;
  const recentConversations = activityTracker.conversations.filter(time => time > oneHourAgo).length;
  const recentTotal = activityTracker.totalActions.filter(time => time > oneHourAgo).length;
  
  // Higher confidence when activity is well below limits
  const messageConfidence = 1 - (recentMessages / MAX_MESSAGES_PER_HOUR);
  const conversationConfidence = 1 - (recentConversations / MAX_CONVERSATIONS_PER_HOUR);
  const totalConfidence = 1 - (recentTotal / MAX_ACTIONS_PER_HOUR);
  
  return Math.min(messageConfidence, conversationConfidence, totalConfidence);
};

// Get next allowed time for specific activity type
const getNextAllowedTime = (activityType) => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  switch (activityType) {
    case 'message':
      const oldestMessage = activityTracker.messages.find(time => time > oneHourAgo);
      return oldestMessage ? (oldestMessage + (60 * 60 * 1000) - now) : 0;
    
    case 'conversation':
      const oldestConversation = activityTracker.conversations.find(time => time > oneHourAgo);
      return oldestConversation ? (oldestConversation + (60 * 60 * 1000) - now) : 0;
    
    case 'total':
      const oldestAction = activityTracker.totalActions.find(time => time > oneHourAgo);
      return oldestAction ? (oldestAction + (60 * 60 * 1000) - now) : 0;
    
    default:
      return 0;
  }
};

// Record different types of activities
const recordMessageSent = () => {
  const now = Date.now();
  activityTracker.messages.push(now);
  activityTracker.totalActions.push(now);
  messageHistory.push(now); // Keep for backward compatibility
};

const recordConversationScrape = () => {
  const now = Date.now();
  activityTracker.conversations.push(now);
  activityTracker.totalActions.push(now);
  conversationHistory.push(now);
};

const recordLogin = () => {
  const now = Date.now();
  activityTracker.logins.push(now);
  activityTracker.totalActions.push(now);
  
  // Reset session history on new login
  sessionHistory.splice(0, sessionHistory.length, now);
};

// Get comprehensive rate limit status
const getRateLimitStatus = () => {
  cleanOldRecords();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  return {
    messages: {
      hourly: {
        current: activityTracker.messages.filter(time => time > oneHourAgo).length,
        limit: MAX_MESSAGES_PER_HOUR,
        remaining: MAX_MESSAGES_PER_HOUR - activityTracker.messages.filter(time => time > oneHourAgo).length
      },
      daily: {
        current: activityTracker.messages.length,
        limit: MAX_MESSAGES_PER_DAY,
        remaining: MAX_MESSAGES_PER_DAY - activityTracker.messages.length
      },
      nextAllowed: getNextAllowedTime('message')
    },
    conversations: {
      hourly: {
        current: activityTracker.conversations.filter(time => time > oneHourAgo).length,
        limit: MAX_CONVERSATIONS_PER_HOUR,
        remaining: MAX_CONVERSATIONS_PER_HOUR - activityTracker.conversations.filter(time => time > oneHourAgo).length
      },
      daily: {
        current: activityTracker.conversations.length,
        limit: MAX_CONVERSATIONS_PER_DAY,
        remaining: MAX_CONVERSATIONS_PER_DAY - activityTracker.conversations.length
      },
      nextAllowed: getNextAllowedTime('conversation')
    },
    totalActivity: {
      hourly: {
        current: activityTracker.totalActions.filter(time => time > oneHourAgo).length,
        limit: MAX_ACTIONS_PER_HOUR,
        remaining: MAX_ACTIONS_PER_HOUR - activityTracker.totalActions.filter(time => time > oneHourAgo).length
      }
    },
    confidence: calculateConfidenceScore(),
    behaviorPattern: getBehaviorPattern(),
    sessionDuration: sessionHistory[0] ? (now - sessionHistory[0]) : 0,
    maxSessionDuration: MAX_SESSION_DURATION
  };
};

// Initialize persistent browser session
const initializeBrowserSession = async () => {
  if (globalBrowser && !globalBrowser.isConnected()) {
    globalBrowser = null;
    globalPage = null;
    isLoggedIn = false;
  }

  if (!globalBrowser) {
    console.log('Initializing new browser session...');
    
    // Create a persistent user data directory
    const userDataDir = path.resolve(__dirname, 'linkedin-session');
    
    globalBrowser = await puppeteer.launch({
      headless: false, // Keep false for better stealth and manual login
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1366,768',
        `--user-data-dir=${userDataDir}`, // Persistent session storage
        '--disable-blink-features=AutomationControlled',
        '--disable-plugins-discovery',
        '--disable-default-apps',
        // Additional anti-detection arguments
        '--disable-automation',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-default-browser-check',
        '--no-first-run',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps',
        '--mute-audio',
        '--no-report-upload',
        '--disable-logging',
        '--disable-permissions-api',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability'
      ],
      defaultViewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--enable-automation'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });

    globalPage = await globalBrowser.newPage();
    
    // Enhanced stealth measures - Military-grade browser fingerprint masking
    await globalPage.evaluateOnNewDocument(() => {
      // === CORE WEBDRIVER REMOVAL ===
      // Remove webdriver property completely
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      // Remove all automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Reflect;
      
      // Remove Puppeteer-specific properties
      delete window.__puppeteer_evaluation_script__;
      delete window.__webdriver_evaluate;
      delete window.__selenium_evaluate;
      delete window.__webdriver_script_function;
      delete window.__webdriver_script_func;
      delete window.__webdriver_script_fn;
      delete window.__fxdriver_evaluate;
      delete window.__driver_unwrapped;
      delete window.webdriver;
      delete window.__webdriver_unwrapped;
      delete window.__selenium_unwrapped;
      delete window.__fxdriver_unwrapped;
      
      // === ADVANCED NAVIGATOR SPOOFING ===
      
      // Mock realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => ({
          length: 5,
          0: { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          1: { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          2: { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' },
          3: { name: 'WebKit built-in PDF', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          4: { name: 'Microsoft Edge PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' }
        }),
        configurable: true
      });
      
      // Mock realistic languages with regional variations
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'hi-IN', 'hi'],
        configurable: true
      });
      
      // Mock realistic language preference
      Object.defineProperty(navigator, 'language', {
        get: () => 'en-US',
        configurable: true
      });
      
      // Mock realistic user agent data
      if (navigator.userAgentData) {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Google Chrome', version: '131' },
              { brand: 'Chromium', version: '131' },
              { brand: 'Not_A Brand', version: '24' }
            ],
            mobile: false,
            platform: 'Windows'
          }),
          configurable: true
        });
      }
      
      // Mock realistic vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true
      });
      
      // Mock realistic product
      Object.defineProperty(navigator, 'product', {
        get: () => 'Gecko',
        configurable: true
      });
      
      // Mock realistic app version
      Object.defineProperty(navigator, 'appVersion', {
        get: () => '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        configurable: true
      });
      
      // Mock realistic app name
      Object.defineProperty(navigator, 'appName', {
        get: () => 'Netscape',
        configurable: true
      });
      
      // Mock realistic cookie enabled
      Object.defineProperty(navigator, 'cookieEnabled', {
        get: () => true,
        configurable: true
      });
      
      // Mock realistic online status
      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true
      });
      
      // Mock realistic do not track
      Object.defineProperty(navigator, 'doNotTrack', {
        get: () => null,
        configurable: true
      });
      
      // Mock platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true
      });
      
      // Mock hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true
      });
      
      // Mock device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true
      });
      
      // Mock connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        }),
        configurable: true
      });
      
      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Remove automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      
      // Mock chrome runtime
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          onConnect: undefined,
          onMessage: undefined
        };
      }
      
      // === ADVANCED WEBGL & CANVAS FINGERPRINTING PROTECTION ===
      // Override WebGL getParameter to hide automation and provide realistic values
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // VENDOR
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        // RENDERER
        if (parameter === 37446) {
          return 'Intel(R) UHD Graphics 620';
        }
        // VERSION
        if (parameter === 37447) {
          return 'OpenGL ES 3.0 (OpenGL ES 3.0 Chromium)';
        }
        // SHADING_LANGUAGE_VERSION
        if (parameter === 35724) {
          return 'OpenGL ES GLSL ES 3.00 (OpenGL ES GLSL ES 3.00 Chromium)';
        }
        // MAX_TEXTURE_SIZE
        if (parameter === 3379) {
          return 16384;
        }
        // MAX_VIEWPORT_DIMS
        if (parameter === 3386) {
          return new Int32Array([16384, 16384]);
        }
        // Add noise to other parameters to avoid fingerprinting
        const result = originalGetParameter.call(this, parameter);
        if (typeof result === 'number' && Math.random() < 0.1) {
          return result + (Math.random() - 0.5) * 0.0001;
        }
        return result;
      };
      
      // Override WebGL2 getParameter as well
      if (window.WebGL2RenderingContext) {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel(R) UHD Graphics 620';
          if (parameter === 37447) return 'OpenGL ES 3.0 (OpenGL ES 3.0 Chromium)';
          if (parameter === 35724) return 'OpenGL ES GLSL ES 3.00 (OpenGL ES GLSL ES 3.00 Chromium)';
          const result = originalGetParameter2.call(this, parameter);
          if (typeof result === 'number' && Math.random() < 0.1) {
            return result + (Math.random() - 0.5) * 0.0001;
          }
          return result;
        };
      }
      
      // Canvas fingerprinting protection
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        // Add slight noise to canvas data to prevent fingerprinting
        const context = this.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            if (Math.random() < 0.001) {
              imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 3) - 1);
              imageData.data[i + 1] = Math.min(255, imageData.data[i + 1] + Math.floor(Math.random() * 3) - 1);
              imageData.data[i + 2] = Math.min(255, imageData.data[i + 2] + Math.floor(Math.random() * 3) - 1);
            }
          }
          context.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, arguments);
      };
      
      // Audio context fingerprinting protection
      if (window.AudioContext) {
        const OriginalAudioContext = window.AudioContext;
        window.AudioContext = function() {
          const context = new OriginalAudioContext();
          const originalCreateOscillator = context.createOscillator;
          context.createOscillator = function() {
            const oscillator = originalCreateOscillator.call(this);
            const originalFrequency = oscillator.frequency;
            Object.defineProperty(oscillator, 'frequency', {
              get: function() {
                return {
                  ...originalFrequency,
                  value: originalFrequency.value + (Math.random() - 0.5) * 0.001
                };
              }
            });
            return oscillator;
          };
          return context;
        };
      }
      
      // Mock screen properties
      Object.defineProperty(screen, 'availWidth', { get: () => 1366 });
      Object.defineProperty(screen, 'availHeight', { get: () => 728 });
      Object.defineProperty(screen, 'width', { get: () => 1366 });
      Object.defineProperty(screen, 'height', { get: () => 768 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      
      // Mock timezone
      Date.prototype.getTimezoneOffset = function() {
        return -330; // IST timezone offset
      };
      
      // === ADVANCED TIMING & BEHAVIORAL PROTECTION ===
      // Override performance.now() to add realistic timing variations
      const originalPerformanceNow = performance.now;
      performance.now = function() {
        return originalPerformanceNow.call(this) + (Math.random() - 0.5) * 0.1;
      };
      
      // Override Date.now() to add slight variations
      const originalDateNow = Date.now;
      Date.now = function() {
        return originalDateNow.call(this) + Math.floor((Math.random() - 0.5) * 2);
      };
      
      // Mock realistic battery API
      if (navigator.getBattery) {
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: Infinity,
            dischargingTime: Infinity,
            level: 0.85 + Math.random() * 0.1
          });
        };
      }
      
      // Mock realistic media devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = function() {
          return Promise.resolve([
            { deviceId: 'default', groupId: 'group1', kind: 'audioinput', label: 'Default - Microphone (Realtek Audio)' },
            { deviceId: 'communications', groupId: 'group1', kind: 'audioinput', label: 'Communications - Microphone (Realtek Audio)' },
            { deviceId: 'default', groupId: 'group2', kind: 'audiooutput', label: 'Default - Speakers (Realtek Audio)' },
            { deviceId: 'communications', groupId: 'group2', kind: 'audiooutput', label: 'Communications - Speakers (Realtek Audio)' }
          ]);
        };
      }
      
      // Mock realistic gamepad API
      Object.defineProperty(navigator, 'getGamepads', {
        value: function() {
          return [null, null, null, null];
        },
        configurable: true
      });
      
      // Override iframe contentWindow to prevent detection
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        if (tagName === 'iframe') {
          element.contentWindow = window;
        }
        return element;
      };
      
      // === MOUSE & KEYBOARD EVENT SPOOFING ===
      // Add realistic mouse movement noise
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'mousemove' && Math.random() < 0.1) {
          const wrappedListener = function(event) {
            // Add slight noise to mouse coordinates
            Object.defineProperty(event, 'clientX', {
              value: event.clientX + (Math.random() - 0.5) * 2,
              configurable: true
            });
            Object.defineProperty(event, 'clientY', {
              value: event.clientY + (Math.random() - 0.5) * 2,
              configurable: true
            });
            return listener.call(this, event);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // === ADVANCED DETECTION EVASION ===
      // Override toString methods to hide modifications
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === navigator.webdriver || 
            this === navigator.plugins || 
            this === navigator.languages ||
            this === WebGLRenderingContext.prototype.getParameter) {
          return 'function() { [native code] }';
        }
        return originalToString.call(this);
      };
      
      // Hide script modifications from detection
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        set: () => {},
        configurable: false,
        enumerable: false
      });
    });
    
    // Set realistic and current user agent
    await globalPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // Set comprehensive HTTP headers to mimic real browser
    await globalPage.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    
    // Additional stealth measures
    await globalPage.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    
    // Override permissions to prevent detection
    const context = globalBrowser.defaultBrowserContext();
    await context.overridePermissions('https://www.linkedin.com', ['geolocation', 'notifications']);
    
    // Set timezone to match IST
    await globalPage.emulateTimezone('Asia/Kolkata');
  }

  return { browser: globalBrowser, page: globalPage };
};

// Check if session is still valid
const isSessionValid = async () => {
  if (!globalPage || Date.now() - lastActivityTime > SESSION_TIMEOUT) {
    return false;
  }

  try {
    // Check if we're still logged in by looking for LinkedIn elements
    const currentUrl = globalPage.url();
    if (!currentUrl.includes('linkedin.com')) {
      return false;
    }

    // Try to find a LinkedIn-specific element that indicates we're logged in
    const loggedInElement = await globalPage.$('.global-nav__me');
    return loggedInElement !== null;
  } catch (error) {
    console.log('Session validation error:', error.message);
    return false;
  }
};

// Helper function to send message via LinkedIn
const sendLinkedInMessage = async (contactName, message) => {
  try {
    // Advanced anti-detection: Check rate limiting first
    const rateLimitCheck = canSendMessage();
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded: ${rateLimitCheck.reason}`);
      return { 
        success: false, 
        message: `Rate limit exceeded: ${rateLimitCheck.reason}. Please wait before sending more messages.`,
        rateLimited: true
      };
    }
    
    // Get current behavior pattern based on time of day
    const behaviorPattern = getBehaviorPattern();
    console.log(`Using behavior pattern for current time: ${JSON.stringify(behaviorPattern)}`);
    
    // Check if we need to refresh the session
    const sessionValid = await isSessionValid();
    
    if (!sessionValid) {
      console.log('Session invalid or expired, reinitializing...');
      if (globalBrowser) {
        try {
          await globalBrowser.close();
        } catch (e) {
          console.log('Error closing old browser:', e.message);
        }
        globalBrowser = null;
        globalPage = null;
        isLoggedIn = false;
      }
    }

    // Initialize or reuse browser session
    const { browser, page } = await initializeBrowserSession();
    lastActivityTime = Date.now();

    // Use the persistent page (stealth measures already applied during initialization)
    const activePage = page;
    
    // Simulate human behavior before starting
    console.log('Simulating human behavior before navigation...');
    await humanMouseMove(activePage, Math.random() * 1366, Math.random() * 768);
    await humanDelay(1000, 2000);
    
    // Navigate to LinkedIn messages with human-like behavior
    console.log('Navigating to LinkedIn...');
    
    // Check current URL to see if we're already on LinkedIn
    const currentUrl = activePage.url();
    
    if (!currentUrl.includes('linkedin.com')) {
      // First visit LinkedIn homepage to seem more natural
      console.log('Visiting LinkedIn homepage first...');
      await activePage.goto('https://www.linkedin.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await humanDelay(2000, 4000);
      
      // Simulate realistic homepage browsing behavior
      await humanRead(activePage, 3000); // Simulate reading the page
      await humanScroll(activePage, 'down', 200); // Light scrolling
      await humanDelay(1500, 3000);
      
      // Move mouse around naturally
      await humanMouseMove(activePage, Math.random() * 800 + 200, Math.random() * 400 + 200);
      await humanDelay(1000, 2000);
    }
    
    // Navigate to messages if not already there
    if (!currentUrl.includes('/messaging/')) {
      console.log('Navigating to LinkedIn messages...');
      
      // Try clicking the messaging icon first (more natural)
      try {
        const messagingIcon = await activePage.$('a[href*="messaging"]');
        if (messagingIcon) {
          console.log('Clicking messaging icon...');
          await humanMouseMove(activePage, 0, 0); // Move to icon position
          await messagingIcon.click();
          await humanDelay(2000, 4000);
        } else {
          throw new Error('Messaging icon not found');
        }
      } catch (error) {
        console.log('Direct navigation to messaging page...');
        await activePage.goto('https://www.linkedin.com/messaging/', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      }
      
      await humanDelay(3000, 5000);
      
      // Simulate reading the messages page
      await humanRead(activePage, 2000);
    } else {
      console.log('Already on LinkedIn messages page');
      await humanDelay(1000, 2000);
      
      // Still simulate some reading behavior
      await humanRead(activePage, 1500);
    }
    
    // Check if we need to login
    const loggedInCheck = await activePage.$('.msg-conversations-container__conversations-list') !== null;
    
    if (!loggedInCheck) {
      console.log('Not logged in to LinkedIn. Please login manually in the browser window...');
      console.log('Waiting for manual login (up to 3 minutes)...');
      
      // Wait for user to login manually with better error handling
      try {
        await activePage.waitForSelector('.msg-conversations-container__conversations-list', { timeout: 180000 });
        console.log('Login detected, continuing...');
        isLoggedIn = true;
        await humanDelay(2000, 4000);
      } catch (error) {
        throw new Error('Login timeout - please ensure you are logged into LinkedIn');
      }
    } else {
      console.log('Already logged in to LinkedIn');
      isLoggedIn = true;
    }
    
    console.log('Looking for conversation with:', contactName);
    
    // Add some random mouse movements to appear more human
    await activePage.mouse.move(Math.random() * 400 + 100, Math.random() * 300 + 100);
    await humanDelay(1000, 2000);
    
    // Search for the contact in conversations with human-like behavior
    console.log('Searching through conversations...');
    await humanDelay(1000, 2000);
    
    const conversations = await activePage.$$('.msg-conversation-listitem');
    let targetConversation = null;
    
    // Simulate human-like searching behavior
    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      
      // Add small delays and mouse movements to mimic human scanning
      await activePage.mouse.move(Math.random() * 100 + 300, Math.random() * 50 + 200 + (i * 60));
      await humanDelay(200, 500);
      
      const nameElement = await conversation.$('.msg-conversation-listitem__participant-names');
      if (nameElement) {
        const name = await activePage.evaluate(el => el.textContent.trim(), nameElement);
        console.log(`Checking conversation: ${name}`);
        
        if (name.includes(contactName) || contactName.includes(name)) {
          targetConversation = conversation;
          console.log(`Found target conversation: ${name}`);
          break;
        }
      }
    }
    
    if (!targetConversation) {
      // Try to search for the contact if not found in recent conversations
      console.log('Contact not found in recent conversations, trying search...');
      
      const searchBox = await activePage.$('.msg-conversations-container__search-input');
      if (searchBox) {
        await searchBox.click();
        await humanDelay(500, 1000);
        await humanType(activePage, '.msg-conversations-container__search-input', contactName);
        await humanDelay(2000, 3000);
        
        // Look for search results
        const searchResults = await activePage.$$('.msg-conversation-listitem');
        if (searchResults.length > 0) {
          targetConversation = searchResults[0];
        }
      }
      
      if (!targetConversation) {
        throw new Error(`Conversation with ${contactName} not found even after search`);
      }
    }
    
    // Click on the conversation with human-like behavior
    console.log('Opening conversation...');
    await activePage.mouse.move(Math.random() * 50 + 250, Math.random() * 20 + 200);
    await humanDelay(500, 1000);
    await targetConversation.click();
    await humanDelay(2000, 4000);
    
    // Wait for the conversation to load and find the message input
    console.log('Waiting for message input to load...');
    
    // Try multiple input selectors
    const inputSelectors = [
      '.msg-form__contenteditable',
      '.msg-form__textarea',
      '[data-testid="message-input"]',
      '.compose-form__contenteditable',
      'div[contenteditable="true"]',
      'textarea[placeholder*="message"]',
      '.artdeco-text-input--input'
    ];
    
    let messageInput = null;
    let inputSelector = null;
    
    for (const selector of inputSelectors) {
      try {
        console.log(`Trying input selector: ${selector}`);
        messageInput = await activePage.waitForSelector(selector, { timeout: 3000 });
        if (messageInput) {
          inputSelector = selector;
          console.log(`Found message input with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Input selector ${selector} failed: ${error.message}`);
        continue;
      }
    }
    
    if (!messageInput) {
      throw new Error('Could not find message input field');
    }
    
    // Simulate human-like typing behavior
    console.log('Typing message...');
    const inputBox = await messageInput.boundingBox();
    if (inputBox) {
      await activePage.mouse.move(
        inputBox.x + inputBox.width / 2 + Math.random() * 20 - 10,
        inputBox.y + inputBox.height / 2 + Math.random() * 10 - 5
      );
    }
    await humanDelay(500, 1000);
    
    // Use the human typing function with the found selector
    await humanType(activePage, inputSelector, message);
    await humanDelay(1000, 2000);
    
    // Send the message with human-like behavior
    console.log('Sending message...');
    
    // Try multiple send button selectors (LinkedIn UI changes frequently)
    const sendButtonSelectors = [
      '.msg-form__send-toggle', // Current LinkedIn selector
      'button[data-control-name="send_message"]', // Updated control name
      'button[aria-label="Send message"]', // Full aria label
      'button[aria-label="Send"]', // Short aria label
      '.msg-form__send-button:not([disabled])',
      'button[data-control-name="send"]',
      'button[aria-label*="Send"]',
      '.msg-form__send-btn:not([disabled])',
      'button.msg-form__send-button',
      'button[type="submit"]',
      '.artdeco-button--primary',
      '[data-testid="send-button"]',
      '.msg-form button[type="submit"]',
      '.msg-form .artdeco-button--primary'
    ];
    
    let sendButton = null;
    let usedSelector = null;
    
    // Try each selector until one works
    for (const selector of sendButtonSelectors) {
      try {
        console.log(`Trying send button selector: ${selector}`);
        sendButton = await activePage.waitForSelector(selector, { timeout: 2000 });
        if (sendButton) {
          usedSelector = selector;
          console.log(`Found send button with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`Selector ${selector} failed: ${err.message}`);
        continue;
      }
    }
    
    if (sendButton && usedSelector) {
      // Move mouse to send button with human-like behavior
      const buttonBox = await sendButton.boundingBox();
      if (buttonBox) {
        await humanMouseMove(activePage, 
          buttonBox.x + buttonBox.width / 2 + Math.random() * 10 - 5,
          buttonBox.y + buttonBox.height / 2 + Math.random() * 10 - 5
        );
      }
      await humanDelay(500, 1000);
      
      await sendButton.click();
      await humanDelay(2000, 4000);
    }
    
    // Verify message was sent by checking multiple indicators
    await humanDelay(1000, 2000); // Wait a bit more for UI to update
    
    let messageSent = false;
    
    try {
      // Method 1: Check if input is cleared
      const inputContent = await activePage.$eval(inputSelector, el => {
        return el.textContent?.trim() || el.value?.trim() || el.innerText?.trim() || '';
      });
      
      if (inputContent === '' || inputContent.length < message.length / 3) {
        messageSent = true;
        console.log('✅ Message verification: Input field cleared');
      }
    } catch (err) {
      console.log('Could not check input content:', err.message);
    }
    
    // Method 2: Check for send button state change (if we used a button)
    if (!messageSent && sendButton && usedSelector) {
      try {
        const buttonStillExists = await activePage.$(usedSelector);
        const buttonDisabled = buttonStillExists ? 
          await activePage.$eval(usedSelector, el => el.disabled || el.getAttribute('disabled') !== null) : false;
        
        if (!buttonStillExists || buttonDisabled) {
          messageSent = true;
          console.log('✅ Message verification: Send button state changed');
        }
      } catch (err) {
        console.log('Could not check button state:', err.message);
      }
    }
    
    // Method 3: Check for message in conversation (more reliable but slower)
    if (!messageSent) {
      try {
        await humanDelay(2000, 3000); // Wait for message to appear
        const messageElements = await activePage.$$('.msg-s-message-list__event');
        
        if (messageElements.length > 0) {
          // Check if our message appears in the last few messages
          const lastMessages = messageElements.slice(-3); // Check last 3 messages
          
          for (const msgEl of lastMessages) {
            try {
              const msgText = await msgEl.$eval('.msg-s-event-listitem__body', el => el.textContent?.trim() || '');
              if (msgText.includes(message.substring(0, Math.min(20, message.length)))) {
                messageSent = true;
                console.log('✅ Message verification: Found message in conversation');
                break;
              }
            } catch (err) {
              // Continue checking other messages
            }
          }
        }
      } catch (err) {
        console.log('Could not verify message in conversation:', err.message);
      }
    }
    
    if (messageSent) {
      console.log(`✅ Message sent successfully to ${contactName}: ${message}`);
      
      // Record message for rate limiting
      recordMessageSent();
      console.log(`Message recorded. Total messages in history: ${messageHistory.length}`);
      
      return { success: true, message: 'Message sent successfully' };
    } else {
      console.log('⚠️ Could not verify message was sent, but no critical errors occurred');
      
      // Still record the attempt to avoid rate limit bypass
      recordMessageSent();
      
      return { 
        success: true, 
        message: 'Message likely sent (verification inconclusive)', 
        warning: 'Could not definitively verify message delivery'
      };
    }
    
  } catch (error) {
    console.error('Error sending LinkedIn message:', error);
    
    // If there's a critical error, we might need to reset the session
    if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
      console.log('Session appears to be closed, will reinitialize on next request');
      globalBrowser = null;
      globalPage = null;
      isLoggedIn = false;
    }
    
    return { success: false, error: error.message };
  }
  // Note: We don't close the browser here as it's a persistent session
};

// Helper function to save message to database
const saveMessageToDatabase = async (conversationId, sender, message, time, receiver) => {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, 'linkedin_messages_v3.db');
    const writeDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Error opening database for writing:', err.message);
        reject(err);
        return;
      }
    });
    
    // Try to insert with receiver first, fallback to without receiver if column doesn't exist
    const tryInsertWithReceiver = () => {
      if (!receiver) {
        // If no receiver provided, use basic insert
        insertBasic();
        return;
      }
      
      writeDb.run(
        'INSERT INTO messages (conversation_id, sender, message, time, receiver) VALUES (?, ?, ?, ?, ?)',
        [conversationId, sender, message, time, receiver],
        function(err) {
          if (err && err.message.includes('no column named receiver')) {
            console.log('Receiver column not found, trying without receiver...');
            insertBasic();
          } else if (err) {
            console.error('Error saving message to database:', err);
            reject(err);
            writeDb.close();
          } else {
            console.log(`Message saved to database with ID: ${this.lastID}`);
            resolve({ id: this.lastID });
            writeDb.close();
          }
        }
      );
    };
    
    const insertBasic = () => {
      writeDb.run(
        'INSERT INTO messages (conversation_id, sender, message, time) VALUES (?, ?, ?, ?)',
        [conversationId, sender, message, time],
        function(err) {
          if (err) {
            console.error('Error saving message to database:', err);
            reject(err);
          } else {
            console.log(`Message saved to database with ID: ${this.lastID}`);
            resolve({ id: this.lastID });
          }
          writeDb.close();
        }
      );
    };
    
    tryInsertWithReceiver();
  });
};

// Send message endpoint
app.post('/api/send-message', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { conversationId, contactName, message, sender } = req.body;
    
    if (!contactName || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Contact name and message are required' 
      });
    }

    // Check rate limiting before proceeding
    const rateLimitCheck = canSendMessage();
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.reason,
        waitTime: rateLimitCheck.waitTime,
        rateLimitStatus: getRateLimitStatus()
      });
    }

    console.log(`Sending message to ${contactName}: ${message} (Confidence: ${rateLimitCheck.confidence?.toFixed(2) || 'N/A'})`);
    
    // Send the message via LinkedIn
    const result = await sendLinkedInMessage(contactName, message);
    
    if (result.success) {
      // Save the message to database
      await saveMessageToDatabase(conversationId, sender, message, new Date().toISOString(), contactName);
      
      res.json({ 
        success: true, 
        message: 'Message sent successfully',
        data: result 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send message via LinkedIn',
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message', 
      error: error.message 
    });
  }
});

// LinkedIn session management endpoints

// Rate limiting status endpoint
app.get('/api/rate-limit-status', (req, res) => {
  // Use the comprehensive new rate limiting system
  const status = getRateLimitStatus();
  
  // Add additional checks for immediate actions
  const messageCheck = canSendMessage();
  const conversationCheck = canScrapeConversations();
  
  res.json({
    ...status,
    currentChecks: {
      canSendMessage: messageCheck,
      canScrapeConversations: conversationCheck
    },
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata'
  });
});

app.get('/api/linkedin-status', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const userSession = userManager.getBrowserSession(req.user.id);
    const dbSession = await userManager.getUserSession(req.user.id);
    
    const isLoggedIn = userSession?.isLoggedIn || false;
    const hasActiveBrowser = userSession?.browser !== null;
    const linkedInProfile = userSession?.linkedInProfile || null;
    
    res.json({
      success: true,
      isLoggedIn,
      hasActiveBrowser,
      linkedInProfile,
      lastActivity: userSession?.lastActivity?.toISOString() || null,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.display_name,
        linkedinEmail: req.user.linkedin_email
      }
    });
  } catch (error) {
    res.json({
      success: true,
      isLoggedIn: false,
      hasActiveBrowser: false,
      linkedInProfile: null,
      error: error.message
    });
  }
});

app.post('/api/linkedin-login', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    console.log(`Initializing LinkedIn login session for user: ${req.user.username}`);
    
    // Initialize browser session for this specific user
    const { browser, page } = await initializeBrowserSession();
    
    // Store browser session for this user
    userManager.setBrowserSession(req.user.id, {
      browser,
      page,
      isLoggedIn: false,
      lastActivity: new Date()
    });
    
    // Navigate to LinkedIn login with better error handling
    try {
      await page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      console.log('Direct navigation failed, trying homepage first:', error.message);
      await page.goto('https://www.linkedin.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }
    
    // Record login activity
    recordLogin();
    
    res.json({
      success: true,
      message: 'LinkedIn login page opened. Please login manually in the browser window.',
      instructions: 'After logging in, the system will automatically detect your LinkedIn profile and associate it with your account.',
      rateLimitStatus: getRateLimitStatus()
    });
  } catch (error) {
    console.error('Error initializing LinkedIn login:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize LinkedIn login',
      error: error.message
    });
  }
});

// Detect LinkedIn profile after login
app.post('/api/linkedin-detect-profile', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const userSession = userManager.getBrowserSession(req.user.id);
    
    if (!userSession || !userSession.page) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active LinkedIn session found. Please login to LinkedIn first.' 
      });
    }
    
    const page = userSession.page;
    
    // Check if we're logged in to LinkedIn
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait a bit for the page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract profile information
      const profileInfo = await page.evaluate(() => {
        // Try to get profile name from various selectors
        const nameSelectors = [
          '.feed-identity-module__actor-meta h1',
          '.feed-identity-module__actor-meta .text-heading-xlarge',
          '.global-nav__me-photo',
          '[data-control-name="identity_profile_photo"]'
        ];
        
        let profileName = '';
        let profileUrl = '';
        
        // Try to get name
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            profileName = element.textContent?.trim() || element.alt?.trim() || '';
            if (profileName) break;
          }
        }
        
        // Try to get profile URL
        const profileLink = document.querySelector('a[href*="/in/"]');
        if (profileLink) {
          profileUrl = profileLink.href;
        }
        
        return {
          name: profileName,
          profileUrl: profileUrl,
          currentUrl: window.location.href
        };
      });
      
      // Update user profile with LinkedIn information
      if (profileInfo.name) {
        await userManager.updateLinkedInProfile(req.user.id, {
          displayName: profileInfo.name,
          profileUrl: profileInfo.profileUrl
        });
        
        // Update LinkedIn login status
        await userManager.updateLinkedInLoginStatus(req.user.id, true);
        
        // Update browser session
        userManager.setBrowserSession(req.user.id, {
          ...userSession,
          isLoggedIn: true,
          linkedInProfile: profileInfo,
          lastActivity: new Date()
        });
        
        res.json({
          success: true,
          message: 'LinkedIn profile detected and linked successfully!',
          profile: {
            name: profileInfo.name,
            profileUrl: profileInfo.profileUrl
          }
        });
      } else {
        res.json({
          success: false,
          message: 'Could not detect LinkedIn profile. Please make sure you are logged in to LinkedIn.',
          debug: profileInfo
        });
      }
      
    } catch (error) {
      console.error('Error detecting LinkedIn profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect LinkedIn profile',
        message: error.message
      });
    }
    
  } catch (error) {
    console.error('Error in profile detection:', error);
    res.status(500).json({
      success: false,
      error: 'Profile detection failed',
      message: error.message
    });
  }
});

app.post('/api/linkedin-logout', async (req, res) => {
  try {
    const token = req.headers['x-session-token'];
    console.log('LinkedIn logout request - token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.log('No session token provided');
      return res.status(401).json({ success: false, message: 'No session token provided' });
    }

    console.log('Looking up user by session token...');
    const user = await userManager.getUserBySessionToken(token);
    console.log('User lookup result:', user ? `User ID: ${user.id}` : 'No user found');
    
    if (!user) {
      console.log('Invalid session token');
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    // Remove user-specific browser session
    console.log(`Removing browser session for user ${user.id}`);
    userManager.removeBrowserSession(user.id);
    console.log(`LinkedIn session closed for user ${user.id}`);
    
    res.json({
      success: true,
      message: 'LinkedIn session closed successfully'
    });
  } catch (error) {
    console.error('Error closing LinkedIn session:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to close LinkedIn session',
      error: error.message
    });
  }
});

// Helper function to scrape conversations using existing browser session
const scrapeConversations = async (limit = 5, userId = null) => {
  try {
    // Check if we have an active session
    const sessionValid = await isSessionValid();
    
    if (!sessionValid) {
      throw new Error('No active LinkedIn session. Please login first.');
    }

    // Use the existing browser session
    const { browser, page } = await initializeBrowserSession();
    const activePage = page;
    
    console.log('Starting conversation scraping...');
    
    // Navigate to messaging page if not already there
    const currentUrl = activePage.url();
    if (!currentUrl.includes('/messaging/')) {
      console.log('Navigating to LinkedIn messages...');
      await activePage.goto('https://www.linkedin.com/messaging/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await smartHumanDelay(0.5);
    }
    
    // Wait for conversations list to load
    await activePage.waitForSelector('.msg-conversations-container__conversations-list', { timeout: 15000 });
    await smartHumanDelay(0.5);
    
    // Get all conversation elements
    const conversations = await activePage.$$('.msg-conversation-listitem');
    const actualLimit = Math.min(limit, conversations.length);
    
    console.log(`Found ${conversations.length} conversations, scraping ${actualLimit}...`);
    
    const scrapedData = {
      totalConversations: conversations.length,
      scrapedConversations: 0,
      conversations: [],
      errors: []
    };
    
    for (let i = 0; i < actualLimit; i++) {
      try {
        console.log(`Scraping conversation ${i + 1}/${actualLimit}...`);
        
        // Click on conversation with human-like behavior
        await humanMouseMove(activePage, 0, 0);
        await conversations[i].click();
        await smartHumanDelay(1);
        
        // Extract conversation data
        const conversationData = await activePage.evaluate(() => {
          const messages = [];
          const messageElements = document.querySelectorAll('.msg-s-message-list__event');
          
          // Set to collect unique sender names (excluding account owner)
          const senderNames = new Set();
          const accountOwnerNames = ['You', 'Shilpa Shree', 'Shilpa'];
          
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
            const time = timeElement?.getAttribute('datetime') || new Date().toISOString();
            
            if (message) {
              messages.push({
                sender,
                message,
                time
              });
            }
          });
          
          // Determine the contact name from collected sender names
          let contactName = 'Unknown';
          if (senderNames.size > 0) {
            contactName = senderNames.size === 1 ? 
              Array.from(senderNames)[0] : 
              Array.from(senderNames).join(' & ');
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
            messageCount: messages.length
          };
        });
        
        console.log(`  Contact: ${conversationData.contactName} (${conversationData.messageCount} messages)`);
        
        if (conversationData.contactName !== 'Unknown' && conversationData.messages.length > 0) {
          // Save to database using existing function
          const conversationId = await getOrCreateConversation(conversationData.contactName, userId);
          
          // Save messages to database
          for (const msg of conversationData.messages) {
            await saveMessageToDatabase(
              conversationId, 
              msg.sender, 
              msg.message, 
              msg.time, 
              msg.receiver
            );
          }
          
          scrapedData.conversations.push({
            contactName: conversationData.contactName,
            messageCount: conversationData.messages.length
          });
          
          scrapedData.scrapedConversations++;
          console.log(`✅ Saved ${conversationData.messages.length} messages for ${conversationData.contactName}`);
        } else {
          console.log(`⚠️ Skipping conversation - Contact: ${conversationData.contactName}`);
        }
        
        // Human-like delay between conversations
        await smartHumanDelay(0.5);
        
      } catch (err) {
        console.error(`⚠️ Failed to scrape conversation ${i + 1}:`, err.message);
        scrapedData.errors.push(`Conversation ${i + 1}: ${err.message}`);
      }
    }
    
    console.log(`✅ Scraping completed: ${scrapedData.scrapedConversations}/${actualLimit} conversations processed`);
    return scrapedData;
    
  } catch (error) {
    console.error('Error in scrapeConversations:', error);
    throw error;
  }
};

// Helper function to get or create conversation (from scraper.js logic)
const getOrCreateConversation = (contactName, userId = null) => {
  return new Promise((resolve, reject) => {
    if (!contactName) {
      return reject(new Error('Contact name is required'));
    }

    // First, try to find existing conversation (user-specific)
    const query = userId 
      ? "SELECT id FROM conversations WHERE contact_name = ? AND (user_id = ? OR user_id IS NULL)"
      : "SELECT id FROM conversations WHERE contact_name = ?";
    const params = userId ? [contactName, userId] : [contactName];
    
    db.get(
      query,
      params,
      (err, row) => {
        if (err) {
          console.error('Error finding conversation:', err);
          return reject(err);
        }
        
        if (row) {
          return resolve(row.id);
        }
        
        // If not found, create a new conversation
        const insertQuery = userId 
          ? "INSERT INTO conversations (contact_name, last_updated, user_id) VALUES (?, datetime('now'), ?)"
          : "INSERT INTO conversations (contact_name, last_updated) VALUES (?, datetime('now'))";
        const insertParams = userId ? [contactName, userId] : [contactName];
        
        db.run(
          insertQuery,
          insertParams,
          function(err) {
            if (err) {
              console.error('Error creating conversation:', err);
              return reject(err);
            }
            
            console.log(`Created new conversation for ${contactName} with ID ${this.lastID}`);
            resolve(this.lastID);
          }
        );
      }
    );
  });
};

// Scrape conversations endpoint
app.post('/api/scrape-conversations', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { limit = 5 } = req.body;
    
    // Check rate limiting before proceeding
    const rateLimitCheck = canScrapeConversations();
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.reason,
        waitTime: rateLimitCheck.waitTime,
        rateLimitStatus: getRateLimitStatus()
      });
    }
    
    console.log(`Starting conversation scraping with limit: ${limit} (Confidence: ${rateLimitCheck.confidence?.toFixed(2) || 'N/A'})`);
    
    const result = await scrapeConversations(limit, req.user.id);
    
    // Record the scraping activity
    recordConversationScrape();
    
    res.json({ 
      success: true, 
      message: `Successfully scraped ${result.scrapedConversations} conversations`, 
      data: result,
      rateLimitStatus: getRateLimitStatus()
    });
  } catch (error) {
    console.error('Error during conversation scraping:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to scrape conversations', 
      error: error.message 
    });
  }
});

// Legacy rescrape endpoint (keeping for compatibility)
app.post('/api/rescrape', async (req, res) => {
  try {
    const { limit = 5 } = req.body;
    
    // Check rate limiting before proceeding
    const rateLimitCheck = canScrapeConversations();
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.reason,
        waitTime: rateLimitCheck.waitTime,
        rateLimitStatus: getRateLimitStatus()
      });
    }
    
    console.log(`Starting message rescraping with limit: ${limit} (Confidence: ${rateLimitCheck.confidence?.toFixed(2) || 'N/A'})`);
    const result = await scrapeConversations(limit);
    
    // Record the scraping activity
    recordConversationScrape();
    
    res.json({ 
      success: true, 
      message: 'Messages rescraped successfully', 
      data: result,
      rateLimitStatus: getRateLimitStatus()
    });
  } catch (error) {
    console.error('Error during rescraping:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to rescrape messages', 
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
