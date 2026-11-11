/** House of Track is in Portland: every date in the console reads Pacific time. */
export const TZ = "America/Los_Angeles";

export function fmtDate(d: Date | string | null | undefined, withTime = true): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
  });
}

/** For <input type="datetime-local">: the Pacific wall-clock time, "YYYY-MM-DDTHH:mm". */
export function toPacificInput(d: Date | null): string {
  if (!d) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * The reverse: a Pacific wall-clock "YYYY-MM-DDTHH:mm" → an ISO instant. Done on
 * the server's clock-independent math (not the browser's zone), so an admin
 * travelling outside Pacific still sets the time House of Track means.
 */
export function pacificInputToIso(value: string): string {
  if (!value) return "";
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Find Pacific's offset at that moment (handles PST/PDT), then correct once.
  const offsetAt = (t: number) => {
    const s = new Date(t).toLocaleString("en-US", { timeZone: TZ, hourCycle: "h23" });
    return Date.parse(`${s} UTC`) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t).toISOString();
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Checkout open",
  paid: "To ship",
  fulfilled: "Shipped",
  refunded: "Refunded",
  cancelled: "Cancelled",
  draft: "Draft",
  live: "Live",
  closed: "Closed",
  upcoming: "Upcoming",
  open: "Selling",
  ended: "Ended",
};
