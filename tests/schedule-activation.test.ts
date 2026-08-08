import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateTreatmentEndDate, treatmentDurationDays, treatmentDurationLabel } from '../lib/medication-duration';
import { scheduleIsActiveOnDate } from '../lib/schedule-activation';

const medication = {
  start_date: '2026-08-02',
  end_date: null,
  first_dose_time: '15:00:00',
};

test('não cria doses retroativas antes do primeiro horário no dia inicial', () => {
  assert.equal(scheduleIsActiveOnDate('2026-08-02', medication, '03:00:00'), false);
  assert.equal(scheduleIsActiveOnDate('2026-08-02', medication, '11:00:00'), false);
  assert.equal(scheduleIsActiveOnDate('2026-08-02', medication, '15:00:00'), true);
  assert.equal(scheduleIsActiveOnDate('2026-08-02', medication, '19:00:00'), true);
});

test('mantém o ciclo completo a partir do segundo dia', () => {
  assert.equal(scheduleIsActiveOnDate('2026-08-03', medication, '03:00:00'), true);
});

test('respeita as datas inicial e final do tratamento', () => {
  assert.equal(scheduleIsActiveOnDate('2026-08-01', medication, '15:00:00'), false);
  assert.equal(
    scheduleIsActiveOnDate(
      '2026-08-04',
      { ...medication, end_date: '2026-08-03' },
      '15:00:00',
    ),
    false,
  );
});

test('calcula a data final contando o dia de início', () => {
  assert.equal(calculateTreatmentEndDate('2026-08-02', 1), '2026-08-02');
  assert.equal(calculateTreatmentEndDate('2026-08-02', 7), '2026-08-08');
  assert.equal(calculateTreatmentEndDate('2026-12-29', 7), '2027-01-04');
  assert.equal(calculateTreatmentEndDate('2026-08-02', null), null);
});

test('resume tratamentos por período e de uso contínuo', () => {
  assert.equal(treatmentDurationDays('2026-08-02', '2026-08-08'), 7);
  assert.match(treatmentDurationLabel('2026-08-02', '2026-08-08'), /^7 dias/);
  assert.equal(treatmentDurationLabel('2026-08-02', null), 'Uso contínuo');
});
