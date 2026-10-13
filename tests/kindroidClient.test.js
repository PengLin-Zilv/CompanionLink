import test from "node:test";
import assert from "node:assert/strict";
import { createStudyWindow } from "../extension/studyWindow.js";
import { createPacer, exportKindroidHistory, parseKindroidChatUrl } from "../extension/kindroidClient.js";

// 2026-09-29 in America/New_York is [04:00Z on the 29th, 04:00Z on the 30th).
const studyWindow = createStudyWindow({
  startDate: "2026-09-29",
  endDate: "2026-09-29",
  submittedAt: new Date("2026-10-01T12:00:00Z"),
  timeZone: "America/New_York"
});
const at = (iso) => Date.parse(iso);

function message(id, iso, sender = "ai", text = `text ${id}`) {
  return { id, timestamp: at(iso), sender, display_name: sender === "ai" ? "B" : "Peng", message: text };
}

// Behaves like the live API (checked 2026-09-30): start_after_timestamp is strictly
// after and accepts any value, messages come oldest first, a full page has hasMore.
function mockServer(messages, { status = 200, body } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    calls.push({ params: Object.fromEntries(u.searchParams), auth: init.headers.Authorization });
    if (status !== 200) return new Response("Error", { status });
    if (body !== undefined) return new Response(body, { status: 200 });
    const limit = Number(u.searchParams.get("limit"));
    const after = u.searchParams.has("start_after_timestamp") ? Number(u.searchParams.get("start_after_timestamp")) : -Infinity;
    const page = messages.filter((m) => m.timestamp > after).slice(0, limit);
    return new Response(JSON.stringify({
      messages: page,
      pagination: { hasMore: page.length === limit, lastTimestamp: page.at(-1)?.timestamp ?? null, limit }
    }), { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  };
  return { fetchImpl, calls };
}

// Sleeping advances the fake clock at once, so pacing never makes a test wait.
function fakeClock() {
  const clock = { t: 0 };
  clock.pacer = createPacer({ now: () => clock.t, sleep: async (ms) => { clock.t += ms; } });
  return clock;
}

// Wraps mockServer to record when each call was sent and ended on the fake clock.
function timedServer(clock, messages, { latency = () => 200, failAt = -1, failure } = {}) {
  const inner = mockServer(messages);
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { sentAt: clock.t };
    calls.push(call);
    clock.t += latency(calls.length - 1);
    call.endedAt = clock.t;
    return calls.length - 1 === failAt ? failure() : inner.fetchImpl(url, init);
  };
  return { fetchImpl, calls };
}

const run = (server, options = {}) => exportKindroidHistory({
  apiKey: "kn_test", aiId: "AI1", studyWindow, fetchImpl: server.fetchImpl, pageSize: 2, pacer: fakeClock().pacer, ...options
});
const pageBody = (messages) => JSON.stringify({ messages, pagination: { hasMore: false } });

const chat = [
  message("before", "2026-09-28T20:00:00Z"),
  message("atStart", "2026-09-29T04:00:00.000Z", "user"),
  message("morning", "2026-09-29T13:00:00Z", "ai", "line one\nline two"),
  message("noon", "2026-09-29T16:00:00Z", "user"),
  message("evening", "2026-09-30T01:00:00Z"),
  message("atEnd", "2026-09-30T04:00:00.000Z", "user"),
  message("after", "2026-09-30T15:00:00Z")
];

test("exports only the window, newest first, as neutral records", async () => {
  const server = mockServer(chat);
  const { records, companionName } = await run(server);
  assert.deepEqual(records.map((r) => r.id), ["evening", "noon", "morning", "atStart"]);
  // The existence check plus four pages: paging stops at the window end instead of
  // reading the rest of the history, which would waste the request limits.
  assert.equal(server.calls.length, 5);
  assert.equal(companionName, "B");
  assert.deepEqual(records.find((r) => r.id === "morning"), {
    id: "morning", instantMs: at("2026-09-29T13:00:00Z"), from: "Kin", text: "line one\nline two", reaction: "N/A"
  });
  assert.equal(records.find((r) => r.id === "noon").from, "Me");
});

test("a message without text, such as an image, keeps its row with empty text", async () => {
  const image = { ...message("image", "2026-09-29T12:00:00Z", "user"), message: undefined, image_urls: ["https://example.invalid/a.jpg"] };
  const { records } = await run(mockServer([chat[1], image]));
  assert.equal(records.find((r) => r.id === "image").text, "");
});

test("starts at the window, not at the oldest message", async () => {
  const server = mockServer(chat);
  await run(server);
  assert.deepEqual(server.calls[0].params, { ai_id: "AI1", limit: "1" });
  assert.equal(server.calls[1].params.start_after_timestamp, String(studyWindow.startMs - 1));
  assert.ok(server.calls.every((c) => c.auth === "Bearer kn_test"));
});

test("keeps messages that share a millisecond across a page edge", async () => {
  // Page 1 ends with t1; t2 has the same millisecond. A plain strictly-after
  // cursor (lastTimestamp) would skip t2; lastTimestamp - 1 keeps it.
  const tied = [
    message("a", "2026-09-29T08:00:00Z"),
    message("b", "2026-09-29T09:00:00Z", "user"),
    message("t1", "2026-09-29T10:00:00Z"),
    message("t2", "2026-09-29T10:00:00Z", "user"),
    message("c", "2026-09-29T11:00:00Z")
  ];
  const { records } = await run(mockServer(tied), { pageSize: 3 });
  assert.deepEqual(records.map((r) => r.id), ["c", "t2", "t1", "b", "a"]);
});

test("an empty window is a successful empty export", async () => {
  const { records } = await run(mockServer([chat[0], chat[6]]));
  assert.deepEqual(records, []);
});

test("an unknown ai_id (HTTP 200, no messages) is an error", async () => {
  await assert.rejects(run(mockServer([])), /No messages found/);
});

test("HTTP errors become fixed messages that never contain the key", async () => {
  for (const [status, pattern] of [
    [400, /could not find this chat/], [401, /did not accept this API key/],
    [403, /did not allow access/], [429, /limiting requests/],
    [503, /not responding/], [418, /HTTP 418/]
  ]) {
    await assert.rejects(run(mockServer(chat, { status })), (error) => {
      assert.match(error.message, pattern);
      assert.doesNotMatch(error.message, /kn_test/);
      return true;
    });
  }
});

test("network failures and timeouts are errors", async () => {
  const failing = (error) => ({ fetchImpl: async () => { throw error; } });
  await assert.rejects(run(failing(new TypeError("Failed to fetch"))), /Could not reach Kindroid/);
  await assert.rejects(run(failing(new DOMException("timed out", "TimeoutError"))), /did not respond in time/);
});

test("unexpected data fails loudly", async () => {
  // As the chat's oldest message, checked by the first request.
  await assert.rejects(run(mockServer([{ ...chat[2], sender: "narrator" }])), /invalid chat message/);
  await assert.rejects(run(mockServer([{ ...chat[2], timestamp: 1790723429 }])), /invalid chat message/);
  await assert.rejects(run(mockServer([{ ...chat[2], id: "" }])), /invalid chat message/);
  // Inside the window, checked while paging.
  for (const bad of [{ sender: "narrator" }, { id: undefined }, { message: { text: "words" } }]) {
    await assert.rejects(run(mockServer([chat[0], { ...chat[2], ...bad }])), /invalid chat message/, JSON.stringify(bad));
  }
  await assert.rejects(run(mockServer(chat, { body: "<html>" })), /unreadable response/);
  await assert.rejects(run(mockServer(chat, { body: JSON.stringify({ messages: [chat[1]] }) })), /unexpected response/);
});

test("a page that breaks the tested ordering or cursor rules is an error", async () => {
  await assert.rejects(run(mockServer(chat, { body: pageBody([chat[3], chat[2]]) })), /out of order/);
  await assert.rejects(run(mockServer(chat, { body: pageBody([chat[0]]) })), /outside the requested dates/);
});

test("a cursor that cannot advance is an error, not a loop", async () => {
  const same = ["s1", "s2", "s3"].map((id) => message(id, "2026-09-29T10:00:00Z"));
  await assert.rejects(run(mockServer(same)), /same messages/);
});

// 52 messages one minute apart inside the window: with pageSize 2 the walk makes
// about 53 calls, enough for several pacing waits.
const busyChat = Array.from({ length: 52 }, (_, i) =>
  message(`m${i}`, new Date(studyWindow.startMs + (i + 1) * 60000).toISOString(), i % 2 ? "user" : "ai"));

test("each request waits until the request nine back ended over 31 s ago", async () => {
  const clock = fakeClock();
  const waits = [];
  // Slow calls like the live check's 5.5 s and 25.4 s: pacing must anchor on the end.
  const server = timedServer(clock, busyChat, { latency: (n) => (n === 0 ? 5500 : n === 13 ? 25400 : 200) });
  const { records } = await run(server, { pacer: clock.pacer, onWait: (ms) => waits.push(ms) });

  assert.equal(records.length, 52);
  const expectedWaits = [];
  server.calls.forEach((call, n) => {
    const previousEnd = n ? server.calls[n - 1].endedAt : 0;
    const earliest = Math.max(previousEnd, n >= 9 ? server.calls[n - 9].endedAt + 31000 : -Infinity);
    assert.equal(call.sentAt, earliest, `call ${n}`);
    if (earliest > previousEnd) expectedWaits.push(earliest - previousEnd);
  });
  assert.deepEqual(waits, expectedWaits);
  assert.ok(waits.length >= 3);
});

test("each request's 60 s timeout starts after its pacing wait", async (t) => {
  const clock = fakeClock();
  const timeouts = [];
  const original = AbortSignal.timeout;
  AbortSignal.timeout = (ms) => { timeouts.push({ at: clock.t, ms }); return original.call(AbortSignal, ms); };
  t.after(() => { AbortSignal.timeout = original; });

  const server = timedServer(clock, busyChat);
  await run(server, { pacer: clock.pacer });
  assert.deepEqual(timeouts, server.calls.map((call) => ({ at: call.sentAt, ms: 60000 })));
});

test("a failed request still counts, and the pacer outlives one export", async () => {
  for (const failure of [
    () => { throw new TypeError("Failed to fetch"); },
    () => { throw new DOMException("timed out", "TimeoutError"); },
    () => new Response("Error", { status: 503 }),
    () => new Response("<html>", { status: 200 })
  ]) {
    const clock = fakeClock();
    const failed = timedServer(clock, busyChat, { failAt: 8, failure });
    await assert.rejects(run(failed, { pacer: clock.pacer }));
    const next = timedServer(clock, busyChat);
    await run(next, { pacer: clock.pacer });
    assert.equal(next.calls[0].sentAt, failed.calls[0].endedAt + 31000);
  }
});

test("a 429 fills the window, so a retry in the same popup waits it out", async () => {
  const clock = fakeClock();
  const waits = [];
  const limited = timedServer(clock, chat, {
    failAt: 0, failure: () => new Response("Too Many Requests (API limit)", { status: 429 })
  });
  await assert.rejects(run(limited, { pacer: clock.pacer }), /limiting requests/);
  const retry = timedServer(clock, chat);
  await run(retry, { pacer: clock.pacer, onWait: (ms) => waits.push(ms) });
  assert.equal(retry.calls[0].sentAt, limited.calls[0].endedAt + 31000);
  assert.deepEqual(waits, [31000]);
});

test("only one-to-one v2 chat pages are accepted", () => {
  assert.equal(parseKindroidChatUrl("https://kindroid.ai/v2/chat/he0zRn7aAZrKQzeW06o4/"), "he0zRn7aAZrKQzeW06o4");
  assert.equal(parseKindroidChatUrl("https://kindroid.ai/v2/chat/group/abc"), null);
  assert.equal(parseKindroidChatUrl("https://kindroid.ai/v2/chat/room/abc"), null);
  assert.equal(parseKindroidChatUrl("https://kindroid.ai/chat/abc"), null);
  assert.equal(parseKindroidChatUrl("http://kindroid.ai/v2/chat/abc"), null);
  assert.equal(parseKindroidChatUrl("https://kindroid.ai.example.com/v2/chat/abc"), null);
  assert.equal(parseKindroidChatUrl("not a url"), null);
});
