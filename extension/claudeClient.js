// The chat open in a claude.ai tab, through the site's own undocumented web API:
// re-test after site changes. Each request runs inside that tab, so the browser attaches
// the tab's sign-in; CompanionLink never reads it. Observed behaviour this relies on
// (October 2026): a chat is read through its organization, tree=True returns every
// branch and the visible branch's leaf, and the first message's parent is a fixed root id.

const ORIGIN = "https://claude.ai";
const DETAIL_QUERY = "?tree=True&rendering_mode=messages&render_all_tools=true";
const ROOT_ID = "00000000-0000-4000-8000-000000000000";
// A hung request fails loudly instead of spinning forever.
const RESPONSE_TIMEOUT_MS = 60000;
const FROM_LABELS = new Map([["human", "Me"], ["assistant", "Claude"]]);
const SIGN_IN = "Sign in to Claude in this tab, refresh the page, then try again.";

// Only a chat page: https://claude.ai/chat/<uuid>. New-chat, project and share pages
// have no chat to export, and a strict id keeps a malformed path out of every request.
export function parseClaudeChatUrl(url) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== "claude.ai") return null;
    const match = /^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// Returns the visible branch's in-window messages as records for recordsToRows, newest
// first. Only created_at decides what lands in the window, so only a changed time could
// turn into a silent header-only file: it is checked on every message of the branch.
// The other fields are checked in the window only, where they fill the cells; checking
// them on old messages would only let one odd historical message block the chat forever.
export async function exportClaudeConversation({
  tabId,
  conversationId,
  studyWindow,
  getJson = claudeTabFetcher(tabId)
}) {
  const records = [];
  for (const message of visibleBranch(await findConversation(getJson, conversationId))) {
    const instantMs = messageTime(message);
    if (studyWindow.startMs <= instantMs && instantMs < studyWindow.endMs) records.push(toRecord(message, instantMs));
  }
  return records;
}

// A login can hold several organizations (say, personal and university), and the chat
// lives in one of them. Each is asked in turn; any 4xx but 401 (signed out) and 429
// (slow down) is that organization saying no.
async function findConversation(getJson, conversationId) {
  const organizations = await getJson("/api/organizations");
  if (!Array.isArray(organizations) || !organizations.every((organization) => typeof organization?.uuid === "string")) {
    throw claudeError("an unexpected response");
  }
  // A signed-in login always has one.
  if (organizations.length === 0) throw new Error(SIGN_IN);

  for (const { uuid } of organizations) {
    let conversation;
    try {
      conversation = await getJson(
        `/api/organizations/${encodeURIComponent(uuid)}/chat_conversations/${conversationId}${DETAIL_QUERY}`
      );
    } catch (error) {
      if (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) continue;
      throw error;
    }
    if (conversation?.uuid !== conversationId || !Array.isArray(conversation.chat_messages)) {
      throw claudeError("an unexpected response");
    }
    return conversation;
  }
  throw new Error("Claude could not find this chat. Open it again from Claude's sidebar, then try again.");
}

// Edits and retries leave other branches; keep the one on screen. Walking back from its
// leaf gives it newest first, since a message is always created after its parent.
function visibleBranch({ chat_messages: messages, current_leaf_message_uuid: leaf }) {
  if (messages.length === 0) return [];
  if (typeof leaf !== "string") throw claudeError("an incomplete chat");
  // While Claude replies, the leaf still points at the previous reply and the
  // participant's newest message hangs below it, so the walk would drop it. A failed or
  // interrupted reply may leave the same shape, and the extension cannot tell the two
  // apart, so the text covers both.
  if (messages.some((message) => message?.parent_message_uuid === leaf)) {
    throw new Error("Claude has not finished its last reply in this chat. Wait for it to finish, or click Retry in Claude if it stopped, then try again.");
  }

  const messagesById = new Map(messages.map((message) => [message?.uuid, message]));
  const branch = [];
  for (let id = leaf; id !== ROOT_ID; id = branch.at(-1).parent_message_uuid) {
    // A walk longer than the chat is a loop.
    if (!messagesById.get(id) || branch.length === messages.length) throw claudeError("an incomplete chat");
    branch.push(messagesById.get(id));
  }
  return branch;
}

// Times must name their zone; without one, Date.parse would read local time. It keeps
// the millisecond of a microsecond time, so the result is an integer.
function messageTime({ created_at: createdAt }) {
  const instantMs = typeof createdAt === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(createdAt)
    ? Date.parse(createdAt)
    : Number.NaN;
  if (!Number.isInteger(instantMs)) throw claudeError("an invalid chat message");
  return instantMs;
}

function toRecord(message, instantMs) {
  const valid = typeof message.uuid === "string" && message.uuid !== "" &&
    FROM_LABELS.has(message.sender) &&
    Array.isArray(message.content) &&
    message.content.every((block) => block?.type !== "text" || typeof block.text === "string");
  if (!valid) throw claudeError("an invalid chat message");

  return {
    id: message.uuid,
    instantMs,
    from: FROM_LABELS.get(message.sender),
    text: messageText(message.content),
    reaction: "N/A"
  };
}

// Text blocks only, as written: tool calls and results, platform-injected and other
// blocks stay out. A cited answer splits one sentence across adjacent text blocks, so
// those join directly; text resuming after another block starts a new paragraph.
function messageText(content) {
  const runs = [""];
  for (const block of content) {
    if (block?.type === "text") runs[runs.length - 1] += block.text;
    else if (runs.at(-1) !== "") runs.push("");
  }
  return runs.filter((run) => run !== "").join("\n\n");
}

// Runs each request inside the claude.ai tab. Status 0 is no response, a timeout, or a
// page that is not JSON (such as a check page).
export function claudeTabFetcher(tabId) {
  return async (path) => {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: getJsonInPage,
      args: [ORIGIN + path, RESPONSE_TIMEOUT_MS]
    }).catch(() => {
      throw new Error("Could not read the Claude tab. Refresh it, then try again.");
    });

    const { status = 0, body } = injection?.result ?? {};
    if (status >= 200 && status < 300) return body;
    throw Object.assign(new Error(statusMessage(status)), { status });
  };
}

function statusMessage(status) {
  if (status === 401 || status === 403) return SIGN_IN;
  if (status === 429) return "Claude is limiting requests. Wait a few minutes, then try again.";
  if (status === 0) return "Could not read from Claude. Check your connection, refresh the Claude page, then try again.";
  return `Claude returned an error (HTTP ${status}). Please try again.`;
}

// Runs in the tab's isolated world, where the page cannot replace fetch and same-origin
// requests still carry the tab's cookies. Chrome rebuilds it from its source, so it must
// not use anything defined outside itself.
async function getJsonInPage(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      credentials: "include",
      // Keeps chat text out of Chrome's disk cache, as for Kindroid.
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
    return response.ok ? { status: response.status, body: await response.json() } : { status: response.status };
  } catch {
    return { status: 0 };
  }
}

function claudeError(what) {
  return new Error(`Claude returned ${what}. Please try again.`);
}
