import test from "node:test";
import assert from "node:assert/strict";
import { createStudyWindow } from "../extension/studyWindow.js";
import { exportChatGptConversation, parseChatGptChatUrl } from "../extension/chatgptClient.js";

const ID = "2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091";
const SESSION_URL = "https://chatgpt.com/api/auth/session";
const firstUrl = `https://chatgpt.com/backend-api/conversations/${ID}?num_turns=100&include_has_versions=true`;
const olderUrl = (cursor) =>
  `https://chatgpt.com/backend-api/conversations/${ID}/messages?before=${cursor}&num_turns=100&include_has_versions=true`;

// 2026-10-13 in America/New_York is [04:00Z on the 13th, 04:00Z on the 14th).
const studyWindow = createStudyWindow({
  startDate: "2026-10-13",
  endDate: "2026-10-13",
  submittedAt: new Date("2026-10-15T12:00:00Z"),
  timeZone: "America/New_York"
});
// The same day, exported at 17:00 local time: the click ends the window.
const clickedWindow = createStudyWindow({
  startDate: "2026-10-13",
  endDate: "2026-10-13",
  submittedAt: new Date("2026-10-13T21:00:00Z"),
  timeZone: "America/New_York"
});
const DAY_MS = 86_400_000;

// Shapes as observed on chatgpt.com (November 2026), with synthetic values: times in
// epoch seconds, and the key set of a listed message.
const seconds = (iso) => (iso === null ? null : Date.parse(iso) / 1000);
const message = (id, role, iso, content, extra) => ({
  id, author: { role, name: null, metadata: {} }, create_time: seconds(iso), update_time: seconds(iso),
  content, status: "finished_successfully", end_turn: null, weight: 1,
  metadata: {}, recipient: "all", channel: role === "assistant" ? "final" : null, ...extra
});
const typed = (...parts) => ({ content_type: "text", parts });
const multi = (...parts) => ({ content_type: "multimodal_text", parts });
const transcript = (text) => ({ content_type: "audio_transcription", text, direction: "in" });
const image = () => ({ content_type: "image_asset_pointer", asset_pointer: "sediment://synthetic", width: 1, height: 1 });
const audio = () => ({ content_type: "audio_asset_pointer", asset_pointer: "sediment://synthetic-audio" });
const video = () => ({ content_type: "real_time_user_audio_video_asset_pointer" });
const hidden = { metadata: { is_visually_hidden_from_conversation: true } };
const system = (id) => message(id, "system", null, typed(""), { create_time: null, weight: 0, ...hidden });
const page = (messages, hasPrevious = false) => ({
  messages,
  page_info: {
    start_cursor: messages[0]?.id ?? null, end_cursor: messages.at(-1)?.id ?? null,
    has_previous_page: hasPrevious, has_next_page: false
  }
});
const conversation = (messages, hasPrevious = false, extra) => ({
  title: "Synthetic chat", conversation_id: ID, current_node: messages.at(-1)?.id ?? null, gizmo_id: null,
  is_temporary_chat: false, is_archived: false, ...page(messages, hasPrevious), ...extra
});

const SESSION = {
  WARNING_BANNER: "synthetic", accessToken: "synthetic-access-token",
  account: { id: "synthetic-account-id" },
  user: { id: "user-synthetic", name: "Synthetic Person", email: "synthetic.person@example.invalid" },
  authProvider: "synthetic", expires: "2026-11-15T12:00:00.000Z",
  sessionToken: "synthetic-session-token", statsigContext: {}, marketingEligibility: {}
};
const SENTINELS = [
  "synthetic-access-token", "synthetic-session-token", "synthetic.person@example.invalid",
  "Synthetic Person", "synthetic-account-id"
];

// List order, oldest first, on one page. Each id names the rule it covers.
const MESSAGES = [
  // Hidden, with no time: skipped before the time check.
  system("u-system"),
  message("u-before", "user", "2026-10-13T03:59:59.999Z", typed("Too early")),
  message("u-at-start", "user", "2026-10-13T04:00:00.000Z", typed("Good morning")),
  // Memory context, not flagged hidden: skipped by its type.
  message("u-memory", "assistant", "2026-10-13T04:00:01Z", { content_type: "model_editable_context", model_set_context: "synthetic" }),
  // Listed after u-at-start but timed 1 s before From: it counts by its own time.
  message("u-reply-early", "assistant", "2026-10-13T03:59:59.000Z", typed("Morning!")),
  message("u-prompt", "user", "2026-10-13T12:00:02Z", typed("She said \"hi\", then left")),
  // Listed after its prompt but timed 2 s earlier, with microseconds.
  message("u-reply", "assistant", null, typed(" It’s fine — 你好 😊\nLine two"),
    { create_time: seconds("2026-10-13T12:00:00.123Z") + 0.000456 }),
  // In the window, each left out by its own rule.
  message("u-tool-call", "assistant", "2026-10-13T13:00:00Z", typed("{\"query\":\"synthetic\"}"), { recipient: "web.run" }),
  message("u-tool-result", "tool", "2026-10-13T13:05:00Z", typed("Synthetic results")),
  message("u-thoughts", "assistant", "2026-10-13T13:10:00Z", { content_type: "thoughts", thoughts: [{ summary: "s", content: "c" }] }),
  message("u-recap", "assistant", "2026-10-13T13:15:00Z", { content_type: "reasoning_recap", content: "Thought for 3 seconds" }),
  message("u-preamble", "assistant", "2026-10-13T13:20:00Z", typed("Searching…"), { metadata: { is_thinking_preamble_message: true } }),
  message("u-empty", "assistant", "2026-10-13T13:25:00Z", typed("")),
  // An image sent without words is still the participant's message: an empty row.
  message("u-image-only", "user", "2026-10-13T15:00:00Z", multi(image())),
  message("u-image-text", "user", "2026-10-13T15:30:00Z", multi(image(), "What is this?")),
  message("u-voice-user", "user", "2026-10-13T16:00:10Z", multi(transcript("Hello there"), audio(), video())),
  // Voice turns overlap: listed after u-voice-user but timed 8 s earlier.
  message("u-voice-reply", "assistant", "2026-10-13T16:00:02Z", multi(audio(), transcript("Hi! Nice to hear you."))),
  message("u-hidden-user", "user", "2026-10-13T17:00:00Z", typed("Custom instructions"), hidden),
  message("u-last-in", "user", "2026-10-14T03:59:59.999Z", typed("Last moment of To")),
  message("u-at-end", "assistant", "2026-10-14T04:00:00.000Z", typed("Too late"))
];
const CHAT = conversation(MESSAGES);

const record = (id, iso, from, text) => ({ id, instantMs: Date.parse(iso), from, text, reaction: "N/A" });
const EXPECTED = [
  record("u-last-in", "2026-10-14T03:59:59.999Z", "Me", "Last moment of To"),
  record("u-voice-reply", "2026-10-13T16:00:02Z", "ChatGPT", "Hi! Nice to hear you."),
  record("u-voice-user", "2026-10-13T16:00:10Z", "Me", "Hello there"),
  record("u-image-text", "2026-10-13T15:30:00Z", "Me", "What is this?"),
  record("u-image-only", "2026-10-13T15:00:00Z", "Me", ""),
  record("u-reply", "2026-10-13T12:00:00.123Z", "ChatGPT", " It’s fine — 你好 😊\nLine two"),
  record("u-prompt", "2026-10-13T12:00:02Z", "Me", "She said \"hi\", then left"),
  record("u-at-start", "2026-10-13T04:00:00.000Z", "Me", "Good morning")
];

// Chrome rebuilds the injected function from its source, so anything it borrowed from
// the module would be undefined in the page; the stub does the same. Chrome also clones
// the result, which proves it is plain data. The stub records each injection, its raw
// result and each fetch. A route that is an object answers 200 with it as JSON, a
// number answers that status, "throw" fails the request, "html" answers 200 with a page
// that is not JSON, and a function answers for itself; anything unrouted answers 500.
// A test may stub twice, so each restores the globals from before any stub.
const original = { chrome: globalThis.chrome, fetch: globalThis.fetch };
function stubTab(t, routes, { timeoutMs } = {}) {
  t.after(() => {
    if (original.chrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = original.chrome;
    globalThis.fetch = original.fetch;
  });
  const injections = [];
  const results = [];
  const fetches = [];
  globalThis.fetch = async (url, init) => {
    fetches.push({ url, init });
    const route = routes[url];
    if (typeof route === "function") return route(url, init);
    if (route === "throw") throw new TypeError("Failed to fetch");
    if (route === "html") return new Response("<html>Just a moment...</html>", { status: 200 });
    if (typeof route === "number") return new Response("{}", { status: route });
    if (route !== undefined) return new Response(JSON.stringify(route), { status: 200 });
    return new Response("Unexpected request", { status: 500 });
  };
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, ...details }) => {
        injections.push(details);
        const args = timeoutMs === undefined ? details.args : [...details.args.slice(0, 3), timeoutMs];
        const result = await new Function(`return (${func})`)()(...args);
        results.push(result);
        return [{ result: structuredClone(result) }];
      }
    }
  };
  return { injections, results, fetches };
}

const chat = (first, older = {}) => ({ [SESSION_URL]: SESSION, [firstUrl]: first, ...older });
const exportChat = (window = studyWindow) =>
  exportChatGptConversation({ tabId: 7, conversationId: ID, studyWindow: window });
const urls = (tab) => tab.fetches.map(({ url }) => url);

test("only a chatgpt.com chat page is accepted, and its id comes back lowercased", () => {
  for (const url of [
    `https://chatgpt.com/c/${ID}`,
    `https://chatgpt.com/c/${ID}/`,
    `https://chatgpt.com/c/${ID}?model=x#y`,
    `https://CHATGPT.COM/c/${ID.toUpperCase()}`,
    `https://chatgpt.com/g/g-synthetic123-companion/c/${ID}`,
    `https://chatgpt.com/g/g-p-0123456789abcdef0123456789abcdef-synthetic/c/${ID}`
  ]) {
    assert.equal(parseChatGptChatUrl(url), ID, url);
  }
});

test("other chatgpt.com pages, lookalike hosts and other sites are rejected", () => {
  for (const url of [
    "https://chatgpt.com/",
    "https://chatgpt.com/?temporary-chat=true",
    "https://chatgpt.com/c/",
    "https://chatgpt.com/c/abc",
    `https://chatgpt.com/c/${ID}/x`,
    `https://chatgpt.com/share/${ID}`,
    `https://chatgpt.com/share/e/${ID}`,
    "https://chatgpt.com/g/g-synthetic123-companion",
    "https://chatgpt.com/g/g-p-0123456789abcdef0123456789abcdef-synthetic/project",
    `https://chatgpt.com/g/notg/c/${ID}`,
    `https://chatgpt.com/x/c/${ID}`,
    "https://chatgpt.com/gpts",
    `http://chatgpt.com/c/${ID}`,
    `https://www.chatgpt.com/c/${ID}`,
    `https://chat.openai.com/c/${ID}`,
    `https://chatgpt.com.example.com/c/${ID}`,
    `https://chatgpt.com@example.com/c/${ID}`,
    `https://example.com/chatgpt.com/c/${ID}`,
    "https://claude.ai/chat/3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b",
    "https://kindroid.ai/v2/chat/exampleCompanion",
    "https://my.replika.com/chat",
    "not a URL",
    undefined
  ]) {
    assert.equal(parseChatGptChatUrl(url), null, String(url));
  }
});

test("exports the window's shown user and ChatGPT messages as records, newest first in list order", async (t) => {
  stubTab(t, chat(CHAT));
  // Left out: the hidden system and user messages, memory, tool calls and results,
  // thoughts, the recap, the thinking preamble, the empty reply, and everything
  // outside the dates. Text is kept as written, voice turns as their transcripts.
  assert.deepEqual(await exportChat(), EXPECTED);
});

test("an odd message outside the dates does not block the chat", async (t) => {
  const odd = MESSAGES.map((m) => (m.id === "u-before" ? { ...m, content: typed("Hi", 42) }
    : m.id === "u-at-end" ? { ...m, content: { content_type: "multimodal_text" } } : m));
  stubTab(t, chat(conversation(odd)));
  assert.deepEqual(await exportChat(), EXPECTED);
});

test("a message at or after the click is left out", async (t) => {
  stubTab(t, chat(CHAT));
  assert.deepEqual((await exportChat(clickedWindow)).map((r) => r.id),
    ["u-voice-reply", "u-voice-user", "u-image-text", "u-image-only", "u-reply", "u-prompt", "u-at-start"]);
});

test("out-of-order times are kept in list order, never sorted or rejected", async (t) => {
  stubTab(t, chat(CHAT));
  const times = (await exportChat()).map((r) => r.instantMs);
  assert.notDeepEqual(times, [...times].sort((a, b) => b - a));
  assert.notDeepEqual(times, [...times].sort((a, b) => a - b));
});

test("each message counts by its own time, so a reply listed after From's first prompt can fall before it", async (t) => {
  stubTab(t, chat(CHAT));
  const ids = (await exportChat()).map((r) => r.id);
  assert.ok(ids.includes("u-at-start"));
  assert.ok(!ids.includes("u-reply-early"));
});

test("a user message with an image or a file but no text keeps an empty row; other text-less messages do not", async (t) => {
  stubTab(t, chat(conversation([
    message("q-file-only", "user", "2026-10-13T12:00:00Z", typed(""),
      { metadata: { attachments: [{ id: "file-synthetic", name: "synthetic.pdf" }] } }),
    // A generated image is ChatGPT's, not the participant's.
    message("q-generated", "assistant", "2026-10-13T12:01:00Z", multi(image())),
    message("q-hidden-image", "user", "2026-10-13T12:02:00Z", multi(image()), hidden),
    message("q-weightless-image", "user", "2026-10-13T12:03:00Z", multi(image()), { weight: 0 }),
    message("q-blank", "user", "2026-10-13T12:04:00Z", typed(""))
  ])));
  assert.deepEqual(await exportChat(), [record("q-file-only", "2026-10-13T12:00:00Z", "Me", "")]);
});

test("messages left out by role, flag or type are left out before their time is checked", async (t) => {
  const timeless = (id, role, content, extra) => message(id, role, null, content, { create_time: null, ...extra });
  stubTab(t, chat(conversation([
    timeless("s-tool-result", "tool", typed("Synthetic results")),
    timeless("s-hidden-user", "user", typed("Custom instructions"), hidden),
    timeless("s-weightless", "assistant", typed("Weightless"), { weight: 0 }),
    timeless("s-preamble", "assistant", typed("Searching…"), { metadata: { is_thinking_preamble_message: true } }),
    timeless("s-tool-call", "assistant", typed("{\"query\":\"synthetic\"}"), { recipient: "web.run" }),
    timeless("s-memory", "assistant", { content_type: "model_editable_context", model_set_context: "synthetic", parts: ["Memory"] }),
    timeless("s-instructions", "user", { content_type: "user_editable_context", user_instructions: "synthetic", parts: ["Instructions"] }),
    timeless("s-thoughts", "assistant", { content_type: "thoughts", thoughts: [], parts: ["Thinking"] }),
    timeless("s-recap", "assistant", { content_type: "reasoning_recap", content: "Thought for 3 seconds", parts: ["Recap"] }),
    message("s-shown", "user", "2026-10-13T12:00:00Z", typed("Shown"))
  ])));
  assert.deepEqual((await exportChat()).map((r) => r.id), ["s-shown"]);
});

test("a message without a recipient is kept, and text pieces join with a blank line", async (t) => {
  const { recipient: _recipient, ...noRecipient } = message("t-no-recipient", "assistant", "2026-10-13T12:00:01Z", typed("First", "", "Second"));
  stubTab(t, chat(conversation([
    message("t-voice", "user", "2026-10-13T12:00:00Z", multi(transcript("Spoken"), audio(), "", "Typed")),
    noRecipient
  ])));
  assert.deepEqual(await exportChat(), [
    record("t-no-recipient", "2026-10-13T12:00:01Z", "ChatGPT", "First\n\nSecond"),
    record("t-voice", "2026-10-13T12:00:00Z", "Me", "Spoken\n\nTyped")
  ]);
});

// A chat always lists at least its hidden system messages, so an empty list means the
// API changed: a header-only file would hide that.
test("a chat that lists no messages stops the export after one chat request", async (t) => {
  const tab = stubTab(t, chat(conversation([])));
  await assert.rejects(exportChat(), { message: "ChatGPT returned an unexpected response. Please try again." });
  assert.deepEqual(urls(tab), [SESSION_URL, firstUrl]);
});

test("one injection in the tab's own world reads the session, then the chat with the token, uncached", async (t) => {
  const tab = stubTab(t, chat(CHAT));
  await exportChat();
  // No world: "MAIN", so the page cannot replace fetch; same-origin cookies still go.
  assert.deepEqual(tab.injections, [{ target: { tabId: 7 }, args: [ID, studyWindow.startMs, studyWindow.endMs, 60000] }]);
  assert.deepEqual(urls(tab), [SESSION_URL, firstUrl]);
  for (const { init } of tab.fetches) {
    assert.equal(init.credentials, "include");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.equal(tab.fetches[0].init.headers?.Authorization, undefined);
  assert.deepEqual(tab.fetches[1].init.headers, { Authorization: "Bearer synthetic-access-token" });
});

// Page A, the newest part, is the first request; page B, the older part, is asked for
// with A's oldest message as the cursor.
const PAGE_A = conversation(MESSAGES.slice(10), true);
const PAGE_B = page(MESSAGES.slice(0, 10));
const twoPages = () => chat(PAGE_A, { [olderUrl("u-recap")]: PAGE_B });

test("an older page is read before its cursor, and the two pages give the same records as one", async (t) => {
  const tab = stubTab(t, twoPages());
  assert.deepEqual(await exportChat(), EXPECTED);
  assert.deepEqual(urls(tab), [SESSION_URL, firstUrl, olderUrl("u-recap")]);
});

const at = (ms) => new Date(ms).toISOString();
const IN = message("p-in", "user", "2026-10-13T12:00:00Z", typed("Hi"));
const OLDER = page([message("p-older", "user", "2026-10-01T12:00:00Z", typed("Older"))]);
// Page A's messages, then whether page B was asked for.
async function pagesOnFrom(t, messages) {
  const tab = stubTab(t, chat(conversation(messages, true), { [olderUrl(messages[0].id)]: OLDER }));
  await exportChat();
  return urls(tab).includes(olderUrl(messages[0].id));
}

test("paging stops once a page's oldest row candidate is more than a day before From", async (t) => {
  const edge = (ms) => [message("p-edge", "user", at(ms), typed("Edge")), IN];
  assert.equal(await pagesOnFrom(t, edge(studyWindow.startMs - DAY_MS + 1)), true);
  assert.equal(await pagesOnFrom(t, edge(studyWindow.startMs - DAY_MS - 1)), false);
});

test("the stop rule uses the oldest-positioned row candidate, not the first message or the earliest time", async (t) => {
  const hourEarly = message("p-hour", "user", at(studyWindow.startMs - 3_600_000), typed("An hour early"));
  // A hidden message heads the page with any time.
  assert.equal(await pagesOnFrom(t, [{ ...system("p-system"), create_time: 0 }, hourEarly, IN]), true);
  // A message listed later may be timed earlier.
  const twoDays = message("p-two-days", "user", at(studyWindow.startMs - 2 * DAY_MS), typed("Two days early"));
  assert.equal(await pagesOnFrom(t, [hourEarly, twoDays, IN]), true);
});

test("a page with no row candidate gives no time, so paging continues", async (t) => {
  assert.equal(await pagesOnFrom(t, [system("p-system-1"), system("p-system-2")]), true);
});

test("paging ends when there is no older page, even with the oldest message in the dates", async (t) => {
  const tab = stubTab(t, chat(conversation([IN])));
  assert.deepEqual((await exportChat()).map((r) => r.id), ["p-in"]);
  assert.deepEqual(urls(tab), [SESSION_URL, firstUrl]);
});

const NOT_FINISHED = "ChatGPT has not finished its last reply in this chat. Wait for it to finish, or click Try again on the reply if it stopped, then export again.";
const UNSUPPORTED = "ChatGPT returned a kind of message CompanionLink cannot export yet. Please send this error to the research team.";
// One message in the dates, with changes.
const one = (changes, role = "assistant", iso = "2026-10-13T12:00:00Z") =>
  conversation([{ ...message("x1", role, iso, typed("Hi")), ...changes }]);
const OUTSIDE = "2026-10-12T12:00:00Z";

test("a reply ChatGPT is still writing in the dates stops the export", async (t) => {
  stubTab(t, chat(one({ status: "in_progress" })));
  await assert.rejects(exportChat(), { message: NOT_FINISHED });
});

test("a reply in progress outside the dates, or without text yet, does not block the chat", async (t) => {
  stubTab(t, chat(one({ status: "in_progress" }, "assistant", OUTSIDE)));
  assert.deepEqual(await exportChat(), []);
  stubTab(t, chat(one({ status: "in_progress", content: typed("") })));
  assert.deepEqual(await exportChat(), []);
});

test("a list that does not end at the chat's current message stops the export", async (t) => {
  // While ChatGPT replies, the list may stop short of the chat's newest message.
  stubTab(t, chat(conversation(MESSAGES, false, { current_node: "u-at-start" })));
  await assert.rejects(exportChat(), { message: NOT_FINISHED });
  stubTab(t, chat(conversation(MESSAGES, false, { current_node: null })));
  await assert.rejects(exportChat(), { message: "ChatGPT returned an unexpected response. Please try again." });
});

test("an unknown kind of message with text in the dates stops the export", async (t) => {
  stubTab(t, chat(one({ content: { content_type: "rich_text_synthetic", parts: ["Visible words"] } })));
  await assert.rejects(exportChat(), { message: UNSUPPORTED });
});

test("a part of an unknown kind with text in the dates stops the export instead of an empty row", async (t) => {
  stubTab(t, chat(one({ content: multi(image(), { content_type: "text", text: "What is this?" }) }, "user")));
  await assert.rejects(exportChat(), { message: UNSUPPORTED });
});

test("an unknown kind of message with text outside its parts in the dates stops the export", async (t) => {
  stubTab(t, chat(one({ content: { content_type: "rich_synthetic", text: "Visible words" } })));
  await assert.rejects(exportChat(), { message: UNSUPPORTED });
});

test("an unknown kind of message without text, or outside the dates, is left out", async (t) => {
  stubTab(t, chat(one({ content: { content_type: "synthetic_reasoning" } })));
  assert.deepEqual(await exportChat(), []);
  stubTab(t, chat(one({ content: { content_type: "rich_text_synthetic", parts: ["Visible words"] } }, "assistant", OUTSIDE)));
  assert.deepEqual(await exportChat(), []);
});

test("a message outside the dates still has its time checked", async (t) => {
  stubTab(t, chat(conversation(MESSAGES.map((m) => (m.id === "u-before" ? { ...m, create_time: null } : m)))));
  await assert.rejects(exportChat(), { message: "ChatGPT returned an invalid chat message. Please try again." });
});

test("times in milliseconds instead of seconds stop the export instead of emptying it", async (t) => {
  const scaled = MESSAGES.map((m) => (typeof m.create_time === "number" ? { ...m, create_time: m.create_time * 1000 } : m));
  stubTab(t, chat(conversation(scaled)));
  await assert.rejects(exportChat(), { message: "ChatGPT returned an invalid chat message. Please try again." });
});

const without = (id, key) => MESSAGES.map((m) => {
  if (m.id !== id) return m;
  const { [key]: _removed, ...rest } = m;
  return rest;
});
const ANOTHER_CHAT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
for (const [name, routes, pattern] of [
  ["another chat's response", chat({ ...CHAT, conversation_id: ANOTHER_CHAT }), /unexpected response/],
  ["a response without messages", chat({ ...CHAT, messages: undefined }), /unexpected response/],
  ["a response without page_info", chat({ ...CHAT, page_info: undefined }), /unexpected response/],
  ["has_previous_page as a string", chat({ ...CHAT, page_info: { ...CHAT.page_info, has_previous_page: "false" } }), /unexpected response/],
  ["current_node as a number", chat({ ...CHAT, current_node: 42 }), /unexpected response/],
  ["a message without an id", chat(conversation(without("u-prompt", "id"))), /incomplete chat/],
  ["an empty older page", chat(PAGE_A, { [olderUrl("u-recap")]: page([], false) }), /incomplete chat/],
  ["a message without an author", chat(one({ author: undefined })), /invalid chat message/],
  ["a user message without content", chat(one({ content: undefined }, "user")), /invalid chat message/],
  ["a text part that is not a string", chat(one({ content: typed("Hi", 42) })), /invalid chat message/],
  ["multimodal content without parts", chat(one({ content: { content_type: "multimodal_text" } })), /invalid chat message/],
  ["a transcript without string text", chat(one({ content: multi({ ...transcript("Hi"), text: 42 }) })), /invalid chat message/],
  ["a time that is a string", chat(one({ create_time: "1760356800" })), /invalid chat message/]
]) {
  test(`stops with an error on ${name}`, async (t) => {
    stubTab(t, routes);
    await assert.rejects(exportChat(), (error) => {
      assert.match(error.message, pattern);
      assert.match(error.message, /^ChatGPT returned an? [a-z ]+\. Please try again\.$/);
      return true;
    });
  });
}

// Its cursor would ask for the same page again. Answering it only once, with the test's
// own timeout, makes a missing repeat check fail instead of looping forever.
test("an older page that repeats a message stops the export instead of looping", { timeout: 2000 }, async (t) => {
  const repeat = page([PAGE_A.messages[0], ...PAGE_B.messages], true);
  let answered = false;
  const once = () => (answered ? new Response("{}", { status: 500 }) : (answered = true, new Response(JSON.stringify(repeat))));
  const tab = stubTab(t, chat(PAGE_A, { [olderUrl("u-recap")]: once }));
  await assert.rejects(exportChat(), { message: "ChatGPT returned an incomplete chat. Please try again." });
  assert.equal(tab.fetches.length, 3);
});

const SIGN_IN = "Sign in to ChatGPT in this tab, refresh the page, then try again.";
const NOT_FOUND = "ChatGPT could not find this chat. Open it again from ChatGPT's sidebar, then try again.";
const RATE_LIMIT = "ChatGPT is limiting requests. Wait a few minutes, then try again.";
const UNREADABLE = "Could not read from ChatGPT. Check your connection, refresh the ChatGPT page, then try again.";
const TAB = "Could not read the ChatGPT tab. Refresh it, then try again.";
const http = (status) => `ChatGPT returned an error (HTTP ${status}). Please try again.`;

test("a session that fails or has no access token stops before the chat is asked for", async (t) => {
  for (const [session, text] of [
    [401, SIGN_IN],
    [403, SIGN_IN],
    [{}, SIGN_IN],
    [{ accessToken: 42 }, SIGN_IN],
    [429, RATE_LIMIT],
    // The session endpoint answers signed out with a body, not 404.
    [404, http(404)],
    [500, http(500)],
    ["html", UNREADABLE],
    ["throw", UNREADABLE]
  ]) {
    const tab = stubTab(t, { [SESSION_URL]: session });
    await assert.rejects(exportChat(), { message: text }, JSON.stringify(session));
    assert.deepEqual(urls(tab), [SESSION_URL], JSON.stringify(session));
  }
});

test("a chat request that fails, first or older, stops the export at once", async (t) => {
  for (const [status, text] of [
    [401, SIGN_IN],
    [403, SIGN_IN],
    [404, NOT_FOUND],
    [422, http(422)],
    [429, RATE_LIMIT],
    [500, http(500)],
    ["throw", UNREADABLE],
    ["html", UNREADABLE]
  ]) {
    let tab = stubTab(t, chat(status));
    await assert.rejects(exportChat(), { message: text }, `first ${status}`);
    assert.deepEqual(urls(tab), [SESSION_URL, firstUrl], `first ${status}`);
    tab = stubTab(t, chat(PAGE_A, { [olderUrl("u-recap")]: status }));
    await assert.rejects(exportChat(), { message: text }, `older ${status}`);
    assert.deepEqual(urls(tab), [SESSION_URL, firstUrl, olderUrl("u-recap")], `older ${status}`);
  }
});

// The test's own timeout makes a missing request timeout fail instead of hanging.
test("a request that hangs times out as a read failure", { timeout: 2000 }, async (t) => {
  // The stub shortens the 60 s timeout; the fake fetch fails only when its signal aborts.
  // A real hung request keeps its connection open; the timer stands in for it, since Node
  // does not let AbortSignal.timeout keep it running and would exit before the abort.
  const hang = (_url, init) => new Promise((_resolve, reject) => {
    const connection = setTimeout(() => {}, 2000);
    init.signal.addEventListener("abort", () => {
      clearTimeout(connection);
      reject(init.signal.reason);
    });
  });
  stubTab(t, { [SESSION_URL]: hang }, { timeoutMs: 5 });
  await assert.rejects(exportChat(), { message: UNREADABLE });
});

test("a tab the extension cannot run in, or no usable result, gives the tab message", async (t) => {
  for (const executeScript of [
    async () => { throw new Error("Cannot access contents of the page"); },
    async () => [],
    async () => [{ result: null }],
    async () => [{ result: { error: "made-up" } }]
  ]) {
    stubTab(t, chat(CHAT));
    globalThis.chrome.scripting.executeScript = executeScript;
    await assert.rejects(exportChat(), { message: TAB });
  }
});

const leaks = (value) => SENTINELS.filter((sentinel) => JSON.stringify(value ?? null).includes(sentinel));

test("neither the token nor anything else from the session leaves the tab, in records or errors", async (t) => {
  for (const [name, routes] of [
    // A session the export cannot use still holds everything else.
    ["empty token", { [SESSION_URL]: { ...SESSION, accessToken: "" } }],
    ["token that is not a string", { [SESSION_URL]: { ...SESSION, accessToken: { value: "synthetic-access-token" } } }],
    ["rows", chat(CHAT)],
    ["two pages", twoPages()],
    ["in progress", chat(one({ status: "in_progress" }))],
    ["unsupported", chat(one({ content: { content_type: "rich_text_synthetic", parts: ["Visible words"] } }))],
    ["chat 404", chat(404)],
    ["chat 401", chat(401)],
    ["current_node mismatch", chat(conversation(MESSAGES, false, { current_node: "u-at-start" }))]
  ]) {
    const tab = stubTab(t, routes);
    const outcome = await exportChat().catch((error) => error.message);
    assert.equal(tab.results.length, 1, name);
    assert.deepEqual(leaks(tab.results[0]), [], name);
    assert.deepEqual(leaks(outcome), [], name);
  }
});

test("the token is sent only as the one header of GETs to chatgpt.com's chat API", async (t) => {
  for (const routes of [chat(CHAT), twoPages()]) {
    const tab = stubTab(t, routes);
    await exportChat();
    for (const { url, init } of tab.fetches) {
      assert.ok(url.startsWith("https://chatgpt.com/"), url);
      assert.deepEqual(leaks(url), [], url);
      assert.equal(init.body, undefined, url);
      assert.ok(init.method === undefined || init.method === "GET", url);
      if (url === SESSION_URL) assert.equal(init.headers, undefined);
      else {
        assert.ok(url.startsWith("https://chatgpt.com/backend-api/"), url);
        assert.deepEqual(init.headers, { Authorization: "Bearer synthetic-access-token" }, url);
      }
    }
  }
});
