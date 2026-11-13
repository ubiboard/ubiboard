# UbiBoard

Hub familial open source, web et auto-hébergeable : un écran d'accueil façon Android, fait de widgets
redimensionnables et configurables, pensé pour un écran mural tactile mais accessible aussi depuis un PC,
une tablette ou un téléphone.

> Projet à ses débuts. La liste de courses et le mot de la famille sont réels et enregistrés en base ; les
> autres widgets affichent encore des **données factices** : aucun connecteur (agenda, météo, école,
> domotique) n'est branché.

## Ce qui fonctionne

- **Écran d'accueil** sur une grille de 8 colonnes, en noir pur (pensé pour l'OLED).
- **Deux modes** :
  - *lecture* : rien ne bouge, seuls les contenus sont interactifs (cocher un article, écrire un mot) ;
  - *édition* (bouton crayon) : placement libre des widgets par glisser-déposer, redimensionnement par le
    coin inférieur droit, ajout, suppression et configuration. Rien n'est enregistré tant qu'on n'a pas
    cliqué **Enregistrer** ; **Annuler** jette le brouillon.
- **Sept widgets par défaut** : Horloge, Météo, Calendrier, Corvées, Courses, Emploi du temps, Mot de la famille.
  Chacun adapte son affichage à sa taille.
- **Configuration par widget** dans une modale générée depuis la définition du widget.
- **Réglages d'écran** : atténuation et anti-rémanence.
- **Vue téléphone** : mêmes widgets empilés, avec une barre d'onglets (sans mode édition).
- **Boutique de plugins** (`/boutique`) : vitrine statique et format de manifeste proposé.
- **Comptes et connexion** : un compte par personne, sans inscription publique (comptes créés en ligne de commande).
- **Enregistrement en base** : la disposition du board et les données des widgets sont stockées dans PostgreSQL
  et partagées entre les appareils.
- **Rôles** : un administrateur du board modifie la disposition ; un membre utilise les widgets.

## Démarrer

Il faut Node.js 20.6 ou plus récent et une base PostgreSQL (par exemple [Neon](https://neon.com), offre gratuite).

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Copier `.env.example` en `.env.local` et renseigner `DATABASE_URL` et `BETTER_AUTH_SECRET`.

3. Créer les tables :

   ```bash
   npm run db:migrate
   ```

4. Créer un compte (le mot de passe est demandé au clavier) :

   ```bash
   npm run user:create -- vous@exemple.org "Votre nom"
   ```

5. Lancer l'appli, puis ouvrir http://localhost:3000 :

   ```bash
   npm run dev
   ```

À la première connexion, un board « Maison » est créé pour le compte.

### Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run user:create -- <email> "<nom>"` | Créer un compte |
| `npm run user:password -- <email>` | Changer un mot de passe |
| `npm run user:list` | Lister les comptes |
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

Il suffit ensuite de l'importer dans `components/widgets/index.ts` : il apparaît dans le tiroir d'ajout et
dans la boutique, avec sa modale de réglages.

## Feuille de route

1. Plusieurs boards par compte, partage entre membres et administrateurs.
2. Lien public en lecture seule, vues personnelles, appairage d'un écran mural par code.
3. Premier vrai connecteur : calendrier (Google Calendar, CalDAV).
4. Module corvées : rotations de rôles, responsabilités cochables ou non.
5. Emplois du temps scolaires (Pronote, Ecole Directe), météo réelle.
6. Plugins communautaires isolés, décrits par un manifeste.
7. Home Assistant et serveur MCP.

## Stack

Next.js (App Router), TypeScript, react-grid-layout v2, PostgreSQL avec Drizzle ORM, Better Auth.

## Licence

[AGPL-3.0-or-later](LICENSE).
