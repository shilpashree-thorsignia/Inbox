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

// === ENHANCED RANDOMIZED MOUSE/SCROLL EVENTS AND ADAPTIVE DELAY LOGIC ===

// Adaptive delay based on page load and content complexity
const adaptiveDelay = async (page, baseDelay = 1000, complexityMultiplier = 1) => {
  try {
    // Check page load status and content complexity
    const pageMetrics = await page.evaluate(() => {
      const metrics = {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domElements: document.querySelectorAll('*').length,
        textContent: document.body.innerText.length,
        images: document.querySelectorAll('img').length,
        links: document.querySelectorAll('a').length,
        isLoaded: document.readyState === 'complete',
        hasDynamicContent: false,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      };

      // Check for dynamic content loading
      const dynamicSelectors = [
        '.msg-s-message-list__event',
        '.msg-conversation-listitem',
        '.feed-shared-update-v2',
        '.artdeco-card'
      ];
      
      metrics.hasDynamicContent = dynamicSelectors.some(selector => 
        document.querySelectorAll(selector).length > 0
      );

      return metrics;
    });

    // Calculate adaptive delay based on page complexity
    let adaptiveDelay = baseDelay;
    
    // Adjust based on load time
    if (pageMetrics.loadTime > 3000) {
      adaptiveDelay *= 1.5; // Slower for heavy pages
    } else if (pageMetrics.loadTime < 1000) {
      adaptiveDelay *= 0.8; // Faster for light pages
    }

    // Adjust based on content complexity
    if (pageMetrics.domElements > 1000) {
      adaptiveDelay *= 1.3;
    }
    
    if (pageMetrics.textContent > 5000) {
      adaptiveDelay *= 1.2;
    }

    // Adjust based on dynamic content
    if (pageMetrics.hasDynamicContent) {
      adaptiveDelay *= 1.4; // More time for dynamic content to load
    }

    // Adjust based on scroll complexity
    if (pageMetrics.scrollHeight > pageMetrics.viewportHeight * 3) {
      adaptiveDelay *= 1.25; // More content to process
    }

    // Apply complexity multiplier
    adaptiveDelay *= complexityMultiplier;

    // Add randomization (±20%)
    const randomization = 0.8 + (Math.random() * 0.4);
    adaptiveDelay *= randomization;

    // Ensure minimum delay
    adaptiveDelay = Math.max(adaptiveDelay, 500);

    console.log(`Adaptive delay: ${Math.round(adaptiveDelay)}ms (base: ${baseDelay}ms, complexity: ${complexityMultiplier})`);
    
    return new Promise(resolve => setTimeout(resolve, Math.round(adaptiveDelay)));
  } catch (error) {
    console.warn('Error calculating adaptive delay, using base delay:', error.message);
    return new Promise(resolve => setTimeout(resolve, baseDelay));
  }
};

// Enhanced randomized mouse movements with natural patterns
const enhancedHumanMouseMove = async (page, targetX, targetY, options = {}) => {
  const {
    speed = 'normal', // 'slow', 'normal', 'fast'
    addJitter = true,
    addMicroMovements = true,
    addHesitation = true
  } = options;

  const currentPosition = await page.evaluate(() => {
    return { x: window.mouseX || 0, y: window.mouseY || 0 };
  });
  
  const startX = currentPosition.x;
  const startY = currentPosition.y;
  
  // Calculate distance for speed adjustment
  const distance = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
  
  // Adjust steps based on distance and speed
  let steps;
  switch (speed) {
    case 'slow':
      steps = Math.floor(Math.random() * 20) + 15; // 15-35 steps
      break;
    case 'fast':
      steps = Math.floor(Math.random() * 8) + 5; // 5-13 steps
      break;
    default:
      steps = Math.floor(Math.random() * 15) + 10; // 10-25 steps
  }

  // Create multiple control points for more natural movement
  const controlPoints = [];
  const numControls = Math.floor(Math.random() * 3) + 2; // 2-4 control points
  
  for (let i = 0; i < numControls; i++) {
    const t = (i + 1) / (numControls + 1);
    const controlX = startX + (targetX - startX) * t + (Math.random() - 0.5) * 150;
    const controlY = startY + (targetY - startY) * t + (Math.random() - 0.5) * 150;
    controlPoints.push({ x: controlX, y: controlY });
  }

  // Generate path using multiple Bezier curves
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Use multiple control points for more complex movement
    let currentX = startX;
    let currentY = startY;
    
    if (controlPoints.length === 2) {
      // Quadratic Bezier curve
      currentX = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlPoints[0].x + Math.pow(t, 2) * targetX;
      currentY = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlPoints[0].y + Math.pow(t, 2) * targetY;
    } else {
      // Cubic Bezier curve with multiple control points
      const cp1 = controlPoints[0];
      const cp2 = controlPoints[controlPoints.length - 1];
      currentX = Math.pow(1 - t, 3) * startX + 3 * Math.pow(1 - t, 2) * t * cp1.x + 3 * (1 - t) * Math.pow(t, 2) * cp2.x + Math.pow(t, 3) * targetX;
      currentY = Math.pow(1 - t, 3) * startY + 3 * Math.pow(1 - t, 2) * t * cp1.y + 3 * (1 - t) * Math.pow(t, 2) * cp2.y + Math.pow(t, 3) * targetY;
    }
    
    path.push({ x: Math.floor(currentX), y: Math.floor(currentY) });
  }

  // Execute the movement with enhanced realism
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    let finalX = point.x;
    let finalY = point.y;

    // Add jitter for more human-like movement
    if (addJitter) {
      const jitterX = (Math.random() - 0.5) * 3;
      const jitterY = (Math.random() - 0.5) * 3;
      finalX += jitterX;
      finalY += jitterY;
    }

    // Add micro-movements
    if (addMicroMovements && Math.random() < 0.3) {
      const microX = (Math.random() - 0.5) * 2;
      const microY = (Math.random() - 0.5) * 2;
      finalX += microX;
      finalY += microY;
    }

    await page.mouse.move(finalX, finalY);
    
    // Store current mouse position
    await page.evaluate((x, y) => {
      window.mouseX = x;
      window.mouseY = y;
    }, finalX, finalY);

    // Variable speed with natural acceleration/deceleration
    const progress = i / path.length;
    const speedMultiplier = Math.sin(progress * Math.PI) * 0.5 + 0.5; // Slow at start/end, fast in middle
    
    let stepDelay;
    switch (speed) {
      case 'slow':
        stepDelay = (30 + Math.random() * 20) * speedMultiplier;
        break;
      case 'fast':
        stepDelay = (10 + Math.random() * 10) * speedMultiplier;
        break;
      default:
        stepDelay = (20 + Math.random() * 15) * speedMultiplier;
    }

    await new Promise(resolve => setTimeout(resolve, stepDelay));

    // Add occasional hesitation
    if (addHesitation && Math.random() < 0.1) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
    }
  }

  // Final micro-adjustment to exact target
  await page.mouse.move(targetX, targetY);
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
};

// Enhanced scrolling with natural patterns and adaptive behavior
const enhancedHumanScroll = async (page, options = {}) => {
  const {
    direction = 'down',
    distance = 300,
    speed = 'normal',
    addRandomStops = true,
    addOverscroll = true
  } = options;

  const scrollDistance = direction === 'down' ? distance : -distance;
  
  // Get page dimensions for adaptive scrolling
  const pageMetrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    currentScroll: window.pageYOffset,
    contentHeight: document.body.scrollHeight
  }));

  // Calculate adaptive scroll distance
  let adaptiveDistance = scrollDistance;
  if (pageMetrics.scrollHeight > pageMetrics.viewportHeight * 2) {
    adaptiveDistance *= 1.2; // More content, scroll further
  }

  // Determine number of scroll steps based on distance and speed
  let steps;
  switch (speed) {
    case 'slow':
      steps = Math.floor(Math.random() * 8) + 6; // 6-14 steps
      break;
    case 'fast':
      steps = Math.floor(Math.random() * 4) + 2; // 2-6 steps
      break;
    default:
      steps = Math.floor(Math.random() * 6) + 3; // 3-9 steps
  }

  const stepDistance = adaptiveDistance / steps;
  let currentScroll = 0;

  for (let i = 0; i < steps; i++) {
    // Calculate scroll amount for this step
    let stepAmount = stepDistance;
    
    // Add variation to step size
    const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
    stepAmount *= (1 + variation);

    // Add overscroll effect
    if (addOverscroll && Math.random() < 0.3) {
      stepAmount *= 1.1 + Math.random() * 0.2; // 10-30% overscroll
    }

    currentScroll += stepAmount;

    // Execute scroll with natural behavior
    await page.evaluate((scroll) => {
      window.scrollBy({
        top: scroll,
        left: 0,
        behavior: 'smooth'
      });
    }, stepAmount);

    // Adaptive delay between scroll steps
    const baseDelay = 100 + Math.random() * 200;
    await adaptiveDelay(page, baseDelay, 0.5);

    // Random stops during scrolling
    if (addRandomStops && Math.random() < 0.2) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    }
  }

  // Final adjustment scroll
  const remainingDistance = adaptiveDistance - currentScroll;
  if (Math.abs(remainingDistance) > 10) {
    await page.evaluate((scroll) => {
      window.scrollBy({
        top: scroll,
        left: 0,
        behavior: 'smooth'
      });
    }, remainingDistance);
  }
};

// Enhanced reading behavior with adaptive timing
const enhancedHumanRead = async (page, options = {}) => {
  const {
    duration = 2000,
    addEyeMovement = true,
    addScroll = true,
    complexityMultiplier = 1
  } = options;

  const startTime = Date.now();
  const readingTime = duration * complexityMultiplier;

  // Get content area for reading simulation
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
    return null;
  });

  if (!contentArea) {
    await adaptiveDelay(page, readingTime, complexityMultiplier);
    return;
  }

  let currentLine = 0;
  const totalLines = Math.floor(contentArea.height / 25);

  while (Date.now() - startTime < readingTime) {
    if (addEyeMovement) {
      // Simulate reading line by line with saccadic eye movements
      const lineY = contentArea.top + (currentLine * 25) + Math.random() * 10;
      const startX = contentArea.left + Math.random() * 20;
      const endX = contentArea.left + contentArea.width * (0.7 + Math.random() * 0.2);

      // Reading across the line (left to right)
      for (let i = 0; i < 5; i++) {
        const progressX = startX + (endX - startX) * (i / 4);
        const microY = lineY + (Math.random() - 0.5) * 3;
        
        await enhancedHumanMouseMove(page, progressX, microY, { speed: 'slow' });
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
      }
    }

    currentLine++;
    if (currentLine >= totalLines) {
      currentLine = 0;
      if (addScroll) {
        await enhancedHumanScroll(page, { distance: 100 + Math.random() * 100 });
      }
      await adaptiveDelay(page, 300 + Math.random() * 500, complexityMultiplier);
    }

    // Pause between lines
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

    // Occasional re-reading or backtracking
    if (Math.random() < 0.15) {
      currentLine = Math.max(0, currentLine - 1 - Math.floor(Math.random() * 2));
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
    }

    // Occasional longer pauses (thinking/processing)
    if (Math.random() < 0.1) {
      await adaptiveDelay(page, 800 + Math.random() * 1200, complexityMultiplier);
    }
  }
};

// Enhanced page interaction with adaptive delays
const enhancedPageInteraction = async (page, action, options = {}) => {
  const {
    addMouseMovement = true,
    addScroll = false,
    addReading = false,
    complexityMultiplier = 1
  } = options;

  try {
    // Pre-action adaptive delay
    await adaptiveDelay(page, 1000, complexityMultiplier);

    // Add random mouse movement before action
    if (addMouseMovement) {
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));
      
      const randomX = Math.random() * viewport.width;
      const randomY = Math.random() * viewport.height;
      
      await enhancedHumanMouseMove(page, randomX, randomY, { speed: 'normal' });
    }

    // Execute the action
    const result = await action();

    // Post-action adaptive delay
    await adaptiveDelay(page, 800, complexityMultiplier * 0.8);

    // Add reading behavior if requested
    if (addReading) {
      await enhancedHumanRead(page, { duration: 2000 + Math.random() * 3000 });
    }

    // Add random scroll if requested
    if (addScroll && Math.random() < 0.3) {
      await enhancedHumanScroll(page, { 
        direction: Math.random() > 0.5 ? 'down' : 'up',
        distance: 100 + Math.random() * 200
      });
    }

    return result;
  } catch (error) {
    console.error('Error in enhanced page interaction:', error);
    throw error;
  }
};

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
const dbPath = path.resolve(__dirname, 'linkedin_inbox.db');
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

// Migration function to handle existing conversations without user_id
const migrateExistingConversations = async () => {
  try {
    console.log('Checking for existing conversations without user_id...');
    
    // Get all conversations without user_id
    const orphanedConversations = await dbAll(
      'SELECT id, contact_name FROM conversations WHERE user_id IS NULL'
    );
    
    if (orphanedConversations.length > 0) {
      console.log(`Found ${orphanedConversations.length} conversations without user_id. These will be hidden from new users.`);
      
      // Optionally, you could assign them to a default user or delete them
      // For now, we'll just log them and leave them as is (they won't be visible to any user)
      
      orphanedConversations.forEach(conv => {
        console.log(`  - Conversation ID ${conv.id}: ${conv.contact_name}`);
      });
    } else {
      console.log('No orphaned conversations found.');
    }
  } catch (err) {
    console.error('Error during conversation migration:', err);
  }
};

// Migration function to add linkedin_account_id column to conversations table
const migrateLinkedInAccountId = async () => {
  try {
    console.log('Checking for linkedin_account_id column in conversations table...');
    
    // Add linkedin_account_id column if it doesn't exist
    await dbAll(`
      ALTER TABLE conversations ADD COLUMN linkedin_account_id TEXT
    `).catch(err => {
      // Ignore error if column already exists
      if (!err.message.includes('duplicate column name')) {
        console.error('Error adding linkedin_account_id to conversations:', err);
      }
    });
    
    // Create index for linkedin_account_id
    await dbAll(`
      CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_account_id ON conversations(linkedin_account_id)
    `).catch(err => {
      console.error('Error creating linkedin_account_id index:', err);
    });
    
    // Remove the UNIQUE constraint on contact_name if it exists (to allow same contact name for different LinkedIn accounts)
    try {
      // Check if the unique constraint exists
      const constraints = await dbAll(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND tbl_name='conversations' AND sql LIKE '%UNIQUE%contact_name%'
      `);
      
      if (constraints.length > 0) {
        console.log('Found UNIQUE constraint on contact_name, removing it...');
        // Drop the unique index
        await dbAll(`DROP INDEX IF EXISTS ${constraints[0].name}`);
        
        // Recreate the index without UNIQUE constraint
        await dbAll(`
          CREATE INDEX IF NOT EXISTS idx_contact_name ON conversations(contact_name)
        `);
        
        console.log('Successfully removed UNIQUE constraint on contact_name');
      }
    } catch (err) {
      console.log('No UNIQUE constraint found on contact_name or error removing it:', err.message);
    }
    
    // Create a composite unique constraint for contact_name + linkedin_account_id (optional)
    try {
      await dbAll(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_linkedin 
        ON conversations(contact_name, linkedin_account_id) 
        WHERE linkedin_account_id IS NOT NULL
      `);
      console.log('Created composite unique index for contact_name + linkedin_account_id');
    } catch (err) {
      console.log('Error creating composite unique index:', err.message);
    }
    
    console.log('LinkedIn account ID migration completed.');
  } catch (err) {
    console.error('Error during LinkedIn account ID migration:', err);
  }
};

// Migration function to clean up existing conversations without linkedin_account_id
const cleanupOldConversations = async () => {
  try {
    console.log('Cleaning up old conversations without linkedin_account_id...');
    
    // Get all conversations without linkedin_account_id
    const oldConversations = await dbAll(
      'SELECT id, contact_name, user_id FROM conversations WHERE linkedin_account_id IS NULL'
    );
    
    if (oldConversations.length > 0) {
      console.log(`Found ${oldConversations.length} old conversations without linkedin_account_id. These will be hidden from users.`);
      
      // Optionally, you could delete them or mark them as inactive
      // For now, we'll just log them and leave them as is (they won't be visible to any user)
      
      oldConversations.forEach(conv => {
        console.log(`  - Old Conversation ID ${conv.id}: ${conv.contact_name} (User ID: ${conv.user_id})`);
      });
      
      console.log('Old conversations will not be displayed to users until they are re-scraped with the correct LinkedIn account.');
    } else {
      console.log('No old conversations found without linkedin_account_id.');
    }
  } catch (err) {
    console.error('Error during old conversations cleanup:', err);
  }
};

// API Routes
app.get('/api/conversations', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // First, get the user's LinkedIn profile information
    const userProfile = await dbAll(
      'SELECT linkedin_profile_url, display_name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!userProfile || userProfile.length === 0) {
      return res.json([]);
    }
    
    const linkedinProfile = userProfile[0];
    
    // If no LinkedIn profile is connected, return empty list
    if (!linkedinProfile.linkedin_profile_url && !linkedinProfile.display_name) {
      return res.json([]);
    }
    
    // Get conversations based on LinkedIn account (either by profile URL or display name)
    let conversations;
    if (linkedinProfile.linkedin_profile_url) {
      // Use LinkedIn profile URL as the identifier
      conversations = await dbAll(
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
         WHERE c.linkedin_account_id = ?
         ORDER BY c.last_updated DESC`,
        [linkedinProfile.linkedin_profile_url]
      );
    } else {
      // Fallback to display name
      conversations = await dbAll(
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
         WHERE c.linkedin_account_id = ?
         ORDER BY c.last_updated DESC`,
        [linkedinProfile.display_name]
      );
    }

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

    console.log(`Returning ${formattedConversations.length} conversations for user ${req.user.id} (LinkedIn: ${linkedinProfile.linkedin_profile_url || linkedinProfile.display_name})`);
    
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
    
    // First, get the user's LinkedIn profile information
    const userProfile = await dbAll(
      'SELECT linkedin_profile_url, display_name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!userProfile || userProfile.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    const linkedinProfile = userProfile[0];
    
    // Get the conversation details (ensure it belongs to the user's LinkedIn account)
    let conversation;
    if (linkedinProfile.linkedin_profile_url) {
      [conversation] = await dbAll(
        'SELECT id, contact_name as contactName FROM conversations WHERE id = ? AND linkedin_account_id = ?', 
        [id, linkedinProfile.linkedin_profile_url]
      );
    } else {
      [conversation] = await dbAll(
        'SELECT id, contact_name as contactName FROM conversations WHERE id = ? AND linkedin_account_id = ?', 
        [id, linkedinProfile.display_name]
      );
    }

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all messages for this conversation with proper ordering
    const messages = await dbAll(
      `SELECT id, sender, message, time 
       FROM messages 
       WHERE conversation_id = ? 
       ORDER BY id ASC`,
      [id]
    );

    // Sort messages by ID to maintain the order they were added to the database
    // This represents the actual chronological order of the conversation
    const sortedMessages = messages.sort((a, b) => {
      return a.id - b.id;
    });

    // Format the response
    const response = {
      id: conversation.id,
      contactName: conversation.contactName,
      messages: sortedMessages.map(msg => ({
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

// Delete conversation endpoint - remove conversation and its messages from database
app.delete('/api/conversations/:conversationId', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Conversation ID is required' 
      });
    }

    console.log(`Deleting conversation ${conversationId} for user ${req.user.id}`);
    
    // First, check if the conversation exists and belongs to this user
    const conversation = await dbAll(
      'SELECT id, contact_name, user_id, linkedin_account_id FROM conversations WHERE id = ?',
      [conversationId]
    );
    
    if (conversation.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }
    
    const conv = conversation[0];
    
    // Check if user has permission to delete this conversation
    if (conv.user_id && conv.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this conversation' 
      });
    }
    
    // Delete all messages for this conversation first
    const deleteMessagesResult = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM messages WHERE conversation_id = ?',
        [conversationId],
        function(err) {
          if (err) {
            console.error('Error deleting messages:', err);
            reject(err);
          } else {
            console.log(`Deleted ${this.changes} messages for conversation ${conversationId}`);
            resolve(this.changes);
          }
        }
      );
    });
    
    // Delete the conversation
    const deleteConversationResult = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM conversations WHERE id = ?',
        [conversationId],
        function(err) {
          if (err) {
            console.error('Error deleting conversation:', err);
            reject(err);
          } else {
            if (this.changes === 0) {
              reject(new Error('Conversation not found'));
            } else {
              console.log(`Deleted conversation ${conversationId}: ${conv.contact_name}`);
              resolve(this.changes);
            }
          }
        }
      );
    });
    
    res.json({ 
      success: true, 
      message: `Successfully deleted conversation: ${conv.contact_name}`,
      data: {
        deletedConversationId: conversationId,
        deletedConversationName: conv.contact_name,
        deletedMessages: deleteMessagesResult,
        deletedConversations: deleteConversationResult
      }
    });
    
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete conversation', 
      error: error.message 
    });
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
const saveMessages = async (contactName, messages, userId = null, linkedinAccountId = null) => {
  const dbPath = path.resolve(__dirname, 'linkedin_inbox.db');
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Begin transaction
      db.run('BEGIN TRANSACTION');
      
      // First, get or create conversation (LinkedIn account-specific)
      const query = linkedinAccountId 
        ? "SELECT id FROM conversations WHERE contact_name = ? AND linkedin_account_id = ?"
        : userId 
          ? "SELECT id FROM conversations WHERE contact_name = ? AND user_id = ?"
          : "SELECT id FROM conversations WHERE contact_name = ? AND linkedin_account_id IS NULL AND user_id IS NULL";
      const params = linkedinAccountId 
        ? [contactName, linkedinAccountId]
        : userId 
          ? [contactName, userId]
          : [contactName];
      
      db.get(
        query,
        params,
        (err, row) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          
          const conversationId = row ? row.id : null;
          
          if (!conversationId) {
            // Create new conversation
            let insertQuery, insertParams;
            if (linkedinAccountId) {
              insertQuery = "INSERT INTO conversations (contact_name, last_updated, linkedin_account_id) VALUES (?, datetime('now'), ?)";
              insertParams = [contactName, linkedinAccountId];
            } else if (userId) {
              insertQuery = "INSERT INTO conversations (contact_name, last_updated, user_id) VALUES (?, datetime('now'), ?)";
              insertParams = [contactName, userId];
            } else {
              insertQuery = "INSERT INTO conversations (contact_name, last_updated) VALUES (?, datetime('now'))";
              insertParams = [contactName];
            }
            
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
      await adaptiveDelay(page, 800 + Math.random() * 1200, complexityMultiplier);
    }
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

// Sync-specific limits (more conservative to avoid detection)
const MAX_SYNC_PER_HOUR = 8; // More conservative than scraping
const MAX_SYNC_PER_DAY = 30;
const MIN_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes between syncs (more conservative)
const DEFAULT_SYNC_LIMIT = 5; // Default conversations to sync per request

// Session activity limits
const MAX_ACTIONS_PER_HOUR = 50; // Total actions (messages + scrapes + syncs + logins)
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
  syncs: [], // New: track sync operations
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

// Check if we can sync conversations (more conservative than scraping)
const canSyncConversations = () => {
  cleanOldRecords();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check sync-specific limits
  const syncsLastHour = activityTracker.syncs.filter(time => time > oneHourAgo).length;
  if (syncsLastHour >= MAX_SYNC_PER_HOUR) {
    return { allowed: false, reason: 'Sync hourly limit exceeded', waitTime: getNextAllowedTime('sync') };
  }
  
  if (activityTracker.syncs.length >= MAX_SYNC_PER_DAY) {
    return { allowed: false, reason: 'Sync daily limit exceeded', waitTime: getNextAllowedTime('sync') };
  }
  
  // Check minimum interval with randomization (more conservative than scraping)
  const lastSync = activityTracker.syncs[activityTracker.syncs.length - 1];
  if (lastSync) {
    const randomMultiplier = BEHAVIOR_RANDOMIZATION.scrapeInterval.min + 
      Math.random() * (BEHAVIOR_RANDOMIZATION.scrapeInterval.max - BEHAVIOR_RANDOMIZATION.scrapeInterval.min);
    const adjustedInterval = MIN_SYNC_INTERVAL * randomMultiplier;
    
    if ((now - lastSync) < adjustedInterval) {
      return { 
        allowed: false, 
        reason: 'Too soon after last sync', 
        waitTime: lastSync + adjustedInterval - now 
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
    
    case 'sync':
      const oldestSync = activityTracker.syncs.find(time => time > oneHourAgo);
      return oldestSync ? (oldestSync + (60 * 60 * 1000) - now) : 0;
    
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

const recordSync = () => {
  const now = Date.now();
  activityTracker.syncs.push(now);
  activityTracker.totalActions.push(now);
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
    syncs: {
      hourly: {
        current: activityTracker.syncs.filter(time => time > oneHourAgo).length,
        limit: MAX_SYNC_PER_HOUR,
        remaining: MAX_SYNC_PER_HOUR - activityTracker.syncs.filter(time => time > oneHourAgo).length
      },
      daily: {
        current: activityTracker.syncs.length,
        limit: MAX_SYNC_PER_DAY,
        remaining: MAX_SYNC_PER_DAY - activityTracker.syncs.length
      },
      nextAllowed: getNextAllowedTime('sync')
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
    console.log(`Using enhanced behavior pattern for current time: ${JSON.stringify(behaviorPattern)}`);
    
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
    
    // Enhanced human behavior simulation before starting
    console.log('Simulating enhanced human behavior before navigation...');
    await enhancedPageInteraction(activePage, async () => {
      const viewport = await activePage.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));
      
      const randomX = Math.random() * viewport.width;
      const randomY = Math.random() * viewport.height;
      
      await enhancedHumanMouseMove(activePage, randomX, randomY, { 
        speed: 'normal',
        addJitter: true,
        addMicroMovements: true,
        addHesitation: true
      });
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
    
    // Navigate to LinkedIn messages with enhanced human-like behavior
    console.log('Navigating to LinkedIn with enhanced anti-bot detection...');
    
    // Check current URL to see if we're already on LinkedIn
    const currentUrl = activePage.url();
    
    if (!currentUrl.includes('linkedin.com')) {
      // First visit LinkedIn homepage to seem more natural
      console.log('Visiting LinkedIn homepage first...');
      await enhancedPageInteraction(activePage, async () => {
        await activePage.goto('https://www.linkedin.com/', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      }, { addMouseMovement: true, addScroll: true, complexityMultiplier: 1.3 });
      
      // Enhanced reading and scrolling behavior
      await enhancedHumanRead(activePage, { 
        duration: 3000 + Math.random() * 2000,
        addEyeMovement: true,
        addScroll: true,
        complexityMultiplier: 1.2
      });
      
      // Enhanced scrolling
      await enhancedHumanScroll(activePage, {
        direction: 'down',
        distance: 200 + Math.random() * 300,
        speed: 'slow',
        addRandomStops: true,
        addOverscroll: true
      });
    }
    
    // Navigate to messages if not already there
    if (!currentUrl.includes('/messaging/')) {
      console.log('Navigating to LinkedIn messages with enhanced behavior...');
      
      // Try clicking the messaging icon first (more natural)
      try {
        const messagingIcon = await activePage.$('a[href*="messaging"]');
        if (messagingIcon) {
          console.log('Clicking messaging icon with enhanced mouse movement...');
          const iconBox = await messagingIcon.boundingBox();
          if (iconBox) {
            const targetX = iconBox.x + iconBox.width / 2 + (Math.random() - 0.5) * 20;
            const targetY = iconBox.y + iconBox.height / 2 + (Math.random() - 0.5) * 10;
            
            await enhancedHumanMouseMove(activePage, targetX, targetY, {
              speed: 'normal',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: true
            });
            
            await activePage.mouse.click(targetX, targetY);
          } else {
            await messagingIcon.click();
          }
          await adaptiveDelay(activePage, 2000 + Math.random() * 2000, 1.2);
        } else {
          throw new Error('Messaging icon not found');
        }
      } catch (error) {
        console.log('Direct navigation to messaging page...');
        await enhancedPageInteraction(activePage, async () => {
          await activePage.goto('https://www.linkedin.com/messaging/', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });
        }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
      }
      
      await adaptiveDelay(activePage, 3000 + Math.random() * 2000, 1.3);
      
      // Enhanced reading simulation
      await enhancedHumanRead(activePage, { 
        duration: 2000 + Math.random() * 1500,
        addEyeMovement: true,
        addScroll: false,
        complexityMultiplier: 1.1
      });
    } else {
      console.log('Already on LinkedIn messages page');
      await adaptiveDelay(activePage, 1000 + Math.random() * 1000, 0.8);
      
      // Still simulate some reading behavior
      await enhancedHumanRead(activePage, { 
        duration: 1500 + Math.random() * 1000,
        addEyeMovement: true,
        addScroll: false,
        complexityMultiplier: 0.9
      });
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
        await adaptiveDelay(activePage, 2000 + Math.random() * 2000, 1.2);
      } catch (error) {
        throw new Error('Login timeout - please ensure you are logged into LinkedIn');
      }
    } else {
      console.log('Already logged in to LinkedIn');
      isLoggedIn = true;
    }
    
    console.log('Looking for conversation with:', contactName);
    
    // Enhanced random mouse movements to appear more human
    await enhancedPageInteraction(activePage, async () => {
      const viewport = await activePage.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));
      
      const randomX = Math.random() * viewport.width * 0.8 + viewport.width * 0.1;
      const randomY = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;
      
      await enhancedHumanMouseMove(activePage, randomX, randomY, {
        speed: 'normal',
        addJitter: true,
        addMicroMovements: true,
        addHesitation: true
      });
    }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 0.8 });
    
    // Enhanced search for the contact in conversations
    console.log('Searching through conversations with enhanced behavior...');
    await adaptiveDelay(activePage, 1000 + Math.random() * 1000, 1.0);
    
    const conversations = await activePage.$$('.msg-conversation-listitem');
    let targetConversation = null;
    
    // Limit the number of conversations to check (2-3 for anti-bot detection)
    const maxConversationsToCheck = Math.min(3, conversations.length);
    console.log(`Checking first ${maxConversationsToCheck} conversations out of ${conversations.length} total conversations`);
    
    // Enhanced human-like searching behavior (limited to first few conversations)
    for (let i = 0; i < maxConversationsToCheck; i++) {
      const conversation = conversations[i];
      
      // Only perform enhanced mouse movements for the first 2 conversations to avoid bot detection
      if (i < 2) {
        await enhancedPageInteraction(activePage, async () => {
          const conversationBox = await conversation.boundingBox();
          if (conversationBox) {
            const scanX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 50;
            const scanY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 30;
            
            await enhancedHumanMouseMove(activePage, scanX, scanY, {
              speed: 'slow',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: Math.random() < 0.3
            });
          }
        }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 0.6 });
      }
      
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
      
      // Add a small delay between checks (only for first 2 conversations)
      if (i < 2) {
        await adaptiveDelay(activePage, 500 + Math.random() * 500, 0.6);
      }
    }
    
    if (!targetConversation) {
      // Enhanced search for the contact if not found in recent conversations
      console.log('Contact not found in recent conversations, trying enhanced search...');
      
      const searchBox = await activePage.$('.msg-conversations-container__search-input');
      if (searchBox) {
        await enhancedPageInteraction(activePage, async () => {
          const searchBoxRect = await searchBox.boundingBox();
          if (searchBoxRect) {
            const targetX = searchBoxRect.x + searchBoxRect.width / 2 + (Math.random() - 0.5) * 20;
            const targetY = searchBoxRect.y + searchBoxRect.height / 2 + (Math.random() - 0.5) * 10;
            
            await enhancedHumanMouseMove(activePage, targetX, targetY, {
              speed: 'normal',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: true
            });
            
            await searchBox.click();
          } else {
            await searchBox.click();
          }
        }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
        
        await adaptiveDelay(activePage, 500 + Math.random() * 500, 0.8);
        
        // Enhanced typing with realistic patterns
        await enhancedPageInteraction(activePage, async () => {
          await humanType(activePage, '.msg-conversations-container__search-input', contactName);
        }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 1.2 });
        
        await adaptiveDelay(activePage, 2000 + Math.random() * 1000, 1.1);
        
        // Look for search results
        const searchResults = await activePage.$$('.msg-conversation-listitem');
        if (searchResults.length > 0) {
          targetConversation = searchResults[0];
        }
      }
      
      if (!targetConversation) {
        throw new Error(`Conversation with ${contactName} not found even after enhanced search`);
      }
    }
    
    // Enhanced clicking on the conversation
    console.log('Opening conversation with enhanced behavior...');
    await enhancedPageInteraction(activePage, async () => {
      const conversationBox = await targetConversation.boundingBox();
      if (conversationBox) {
        const targetX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 30;
        const targetY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 15;
        
        await enhancedHumanMouseMove(activePage, targetX, targetY, {
          speed: 'normal',
          addJitter: true,
          addMicroMovements: true,
          addHesitation: true
        });
        
        await activePage.mouse.click(targetX, targetY);
      } else {
        await targetConversation.click();
      }
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.2 });
    
    await adaptiveDelay(activePage, 2000 + Math.random() * 2000, 1.3);
    
    // Wait for the conversation to load and find the message input
    console.log('Waiting for message input to load with enhanced detection...');
    
    // Try multiple input selectors with enhanced interaction
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
    
    // Enhanced human-like typing behavior
    console.log('Typing message with enhanced human simulation...');
    await enhancedPageInteraction(activePage, async () => {
      const inputBox = await messageInput.boundingBox();
      if (inputBox) {
        const targetX = inputBox.x + inputBox.width / 2 + (Math.random() - 0.5) * 40;
        const targetY = inputBox.y + inputBox.height / 2 + (Math.random() - 0.5) * 20;
        
        await enhancedHumanMouseMove(activePage, targetX, targetY, {
          speed: 'normal',
          addJitter: true,
          addMicroMovements: true,
          addHesitation: true
        });
        
        await activePage.mouse.click(targetX, targetY);
      } else {
        await messageInput.click();
      }
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
    
    await adaptiveDelay(activePage, 500 + Math.random() * 500, 0.8);
    
    // Enhanced typing with realistic patterns
    await enhancedPageInteraction(activePage, async () => {
      await humanType(activePage, inputSelector, message);
    }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 1.3 });
    
    await adaptiveDelay(activePage, 1000 + Math.random() * 1000, 1.1);
    
    // Enhanced sending with human-like behavior
    console.log('Sending message with enhanced anti-bot detection...');
    
    // Try multiple send button selectors (LinkedIn UI changes frequently)
    const sendButtonSelectors = [
      'button[aria-label="Send"]',
      'button[data-control-name="send_message"]',
      'button[aria-label="Send message"]',
      '.msg-form__send-button:not([disabled])',
      'button[data-control-name="send"]',
      'button[aria-label*="Send"]',
      '.msg-form__send-btn:not([disabled])',
      'button.msg-form__send-button',
      '[data-testid="send-button"]',
      '.msg-form button[type="submit"]',
      '.msg-form .artdeco-button--primary',
      'button[type="submit"]',
      '.artdeco-button--primary'
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
      // Enhanced mouse movement to send button
      await enhancedPageInteraction(activePage, async () => {
        const buttonBox = await sendButton.boundingBox();
        if (buttonBox) {
          const targetX = buttonBox.x + buttonBox.width / 2 + (Math.random() - 0.5) * 20;
          const targetY = buttonBox.y + buttonBox.height / 2 + (Math.random() - 0.5) * 20;
          
          await enhancedHumanMouseMove(activePage, targetX, targetY, {
            speed: 'normal',
            addJitter: true,
            addMicroMovements: true,
            addHesitation: true
          });
          
          await activePage.mouse.click(targetX, targetY);
        } else {
          await sendButton.click();
        }
      }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.2 });
      
      await adaptiveDelay(activePage, 2000 + Math.random() * 2000, 1.3);
    }
    
    // Enhanced verification with adaptive delays
    await adaptiveDelay(activePage, 1000 + Math.random() * 1000, 1.0);
    
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
    
    // Method 2: Check for send button state change
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
    
    // Method 3: Enhanced check for message in conversation
    if (!messageSent) {
      try {
        await adaptiveDelay(activePage, 2000 + Math.random() * 1000, 1.1);
        const messageElements = await activePage.$$('.msg-s-message-list__event');
        
        if (messageElements.length > 0) {
          // Check if our message appears in the last few messages
          const lastMessages = messageElements.slice(-3);
          
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
      console.log(`✅ Enhanced message sent successfully to ${contactName}: ${message}`);
      
      // Record message for rate limiting
      recordMessageSent();
      console.log(`Message recorded. Total messages in history: ${messageHistory.length}`);
      
      return { success: true, message: 'Message sent successfully with enhanced anti-bot detection' };
    } else {
      console.log('⚠️ Could not verify message was sent, but no critical errors occurred');
      
      // Still record the attempt to avoid rate limit bypass
      recordMessageSent();
      
      return { 
        success: true, 
        message: 'Message likely sent (verification inconclusive) with enhanced detection', 
        warning: 'Could not definitively verify message delivery'
      };
    }
    
  } catch (error) {
    console.error('Error sending LinkedIn message with enhanced detection:', error);
    
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
    const dbPath = path.resolve(__dirname, 'linkedin_inbox.db');
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

    // Get the user's LinkedIn profile information
    let linkedinAccountId = null;
    if (userId) {
      const userProfile = await dbAll(
        'SELECT linkedin_profile_url, display_name FROM users WHERE id = ?',
        [userId]
      );
      
      if (userProfile && userProfile.length > 0) {
        const profile = userProfile[0];
        linkedinAccountId = profile.linkedin_profile_url || profile.display_name;
      }
    }

    // Use the existing browser session
    const { browser, page } = await initializeBrowserSession();
    const activePage = page;
    
    console.log('Starting conversation scraping with enhanced anti-bot detection...');
    
    // Navigate to messaging page if not already there
    const currentUrl = activePage.url();
    if (!currentUrl.includes('/messaging/')) {
      console.log('Navigating to LinkedIn messages...');
      await activePage.goto('https://www.linkedin.com/messaging/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      // Use adaptive delay based on page load
      await adaptiveDelay(activePage, 2000, 1.2);
    }
    
    // Wait for conversations list to load with enhanced interaction
    await enhancedPageInteraction(activePage, async () => {
      // Try multiple selectors for conversations list (LinkedIn updates their DOM frequently)
      const conversationListSelectors = [
        '.msg-conversations-container__conversations-list',
        '.msg-conversations-list',
        '.conversations-list',
        '[data-test-conversations-list]',
        '.msg-conversations-container ul',
        '.conversations-container ul'
      ];
      
      let conversationListFound = false;
      for (const selector of conversationListSelectors) {
        try {
          await activePage.waitForSelector(selector, { timeout: 5000 });
          console.log(`Found conversations list using selector: ${selector}`);
          conversationListFound = true;
          break;
        } catch (error) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!conversationListFound) {
        throw new Error('Could not find conversations list with any known selector');
      }
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
    
    // Get all conversation elements with multiple selector attempts
    let conversations = [];
    const conversationItemSelectors = [
      '.msg-conversation-listitem',
      '.msg-conversations-list li',
      '.conversation-list-item',
      '[data-test-conversation-item]',
      '.msg-conversations-container__conversations-list li',
      '.conversations-list li'
    ];
    
    for (const selector of conversationItemSelectors) {
      conversations = await activePage.$$(selector);
      if (conversations.length > 0) {
        console.log(`Found ${conversations.length} conversations using selector: ${selector}`);
        break;
      }
    }
    
    if (conversations.length === 0) {
      throw new Error('No conversations found. Please ensure you have conversations in your inbox.');
    }
    
    const actualLimit = Math.min(limit, conversations.length);
    
    console.log(`Found ${conversations.length} conversations, scraping ${actualLimit} with enhanced anti-bot detection...`);
    
    const scrapedData = {
      totalConversations: conversations.length,
      scrapedConversations: 0,
      conversations: [],
      errors: []
    };
    
    for (let i = 0; i < actualLimit; i++) {
      try {
        console.log(`Scraping conversation ${i + 1}/${actualLimit} with enhanced behavior...`);
        
        // Get contact name from conversation list item before clicking
        const contactNameFromList = await activePage.evaluate((index) => {
          const conversationItemSelectors = [
            '.msg-conversation-listitem',
            '.msg-conversations-list li',
            '.conversation-list-item',
            '[data-test-conversation-item]',
            '.msg-conversations-container__conversations-list li',
            '.conversations-list li'
          ];
          
          let conversationItems = [];
          for (const selector of conversationItemSelectors) {
            conversationItems = document.querySelectorAll(selector);
            if (conversationItems.length > 0) {
              break;
            }
          }
          
          if (conversationItems[index]) {
            const nameSelectors = [
              '.msg-conversation-listitem__participant-name',
              '.msg-conversation-listitem__participant-name-text',
              '.msg-conversation-listitem__name',
              '.msg-conversation-listitem__title',
              '[data-test-conversation-name]',
              '.msg-conversation-listitem__participant-name-text',
              '.conversation-name',
              '.participant-name',
              '.contact-name',
              'h3',
              'h4',
              '.name',
              '.title'
            ];
            
            for (const selector of nameSelectors) {
              const nameElement = conversationItems[index].querySelector(selector);
              if (nameElement && nameElement.textContent.trim()) {
                const name = nameElement.textContent.trim();
                // Filter out common placeholder names
                if (name && name.toLowerCase() !== 'messaging' && name.toLowerCase() !== 'unknown' && name.length > 1) {
                  return name;
                }
              }
            }
          }
          return null;
        }, i);
        
        if (contactNameFromList) {
          console.log(`Found contact name from list item: ${contactNameFromList}`);
        }
        
        // Enhanced conversation clicking with randomized mouse movements
        await enhancedPageInteraction(activePage, async () => {
          // Get conversation element position for precise clicking
          const conversationBox = await conversations[i].boundingBox();
          if (conversationBox) {
            const targetX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 20;
            const targetY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 10;
            
            // Enhanced mouse movement to conversation
            await enhancedHumanMouseMove(activePage, targetX, targetY, {
              speed: 'normal',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: true
            });
            
            // Click with slight delay
            await activePage.mouse.click(targetX, targetY);
          } else {
            // Fallback to direct click
            await conversations[i].click();
          }
        }, { 
          addMouseMovement: true, 
          addScroll: Math.random() < 0.3, // 30% chance to add scroll
          complexityMultiplier: 1.2 
        });
        
        // Wait for messages to load with adaptive delay
        await enhancedPageInteraction(activePage, async () => {
          // Try multiple selectors for message list (LinkedIn updates their DOM frequently)
          const messageListSelectors = [
            '.msg-s-message-list',
            '.msg-conversation-messages',
            '.messages-list',
            '.conversation-messages',
            '[data-test-message-list]',
            '.msg-s-message-list__container'
          ];
          
          let messageListFound = false;
          for (const selector of messageListSelectors) {
            try {
              await activePage.waitForSelector(selector, { 
                timeout: 5000,
                visible: true 
              });
              console.log(`Found message list using selector: ${selector}`);
              messageListFound = true;
              break;
            } catch (error) {
              console.log(`Message list selector ${selector} not found, trying next...`);
            }
          }
          
          if (!messageListFound) {
            throw new Error('Could not find message list with any known selector');
          }
          
          // Additional check to ensure we're actually in a conversation (not just the main messaging page)
          const isInConversation = await activePage.evaluate(() => {
            // Check for conversation-specific elements
            const conversationIndicators = [
              '.msg-conversation-header',
              '.msg-conversation-header__title',
              '.msg-conversation-header__name',
              '.msg-s-message-list__event',
              '.msg-s-message-list__message',
              '.msg-s-event-listitem'
            ];
            
            return conversationIndicators.some(selector => document.querySelector(selector) !== null);
          });
          
          if (!isInConversation) {
            console.log('⚠️ Warning: Not in a conversation page, may need to wait longer...');
            // Wait a bit more for the conversation to load
            await adaptiveDelay(activePage, 2000 + Math.random() * 2000, 1.1);
          } else {
            console.log('✅ Confirmed: In conversation page');
          }
        }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 0.8 });
        
        // Enhanced scrolling to load more messages if needed
        await enhancedHumanScroll(activePage, {
          direction: 'up',
          distance: 200 + Math.random() * 300,
          speed: 'slow',
          addRandomStops: true,
          addOverscroll: true
        });
        
        // Enhanced message extraction with human-like reading behavior
        const conversationData = await activePage.evaluate(() => {
          // Try multiple selectors for message elements (LinkedIn updates their DOM frequently)
          const messageSelectors = [
            '.msg-s-message-list__event',
            '.msg-s-message-list__message',
            '.msg-s-event-listitem',
            '.msg-s-message-group',
            '[data-test-message]',
            '.msg-s-message-list__event-item'
          ];
          
          let messageElements = [];
          for (const selector of messageSelectors) {
            messageElements = document.querySelectorAll(selector);
            if (messageElements.length > 0) {
              console.log(`Found ${messageElements.length} messages using selector: ${selector}`);
              break;
            }
          }
          
          const messages = [];
          const senderNames = new Set();
          
          console.log(`Processing ${messageElements.length} message elements`);
          
          // Try multiple selectors for sender names
          const senderSelectors = [
            '.msg-s-message-group__name',
            '.msg-s-message-list__message-sender',
            '.msg-s-message-list__message-sender-name',
            '.msg-s-message-group__name-text',
            '.msg-s-event-listitem__sender',
            '[data-test-message-sender]',
            '.msg-s-message-list__message-sender .msg-s-message-list__message-sender-name',
            '.msg-s-message-list__message-sender span',
            '.msg-s-message-list__message-sender a',
            '.msg-s-message-list__message-sender-name span',
            '.msg-s-message-list__message-sender-name a',
            '.msg-s-message-list__message-sender-name-text',
            '.msg-s-message-list__message-sender-text',
            '.msg-s-message-list__message-sender [aria-label]'
          ];
          
          // Try multiple selectors for message content
          const messageContentSelectors = [
            '.msg-s-event-listitem__body',
            '.msg-s-message-list__message-content',
            '.msg-s-message-group__message',
            '.msg-s-message-list__message-text',
            '.msg-s-event-listitem__content',
            '[data-test-message-content]',
            '.msg-s-message-list__message-body'
          ];
          
          // Try multiple selectors for message time
          const timeSelectors = [
            '.msg-s-message-group__timestamp',
            '.msg-s-message-list__message-time',
            '.msg-s-event-listitem__time',
            'time',
            '.msg-s-message-list__message-timestamp',
            '[data-test-message-time]'
          ];
          
          messageElements.forEach((msg, index) => {
            let senderElement = null;
            let messageElement = null;
            let timeElement = null;
            
            // Try different selectors for sender
            for (const selector of senderSelectors) {
              senderElement = msg.querySelector(selector);
              if (senderElement && senderElement.textContent.trim()) {
                console.log(`Found sender for message ${index}: ${senderElement.textContent.trim()}`);
                break;
              }
            }
            
            // Try different selectors for message content
            for (const selector of messageContentSelectors) {
              messageElement = msg.querySelector(selector);
              if (messageElement && messageElement.textContent.trim()) {
                console.log(`Found message content for message ${index}: ${messageElement.textContent.trim().substring(0, 50)}...`);
                break;
              }
            }
            
            // Try different selectors for time
            for (const selector of timeSelectors) {
              timeElement = msg.querySelector(selector);
              if (timeElement) {
                console.log(`Found time for message ${index}: ${timeElement.getAttribute('title') || timeElement.textContent.trim()}`);
                break;
              }
            }
            
            // If still not found, try to get from aria-label or data attributes
            if (!senderElement) {
              const ariaLabelElement = msg.querySelector('[aria-label*="message from"]');
              if (ariaLabelElement) {
                const ariaLabel = ariaLabelElement.getAttribute('aria-label');
                const match = ariaLabel.match(/message from (.+)/i);
                if (match) {
                  senderElement = { textContent: match[1] };
                  console.log(`Found sender from aria-label: ${match[1]}`);
                }
              }
            }
            
            let sender = 'Unknown';
            let message = '';
            let time = '';
            
            if (senderElement) {
              sender = senderElement.textContent.trim();
              if (sender && sender !== 'Unknown') {
                // Clean up sender name - remove "You" prefix and common variations
                sender = sender.replace(/^You\s*/, '').trim() || 'You';
                if (sender !== 'You' && sender.length > 1) {
                  senderNames.add(sender);
                  console.log(`Added sender name: ${sender}`);
                }
              }
            }
            
            if (messageElement) {
              message = messageElement.textContent.trim();
            }
            
            if (timeElement) {
              time = timeElement.getAttribute('title') || timeElement.getAttribute('datetime') || timeElement.textContent.trim();
            }
            
            if (message) {
              messages.push({
                sender,
                message,
                time
              });
              console.log(`✅ Added message ${index}: ${sender} - ${message.substring(0, 30)}...`);
            } else {
              console.log(`⚠️ No message content found for message ${index}`);
            }
          });
          
          console.log(`Collected sender names: ${Array.from(senderNames).join(', ')}`);
          
          // Determine the contact name from collected sender names
          let contactName = 'Unknown';
          if (senderNames.size > 0) {
            // Filter out 'You' and empty names
            const validNames = Array.from(senderNames).filter(name => 
              name && name.trim() && name.toLowerCase() !== 'you' && name.toLowerCase() !== 'unknown'
            );
            
            console.log(`Valid names after filtering: ${validNames.join(', ')}`);
            
            if (validNames.length === 1) {
              contactName = validNames[0];
            } else if (validNames.length > 1) {
              // If multiple senders, use the first non-'You' name
              contactName = validNames[0];
            }
          }
          
          // If still unknown, try to get contact name from conversation header
          if (contactName === 'Unknown') {
            console.log('Trying to get contact name from conversation header...');
            const headerSelectors = [
              '.msg-conversation-header__title',
              '.msg-conversation-header__name',
              '.msg-conversation-header h1',
              '.msg-conversation-header .msg-conversation-header__title',
              '.msg-conversation-header__title-text',
              '.msg-conversation-header__name-text',
              '.msg-conversation-header__participant-name',
              '.msg-conversation-header__participant-name-text'
            ];
            
            for (const selector of headerSelectors) {
              const headerElement = document.querySelector(selector);
              if (headerElement && headerElement.textContent.trim()) {
                contactName = headerElement.textContent.trim();
                console.log(`Found contact name from header: ${contactName}`);
                break;
              }
            }
          }
          
          // If still unknown, try to get from conversation list item
          if (contactName === 'Unknown') {
            console.log('Trying to get contact name from conversation list item...');
            const listItemSelectors = [
              '.msg-conversation-listitem--selected .msg-conversation-listitem__participant-name',
              '.msg-conversation-listitem--selected .msg-conversation-listitem__participant-name-text',
              '.msg-conversation-listitem--selected .msg-conversation-listitem__name',
              '.msg-conversation-listitem--selected .msg-conversation-listitem__title',
              '.msg-conversation-listitem--selected [data-test-conversation-name]',
              '.msg-conversation-listitem--selected .msg-conversation-listitem__participant-name-text'
            ];
            
            for (const selector of listItemSelectors) {
              const listItemElement = document.querySelector(selector);
              if (listItemElement && listItemElement.textContent.trim()) {
                contactName = listItemElement.textContent.trim();
                console.log(`Found contact name from list item: ${contactName}`);
                break;
              }
            }
          }
          
          // If still unknown, try to get from the page title or any other visible element
          if (contactName === 'Unknown') {
            console.log('Trying to get contact name from page title...');
            const pageTitle = document.title;
            if (pageTitle && pageTitle.includes('|')) {
              const titleParts = pageTitle.split('|');
              if (titleParts.length > 0) {
                const potentialName = titleParts[0].trim();
                if (potentialName && potentialName.length > 0) {
                  contactName = potentialName;
                  console.log(`Found contact name from page title: ${contactName}`);
                }
              }
            }
          }
          
          // Update receiver field in messages
          messages.forEach(msg => {
            if (msg.sender === 'You' || msg.sender.toLowerCase() === 'you') {
              msg.receiver = contactName;
            } else {
              msg.receiver = 'You';
            }
          });
          
          console.log(`Final contact name: ${contactName}`);
          
          return {
            contactName,
            messages,
            messageCount: messages.length,
            senderNames: Array.from(senderNames)
          };
        });
        
        console.log(`  Contact: ${conversationData.contactName} (${conversationData.messageCount} messages)`);
        
        // Use contact name from list item as fallback if still unknown
        if (conversationData.contactName === 'Unknown' && contactNameFromList) {
          console.log(`Using contact name from list item as fallback: ${contactNameFromList}`);
          conversationData.contactName = contactNameFromList;
        }
        
        // Additional debugging for contact name
        if (conversationData.contactName === 'Unknown' || conversationData.contactName === 'Messaging') {
          console.log(`⚠️ Warning: Contact name is still unknown or placeholder. Trying to extract from page...`);
          
          // Try to get contact name from the current page URL or title
          const pageInfo = await activePage.evaluate(() => {
            const title = document.title;
            const url = window.location.href;
            const headerElements = document.querySelectorAll('h1, h2, h3, .msg-conversation-header__title, .msg-conversation-header__name');
            const headerTexts = Array.from(headerElements).map(el => el.textContent.trim()).filter(text => text.length > 0);
            
            return {
              title,
              url,
              headerTexts
            };
          });
          
          console.log(`Page info:`, pageInfo);
          
          // Try to extract name from page title
          if (pageInfo.title && pageInfo.title.includes('|')) {
            const titleParts = pageInfo.title.split('|');
            if (titleParts.length > 0) {
              const potentialName = titleParts[0].trim();
              if (potentialName && potentialName.length > 1 && potentialName.toLowerCase() !== 'messaging') {
                conversationData.contactName = potentialName;
                console.log(`✅ Extracted contact name from page title: ${potentialName}`);
              }
            }
          }
          
          // Try to extract from header texts
          if (conversationData.contactName === 'Unknown' && pageInfo.headerTexts.length > 0) {
            for (const headerText of pageInfo.headerTexts) {
              if (headerText && headerText.length > 1 && headerText.toLowerCase() !== 'messaging') {
                conversationData.contactName = headerText;
                console.log(`✅ Extracted contact name from header: ${headerText}`);
                break;
              }
            }
          }
        }
        
        if (conversationData.contactName !== 'Unknown' && conversationData.contactName !== 'Messaging' && conversationData.messages.length > 0) {
          // Save to database using existing function with LinkedIn account ID
          const conversationId = await getOrCreateConversation(conversationData.contactName, userId, linkedinAccountId);
          
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
          console.log(`⚠️ Skipping conversation - Contact: ${conversationData.contactName}, Messages: ${conversationData.messages.length}`);
          
          // If no messages found, try to scroll and wait a bit more
          if (conversationData.messages.length === 0) {
            console.log('No messages found, trying to scroll and wait for more content...');
            
            // Try scrolling up to load more messages
            await enhancedHumanScroll(activePage, {
              direction: 'up',
              distance: 500 + Math.random() * 300,
              speed: 'slow',
              addRandomStops: true,
              addOverscroll: true
            });
            
            // Wait a bit more for content to load
            await adaptiveDelay(activePage, 3000 + Math.random() * 2000, 1.2);
            
            // Try to extract messages again
            const retryConversationData = await activePage.evaluate((originalContactName) => {
              // Same message extraction logic as above
              const messageSelectors = [
                '.msg-s-message-list__event',
                '.msg-s-message-list__message',
                '.msg-s-event-listitem',
                '.msg-s-message-group',
                '[data-test-message]',
                '.msg-s-message-list__event-item'
              ];
              
              let messageElements = [];
              for (const selector of messageSelectors) {
                messageElements = document.querySelectorAll(selector);
                if (messageElements.length > 0) {
                  console.log(`Retry: Found ${messageElements.length} messages using selector: ${selector}`);
                  break;
                }
              }
              
              if (messageElements.length === 0) {
                return { contactName: originalContactName, messages: [], messageCount: 0 };
              }
              
              // Process messages (simplified version for retry)
              const messages = [];
              messageElements.forEach((msg) => {
                const messageElement = msg.querySelector('.msg-s-event-listitem__body, .msg-s-message-list__message-content, .msg-s-message-group__message');
                const senderElement = msg.querySelector('.msg-s-message-group__name, .msg-s-message-list__message-sender');
                
                if (messageElement && messageElement.textContent.trim()) {
                  const sender = senderElement ? senderElement.textContent.trim() : 'Unknown';
                  const message = messageElement.textContent.trim();
                  messages.push({ sender, message, time: '' });
                }
              });
              
              return {
                contactName: originalContactName,
                messages,
                messageCount: messages.length
              };
            }, conversationData.contactName);
            
            if (retryConversationData.messages.length > 0) {
              console.log(`✅ Retry successful: Found ${retryConversationData.messages.length} messages`);
              conversationData.messages = retryConversationData.messages;
              conversationData.messageCount = retryConversationData.messages.length;
            } else {
              console.log(`⚠️ Retry failed: Still no messages found`);
            }
          }
        }
        
        // Enhanced delay between conversations with adaptive timing
        await adaptiveDelay(activePage, 2000 + Math.random() * 3000, 1.1);
        
        // Random scroll or mouse movement between conversations
        if (Math.random() < 0.4) {
          await enhancedHumanScroll(activePage, {
            direction: Math.random() > 0.5 ? 'down' : 'up',
            distance: 100 + Math.random() * 200,
            speed: 'normal',
            addRandomStops: true
          });
        }
        
      } catch (err) {
        console.error(`⚠️ Failed to scrape conversation ${i + 1}:`, err.message);
        scrapedData.errors.push(`Conversation ${i + 1}: ${err.message}`);
        
        // Adaptive delay after error
        await adaptiveDelay(activePage, 3000, 1.5);
      }
    }
    
    console.log(`✅ Enhanced scraping completed: ${scrapedData.scrapedConversations}/${actualLimit} conversations processed`);
    return scrapedData;
    
  } catch (error) {
    console.error('Error in enhanced scrapeConversations:', error);
    throw error;
  }
};

// Helper function to get or create conversation (from scraper.js logic)
const getOrCreateConversation = (contactName, userId = null, linkedinAccountId = null) => {
  return new Promise((resolve, reject) => {
    if (!contactName) {
      return reject(new Error('Contact name is required'));
    }

    // First, try to find existing conversation (LinkedIn account-specific)
    let query, params;
    if (linkedinAccountId) {
      query = "SELECT id FROM conversations WHERE contact_name = ? AND linkedin_account_id = ?";
      params = [contactName, linkedinAccountId];
    } else if (userId) {
      query = "SELECT id FROM conversations WHERE contact_name = ? AND user_id = ?";
      params = [contactName, userId];
    } else {
      query = "SELECT id FROM conversations WHERE contact_name = ? AND linkedin_account_id IS NULL AND user_id IS NULL";
      params = [contactName];
    }
    
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
        let insertQuery, insertParams;
        if (linkedinAccountId) {
          insertQuery = "INSERT INTO conversations (contact_name, last_updated, linkedin_account_id) VALUES (?, datetime('now'), ?)";
          insertParams = [contactName, linkedinAccountId];
        } else if (userId) {
          insertQuery = "INSERT INTO conversations (contact_name, last_updated, user_id) VALUES (?, datetime('now'), ?)";
          insertParams = [contactName, userId];
        } else {
          insertQuery = "INSERT INTO conversations (contact_name, last_updated) VALUES (?, datetime('now'))";
          insertParams = [contactName];
        }
        
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

// Sync conversations endpoint - fetch latest messages from existing conversations
app.post('/api/sync-conversations', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { limit = DEFAULT_SYNC_LIMIT } = req.body;
    
    // Check rate limiting before proceeding (more conservative than scraping)
    const rateLimitCheck = canSyncConversations();
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitCheck.reason,
        waitTime: rateLimitCheck.waitTime,
        rateLimitStatus: getRateLimitStatus()
      });
    }
    
    console.log(`Starting conversation syncing with limit: ${limit} (Confidence: ${rateLimitCheck.confidence?.toFixed(2) || 'N/A'})`);
    
    const result = await syncConversations(limit, req.user.id);
    
    // Record the sync activity
    recordSync();
    
    res.json({ 
      success: true, 
      message: `Successfully synced ${result.syncedConversations} conversations with ${result.newMessages} new messages`, 
      data: result,
      rateLimitStatus: getRateLimitStatus()
    });
  } catch (error) {
    console.error('Error during conversation syncing:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync conversations', 
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Run migration for existing conversations
  await migrateExistingConversations();
  await migrateLinkedInAccountId();
  await cleanupOldConversations();
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

// Helper function to sync conversations - only sync existing conversations that have been updated
const syncConversations = async (limit = DEFAULT_SYNC_LIMIT, userId = null) => {
  try {
    // Check if we have an active session
    const sessionValid = await isSessionValid();
    
    if (!sessionValid) {
      throw new Error('No active LinkedIn session. Please login first.');
    }

    // Get the user's LinkedIn profile information
    let linkedinAccountId = null;
    if (userId) {
      const userProfile = await dbAll(
        'SELECT linkedin_profile_url, display_name FROM users WHERE id = ?',
        [userId]
      );
      
      if (userProfile && userProfile.length > 0) {
        const profile = userProfile[0];
        linkedinAccountId = profile.linkedin_profile_url || profile.display_name;
      }
    }

    // Get existing conversations for this user
    let existingConversations = [];
    if (linkedinAccountId) {
      existingConversations = await dbAll(
        'SELECT id, contact_name, last_updated FROM conversations WHERE linkedin_account_id = ? ORDER BY last_updated DESC',
        [linkedinAccountId]
      );
    } else if (userId) {
      existingConversations = await dbAll(
        'SELECT id, contact_name, last_updated FROM conversations WHERE user_id = ? ORDER BY last_updated DESC',
        [userId]
      );
    }

    if (existingConversations.length === 0) {
      return {
        totalConversations: 0,
        syncedConversations: 0,
        conversations: [],
        errors: [],
        message: 'No existing conversations found to sync'
      };
    }

    // Limit the number of conversations to sync
    // If limit is 100 or greater, sync all conversations
    const actualLimit = limit >= 100 ? existingConversations.length : limit;
    const conversationsToSync = existingConversations.slice(0, Math.min(actualLimit, existingConversations.length));
    
    console.log(`Found ${existingConversations.length} existing conversations, syncing ${conversationsToSync.length} with enhanced anti-bot detection...`);

    // Use the existing browser session
    const { browser, page } = await initializeBrowserSession();
    const activePage = page;
    
    console.log('Starting conversation syncing with enhanced anti-bot detection...');
    
    // Navigate to messaging page if not already there
    const currentUrl = activePage.url();
    if (!currentUrl.includes('/messaging/')) {
      console.log('Navigating to LinkedIn messages...');
      await activePage.goto('https://www.linkedin.com/messaging/', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await adaptiveDelay(activePage, 2000, 1.2);
    }
    
    // Wait for conversations list to load
    await enhancedPageInteraction(activePage, async () => {
      const conversationListSelectors = [
        '.msg-conversations-container__conversations-list',
        '.msg-conversations-list',
        '.conversations-list',
        '[data-test-conversations-list]',
        '.msg-conversations-container ul',
        '.conversations-container ul'
      ];
      
      let conversationListFound = false;
      for (const selector of conversationListSelectors) {
        try {
          await activePage.waitForSelector(selector, { timeout: 5000 });
          console.log(`Found conversations list using selector: ${selector}`);
          conversationListFound = true;
          break;
        } catch (error) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!conversationListFound) {
        throw new Error('Could not find conversations list with any known selector');
      }
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });

    const syncData = {
      totalConversations: conversationsToSync.length,
      syncedConversations: 0,
      conversations: [],
      errors: [],
      newMessages: 0
    };

    // Sync each conversation
    for (let i = 0; i < conversationsToSync.length; i++) {
      try {
        const conversation = conversationsToSync[i];
        console.log(`Syncing conversation ${i + 1}/${conversationsToSync.length}: ${conversation.contact_name}`);
        
        // Enhanced human-like behavior before starting each conversation
        await enhancedPageInteraction(activePage, async () => {
          // Random mouse movement to simulate human behavior
          const viewport = await activePage.viewport();
          const randomX = Math.random() * viewport.width;
          const randomY = Math.random() * viewport.height;
          
          await enhancedHumanMouseMove(activePage, randomX, randomY, {
            speed: 'normal',
            addJitter: true,
            addMicroMovements: true,
            addHesitation: true
          });
        }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.0 });
        
        // Adaptive delay based on conversation index and complexity
        const conversationDelay = 2000 + Math.random() * 2000 + (i * 500);
        await adaptiveDelay(activePage, conversationDelay, 1.1 + (i * 0.1));
        
        // Try to find the conversation in the conversation list directly
        let conversationFound = false;
        let conversationElement = null;
        
        // Wait for conversations list to be fully loaded
        await enhancedPageInteraction(activePage, async () => {
          const conversationListSelectors = [
            '.msg-conversations-container__conversations-list',
            '.msg-conversations-list',
            '.conversations-list',
            '[data-test-conversations-list]',
            '.msg-conversations-container ul',
            '.conversations-container ul'
          ];
          
          let conversationListFound = false;
          for (const selector of conversationListSelectors) {
            try {
              await activePage.waitForSelector(selector, { timeout: 5000 });
              console.log(`Found conversations list using selector: ${selector}`);
              conversationListFound = true;
              break;
            } catch (error) {
              console.log(`Selector ${selector} not found, trying next...`);
            }
          }
          
          if (!conversationListFound) {
            throw new Error('Could not find conversations list with any known selector');
          }
        }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
        
        // Get all conversation elements using the same selector as sendLinkedInMessage
        const conversationElements = await activePage.$$('.msg-conversation-listitem');
        console.log(`Found ${conversationElements.length} conversation elements`);
        
        // Enhanced human-like searching behavior (same as sendLinkedInMessage)
        for (let j = 0; j < conversationElements.length; j++) {
          const element = conversationElements[j];
          
          // Enhanced mouse movements to mimic human scanning
          await enhancedPageInteraction(activePage, async () => {
            const conversationBox = await element.boundingBox();
            if (conversationBox) {
              const scanX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 50;
              const scanY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 30;
              
              await enhancedHumanMouseMove(activePage, scanX, scanY, {
                speed: 'slow',
                addJitter: true,
                addMicroMovements: true,
                addHesitation: Math.random() < 0.3
              });
            }
          }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 0.6 });
          
          // Use the exact same selector as sendLinkedInMessage
          const nameElement = await element.$('.msg-conversation-listitem__participant-names');
          if (nameElement) {
            const conversationName = await activePage.evaluate(el => el.textContent.trim(), nameElement);
            console.log(`Checking conversation: ${conversationName}`);
            
            if (conversationName.includes(conversation.contact_name) || conversation.contact_name.includes(conversationName)) {
              conversationElement = element;
              conversationFound = true;
              console.log(`Found target conversation: ${conversationName} (matches ${conversation.contact_name})`);
              break;
            }
          }
        }
        
        // If not found in recent conversations, try enhanced search (same as sendLinkedInMessage)
        if (!conversationFound) {
          console.log('Contact not found in recent conversations, trying enhanced search...');
          
          const searchBox = await activePage.$('.msg-conversations-container__search-input');
          if (searchBox) {
            await enhancedPageInteraction(activePage, async () => {
              const searchBoxRect = await searchBox.boundingBox();
              if (searchBoxRect) {
                const targetX = searchBoxRect.x + searchBoxRect.width / 2 + (Math.random() - 0.5) * 20;
                const targetY = searchBoxRect.y + searchBoxRect.height / 2 + (Math.random() - 0.5) * 10;
                
                await enhancedHumanMouseMove(activePage, targetX, targetY, {
                  speed: 'normal',
                  addJitter: true,
                  addMicroMovements: true,
                  addHesitation: true
                });
                
                await searchBox.click();
              } else {
                await searchBox.click();
              }
            }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.1 });
            
            await adaptiveDelay(activePage, 500 + Math.random() * 500, 0.8);
            
            // Enhanced typing with realistic patterns
            await enhancedPageInteraction(activePage, async () => {
              await humanType(activePage, '.msg-conversations-container__search-input', conversation.contact_name);
            }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 1.2 });
            
            await adaptiveDelay(activePage, 2000 + Math.random() * 1000, 1.1);
            
            // Look for search results
            const searchResults = await activePage.$$('.msg-conversation-listitem');
            if (searchResults.length > 0) {
              conversationElement = searchResults[0];
              conversationFound = true;
              console.log(`Found conversation via search: ${conversation.contact_name}`);
            }
          }
        }
        
        if (conversationFound && conversationElement) {
          // Enhanced mouse movement and clicking on the conversation
          await enhancedPageInteraction(activePage, async () => {
            const conversationBox = await conversationElement.boundingBox();
            if (conversationBox) {
              const targetX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 30;
              const targetY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 15;
              
              await enhancedHumanMouseMove(activePage, targetX, targetY, {
                speed: 'normal',
                addJitter: true,
                addMicroMovements: true,
                addHesitation: true
              });
              
              await activePage.mouse.click(targetX, targetY);
            } else {
              await conversationElement.click();
            }
          }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.2 });
          
          // Enhanced adaptive delay after clicking conversation
          const clickDelay = 2500 + Math.random() * 2000 + (Math.random() * 1000);
          await adaptiveDelay(activePage, clickDelay, 1.3);
          
          // Enhanced scrolling to load more messages if needed
          await enhancedPageInteraction(activePage, async () => {
            await enhancedHumanScroll(activePage, {
              direction: 'up',
              distance: 300 + Math.random() * 200,
              speed: 'slow',
              addRandomStops: true,
              addOverscroll: true
            });
          }, { addMouseMovement: false, addScroll: true, complexityMultiplier: 1.1 });
          
          // Wait for messages to load with enhanced interaction
          await enhancedPageInteraction(activePage, async () => {
            const messageListSelectors = [
              '.msg-s-message-list',
              '.msg-conversation-messages',
              '.messages-list',
              '.conversation-messages',
              '[data-test-message-list]',
              '.msg-s-message-list__container'
            ];
            
            let messageListFound = false;
            for (const selector of messageListSelectors) {
              try {
                await activePage.waitForSelector(selector, { 
                  timeout: 8000,
                  visible: true 
                });
                console.log(`Found message list using selector: ${selector}`);
                messageListFound = true;
                break;
              } catch (error) {
                console.log(`Message list selector ${selector} not found, trying next...`);
              }
            }
            
            if (!messageListFound) {
              throw new Error('Could not find message list with any known selector');
            }
          }, { addMouseMovement: false, addScroll: false, complexityMultiplier: 0.8 });
          
          // Enhanced reading behavior while processing messages
          await enhancedHumanRead(activePage, {
            duration: 1500 + Math.random() * 1500,
            addEyeMovement: true,
            addScroll: false,
            complexityMultiplier: 1.0
          });
          
          // Extract new messages with enhanced adaptive behavior
          const newMessages = await activePage.evaluate((lastUpdated) => {
            const messageSelectors = [
              '.msg-s-message-list__event',
              '.msg-s-message-list__message',
              '.msg-s-event-listitem',
              '.msg-s-message-group',
              '[data-test-message]',
              '.msg-s-message-list__event-item'
            ];
            
            let messageElements = [];
            for (const selector of messageSelectors) {
              messageElements = document.querySelectorAll(selector);
              if (messageElements.length > 0) {
                console.log(`Found ${messageElements.length} messages using selector: ${selector}`);
                break;
              }
            }
            
            const messages = [];
            messageElements.forEach((msg, index) => {
              const messageElement = msg.querySelector('.msg-s-event-listitem__body, .msg-s-message-list__message-content, .msg-s-message-group__message');
              const senderElement = msg.querySelector('.msg-s-message-group__name, .msg-s-message-list__message-sender');
              const timeElement = msg.querySelector('.msg-s-message-group__timestamp, .msg-s-message-list__message-time, time');
              
              if (messageElement && messageElement.textContent.trim()) {
                const sender = senderElement ? senderElement.textContent.trim() : 'Unknown';
                const message = messageElement.textContent.trim();
                const time = timeElement ? (timeElement.getAttribute('title') || timeElement.getAttribute('datetime') || timeElement.textContent.trim()) : '';
                
                // Check if this message is newer than the last sync
                if (time && new Date(time) > new Date(lastUpdated)) {
                  messages.push({ sender, message, time, index });
                }
              }
            });
            
            return messages;
          }, conversation.last_updated);
          
          if (newMessages.length > 0) {
            // Enhanced adaptive delay based on number of new messages
            const messageProcessingDelay = 1000 + (newMessages.length * 200) + Math.random() * 1000;
            await adaptiveDelay(activePage, messageProcessingDelay, 1.2);
            
            // Save new messages to database with enhanced error handling
            for (const msg of newMessages) {
              try {
                await saveMessageToDatabase(
                  conversation.id, 
                  msg.sender, 
                  msg.message, 
                  msg.time, 
                  msg.sender === 'You' ? conversation.contact_name : 'You'
                );
                
                // Small delay between saving messages to simulate human behavior
                if (msg.index % 5 === 0) {
                  await adaptiveDelay(activePage, 200 + Math.random() * 300, 0.8);
                }
              } catch (error) {
                console.error(`Failed to save message for ${conversation.contact_name}:`, error);
                syncData.errors.push(`Message save failed for ${conversation.contact_name}: ${error.message}`);
              }
            }
            
            // Update conversation last_updated timestamp
            await dbAll(
              'UPDATE conversations SET last_updated = datetime("now") WHERE id = ?',
              [conversation.id]
            );
            
            syncData.conversations.push({
              contactName: conversation.contact_name,
              newMessages: newMessages.length,
              lastUpdated: new Date().toISOString()
            });
            
            syncData.syncedConversations++;
            syncData.newMessages += newMessages.length;
            
            console.log(`✅ Synced ${newMessages.length} new messages for ${conversation.contact_name}`);
          } else {
            console.log(`ℹ️ No new messages found for ${conversation.contact_name}`);
            syncData.conversations.push({
              contactName: conversation.contact_name,
              newMessages: 0,
              lastUpdated: conversation.last_updated
            });
          }
        } else {
          console.log(`⚠️ Conversation ${conversation.contact_name} not found in conversation list or search results`);
          syncData.errors.push(`Conversation ${conversation.contact_name}: Not found in conversation list or search results (searched ${conversationElements.length} conversations)`);
        }
        
        // Enhanced delay between conversations with adaptive timing
        await adaptiveDelay(activePage, 3000 + Math.random() * 3000, 1.2);
        
        // Enhanced human-like behavior between conversations
        if (i < conversationsToSync.length - 1) {
          await enhancedPageInteraction(activePage, async () => {
            // Random mouse movement to simulate human behavior
            const viewport = await activePage.viewport();
            const randomX = Math.random() * viewport.width;
            const randomY = Math.random() * viewport.height;
            
            await enhancedHumanMouseMove(activePage, randomX, randomY, {
              speed: 'slow',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: true
            });
            
            // Random scroll to simulate human reading behavior
            if (Math.random() < 0.4) {
              await enhancedHumanScroll(activePage, {
                direction: Math.random() > 0.5 ? 'down' : 'up',
                distance: 100 + Math.random() * 200,
                speed: 'normal',
                addRandomStops: true,
                addOverscroll: false
              });
            }
          }, { addMouseMovement: true, addScroll: true, complexityMultiplier: 1.0 });
        }
        
      } catch (err) {
        console.error(`⚠️ Failed to sync conversation ${conversationsToSync[i].contact_name}:`, err.message);
        syncData.errors.push(`Conversation ${conversationsToSync[i].contact_name}: ${err.message}`);
        
        // Enhanced adaptive delay after error
        await adaptiveDelay(activePage, 3000 + Math.random() * 2000, 1.5);
      }
    }
    
    console.log(`✅ Enhanced syncing completed: ${syncData.syncedConversations}/${syncData.totalConversations} conversations processed, ${syncData.newMessages} new messages found`);
    return syncData;
    
  } catch (error) {
    console.error('Error in enhanced syncConversations:', error);
    throw error;
  }
};
