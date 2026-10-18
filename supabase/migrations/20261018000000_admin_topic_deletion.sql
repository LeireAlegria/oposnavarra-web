ALTER TABLE public.convocatoria_tema
  DROP CONSTRAINT convocatoria_tema_tema_id_fkey,
  ADD CONSTRAINT convocatoria_tema_tema_id_fkey
    FOREIGN KEY (tema_id) REFERENCES public.temas (id) ON DELETE RESTRICT;

ALTER TABLE public.pregunta_tema
  DROP CONSTRAINT pregunta_tema_tema_id_fkey,
  ADD CONSTRAINT pregunta_tema_tema_id_fkey
    FOREIGN KEY (tema_id) REFERENCES public.temas (id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.eliminar_tema_admin(p_tema_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exigir_rol_admin();

  PERFORM 1
  FROM public.temas
  WHERE id = p_tema_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el tema que quieres eliminar.'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.convocatoria_tema WHERE tema_id = p_tema_id
  ) OR EXISTS (
    SELECT 1 FROM public.pregunta_tema WHERE tema_id = p_tema_id
  ) OR EXISTS (
    SELECT 1 FROM public.test_intento_temas WHERE tema_id = p_tema_id
  ) THEN
    RAISE EXCEPTION
      'No se puede eliminar el tema porque está asociado a convocatorias, preguntas o tests realizados. Puedes desactivarlo en su lugar.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.temas WHERE id = p_tema_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_tema_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_tema_admin(uuid) TO authenticated;
