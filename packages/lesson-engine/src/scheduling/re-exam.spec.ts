import { describe, expect, it } from 'vitest';

import {
  isReExamDue,
  RE_EXAM_LADDER_DAYS,
  scheduleReExam,
  type ReExamSchedule,
  type ReExamState,
} from './re-exam';

const now = new Date('2026-06-17T12:00:00.000Z');

describe('scheduleReExam', () => {
  it('climbs the ladder one step per pass', () => {
    const expectedDue = [
      '2026-06-18T12:00:00.000Z',
      '2026-06-20T12:00:00.000Z',
      '2026-06-24T12:00:00.000Z',
      '2026-07-03T12:00:00.000Z',
      '2026-07-22T12:00:00.000Z',
    ];

    let state: ReExamState | undefined;
    for (let step = 0; step < RE_EXAM_LADDER_DAYS.length; step += 1) {
      const schedule = scheduleReExam(state, true, now);
      expect(schedule.stepIndex).toBe(step);
      expect(schedule.streak).toBe(step + 1);
      expect(schedule.due).toBe(expectedDue[step]);
      expect(schedule.lastStatus).toBe('pass');
      expect(schedule.graduated).toBe(step === RE_EXAM_LADDER_DAYS.length - 1);
      state = schedule;
    }
  });

  it('graduates only once the top of the ladder is reached', () => {
    let state: ReExamState | undefined;
    for (let step = 0; step < RE_EXAM_LADDER_DAYS.length - 1; step += 1) {
      state = scheduleReExam(state, true, now);
      expect(state.graduated).toBe(false);
    }
    state = scheduleReExam(state, true, now);
    expect(state.graduated).toBe(true);
  });

  it('clamps at the last ladder step on further passes', () => {
    const graduated: ReExamState = {
      stepIndex: RE_EXAM_LADDER_DAYS.length - 1,
      streak: 5,
      graduated: true,
    };
    const schedule = scheduleReExam(graduated, true, now);
    expect(schedule.stepIndex).toBe(RE_EXAM_LADDER_DAYS.length - 1);
    expect(schedule.streak).toBe(6);
    expect(schedule.graduated).toBe(true);
    expect(schedule.due).toBe('2026-07-22T12:00:00.000Z');
  });

  it('resets stepIndex, streak and graduated on a fail', () => {
    const advanced: ReExamState = { stepIndex: 3, streak: 4, graduated: false };
    const schedule = scheduleReExam(advanced, false, now);
    expect(schedule.stepIndex).toBe(0);
    expect(schedule.streak).toBe(0);
    expect(schedule.graduated).toBe(false);
    expect(schedule.lastStatus).toBe('fail');
    expect(schedule.due).toBe('2026-06-18T12:00:00.000Z');
  });

  it('resets a graduated card back to the bottom of the ladder on a fail', () => {
    const graduated: ReExamState = {
      stepIndex: RE_EXAM_LADDER_DAYS.length - 1,
      streak: 9,
      graduated: true,
    };
    const schedule = scheduleReExam(graduated, false, now);
    expect(schedule.stepIndex).toBe(0);
    expect(schedule.streak).toBe(0);
    expect(schedule.graduated).toBe(false);
  });

  it('starts a never-scheduled card at the bottom of the ladder on a pass', () => {
    const schedule = scheduleReExam(undefined, true, now);
    expect(schedule.stepIndex).toBe(0);
    expect(schedule.due).toBe('2026-06-18T12:00:00.000Z');
  });

  it('supports a custom ladder', () => {
    const ladder = [2, 5];
    let state: ReExamSchedule | undefined;

    state = scheduleReExam(state, true, now, ladder);
    expect(state.stepIndex).toBe(0);
    expect(state.due).toBe('2026-06-19T12:00:00.000Z');
    expect(state.graduated).toBe(false);

    state = scheduleReExam(state, true, now, ladder);
    expect(state.stepIndex).toBe(1);
    expect(state.due).toBe('2026-06-22T12:00:00.000Z');
    expect(state.graduated).toBe(true);

    state = scheduleReExam(state, true, now, ladder);
    expect(state.stepIndex).toBe(1);
    expect(state.graduated).toBe(true);
  });
});

describe('isReExamDue', () => {
  it('treats a card with no re-exam scheduled as not due', () => {
    expect(isReExamDue(undefined, now)).toBe(false);
  });

  it('treats a re-exam due in the past as due', () => {
    expect(isReExamDue({ due: '2026-06-17T11:59:59.999Z' }, now)).toBe(true);
  });

  it('treats a re-exam due exactly now as due', () => {
    expect(isReExamDue({ due: '2026-06-17T12:00:00.000Z' }, now)).toBe(true);
  });

  it('treats a re-exam due in the future as not due', () => {
    expect(isReExamDue({ due: '2026-06-17T12:00:00.001Z' }, now)).toBe(false);
  });
});
