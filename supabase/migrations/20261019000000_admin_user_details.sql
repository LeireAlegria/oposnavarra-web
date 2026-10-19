-- Expose only the account fields needed by the admin user list.
CREATE FUNCTION public.list_admin_users()
RETURNS TABLE (
  id uuid,
  rol text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exigir_rol_admin();
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Debes verificar tu correo.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.rol, u.email::text, u.created_at, u.last_sign_in_at
    FROM public.perfiles p
    JOIN auth.users u ON u.id = p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
