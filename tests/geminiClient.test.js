import test from "node:test";
import assert from "node:assert/strict";
import { createStudyWindow } from "../extension/studyWindow.js";
import { exportGeminiConversation, parseGeminiChatUrl } from "../extension/geminiClient.js";

const ID = "0123456789abcdef";

// 2026-10-13 in America/New_York is [04:00Z on the 13th, 04:00Z on the 14th).
const studyWindow = createStudyWindow({
  startDate: "2026-10-13",
  endDate: "2026-10-13",
  submittedAt: new Date("2026-10-15T12:00:00Z"),
  timeZone: "America/New_York"
});

// The page values a request sends, and the account's email and name beside them in the
// page: none of them may leave the tab.
const TOKEN = "synthetic_at_token_0123456789:1730000000000";
const BL = "boq_synthetic-web-uiserver_20261029.22_p0";
const FSID = "-7777777777777777777";
const EMAIL = "synthetic.person@example.invalid";
const NAME = "Synthetic Person";
const SENTINELS = [TOKEN, BL, FSID, EMAIL, NAME];
const leaks = (value) => SENTINELS.filter((sentinel) => JSON.stringify(value ?? null).includes(sentinel));

// The only writer of the setup script's text (tests/fixtures/geminiExport.mjs has a copy):
// the page's data object, with the email and name under made-up keys. A null value
// leaves its key out. Provisional until the live check of how the page writes it.
function setupScript({ at = TOKEN, bl = BL, fsid = FSID } = {}) {
  const values = { FdrFJe: fsid, Im6cmf: "/_/BardChatUi", SNlM0e: at, cfb2h: bl, qSynthMail: EMAIL, qSynthName: NAME };
  return `window.WIZ_global_data = ${JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)))};`;
}
// An external script has empty text; the setup script comes after it.
const scripts = (values) => [{ textContent: "" }, { textContent: setupScript(values) }];

// Shapes as observed on gemini.google.com (November 2026), with synthetic values. A time
// is [seconds, nanos]. A draft holds its id, [text] and, at 8, [status]: 2 once finished.
// A turn holds [chat, turn id], the link to the older turn, [[prompt]], [drafts, …, the
// shown draft's id at 3] and its time.
const pair = (iso, extraNanos = 0) => {
  const ms = Date.parse(iso);
  return [Math.floor(ms / 1000), (ms % 1000) * 1e6 + extraNanos];
};
const draft = (id, text, status = 2) => [id, [text], null, null, null, null, null, null, [status], "en"];
// Each turn also carries the empty placeholder draft of a fresh send.
const turn = (n, time, prompt, reply, { drafts, shown } = {}) => [
  [`c_${ID}`, `r_${n}`],
  null,
  [[prompt, null, null, null], 2, null, 1],
  [drafts ?? [draft(`rc_${n}`, reply), draft(`rc_${n}x`, "")], null, null, shown ?? `rc_${n}`, null, null, null, true],
  time
];
// Links each turn, newest first, to the next older one by its turn id and shown draft id.
// The chat's first turn has no link.
const chain = (turns) => turns.map((t, index) => {
  const older = turns[index + 1];
  return [t[0], older ? [`c_${ID}`, older[0][1], older[3][3]] : null, ...t.slice(2)];
});
const payload = (turns, cursor) => [turns, cursor, null, []];
// A batchexecute body: the guard line, then each JSON line after its length line.
const frame = (rows) => `)]}'\n\n123\n${JSON.stringify(rows)}\n25\n[["e",4,null,null,1234]]\n`;
const response = (p) => frame([["wrb.fr", "hNvQHb", JSON.stringify(p), null, null, null, "generic"], ["di", 59], ["af.httprm", 58, "-1234", 24]]);
const raw = (rows) => () => new Response(frame(rows));

// One chat, newest first. Each comment names the rule the turn covers.
const TURNS = chain([
  // The newest turn, at To's end: no rows, so its status is not checked.
  turn(9, pair("2026-10-14T04:00:00.000Z"), "Too late", "Late"),
  // The nanos floor to the last millisecond of To.
  turn(8, pair("2026-10-14T03:59:59.000Z", 999_999_999), "Last moment of To", "Goodnight"),
  // An image sent without words: an empty Me row.
  turn(7, pair("2026-10-13T15:00:00.000Z"), "", "Nice photo!"),
  // The shown draft, not the first.
  turn(6, pair("2026-10-13T14:00:00.000Z"), "Pick one", null,
    { drafts: [draft("rc_6a", "Draft A"), draft("rc_6b", "Draft B")], shown: "rc_6b" }),
  // A placeholder link, kept as written.
  turn(5, pair("2026-10-13T13:00:00.000Z"), "Draw a cat", "Here it is:\nhttp://googleusercontent.com/image_generation_content/0"),
  // Text as written; nanos below a millisecond are dropped.
  turn(4, pair("2026-10-13T12:00:00.123Z", 456_789), "She said \"hi\", then left", " It’s fine — 你好 😊\n**Line two**"),
  turn(3, pair("2026-10-13T04:00:00.000Z"), "Good morning", "Morning!"),
  turn(2, pair("2026-10-13T03:59:59.999Z"), "Too early", "Early"),
  // The chat's first turn.
  turn(1, pair("2026-10-12T12:00:00.000Z"), "Hello", "Hi")
]);

const record = (iso, from, text) => ({ instantMs: Date.parse(iso), from, text, reaction: "N/A" });
const EXPECTED = [
  record("2026-10-14T03:59:59.999Z", "Gemini", "Goodnight"),
  record("2026-10-14T03:59:59.999Z", "Me", "Last moment of To"),
  record("2026-10-13T15:00:00.000Z", "Gemini", "Nice photo!"),
  record("2026-10-13T15:00:00.000Z", "Me", ""),
  record("2026-10-13T14:00:00.000Z", "Gemini", "Draft B"),
  record("2026-10-13T14:00:00.000Z", "Me", "Pick one"),
  record("2026-10-13T13:00:00.000Z", "Gemini", "Here it is:\nhttp://googleusercontent.com/image_generation_content/0"),
  record("2026-10-13T13:00:00.000Z", "Me", "Draw a cat"),
  record("2026-10-13T12:00:00.123Z", "Gemini", " It’s fine — 你好 😊\n**Line two**"),
  record("2026-10-13T12:00:00.123Z", "Me", "She said \"hi\", then left"),
  record("2026-10-13T04:00:00.000Z", "Gemini", "Morning!"),
  record("2026-10-13T04:00:00.000Z", "Me", "Good morning")
];

// Turn n of turns cloned and changed by change(x), the others as they are.
const edited = (n, change, turns = TURNS) => turns.map((t) => {
  if (t[0][1] !== `r_${n}`) return t;
  const copy = structuredClone(t);
  change(copy);
  return copy;
});
// The same, chained again so the links follow the change.
const changed = (n, change, turns) => chain(edited(n, change, turns));
const shownDraft = (t) => t[3][0].find((c) => c[0] === t[3][3]);
const withStatus = (status) => (t) => { shownDraft(t)[8] = status; };
const stopped = withStatus([1]);
const withText = (text) => (t) => { shownDraft(t)[1] = [text]; };

// Routes are keyed by the cursor a request's f.req asks for, "first" for none.
const fReqArgs = (init) => JSON.parse(JSON.parse(new URLSearchParams(init.body).get("f.req"))[0][0][1]);
const onePage = (turns, cursor = null) => ({ first: payload(turns, cursor) });
// Page A, t9 to t5, then page B, t4 to t1, asked for by page A's cursor.
const twoPages = (turns) => ({ first: payload(turns.slice(0, 5), "cursor-b"), "cursor-b": payload(turns.slice(5), null) });
const ONE_PAGE = onePage(TURNS);
const TWO_PAGES = twoPages(TURNS);
const PAGE_A = TWO_PAGES.first;

// Chrome rebuilds the injected function from its source, so anything it borrowed from
// the module would be undefined in the page; the stub does the same. Chrome also clones
// the result, which proves it is plain data. The stub records each injection, its raw
// result and each fetch. A route that is a payload answers 200 with it, a number answers
// that status, "throw" fails the request, "html" answers 200 with a page that is not
// batchexecute, and a function answers for itself; anything unrouted answers 500. A test
// may stub twice, so each restores the globals from before any stub.
const original = { chrome: globalThis.chrome, document: globalThis.document, fetch: globalThis.fetch };
function stubTab(t, routes, { scripts: pageScripts = scripts(), timeoutMs } = {}) {
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  const injections = [];
  const results = [];
  const fetches = [];
  globalThis.document = { scripts: pageScripts, documentElement: { lang: "en-GB" } };
  globalThis.fetch = async (url, init) => {
    fetches.push({ url, init });
    const route = routes[fReqArgs(init)[2] ?? "first"];
    if (typeof route === "function") return route(url, init);
    if (route === "throw") throw new TypeError("Failed to fetch");
    if (route === "html") return new Response("<html>Just a moment...</html>", { status: 200 });
    if (typeof route === "number") return new Response("{}", { status: route });
    if (Array.isArray(route)) return new Response(response(route), { status: 200 });
    return new Response("Unexpected request", { status: 500 });
  };
  globalThis.chrome = {
    scripting: {
      executeScript: async ({ func, ...details }) => {
        injections.push(details);
        const args = [...details.args];
        if (timeoutMs !== undefined) args[4] = timeoutMs;
        const result = await new Function(`return (${func})`)()(...args);
        results.push(result);
        // Every exit of every test is checked: a page value in a result fails here, and the
        // export then gives the tab message, which no test with this stub expects.
        assert.deepEqual(leaks(result), []);
        return [{ result: structuredClone(result) }];
      }
    }
  };
  return { injections, results, fetches };
}

const exportChat = (accountPath = "") =>
  exportGeminiConversation({ tabId: 7, chatId: ID, accountPath, studyWindow });

const SIGN_IN = "Sign in to Gemini in this tab, refresh the page, then try again.";
const RATE_LIMIT = "Gemini is limiting requests. Wait a few minutes, then try again.";
const UNREADABLE = "Could not read from Gemini. Check your connection, refresh the Gemini page, then try again.";
const http = (status) => `Gemini returned an error (HTTP ${status}). Please try again.`;
const NOT_FINISHED = "Gemini has not finished its last reply in this chat. Wait for it to finish, or regenerate the reply if it stopped, then export again.";
const UNEXPECTED = "Gemini returned an unexpected response. Please try again.";
const INCOMPLETE = "Gemini returned an incomplete chat. Please try again.";
const INVALID = "Gemini returned an invalid chat message. Please try again.";
const UNSUPPORTED = "Gemini returned a kind of message CompanionLink cannot export yet. Please send this error to the research team.";
const TAB = "Could not read the Gemini tab. Refresh it, then try again.";

test("only a gemini.google.com chat page is accepted, with its id and account path lowercased", () => {
  for (const [url, expected] of [
    [`https://gemini.google.com/app/${ID}`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/app/${ID}/`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/app/${ID}?hl=en#x`, { chatId: ID, accountPath: "" }],
    [`https://GEMINI.GOOGLE.COM/U/1/APP/${ID.toUpperCase()}`, { chatId: ID, accountPath: "/u/1" }],
    [`https://gemini.google.com/gem/synthetic-gem/${ID}`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/u/2/gem/synthetic-gem/${ID}/`, { chatId: ID, accountPath: "/u/2" }]
  ]) {
    assert.deepEqual(parseGeminiChatUrl(url), expected, url);
  }
});

test("other gemini.google.com pages, lookalike hosts and other sites are rejected", () => {
  for (const url of [
    "https://gemini.google.com/",
    "https://gemini.google.com/app",
    "https://gemini.google.com/app/",
    `https://gemini.google.com/app/${ID.slice(1)}`,
    `https://gemini.google.com/app/${ID}0`,
    "https://gemini.google.com/app/0123456789abcdeg",
    `https://gemini.google.com/app/${ID}/x`,
    "https://gemini.google.com/gem/synthetic-gem",
    "https://gemini.google.com/gems/view",
    "https://gemini.google.com/u/1",
    `https://gemini.google.com/u/x/app/${ID}`,
    `https://gemini.google.com/share/${ID}`,
    `https://gemini.google.com/chat/${ID}`,
    `http://gemini.google.com/app/${ID}`,
    `https://www.gemini.google.com/app/${ID}`,
    `https://bard.google.com/app/${ID}`,
    `https://business.gemini.google/app/${ID}`,
    `https://gemini.google.com.example.com/app/${ID}`,
    `https://gemini.google.com@example.com/app/${ID}`,
    `https://example.com/gemini.google.com/app/${ID}`,
    "https://chatgpt.com/c/2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091",
    "https://claude.ai/chat/3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b",
    "https://kindroid.ai/v2/chat/exampleCompanion",
    "https://my.replika.com/chat",
    "not a URL",
    undefined
  ]) {
    assert.equal(parseGeminiChatUrl(url), null, String(url));
  }
});

test("exports each in-window turn as a Gemini row above a Me row at the turn's time, newest first", async (t) => {
  stubTab(t, ONE_PAGE);
  assert.deepEqual(await exportChat(), EXPECTED);
});

test("an odd turn outside the dates is checked only for its ids, link and time", async (t) => {
  const odd = changed(2, (x) => { x[2][0][0] = 42; x[3][0] = "x"; }, edited(9, stopped));
  stubTab(t, onePage(odd));
  assert.deepEqual(await exportChat(), EXPECTED);
});

test("one injection in the tab's own world, with only the chat, account path, dates and timeout", async (t) => {
  const tab = stubTab(t, ONE_PAGE);
  await exportChat();
  // No world: "MAIN", so the page cannot replace fetch; same-origin cookies still go.
  assert.deepEqual(tab.injections, [{ target: { tabId: 7 }, args: [ID, "", studyWindow.startMs, studyWindow.endMs, 60000] }]);
});

test("each request is the page's own hNvQHb POST, uncached, with the token only in the body", async (t) => {
  const tab = stubTab(t, ONE_PAGE);
  await exportChat();
  assert.equal(tab.fetches.length, 1);
  const [{ url, init }] = tab.fetches;
  const { origin, pathname, searchParams } = new URL(url);
  assert.equal(`${origin}${pathname}`, "https://gemini.google.com/_/BardChatUi/data/batchexecute");
  assert.deepEqual([...searchParams.keys()], ["rpcids", "source-path", "bl", "f.sid", "hl", "_reqid", "rt"]);
  assert.equal(searchParams.get("rpcids"), "hNvQHb");
  assert.equal(searchParams.get("source-path"), `/app/${ID}`);
  assert.equal(searchParams.get("bl"), BL);
  assert.equal(searchParams.get("f.sid"), FSID);
  assert.equal(searchParams.get("hl"), "en-GB");
  assert.match(searchParams.get("_reqid"), /^\d+$/);
  assert.equal(searchParams.get("rt"), "c");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "X-Same-Domain": "1" });
  const body = new URLSearchParams(init.body);
  assert.deepEqual([...body.keys()], ["f.req", "at"]);
  assert.equal(body.get("at"), TOKEN);
  assert.deepEqual(JSON.parse(body.get("f.req")),
    [[["hNvQHb", JSON.stringify([`c_${ID}`, 10, null, 1, [1], [4], null, 1]), null, "generic"]]]);
  assert.equal(init.credentials, "include");
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);
});

test("a /u/N chat posts under that account's path", async (t) => {
  const tab = stubTab(t, ONE_PAGE);
  await exportChat("/u/1");
  assert.ok(tab.fetches[0].url.startsWith("https://gemini.google.com/u/1/_/BardChatUi/data/batchexecute?"), tab.fetches[0].url);
});

test("two chained pages give the same records as one, the second asked for by cursor", async (t) => {
  const tab = stubTab(t, TWO_PAGES);
  assert.deepEqual(await exportChat(), EXPECTED);
  assert.deepEqual(tab.fetches.map(({ init }) => fReqArgs(init)[2]), [null, "cursor-b"]);
});

test("paging ends without a cursor only at the chat's first turn", async (t) => {
  // t8 to t3, all in the dates; t3 still links to t2.
  const linked = TURNS.slice(1, 7);
  const first = chain(linked);
  for (const route of [payload(first, null), [first]]) {
    const tab = stubTab(t, { first: route });
    assert.deepEqual(await exportChat(), EXPECTED, JSON.stringify(route.slice(1)));
    assert.equal(tab.fetches.length, 1);
  }
  const tab = stubTab(t, onePage(linked));
  await assert.rejects(exportChat(), { message: INCOMPLETE });
  assert.equal(tab.fetches.length, 1);
});

test("a broken chain stops the export as incomplete", async (t) => {
  // t6's link names another turn, then another draft of t5.
  for (const turns of [edited(6, (x) => { x[1][1] = "r_x"; }), edited(6, (x) => { x[1][2] = "rc_x"; })]) {
    stubTab(t, onePage(turns));
    await assert.rejects(exportChat(), { message: INCOMPLETE });
  }
  // t5, the oldest on page A, does not link to t4, the newest on page B.
  stubTab(t, twoPages(edited(5, (x) => { x[1][2] = "rc_x"; })));
  await assert.rejects(exportChat(), { message: INCOMPLETE });
  // A cursor followed by a page without turns.
  stubTab(t, { first: PAGE_A, "cursor-b": payload([], null) });
  await assert.rejects(exportChat(), { message: INCOMPLETE });
});

// Its cursor would ask for the same page again. Answering it only once, with the test's
// own timeout, makes a missing chain check fail instead of looping forever.
test("an older page that repeats the newer one stops instead of looping", { timeout: 2000 }, async (t) => {
  let answered = false;
  const once = () => (answered ? new Response("{}", { status: 500 }) : (answered = true, new Response(response(PAGE_A))));
  const tab = stubTab(t, { first: PAGE_A, "cursor-b": once });
  await assert.rejects(exportChat(), { message: INCOMPLETE });
  assert.equal(tab.fetches.length, 2);
});

// Page A holds a turn in the dates above EDGE, with a cursor; page B holds the chat's
// first turn, before From. Returns how many pages were asked for.
async function pagesOnFrom(t, edgeMs) {
  const [newest, edge, oldest] = chain([
    turn(3, pair("2026-10-13T12:00:00.000Z"), "Hi", "Hello"),
    turn(2, pair(new Date(edgeMs).toISOString()), "Edge", "Edge reply"),
    turn(1, pair("2026-10-01T12:00:00.000Z"), "Older", "Old reply")
  ]);
  const tab = stubTab(t, { first: payload([newest, edge], "cursor-b"), "cursor-b": payload([oldest], null) });
  await exportChat();
  return tab.fetches.length;
}

test("paging stops once a page's oldest turn is before From", async (t) => {
  assert.equal(await pagesOnFrom(t, studyWindow.startMs), 2);
  assert.equal(await pagesOnFrom(t, studyWindow.startMs - 1), 1);
});

test("a turn timed after the newer one stops the export; equal times pass", async (t) => {
  // t5 is at 13:00Z; t4 is the newest turn on page B.
  const later = edited(4, (x) => { x[4] = pair("2026-10-13T13:00:00.001Z"); });
  for (const routes of [onePage(later), twoPages(later)]) {
    stubTab(t, routes);
    await assert.rejects(exportChat(), { message: UNEXPECTED });
  }
  stubTab(t, onePage(edited(4, (x) => { x[4] = pair("2026-10-13T13:00:00.000Z"); })));
  assert.equal((await exportChat()).length, EXPECTED.length);
});

test("a reply Gemini is still writing in the dates stops the export", async (t) => {
  // Without t9, t8 is the chat's newest turn: a status other than 2, none, or no text yet.
  for (const change of [stopped, withStatus([0]), (x) => { shownDraft(x).length = 8; }, withText("")]) {
    stubTab(t, onePage(changed(8, change, TURNS.slice(1))));
    await assert.rejects(exportChat(), { message: NOT_FINISHED });
  }
});

test("a stopped older reply in the dates exports as written", async (t) => {
  // Mid-page; the first turn in the dates, below t9 after To; the newest turn on page B.
  for (const routes of [onePage(edited(6, stopped)), onePage(edited(8, stopped)), twoPages(edited(4, stopped))]) {
    stubTab(t, routes);
    assert.deepEqual(await exportChat(), EXPECTED);
  }
});

test("an older reply without words, or with a card placeholder, stops the export", async (t) => {
  for (const text of ["", "http://googleusercontent.com/card_content/0", "Here is a card:\nhttp://googleusercontent.com/card_content/0"]) {
    stubTab(t, onePage(edited(5, withText(text))));
    await assert.rejects(exportChat(), { message: UNSUPPORTED }, text);
  }
});

test("every walked turn's time is checked, in the dates or not", async (t) => {
  // t2 is 1 ms before From.
  for (const change of [
    (x) => { x[4] = null; },
    (x) => { x[4][0] *= 1000; },
    (x) => { x[4][1] = 1e9; },
    (x) => { x[4][1] = -1; }
  ]) {
    stubTab(t, onePage(edited(2, change)));
    await assert.rejects(exportChat(), { message: INVALID }, String(change));
  }
  // A zero field is left out of the data: t3, on the second, without its nanos.
  stubTab(t, onePage(edited(3, (x) => { x[4] = [x[4][0]]; })));
  assert.deepEqual(await exportChat(), EXPECTED);
});

for (const [name, routes, message] of [
  ["no hNvQHb row", { first: raw([["wrb.fr", "otherRpc", JSON.stringify(payload(TURNS, null)), null, null, null, "generic"], ["di", 59]]) }, UNEXPECTED],
  ["a null payload", { first: raw([["wrb.fr", "hNvQHb", null, null, null, [5], "generic"]]) }, UNEXPECTED],
  ["a payload that is not JSON", { first: raw([["wrb.fr", "hNvQHb", "not JSON", null, null, null, "generic"]]) }, UNEXPECTED],
  ["turns that are a string", onePage("x"), UNEXPECTED],
  ["a first page without turns", onePage([]), UNEXPECTED],
  ["a first page with null turns", onePage(null), UNEXPECTED],
  ["a numeric cursor", onePage(TURNS, 5), UNEXPECTED],
  ["a turn of another chat", onePage(edited(4, (x) => { x[0][0] = "c_fedcba9876543210"; })), UNEXPECTED],
  ["a turn without a turn id", onePage(changed(4, (x) => { x[0].length = 1; })), INVALID],
  ["a prompt that is a number", onePage(edited(4, (x) => { x[2][0][0] = 42; })), INVALID],
  ["a null prompt", onePage(edited(4, (x) => { x[2][0][0] = null; })), INVALID],
  ["drafts that are not a list", onePage(edited(4, (x) => { x[3][0] = "x"; })), INVALID],
  ["a shown id that names no draft", onePage(changed(4, (x) => { x[3][3] = "rc_missing"; })), INVALID],
  // A null id would otherwise match a draft without one.
  ["a shown id that is not a string", onePage(changed(4, (x) => { x[3][0][0][0] = null; x[3][3] = null; })), INVALID],
  ["reply text that is a number", onePage(edited(4, withText(42))), INVALID]
]) {
  test(`stops with an error on ${name}`, async (t) => {
    stubTab(t, routes);
    await assert.rejects(exportChat(), (error) => {
      assert.equal(error.message, message);
      assert.match(error.message, /^Gemini returned an? [a-z ]+\. Please try again\.$/);
      return true;
    });
  });
}

test("no token stops before any request; no build label or session id too", async (t) => {
  for (const [values, message] of [[{ at: null }, SIGN_IN], [{ bl: null }, UNEXPECTED], [{ fsid: null }, UNEXPECTED]]) {
    const tab = stubTab(t, ONE_PAGE, { scripts: scripts(values) });
    await assert.rejects(exportChat(), { message }, JSON.stringify(values));
    assert.equal(tab.fetches.length, 0, JSON.stringify(values));
  }
});

test("a request that fails, first or older, stops the export at once", async (t) => {
  for (const [status, message] of [
    [400, SIGN_IN],
    [401, SIGN_IN],
    [403, SIGN_IN],
    [429, RATE_LIMIT],
    [404, http(404)],
    [500, http(500)],
    ["throw", UNREADABLE],
    ["html", UNREADABLE]
  ]) {
    let tab = stubTab(t, { first: status });
    await assert.rejects(exportChat(), { message }, `first ${status}`);
    assert.equal(tab.fetches.length, 1, `first ${status}`);
    tab = stubTab(t, { first: PAGE_A, "cursor-b": status });
    await assert.rejects(exportChat(), { message }, `older ${status}`);
    assert.equal(tab.fetches.length, 2, `older ${status}`);
  }
});

// The test's own timeout makes a missing request timeout fail instead of hanging.
test("a request that hangs times out as a read failure", { timeout: 2000 }, async (t) => {
  // The stub shortens the 60 s timeout; the fake fetch fails only when its signal aborts.
  // A real hung request keeps its connection open; the timer stands in for it, since Node
  // does not let AbortSignal.timeout keep it running and would exit before the abort. A
  // request without a signal never fails, so the test times out.
  const hang = (_url, init) => new Promise((_resolve, reject) => {
    const connection = setTimeout(() => {}, 2000);
    init.signal?.addEventListener("abort", () => {
      clearTimeout(connection);
      reject(init.signal.reason);
    });
  });
  stubTab(t, { first: hang }, { timeoutMs: 5 });
  await assert.rejects(exportChat(), { message: UNREADABLE });
});

test("a tab the extension cannot run in, or no usable result, gives the tab message", async (t) => {
  for (const executeScript of [
    async () => { throw new Error("Cannot access contents of the page"); },
    async () => [],
    async () => [{ result: null }],
    async () => [{ result: { error: "made-up" } }]
  ]) {
    stubTab(t, ONE_PAGE);
    globalThis.chrome.scripting.executeScript = executeScript;
    await assert.rejects(exportChat(), { message: TAB });
  }
});

test("nothing from the setup script leaves the tab, in records or errors", async (t) => {
  for (const [name, routes, values] of [
    ["rows", ONE_PAGE],
    ["two pages", TWO_PAGES],
    ["not finished", onePage(changed(8, stopped, TURNS.slice(1)))],
    ["unsupported", onePage(edited(5, withText("")))],
    // A page the export cannot use still holds everything else.
    ["no token", ONE_PAGE, { at: null }],
    ["401", { first: 401 }],
    ["no hNvQHb row", { first: raw([["di", 59]]) }]
  ]) {
    const tab = stubTab(t, routes, { scripts: scripts(values) });
    const outcome = await exportChat().catch((error) => error.message);
    assert.equal(tab.results.length, 1, name);
    assert.deepEqual(leaks(tab.results[0]), [], name);
    assert.deepEqual(leaks(outcome), [], name);
  }
});

test("the token goes only in the body's at, the build label and session id only in the query", async (t) => {
  for (const routes of [ONE_PAGE, TWO_PAGES]) {
    const tab = stubTab(t, routes);
    await exportChat();
    for (const { url, init } of tab.fetches) {
      const { at, ...rest } = Object.fromEntries(new URLSearchParams(init.body));
      assert.equal(at, TOKEN);
      const places = { url: decodeURIComponent(url), body: JSON.stringify(rest), headers: JSON.stringify(init.headers) };
      const where = (value) => Object.keys(places).filter((place) => places[place].includes(value));
      assert.deepEqual(where(TOKEN), [], url);
      assert.deepEqual(where(BL), ["url"], url);
      assert.deepEqual(where(FSID), ["url"], url);
      assert.deepEqual(where(EMAIL), [], url);
      assert.deepEqual(where(NAME), [], url);
    }
  }
});
