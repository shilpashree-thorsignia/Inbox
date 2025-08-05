# LinkedIn Inbox Automation Suite

## Overview
This project provides a full-stack solution for automating the viewing, scraping, and messaging of LinkedIn conversations while employing advanced anti-bot detection evasion techniques. It consists of a Node.js/Express backend (with Puppeteer automation and SQLite storage) and a React-based frontend UI.

---

## Features
- **Automated LinkedIn login, scraping, and messaging**
- **Anti-bot detection strategy** (random delays, human-like mouse/keyboard, rate limits, stealth browser)
- **Multi-user support with session management**
- **Full message and conversation history storage**
- **Modern React UI for viewing and sending messages**

---

## Technologies Used
- **Backend:** Node.js, Express, Puppeteer, puppeteer-extra-plugin-stealth, SQLite3
- **Frontend:** React, react-scripts
- **Database:** SQLite3

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
- `POST /api/send-message` — Send a LinkedIn message (rate-limited, anti-bot safe)
- `POST /api/scrape-conversations` — Scrape conversations from LinkedIn (rate-limited)
- `POST /api/rescrape` — Re-scrape conversations (legacy)

### Status & Rate Limits
- `GET /api/linkedin-status` — Get LinkedIn session status
- `GET /api/rate-limit-status` — Get current rate limit and anti-bot status

---

## Anti-Bot Detection Strategy
This project employs a multi-layered, state-of-the-art anti-bot evasion strategy:
- **Randomized Delays:** Every action (navigation, typing, clicking, scraping) uses random human-like delays, not fixed intervals.
- **Human Mouse Movements:** Mouse moves use Bezier curves, micro-movements, and variable speeds to mimic real users.
- **Human Typing Simulation:** Typing includes random speed, errors, corrections, and pauses between words/letters.
- **Behavioral Patterns:** Activity adapts to time-of-day (business hours, evening, night) for more realistic usage.
- **Strict Rate Limits:** Conservative hourly/daily caps on messages, actions, and session duration (e.g., max 12 messages/hour, 40/day).
- **Session Simulation:** Sessions have realistic timeouts, forced breaks, and randomized session lengths.
- **Stealth Browser:** Uses puppeteer-extra-plugin-stealth and non-headless browser with realistic arguments to evade fingerprinting.
- **Error & Retry Handling:** All scraping/messaging actions have retry logic with delays, and handle unexpected errors or UI changes.

---

## Workflow
1. **User Authentication:** User logs in or registers via the API/UI.
2. **LinkedIn Login:** User launches a LinkedIn login session (manual login in browser window).
3. **Profile Detection:** System detects and links the LinkedIn profile to the user.
4. **Conversation Scraping:** User can trigger scraping of conversations/messages (subject to anti-bot rate limits).
5. **Message Sending:** User can send messages via the UI/API (subject to anti-bot rate limits and delays).
6. **Session Management:** Sessions are tracked, and users can log out or will be logged out after inactivity or session timeouts.
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

## Notes
- **Manual LinkedIn Login:** For security and anti-bot reasons, the actual LinkedIn login must be performed manually in the browser window launched by the backend.
- **Database:** All messages and conversations are stored in a local SQLite database.
- **Customization:** Rate limits and anti-bot parameters can be tuned in `backend/server.js`.

---

## Disclaimer
This project is for educational and research purposes only. Use at your own risk. Automated interaction with LinkedIn may violate their terms of service.