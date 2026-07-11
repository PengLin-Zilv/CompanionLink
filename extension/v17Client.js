import { messagesToRows } from "./csvWriter.js";

const REPLIKA_WS_URL = "wss://ws.replika.ai/v17";
const HISTORY_LIMIT = 1000;

export function exportHistory({
  initMessage,
  WebSocketCtor = globalThis.WebSocket,
  chatId,
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
  const rows = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocketCtor(REPLIKA_WS_URL);

    socket.onopen = () => {
      socket.send(initMessage);
    };

    socket.onmessage = (event) => {
      try {
        const serverEvent = JSON.parse(event.data);
        const token = serverEvent.token;

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
          const messages = serverEvent.payload?.messages ?? [];

          if (messages.length === 0) {
            settled = true;
            socket.close();
            resolve(rows);
            return;
          }

          rows.push(...messagesToRows(serverEvent));
          onProgress(rows.length);
          sendHistoryRequest(socket, token, auth, resolvedChatId, messages[0].id);
        }
      } catch (error) {
        if (!settled) {
          settled = true;
          socket.close();
          reject(error);
        }
      }
    };

    socket.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Replika v17 WebSocket connection failed."));
      }
    };
  });
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
