export function createStudyWindow({
  startDate,
  submittedAt = new Date(),
  timeZone = "America/New_York"
}) {
  const startMs = startOfZonedDate(startDate, timeZone);
  const endMs = parseTimestamp(submittedAt, "submit time");

  if (startMs > endMs) {
    throw new Error("Study start date cannot be in the future.");
  }

  return {
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

function startOfZonedDate(startDate, timeZone) {
  const { year, month, day } = parseDateInput(startDate);
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

function parseDateInput(startDate) {
  if (typeof startDate !== "string" || startDate.trim() === "") {
    throw new Error("Study start date is required.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!match) {
    throw new Error("Study start date must be a valid date.");
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
    throw new Error("Study start date must be a valid date.");
  }

  return { year, month, day };
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
