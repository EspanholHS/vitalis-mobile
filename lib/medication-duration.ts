const MAX_TREATMENT_DAYS = 3650;

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function calculateTreatmentEndDate(startDate: string, durationDays: number | null) {
  if (durationDays === null) return null;
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_TREATMENT_DAYS) {
    throw new Error('invalid_treatment_duration');
  }

  const endDate = parseDateKey(startDate);
  endDate.setDate(endDate.getDate() + durationDays - 1);
  return dateKey(endDate);
}

export function treatmentDurationDays(startDate: string, endDate: string | null) {
  if (!endDate) return null;
  const cursor = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  let days = 1;

  while (dateKey(cursor) < dateKey(end) && days <= MAX_TREATMENT_DAYS) {
    cursor.setDate(cursor.getDate() + 1);
    days += 1;
  }

  return days;
}

export function formatDateKey(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(parseDateKey(value))
    .replace('.', '');
}

export function treatmentDurationLabel(startDate: string, endDate: string | null) {
  const days = treatmentDurationDays(startDate, endDate);
  if (days === null) return 'Uso contínuo';
  return `${days} ${days === 1 ? 'dia' : 'dias'} · até ${formatDateKey(endDate!)}`;
}
