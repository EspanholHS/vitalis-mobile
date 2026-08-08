import { supabase } from '@/lib/supabase';
import type { MedicationColorToken } from '@/constants/vitalis-theme';
import type { Tables } from '@/types/database';
import { scheduleIsActiveOnDate } from '@/lib/schedule-activation';

export type Medication = Tables<'medications'>;
export type MedicationSchedule = Tables<'medication_schedules'>;
export type DoseEvent = Tables<'dose_events'>;

export type MedicationWithSchedules = Medication & {
  schedules: MedicationSchedule[];
};

export type DoseStatus = DoseEvent['status'] | 'pending' | 'late';

export type DailyDose = {
  key: string;
  medication: Medication;
  scheduledFor: Date;
  scheduleTime: string;
  event: DoseEvent | null;
  status: DoseStatus;
};

export type DashboardData = {
  medications: MedicationWithSchedules[];
  doses: DailyDose[];
  nextDose: DailyDose | null;
  plannedCount: number;
  takenCount: number;
  lateCount: number;
  adherence: number;
};

export type MedicationInput = {
  name: string;
  dosage: string;
  instructions: string;
  intervalHours: number;
  firstDoseTime: string;
  startDate?: string;
  endDate?: string | null;
  colorToken: MedicationColorToken;
};

export type HistoryItem = DoseEvent & {
  medication: Medication | null;
};

export type AnalyticsDay = {
  key: string;
  label: string;
  planned: number;
  taken: number;
  skipped: number;
  duePlanned: number;
  dueTaken: number;
  upcoming: number;
  percent: number;
};

export type AnalyticsSummary = {
  days: AnalyticsDay[];
  adherence: number;
  dueAdherence: number;
  taken: number;
  planned: number;
  dueTaken: number;
  duePlanned: number;
  upcomingCount: number;
  attentionCount: number;
  bestHour: string | null;
  criticalHour: string | null;
  byMedication: { medication: Medication; taken: number; planned: number; percent: number }[];
};

function requireUserId(userId: string | undefined) {
  if (!userId) throw new Error('Sessão expirada. Entre novamente.');
  return userId;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function timeLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function shortDateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

export function longDateLabel(value = new Date()) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function buildDoseDate(date: Date, doseTime: string) {
  const [hour, minute] = doseTime.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

export function doseCanBeRecorded(dose: Pick<DailyDose, 'scheduledFor'>, now = new Date()) {
  return dose.scheduledFor.getTime() <= now.getTime();
}

export function generateDoseTimes(firstDoseTime: string, intervalHours: number) {
  const [hour, minute] = firstDoseTime.split(':').map(Number);
  const result: string[] = [];
  const seen = new Set<number>();
  let current = hour * 60 + minute;

  while (!seen.has(current) && result.length < 24) {
    seen.add(current);
    result.push(`${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}:00`);
    current = (current + intervalHours * 60) % 1440;
  }

  return result.sort();
}

export async function listMedications(userId?: string) {
  requireUserId(userId);
  const [medicationResult, scheduleResult] = await Promise.all([
    supabase.from('medications').select('*').order('is_active', { ascending: false }).order('name'),
    supabase.from('medication_schedules').select('*').order('dose_time'),
  ]);

  if (medicationResult.error) throw medicationResult.error;
  if (scheduleResult.error) throw scheduleResult.error;

  return (medicationResult.data ?? []).map<MedicationWithSchedules>((medication) => ({
    ...medication,
    schedules: (scheduleResult.data ?? []).filter((schedule) => schedule.medication_id === medication.id),
  }));
}

export async function createMedication(userId: string | undefined, input: MedicationInput) {
  requireUserId(userId);
  const doseTimes = generateDoseTimes(input.firstDoseTime, input.intervalHours);
  const { data, error } = await supabase.rpc('create_medication_with_schedules', {
    p_name: input.name.trim(),
    p_dosage: input.dosage.trim(),
    p_instructions: input.instructions.trim(),
    p_interval_hours: input.intervalHours,
    p_start_date: input.startDate ?? localDateKey(),
    p_end_date: (input.endDate ?? null) as unknown as string,
    p_color_token: input.colorToken,
    p_first_dose_time: input.firstDoseTime,
    p_dose_times: doseTimes,
  });

  if (error) throw error;
  return data;
}

export async function setMedicationActive(
  userId: string | undefined,
  medicationId: string,
  isActive: boolean,
) {
  requireUserId(userId);
  const { error } = await supabase
    .from('medications')
    .update({ is_active: isActive })
    .eq('id', medicationId);
  if (error) throw error;
}

export async function deleteMedication(userId: string | undefined, medicationId: string) {
  requireUserId(userId);
  const { error } = await supabase.from('medications').delete().eq('id', medicationId);
  if (error) throw error;
}

export async function getDoseEvents(userId: string | undefined, start: Date, end: Date) {
  requireUserId(userId);
  const { data, error } = await supabase
    .from('dose_events')
    .select('*')
    .gte('scheduled_for', start.toISOString())
    .lt('scheduled_for', end.toISOString())
    .order('scheduled_for', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDashboard(userId: string | undefined, date = new Date()): Promise<DashboardData> {
  const { start, end } = localDayRange(date);
  const [medications, events] = await Promise.all([
    listMedications(userId),
    getDoseEvents(userId, start, end),
  ]);
  const eventMap = new Map(
    events.map((event) => [`${event.medication_id}-${new Date(event.scheduled_for).getTime()}`, event]),
  );
  const now = new Date();

  const doses = medications
    .filter((medication) => medication.is_active)
    .flatMap((medication) =>
      medication.schedules
        .filter((schedule) => scheduleIsActiveOnDate(localDateKey(date), medication, schedule.dose_time))
        .map<DailyDose>((schedule) => {
          const scheduledFor = buildDoseDate(date, schedule.dose_time);
          const event = eventMap.get(`${medication.id}-${scheduledFor.getTime()}`);
          const status: DoseStatus = event?.status ?? (scheduledFor < now ? 'late' : 'pending');
          return {
            key: `${medication.id}-${schedule.dose_time}`,
            medication,
            scheduledFor,
            scheduleTime: schedule.dose_time,
            event: event ?? null,
            status,
          };
        }),
    )
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  const takenCount = doses.filter((dose) => dose.status === 'taken').length;
  const lateCount = doses.filter((dose) => dose.status === 'late' || dose.status === 'missed').length;
  const plannedCount = doses.length;
  const nextDose =
    doses.find((dose) => dose.status === 'pending' || dose.status === 'late' || dose.status === 'snoozed') ?? null;

  return {
    medications,
    doses,
    nextDose,
    plannedCount,
    takenCount,
    lateCount,
    adherence: plannedCount ? Math.round((takenCount / plannedCount) * 100) : 0,
  };
}

export async function recordDose(
  userId: string | undefined,
  dose: DailyDose,
  status: 'taken' | 'skipped',
  source: 'app' | 'hub' = 'app',
) {
  const id = requireUserId(userId);
  if (!doseCanBeRecorded(dose)) {
    throw new Error('future_dose_event_not_allowed');
  }
  const payload = {
    user_id: id,
    medication_id: dose.medication.id,
    scheduled_for: dose.scheduledFor.toISOString(),
    status,
    source,
    taken_at: status === 'taken' ? new Date().toISOString() : null,
    snoozed_until: null,
  };

  const { error } = await supabase
    .from('dose_events')
    .upsert(payload, { onConflict: 'medication_id,scheduled_for' });
  if (error) throw error;
}

export async function getHistory(userId: string | undefined, days = 30) {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  const [events, medications] = await Promise.all([
    getDoseEvents(userId, start, end),
    listMedications(userId),
  ]);

  return events.map<HistoryItem>((event) => ({
    ...event,
    medication: medications.find((medication) => medication.id === event.medication_id) ?? null,
  }));
}

export async function getAnalytics(userId: string | undefined, days = 7): Promise<AnalyticsSummary> {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const [medications, events] = await Promise.all([
    listMedications(userId),
    getDoseEvents(userId, start, new Date(end.getTime() + 1)),
  ]);
  const eventMap = new Map(
    events.map((event) => [`${event.medication_id}-${new Date(event.scheduled_for).getTime()}`, event]),
  );
  const dayRows: AnalyticsDay[] = [];
  const medicationTotals = new Map<string, { planned: number; taken: number }>();
  const hourTotals = new Map<string, { planned: number; taken: number }>();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const isToday = localDateKey(date) === localDateKey();
    let planned = 0;
    let taken = 0;
    let skipped = 0;
    let duePlanned = 0;
    let dueTaken = 0;
    let upcoming = 0;

    for (const medication of medications) {
      for (const schedule of medication.schedules) {
        if (!scheduleIsActiveOnDate(localDateKey(date), medication, schedule.dose_time)) continue;
        const scheduled = buildDoseDate(date, schedule.dose_time);
        const isDue = !isToday || scheduled.getTime() <= now.getTime();
        planned += 1;
        const total = medicationTotals.get(medication.id) ?? { planned: 0, taken: 0 };
        total.planned += 1;
        const event = eventMap.get(`${medication.id}-${scheduled.getTime()}`);
        if (event?.status === 'taken') {
          taken += 1;
          total.taken += 1;
        } else if (event?.status === 'skipped' || event?.status === 'missed') {
          skipped += 1;
        }

        if (isDue) {
          duePlanned += 1;
          const hour = schedule.dose_time.slice(0, 5);
          const hourTotal = hourTotals.get(hour) ?? { planned: 0, taken: 0 };
          hourTotal.planned += 1;
          if (event?.status === 'taken') {
            dueTaken += 1;
            hourTotal.taken += 1;
          }
          hourTotals.set(hour, hourTotal);
        } else {
          upcoming += 1;
        }
        medicationTotals.set(medication.id, total);
      }
    }

    dayRows.push({
      key: localDateKey(date),
      label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', ''),
      planned,
      taken,
      skipped,
      duePlanned,
      dueTaken,
      upcoming,
      percent: planned ? Math.round((taken / planned) * 100) : 0,
    });
  }

  const planned = dayRows.reduce((sum, day) => sum + day.planned, 0);
  const taken = dayRows.reduce((sum, day) => sum + day.taken, 0);
  const duePlanned = dayRows.reduce((sum, day) => sum + day.duePlanned, 0);
  const dueTaken = dayRows.reduce((sum, day) => sum + day.dueTaken, 0);
  const upcomingCount = dayRows.reduce((sum, day) => sum + day.upcoming, 0);
  const attentionCount = Math.max(0, duePlanned - dueTaken);
  const rankedHours = [...hourTotals.entries()].filter(([, total]) => total.planned > 0);
  rankedHours.sort((a, b) => {
    const rateDifference = b[1].taken / b[1].planned - a[1].taken / a[1].planned;
    return rateDifference || b[1].planned - a[1].planned;
  });
  const bestRate = rankedHours[0] ? rankedHours[0][1].taken / rankedHours[0][1].planned : null;
  const hasUniqueBest = bestRate !== null
    && rankedHours.filter(([, total]) => total.taken / total.planned === bestRate).length === 1;
  const attentionHours = rankedHours
    .filter(([, total]) => total.taken < total.planned)
    .sort((a, b) => {
      const rateDifference = a[1].taken / a[1].planned - b[1].taken / b[1].planned;
      return rateDifference || (b[1].planned - b[1].taken) - (a[1].planned - a[1].taken);
    });
  const criticalRate = attentionHours[0]
    ? attentionHours[0][1].taken / attentionHours[0][1].planned
    : null;
  const hasUniqueCritical = criticalRate !== null
    && attentionHours.filter(([, total]) => total.taken / total.planned === criticalRate).length === 1;

  return {
    days: dayRows,
    adherence: planned ? Math.round((taken / planned) * 100) : 0,
    dueAdherence: duePlanned ? Math.round((dueTaken / duePlanned) * 100) : 0,
    taken,
    planned,
    dueTaken,
    duePlanned,
    upcomingCount,
    attentionCount,
    bestHour: hasUniqueBest ? rankedHours[0][0] : null,
    criticalHour: hasUniqueCritical ? attentionHours[0][0] : null,
    byMedication: medications
      .filter((medication) => medicationTotals.has(medication.id))
      .map((medication) => {
        const total = medicationTotals.get(medication.id)!;
        return {
          medication,
          ...total,
          percent: total.planned ? Math.round((total.taken / total.planned) * 100) : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent),
  };
}
