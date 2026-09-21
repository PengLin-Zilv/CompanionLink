import test from "node:test";
import assert from "node:assert/strict";
import { exportHistory } from "../extension/v17Client.js";
import { createStudyWindow } from "../extension/studyWindow.js";

const initMessage = JSON.stringify({
  event_name: "init", payload: {}, token: "fixture",
  auth: { user_id: "10", auth_token: "fixture", device_id: "fixture" }
});
const message = (id) => ({
  id, meta: { timestamp: "2026-09-01T12:00:00Z", nature: "Customer" },
  content: { text: "Synthetic message" }
});

function setup(t, studyWindow) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let socket;
  class Socket {
    constructor() { socket = this; this.sent = []; this.closeCount = 0; }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.closeCount++; this.onclose?.(); }
    emit(event_name, payload = {}) {
      this.onmessage?.({ data: JSON.stringify({ event_name, payload, token: "fixture" }) });
    }
  }
  const result = { state: "pending" };
  exportHistory({ initMessage, WebSocketCtor: Socket, studyWindow }).then(
    (rows) => Object.assign(result, { state: "resolved", rows }),
    (error) => Object.assign(result, { state: "rejected", error })
  );
  return { socket, result };
}

async function expectFailure(result, pattern) {
  await Promise.resolve();
  assert.equal(result.state, "rejected");
  assert.match(result.error.message, pattern);
}

test("a connection that never opens times out and closes", async (t) => {
  const { socket, result } = setup(t);
  t.mock.timers.tick(30000);
  await expectFailure(result, /timed out/i);
  assert.equal(socket.closeCount, 1);
  socket.onopen?.();
  assert.equal(socket.sent.length, 0);
});

test("each response wait has its own timeout, not a total export deadline", async (t) => {
  const { socket, result } = setup(t);
  socket.onopen();
  for (const event of ["init", "chat_screen", "application_started", "app_foreground"]) {
    t.mock.timers.tick(20000);
    socket.emit(event);
  }
  await Promise.resolve();
  assert.equal(result.state, "pending");
  t.mock.timers.tick(29999);
  await Promise.resolve();
  assert.equal(result.state, "pending");
  t.mock.timers.tick(1);
  await expectFailure(result, /timed out/i);
  assert.equal(socket.closeCount, 1);
});

test("unrelated events do not postpone a stalled history request", async (t) => {
  const { socket, result } = setup(t);
  socket.onopen();
  socket.emit("app_foreground");
  t.mock.timers.tick(20000);
  socket.emit("ping");
  t.mock.timers.tick(10000);
  await expectFailure(result, /timed out/i);
});

test("unexpected close rejects instead of returning partial history", async (t) => {
  const { socket, result } = setup(t);
  socket.emit("history", { messages: [message("first")] });
  socket.onclose?.();
  await expectFailure(result, /closed|disconnected/i);
  const requests = socket.sent.length;
  socket.emit("history", { messages: [message("late")] });
  assert.equal(socket.sent.length, requests);
});

test("connection error releases the socket and ignores later events", async (t) => {
  const { socket, result } = setup(t);
  socket.onerror();
  await expectFailure(result, /connection failed/i);
  assert.equal(socket.closeCount, 1);
  socket.emit("history", { messages: [message("late")] });
  assert.equal(socket.sent.length, 0);
  t.mock.timers.tick(60000);
  assert.equal(socket.closeCount, 1);
});

test("an initial send failure rejects and cleans up", async (t) => {
  const { socket, result } = setup(t);
  socket.send = () => { throw new Error("send failed"); };
  assert.doesNotThrow(() => socket.onopen());
  await expectFailure(result, /send failed/i);
  assert.equal(socket.closeCount, 1);
});

for (const [label, pages, expectedIds, cursors] of [
  ["repeated page", [["a", "b"], ["a", "b"]], ["b", "a"], ["a"]],
  ["cursor cycle", [["a"], ["b"], ["a"]], ["a", "b"], ["a", "b"]],
  ["overlapping pages", [["a", "b"], ["c", "a"]], ["b", "a", "c"], ["a", "c"]],
  ["duplicate IDs within a page", [["a", "a"]], ["a"], ["a"]],
  ["cursor echo at page boundary", [["c", "d"], ["a", "b", "c"]],
    ["d", "c", "b", "a"], ["c", "a"]]
]) {
  test(`${label} resolves with unique rows and advances only on fresh IDs`, async (t) => {
    const { socket, result } = setup(t);
    for (const ids of pages) socket.emit("history", { messages: ids.map(message) });
    await Promise.resolve();
    if (label === "repeated page" || label === "cursor cycle") {
      assert.equal(result.state, "resolved");
    }
    socket.emit("history", { messages: [] });
    await Promise.resolve();
    assert.equal(result.state, "resolved");
    assert.deepEqual(result.rows.map((row) => row.ID), expectedIds);
    assert.deepEqual(socket.sent.map((request) => request.payload.last_message_id), cursors);
    assert.equal(socket.closeCount, 1);
  });
}

for (const [label, payload] of [
  ["missing messages", {}],
  ["null messages", { messages: null }],
  ["non-array messages", { messages: { length: 0 } }],
  ["missing message ID", { messages: [{ ...message("a"), id: undefined }] }],
  ["null timestamp", { messages: [{ ...message("a"), meta: { timestamp: null } }] }],
  ["false timestamp", { messages: [{ ...message("a"), meta: { timestamp: false } }] }],
  ["true timestamp", { messages: [{ ...message("a"), meta: { timestamp: true } }] }],
  ["object ID", { messages: [message({})] }]
]) {
  test(`${label} fails even after a valid batch`, async (t) => {
    const { socket, result } = setup(t);
    socket.emit("history", { messages: [message("first")] });
    socket.emit("history", payload);
    await expectFailure(result, /invalid|malformed/i);
    assert.equal(socket.closeCount, 1);
    assert.equal(socket.sent.length, 1);
  });
}

test("valid multiple batches finish once and ignore late history", async (t) => {
  const { socket, result } = setup(t);
  socket.emit("history", { messages: [message("c"), message("d")] });
  t.mock.timers.tick(20000);
  socket.emit("history", { messages: [message("a"), message("b")] });
  t.mock.timers.tick(20000);
  socket.emit("history", { messages: [] });
  await Promise.resolve();
  assert.equal(result.state, "resolved");
  assert.deepEqual(result.rows.map((row) => row.ID), ["d", "c", "b", "a"]);
  socket.emit("history", { messages: [message("late")] });
  t.mock.timers.tick(60000);
  assert.deepEqual(result.rows.map((row) => row.ID), ["d", "c", "b", "a"]);
  assert.equal(socket.closeCount, 1);
  assert.equal(socket.sent.length, 2);
});

test("numeric IDs and epoch timestamps preserve values and dedupe string echoes", async (t) => {
  const window = createStudyWindow({ startDate: "2026-09-01", endDate: "2026-09-01",
    timeZone: "America/Los_Angeles", submittedAt: new Date("2026-09-02T12:00:00Z") });
  const { socket, result } = setup(t, window);
  socket.emit("history", { messages: [{ ...message(7),
    meta: { timestamp: 1788264000000, nature: "Customer" } }],
    message_reactions: [{ message_id: 7, reaction: "Like" }] });
  assert.equal(socket.sent[0]?.payload.last_message_id, 7);
  socket.emit("history", { messages: [message("7")] });
  await Promise.resolve();
  assert.equal(result.state, "resolved");
  assert.deepEqual(result.rows, [{
    Timestamp_Local: "2026-09-01 05:00:00", Local_Timezone: "America/Los_Angeles",
    Timestamp_UTC: "2026-09-01T12:00:00.000Z", Timestamp_Eastern: "2026-09-01 08:00:00",
    From: "Me", Text: "Synthetic message", Reaction: "Like", ID: 7
  }]);
});

test("validates IDs on records outside the study window before filtering", async (t) => {
  const window = createStudyWindow({ startDate: "2026-09-02", endDate: "2026-09-02",
    timeZone: "UTC", submittedAt: new Date("2026-09-03T12:00:00Z") });
  const { socket, result } = setup(t, window);
  socket.emit("history", { messages: [message(undefined)] });
  await expectFailure(result, /invalid/i);
  assert.equal(socket.sent.length, 0);
});

for (const [label, data] of [["text keepalive", "ping"], ["binary frame", new Blob(["ping"])]]) {
  test(`${label} is ignored and a subsequent history response completes`, async (t) => {
    const { socket, result } = setup(t);
    socket.onmessage({ data });
    await Promise.resolve();
    assert.equal(result.state, "pending");
    socket.emit("history", { messages: [message("a")] });
    socket.emit("history", { messages: [] });
    await Promise.resolve();
    assert.equal(result.state, "resolved");
    assert.deepEqual(result.rows.map((row) => row.ID), ["a"]);
  });

  test(`${label} does not reset the response timeout`, async (t) => {
    const { socket, result } = setup(t);
    socket.onopen();
    t.mock.timers.tick(20000);
    socket.onmessage({ data });
    await Promise.resolve();
    assert.equal(result.state, "pending");
    t.mock.timers.tick(10000);
    await expectFailure(result, /timed out/i);
  });
}

test("success settles even if socket cleanup throws", async (t) => {
  const { socket, result } = setup(t);
  socket.close = () => { throw new Error("cleanup failed"); };
  socket.emit("history", { messages: [] });
  await Promise.resolve();
  assert.equal(result.state, "resolved");
  assert.deepEqual(result.rows, []);
});

test("failure settles even if socket cleanup throws", async (t) => {
  const { socket, result } = setup(t);
  socket.close = () => { throw new Error("cleanup failed"); };
  assert.throws(() => socket.onerror(), /cleanup failed/);
  await expectFailure(result, /connection failed/i);
});
