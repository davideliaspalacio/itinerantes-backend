-- El portal vive en su propio dominio (portal.itinerantesdelagua.com) y sus rutas no llevan el
-- prefijo /portal. Corrige los botones de las notificaciones ya guardadas:
-- "/portal" → "/" y "/portal/x" → "/x".
UPDATE "notifications"
SET "action_path" = CASE
  WHEN "action_path" = '/portal' THEN '/'
  ELSE substring("action_path" FROM 8)
END
WHERE "action_path" = '/portal' OR "action_path" LIKE '/portal/%';
