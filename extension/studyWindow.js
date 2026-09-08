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
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  let candidateMs = targetMs;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidateMs))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const observedMs = utcTimestamp(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const adjustmentMs = targetMs - observedMs;

    candidateMs += adjustmentMs;
    if (adjustmentMs === 0) {
      break;
    }
  }

  return candidateMs;
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

function utcTimestamp(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}
