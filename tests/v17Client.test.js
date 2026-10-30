import test from "node:test";
import assert from "node:assert/strict";

import { createStudyWindow } from "../extension/studyWindow.js";
import { exportHistory } from "../extension/v17Client.js";

class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closeCount = 0;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.closeCount += 1;
    this.onclose?.();
  }

  emit(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

test("follows the Replika v17 event order and paginates by last_message_id", async () => {
  FakeWebSocket.instances = [];

  const initMessage = JSON.stringify({
    event_name: "init",
    payload: {},
    token: "client-token",
    auth: {
      user_id: "10",
      auth_token: "auth-token",
      device_id: "device-id"
    }
  });

  const exportPromise = exportHistory({
    initMessage,
    WebSocketCtor: FakeWebSocket
  });

  await Promise.resolve();
  const socket = FakeWebSocket.instances[0];
  assert.equal(socket.url, "wss://ws.replika.ai/v17");
  assert.deepEqual(socket.sent[0], JSON.parse(initMessage));

  socket.emit({ event_name: "init", token: "server-1", payload: {} });
  assert.equal(socket.sent[1].event_name, "chat_screen");
  assert.deepEqual(socket.sent[1].auth, JSON.parse(initMessage).auth);

  socket.emit({ event_name: "chat_screen", token: "server-2", payload: {} });
  assert.equal(socket.sent[2].event_name, "application_started");

  socket.emit({ event_name: "application_started", token: "server-3", payload: {} });
  assert.equal(socket.sent[3].event_name, "app_foreground");

  socket.emit({ event_name: "app_foreground", token: "server-4", payload: {} });
  assert.deepEqual(socket.sent[4].payload, {
    chat_id: "f",
    limit: 1000
  });

  socket.emit({
    event_name: "history",
    token: "server-5",
    payload: {
      message_reactions: [],
      messages: [
        {
          id: "oldest-in-batch",
          meta: {
            timestamp: "2026-07-08T20:36:32.000Z",
            nature: "Customer"
          },
          content: { text: "old" }
        },
        {
          id: "newest-in-batch",
          meta: {
            timestamp: "2026-07-08T20:36:40.000Z",
            nature: "Robot"
          },
          content: { text: "new" }
        }
      ]
    }
  });

  assert.deepEqual(socket.sent[5].payload, {
    chat_id: "f",
    limit: 1000,
    last_message_id: "oldest-in-batch"
  });

  socket.emit({
    event_name: "history",
    token: "server-6",
    payload: {
      message_reactions: [],
      messages: []
    }
  });

  const rows = await exportPromise;
  assert.equal(socket.closeCount, 1);
  assert.deepEqual(rows.map((row) => row.ID), ["newest-in-batch", "oldest-in-batch"]);
});

test("filters to the study window and stops after crossing the start boundary", async () => {
  FakeWebSocket.instances = [];

  const initMessage = JSON.stringify({
    event_name: "init",
    payload: {},
    token: "client-token",
    auth: {
      user_id: "10",
      auth_token: "auth-token",
      device_id: "device-id"
    }
  });
  const studyWindow = createStudyWindow({
    timeZone: "America/New_York",
    startDate: "2026-07-08",
    endDate: "2026-07-08",
    submittedAt: new Date("2026-07-08T20:36:41.000Z")
  });
  const exportPromise = exportHistory({
    initMessage,
    WebSocketCtor: FakeWebSocket,
    studyWindow
  });

  await Promise.resolve();
  const socket = FakeWebSocket.instances[0];
  socket.emit({ event_name: "init", token: "server-1", payload: {} });
  socket.emit({ event_name: "chat_screen", token: "server-2", payload: {} });
  socket.emit({ event_name: "application_started", token: "server-3", payload: {} });
  socket.emit({ event_name: "app_foreground", token: "server-4", payload: {} });
  socket.emit({
    event_name: "history",
    token: "server-5",
    payload: {
      message_reactions: [],
      messages: [
        {
          id: "before-study",
          meta: {
            timestamp: "2026-07-08T03:59:59.999Z",
            nature: "Customer"
          },
          content: { text: "before" }
        },
        {
          id: "inside-window",
          meta: {
            timestamp: "2026-07-08T20:36:40.000Z",
            nature: "Robot"
          },
          content: { text: "inside" }
        },
        {
          id: "at-submit-time",
          meta: {
            timestamp: "2026-07-08T20:36:41.000Z",
            nature: "Robot"
          },
          content: { text: "too late" }
        }
      ]
    }
  });

  const historyRequests = socket.sent.filter((event) => event.event_name === "history");
  if (socket.closeCount === 0) {
    socket.emit({
      event_name: "history",
      token: "server-6",
      payload: {
        message_reactions: [],
        messages: []
      }
    });
  }
  const rows = await exportPromise;

  assert.deepEqual(rows.map((row) => row.ID), ["inside-window"]);
  assert.equal(historyRequests.length, 1);
  assert.equal(socket.closeCount, 1);
});
