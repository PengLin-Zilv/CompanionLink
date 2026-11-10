// The chat open in a chatgpt.com tab, through the site's own undocumented web API:
// re-test after site changes. Observed behaviour this relies on (November 2026): the
// chat needs the account's access token, which the site's session endpoint gives; it
// comes as a flat list of the messages on screen, oldest first, in pages of up to 100,
// each older page asked for before the oldest message read; and create_time is in epoch
// seconds, not in list order.

// A hung request fails loudly instead of spinning forever.
const RESPONSE_TIMEOUT_MS = 60000;
const TAB_ERROR = "Could not read the ChatGPT tab. Refresh it, then try again.";
// The codes readChatInPage returns, in the participant's words; "http" comes with its
// status instead.
const ERRORS = new Map([
  ["sign-in", "Sign in to ChatGPT in this tab, refresh the page, then try again."],
  ["not-found", "ChatGPT could not find this chat. Open it again from ChatGPT's sidebar, then try again."],
  ["rate-limit", "ChatGPT is limiting requests. Wait a few minutes, then try again."],
  ["unreadable", "Could not read from ChatGPT. Check your connection, refresh the ChatGPT page, then try again."],
  ["not-finished", "ChatGPT has not finished its last reply in this chat. Wait for it to finish, or click Try again on the reply if it stopped, then export again."],
  ["unexpected", chatGptErrorText("an unexpected response")],
  ["incomplete", chatGptErrorText("an incomplete chat")],
  ["invalid", chatGptErrorText("an invalid chat message")],
  ["unsupported", "ChatGPT returned a kind of message CompanionLink cannot export yet. Please send this error to the research team."]
]);

// Only a chat page: https://chatgpt.com/c/<uuid>, or /g/g-<…>/c/<uuid> for a chat with a
// GPT or in a project. Home, temporary-chat, GPT, project and share pages have no chat
// to export. The g- segment never reaches a request, and a strict id keeps a malformed
// path out of every request.
export function parseChatGptChatUrl(url) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== "chatgpt.com") return null;
    const match = /^\/(?:g\/g-[^/]+\/)?c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// Returns the chat's in-window messages as records for recordsToRows, newest first in
// ChatGPT's list order. One packaged function does the whole export inside the tab, so
// the access token never leaves it: only the records or an error code come back.
export async function exportChatGptConversation({ tabId, conversationId, studyWindow }) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: readChatInPage,
    args: [conversationId, studyWindow.startMs, studyWindow.endMs, RESPONSE_TIMEOUT_MS]
  }).catch(() => []);

  const { records, error, status } = injection?.result ?? {};
  if (Array.isArray(records)) return records;
  if (error === "http") throw new Error(chatGptErrorText(`an error (HTTP ${status})`));
  throw new Error(ERRORS.get(error) ?? TAB_ERROR);
}

// Runs in the tab's isolated world, where the page cannot replace fetch and same-origin
// requests still carry the tab's cookies. Chrome rebuilds it from its source, so it must
// not use anything defined outside itself. The access token lives only in this function
// and goes out only as the Authorization header of its requests to chatgpt.com.
async function readChatInPage(conversationId, startMs, endMs, timeoutMs) {
  // Status 0 is no response, a timeout, or a page that is not JSON (such as a check page).
  const getJson = async (url, headers) => {
    try {
      const response = await fetch(url, {
        credentials: "include",
        // Keeps the session and the chat out of Chrome's disk cache, as for Kindroid.
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      });
      return response.ok ? { status: response.status, body: await response.json() } : { status: response.status };
    } catch {
      return { status: 0 };
    }
  };
  const failure = (status) =>
    status === 401 || status === 403 ? { error: "sign-in" }
      : status === 429 ? { error: "rate-limit" }
        : status === 0 ? { error: "unreadable" }
          : { error: "http", status };

  // Only accessToken is read. The rest of the session, the account's details and its
  // other token, goes unread with the response.
  const session = await getJson("https://chatgpt.com/api/auth/session")
    .then(({ status, body }) => ({ status, token: body?.accessToken }));
  if (session.status < 200 || session.status >= 300) return failure(session.status);
  if (typeof session.token !== "string" || session.token === "") return { error: "sign-in" };
  const headers = { Authorization: `Bearer ${session.token}` };

  const records = [];
  const seen = new Set();
  const chatUrl = `https://chatgpt.com/backend-api/conversations/${conversationId}`;
  let url = `${chatUrl}?num_turns=100&include_has_versions=true`;
  for (let first = true; ; first = false) {
    const { status, body: page } = await getJson(url, headers);
    if (status === 404) return { error: "not-found" };
    if (status < 200 || status >= 300) return failure(status);
    const messages = page?.messages;
    if (!Array.isArray(messages) || typeof page.page_info?.has_previous_page !== "boolean") return { error: "unexpected" };
    const hasPrevious = page.page_info.has_previous_page;
    if (first) {
      if (page.conversation_id !== conversationId) return { error: "unexpected" };
      if (messages.length > 0) {
        if (typeof page.current_node !== "string") return { error: "unexpected" };
        // While ChatGPT replies, the list may stop short of the chat's newest message,
        // which the file would then miss.
        if (page.current_node !== messages.at(-1)?.id) return { error: "not-finished" };
      } else if (!hasPrevious) {
        return { error: "unexpected" };
      }
    }
    // An older page was promised.
    if (messages.length === 0) return { error: "incomplete" };

    let oldestCandidateMs = null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      // A repeated id would mean a duplicate row, or a cursor that never moves.
      if (typeof message?.id !== "string" || message.id === "" || seen.has(message.id)) return { error: "incomplete" };
      seen.add(message.id);
      const role = message.author?.role;
      if (typeof role !== "string") return { error: "invalid" };
      if (role !== "user" && role !== "assistant") continue;
      const type = message.content?.content_type;
      if (typeof type !== "string") return { error: "invalid" };
      // Not shown as chat messages: hidden instructions, memory, thinking-panel notes,
      // calls to tools and reasoning. A missing recipient keeps the message.
      if (message.metadata?.is_visually_hidden_from_conversation === true || message.weight === 0 ||
        message.metadata?.is_thinking_preamble_message === true ||
        (typeof message.recipient === "string" && message.recipient !== "all") ||
        ["model_editable_context", "user_editable_context", "thoughts", "reasoning_recap"].includes(type)) continue;

      // Only the time decides what lands in the window, so only a changed time could
      // turn into a silent header-only file: it is checked on every message that could
      // be a row, in the dates or not. The range catches a change of unit.
      if (typeof message.create_time !== "number") return { error: "invalid" };
      const instantMs = Math.round(message.create_time * 1000);
      if (!(instantMs >= Date.UTC(2020, 0, 1) && instantMs < Date.UTC(2100, 0, 1))) return { error: "invalid" };
      oldestCandidateMs = instantMs;
      if (instantMs < startMs || instantMs >= endMs) continue;

      // The other fields are checked in the window only, where they fill the cells. Text
      // is the string parts and voice transcripts, as written; images, audio and other
      // parts without text add nothing. Words anywhere else may be on screen, so they
      // stop the export below or here instead of being dropped.
      const parts = message.content.parts;
      if ((type === "text" || type === "multimodal_text") && !Array.isArray(parts)) return { error: "invalid" };
      if (type === "text" && !parts.every((part) => typeof part === "string")) return { error: "invalid" };
      const pieces = [];
      if (type !== "text" && type !== "multimodal_text" && typeof message.content.text === "string") pieces.push(message.content.text);
      let attached = Array.isArray(message.metadata?.attachments) && message.metadata.attachments.length > 0;
      for (const part of Array.isArray(parts) ? parts : []) {
        if (typeof part === "string") pieces.push(part);
        else if (part?.content_type === "audio_transcription") {
          if (typeof part.text !== "string") return { error: "invalid" };
          pieces.push(part.text);
        } else if (part?.content_type === "image_asset_pointer") attached = true;
        else if (typeof part?.text === "string" && part.text !== "") return { error: "unsupported" };
      }
      const text = pieces.filter((piece) => piece !== "").join("\n\n");
      // An image or file sent without words is still the participant's message, so it
      // keeps an empty row. Any other message without text, such as a reasoning step or
      // a reply not yet written, is left out before its type and status are checked.
      if (text === "" && !(role === "user" && attached)) continue;
      // A new kind of message with text may be words on screen: stop, never drop them.
      if (type !== "text" && type !== "multimodal_text") return { error: "unsupported" };
      if (message.status === "in_progress") return { error: "not-finished" };
      records.push({ id: message.id, instantMs, from: role === "user" ? "Me" : "ChatGPT", text, reaction: "N/A" });
    }

    // Stop once this page's oldest-positioned row candidate is more than a day before
    // From. Times are not in list order: a message on an older page can be newer than
    // that candidate, but only by seconds (observed). A day of slack keeps every message
    // in the dates and costs at most about a day of extra history. A page without a
    // candidate gives no time, so paging goes on.
    if (!hasPrevious || (oldestCandidateMs !== null && oldestCandidateMs < startMs - 86_400_000)) return { records };
    url = `${chatUrl}/messages?before=${encodeURIComponent(messages[0].id)}&num_turns=100&include_has_versions=true`;
  }
}

function chatGptErrorText(what) {
  return `ChatGPT returned ${what}. Please try again.`;
}
