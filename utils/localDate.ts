export function localDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localWeekStartIso(date = new Date()): string {
  const monday = new Date(date);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return localDateIso(monday);
}

export function nextLocalMondayIso(date = new Date()): string {
  const monday = new Date(date);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() + (weekday === 0 ? 1 : 8 - weekday));
  return localDateIso(monday);
}
