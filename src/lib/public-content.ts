export type SubscriptionPlan = {
  code: 'mensual' | 'semestral' | 'anual';
  name: string;
  priceCents: number;
  durationMonths: number;
  description: string;
  renewal: string;
};

export type PublicExamination = {
  id: string;
  name: string;
  summary: string;
  status: 'Disponible en la plataforma' | 'En preparación';
  topics: string[];
  availableFrom?: string;
};

export const featuredExamination: PublicExamination = {
  id: 'administrativo-navarra',
  name: 'Administrativo de Navarra',
  summary:
    'Preparación para la convocatoria de Administrativo de Navarra, con contenido orientado a la práctica y la revisión de resultados.',
  status: 'Disponible en la plataforma',
  topics: ['Administración general', 'Derecho administrativo', 'Informática', 'Navarra y servicio público'],
  availableFrom: 'MVP',
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    code: 'mensual',
    name: 'Mensual',
    priceCents: 1500,
    durationMonths: 1,
    description: 'Acceso mensual para comenzar a estudiar sin compromiso.',
    renewal: 'Automática cada mes',
  },
  {
    code: 'semestral',
    name: 'Semestral',
    priceCents: 7900,
    durationMonths: 6,
    description: 'La mejor opción para una preparación más continua.',
    renewal: 'Automática cada 6 meses',
  },
  {
    code: 'anual',
    name: 'Anual',
    priceCents: 12000,
    durationMonths: 12,
    description: 'La modalidad más completa para avanzar durante todo el curso.',
    renewal: 'Automática cada año',
  },
];

export const homeFeatures = [
  'Test por temas con una configuración flexible.',
  'Selección de número de preguntas y tiempo.',
  'Elección de temas, con todos seleccionados por defecto.',
  'Revisión del resultado y un historial sencillo.',
];

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
