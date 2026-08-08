export type MedicationActivationBoundary = {
  start_date: string;
  end_date: string | null;
  first_dose_time: string;
};

function timeInMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function scheduleIsActiveOnDate(
  dateKey: string,
  medication: MedicationActivationBoundary,
  scheduleTime: string,
) {
  if (dateKey < medication.start_date) return false;
  if (medication.end_date && dateKey > medication.end_date) return false;
  if (dateKey > medication.start_date) return true;

  return timeInMinutes(scheduleTime) >= timeInMinutes(medication.first_dose_time);
}
