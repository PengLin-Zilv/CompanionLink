(function installPageBridge() {
  if (window.__linklabReplikaPageBridgeInstalled) {
    return;
  }
  window.__linklabReplikaPageBridgeInstalled = true;

  scanLocalStorageForInit();

  const originalSend = window.WebSocket?.prototype?.send;
  if (typeof originalSend !== "function") {
    return;
  }

  window.WebSocket.prototype.send = function patchedSend(data) {
    if (typeof data === "string" && isV17InitMessage(data)) {
      publishInit(data);
    }

    return originalSend.apply(this, arguments);
  };

  function scanLocalStorageForInit() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        const value = key ? localStorage.getItem(key) : null;

        if (typeof value === "string" && isV17InitMessage(value)) {
          publishInit(value);
          return;
        }
      }
    } catch {
      // Some browser privacy settings can block storage reads; WebSocket capture still works.
    }
  }

  function isV17InitMessage(value) {
    try {
      const parsed = JSON.parse(value);
      return parsed?.event_name === "init" &&
        typeof parsed?.auth?.user_id === "string" &&
        typeof parsed?.auth?.auth_token === "string" &&
        typeof parsed?.auth?.device_id === "string";
    } catch {
      return false;
    }
  }

  function publishInit(initMessage) {
    window.postMessage({
      source: "LINKLAB_REPLIKA_PAGE_BRIDGE",
      type: "REPLIKA_V17_INIT",
      initMessage
    }, "*");
  }
})();
