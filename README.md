# LinkedIn Inbox Automation Suite

## Overview
This project provides a full-stack solution for automating the viewing, scraping, and messaging of LinkedIn conversations while employing advanced anti-bot detection evasion techniques. It consists of a Node.js/Express backend (with Puppeteer automation and SQLite storage) and a React-based frontend UI.

---

## Features
- **Automated LinkedIn login, scraping, and messaging**
- **Advanced anti-bot detection strategy** (random delays, human-like mouse/keyboard, rate limits, stealth browser)
- **Enhanced randomized mouse/scroll events** with natural movement patterns
- **Adaptive delay logic** based on page load and content complexity
- **Multi-user support with session management**
- **Full message and conversation history storage**
- **Modern React UI for viewing and sending messages**

---

## Technologies Used
- **Backend:** Node.js, Express, Puppeteer, puppeteer-extra-plugin-stealth, SQLite3
- **Frontend:** React, react-scripts
- **Database:** SQLite3

---

## Enhanced Anti-Bot Detection Features

### 🎯 **Randomized Mouse/Scroll Events**
- **Natural Mouse Movement**: Bezier curve-based mouse movements with multiple control points
- **Micro-movements & Jitter**: Realistic human-like jitter and micro-adjustments
- **Variable Speed**: Natural acceleration/deceleration patterns
- **Hesitation Patterns**: Occasional pauses and hesitations during movement
- **Enhanced Scrolling**: Natural scroll patterns with overscroll effects and random stops

### ⏱️ **Adaptive Delay Logic**
- **Page Load Detection**: Automatically adjusts delays based on page load times
- **Content Complexity Analysis**: Considers DOM elements, text content, and dynamic content
- **Dynamic Content Detection**: Identifies and waits for dynamic content loading
- **Scroll Complexity**: Adapts to page scroll height and viewport dimensions
- **Randomization**: ±20% randomization on all delays for natural variation

### 🔄 **Enhanced Page Interactions**
- **Pre/Post Action Delays**: Intelligent delays before and after actions
- **Mouse Movement Integration**: Random mouse movements during page interactions
- **Reading Simulation**: Realistic eye movement patterns and reading behavior
- **Scroll Integration**: Natural scrolling patterns during interactions

---

## Backend API Endpoints

### Authentication & Session
- `POST /api/auth/login` — Login or register user
- `POST /api/linkedin-login` — Launch LinkedIn login in browser (manual login required)
- `POST /api/linkedin-logout` — Logout and close browser session
- `GET /api/auth/me` — Get current user info
- `PUT /api/auth/profile` — Update user profile

### Conversations & Messaging
- `GET /api/conversations` — List all conversations
- `GET /api/conversations/:id/messages` — Get all messages in a conversation
- `POST /api/send-message` — Send a LinkedIn message (rate-limited, enhanced anti-bot safe)
- `POST /api/scrape-conversations` — Scrape conversations from LinkedIn (rate-limited, enhanced detection)
- `POST /api/rescrape` — Re-scrape conversations (legacy)

### Status & Rate Limits
- `GET /api/linkedin-status` — Get LinkedIn session status
- `GET /api/rate-limit-status` — Get current rate limit and anti-bot status

---

## Enhanced Anti-Bot Detection Strategy
This project employs a multi-layered, state-of-the-art anti-bot evasion strategy with the following enhancements:

### **Randomized Delays & Adaptive Timing**
- **Adaptive Delays**: Every action uses intelligent delays based on page complexity, load times, and content
- **Dynamic Content Detection**: Automatically detects and waits for dynamic content loading
- **Page Load Analysis**: Adjusts timing based on actual page load performance
- **Content Complexity**: Considers DOM elements, text content, and scroll complexity

### **Enhanced Human Mouse Movements**
- **Bezier Curve Paths**: Natural mouse movement using multiple control points
- **Micro-movements**: Realistic jitter and micro-adjustments during movement
- **Variable Speed**: Natural acceleration/deceleration patterns
- **Hesitation Patterns**: Occasional pauses and hesitations for realism
- **Distance-based Adjustments**: Movement speed adapts to distance

### **Natural Scrolling Behavior**
- **Overscroll Effects**: Realistic overscroll patterns (10-30% overscroll)
- **Random Stops**: Occasional pauses during scrolling
- **Variable Step Sizes**: ±20% variation in scroll step sizes
- **Adaptive Distance**: Scroll distance adapts to page content
- **Smooth Scrolling**: Natural smooth scrolling behavior

### **Enhanced Page Interactions**
- **Pre-action Delays**: Intelligent delays before performing actions
- **Post-action Delays**: Adaptive delays after completing actions
- **Mouse Movement Integration**: Random mouse movements during interactions
- **Reading Simulation**: Realistic eye movement and reading patterns
- **Scroll Integration**: Natural scrolling during page interactions

### **Behavioral Patterns**
- **Time-of-Day Adaptation**: Activity adapts to business hours, evening, and night
- **Content-Aware Timing**: Delays adjust based on content complexity
- **Dynamic Content Handling**: Special handling for dynamic content loading
- **Error Recovery**: Adaptive delays after errors or failures

### **Strict Rate Limits**
- **Conservative Limits**: Max 12 messages/hour, 40/day
- **Adaptive Intervals**: Minimum intervals with randomization
- **Activity Tracking**: Comprehensive tracking of all activities
- **Session Management**: Realistic session timeouts and breaks

### **Stealth Browser Configuration**
- **Non-headless Mode**: Uses visible browser for better stealth
- **Realistic Arguments**: Browser arguments that mimic real user behavior
- **User Agent Rotation**: Realistic user agent strings
- **Fingerprint Evasion**: Advanced fingerprinting evasion techniques

---

## Workflow
1. **User Authentication:** User logs in or registers via the API/UI.
2. **LinkedIn Login:** User launches a LinkedIn login session (manual login in browser window).
3. **Profile Detection:** System detects and links the LinkedIn profile to the user.
4. **Enhanced Conversation Scraping:** User can trigger scraping with advanced anti-bot detection (subject to rate limits).
5. **Enhanced Message Sending:** User can send messages via the UI/API with enhanced anti-bot protection (subject to rate limits and adaptive delays).
6. **Session Management:** Sessions are tracked with enhanced timeout and break management.
7. **Frontend UI:** Users interact with a modern React UI to view conversations, read messages, and send new messages.

---

## Setup & Installation
```bash
# Backend
cd backend
npm install
npm run start

# Frontend
cd ../linkedin-inbox-ui
npm install
npm start
```

---

## Enhanced Features Usage

### **Adaptive Delays**
```javascript
// Automatic adaptive delay based on page complexity
await adaptiveDelay(page, 1000, 1.2);

// Enhanced page interaction with adaptive timing
await enhancedPageInteraction(page, async () => {
  // Your action here
}, { 
  addMouseMovement: true, 
  addScroll: false, 
  complexityMultiplier: 1.1 
});
```

### **Enhanced Mouse Movements**
```javascript
// Natural mouse movement with options
await enhancedHumanMouseMove(page, targetX, targetY, {
  speed: 'normal', // 'slow', 'normal', 'fast'
  addJitter: true,
  addMicroMovements: true,
  addHesitation: true
});
```

### **Enhanced Scrolling**
```javascript
// Natural scrolling with options
await enhancedHumanScroll(page, {
  direction: 'down',
  distance: 300,
  speed: 'normal',
  addRandomStops: true,
  addOverscroll: true
});
```

---

## Notes
- **Manual LinkedIn Login:** For security and anti-bot reasons, the actual LinkedIn login must be performed manually in the browser window launched by the backend.
- **Database:** All messages and conversations are stored in a local SQLite database.
- **Enhanced Detection:** The system now includes advanced randomized mouse/scroll events and adaptive delay logic for improved anti-bot detection evasion.
- **Customization:** Rate limits and anti-bot parameters can be tuned in `backend/server.js`.

---

## Disclaimer
This project is for educational and research purposes only. Use at your own risk. Automated interaction with LinkedIn may violate their terms of service.