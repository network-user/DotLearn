import { describe, expect, it } from 'vitest';

import { ClinicError } from './errors';
import {
  demoClinic,
  doctorLoad,
  emptyClinic,
  parseClinicState,
  personName,
  saveAppointment,
  saveNamed,
  savePerson,
  saveReception,
  toggleAppointmentMark,
  toggleCatalogMark,
  toggleReceptionMark,
  workloadTable,
  type ClinicState,
  type ReceptionDraft,
} from './state';

const stamp = '2026-05-09T10:00';

const clinic = () => {
  let state = emptyClinic();
  const doctor = savePerson(state, 'doctors', {
    id: null,
    lastName: ' Иванов ',
    firstName: 'Иван',
    middleName: '',
  });
  state = doctor.state;
  const patient = savePerson(state, 'patients', {
    id: null,
    lastName: 'Козлова',
    firstName: '',
    middleName: '',
  });
  state = patient.state;
  const office = saveNamed(state, 'offices', { id: null, name: ' 1 ' });
  state = office.state;
  const service = saveNamed(state, 'services', { id: null, name: 'Осмотр' });
  state = service.state;
  const extra = saveNamed(state, 'services', { id: null, name: 'Анализ состояния' });
  state = extra.state;
  const appointment = saveAppointment(state, {
    id: null,
    createdAt: stamp,
    patientId: patient.id,
    visitDate: '2026-05-09',
    doctorId: doctor.id,
    officeId: office.id,
  });
  return {
    state: appointment.state,
    doctorId: doctor.id,
    patientId: patient.id,
    officeId: office.id,
    serviceId: service.id,
    extraServiceId: extra.id,
    appointmentId: appointment.id,
  };
};

const draft = (
  base: ReturnType<typeof clinic>,
  lines: ReceptionDraft['lines'] = [{ serviceId: base.serviceId, quantity: 1, price: 3000 }],
  duration = 48,
): ReceptionDraft => ({
  id: null,
  createdAt: stamp,
  appointmentId: base.appointmentId,
  duration,
  lines,
});

const posted = (base: ReturnType<typeof clinic> = clinic()): ClinicState =>
  saveReception(base.state, draft(base), 'post').state;

describe('clinic ledger', () => {
  it('opens the course demo with posted visits and workload', () => {
    const state = demoClinic();
    expect(state.doctors.map(personName)).toEqual(['Иванов', 'Петров']);
    expect(state.services.map((item) => item.name)).toEqual([
      'Вакцинирование',
      'Осмотр',
      'Анализ состояния',
    ]);
    expect(state.receptions.every((item) => item.posted)).toBe(true);
    expect(workloadTable(state)).toEqual([
      {
        doctorId: 'doc-ivanov',
        serviceId: 'srv-exam',
        count: 1,
        revenue: 3000,
        duration: 48,
      },
      {
        doctorId: 'doc-petrov',
        serviceId: 'srv-vax',
        count: 1,
        revenue: 2500,
        duration: 25,
      },
    ]);
    expect(doctorLoad(state).map((row) => row.revenue)).toEqual([3000, 2500]);
    expect(parseClinicState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(parseClinicState({ seq: 1 })).toBeNull();
  });

  it('posts one movement per service line and copies the visit duration', () => {
    const base = clinic();
    const result = saveReception(
      base.state,
      draft(
        base,
        [
          { serviceId: base.serviceId, quantity: 2, price: 100.125 },
          { serviceId: base.extraServiceId, quantity: 1, price: 50 },
        ],
        30,
      ),
      'post',
    );
    expect(result.state.receptions[0]).toMatchObject({
      number: '1',
      posted: true,
      duration: 30,
    });
    expect(result.state.receptions[0]?.lines.map((line) => line.amount)).toEqual([200.25, 50]);
    expect(result.state.movements).toEqual([
      expect.objectContaining({
        doctorId: base.doctorId,
        serviceId: base.serviceId,
        count: 1,
        revenue: 200.25,
        duration: 30,
      }),
      expect.objectContaining({
        serviceId: base.extraServiceId,
        count: 1,
        revenue: 50,
        duration: 30,
      }),
    ]);
  });

  it('keeps an unposted write out of the register and refreshes movements on a later save', () => {
    const base = clinic();
    const written = saveReception(base.state, draft(base), 'write');
    expect(written.state.receptions[0]?.posted).toBe(false);
    expect(written.state.movements).toEqual([]);
    const first = saveReception(written.state, { ...draft(base), id: written.id }, 'post');
    const second = saveReception(
      first.state,
      {
        ...draft(base, [{ serviceId: base.serviceId, quantity: 1, price: 10 }], 15),
        id: first.id,
      },
      'write',
    );
    expect(second.state.receptions[0]?.posted).toBe(true);
    expect(second.state.movements).toHaveLength(1);
    expect(second.state.movements[0]).toMatchObject({ revenue: 10, duration: 15, count: 1 });
    const cleared = saveReception(
      second.state,
      { ...draft(base), id: second.id, lines: [] },
      'unpost',
    );
    expect(cleared.state.receptions[0]?.posted).toBe(false);
    expect(cleared.state.movements).toEqual([]);
  });

  it('refuses an incomplete post and a duplicate catalog name', () => {
    const base = clinic();
    expect(() => saveReception(base.state, { ...draft(base), lines: [] }, 'post')).toThrow(
      ClinicError,
    );
    expect(() => saveReception(base.state, { ...draft(base), duration: 0 }, 'post')).toThrow(
      ClinicError,
    );
    expect(() => saveReception(base.state, { ...draft(base), appointmentId: '' }, 'post')).toThrow(
      ClinicError,
    );
    expect(() => saveReception(base.state, draft(base), 'unpost')).toThrow(ClinicError);
    expect(() =>
      saveReception(
        base.state,
        draft(base, [{ serviceId: base.serviceId, quantity: 0, price: 10 }]),
        'post',
      ),
    ).toThrow(ClinicError);
    expect(() =>
      saveReception(
        base.state,
        draft(base, [{ serviceId: base.serviceId, quantity: 1, price: -1 }]),
        'write',
      ),
    ).toThrow(ClinicError);
    expect(() =>
      savePerson(base.state, 'doctors', {
        id: null,
        lastName: 'иванов',
        firstName: 'иван',
        middleName: '',
      }),
    ).toThrow(ClinicError);
    expect(() => saveNamed(base.state, 'offices', { id: null, name: '1' })).toThrow(ClinicError);
    expect(() =>
      savePerson(base.state, 'patients', {
        id: null,
        lastName: '  ',
        firstName: '',
        middleName: '',
      }),
    ).toThrow(ClinicError);
    expect(() =>
      saveAppointment(base.state, {
        id: null,
        createdAt: 'вчера',
        patientId: base.patientId,
        visitDate: '2026-02-31',
        doctorId: base.doctorId,
        officeId: base.officeId,
      }),
    ).toThrow(ClinicError);
  });

  it('blocks deletion marks while a record is still in use, then releases them in order', () => {
    const base = clinic();
    const live = posted(base);
    const receptionId = live.receptions[0]?.id ?? '';
    expect(() => toggleCatalogMark(live, 'doctors', base.doctorId)).toThrow(ClinicError);
    expect(() => toggleCatalogMark(live, 'services', base.serviceId)).toThrow(ClinicError);
    expect(() => toggleAppointmentMark(live, base.appointmentId)).toThrow(ClinicError);
    const markedVisit = toggleReceptionMark(live, receptionId);
    expect(markedVisit.receptions[0]?.posted).toBe(false);
    expect(markedVisit.movements).toEqual([]);
    const markedAppointment = toggleAppointmentMark(markedVisit, base.appointmentId);
    const markedDoctor = toggleCatalogMark(markedAppointment, 'doctors', base.doctorId);
    expect(markedDoctor.doctors[0]?.marked).toBe(true);
    const restored = toggleCatalogMark(markedDoctor, 'doctors', base.doctorId);
    expect(restored.doctors[0]?.marked).toBe(false);
    expect(() => toggleCatalogMark(live, 'patients', 'missing')).toThrow(ClinicError);
    expect(() => toggleReceptionMark(live, 'missing')).toThrow(ClinicError);
  });

  it('keeps a service that was already on the visit after the service is marked', () => {
    const base = clinic();
    const written = saveReception(base.state, draft(base), 'write');
    const markedVisit = toggleReceptionMark(written.state, written.id);
    const markedService = toggleCatalogMark(markedVisit, 'services', base.serviceId);
    const restored = toggleReceptionMark(markedService, written.id);
    const saved = saveReception(restored, { ...draft(base), id: written.id }, 'post');
    expect(saved.state.movements[0]?.serviceId).toBe(base.serviceId);
    expect(() =>
      saveReception(
        restored,
        draft(base, [{ serviceId: base.extraServiceId, quantity: 1, price: 1 }]),
        'write',
      ),
    ).not.toThrow();
    const other = saveNamed(restored, 'services', { id: null, name: 'Справка' });
    const hidden = toggleCatalogMark(other.state, 'services', other.id);
    expect(() =>
      saveReception(
        hidden,
        {
          ...draft(base, [{ serviceId: other.id, quantity: 1, price: 1 }]),
          id: written.id,
        },
        'write',
      ),
    ).toThrow(ClinicError);
  });

  it('renames a catalog item and updates an appointment without a new number', () => {
    const base = clinic();
    const renamed = savePerson(base.state, 'doctors', {
      id: base.doctorId,
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
    });
    expect(personName(renamed.state.doctors[0]!)).toBe('Иванов Иван Петрович');
    const second = saveNamed(renamed.state, 'offices', { id: null, name: '2' });
    const updated = saveAppointment(second.state, {
      id: base.appointmentId,
      createdAt: '2026-05-10T11:30',
      patientId: base.patientId,
      visitDate: '2026-05-10',
      doctorId: base.doctorId,
      officeId: second.id,
    });
    expect(updated.state.appointments).toHaveLength(1);
    expect(updated.state.appointments[0]).toMatchObject({
      number: '1',
      officeId: second.id,
      visitDate: '2026-05-10',
    });
    const next = saveAppointment(updated.state, {
      id: null,
      createdAt: stamp,
      patientId: base.patientId,
      visitDate: '2026-05-11',
      doctorId: base.doctorId,
      officeId: base.officeId,
    });
    expect(next.state.appointments.map((item) => item.number)).toEqual(['1', '2']);
  });
});
