const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

puppeteer.use(StealthPlugin());

// SQLite DB setup with new schema
const db = new sqlite3.Database(path.resolve(__dirname, "linkedin_inbox.db"));

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

// Helper function to perform enhanced page interactions (mouse movement, scroll, etc.)
const enhancedPageInteraction = async (page, action, options = {}) => {
  const {
    addMouseMovement = true,
    addScroll = false,
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
                return reject(new Error('Failed to create conversation - no ID returned'));
              }
              
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
    console.error('Error saving messages:', error);
    throw error;
  }
};

// Legacy delay function (kept for compatibility)
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

    // Enhanced navigation to messaging page
    console.log("Navigating to LinkedIn messaging with enhanced anti-bot detection...");
    await enhancedPageInteraction(page, async () => {
      await page.goto("https://www.linkedin.com/messaging/");
    }, { addMouseMovement: true, addScroll: false, complexityMultiplier: 1.2 });
    
    await page.waitForSelector(".msg-conversations-container__conversations-list");
    await adaptiveDelay(page, 3000, 1.1);

    const conversations = await page.$$(".msg-conversation-listitem");
    const limit = 2; // Adjust as needed

    console.log(`Found ${conversations.length} conversations, scraping ${Math.min(limit, conversations.length)} with enhanced detection...`);

    for (let i = 0; i < Math.min(limit, conversations.length); i++) {
      try {
        console.log(`🕵️ Scraping conversation ${i + 1} with enhanced behavior...`);
        
        // Enhanced conversation clicking
        await enhancedPageInteraction(page, async () => {
          const conversationBox = await conversations[i].boundingBox();
          if (conversationBox) {
            const targetX = conversationBox.x + conversationBox.width / 2 + (Math.random() - 0.5) * 20;
            const targetY = conversationBox.y + conversationBox.height / 2 + (Math.random() - 0.5) * 10;
            
            await enhancedHumanMouseMove(page, targetX, targetY, {
              speed: 'normal',
              addJitter: true,
              addMicroMovements: true,
              addHesitation: true
            });
            
            await page.mouse.click(targetX, targetY);
          } else {
            await conversations[i].click();
          }
        }, { addMouseMovement: true, addScroll: Math.random() < 0.3, complexityMultiplier: 1.2 });
        
        await adaptiveDelay(page, 5000, 1.3);

        // Enhanced scrolling to load more messages
        await enhancedHumanScroll(page, {
          direction: 'up',
          distance: 200 + Math.random() * 300,
          speed: 'slow',
          addRandomStops: true,
          addOverscroll: true
        });

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

        // Enhanced delay between conversations
        await adaptiveDelay(page, 2000 + Math.random() * 2000, 1.1);
        
        // Random scroll or mouse movement between conversations
        if (Math.random() < 0.4) {
          await enhancedHumanScroll(page, {
            direction: Math.random() > 0.5 ? 'down' : 'up',
            distance: 100 + Math.random() * 200,
            speed: 'normal',
            addRandomStops: true
          });
        }
        
      } catch (err) {
        console.error(`⚠️ Failed to scrape conversation ${i + 1}:`, err.message);
        
        // Adaptive delay after error
        await adaptiveDelay(page, 3000, 1.5);
      }
    }

    console.log("✅ Enhanced scraping completed - all conversations processed");
    await browser.close();
    db.close();
  } catch (error) {
    console.error("❌ Error:", error);
    db.close();
    process.exit(1);
  }
})();