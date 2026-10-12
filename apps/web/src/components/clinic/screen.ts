export type ListObject =
  | 'doctors'
  | 'offices'
  | 'patients'
  | 'services'
  | 'appointments'
  | 'receptions';

export type ClinicScreen =
  | { kind: 'home' }
  | { kind: 'list'; object: ListObject }
  | { kind: 'person'; catalog: 'doctors' | 'patients'; id: string | null }
  | { kind: 'named'; catalog: 'offices' | 'services'; id: string | null }
  | { kind: 'appointment'; id: string | null }
  | { kind: 'reception'; id: string | null; fromAppointmentId: string | null }
  | { kind: 'register' }
  | { kind: 'report' }
  | { kind: 'chart' };

export const sectionOf = (screen: ClinicScreen): string => {
  switch (screen.kind) {
    case 'home':
      return 'home';
    case 'list':
      return screen.object;
    case 'person':
      return screen.catalog;
    case 'named':
      return screen.catalog;
    case 'appointment':
      return 'appointments';
    case 'reception':
      return 'receptions';
    default:
      return screen.kind;
  }
};

export const listScreen = (object: ListObject): ClinicScreen => ({ kind: 'list', object });
