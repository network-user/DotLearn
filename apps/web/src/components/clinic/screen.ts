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
  | { kind: 'person'; catalog: 'doctors' | 'patients'; id: string | null; copyFrom: string | null }
  | { kind: 'named'; catalog: 'offices' | 'services'; id: string | null; copyFrom: string | null }
  | { kind: 'appointment'; id: string | null; copyFrom: string | null }
  | {
      kind: 'reception';
      id: string | null;
      fromAppointmentId: string | null;
      copyFrom: string | null;
    }
  | { kind: 'register'; registrarId: string | null }
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

export const personScreen = (
  catalog: 'doctors' | 'patients',
  id: string | null,
  copyFrom: string | null = null,
): ClinicScreen => ({ kind: 'person', catalog, id, copyFrom });

export const namedScreen = (
  catalog: 'offices' | 'services',
  id: string | null,
  copyFrom: string | null = null,
): ClinicScreen => ({ kind: 'named', catalog, id, copyFrom });

export const appointmentScreen = (
  id: string | null,
  copyFrom: string | null = null,
): ClinicScreen => ({ kind: 'appointment', id, copyFrom });

export const receptionScreen = (
  id: string | null,
  fromAppointmentId: string | null = null,
  copyFrom: string | null = null,
): ClinicScreen => ({ kind: 'reception', id, fromAppointmentId, copyFrom });

export const registerScreen = (registrarId: string | null = null): ClinicScreen => ({
  kind: 'register',
  registrarId,
});
