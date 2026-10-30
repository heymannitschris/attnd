/** Events are stored in UTC; always render them in the event's own time zone (never the server's or the viewer's). */
export const DEFAULT_EVENT_TIME_ZONE = "Asia/Bangkok";
export const eventTimeZone = (timezone?: string | null) => timezone || DEFAULT_EVENT_TIME_ZONE;
