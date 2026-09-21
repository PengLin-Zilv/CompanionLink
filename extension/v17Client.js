import { messagesToRows } from "./csvWriter.js";

const REPLIKA_WS_URL = "wss://ws.replika.ai/v17";
const HISTORY_LIMIT = 1000;
const RESPONSE_TIMEOUT_MS = 30000;

export function exportHistory({
  initMessage,
  WebSocketCtor = globalThis.WebSocket,
  chatId,
  studyWindow,
  onProgress = () => {}
}) {
  if (!initMessage) {
    return Promise.reject(new Error("Missing Replika init message."));
  }
  if (!WebSocketCtor) {
    return Promise.reject(new Error("WebSocket is not available in this browser."));
  }

  const init = JSON.parse(initMessage);
  const auth = init.auth;
  const resolvedChatId = chatId || deriveChatId(auth.user_id);
  const timeZone = studyWindow?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const seenMessageIds = new Set();
    const socket = new WebSocketCtor(REPLIKA_WS_URL);

    function finish(error, alreadyClosed = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(rows);
      if (!alreadyClosed) socket.close();
    }

    function resetTimeout() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        finish(new Error("Replika response timed out. Please try again."));
      }, RESPONSE_TIMEOUT_MS);
    }

    resetTimeout();

    socket.onopen = () => {
      if (settled) return;
      try {
        resetTimeout();
        socket.send(initMessage);
      } catch (error) {
        finish(error);
      }
    };

    socket.onmessage = (event) => {
      if (settled) return;
      let serverEvent;
      try {
        serverEvent = JSON.parse(event.data);
      } catch {
        return; // Keepalives and binary frames are not export responses.
      }
      try {
        const token = serverEvent.token;

        // Only export-related responses extend the wait, not background events.
        if (["init", "chat_screen", "application_started", "app_foreground", "history"]
          .includes(serverEvent.event_name)) {
          resetTimeout();
        }

        if (serverEvent.event_name === "error") {
          throw new Error(serverEvent.payload?.error_message || "Replika v17 returned an error.");
        }

        if (serverEvent.event_name === "init") {
          sendEvent(socket, "chat_screen", {}, token, auth);
          return;
        }

        if (serverEvent.event_name === "chat_screen") {
          sendEvent(socket, "application_started", {}, token, auth);
          return;
        }

        if (serverEvent.event_name === "application_started") {
          sendEvent(socket, "app_foreground", {}, token, auth);
          return;
        }

        if (serverEvent.event_name === "app_foreground") {
          sendHistoryRequest(socket, token, auth, resolvedChatId);
          return;
        }

        if (serverEvent.event_name === "history") {
          const messages = serverEvent.payload?.messages;
          if (!Array.isArray(messages)) {
            throw new Error("Replika returned invalid chat history. Please try again.");
          }

          const fresh = [];
          // Validate even filtered-out records: their IDs drive pagination.
          for (const message of messages) {
            const rawId = message?.id;
            const rawTimestamp = message?.meta?.timestamp;
            const id = isStringOrNumber(rawId) ? String(rawId).trim() : "";
            const timestampMs = isStringOrNumber(rawTimestamp)
              ? new Date(rawTimestamp).getTime()
              : Number.NaN;

            if (!id || !Number.isFinite(timestampMs)) {
              throw new Error("Replika returned an invalid chat message. Please try again.");
            }

            if (seenMessageIds.has(id)) continue;
            seenMessageIds.add(id);
            fresh.push(message);
          }

          if (fresh.length === 0) {
            finish();
            return;
          }

          const includedMessages = studyWindow
            ? fresh.filter((message) => studyWindow.includes(message.meta.timestamp))
            : fresh;
          rows.push(...messagesToRows({
            ...serverEvent,
            payload: {
              ...serverEvent.payload,
              messages: includedMessages
            }
          }, timeZone));
          onProgress(rows.length);

          if (studyWindow?.isOlderThanStart(fresh[0].meta.timestamp)) {
            finish();
            return;
          }

          sendHistoryRequest(socket, token, auth, resolvedChatId, fresh[0].id);
        }
      } catch (error) {
        finish(error);
      }
    };

    socket.onerror = () => {
      finish(new Error("Replika v17 WebSocket connection failed. Please try again."));
    };

    socket.onclose = () => {
      finish(new Error("Replika connection closed before export completed. Please try again."), true);
    };
  });
}

function isStringOrNumber(value) {
  return typeof value === "string" || typeof value === "number";
}

function sendEvent(socket, eventName, payload, token, auth) {
  socket.send(JSON.stringify({
    event_name: eventName,
    payload,
    token,
    auth
  }));
}

function sendHistoryRequest(socket, token, auth, chatId, lastMessageId) {
  const payload = {
    chat_id: chatId,
    limit: HISTORY_LIMIT
  };

  if (lastMessageId) {
    payload.last_message_id = lastMessageId;
  }

  sendEvent(socket, "history", payload, token, auth);
}

function deriveChatId(userId) {
  return (BigInt(`0x${userId}`) - 1n).toString(16);
}
