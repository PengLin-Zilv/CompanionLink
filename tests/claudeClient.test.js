import test from "node:test";
import assert from "node:assert/strict";
import { createStudyWindow } from "../extension/studyWindow.js";
import { claudeTabFetcher, exportClaudeConversation, parseClaudeChatUrl } from "../extension/claudeClient.js";

const ID = "3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b";
const ROOT = "00000000-0000-4000-8000-000000000000";
const ORGS = "/api/organizations";
const chatPath = (org) => `/api/organizations/${org}/chat_conversations/${ID}?tree=True&rendering_mode=messages&render_all_tools=true`;

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

const text = (value, extra) => ({ type: "text", text: value, ...extra });
const message = (uuid, parent, sender, createdAt, content) => ({
  uuid, parent_message_uuid: parent, sender, created_at: createdAt, content
});
// updated_at is not a message time (starring a chat bumps it, as observed) and the
// export ignores it, so it is set before the window here: filtering on it would fail.
const conversation = (messages, leaf = messages.at(-1)?.uuid ?? null) => ({
  uuid: ID, name: "Study chat", updated_at: "2026-04-24T13:00:31.715698Z",
  current_leaf_message_uuid: leaf, chat_messages: messages
});

// Shapes as observed on claude.ai: microsecond times, a fixed root, a retried reply
// left as a sibling, and tool and platform blocks between the text.
const MESSAGES = [
  message("april-q", ROOT, "human", "2026-04-24T13:00:28.782890Z", [text("April question")]),
  message("april-a", "april-q", "assistant", "2026-04-24T13:00:31.715698Z", [text(" April answer")]),
  message("at-start", "april-a", "human", "2026-10-13T04:00:00.000Z", [
    text("test"),
    { type: "injected_prompt_block", prompt: "The current date is Tuesday, October 13, 2026." }
  ]),
  message("abandoned", "at-start", "assistant", "2026-10-13T12:00:00Z", [text("First reply")]),
  message("tools", "at-start", "assistant", "2026-10-13T12:00:30.123456+00:00", [
    text(" Let me check."),
    { type: "tool_use", name: "web_search", input: { query: "weather" } },
    { type: "tool_result", content: [{ type: "text", text: "Sunny" }] },
    text("Found it.\nIt is sunny."),
    { type: "token_budget" }
  ]),
  message("lines", "tools", "human", "2026-10-13T20:59:59.999Z", [text("Line one\nLine two")]),
  message("cited", "lines", "assistant", "2026-10-13T21:00:00.000Z", [
    text("The sky is blue", { citations: [{ url: "https://example.invalid/sky" }] }),
    text(" because of scattering"),
    text(".")
  ]),
  message("last-in", "cited", "human", "2026-10-14T03:59:59.999Z", []),
  message("at-end", "last-in", "assistant", "2026-10-14T04:00:00.000Z", [text("Too late")])
];
const CHAT = conversation(MESSAGES);

// Stands in for the tab fetcher: a number answers with that HTTP status, thrown as the
// real fetcher throws it, and an Error is thrown as it is.
function fakeClaude(responses) {
  const paths = [];
  const getJson = async (path) => {
    paths.push(path);
    const response = responses[path];
    if (response instanceof Error) throw response;
    if (typeof response === "number") throw Object.assign(new Error(`HTTP ${response}`), { status: response });
    if (response === undefined) throw new Error(`Unexpected request: ${path}`);
    return structuredClone(response);
  };
  return { getJson, paths };
}
const oneOrg = (chat) => fakeClaude({ [ORGS]: [{ uuid: "org-1" }], [chatPath("org-1")]: chat });
const run = (claude, window = studyWindow) =>
  exportClaudeConversation({ tabId: 7, conversationId: ID, studyWindow: window, getJson: claude.getJson });

test("only a claude.ai chat page is accepted, and its id comes back lowercased", () => {
  for (const url of [
    `https://claude.ai/chat/${ID}`,
    `https://claude.ai/chat/${ID}/`,
    `https://claude.ai/chat/${ID}?x=1#y`,
    `https://CLAUDE.AI/chat/${ID.toUpperCase()}`
  ]) {
    assert.equal(parseClaudeChatUrl(url), ID, url);
  }
});

test("other claude.ai pages, lookalike hosts and other sites are rejected", () => {
  for (const url of [
    "https://claude.ai/new",
    "https://claude.ai/recents",
    `https://claude.ai/project/${ID}`,
    `https://claude.ai/share/${ID}`,
    "https://claude.ai/chat/",
    "https://claude.ai/chat/abc",
    `https://claude.ai/chat/${ID}/x`,
    `http://claude.ai/chat/${ID}`,
    `https://www.claude.ai/chat/${ID}`,
    `https://claude.com/chat/${ID}`,
    `https://claude.ai.example.com/chat/${ID}`,
    `https://claude.ai@example.com/chat/${ID}`,
    `https://example.com/claude.ai/chat/${ID}`,
    "https://my.replika.com/chat",
    "https://kindroid.ai/v2/chat/exampleCompanion",
    "not a URL",
    undefined
  ]) {
    assert.equal(parseClaudeChatUrl(url), null, String(url));
  }
});

test("exports the window's visible-branch messages as records, newest first", async () => {
  const records = await run(oneOrg(CHAT));
  const record = (id, iso, from, value) => ({ id, instantMs: Date.parse(iso), from, text: value, reaction: "N/A" });
  // April, the abandoned retry and the message at To + 1 are left out; tool and
  // platform blocks are dropped, adjacent text joins directly, and text resuming
  // after a tool starts a new paragraph.
  assert.deepEqual(records, [
    record("last-in", "2026-10-14T03:59:59.999Z", "Me", ""),
    record("cited", "2026-10-13T21:00:00.000Z", "Claude", "The sky is blue because of scattering."),
    record("lines", "2026-10-13T20:59:59.999Z", "Me", "Line one\nLine two"),
    record("tools", "2026-10-13T12:00:30.123Z", "Claude", " Let me check.\n\nFound it.\nIt is sunny."),
    record("at-start", "2026-10-13T04:00:00.000Z", "Me", "test")
  ]);
});

test("a message at or after the click is left out", async () => {
  const records = await run(oneOrg(CHAT), clickedWindow);
  assert.deepEqual(records.map((r) => r.id), ["lines", "tools", "at-start"]);
});

test("with one organization, it asks for the organizations and then the chat", async () => {
  const claude = oneOrg(CHAT);
  await run(claude);
  assert.deepEqual(claude.paths, [
    "/api/organizations",
    `/api/organizations/org-1/chat_conversations/${ID}?tree=True&rendering_mode=messages&render_all_tools=true`
  ]);
});

test("a 404 or 403 means another organization owns the chat, so the next one is asked", async () => {
  for (const status of [404, 403]) {
    const claude = fakeClaude({
      [ORGS]: [{ uuid: "org-1" }, { uuid: "org-2" }, { uuid: "org-3" }],
      [chatPath("org-1")]: status,
      [chatPath("org-2")]: CHAT,
      [chatPath("org-3")]: CHAT
    });
    assert.equal((await run(claude)).length, 5, String(status));
    assert.deepEqual(claude.paths, [ORGS, chatPath("org-1"), chatPath("org-2")], String(status));
  }
});

test("a chat no organization has is not found", async () => {
  const claude = fakeClaude({
    [ORGS]: [{ uuid: "org-1" }, { uuid: "org-2" }],
    [chatPath("org-1")]: 404,
    [chatPath("org-2")]: 403
  });
  await assert.rejects(run(claude), /Claude could not find this chat\. Open it again from Claude's sidebar, then try again\./);
});

test("signed out, rate limited or unreachable stops the search at once", async () => {
  for (const failure of [401, 429, 500, 0, new Error("Could not read the Claude tab. Refresh it, then try again.")]) {
    const claude = fakeClaude({
      [ORGS]: [{ uuid: "org-1" }, { uuid: "org-2" }],
      [chatPath("org-1")]: failure,
      [chatPath("org-2")]: CHAT
    });
    await assert.rejects(run(claude), (error) => {
      assert.equal(error.status, failure instanceof Error ? undefined : failure);
      return true;
    }, String(failure));
    assert.deepEqual(claude.paths, [ORGS, chatPath("org-1")], String(failure));
  }
});

test("a login without organizations is asked to sign in", async () => {
  await assert.rejects(run(fakeClaude({ [ORGS]: [] })),
    /Sign in to Claude in this tab, refresh the page, then try again\./);
});

test("a chat without messages is an empty export", async () => {
  assert.deepEqual(await run(oneOrg(conversation([], null))), []);
});

test("a message outside the dates still has its time checked", async () => {
  const broken = conversation(MESSAGES.map((m) => (m.uuid === "april-q" ? { ...m, created_at: null } : m)));
  await assert.rejects(run(oneOrg(broken)), /Claude returned an invalid chat message\. Please try again\./);
});

test("an odd message outside the dates does not block the chat", async () => {
  const odd = conversation(MESSAGES.map((m) => (m.uuid.startsWith("april") ? { ...m, sender: "system", content: undefined } : m)));
  // Exactly the records of the first export test.
  assert.deepEqual(await run(oneOrg(odd)), await run(oneOrg(CHAT)));
});

test("a message sent before Claude finished its last reply stops the export", async () => {
  // As observed: while Claude replies, the leaf stays on the previous reply and the
  // participant's newest message hangs below it, so walking back from the leaf would
  // drop it. A failed or interrupted reply may leave the same shape.
  const replying = conversation([
    ...MESSAGES,
    message("pending", "at-end", "human", "2026-10-14T04:05:00Z", [text("Write an essay")])
  ], "at-end");
  await assert.rejects(run(oneOrg(replying)), /has not finished its last reply/);
});

const inWindow = (changes) => conversation([{ ...message("x1", ROOT, "human", "2026-10-13T12:00:00Z", [text("Hi")]), ...changes }]);

for (const [name, responses, pattern] of [
  ["organizations that are not a list", { [ORGS]: { organizations: [] } }, /unexpected response/],
  ["an organization without an id", { [ORGS]: [{ uuid: "org-1" }, { name: "Team" }] }, /unexpected response/],
  ["another chat's response", { [ORGS]: [{ uuid: "org-1" }], [chatPath("org-1")]: { ...CHAT, uuid: ROOT } }, /unexpected response/],
  ["a chat without its message list",
    { [ORGS]: [{ uuid: "org-1" }], [chatPath("org-1")]: { ...CHAT, chat_messages: undefined } }, /unexpected response/],
  ["a leaf that is not a string", oneOrg(conversation(MESSAGES, null)), /incomplete chat/],
  ["a leaf that is not in the chat", oneOrg(conversation(MESSAGES, "gone")), /incomplete chat/],
  ["a parent that is not in the chat", oneOrg(conversation(MESSAGES.slice(1))), /incomplete chat/],
  ["a branch that loops above the leaf", oneOrg(conversation([
    message("x0", "x1", "human", "2026-10-13T12:00:02Z", []),
    message("x1", "x2", "assistant", "2026-10-13T12:00:01Z", []),
    message("x2", "x1", "human", "2026-10-13T12:00:00Z", [])
  ], "x0")), /incomplete chat/],
  ["an unknown sender", oneOrg(inWindow({ sender: "system" })), /invalid chat message/],
  ["a message without a time", oneOrg(inWindow({ created_at: undefined })), /invalid chat message/],
  ["a time without a zone", oneOrg(inWindow({ created_at: "2026-10-13T12:00:00" })), /invalid chat message/],
  ["content that is not a list", oneOrg(inWindow({ content: "Hi" })), /invalid chat message/],
  ["a text block without string text", oneOrg(inWindow({ content: [{ type: "text", text: { value: "Hi" } }] })), /invalid chat message/]
]) {
  test(`stops with an error on ${name}`, async () => {
    const claude = typeof responses.getJson === "function" ? responses : fakeClaude(responses);
    await assert.rejects(run(claude), (error) => {
      assert.match(error.message, pattern);
      assert.match(error.message, /^Claude returned an? [a-z ]+\. Please try again\.$/);
      return true;
    });
  });
}

// Chrome rebuilds the injected function from its source, so anything it borrowed from
// the module would be undefined in the page. The stub does the same, and records each
// injection and each fetch the function makes.
function stubTab(t, respond, { timeoutMs } = {}) {
  const original = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  t.after(() => {
    if (original.chrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = original.chrome;
    globalThis.fetch = original.fetch;
  });
  const injections = [];
  const fetches = [];
  globalThis.fetch = async (url, init) => {
    fetches.push({ url, init });
    return respond(url, init);
  };
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, ...details }) => {
        injections.push(details);
        const args = timeoutMs === undefined ? details.args : [details.args[0], timeoutMs];
        return [{ result: await new Function(`return (${func})`)()(...args) }];
      }
    }
  };
  return { injections, fetches };
}

test("the fetcher runs in the tab's own world with its sign-in, uncached, and returns the body", async (t) => {
  const tab = stubTab(t, async () => new Response(JSON.stringify([{ uuid: "org-1" }]), { status: 200 }));
  assert.deepEqual(await claudeTabFetcher(7)("/api/organizations"), [{ uuid: "org-1" }]);
  // No world: "MAIN", so the page cannot replace fetch; same-origin cookies still go.
  assert.deepEqual(tab.injections, [{ target: { tabId: 7 }, args: ["https://claude.ai/api/organizations", 60000] }]);
  assert.equal(tab.fetches.length, 1);
  assert.equal(tab.fetches[0].url, "https://claude.ai/api/organizations");
  assert.equal(tab.fetches[0].init.credentials, "include");
  assert.equal(tab.fetches[0].init.cache, "no-store");
  assert.ok(tab.fetches[0].init.signal instanceof AbortSignal);
});

test("the fetcher turns each failure into a fixed message", async (t) => {
  const signIn = /^Sign in to Claude in this tab, refresh the page, then try again\.$/;
  const unreadable = /^Could not read from Claude\. Check your connection, refresh the Claude page, then try again\.$/;
  let respond;
  stubTab(t, (url, init) => respond(url, init));
  const getJson = claudeTabFetcher(7);
  for (const [status, pattern] of [
    [401, signIn],
    [403, signIn],
    [429, /^Claude is limiting requests\. Wait a few minutes, then try again\.$/],
    [500, /^Claude returned an error \(HTTP 500\)\. Please try again\.$/]
  ]) {
    respond = async () => new Response("{}", { status });
    await assert.rejects(getJson("/api/organizations"), (error) => {
      assert.match(error.message, pattern);
      assert.equal(error.status, status);
      return true;
    }, String(status));
  }
  for (const failing of [
    async () => { throw new TypeError("Failed to fetch"); },
    async () => new Response("<html>Just a moment...</html>", { status: 200 })
  ]) {
    respond = failing;
    await assert.rejects(getJson("/api/organizations"), (error) => {
      assert.match(error.message, unreadable);
      assert.equal(error.status, 0);
      return true;
    });
  }
});

// The test's own timeout makes a missing request timeout fail instead of hanging.
test("a request that hangs times out as a read failure", { timeout: 2000 }, async (t) => {
  // AbortSignal.timeout does not keep the event loop alive. Without a ref'd timer,
  // Node exits the test before the abort fires and the assertion never runs.
  const keepAlive = setInterval(() => {}, 1000);
  t.after(() => clearInterval(keepAlive));
  // The stub shortens the 60 s timeout; the fake fetch fails only when its signal aborts.
  stubTab(t, (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
  }), { timeoutMs: 5 });
  await assert.rejects(claudeTabFetcher(7)("/api/organizations"), /Could not read from Claude\./);
});

test("a tab the extension cannot run in gives the tab message", async (t) => {
  stubTab(t, async () => new Response("[]", { status: 200 }));
  globalThis.chrome.scripting.executeScript = async () => {
    throw new Error("Cannot access contents of the page");
  };
  await assert.rejects(claudeTabFetcher(7)("/api/organizations"), (error) => {
    assert.equal(error.message, "Could not read the Claude tab. Refresh it, then try again.");
    assert.equal(error.status, undefined);
    return true;
  });
});
