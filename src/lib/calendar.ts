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
  // The iOS WKWebView cannot render or download an .ics attachment: the
  // navigation fails and the shell shows its offline screen. In the native
  // app, open the inline .ics in a new window instead; the shell hands
  // target=_blank links to Safari, which offers "Add to Calendar".
  const isNativeIOS = /EventPlatform-iOS/i.test(window.navigator.userAgent);
  if (isNativeIOS) { params.set("inline", "1"); link.target = "_blank"; }
  link.href = `${isNativeIOS ? window.location.origin : ""}/api/calendar?${params.toString()}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
