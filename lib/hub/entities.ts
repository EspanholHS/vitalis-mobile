import { normalizeHubText } from './normalization';
import type { MedicationRegistrationStep } from './types';

export function extractTime(value: string) {
  const normalized = normalizeHubText(value);
  const match = normalized.match(/(?:as\s*)?(\d{1,2})(?:\s*[:h]\s*(\d{1,2}))?/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (containsPeriod(normalized, 'tarde') || containsPeriod(normalized, 'noite')) {
    if (hour < 12) hour += 12;
  } else if (containsPeriod(normalized, 'manha') && hour === 12) {
    hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function containsPeriod(value: string, period: string) {
  return value.includes(`da ${period}`) || value.includes(`de ${period}`) || value.includes(`a ${period}`);
}

export function extractIntervalHours(value: string) {
  const normalized = normalizeHubText(value);
  if (/(uma vez (ao|por) dia|1 vez (ao|por) dia|diariamente)/.test(normalized)) return 24;
  if (/(duas vezes (ao|por) dia|2 vezes (ao|por) dia)/.test(normalized)) return 12;
  if (/(tres vezes (ao|por) dia|3 vezes (ao|por) dia)/.test(normalized)) return 8;
  const match = normalized.match(/(?:a cada|cada|de)\s*(\d{1,2})\s*(?:h|hora|horas)/);
  if (!match) return null;
  const hours = Number(match[1]);
  return hours >= 1 && hours <= 24 ? hours : null;
}

export function extractTreatmentDuration(value: string): { durationDays: number | null } | null {
  const normalized = normalizeHubText(value);
  if (/(uso continuo|continuamente|sem data final|sem prazo|tempo indeterminado)/.test(normalized)) {
    return { durationDays: null };
  }

  const dayMatch = normalized.match(/\b(\d{1,4})\s*(?:dia|dias)\b/);
  if (dayMatch) {
    const durationDays = Number(dayMatch[1]);
    return durationDays >= 1 && durationDays <= 3650 ? { durationDays } : null;
  }

  const weekMatch = normalized.match(/\b(\d{1,3})\s*(?:semana|semanas)\b/);
  if (weekMatch) {
    const durationDays = Number(weekMatch[1]) * 7;
    return durationDays >= 1 && durationDays <= 3650 ? { durationDays } : null;
  }

  return null;
}

export function extractStartDate(value: string, now = new Date()) {
  const normalized = normalizeHubText(value);
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (normalized.includes('amanha')) date.setDate(date.getDate() + 1);
  else if (!normalized.includes('hoje')) {
    const match = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (!match) return null;
    const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : now.getFullYear();
    date.setFullYear(year, Number(match[2]) - 1, Number(match[1]));
    if (date.getDate() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1) return null;
  }
  return localDateKey(date);
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function extractCorrectionStep(value: string): MedicationRegistrationStep | null {
  const normalized = normalizeHubText(value);
  if (/(duracao|por quanto tempo|periodo|data final|termino|fim)/.test(normalized)) return 'duration';
  if (/(nome|medicamento|remedio)/.test(normalized)) return 'name';
  if (/(dosagem|dose|mg|ml)/.test(normalized)) return 'dosage';
  if (/(inicio|data|comec)/.test(normalized)) return 'start_date';
  if (/(horario|hora)/.test(normalized)) return 'first_time';
  if (/(frequencia|intervalo|cada)/.test(normalized)) return 'frequency';
  if (/(observacao|orientacao|instrucao)/.test(normalized)) return 'instructions';
  return null;
}

export function extractHourReference(value: string) {
  const normalized = normalizeHubText(value);
  const match = normalized.match(/(?:das|as|dose)\s*(\d{1,2})(?:\s*[:h]\s*(\d{1,2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
