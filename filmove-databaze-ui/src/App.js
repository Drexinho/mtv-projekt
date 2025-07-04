import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:3000';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
const PLACEHOLDER = 'https://via.placeholder.com/300x450/222/888?text=No+Poster';
const OMDB_API_KEY = 'b9b4e8e2'; // veřejný demo klíč, pro větší projekt použij vlastní

function App() {
  const [filmy, setFilmy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nazev, setNazev] = useState('');
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [hovered, setHovered] = useState(null);
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [meta, setMeta] = useState({}); // { id: { popis, tagy, herci } }
  const [detail, setDetail] = useState(null); // { ...film, ...meta }

  const fetchFilmy = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/filmy`);
    const data = await res.json();
    setFilmy(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchFilmy();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nazev) return;
    await fetch(`${API_URL}/api/import-tmdb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev })
    });
    setNazev('');
    fetchFilmy();
  };

  const handleImportTop = async () => {
    setImporting(true);
    setMsg('Importuji 50 nejlépe hodnocených filmů z TMDB...');
    await fetch(`${API_URL}/api/import-tmdb-top`, { method: 'POST' });
    setMsg('Import dokončen!');
    setImporting(false);
    fetchFilmy();
  };

  // Získání posteru, popisu, tagů a herců z TMDB, OMDb, případně fallback na placeholder
  const [posters, setPosters] = useState({});
  useEffect(() => {
    const fetchMeta = async () => {
      const newPosters = {};
      const newMeta = {};
      for (const film of filmy) {
        if (!film.nazev) continue;
        let poster = null;
        let popis = '';
        let tagy = [];
        let herci = [];
        // 1. TMDB
        try {
          const resp = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=f9ff6761e884f9b5e9d636c7867a34cc&query=${encodeURIComponent(film.nazev)}&language=cs-CZ`);
          const data = await resp.json();
          if (data.results && data.results[0]) {
            if (data.results[0].poster_path) poster = TMDB_IMG + data.results[0].poster_path;
            if (data.results[0].overview) popis = data.results[0].overview;
            // Detail pro žánry a herce
            const detailResp = await fetch(`https://api.themoviedb.org/3/movie/${data.results[0].id}?api_key=f9ff6761e884f9b5e9d636c7867a34cc&language=cs-CZ&append_to_response=credits`);
            const detailData = await detailResp.json();
            if (detailData.genres) tagy = detailData.genres.map(g => g.name);
            if (detailData.credits && detailData.credits.cast) herci = detailData.credits.cast.slice(0, 8).map(a => a.name);
          }
        } catch {}
        // 2. OMDb
        if ((!poster || !popis || tagy.length === 0 || herci.length === 0)) {
          try {
            const resp = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(film.nazev)}`);
            const data = await resp.json();
            if (!poster && data.Poster && data.Poster !== 'N/A') poster = data.Poster;
            if (!popis && data.Plot && data.Plot !== 'N/A') popis = data.Plot;
            if (tagy.length === 0 && data.Genre) tagy = data.Genre.split(',').map(t => t.trim());
            if (herci.length === 0 && data.Actors) herci = data.Actors.split(',').map(a => a.trim());
          } catch {}
        }
        // 3. Google Books (jen pro obrázek, fallback)
        if (!poster) {
          try {
            const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(film.nazev)}`);
            const data = await resp.json();
            if (data.items && data.items[0] && data.items[0].volumeInfo && data.items[0].volumeInfo.imageLinks && data.items[0].volumeInfo.imageLinks.thumbnail) {
              poster = data.items[0].volumeInfo.imageLinks.thumbnail;
            }
          } catch {}
        }
        if (!poster) poster = PLACEHOLDER;
        newPosters[film.id] = poster;
        newMeta[film.id] = { popis, tagy, herci };
      }
      setPosters(newPosters);
      setMeta(newMeta);
    };
    if (filmy.length > 0) fetchMeta();
  }, [filmy]);

  // Výběr všech žánrů v DB
  const allGenres = Array.from(new Set(Object.values(meta).flatMap(m => m.tagy || []))).filter(Boolean).sort();

  // Filtrování filmů podle vyhledávání a žánru
  const filtered = filmy.filter(film => {
    const m = meta[film.id] || {};
    const matchNazev = film.nazev.toLowerCase().includes(search.toLowerCase());
    const matchGenre = !genreFilter || (m.tagy && m.tagy.includes(genreFilter));
    return matchNazev && matchGenre;
  });

  // Detail modal
  const openDetail = (film) => {
    setDetail({ ...film, ...(meta[film.id] || {}), poster: posters[film.id] });
  };
  const closeDetail = () => setDetail(null);

  return (
    <div style={{ minHeight: '100vh', background: '#181818', color: '#fff', fontFamily: 'Segoe UI, Arial, sans-serif', paddingBottom: 40 }}>
      {/* Header bar */}
      <div style={{ background: '#111', padding: '0 0 0 0', borderBottom: '2px solid #ff9000', display: 'flex', alignItems: 'center', height: 64 }}>
        <span style={{ fontWeight: 900, fontSize: 32, color: '#fff', letterSpacing: 1, marginLeft: 32 }}>
          <span style={{ color: '#ff9000' }}>FILM</span><span style={{ color: '#fff' }}>HUB</span>
        </span>
        <input
          type="text"
          placeholder="Hledat film..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 32, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '8px 16px', fontSize: 16, width: 300 }}
        />
        <div style={{ flex: 1 }} />
        <select
          value={genreFilter}
          onChange={e => setGenreFilter(e.target.value)}
          style={{ background: '#222', color: '#ff9000', border: '1px solid #444', borderRadius: 4, padding: '8px 16px', fontSize: 16, marginRight: 32 }}
        >
          <option value="">Všechny žánry</option>
          {allGenres.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      {/* Akce */}
      <div style={{ display: 'flex', gap: 16, margin: '32px auto 24px auto', justifyContent: 'center', maxWidth: 1200 }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, background: '#222', borderRadius: 8, padding: 8 }}>
          <input
            type="text"
            placeholder="Název filmu z TMDB..."
            value={nazev}
            onChange={e => setNazev(e.target.value)}
            style={{ flex: 1, padding: 8, fontSize: 16, background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
            disabled={importing}
          />
          <button type="submit" style={{ padding: '8px 16px', fontSize: 16, background: '#ff9000', color: '#181818', border: 'none', borderRadius: 4, fontWeight: 700 }} disabled={importing}>Přidat</button>
        </form>
        <button onClick={handleImportTop} style={{ padding: '8px 16px', fontSize: 16, background: '#ff9000', color: '#181818', border: 'none', borderRadius: 4, fontWeight: 700 }} disabled={importing}>
          Importovat TOP 50 z TMDB
        </button>
      </div>
      {msg && <div style={{ marginBottom: 16, color: '#ff9000', fontWeight: 'bold', textAlign: 'center' }}>{msg}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: 40 }}>Načítám filmy...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 32,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {filtered.map(film => {
            const m = meta[film.id] || {};
            return (
              <div
                key={film.id}
                style={{
                  background: hovered === film.id ? '#232323' : '#181818',
                  borderRadius: 12,
                  boxShadow: hovered === film.id ? '0 8px 32px #a020f088, 0 2px 8px #000a' : '0 2px 8px #000a',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transform: hovered === film.id ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 0.18s cubic-bezier(.4,2,.6,1)',
                  cursor: 'pointer',
                  border: hovered === film.id ? '2px solid #ff9000' : '2px solid #232323',
                }}
                onMouseEnter={() => setHovered(film.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => openDetail(film)}
              >
                <img
                  src={posters[film.id] || PLACEHOLDER}
                  alt={film.nazev}
                  style={{ width: 260, height: 390, objectFit: 'cover', borderRadius: 0, marginBottom: 0, boxShadow: '0 2px 8px #000a', borderBottom: '2px solid #ff9000' }}
                />
                <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', textAlign: 'center', margin: '16px 0 4px 0', minHeight: 48 }}>{film.nazev}</div>
                <div style={{ color: '#ff9000', fontWeight: 700, marginBottom: 4, fontSize: 16 }}>{film.rok}</div>
                <div style={{ color: '#fff', fontSize: 15, marginBottom: 8, textAlign: 'center', minHeight: 36 }}>{film.zanr}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                  {m.tagy && m.tagy.map(tag => (
                    <span key={tag} style={{ background: '#222', color: '#ff9000', borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 700 }}>{tag}</span>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#fff', padding: 32, fontSize: 20 }}>Žádné filmy v databázi.</div>
          )}
        </div>
      )}
      {/* Modal detail */}
      {detail && (
        <div
          onClick={closeDetail}
          style={{
            position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeInBg .2s',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#181818', color: '#fff', borderRadius: 16, boxShadow: '0 8px 32px #000c', padding: 32, minWidth: 340, maxWidth: 600, width: '90vw', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', animation: 'zoomIn .22s',
            }}
          >
            <button onClick={closeDetail} style={{ position: 'absolute', top: 16, right: 16, background: '#222', color: '#ff9000', border: 'none', borderRadius: 20, fontWeight: 900, fontSize: 22, width: 36, height: 36, cursor: 'pointer', boxShadow: '0 2px 8px #000a' }}>×</button>
            <img src={detail.poster || PLACEHOLDER} alt={detail.nazev} style={{ width: 220, height: 330, objectFit: 'cover', borderRadius: 8, marginBottom: 16, boxShadow: '0 2px 8px #000a' }} />
            <div style={{ fontWeight: 900, fontSize: 28, color: '#fff', textAlign: 'center', marginBottom: 8 }}>{detail.nazev}</div>
            <div style={{ color: '#ff9000', fontWeight: 700, marginBottom: 8, fontSize: 18 }}>{detail.rok}</div>
            <div style={{ color: '#fff', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>{detail.zanr}</div>
            <div style={{ color: '#aaa', fontSize: 15, marginBottom: 16, textAlign: 'center' }}>{detail.popis}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {detail.tagy && detail.tagy.map(tag => (
                <span key={tag} style={{ background: '#222', color: '#ff9000', borderRadius: 4, padding: '4px 12px', fontSize: 15, fontWeight: 700 }}>{tag}</span>
              ))}
            </div>
            {detail.herci && detail.herci.length > 0 && (
              <div style={{ color: '#fff', fontSize: 15, marginBottom: 8, textAlign: 'center' }}>
                <b>Herci:</b> {detail.herci.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Animace pro modal */}
      <style>{`
        @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      <footer style={{ marginTop: 48, textAlign: 'center', color: '#ff9000', fontWeight: 700, fontSize: 18 }}>
        &copy; {new Date().getFullYear()} FilmHub
      </footer>
    </div>
  );
}

export default App;
