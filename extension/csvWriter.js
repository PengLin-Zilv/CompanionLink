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
  const rows = [];
  const localFormatter = createTimestampFormatter(timeZone);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const date = new Date(message.meta.timestamp);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid message timestamp: ${message.meta.timestamp}`);
    }
    rows.push({
      Timestamp_Local: formatTimestamp(date, localFormatter),
      Local_Timezone: timeZone,
      Timestamp_UTC: date.toISOString(),
      Timestamp_Eastern: formatTimestamp(date, easternFormatter),
      From: message.meta.nature === "Robot" ? "Rep" : "Me",
      Text: String(message.content?.text ?? ""),
      Reaction: reactions.get(message.id) ?? "None",
      ID: message.id
    });
  }

  return rows;
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
