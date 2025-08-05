const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'linkedin_messages_v3.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`, [], (err, tables) => {
    if (err) {
      console.error('Error fetching tables:', err.message);
      db.close();
      return;
    }
    if (tables.length === 0) {
      console.log('No user tables found.');
      db.close();
      return;
    }
    tables.forEach(({ name }) => {
      db.run(`DELETE FROM ${name};`, (err) => {
        if (err) {
          console.error(`Failed to clear table ${name}:`, err.message);
        } else {
          console.log(`Cleared table: ${name}`);
        }
      });
    });
    db.close(() => {
      console.log('All data deleted from all tables.');
    });
  });
});
