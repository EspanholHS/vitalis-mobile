import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHubContext, serializeHubContext } from '../lib/hub/context';
import { extractIntervalHours, extractStartDate, extractTime, extractTreatmentDuration } from '../lib/hub/entities';
import { runHubTurn } from '../lib/hub/engine';
import { identifyHubIntent } from '../lib/hub/intent';
import { isAffirmative, normalizeHubText } from '../lib/hub/normalization';
import type { HubConversationState, HubDataSource } from '../lib/hub/types';

function medication(id = 'med-1', name = 'Losartana') {
  return {
    id,
    user_id: 'user-1',
    name,
    dosage: '50 mg',
    instructions: 'Tomar após o café',
    interval_hours: 12,
    first_dose_time: '08:00:00',
    start_date: '2026-01-01',
    end_date: null,
    is_active: true,
    color_token: 'blue',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    schedules: [],
  } as any;
}

function doseAt(offsetMinutes: number, id = 'med-1', name = 'Losartana') {
  const med = medication(id, name);
  const scheduledFor = new Date(Date.now() + offsetMinutes * 60_000);
  return {
    key: `${id}-${scheduledFor.toISOString()}`,
    medication: med,
    scheduledFor,
    scheduleTime: `${String(scheduledFor.getHours()).padStart(2, '0')}:${String(scheduledFor.getMinutes()).padStart(2, '0')}:00`,
    event: null,
    status: offsetMinutes <= 0 ? 'late' : 'pending',
  } as any;
}

function createDataSource(doses = [doseAt(-10)]) {
  const calls = { created: [] as any[], recorded: [] as any[] };
  const medications = Array.from(new Map(doses.map((dose) => [dose.medication.id, dose.medication])).values());
  const data: HubDataSource = {
    getDashboard: async () => ({
      medications,
      doses,
      nextDose: doses.find((dose) => dose.status === 'late' || dose.status === 'pending') ?? null,
      plannedCount: doses.length,
      takenCount: doses.filter((dose) => dose.status === 'taken').length,
      lateCount: doses.filter((dose) => dose.status === 'late').length,
      adherence: 0,
    }),
    getAnalytics: async () => ({
      days: [], adherence: 80, dueAdherence: 80, taken: 4, planned: 5, dueTaken: 4, duePlanned: 5,
      upcomingCount: 0, attentionCount: 1, bestHour: null, criticalHour: '20:00', byMedication: [],
    }),
    getHistory: async () => [],
    listMedications: async () => medications,
    recordDose: async (...args) => { calls.recorded.push(args); },
    createMedication: async (_userId, input) => { calls.created.push(input); return 'created-medication'; },
  };
  return { calls, data };
}

async function turn(message: string, data: HubDataSource, previousContext?: HubConversationState) {
  return runHubTurn({ userId: 'user-1', message, data, previousContext });
}

test('normaliza acentos, pontuação e espaços', () => {
  assert.equal(normalizeHubText('  Olá!!!   TUDO bem? '), 'ola tudo bem');
  assert.equal(isAffirmative('Sim, pode confirmar.'), true);
  assert.equal(isAffirmative('Sim, pode salvar.'), true);
});

test('reconhece variações e erros simples de intenção', () => {
  assert.equal(identifyHubIntent('Qual é o meu próximo remédio?'), 'next_dose');
  assert.equal(identifyHubIntent('Quero cadastar um medicamento'), 'add_medication');
  assert.equal(identifyHubIntent('já tomei a losartana'), 'confirm_dose');
  assert.equal(identifyHubIntent('registrar medicamento tomado'), 'confirm_dose');
  assert.equal(identifyHubIntent('como foi minha semana?'), 'adherence');
  assert.equal(identifyHubIntent('quais doses faltam?'), 'daily_medications');
  assert.equal(identifyHubIntent('quais medicamentos estão ativos?'), 'active_medications');
});

test('extrai horários, datas relativas e frequência', () => {
  assert.equal(extractTime('Às 8 da manhã'), '08:00');
  assert.equal(extractTime('8:30 da noite'), '20:30');
  assert.equal(extractIntervalHours('a cada 12 horas'), 12);
  assert.equal(extractIntervalHours('uma vez ao dia'), 24);
  assert.deepEqual(extractTreatmentDuration('por 7 dias'), { durationDays: 7 });
  assert.deepEqual(extractTreatmentDuration('durante 2 semanas'), { durationDays: 14 });
  assert.deepEqual(extractTreatmentDuration('uso contínuo'), { durationDays: null });
  assert.notEqual(extractStartDate('amanhã'), extractStartDate('hoje'));
});

test('mantém contexto entre próxima dose e confirmação', async () => {
  const { calls, data } = createDataSource();
  const first = await turn('qual é meu próximo remédio?', data);
  assert.equal(first.intent, 'next_dose');
  assert.equal(first.context.lastDose?.medicationName, 'Losartana');

  const second = await turn('pode marcar como tomado', data, first.context);
  assert.match(second.content, /quer confirmar/i);
  assert.equal(calls.recorded.length, 0);

  const third = await turn('Sim, pode confirmar.', data, second.context);
  assert.equal(third.feedbackTone, 'success');
  assert.equal(calls.recorded.length, 1);
  assert.equal(calls.recorded[0][3], 'hub');
});

test('não confirma dose futura', async () => {
  const { calls, data } = createDataSource([doseAt(60)]);
  const first = await turn('qual é minha próxima dose?', data);
  const second = await turn('pode marcar como tomado', data, first.context);
  assert.match(second.content, /só poderá ser confirmada/i);
  assert.equal(calls.recorded.length, 0);
});

test('pede desambiguação quando há mais de uma dose compatível', async () => {
  const { data } = createDataSource([doseAt(-20, 'med-1', 'Losartana'), doseAt(-10, 'med-2', 'Metformina')]);
  const result = await turn('já tomei meu remédio', data);
  assert.match(result.content, /mais de uma dose/i);
  assert.equal(result.suggestions?.length, 2);
});

test('cadastro guiado só grava após confirmação e permite correção', async () => {
  const { calls, data } = createDataSource([]);
  let result = await turn('quero cadastrar um medicamento', data);
  result = await turn('Losartana', data, result.context);
  result = await turn('50 mg', data, result.context);
  result = await turn('amanhã', data, result.context);
  result = await turn('às 8 da manhã', data, result.context);
  result = await turn('a cada 12 horas', data, result.context);
  result = await turn('7 dias', data, result.context);
  result = await turn('depois do café', data, result.context);
  assert.equal(result.context.flow?.step, 'review');
  assert.equal(calls.created.length, 0);

  result = await turn('alterar dosagem', data, result.context);
  result = await turn('100 mg', data, result.context);
  assert.equal(result.context.flow?.step, 'review');
  assert.match(result.content, /100 mg/);
  assert.equal(calls.created.length, 0);

  result = await turn('pode salvar', data, result.context);
  assert.equal(result.feedbackTone, 'success');
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].dosage, '100 mg');
  assert.equal(calls.created[0].endDate !== null, true);
});

test('bloqueia orientação clínica e destaca emergência', async () => {
  const { data } = createDataSource();
  const clinical = await turn('posso parar de tomar esse remédio?', data);
  assert.equal(clinical.intent, 'clinical_safety');
  const emergency = await turn('estou com falta de ar e dor no peito', data);
  assert.equal(emergency.intent, 'emergency');
  assert.match(emergency.content, /192/);
});

test('persiste e restaura o contexto pelo metadata da conversa', async () => {
  const { data } = createDataSource();
  const result = await turn('quero cadastrar um medicamento', data);
  const restored = parseHubContext({ context: serializeHubContext(result.context) });
  assert.equal(restored.flow?.kind, 'medication_registration');
  assert.equal(restored.flow?.step, 'name');
});

test('cancelamento encerra o fluxo sem alterar dados', async () => {
  const { calls, data } = createDataSource([]);
  const started = await turn('quero cadastrar um medicamento', data);
  const cancelled = await turn('deixa pra lá', data, started.context);
  assert.equal(cancelled.context.flow, null);
  assert.equal(cancelled.context.pendingAction, null);
  assert.equal(calls.created.length, 0);
});

test('avisa sobre medicamento duplicado antes de salvar', async () => {
  const { calls, data } = createDataSource([doseAt(-10)]);
  let result = await turn('quero cadastrar um medicamento', data);
  result = await turn('Losartana', data, result.context);
  result = await turn('50 mg', data, result.context);
  result = await turn('hoje', data, result.context);
  result = await turn('08:00', data, result.context);
  result = await turn('a cada 12 horas', data, result.context);
  result = await turn('uso contínuo', data, result.context);
  result = await turn('sem observação', data, result.context);
  assert.equal(result.feedbackTone, 'warning');
  assert.match(result.content, /já existe/i);
  assert.equal(calls.created.length, 0);
});
