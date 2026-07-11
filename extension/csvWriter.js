const CSV_COLUMNS = ["Timestamp", "From", "Text", "Reaction", "ID"];

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

export function normalizeParticipantFilename(participantId) {
  const raw = String(participantId ?? "").trim();
  const withoutCsv = raw.toLowerCase().endsWith(".csv") ? raw.slice(0, -4) : raw;
  const core = withoutCsv[0]?.toLowerCase() === "p" ? withoutCsv.slice(1) : withoutCsv;

  if (!core || !/^[A-Za-z0-9_-]+$/.test(core)) {
    throw new Error("Participant ID must contain only letters, numbers, underscores, or hyphens.");
  }

  return `P${core}.csv`;
}

export function messagesToRows(historyEvent) {
  const payload = historyEvent?.payload ?? {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const reactions = reactionsByMessageId(payload.message_reactions);
  const rows = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    rows.push({
      Timestamp: formatNewYorkTimestamp(message.meta.timestamp),
      From: message.meta.nature === "Robot" ? "Rep" : "Me",
      Text: String(message.content?.text ?? "").replaceAll("\n", "\\n"),
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

  return `${lines.join("\r\n")}\r\n`;
}

export function formatNewYorkTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid message timestamp: ${timestamp}`);
  }

  const parts = Object.fromEntries(
    nyFormatter.formatToParts(date)
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
