-- Associations must be removed explicitly before deleting a convocation.
ALTER TABLE public.convocatoria_tema
  DROP CONSTRAINT convocatoria_tema_convocatoria_id_fkey,
  ADD CONSTRAINT convocatoria_tema_convocatoria_id_fkey FOREIGN KEY (convocatoria_id)
    REFERENCES public.convocatorias(id) ON DELETE RESTRICT;
ALTER TABLE public.convocatoria_examen
  DROP CONSTRAINT convocatoria_examen_convocatoria_id_fkey,
  ADD CONSTRAINT convocatoria_examen_convocatoria_id_fkey FOREIGN KEY (convocatoria_id)
    REFERENCES public.convocatorias(id) ON DELETE RESTRICT;

CREATE FUNCTION public.eliminar_convocatoria_admin(p_convocatoria_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.exigir_rol_admin();
  PERFORM 1 FROM public.convocatorias WHERE id = p_convocatoria_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la convocatoria que quieres eliminar.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.convocatoria_tema WHERE convocatoria_id = p_convocatoria_id)
    OR EXISTS (SELECT 1 FROM public.convocatoria_examen WHERE convocatoria_id = p_convocatoria_id) THEN
    RAISE EXCEPTION 'No se puede eliminar la convocatoria porque tiene temas o exámenes asociados. Desvincúlalos primero o desactiva la convocatoria.' USING ERRCODE = '23503';
  END IF;
  BEGIN
    DELETE FROM public.convocatorias WHERE id = p_convocatoria_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'No se puede eliminar la convocatoria porque tiene registros dependientes, como tests o retos. Puedes desactivarla en su lugar.' USING ERRCODE = '23503';
  END;
END $$;
REVOKE ALL ON FUNCTION public.eliminar_convocatoria_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_convocatoria_admin(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
