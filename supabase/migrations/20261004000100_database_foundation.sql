CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.convocatorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  organismo_convocante text,
  ambito text,
  categoria text,
  grupo text,
  fuente_oficial_url text,
  informacion_url text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.convocatoria_tema (
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias (id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas (id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  orden integer NOT NULL CHECK (orden > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (convocatoria_id, tema_id),
  UNIQUE (convocatoria_id, numero),
  UNIQUE (convocatoria_id, orden)
);

CREATE TABLE public.examenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha date,
  descripcion text,
  url_examen text,
  url_plantilla_respuestas text,
  es_oficial boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.convocatoria_examen (
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias (id) ON DELETE CASCADE,
  examen_id uuid NOT NULL REFERENCES public.examenes (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (convocatoria_id, examen_id)
);

CREATE TABLE public.preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examen_id uuid REFERENCES public.examenes (id) ON DELETE SET NULL,
  numero integer CHECK (numero IS NULL OR numero > 0),
  enunciado text NOT NULL,
  explicacion text,
  estado text NOT NULL DEFAULT 'revision' CHECK (estado IN ('revision', 'publicada', 'desactivada')),
  origen text NOT NULL DEFAULT 'propia' CHECK (origen IN ('oficial', 'propia')),
  situacion text NOT NULL DEFAULT 'ordinaria' CHECK (situacion IN ('ordinaria', 'reserva', 'anulada')),
  fuente_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (examen_id, numero)
);

CREATE TABLE public.respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES public.preguntas (id) ON DELETE CASCADE,
  orden integer NOT NULL CHECK (orden BETWEEN 1 AND 4),
  texto text NOT NULL,
  es_correcta boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pregunta_id, orden)
);

CREATE TABLE public.pregunta_tema (
  pregunta_id uuid NOT NULL REFERENCES public.preguntas (id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pregunta_id, tema_id)
);

CREATE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER convocatorias_set_updated_at
BEFORE UPDATE ON public.convocatorias
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER temas_set_updated_at
BEFORE UPDATE ON public.temas
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER examenes_set_updated_at
BEFORE UPDATE ON public.examenes
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER preguntas_set_updated_at
BEFORE UPDATE ON public.preguntas
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER respuestas_set_updated_at
BEFORE UPDATE ON public.respuestas
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE FUNCTION private.assert_pregunta_publicable(p_pregunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  pregunta_estado text;
  total_respuestas bigint;
  respuestas_correctas bigint;
BEGIN
  SELECT estado
  INTO pregunta_estado
  FROM public.preguntas
  WHERE id = p_pregunta_id;

  IF NOT FOUND OR pregunta_estado <> 'publicada' THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE es_correcta)
  INTO total_respuestas, respuestas_correctas
  FROM public.respuestas
  WHERE pregunta_id = p_pregunta_id;

  IF total_respuestas <> 4 OR respuestas_correctas <> 1 THEN
    RAISE EXCEPTION 'Una pregunta publicada debe tener cuatro respuestas y exactamente una correcta.'
      USING ERRCODE = '23514', CONSTRAINT = 'preguntas_publicadas_respuestas_validas';
  END IF;
END;
$$;

CREATE FUNCTION private.check_pregunta_publicable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM private.assert_pregunta_publicable(OLD.id);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    PERFORM private.assert_pregunta_publicable(NEW.id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION private.check_respuesta_pregunta_publicable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM private.assert_pregunta_publicable(OLD.pregunta_id);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    PERFORM private.assert_pregunta_publicable(NEW.pregunta_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER preguntas_publicadas_respuestas_validas
AFTER INSERT OR UPDATE OR DELETE ON public.preguntas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.check_pregunta_publicable();

CREATE CONSTRAINT TRIGGER respuestas_pregunta_publicada_valida
AFTER INSERT OR UPDATE OR DELETE ON public.respuestas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.check_respuesta_pregunta_publicable();