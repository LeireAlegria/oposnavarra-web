-- Deferred constraint triggers run after the importing SECURITY DEFINER RPC returns.
-- Keep private schema access inside the trigger functions rather than granting it to clients.
ALTER FUNCTION private.check_pregunta_publicable() SECURITY DEFINER;
ALTER FUNCTION private.check_respuesta_pregunta_publicable() SECURITY DEFINER;

REVOKE ALL ON FUNCTION private.check_pregunta_publicable(),
  private.check_respuesta_pregunta_publicable() FROM PUBLIC, anon, authenticated;
