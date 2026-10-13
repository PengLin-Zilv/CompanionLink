const CSV_COLUMNS = [
  "Timestamp_Local", "Local_Timezone", "Timestamp_UTC", "Timestamp_Eastern",
  "From", "Text", "Reaction", "ID"
];

const easternFormatter = createTimestampFormatter("America/New_York");

export function normalizeParticipantFilename(participantId) {
  const raw = String(participantId ?? "").trim();
  const withoutCsv = raw.toLowerCase().endsWith(".csv") ? raw.slice(0, -4) : raw;
  const core = withoutCsv[0]?.toLowerCase() === "p" ? withoutCsv.slice(1) : withoutCsv;

  if (!core || !/^[A-Za-z0-9_-]+$/.test(core)) {
    throw new Error("Participant ID must contain only letters, numbers, underscores, or hyphens.");
  }

  return `P${core}.csv`;
}

export function messagesToRows(historyEvent, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const payload = historyEvent?.payload ?? {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const reactions = reactionsByMessageId(payload.message_reactions);
  const records = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const instantMs = new Date(message.meta.timestamp).getTime();
    if (Number.isNaN(instantMs)) {
      throw new Error(`Invalid message timestamp: ${message.meta.timestamp}`);
    }
    records.push({
      id: message.id,
      instantMs,
      from: message.meta.nature === "Robot" ? "Rep" : "Me",
      text: String(message.content?.text ?? ""),
      reaction: reactions.get(message.id) ?? "None"
    });
  }

  return recordsToRows(records, timeZone);
}

// A record is { id, instantMs, from, text, reaction }, with instantMs in integer
// epoch milliseconds. Rows keep the records' order (each platform sends newest
// first). Every platform goes through here, so the time columns follow one rule.
export function recordsToRows(records, timeZone) {
  if (typeof timeZone !== "string") {
    throw new Error("Missing time zone.");
  }
  const localFormatter = createTimestampFormatter(timeZone);

  return records.map(({ id, instantMs, from, text, reaction }) => {
    if (!Number.isInteger(instantMs)) {
      throw new Error(`Invalid message time: ${instantMs}`);
    }
    const date = new Date(instantMs);
    return {
      Timestamp_Local: formatTimestamp(date, localFormatter),
      Local_Timezone: timeZone,
      Timestamp_UTC: date.toISOString(),
      Timestamp_Eastern: formatTimestamp(date, easternFormatter),
      From: from,
      Text: text,
      Reaction: reaction,
      ID: id
    };
  });
}

export function buildCsv(rows) {
  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => escapeCsvCell(row[column])).join(","))
  ];

  // The byte order mark lets Excel read the file as UTF-8.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function createTimestampFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
}

function formatTimestamp(date, formatter) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function reactionsByMessageId(messageReactions) {
  const reactions = new Map();

  for (const reaction of messageReactions ?? []) {
    reactions.set(reaction.message_id, reaction.reaction);
  }

  return reactions;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}
