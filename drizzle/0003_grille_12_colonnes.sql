-- La grille passe de 8 à 12 colonnes : les positions et largeurs enregistrées
-- sont multipliées par 1,5. On arrondit le bord gauche et le bord droit de
-- chaque widget (et non sa largeur), pour que deux widgets voisins le restent
-- sans se chevaucher.
UPDATE "widget"
SET "x" = round("x" * 1.5),
    "w" = greatest(1, round(("x" + "w") * 1.5) - round("x" * 1.5));
