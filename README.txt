TRIPSPLIT

Files:
- index.html
- style.css
- app.js
- manifest.json
- sw.js

Current features:
- Create Trip
- Join Trip by code (local demo storage)
- Add unlimited members
- Add expenses
- Equal split
- Custom split
- Paid by any member
- Edit/delete expenses
- Total expense
- Per-member balance
- Automatic minimum settlement: who pays whom
- Share/copy trip code
- PWA manifest + service worker
- Mobile-first app UI

Important:
Supabase is intentionally NOT connected yet. Until Supabase is connected, data is stored in the browser's localStorage, so joining a trip from another phone will not work.

Run with VS Code Live Server. Do not open index.html only with file:// if you want PWA/service-worker features.
