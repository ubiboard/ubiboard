-- La météo est maintenant affichée par le widget « Horloge et météo » :
-- le widget Météo séparé n'existe plus. Il n'avait aucune donnée propre.

-- Une vue qui avait la météo sans l'horloge garde sa météo : son premier
-- widget Météo devient le widget fusionné, à la même place.
UPDATE "widget" AS w
SET "type" = 'clock',
    "show_title" = false,
    "options" = w."options" || '{"secs":"off","weather":"on"}'::jsonb
WHERE w."type" = 'weather'
  AND NOT EXISTS (SELECT 1 FROM "widget" c WHERE c."view_id" = w."view_id" AND c."type" = 'clock')
  AND w."id" = (
    SELECT m."id" FROM "widget" m
    WHERE m."view_id" = w."view_id" AND m."type" = 'weather'
    ORDER BY m."y", m."x" LIMIT 1
  );
--> statement-breakpoint
-- Les widgets Météo restants font doublon avec l'horloge de leur vue.
DELETE FROM "widget" WHERE "type" = 'weather';
