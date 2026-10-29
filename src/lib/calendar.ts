export type CalendarEventInput = {
  id: string;
  title: string;
  start?: string | Date | null;
  end?: string | Date | null;
  location?: string;
};

export function openCalendarEvent(input: CalendarEventInput) {
  const params = new URLSearchParams({ eventRef: input.id, title: input.title });
  if (input.start) params.set("start", input.start instanceof Date ? input.start.toISOString() : input.start);
  if (input.end) params.set("end", input.end instanceof Date ? input.end.toISOString() : input.end);
  if (input.location) params.set("location", input.location);
  const link = document.createElement("a");
  link.href = `/api/calendar?${params.toString()}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
