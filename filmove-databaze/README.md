# FilmHub

Moderní filmová databáze s krásným UI, vyhledáváním, žánrovými filtry a detaily filmů. Backend v Node.js (Express, SQLite), frontend v Reactu.

## Spuštění v Docker Compose

1. Ujistěte se, že máte nainstalovaný Docker a Docker Compose.
2. V kořenové složce projektu spusťte:
   ```bash
   docker compose up --build
   ```
3. Frontend poběží na [http://localhost:3001](http://localhost:3001), backend API na [http://localhost:3000](http://localhost:3000).

## Funkce
- Vyhledávání filmů, filtrování podle žánru
- Detail filmu s popisem, žánry, herci
- Import filmů z TMDB (včetně TOP 50)
- Moderní UI ve stylu FilmHub

## Složky
- `filmove-databaze` — backend (Node.js, Express, SQLite)
- `filmove-databaze-ui` — frontend (React)

## API endpoints

- `GET /api/filmy` — seznam všech filmů
- `POST /api/filmy` — přidání filmu (JSON: nazev, rok, reziser, zanr)
- `GET /api/filmy/:id` — detail filmu
- `PUT /api/filmy/:id` — úprava filmu
- `DELETE /api/filmy/:id` — smazání filmu

## Struktura tabulky `filmy`
- `id` (INTEGER, PK, autoincrement)
- `nazev` (TEXT, povinný)
- `rok` (INTEGER)
- `reziser` (TEXT)
- `zanr` (TEXT) 