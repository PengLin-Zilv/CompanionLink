// The chat open in a gemini.google.com tab, through the site's own undocumented web API:
// re-test after site changes. Observed behaviour this relies on (November 2026): the
// page's own batchexecute call hNvQHb returns a chat's turns newest first, 10 a page,
// with a cursor for the older page, given the token, build label and session id that
// the page's setup script holds. A turn t is one prompt and the reply on screen:
// - t[0] is ["c_" + chat id, turn id];
// - t[1] links to the next older turn, [chat, its turn id, its shown draft id], and is
//   null on the chat's first turn;
// - t[2][0][0] is the prompt;
// - t[3][0] lists the reply's drafts and t[3][3] is the shown draft's id; a draft c has
//   its text at c[1][0] and its status at c[8][0], 2 once finished;
// - t[4] is the time, [seconds, nanos].

// A hung request fails loudly instead of spinning forever.
const RESPONSE_TIMEOUT_MS = 60000;
const TAB_ERROR = "Could not read the Gemini tab. Refresh it, then try again.";
// The codes readChatInPage returns, in the participant's words; "http" comes with its
// status instead.
const ERRORS = new Map([
  ["sign-in", "Sign in to Gemini in this tab, refresh the page, then try again."],
  ["rate-limit", "Gemini is limiting requests. Wait a few minutes, then try again."],
  ["unreadable", "Could not read from Gemini. Check your connection, refresh the Gemini page, then try again."],
  ["not-finished", "Gemini has not finished its last reply in this chat. Wait for it to finish, or regenerate the reply if it stopped, then export again."],
  ["unexpected", geminiErrorText("an unexpected response")],
  ["incomplete", geminiErrorText("an incomplete chat")],
  ["invalid", geminiErrorText("an invalid chat message")],
  ["unsupported", "Gemini returned a kind of message CompanionLink cannot export yet. Please send this error to the research team."]
]);

// Only a chat page: https://gemini.google.com/app/<16 hex>, or /gem/<gem>/<id> for a chat
// with a Gem, either one after /u/<N> for another signed-in Google account. Home, Gem
// and share pages have no chat to export. The gem segment never reaches a request, and
// a strict id keeps a malformed path out of every request.
export function parseGeminiChatUrl(url) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== "gemini.google.com") return null;
    const match = /^(\/u\/\d+)?\/(?:app|gem\/[^/]+)\/([0-9a-f]{16})\/?$/i.exec(pathname);
    return match ? { chatId: match[2].toLowerCase(), accountPath: (match[1] ?? "").toLowerCase() } : null;
  } catch {
    return null;
  }
}

// Returns the chat's in-window turns as records for recordsToRows, newest first, each
// reply above its prompt. One packaged function does the whole export inside the tab,
// so the page's token never leaves it: only the records or an error code come back.
export async function exportGeminiConversation({ tabId, chatId, accountPath, studyWindow }) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: readChatInPage,
    args: [chatId, accountPath, studyWindow.startMs, studyWindow.endMs, RESPONSE_TIMEOUT_MS]
  }).catch(() => []);

  const { records, error, status } = injection?.result ?? {};
  if (Array.isArray(records)) return records;
  if (error === "http") throw new Error(geminiErrorText(`an error (HTTP ${status})`));
  throw new Error(ERRORS.get(error) ?? TAB_ERROR);
}

// Runs in the tab's isolated world, where the page cannot replace fetch and same-origin
// requests still carry the tab's cookies. Chrome rebuilds it from its source, so it must
// not use anything defined outside itself. The token, build label and session id live
// only in this function: the token goes out only as the at field of each request's body,
// the other two only in its query.
async function readChatInPage(chatId, accountPath, startMs, endMs, timeoutMs) {
  // The isolated world cannot see the page's variables, but it can read the text of the
  // page's scripts; an external script's text is empty. Provisional until checked on a
  // live page: if the page writes the values another way, only these patterns change.
  // Nothing else from the scripts is kept.
  const readPageValues = () => [/"SNlM0e":\s*"([^"\\]+)"/, /"cfb2h":\s*"([^"\\]+)"/, /"FdrFJe":\s*"([^"\\]+)"/]
    .map((pattern) => Array.from(document.scripts, (script) => pattern.exec(script.textContent)?.[1]).find(Boolean));
  const [at, bl, fsid] = readPageValues();
  if (at === undefined) return { error: "sign-in" };
  if (bl === undefined || fsid === undefined) return { error: "unexpected" };
  const hl = document.documentElement.lang;

  // Status 0 is no response or a timeout.
  const post = async (cursor) => {
    const query = new URLSearchParams({
      rpcids: "hNvQHb", "source-path": `/app/${chatId}`, bl, "f.sid": fsid, hl,
      _reqid: String(Math.floor(Math.random() * 1e6)), rt: "c"
    });
    const fReq = JSON.stringify([[["hNvQHb", JSON.stringify([`c_${chatId}`, 10, cursor, 1, [1], [4], null, 1]), null, "generic"]]]);
    try {
      const response = await fetch(`https://gemini.google.com${accountPath}/_/BardChatUi/data/batchexecute?${query}`, {
        method: "POST",
        credentials: "include",
        // Keeps the chat out of Chrome's disk cache, as for ChatGPT.
        cache: "no-store",
        // Every client sends it, as the page does; without it the request reads as cross-site.
        headers: { "X-Same-Domain": "1" },
        body: new URLSearchParams({ "f.req": fReq, at }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      return { status: response.status, body: await response.text() };
    } catch {
      return { status: 0 };
    }
  };
  // A stale token most likely gets a 400, which refreshing the page fixes as for 401.
  const failure = (status) =>
    status === 400 || status === 401 || status === 403 ? { error: "sign-in" }
      : status === 429 ? { error: "rate-limit" }
        : status === 0 ? { error: "unreadable" }
          : { error: "http", status };

  const records = [];
  // The turn walked before this one, the next newer turn in the chat, and its time.
  let newer = null;
  let newerMs;
  let cursor = null;
  while (true) {
    const { status, body } = await post(cursor);
    if (status < 200 || status >= 300) return failure(status);
    // A check page answers 200 without the guard line.
    if (!body.startsWith(")]}'")) return { error: "unreadable" };
    // After the guard line, each JSON line lists rows; the length lines between are not.
    const row = body.split("\n").flatMap((line) => {
      try {
        const rows = JSON.parse(line);
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    }).find((r) => r?.[0] === "wrb.fr" && r[1] === "hNvQHb");
    if (typeof row?.[2] !== "string") return { error: "unexpected" };
    let payload;
    try {
      payload = JSON.parse(row[2]);
    } catch {
      return { error: "unexpected" };
    }
    const turns = payload?.[0];
    const next = payload?.[1];
    // A chat always has a turn, and a cursor promises an older page.
    if (!Array.isArray(turns) || turns.length === 0) return { error: newer ? "incomplete" : "unexpected" };
    if (next != null && (typeof next !== "string" || next === "")) return { error: "unexpected" };

    for (const t of turns) {
      if (t?.[0]?.[0] !== `c_${chatId}`) return { error: "unexpected" };
      if (typeof t[0][1] !== "string" || t[0][1] === "") return { error: "invalid" };
      // Each turn names the one before it, across pages too, so a gap, an overlap or a
      // repeated page breaks the chain.
      if (newer && !(newer[1]?.[1] === t[0][1] && newer[1]?.[2] === t[3]?.[3])) return { error: "incomplete" };
      // Only the time decides what lands in the window, so only a changed time could
      // turn into a silent header-only file: it is checked on every turn, in the dates or
      // not. A zero nanos field is left out of the data. The range catches a change of unit.
      const [seconds, nanos = 0] = Array.isArray(t[4]) ? t[4] : [];
      const instantMs = seconds * 1000 + Math.floor(nanos / 1e6);
      if (!Number.isInteger(seconds) || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1e9 ||
        !(instantMs >= Date.UTC(2020, 0, 1) && instantMs < Date.UTC(2100, 0, 1))) return { error: "invalid" };
      // The stop at From relies on times that never increase going back.
      if (newer && instantMs > newerMs) return { error: "unexpected" };
      const newest = newer === null;
      newer = t;
      newerMs = instantMs;
      if (instantMs < startMs || instantMs >= endMs) continue;

      // The other slots are checked in the window only, where they fill the cells. The
      // reply is the draft on screen, never another one.
      const prompt = t[2]?.[0]?.[0];
      const drafts = t[3]?.[0];
      const shown = Array.isArray(drafts) && typeof t[3][3] === "string" ? drafts.find((c) => c?.[0] === t[3][3]) : undefined;
      const text = shown?.[1]?.[0];
      if (typeof prompt !== "string" || typeof text !== "string") return { error: "invalid" };
      // Only the chat's newest reply can still be in writing. An older reply without
      // words, or with a card, may keep its words in a slot not read: stop, never drop them.
      if (newest && (shown[8]?.[0] !== 2 || text === "")) return { error: "not-finished" };
      if (text === "" || text.includes("http://googleusercontent.com/card_content/")) return { error: "unsupported" };
      records.push({ instantMs, from: "Gemini", text, reaction: "N/A" }, { instantMs, from: "Me", text: prompt, reaction: "N/A" });
    }

    // The page's oldest turn is before From, so every older one is too.
    if (newerMs < startMs) return { records };
    // The last page ends at the chat's first turn.
    if (next == null) return newer[1] === null ? { records } : { error: "incomplete" };
    cursor = next;
  }
}

function geminiErrorText(what) {
  return `Gemini returned ${what}. Please try again.`;
}
