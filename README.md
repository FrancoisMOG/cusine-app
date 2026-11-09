# Cuisine de François

Carnet de recettes personnel installable sur Android : import depuis un lien, une capture d'écran ou un texte (lu par Gemini), cookbooks, mode cuisine, planning de la semaine et liste de courses.

- App web hébergée sur GitHub Pages (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`)
- Données et comptes : Supabase (`supabase/schema.sql`)
- Import : fonction Supabase `import-recipe` qui appelle l'API Gemini (`supabase/functions/import-recipe/index.ts`)

Installation pas à pas : voir `GUIDE-INSTALLATION.md`.
