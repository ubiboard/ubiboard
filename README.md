# UbiBoard

Hub familial open source, web et auto-hébergeable : un écran d'accueil façon Android, fait de widgets
redimensionnables et configurables, pensé pour un écran mural tactile mais accessible aussi depuis un PC,
une tablette ou un téléphone.

> Projet à ses débuts. Le calendrier, les tâches, l'emploi du temps, la liste de courses et le mot de la
> famille sont réels ; seule la météo affiche encore des **données factices**.

## Ce qui fonctionne

- **Écran d'accueil** sur une grille de 8 colonnes, en noir pur (pensé pour l'OLED).
- **Deux modes** :
  - *lecture* : rien ne bouge, seuls les contenus sont interactifs (cocher un article, écrire un mot) ;
  - *édition* (bouton crayon) : placement libre des widgets par glisser-déposer, redimensionnement par le
    coin inférieur droit, ajout, suppression et configuration. Rien n'est enregistré tant qu'on n'a pas
    cliqué **Enregistrer** ; **Annuler** jette le brouillon.
- **Sept widgets par défaut** : Horloge, Météo, Calendrier, Tâches, Courses, Emploi du temps, Mot de la famille.
  Chacun adapte son affichage à sa taille.
- **Tâches** : ponctuelles ou récurrentes (chaque N jours, semaines, mois ou années), affectées à une ou plusieurs
  personnes avec roulement automatique. Le widget montre qui doit faire quoi aujourd'hui.
- **Calendrier** : un ou plusieurs agendas connectés par leur lien iCal (Google Agenda, Outlook, iCloud,
  CalDAV…), chacun avec sa couleur. Quatre vues : mois, semaine, jour, liste. Lecture seule. Les liens sont
  chiffrés en base et lus uniquement par le serveur.
- **Emploi du temps** : des créneaux saisis à la main pour chaque jour de la semaine, avec une couleur de fond.
  Les créneaux à la même heure sont alignés d'un jour à l'autre, et les trous communs sont réduits.
- **Configuration par widget** dans une modale générée depuis la définition du widget.
- **Réglages d'écran** : atténuation et anti-rémanence.
- **Vue téléphone** : mêmes widgets empilés, avec une barre d'onglets (sans mode édition).
- **Boutique de plugins** (`/boutique`) : vitrine statique et format de manifeste proposé.
- **Comptes et connexion** : un compte par personne, sans inscription publique (comptes créés en ligne de
  commande). On se connecte avec un identifiant court ; l'adresse e-mail est facultative. La session dure 90 jours.
- **Enregistrement en base** : la disposition du board et les données des widgets sont stockées dans PostgreSQL
  et partagées entre les appareils.
- **Rôles** : un administrateur du board modifie la disposition ; un membre utilise les widgets.
- **Personnes** : plusieurs comptes peuvent partager un board, chacun avec sa couleur (ajout en ligne de commande
  pour l'instant).

## Démarrer

Il faut Node.js 20.6 ou plus récent et une base PostgreSQL (par exemple [Neon](https://neon.com), offre gratuite).

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Copier `.env.example` en `.env.local` et renseigner `DATABASE_URL`, `BETTER_AUTH_SECRET` et
   `DATA_ENCRYPTION_KEY`.

3. Créer les tables :

   ```bash
   npm run db:migrate
   ```

4. Créer un compte (le mot de passe est demandé au clavier) :

   ```bash
   npm run user:create -- identifiant "Votre nom"
   ```

5. Lancer l'appli, puis ouvrir http://localhost:3000 :

   ```bash
   npm run dev
   ```

À la première connexion, un board « Maison » est créé pour le compte. Un compte ajouté à un autre board voit
celui qu'il a rejoint en dernier.

### Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run user:create -- <identifiant> "<nom>" [email]` | Créer un compte |
| `npm run user:password -- <identifiant>` | Changer un mot de passe |
| `npm run user:username -- <identifiant> <nouvel identifiant>` | Changer un identifiant de connexion |
| `npm run user:list` | Lister les comptes |
| `npm run board:list` | Lister les boards et leurs personnes |
| `npm run board:add -- <identifiant> <identifiant d'un admin du board> [membre\|admin]` | Ajouter un compte existant à un board, ou changer son rôle |
| `npm run board:remove -- <identifiant> <identifiant d'un admin du board>` | Retirer quelqu'un d'un board |
| `npm run db:generate` | Générer une migration après une modification de `lib/db/schema.ts` |
| `npm run db:migrate` | Appliquer les migrations |

## Organisation du code

| Chemin | Rôle |
|---|---|
| `app/` | Pages Next.js (App Router) : accueil, boutique, styles globaux |
| `components/Board.tsx` | Grille, modes lecture/édition, tiroir d'ajout, modales, vue téléphone |
| `components/widgets/` | Un fichier par widget, plus `index.ts` qui les enregistre tous |
| `lib/widgets.tsx` | Registre central et types d'un widget |
| `lib/board-context.tsx` | Accès des widgets à leurs données (`useWidgetData`) |
| `lib/db/schema.ts` | Schéma de la base (comptes, boards, vues, widgets, données) |
| `lib/boards.ts`, `app/actions.ts` | Lecture et enregistrement côté serveur, contrôle des droits |
| `lib/auth.ts`, `scripts/user.ts` | Connexion (Better Auth) et gestion des comptes en ligne de commande |
| `scripts/board.ts` | Ajout et retrait de personnes sur un board en ligne de commande |
| `lib/tasks.ts` | Récurrence et roulement des tâches (calcul et phrases en clair) |
| `lib/timetable.ts` | Créneaux de l'emploi du temps et calcul de leur position |
| `lib/calendar.ts`, `lib/calendar-server.ts` | Calendrier : types et dates ; lecture et dépliage des agendas iCal côté serveur |
| `lib/data-policy.ts`, `lib/crypto.ts` | Règles par type de widget (écriture réservée, champs secrets) et chiffrement des secrets |
| `lib/demo-data.ts` | Données factices |

## Ajouter un widget

Un widget est un fichier dans `components/widgets/` qui s'enregistre dans le registre :

```tsx
registerWidget({
  type: "mon-widget",
  name: "Mon widget",
  description: "Ce qu'il affiche.",
  source: "default",
  access: "aucun",
  sizes: { min: [2, 1], default: [2, 2], max: [4, 3] }, // [colonnes, lignes]
  options: [
    { key: "mode", label: "Mode", choices: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
  ],
  defaultOptions: { mode: "a" },
  defaultShowTitle: true,
  title: () => "Mon widget",
  Component: MonWidget, // reçoit { w, h, bodyHeight, options, dataId }
});
```

Un widget qui enregistre des données déclare `storesData: true` et utilise `useWidgetData(dataId)` : il obtient
sa liste d'éléments (un objet JSON par élément, de la forme qu'il veut) et les fonctions `add`, `update` et
`remove`. Aucune table ni migration à ajouter. Voir `ShoppingWidget.tsx`.

Les personnes du board (nom, couleur, rôle) sont disponibles dans tout widget avec `useBoard().people`. Un
réglage peut proposer ces personnes avec `choices: "people"`.

Un widget dont les données se gèrent dans une grande fenêtre (créer, modifier, supprimer) fournit un composant
`Manager` : il s'affiche dans la configuration du widget, en mode édition. Voir `TasksWidget.tsx` et
`TasksManager.tsx`. Les règles côté serveur d'un type de widget se déclarent dans `lib/data-policy.ts` : écriture
réservée aux administrateurs, champs secrets jamais renvoyés au navigateur, validation avant enregistrement.

Un réglage que tout membre peut changer depuis le widget (un type de vue, par exemple) passe par `setOption` et
doit être déclaré dans `USAGE_OPTIONS` (`app/actions.ts`).

Il suffit ensuite de l'importer dans `components/widgets/index.ts` : il apparaît dans le tiroir d'ajout et
dans la boutique, avec sa modale de réglages.

## Feuille de route

1. Plusieurs boards par compte, partage entre membres et administrateurs.
2. Lien public en lecture seule, vues personnelles, appairage d'un écran mural par code.
3. Synchronisation des emplois du temps scolaires (Ecole Directe, Pronote), météo réelle.
4. Rappels et alertes.
5. Plugins communautaires isolés, décrits par un manifeste.
6. Home Assistant et serveur MCP.

## Stack

Next.js (App Router), TypeScript, react-grid-layout v2, PostgreSQL avec Drizzle ORM, Better Auth.

## Licence

[AGPL-3.0-or-later](LICENSE).
