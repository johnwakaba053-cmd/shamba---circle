# Shamba Circle

Community app for East African farmers — discussion channels, market prices,
weather/planting guidance, disease alerts, and an insurance info page.

## Running it on your laptop

1. Open this folder in VS Code (`File > Open Folder`)
2. Open a terminal in VS Code (`Terminal > New Terminal`)
3. Run: `npm install`
4. Run: `npm run dev`
5. Open the link it shows (usually http://localhost:5173) in Chrome

## Storage note

This version stores data in your browser's `localStorage` as a placeholder —
it only persists on your own laptop/browser. When we're ready for real
shared data across farmers, we'll swap this for Supabase (a free hosted
database). The storage functions are isolated in `src/store.js` so that
swap will be a small, contained change.

## Publishing it live (so others can test it)

1. Create a new empty repo on GitHub (no README/gitignore — we already have them)
2. In the terminal, from this folder:
   ```
   git init
   git add .
   git commit -m "Initial Shamba Circle project"
   git branch -M main
   git remote add origin <your-empty-repo-URL>
   git push -u origin main
   ```
3. Go to vercel.com → "Add New Project" → import this GitHub repo → Deploy
4. Vercel will give you a live link (e.g. shamba-circle.vercel.app) you can share


## Installing on a phone (PWA)

Once deployed on Vercel:
- **Android (Chrome):** open the live link, tap the menu (⋮), choose "Install app" or "Add to Home screen".
- **iPhone (Safari):** open the live link, tap the Share icon, choose "Add to Home Screen".

Both give you a home-screen icon that opens full-screen, like a native app —
no App Store or Play Store needed. Replace public/icon-192.png and
public/icon-512.png with real app icons before sharing this widely; those
files are placeholders referenced by manifest.webmanifest.
