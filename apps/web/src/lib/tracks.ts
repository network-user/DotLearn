export interface Track {
  id: string;
  title: string;
  description: string;
  targetRole?: string;
  topicSlugs: string[];
  optionalSlugs?: string[];
}

export const tracks: readonly Track[] = [
  {
    id: 'python-backend',
    title: 'Python backend',
    description:
      'От объектной модели Python к продакшен-сервисам: декораторы, контекст-менеджеры, FastAPI, ORM и фоновые задачи на брокерах.',
    targetRole: 'Backend-разработчик',
    topicSlugs: [
      'python-oop',
      'python-decorators',
      'python-context-managers',
      'python-concurrency',
      'fastapi',
      'python-orm',
      'celery',
      'message-brokers',
    ],
  },
  {
    id: 'ml-llm',
    title: 'ML/LLM foundations',
    description:
      'Базовый трек по машинному обучению и языковым моделям: нейросети, основы LLM, инженерия промптов и детекция объектов.',
    targetRole: 'ML-инженер',
    topicSlugs: ['neural-networks', 'llm-foundations', 'prompt-engineering', 'yolo-detection'],
  },
  {
    id: 'python-deep-dive',
    title: 'Python language deep-dive',
    description:
      'Внутренности языка Python: точка входа, walrus-оператор, типизация через TypeVar, MRO и устройство хранения объектов.',
    targetRole: 'Senior Python',
    topicSlugs: [
      'python-main-guard',
      'python-walrus',
      'python-iterators-generators',
      'python-dataclasses',
      'python-typevar',
      'python-mro',
      'python-storage-internals',
    ],
  },
  {
    id: 'backend-systems',
    title: 'Backend systems',
    description:
      'Системный взгляд на бэкенд: типы баз данных, SQL, CORS, реалтайм через WebSocket, аутентификация Keycloak и чистая архитектура.',
    targetRole: 'Backend / Platform',
    topicSlugs: [
      'database-types',
      'sql-fundamentals',
      'db-indexes',
      'db-scaling',
      'cors',
      'websockets-realtime',
      'keycloak',
      'clean-architecture',
    ],
  },
];

export const getTrack = (id: string): Track | undefined => tracks.find((track) => track.id === id);

export const trackMemberSlugs = (track: Track): string[] => [
  ...track.topicSlugs,
  ...(track.optionalSlugs ?? []),
];
