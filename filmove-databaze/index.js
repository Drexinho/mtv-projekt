const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// SQLite DB setup
const dbPath = path.join(__dirname, 'filmy.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Chyba při připojování k databázi:', err.message);
  } else {
    console.log('Připojeno k SQLite databázi.');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS filmy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nazev TEXT NOT NULL,
    rok INTEGER,
    reziser TEXT,
    zanr TEXT
  )`);
});

// API endpoints
app.get('/api/filmy', (req, res) => {
  db.all('SELECT * FROM filmy', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/filmy', (req, res) => {
  const { nazev, rok, reziser, zanr } = req.body;
  if (!nazev) {
    return res.status(400).json({ error: 'Název filmu je povinný.' });
  }
  db.run(
    'INSERT INTO filmy (nazev, rok, reziser, zanr) VALUES (?, ?, ?, ?)',
    [nazev, rok, reziser, zanr],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ id: this.lastID, nazev, rok, reziser, zanr });
      }
    }
  );
});

app.get('/api/filmy/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM filmy WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Film nenalezen.' });
    } else {
      res.json(row);
    }
  });
});

app.put('/api/filmy/:id', (req, res) => {
  const { id } = req.params;
  const { nazev, rok, reziser, zanr } = req.body;
  db.run(
    'UPDATE filmy SET nazev = ?, rok = ?, reziser = ?, zanr = ? WHERE id = ?',
    [nazev, rok, reziser, zanr, id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Film nenalezen.' });
      } else {
        res.json({ id, nazev, rok, reziser, zanr });
      }
    }
  );
});

app.delete('/api/filmy/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM filmy WHERE id = ?', [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Film nenalezen.' });
    } else {
      res.json({ message: 'Film byl smazán.' });
    }
  });
});

// Import filmu z TMDB podle názvu
app.post('/api/import-tmdb', async (req, res) => {
  const { nazev } = req.body;
  if (!nazev) {
    return res.status(400).json({ error: 'Název filmu je povinný.' });
  }
  try {
    // Vyhledání filmu na TMDB
    const apiKey = 'f9ff6761e884f9b5e9d636c7867a34cc';
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(nazev)}&language=cs-CZ`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    if (!searchData.results || searchData.results.length === 0) {
      return res.status(404).json({ error: 'Film nebyl na TMDB nalezen.' });
    }
    const film = searchData.results[0];
    // Získání detailů filmu
    const detailUrl = `https://api.themoviedb.org/3/movie/${film.id}?api_key=${apiKey}&language=cs-CZ`;
    const detailResp = await fetch(detailUrl);
    const detailData = await detailResp.json();
    // Uložení do databáze
    db.run(
      'INSERT INTO filmy (nazev, rok, reziser, zanr) VALUES (?, ?, ?, ?)',
      [detailData.title, detailData.release_date ? parseInt(detailData.release_date) : null, (detailData.director || ''), (detailData.genres && detailData.genres.length > 0 ? detailData.genres.map(g => g.name).join(', ') : '')],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.status(201).json({ id: this.lastID, nazev: detailData.title, rok: detailData.release_date ? parseInt(detailData.release_date) : null, reziser: '', zanr: (detailData.genres && detailData.genres.length > 0 ? detailData.genres.map(g => g.name).join(', ') : '') });
        }
      }
    );
  } catch (e) {
    res.status(500).json({ error: 'Chyba při komunikaci s TMDB.' });
  }
});

// Import 50 nejlépe hodnocených filmů z TMDB
app.post('/api/import-tmdb-top', async (req, res) => {
  try {
    const apiKey = 'f9ff6761e884f9b5e9d636c7867a34cc';
    let imported = 0;
    let errors = [];
    for (let page = 1; page <= 3; page++) { // 20 filmů na stránku, 3 stránky = 60 filmů
      const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&language=cs-CZ&page=${page}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (!data.results) break;
      for (const film of data.results) {
        // Detail pro žánry
        const detailUrl = `https://api.themoviedb.org/3/movie/${film.id}?api_key=${apiKey}&language=cs-CZ`;
        let zanr = '';
        try {
          const detailResp = await fetch(detailUrl);
          const detailData = await detailResp.json();
          zanr = (detailData.genres && detailData.genres.length > 0) ? detailData.genres.map(g => g.name).join(', ') : '';
        } catch (e) {}
        await new Promise((resolve) => {
          db.run(
            'INSERT INTO filmy (nazev, rok, reziser, zanr) VALUES (?, ?, ?, ?)',
            [film.title, film.release_date ? parseInt(film.release_date) : null, '', zanr],
            function (err) {
              if (!err) imported++;
              else errors.push(film.title);
              resolve();
            }
          );
        });
        if (imported >= 50) break;
      }
      if (imported >= 50) break;
    }
    res.json({ imported, errors });
  } catch (e) {
    res.status(500).json({ error: 'Chyba při importu z TMDB.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
}); 