# Installer Cuisine de François

Comptez 45 minutes, sur un ordinateur, la première fois. Tout est gratuit. Vous aurez besoin de trois comptes : GitHub (hébergement de l'app), Supabase (base de données) et Google (clé Gemini, votre compte Gmail suffit).

Gardez un bloc-notes ouvert pour y coller au fur et à mesure : l'adresse de l'app, l'adresse du projet Supabase, la clé publishable Supabase, la clé Gemini.

## Étape 1. Mettre l'app sur GitHub

1. Créez un compte sur https://github.com (bouton Sign up).
2. En haut à droite, touchez le « + » puis « New repository ».
   - Repository name : `cuisine`
   - Laissez « Public » coché (GitHub Pages gratuit l'exige ; le code ne contient aucun secret et vos recettes ne sont pas dans le dépôt).
   - Ne cochez rien d'autre, puis « Create repository ».
3. Sur la page du dépôt vide, cliquez sur le lien « uploading an existing file ».
4. Décompressez le fichier zip sur votre ordinateur, ouvrez le dossier `cuisine-app`, sélectionnez tout son contenu (fichiers et dossiers, y compris `.github`) et faites-le glisser dans la page. Cliquez sur « Commit changes ».
   - Le dossier `.github` est caché sous Windows. S'il n'apparaît pas dans le dépôt après l'envoi, faites « Add file » puis « Create new file », tapez comme nom `.github/workflows/keepalive.yml`, collez le contenu du fichier du même nom, puis « Commit changes ».
5. Allez dans « Settings » puis « Pages ». Sous « Build and deployment », choisissez Source : « Deploy from a branch », Branch : « main » et « / (root) », puis « Save ».
6. Une à deux minutes plus tard, l'adresse de l'app s'affiche en haut de la même page, du type `https://votre-pseudo.github.io/cuisine/`. Notez-la. Si vous l'ouvrez maintenant, l'app affiche « Configuration à terminer » : c'est normal.

## Étape 2. Créer la base Supabase

1. Allez sur https://supabase.com, « Start your project », puis « Continue with GitHub ».
2. Créez un projet :
   - Name : `cuisine`
   - Database Password : choisissez-en un et notez-le (vous n'en aurez pas besoin dans l'app).
   - Region : une région en Europe (Paris si elle est proposée).
   - Plan : Free.
3. Attendez que le projet soit prêt (une à deux minutes).
4. Menu de gauche, « SQL Editor ». Collez tout le contenu du fichier `supabase/schema.sql`, puis « Run ». Le message attendu est « Success. No rows returned ».
5. Récupérez les deux valeurs de connexion (bouton « Connect » en haut de la page, ou Project Settings) :
   - l'adresse du projet, du type `https://abcdefgh.supabase.co`
   - la clé « Publishable key », qui commence par `sb_publishable_`. Si votre projet n'affiche que les anciennes clés, prenez la clé « anon public ».
   - Ne prenez jamais la clé « secret » ni « service_role » : elle donne un accès total à la base.
6. Sur GitHub, ouvrez le fichier `config.js` de votre dépôt, cliquez sur le crayon (Edit), remplacez les deux valeurs entre guillemets, puis « Commit changes ».

## Étape 3. Brancher Gemini

1. Allez sur https://aistudio.google.com avec votre compte Google, puis « Get API key » et « Create API key ». Copiez la clé. N'activez pas la facturation : la clé reste alors sur l'offre gratuite.
2. Dans Supabase, menu de gauche « Edge Functions », puis « Deploy a new function » et « Via Editor ».
   - Nommez la fonction exactement `import-recipe`.
   - Effacez le code d'exemple et collez tout le contenu du fichier `supabase/functions/import-recipe/index.ts`.
   - Laissez activée la vérification du jeton (« Verify JWT » / « Enforce JWT verification »).
   - Cliquez sur « Deploy function ».
3. Toujours dans « Edge Functions », ouvrez « Secrets » (ou Project Settings, puis Edge Functions), puis « Add new secret » :
   - Name : `GEMINI_API_KEY`
   - Value : la clé copiée à l'étape 3.1
   - Enregistrez.

## Étape 4. Créer votre compte, puis fermer les inscriptions

1. Dans Supabase, « Authentication », puis « Sign In / Providers », puis « Email » : désactivez « Confirm email » et enregistrez.
2. Dans « Authentication », puis « URL Configuration », mettez l'adresse de l'app (étape 1.6) dans « Site URL » et enregistrez.
3. Sur votre téléphone Android, ouvrez l'adresse de l'app dans Chrome. Saisissez votre e-mail et un mot de passe, puis touchez « Créer mon compte ».
4. Revenez dans Supabase, « Authentication », puis « Sign In / Providers » : désactivez « Allow new users to sign up » et enregistrez. Sans cela, n'importe qui trouvant l'adresse de l'app pourrait créer un compte et consommer votre quota Gemini.

## Étape 5. Installer l'app sur le téléphone

1. Dans Chrome, sur l'app ouverte, touchez le menu ⋮ puis « Installer l'application » (ou « Ajouter à l'écran d'accueil », puis « Installer »).
2. L'icône « Cuisine » apparaît avec vos autres applications.
3. Essai : dans Instagram, ouvrez un post de recette, touchez Partager, puis « Cuisine » (il faut parfois toucher « Plus » ou faire défiler la liste des applis). Si la légende ne peut pas être lue, faites une capture d'écran du post et partagez-la vers « Cuisine » depuis la galerie.
   - « Cuisine » n'apparaît dans le menu Partager que si l'app a été installée (étape 5.1), pas avec un simple raccourci.

## Étape 6. Empêcher la mise en pause de Supabase

Supabase met en pause un projet gratuit sans activité pendant 7 jours. Le dépôt contient une tâche qui interroge la base deux fois par semaine.

1. Sur GitHub, ouvrez l'onglet « Actions » de votre dépôt. Si GitHub le demande, cliquez sur « I understand my workflows, go ahead and enable them ».
2. Choisissez « Garder Supabase actif », puis « Run workflow ». Une coche verte confirme que tout fonctionne.
3. GitHub suspend ces tâches après 60 jours sans modification du dépôt et vous prévient par e-mail : il suffit de cliquer sur le lien pour la réactiver. Si le projet est quand même mis en pause, ouvrez-le dans Supabase et cliquez sur « Resume project » : vos données sont conservées.

## Mettre à jour l'app

- Fichiers de l'app (`index.html`, `app.js`, `style.css`…) : remplacez-les sur GitHub (« Add file », puis « Upload files »). Le téléphone prend la nouvelle version à l'ouverture suivante de l'app.
- Fonction d'import : dans Supabase, ouvrez `import-recipe`, recollez le nouveau code et redéployez.
- Si Google renomme ses modèles et que l'import affiche une erreur 404, ajoutez un secret `GEMINI_MODELS` avec les noms des modèles Flash du moment, séparés par des virgules (par exemple `gemini-3.8-flash,gemini-3.5-flash-lite`). La liste est sur https://ai.google.dev/models.

## En cas de problème

| Ce que vous voyez | Cause probable | Que faire |
| --- | --- | --- |
| « Configuration à terminer » | `config.js` pas encore rempli, ou GitHub pas encore à jour | Vérifier les deux valeurs, attendre deux minutes, recharger |
| « Adresse ou mot de passe incorrect » | faute de frappe | Recommencer ; sinon, réinitialiser le mot de passe dans Supabase, Authentication, Users |
| « Les inscriptions sont fermées » | étape 4.4 faite avant 4.3 | Réactiver temporairement les inscriptions, créer le compte, les refermer |
| « Le secret GEMINI_API_KEY manque » | étape 3.3 oubliée | Ajouter le secret |
| « Quota gratuit Gemini atteint » | trop d'imports dans la journée | Réessayer le lendemain, ou saisir la recette à la main |
| « La page ne laisse pas lire la recette » | Instagram ou Facebook bloquent la lecture | Partager une capture d'écran du post |
| « Pas de connexion au serveur » | pas de réseau, ou projet Supabase en pause | Vérifier le réseau, puis « Resume project » dans Supabase |
| « Cuisine » absent du menu Partager | app ajoutée comme raccourci | Supprimer le raccourci, réinstaller par « Installer l'application » |

## Sauvegarde

Dans l'app, l'icône des réglages (en haut de « Mes recettes ») permet de télécharger une sauvegarde de toutes vos recettes en fichier, et de la restaurer.
