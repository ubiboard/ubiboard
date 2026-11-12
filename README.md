# UbiBoard

Hub familial open source, web et auto-hébergeable : un écran d'accueil façon Android, fait de widgets
redimensionnables et configurables, pensé pour un écran mural tactile mais accessible aussi depuis un PC,
une tablette ou un téléphone.

> Projet à ses débuts. Les widgets affichent pour l'instant des **données factices** : aucun connecteur
> (agenda, météo, école, domotique) n'est encore branché.

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
- **Vue téléphone** (lecture seule) : mêmes widgets empilés, avec une barre d'onglets.
- **Boutique de plugins** (`/boutique`) : vitrine statique et format de manifeste proposé.
- Persistance en `localStorage` (propre à chaque navigateur, en attendant un backend).

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Organisation du code

| Chemin | Rôle |
|---|---|
| `app/` | Pages Next.js (App Router) : accueil, boutique, styles globaux |
| `components/Board.tsx` | Grille, modes lecture/édition, tiroir d'ajout, modales, vue téléphone |
| `components/widgets/` | Un fichier par widget, plus `index.ts` qui les enregistre tous |
| `lib/widgets.tsx` | Registre central et types d'un widget |
| `lib/demo-data.ts` | Données factices |
| `lib/hooks.ts` | Horloge partagée et état persistant |

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
  Component: MonWidget, // reçoit { w, h, bodyHeight, options }
});
```

Il suffit ensuite de l'importer dans `components/widgets/index.ts` : il apparaît dans le tiroir d'ajout et
dans la boutique, avec sa modale de réglages.

## Feuille de route

1. Persistance côté serveur, pour partager la disposition et les données entre appareils.
2. Premier vrai connecteur : calendrier (Google Calendar, CalDAV).
3. Module corvées : rotations de rôles, responsabilités cochables ou non.
4. Emplois du temps scolaires (Pronote, Ecole Directe), météo réelle.
5. Plugins communautaires isolés, décrits par un manifeste.
6. Home Assistant et serveur MCP.

## Stack

Next.js (App Router), TypeScript, react-grid-layout v2.

## Licence

[AGPL-3.0-or-later](LICENSE).
