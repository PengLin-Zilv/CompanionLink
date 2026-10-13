// Kindroid history through its documented, read-only endpoint, with the participant's
// own API key. Facts from the 2026-09-30 live checks: the cursor is strictly after
// and accepts any value, timestamps are integer epoch milliseconds, and messages
// come oldest first.

const ENDPOINT = "https://api.kindroid.ai/v1/get-chat-messages";
const PAGE_SIZE = 100;
const RESPONSE_TIMEOUT_MS = 30000;
// Rejects a timestamp in seconds, which would otherwise read as 1970.
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2020, 0, 1);

// Only a one-to-one chat page: https://kindroid.ai/v2/chat/<ai_id>.
// Group (/v2/chat/group/...), room and V1 pages do not match.
export function parseKindroidChatUrl(url) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== "kindroid.ai") return null;
    const match = /^\/v2\/chat\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Returns the chat's in-window messages as records for recordsToRows, newest first.
export async function exportKindroidHistory({
  apiKey,
  aiId,
  studyWindow,
  onProgress = () => {},
  fetchImpl = globalThis.fetch,
  pageSize = PAGE_SIZE
}) {
  const request = (params) => requestPage(fetchImpl, apiKey, { ai_id: aiId, ...params });

  // An unknown ai_id returns HTTP 200 with no messages, so first check the chat
  // has any message at all. This also rejects a bad key before paging.
  const first = await request({ limit: 1 });
  if (first.messages.length === 0) {
    throw new Error("No messages found for this Kindroid chat. Open the chat you want to export and try again.");
  }
  // Validate here too: if the unit ever changed, the window walk would silently
  // return nothing, because the server compares the cursor in its own unit.
  const companionName = readCompanionName(validateMessage(first.messages[0]));

  const records = [];
  const seenIds = new Set();
  let previousMs = -Infinity;
  // The cursor is strictly after, so startMs - 1 includes a message at startMs.
  let cursor = studyWindow.startMs - 1;

  while (true) {
    const page = await request({ limit: pageSize, start_after_timestamp: cursor });
    let freshCount = 0;
    let reachedEnd = false;
    let lastMs = cursor;

    for (const raw of page.messages) {
      const message = validateMessage(raw);
      lastMs = message.timestamp;
      if (seenIds.has(message.id)) continue;
      seenIds.add(message.id);
      freshCount += 1;

      if (message.timestamp < previousMs) {
        throw new Error("Kindroid returned messages out of order. Please try again.");
      }
      previousMs = message.timestamp;
      if (message.timestamp >= studyWindow.endMs) {
        reachedEnd = true;
        break;
      }
      if (message.timestamp < studyWindow.startMs) {
        throw new Error("Kindroid returned a message outside the requested dates. Please try again.");
      }
      records.push(toRecord(message));
    }

    onProgress(records.length);
    if (reachedEnd || !page.hasMore) break;
    if (freshCount === 0) {
      throw new Error("Kindroid kept returning the same messages. Please try again.");
    }
    // Ask again from the page's last millisecond: a message sharing that exact
    // time cannot be skipped, and the repeat is dropped by its id.
    cursor = lastMs - 1;
  }

  return { records: records.reverse(), companionName };
}

async function requestPage(fetchImpl, apiKey, params) {
  const url = new URL(ENDPOINT);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(RESPONSE_TIMEOUT_MS)
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new Error("Kindroid did not respond in time. Please try again.");
    }
    throw new Error("Could not reach Kindroid. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error(statusMessage(response.status));
  }

  let body;
  try {
    body = JSON.parse(await response.text()); // served as text/plain
  } catch {
    throw new Error("Kindroid returned an unreadable response. Please try again.");
  }
  if (!Array.isArray(body?.messages) || typeof body?.pagination?.hasMore !== "boolean") {
    throw new Error("Kindroid returned an unexpected response. Please try again.");
  }
  return { messages: body.messages, hasMore: body.pagination.hasMore };
}

function statusMessage(status) {
  if (status === 401) return "Kindroid did not accept this API key. If you regenerated it, copy the new key.";
  if (status === 403) return "Kindroid did not allow access to this chat.";
  if (status === 400) return "Kindroid could not find this chat. Open the chat you want to export and try again.";
  // Either the 30-second or the daily limit; the status alone does not say which.
  if (status === 429) return "Kindroid is limiting requests. Wait a minute and try again; if it keeps failing, try again tomorrow.";
  if (status >= 500) return "Kindroid is not responding. Please try again later.";
  return `Kindroid returned an error (HTTP ${status}). Please try again.`;
}

// The text may be absent (an image-only message) but never another type: a changed
// response format must fail, not export empty Text cells.
function validateMessage(raw) {
  const valid = raw &&
    typeof raw.id === "string" && raw.id.trim() !== "" &&
    Number.isInteger(raw.timestamp) && raw.timestamp >= EARLIEST_PLAUSIBLE_MS &&
    (raw.sender === "ai" || raw.sender === "user") &&
    (raw.message == null || typeof raw.message === "string");
  if (!valid) {
    throw new Error("Kindroid returned an invalid chat message. Please try again.");
  }
  return raw;
}

// From labels decided October 13, 2026; Reaction is N/A because the API returns no
// reactions (decided October 2). Text is kept as written, line breaks included.
function toRecord(message) {
  return {
    id: message.id,
    instantMs: message.timestamp,
    from: message.sender === "user" ? "Me" : "Kin",
    text: message.message ?? "",
    reaction: "N/A"
  };
}

function readCompanionName(message) {
  if (message?.sender !== "ai" || typeof message.display_name !== "string") return null;
  const name = message.display_name.trim();
  return name ? name.slice(0, 60) : null;
}
