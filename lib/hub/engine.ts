import { extractCorrectionStep, extractHourReference, extractIntervalHours, extractStartDate, extractTime, extractTreatmentDuration } from './entities';
import { identifyHubIntent } from './intent';
import { isAffirmative, isNegative, normalizeHubText } from './normalization';
import {
  createEmptyHubContext,
} from './context';
import type {
  HubConversationState,
  HubDataSource,
  HubDoseReference,
  HubIntent,
  HubMedicationReference,
  HubResponse,
  HubSuggestion,
  MedicationDraft,
  MedicationRegistrationStep,
} from './types';
import type { DailyDose, MedicationWithSchedules } from '@/lib/vitalis-data';
import { calculateTreatmentEndDate, treatmentDurationLabel } from '@/lib/medication-duration';

const HOME_SUGGESTIONS: HubSuggestion[] = [
  { icon: 'schedule', label: 'Próximo medicamento', prompt: 'Qual é meu próximo medicamento?' },
  { icon: 'today', label: 'Medicamentos de hoje', prompt: 'Quais medicamentos eu tomo hoje?' },
  { icon: 'check-circle', label: 'Registrar toma', prompt: 'Quero registrar uma toma.' },
  { icon: 'add-circle', label: 'Cadastrar medicamento', prompt: 'Quero cadastrar um medicamento.' },
  { icon: 'insights', label: 'Ver adesão', prompt: 'Como está minha adesão?' },
];

const REGISTRATION_STEPS: MedicationRegistrationStep[] = [
  'name',
  'dosage',
  'start_date',
  'first_time',
  'frequency',
  'duration',
  'instructions',
  'review',
];

function cloneContext(context: HubConversationState): HubConversationState {
  return JSON.parse(JSON.stringify(context)) as HubConversationState;
}

function response(
  intent: HubIntent,
  content: string,
  context: HubConversationState,
  options: Pick<HubResponse, 'suggestions' | 'feedbackTone'> = {},
): HubResponse {
  context.currentIntent = intent;
  if (intent !== 'fallback') context.fallbackCount = 0;
  return { intent, content, context, ...options };
}

function doseReference(dose: DailyDose): HubDoseReference {
  return {
    key: dose.key,
    medicationId: dose.medication.id,
    medicationName: dose.medication.name,
    dosage: dose.medication.dosage,
    scheduledFor: dose.scheduledFor.toISOString(),
  };
}

function medicationReference(medication: MedicationWithSchedules | DailyDose['medication']): HubMedicationReference {
  return { id: medication.id, name: medication.name, dosage: medication.dosage };
}

function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (value === todayKey) return 'hoje';
  if (value === tomorrowKey) return 'amanhã';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function doseStatusLabel(dose: DailyDose) {
  if (dose.status === 'taken') return 'confirmada';
  if (dose.status === 'skipped') return 'não tomada';
  if (dose.status === 'late' || dose.status === 'missed') return 'atrasada';
  if (dose.status === 'snoozed') return 'adiada';
  return 'pendente';
}

function registrationPrompt(step: MedicationRegistrationStep) {
  switch (step) {
    case 'name': return 'Qual é o nome do medicamento?';
    case 'dosage': return 'Qual é a dosagem? Por exemplo: 50 mg.';
    case 'start_date': return 'Quando você começará a tomar esse medicamento? Você pode responder hoje, amanhã ou informar uma data.';
    case 'first_time': return 'Qual será o primeiro horário? Por exemplo: 08:00 ou 8 da manhã.';
    case 'frequency': return 'Com qual frequência você deverá tomar? Por exemplo: a cada 8 horas, a cada 12 horas ou uma vez ao dia.';
    case 'duration': return 'Por quanto tempo você deverá tomar? Responda, por exemplo, “7 dias”, “2 semanas” ou “uso contínuo”.';
    case 'instructions': return 'Deseja adicionar alguma observação? Você pode informar a orientação ou responder “sem observação”.';
    case 'review': return 'Revise os dados e diga se deseja salvar.';
  }
}

function requiredDraft(draft: MedicationDraft): Required<MedicationDraft> | null {
  if (!draft.name || !draft.dosage || !draft.startDate || !draft.firstDoseTime || !draft.intervalHours || draft.durationDays === undefined) return null;
  return {
    name: draft.name,
    dosage: draft.dosage,
    startDate: draft.startDate,
    firstDoseTime: draft.firstDoseTime,
    intervalHours: draft.intervalHours,
    durationDays: draft.durationDays,
    endDate: draft.endDate ?? calculateTreatmentEndDate(draft.startDate, draft.durationDays),
    instructions: draft.instructions ?? '',
    colorToken: draft.colorToken ?? 'blue',
  };
}

function reviewMedication(draft: Required<MedicationDraft>, duplicateWarning: boolean) {
  const warning = duplicateWarning
    ? '\n\nAtenção: já existe um medicamento com esse nome. Salve somente se este for realmente outro cadastro.'
    : '';
  return `Confira os dados:\n\nMedicamento: ${draft.name}\nDosagem: ${draft.dosage}\nInício: ${formatDate(draft.startDate)}\nPrimeiro horário: ${draft.firstDoseTime}\nFrequência: a cada ${draft.intervalHours} horas\nDuração: ${treatmentDurationLabel(draft.startDate, draft.endDate)}\nObservação: ${draft.instructions || 'nenhuma'}${warning}\n\nDeseja salvar?`;
}

async function prepareRegistrationReview(
  userId: string,
  context: HubConversationState,
  data: HubDataSource,
) {
  const flow = context.flow;
  if (!flow) throw new Error('missing_registration_flow');
  const complete = requiredDraft(flow.draft);
  if (!complete) {
    if (flow.draft.durationDays === undefined) {
      flow.step = 'duration';
      flow.returnToReview = false;
      return response('add_medication', `Faltou definir a duração. ${registrationPrompt('duration')}`, context, { feedbackTone: 'warning' });
    }
    flow.step = 'name';
    flow.returnToReview = false;
    return response('add_medication', `Faltou uma informação essencial. ${registrationPrompt('name')}`, context, { feedbackTone: 'warning' });
  }

  const medications = await data.listMedications(userId);
  const duplicateWarning = medications.some((medication) => normalizeHubText(medication.name) === normalizeHubText(complete.name));
  flow.step = 'review';
  flow.returnToReview = false;
  flow.duplicateWarning = duplicateWarning;
  context.pendingAction = { type: 'save_medication', draft: complete, duplicateWarning };
  return response('add_medication', reviewMedication(complete, duplicateWarning), context, { feedbackTone: duplicateWarning ? 'warning' : 'default' });
}

function previousRegistrationStep(step: MedicationRegistrationStep) {
  const index = REGISTRATION_STEPS.indexOf(step);
  return REGISTRATION_STEPS[Math.max(0, index - 1)];
}

function cleanShortAnswer(value: string) {
  return value.trim().replace(/[.!?]+$/g, '').trim();
}

function matchesMedicationName(message: string, medication: MedicationWithSchedules | DailyDose['medication']) {
  const normalized = normalizeHubText(message);
  const name = normalizeHubText(medication.name);
  return normalized.includes(name) || name.split(' ').some((token) => token.length >= 4 && normalized.includes(token));
}

function matchesDoseReference(dose: DailyDose, reference: HubDoseReference) {
  return dose.medication.id === reference.medicationId
    && Math.abs(dose.scheduledFor.getTime() - new Date(reference.scheduledFor).getTime()) < 60_000;
}

function findDoseCandidates(message: string, doses: DailyDose[], context: HubConversationState) {
  const now = Date.now();
  const available = doses.filter((dose) => (
    dose.scheduledFor.getTime() <= now
    && dose.status !== 'taken'
    && dose.status !== 'skipped'
  ));
  const hourReference = extractHourReference(message);
  const named = available.filter((dose) => matchesMedicationName(message, dose.medication));
  let candidates = named.length ? named : available;

  if (hourReference) {
    candidates = candidates.filter((dose) => (
      dose.scheduledFor.getHours() === hourReference.hour
      && dose.scheduledFor.getMinutes() === hourReference.minute
    ));
  }

  if (!named.length && !hourReference && context.lastDose) {
    const contextual = available.find((dose) => matchesDoseReference(dose, context.lastDose!));
    if (contextual) candidates = [contextual];
  }

  return candidates;
}

async function performPendingAction(
  userId: string,
  context: HubConversationState,
  data: HubDataSource,
): Promise<HubResponse> {
  const pending = context.pendingAction;
  if (!pending) return response('fallback', 'Não há nenhuma ação aguardando confirmação.', context, { suggestions: HOME_SUGGESTIONS });

  if (pending.type === 'confirm_dose') {
    const dashboard = await data.getDashboard(userId);
    const dose = dashboard.doses.find((item) => matchesDoseReference(item, pending.dose));
    if (!dose) {
      context.pendingAction = null;
      return response('confirm_dose', 'Essa dose não está mais disponível na agenda de hoje. Atualizei o contexto da conversa.', context, { feedbackTone: 'warning' });
    }
    if (dose.status === 'taken') {
      context.pendingAction = null;
      return response('confirm_dose', 'Essa toma já estava confirmada no seu histórico.', context, { feedbackTone: 'success' });
    }
    if (dose.scheduledFor.getTime() > Date.now()) {
      context.pendingAction = null;
      return response('confirm_dose', `Essa dose está prevista para ${formatTime(dose.scheduledFor)} e só poderá ser confirmada a partir desse horário.`, context, { feedbackTone: 'warning' });
    }

    await data.recordDose(userId, dose, 'taken', 'hub');
    context.pendingAction = null;
    context.lastDose = doseReference(dose);
    context.lastMedication = medicationReference(dose.medication);
    return response('confirm_dose', `Pronto! A toma de ${dose.medication.name} ${dose.medication.dosage}, prevista para ${formatTime(dose.scheduledFor)}, foi registrada no seu histórico.`, context, {
      feedbackTone: 'success',
      suggestions: [
        { icon: 'today', label: 'Ver rotina de hoje', prompt: 'Como ficou minha rotina de hoje?' },
        { icon: 'history', label: 'Ver histórico', prompt: 'Mostre meu histórico de hoje.' },
      ],
    });
  }

  try {
    const createdId = await data.createMedication(userId, {
      name: pending.draft.name,
      dosage: pending.draft.dosage,
      instructions: pending.draft.instructions,
      intervalHours: pending.draft.intervalHours,
      firstDoseTime: pending.draft.firstDoseTime,
      startDate: pending.draft.startDate,
      endDate: pending.draft.endDate,
      colorToken: pending.draft.colorToken,
    });
    context.pendingAction = null;
    context.flow = null;
    context.lastMedication = {
      id: typeof createdId === 'string' ? createdId : '',
      name: pending.draft.name,
      dosage: pending.draft.dosage,
    };
    return response('add_medication', `Medicamento cadastrado com sucesso. ${pending.draft.name} foi adicionado à sua agenda com duração de ${treatmentDurationLabel(pending.draft.startDate, pending.draft.endDate).toLocaleLowerCase('pt-BR')}.`, context, {
      feedbackTone: 'success',
      suggestions: [
        { icon: 'today', label: 'Ver agenda', prompt: 'Mostre minha agenda de hoje.' },
        { icon: 'add-circle', label: 'Cadastrar outro', prompt: 'Quero cadastrar outro medicamento.' },
      ],
    });
  } catch {
    return response('add_medication', 'Não consegui salvar o medicamento agora. Os dados informados foram mantidos, então você pode tentar salvar novamente ou corrigir alguma informação.', context, {
      feedbackTone: 'danger',
      suggestions: [
        { icon: 'add-circle', label: 'Tentar salvar', prompt: 'Pode salvar.' },
      ],
    });
  }
}

async function handleRegistration(
  userId: string,
  message: string,
  context: HubConversationState,
  data: HubDataSource,
): Promise<HubResponse> {
  const flow = context.flow;
  if (!flow) throw new Error('missing_registration_flow');
  const normalized = normalizeHubText(message);

  if (normalized.includes('comecar de novo') || normalized === 'reiniciar') {
    context.flow = { kind: 'medication_registration', step: 'name', draft: {} };
    context.pendingAction = null;
    return response('add_medication', `Vamos recomeçar. ${registrationPrompt('name')}`, context);
  }

  if (normalized === 'voltar') {
    flow.step = previousRegistrationStep(flow.step);
    context.pendingAction = null;
    return response('correction', `Certo, voltamos uma etapa. ${registrationPrompt(flow.step)}`, context);
  }

  const correction = extractCorrectionStep(message);
  if (/(corrigir|alterar|mudar)/.test(normalized) && correction) {
    flow.returnToReview = flow.step === 'review' || context.pendingAction?.type === 'save_medication';
    flow.step = correction;
    context.pendingAction = null;
    return response('correction', `Tudo bem. ${registrationPrompt(correction)}`, context);
  }

  if (flow.step === 'review') {
    if (isAffirmative(message)) return performPendingAction(userId, context, data);
    if (isNegative(message)) {
      context.pendingAction = null;
      return response('correction', 'Tudo bem. Diga o que deseja corrigir, por exemplo: “alterar dosagem” ou “corrigir horário”.', context);
    }
    return response('correction', 'Para salvar, responda “sim” ou “pode salvar”. Se algo estiver incorreto, diga o campo que deseja alterar.', context);
  }

  const answer = cleanShortAnswer(message);
  if (flow.step === 'name') {
    if (answer.length < 2 || answer.length > 120) return response('add_medication', 'Informe um nome de medicamento entre 2 e 120 caracteres.', context);
    flow.draft.name = answer;
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'dosage';
    return response('add_medication', `Entendi: ${answer}. ${registrationPrompt('dosage')}`, context);
  }

  if (flow.step === 'dosage') {
    if (!/\d/.test(answer) || answer.length > 80) return response('add_medication', 'Não reconheci a dosagem. Informe um valor como “50 mg”, “5 ml” ou “1 comprimido”.', context);
    flow.draft.dosage = answer;
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'start_date';
    return response('add_medication', registrationPrompt('start_date'), context);
  }

  if (flow.step === 'start_date') {
    const startDate = extractStartDate(message);
    if (!startDate) return response('add_medication', 'Não reconheci a data. Responda “hoje”, “amanhã” ou use o formato 15/08/2026.', context);
    const today = extractStartDate('hoje')!;
    if (startDate < today) return response('add_medication', 'A data de início não pode estar no passado. Informe hoje ou uma data futura.', context);
    flow.draft.startDate = startDate;
    if (flow.draft.durationDays !== undefined) {
      flow.draft.endDate = calculateTreatmentEndDate(startDate, flow.draft.durationDays);
    }
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'first_time';
    return response('add_medication', registrationPrompt('first_time'), context);
  }

  if (flow.step === 'first_time') {
    const time = extractTime(message);
    if (!time) return response('add_medication', 'Não reconheci um horário válido. Use algo como “08:00”, “8h” ou “8 da manhã”.', context);
    flow.draft.firstDoseTime = time;
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'frequency';
    return response('add_medication', registrationPrompt('frequency'), context);
  }

  if (flow.step === 'frequency') {
    const intervalHours = extractIntervalHours(message);
    if (!intervalHours) return response('add_medication', 'Não reconheci a frequência. Informe um intervalo entre 1 e 24 horas, por exemplo: “a cada 12 horas”.', context);
    flow.draft.intervalHours = intervalHours;
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'duration';
    return response('add_medication', registrationPrompt('duration'), context);
  }

  if (flow.step === 'duration') {
    const duration = extractTreatmentDuration(message);
    if (!duration) return response('add_medication', 'Não reconheci a duração. Informe algo como “7 dias”, “2 semanas” ou “uso contínuo”.', context);
    flow.draft.durationDays = duration.durationDays;
    flow.draft.endDate = calculateTreatmentEndDate(flow.draft.startDate!, duration.durationDays);
    if (flow.returnToReview) return prepareRegistrationReview(userId, context, data);
    flow.step = 'instructions';
    return response('add_medication', registrationPrompt('instructions'), context);
  }

  const noInstructions = /^(nao|nenhuma|sem observacao|sem orientacao|pular)$/.test(normalized);
  if (!noInstructions && answer.length > 500) return response('add_medication', 'A observação pode ter no máximo 500 caracteres. Resuma a orientação cadastrada.', context);
  flow.draft.instructions = noInstructions ? '' : answer;
  flow.draft.colorToken = flow.draft.colorToken ?? 'blue';
  return prepareRegistrationReview(userId, context, data);
}

async function handleConfirmDose(
  userId: string,
  message: string,
  context: HubConversationState,
  data: HubDataSource,
) {
  const dashboard = await data.getDashboard(userId);
  const candidates = findDoseCandidates(message, dashboard.doses, context);

  if (!candidates.length) {
    const futureContextDose = context.lastDose
      ? dashboard.doses.find((dose) => matchesDoseReference(dose, context.lastDose!))
      : null;
    if (futureContextDose && futureContextDose.scheduledFor.getTime() > Date.now()) {
      return response('confirm_dose', `A dose de ${futureContextDose.medication.name} está prevista para ${formatTime(futureContextDose.scheduledFor)}. Ela só poderá ser confirmada a partir desse horário.`, context, { feedbackTone: 'warning' });
    }
    return response('confirm_dose', 'Não encontrei uma dose pendente compatível que já possa ser confirmada. Você pode informar o medicamento ou o horário da dose.', context, {
      suggestions: [{ icon: 'today', label: 'Ver doses de hoje', prompt: 'Quais doses faltam hoje?' }],
    });
  }

  if (candidates.length > 1) {
    const options = candidates.slice(0, 4).map((dose) => `${dose.medication.name}, ${formatTime(dose.scheduledFor)}`).join('; ');
    return response('confirm_dose', `Encontrei mais de uma dose possível: ${options}. Qual medicamento ou horário você deseja confirmar?`, context, {
      suggestions: candidates.slice(0, 3).map((dose) => ({
        icon: 'check-circle',
        label: `${dose.medication.name} ${formatTime(dose.scheduledFor)}`,
        prompt: `Confirmar ${dose.medication.name} das ${formatTime(dose.scheduledFor)}.`,
      })),
    });
  }

  const dose = candidates[0];
  context.lastDose = doseReference(dose);
  context.lastMedication = medicationReference(dose.medication);
  context.pendingAction = { type: 'confirm_dose', dose: doseReference(dose) };
  return response('confirm_dose', `Você quer confirmar a toma de ${dose.medication.name} ${dose.medication.dosage}, prevista para ${formatTime(dose.scheduledFor)}?`, context, {
    suggestions: [
      { icon: 'check-circle', label: 'Sim, confirmar', prompt: 'Sim, pode confirmar.' },
      { label: 'Cancelar', prompt: 'Não, cancelar.' },
    ],
  });
}

export async function runHubTurn({
  userId,
  message,
  previousContext,
  data,
}: {
  userId: string;
  message: string;
  previousContext?: HubConversationState;
  data: HubDataSource;
}): Promise<HubResponse> {
  const context = cloneContext(previousContext ?? createEmptyHubContext());
  const intent = identifyHubIntent(message);

  if (intent === 'emergency') {
    return response(intent, 'Se você está com sintomas graves, como falta de ar, dor no peito, desmaio ou reação intensa, procure atendimento médico imediatamente. No Brasil, ligue para o SAMU no 192. Não tente ajustar o tratamento por conta própria.', context, { feedbackTone: 'danger' });
  }
  if (intent === 'clinical_safety') {
    return response(intent, 'Não posso orientar mudanças no seu tratamento, avaliar interações ou dizer se um medicamento é seguro para uma condição. Para esse tipo de decisão, consulte seu médico ou farmacêutico.', context, { feedbackTone: 'warning' });
  }
  if (intent === 'cancel') {
    const hadActiveFlow = Boolean(context.flow || context.pendingAction);
    context.flow = null;
    context.pendingAction = null;
    return response('cancel', hadActiveFlow ? 'Tudo bem, a ação foi cancelada. Nenhum dado foi alterado.' : 'Não há nenhuma ação em andamento. Como posso ajudar?', context, { suggestions: HOME_SUGGESTIONS });
  }

  if (context.pendingAction?.type === 'confirm_dose') {
    if (isAffirmative(message) || intent === 'confirm_dose') return performPendingAction(userId, context, data);
    if (isNegative(message)) {
      context.pendingAction = null;
      return response('confirm_dose', 'Tudo bem, a toma não foi registrada.', context, { suggestions: HOME_SUGGESTIONS });
    }
  }

  if (context.flow) return handleRegistration(userId, message, context, data);

  switch (intent) {
    case 'greeting': {
      const greetings = ['Olá! Como posso ajudar você hoje?', 'Oi! O que você gostaria de consultar na sua rotina?', 'Olá! Posso ajudar com sua agenda, histórico ou medicamentos.'];
      return response(intent, greetings[normalizeHubText(message).length % greetings.length], context, { suggestions: HOME_SUGGESTIONS });
    }
    case 'capabilities':
      return response(intent, 'Posso consultar sua próxima dose e a agenda de hoje, mostrar medicamentos e histórico, resumir sua adesão, registrar uma toma com sua confirmação e cadastrar um medicamento passo a passo. Também posso orientar onde encontrar cada área do app.', context, { suggestions: HOME_SUGGESTIONS });
    case 'next_dose': {
      const dashboard = await data.getDashboard(userId);
      if (!dashboard.nextDose) return response(intent, 'Não encontrei nenhuma dose pendente para hoje.', context, { suggestions: HOME_SUGGESTIONS });
      const dose = dashboard.nextDose;
      context.lastDose = doseReference(dose);
      context.lastMedication = medicationReference(dose.medication);
      const instruction = dose.medication.instructions ? ` Orientação cadastrada: ${dose.medication.instructions}` : '';
      const availability = dose.scheduledFor.getTime() <= Date.now() ? ' Ela já pode ser confirmada.' : '';
      return response(intent, `Sua próxima dose é ${dose.medication.name} ${dose.medication.dosage}, às ${formatTime(dose.scheduledFor)}.${instruction}${availability}`, context, {
        suggestions: dose.scheduledFor.getTime() <= Date.now()
          ? [{ icon: 'check-circle', label: 'Registrar toma', prompt: 'Pode marcar como tomado.' }]
          : [{ icon: 'today', label: 'Ver agenda completa', prompt: 'Mostre minha agenda de hoje.' }],
      });
    }
    case 'daily_medications': {
      const dashboard = await data.getDashboard(userId);
      if (!dashboard.doses.length) return response(intent, 'Você não tem medicamentos programados para hoje.', context, {
        suggestions: [{ icon: 'add-circle', label: 'Cadastrar medicamento', prompt: 'Quero cadastrar um medicamento.' }],
      });
      const lines = dashboard.doses.map((dose) => `• ${formatTime(dose.scheduledFor)} · ${dose.medication.name} ${dose.medication.dosage} · ${doseStatusLabel(dose)}`);
      const pending = dashboard.doses.filter((dose) => !['taken', 'skipped'].includes(dose.status)).length;
      return response(intent, `Sua agenda de hoje tem ${dashboard.doses.length} ${dashboard.doses.length === 1 ? 'dose' : 'doses'}:\n\n${lines.join('\n')}\n\n${pending ? `${pending} ainda ${pending === 1 ? 'precisa' : 'precisam'} de atenção.` : 'Todas as doses foram registradas.'}`, context, {
        suggestions: [
          { icon: 'check-circle', label: 'Registrar toma', prompt: 'Quero registrar uma toma.' },
          { icon: 'history', label: 'Ver histórico', prompt: 'Mostre meu histórico de hoje.' },
        ],
      });
    }
    case 'active_medications': {
      const medications = (await data.listMedications(userId)).filter((medication) => medication.is_active);
      if (!medications.length) return response(intent, 'Você ainda não tem medicamentos ativos cadastrados.', context, {
        suggestions: [{ icon: 'add-circle', label: 'Cadastrar medicamento', prompt: 'Quero cadastrar um medicamento.' }],
      });
      const lines = medications.map((medication) => {
        const times = medication.schedules.map((schedule) => schedule.dose_time.slice(0, 5)).join(', ');
        return `• ${medication.name} ${medication.dosage}${times ? ` · ${times}` : ''}`;
      });
      return response(intent, `Você tem ${medications.length} ${medications.length === 1 ? 'medicamento ativo' : 'medicamentos ativos'}:\n\n${lines.join('\n')}`, context, {
        suggestions: [{ icon: 'today', label: 'Ver agenda de hoje', prompt: 'Quais medicamentos eu tomo hoje?' }],
      });
    }
    case 'confirm_dose':
      return handleConfirmDose(userId, message, context, data);
    case 'history': {
      const [history, dashboard] = await Promise.all([data.getHistory(userId, 7), data.getDashboard(userId)]);
      const todayKey = new Date().toDateString();
      const todayEvents = history.filter((event) => new Date(event.scheduled_for).toDateString() === todayKey);
      const confirmed = todayEvents.filter((event) => event.status === 'taken').length;
      const missed = todayEvents.filter((event) => event.status === 'skipped' || event.status === 'missed').length;
      const pending = dashboard.doses.filter((dose) => !['taken', 'skipped'].includes(dose.status)).length;
      return response(intent, `Hoje você confirmou ${confirmed} ${confirmed === 1 ? 'dose' : 'doses'}, possui ${pending} ${pending === 1 ? 'dose pendente' : 'doses pendentes'}${missed ? ` e ${missed} ${missed === 1 ? 'registro não tomado' : 'registros não tomados'}` : ''}. O histórico completo está na aba Histórico.`, context, {
        suggestions: [{ icon: 'insights', label: 'Ver adesão', prompt: 'Como está minha adesão esta semana?' }],
      });
    }
    case 'adherence': {
      const analytics = await data.getAnalytics(userId, 7);
      if (!analytics.duePlanned) return response(intent, 'Ainda não há doses vencidas suficientes para calcular sua adesão semanal.', context);
      const attention = analytics.criticalHour
        ? ` O horário com mais registros pendentes foi por volta de ${analytics.criticalHour}.`
        : analytics.attentionCount
          ? ` Há ${analytics.attentionCount} ${analytics.attentionCount === 1 ? 'dose que precisa' : 'doses que precisam'} de atenção no período.`
          : ' Todas as doses que já chegaram foram confirmadas.';
      return response(intent, `Sua adesão nos últimos 7 dias está em ${analytics.dueAdherence}%. Foram ${analytics.dueTaken} de ${analytics.duePlanned} doses já vencidas confirmadas.${attention}`, context, {
        suggestions: [{ icon: 'history', label: 'Resumo do histórico', prompt: 'Resuma meu histórico.' }],
      });
    }
    case 'add_medication':
      context.flow = { kind: 'medication_registration', step: 'name', draft: {} };
      context.pendingAction = null;
      return response(intent, `Claro. Vou pedir uma informação por vez e só salvarei depois da sua confirmação. ${registrationPrompt('name')}`, context);
    case 'navigation':
      return response(intent, 'Use a barra inferior para abrir Início, Progresso, IA HUB, Histórico ou Perfil. Para cadastrar e gerenciar medicamentos, abra Perfil e escolha “Adicionar medicamento”.', context, { suggestions: HOME_SUGGESTIONS });
    default:
      context.fallbackCount += 1;
      return response('fallback', context.fallbackCount >= 2
        ? 'Ainda não consegui identificar o pedido. Tente uma das opções abaixo ou escreva, por exemplo, “qual é minha próxima dose?”.'
        : 'Não consegui entender completamente. Você quer consultar seus medicamentos, registrar uma toma ou cadastrar um novo remédio?', context, {
        suggestions: context.fallbackCount >= 2 ? HOME_SUGGESTIONS : HOME_SUGGESTIONS.slice(0, 4),
      });
  }
}
