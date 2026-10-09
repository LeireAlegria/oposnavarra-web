CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol)
  VALUES (NEW.id, 'usuario')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER perfiles_set_updated_at
BEFORE UPDATE ON public.perfiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

CREATE OR REPLACE FUNCTION public.ensure_missing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol)
  SELECT au.id, 'usuario'
  FROM auth.users au
  LEFT JOIN public.perfiles p ON p.id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END;
$$;

SELECT public.ensure_missing_profiles();

CREATE POLICY "Los usuarios solo ven su perfil propio"
ON public.perfiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Ningún usuario puede crear perfiles"
ON public.perfiles
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Ningún usuario puede actualizar perfiles"
ON public.perfiles
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Ningún usuario puede eliminar perfiles"
ON public.perfiles
FOR DELETE
USING (false);
