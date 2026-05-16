import type { CadenceInput, WeekdayCode } from "@/lib/schemas/meeting";

/**
 * Minimal RRULE encoder/decoder + occurrence expander.
 *
 * Stores cadence as a subset of RFC 5545 RRULE strings the dashboard can
 * round-trip. Just enough expressiveness for weekly / monthly-nth-weekday /
 * monthly-day / one-off — which is all PRD §5.3 needs.
 *
 * Examples emitted:
 *   FREQ=WEEKLY;BYDAY=TU;BYHOUR=7;BYMINUTE=0
 *   FREQ=MONTHLY;BYDAY=1MO;BYHOUR=7;BYMINUTE=0
 *   FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=14;BYMINUTE=0
 *   FREQ=ONCE;DTSTART=20260620T140000
 */

const WEEKDAY_INDEX: Record<WeekdayCode, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const INDEX_WEEKDAY: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const WEEKDAY_LABEL: Record<WeekdayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

export function encodeCadence(c: CadenceInput): string {
  const [hh, mm] = c.timeHHMM.split(":");
  const time = `BYHOUR=${parseInt(hh, 10)};BYMINUTE=${parseInt(mm, 10)}`;
  switch (c.kind) {
    case "weekly":
      return `FREQ=WEEKLY;BYDAY=${c.weekday};${time}`;
    case "monthly_nth":
      return `FREQ=MONTHLY;BYDAY=${c.nth}${c.weekday};${time}`;
    case "monthly_day":
      return `FREQ=MONTHLY;BYMONTHDAY=${c.dayOfMonth};${time}`;
    case "one_off": {
      const dt = c.dateISO!.replace(/-/g, "");
      const t = c.timeHHMM.replace(":", "") + "00";
      return `FREQ=ONCE;DTSTART=${dt}T${t}`;
    }
  }
}

export function decodeCadence(rrule: string): CadenceInput | null {
  const parts = Object.fromEntries(
    rrule.split(";").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    }),
  ) as Record<string, string | undefined>;

  const hh = parts.BYHOUR ? parseInt(parts.BYHOUR, 10) : 0;
  const mm = parts.BYMINUTE ? parseInt(parts.BYMINUTE, 10) : 0;
  const timeHHMM = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  if (parts.FREQ === "WEEKLY" && parts.BYDAY) {
    const weekday = parts.BYDAY as WeekdayCode;
    return { kind: "weekly", weekday, timeHHMM };
  }
  if (parts.FREQ === "MONTHLY" && parts.BYDAY) {
    const m = parts.BYDAY.match(/^(\d)(MO|TU|WE|TH|FR|SA|SU)$/);
    if (m) {
      return {
        kind: "monthly_nth",
        nth: parseInt(m[1], 10),
        weekday: m[2] as WeekdayCode,
        timeHHMM,
      };
    }
  }
  if (parts.FREQ === "MONTHLY" && parts.BYMONTHDAY) {
    return {
      kind: "monthly_day",
      dayOfMonth: parseInt(parts.BYMONTHDAY, 10),
      timeHHMM,
    };
  }
  if (parts.FREQ === "ONCE" && parts.DTSTART) {
    const dt = parts.DTSTART;
    const y = dt.slice(0, 4);
    const mo = dt.slice(4, 6);
    const d = dt.slice(6, 8);
    return {
      kind: "one_off",
      dateISO: `${y}-${mo}-${d}`,
      timeHHMM,
    };
  }
  return null;
}

export function humanCadence(c: CadenceInput): string {
  const t = formatTime(c.timeHHMM);
  switch (c.kind) {
    case "weekly":
      return `Every ${WEEKDAY_LABEL[c.weekday!]} · ${t}`;
    case "monthly_nth": {
      const ord = ordinal(c.nth!);
      return `${ord} ${WEEKDAY_LABEL[c.weekday!]} of each month · ${t}`;
    }
    case "monthly_day": {
      const ord = ordinal(c.dayOfMonth!);
      return `${ord} of each month · ${t}`;
    }
    case "one_off": {
      const d = new Date(`${c.dateISO}T${c.timeHHMM}:00`);
      return `${d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })} · ${t}`;
    }
  }
}

/**
 * Expand a stored RRULE string into concrete Date occurrences within [from, to].
 * Returns at most `limit` items, sorted ascending.
 */
export function expandRrule(
  rrule: string,
  from: Date,
  to: Date,
  limit = 12,
): Date[] {
  const cadence = decodeCadence(rrule);
  if (!cadence) return [];
  const [hh, mm] = cadence.timeHHMM.split(":").map((s) => parseInt(s, 10));
  const out: Date[] = [];

  switch (cadence.kind) {
    case "weekly": {
      const dow = WEEKDAY_INDEX[cadence.weekday!];
      const cursor = new Date(from);
      cursor.setHours(hh, mm, 0, 0);
      // Advance to next matching weekday
      const delta = (dow - cursor.getDay() + 7) % 7;
      cursor.setDate(cursor.getDate() + delta);
      while (cursor <= to && out.length < limit) {
        if (cursor >= from) out.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 7);
      }
      break;
    }
    case "monthly_nth": {
      const dow = WEEKDAY_INDEX[cadence.weekday!];
      const nth = cadence.nth!;
      let y = from.getFullYear();
      let m = from.getMonth();
      while (out.length < limit) {
        const candidate = nthWeekdayOfMonth(y, m, dow, nth, hh, mm);
        if (candidate && candidate > to) break;
        if (candidate && candidate >= from) out.push(candidate);
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
        // Safety: don't expand more than 24 months out.
        if (y > from.getFullYear() + 2) break;
      }
      break;
    }
    case "monthly_day": {
      const day = cadence.dayOfMonth!;
      let y = from.getFullYear();
      let m = from.getMonth();
      while (out.length < limit) {
        const dim = new Date(y, m + 1, 0).getDate();
        if (day <= dim) {
          const candidate = new Date(y, m, day, hh, mm, 0, 0);
          if (candidate > to) break;
          if (candidate >= from) out.push(candidate);
        }
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
        if (y > from.getFullYear() + 2) break;
      }
      break;
    }
    case "one_off": {
      const d = new Date(`${cadence.dateISO}T${cadence.timeHHMM}:00`);
      if (d >= from && d <= to) out.push(d);
      break;
    }
  }
  return out;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  dow: number,
  nth: number,
  hh: number,
  mm: number,
): Date | null {
  const first = new Date(year, month, 1);
  const offset = (dow - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const dim = new Date(year, month + 1, 0).getDate();
  if (day > dim) return null;
  return new Date(year, month, day, hh, mm, 0, 0);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export { WEEKDAY_INDEX, INDEX_WEEKDAY };
