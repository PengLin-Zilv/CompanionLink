export function createStudyWindow({
  startDate,
  endDate,
  submittedAt = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
}) {
  const start = parseDateInput(startDate, "From date");
  const end = parseDateInput(endDate, "To date");
  const submittedAtMs = parseTimestamp(submittedAt, "submit time");

  if (start.iso > end.iso) {
    throw new Error("From date cannot be after To date.");
  }
  if (end.iso > zonedDateString(submittedAtMs, timeZone)) {
    throw new Error("To date cannot be in the future.");
  }

  const startMs = startOfZonedDate(start, timeZone);
  const selectedEndMs = startOfZonedDate(nextCalendarDate(end), timeZone);
  const endMs = Math.min(selectedEndMs, submittedAtMs);

  return {
    timeZone,
    startMs,
    endMs,
    includes(timestamp) {
      const timestampMs = parseTimestamp(timestamp, "message timestamp");
      return startMs <= timestampMs && timestampMs < endMs;
    },
    isOlderThanStart(timestamp) {
      return parseTimestamp(timestamp, "message timestamp") < startMs;
    }
  };
}

function startOfZonedDate({ year, month, day }, timeZone) {
  const targetMs = utcTimestamp(year, month, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const dayMs = 24 * 60 * 60 * 1000;
  let lowerMs = targetMs - dayMs;
  let upperMs = targetMs + dayMs;

  // Find the first instant of the local date, even when midnight is skipped.
  while (lowerMs < upperMs) {
    const candidateMs = Math.floor((lowerMs + upperMs) / 2);
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidateMs))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const observedDateMs = utcTimestamp(parts.year, parts.month, parts.day);

    if (observedDateMs < targetMs) {
      lowerMs = candidateMs + 1;
    } else {
      upperMs = candidateMs;
    }
  }

  return lowerMs;
}

function parseDateInput(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${label} must be a valid date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a valid date.`);
  }

  return { year, month, day, iso: value };
}

function nextCalendarDate({ year, month, day }) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + 1);
  date.setUTCHours(0, 0, 0, 0);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function zonedDateString(timestampMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseTimestamp(timestamp, label) {
  const timestampMs = new Date(timestamp).getTime();

  if (Number.isNaN(timestampMs)) {
    throw new Error(`Invalid ${label}: ${timestamp}`);
  }

  return timestampMs;
}

function utcTimestamp(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
