export function getRotationForDate(
  date: Date,
  rotationMapping: Record<string, string>,
  specialsNames: Record<string, string>
): { letter: string; special: string } | null {
  const key = date.toISOString().split('T')[0];
  const letter = rotationMapping[key];
  if (!letter) return null;
  return { letter, special: specialsNames[letter] || 'No Special' };
}

export function getForecast(
  rotationMapping: Record<string, string>,
  specialsNames: Record<string, string>
): { date: Date; letter: string; special: string }[] {
  const forecast: { date: Date; letter: string; special: string }[] = [];
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  let count = 0;
  let daysChecked = 0;
  while (count < 6 && daysChecked < 30) {
    current.setDate(current.getDate() + 1);
    daysChecked++;

    const day = current.getDay();
    if (day === 0 || day === 6) continue;

    const rotation = getRotationForDate(current, rotationMapping, specialsNames);
    if (rotation) {
      forecast.push({ date: new Date(current), ...rotation });
      count++;
    }
  }
  return forecast;
}
