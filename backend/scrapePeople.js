const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

puppeteer.use(StealthPlugin());

// SQLite DB setup
const db = new sqlite3.Database(path.resolve(__dirname, "linkedin_inbox.db"));

// Adaptive delay function
const adaptiveDelay = async (page, baseDelay = 1000) => {
  const delay = baseDelay + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Main people scraping function
const scrapeCompanyPeople = async (companyUrl, limit = 10, userId = null) => {
  let browser = null;
  let page = null;
  
  try {
    console.log(`🚀 Starting people scraping from: ${companyUrl}`);
    console.log(`📊 Target limit: ${limit} people`);
    
    // Initialize browser
    browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized", "--no-sandbox"],
      defaultViewport: null,
    });

    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    
    // Navigate to the company people page
    console.log(`🌐 Navigating to company people page...`);
    await page.goto(companyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await adaptiveDelay(page, 3000);

    // Extract company name
    const companyName = await page.evaluate(() => {
      const companyElement = document.querySelector('.org-top-card-summary__title') || 
                           document.querySelector('.org-top-card__title') ||
                           document.querySelector('h1');
      return companyElement ? companyElement.textContent.trim() : 'Unknown Company';
    });

    console.log(`🏢 Company: ${companyName}`);

    // Wait for people list to load
    await page.waitForSelector('.entity-result__item, .search-result__info, .artdeco-card', { timeout: 10000 });
    await adaptiveDelay(page, 2000);

    const people = [];
    let currentCount = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    while (currentCount < limit && hasMorePages) {
      console.log(`📄 Processing page ${pageNumber}...`);
      
      // Extract people from current page
      const pagePeople = await page.evaluate(() => {
        const peopleElements = document.querySelectorAll('.entity-result__item, .search-result__info, .artdeco-card');
        const extracted = [];

        peopleElements.forEach((element) => {
          try {
            const nameElement = element.querySelector('.entity-result__title-text, .search-result__title, .artdeco-entity-lockup__title');
            const titleElement = element.querySelector('.entity-result__primary-subtitle, .search-result__subtitle, .artdeco-entity-lockup__subtitle');
            const locationElement = element.querySelector('.entity-result__secondary-subtitle, .search-result__location, .artdeco-entity-lockup__metadata');
            const linkElement = element.querySelector('a[href*="/in/"]');

            const name = nameElement ? nameElement.textContent.trim() : null;
            const title = titleElement ? titleElement.textContent.trim() : null;
            const location = locationElement ? locationElement.textContent.trim() : null;
            const linkedinUrl = linkElement ? linkElement.href : null;

            if (name) {
              extracted.push({ name, title, location, linkedinUrl });
            }
          } catch (error) {
            console.warn(`Error extracting person:`, error);
          }
        });

        return extracted;
      });

      // Add people from this page
      for (const person of pagePeople) {
        if (currentCount < limit) {
          people.push(person);
          currentCount++;
          console.log(`✅ Scraped: ${person.name} - ${person.title || 'No title'}`);
        } else {
          break;
        }
      }

      // Check if we need more people and if there are more pages
      if (currentCount < limit) {
        const nextPageButton = await page.$('button[aria-label*="Next"], .artdeco-pagination__button--next');
        
        if (nextPageButton) {
          console.log(`➡️ Moving to next page...`);
          await nextPageButton.click();
          await adaptiveDelay(page, 3000);
          
          await page.waitForSelector('.entity-result__item, .search-result__info, .artdeco-card', { timeout: 10000 });
          pageNumber++;
        } else {
          console.log(`🏁 No more pages available`);
          hasMorePages = false;
        }
      } else {
        console.log(`🎯 Reached target limit of ${limit} people`);
        break;
      }

      if (hasMorePages && currentCount < limit) {
        await adaptiveDelay(page, 2000);
      }
    }

    // Save people data to database
    if (people.length > 0) {
      await savePeopleToDatabase(companyName, people, userId);
    }

    const result = {
      companyName,
      totalPeople: people.length,
      scrapedPeople: people.length,
      people: people,
      timestamp: new Date().toISOString(),
      errors: []
    };

    console.log(`✅ People scraping completed successfully!`);
    console.log(`📊 Results: ${people.length} people scraped from ${companyName}`);
    
    return result;

  } catch (error) {
    console.error('❌ Error during people scraping:', error);
    
    return {
      companyName: 'Unknown',
      totalPeople: 0,
      scrapedPeople: 0,
      people: [],
      timestamp: new Date().toISOString(),
      errors: [error.message]
    };
    
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

// Save people data to database
const savePeopleToDatabase = async (companyName, people, userId = null) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS company_people (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT NOT NULL,
          person_name TEXT NOT NULL,
          title TEXT,
          location TEXT,
          linkedin_url TEXT,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(
          "INSERT INTO company_people (company_name, person_name, title, location, linkedin_url, user_id) VALUES (?, ?, ?, ?, ?, ?)"
        );
        
        let error = null;
        for (const person of people) {
          stmt.run(
            companyName,
            person.name,
            person.title || null,
            person.location || null,
            person.linkedinUrl || null,
            userId || null,
            function(err) {
              if (err) error = err;
            }
          );
        }
        
        stmt.finalize(err => {
          if (err) error = err;
          
          if (error) {
            return db.run('ROLLBACK', () => reject(error));
          }
          
          db.run('COMMIT', (err) => {
            if (err) return reject(err);
            console.log(`💾 Saved ${people.length} people to database for company: ${companyName}`);
            resolve();
          });
        });
      });
    });
  });
};

// Get people from database
const getPeopleFromDatabase = async (companyName, userId = null) => {
  return new Promise((resolve, reject) => {
    const sql = userId 
      ? "SELECT * FROM company_people WHERE company_name = ? AND user_id = ? ORDER BY scraped_at DESC"
      : "SELECT * FROM company_people WHERE company_name = ? ORDER BY scraped_at DESC";
    
    const params = userId ? [companyName, userId] : [companyName];
    
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

module.exports = {
  scrapeCompanyPeople,
  savePeopleToDatabase,
  getPeopleFromDatabase
};
