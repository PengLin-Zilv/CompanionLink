(function installContentScript() {
  if (globalThis.__linklabReplikaContentInstalled) {
    return;
  }
  globalThis.__linklabReplikaContentInstalled = true;

  let latestInitMessage = null;

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (data?.source !== "LINKLAB_REPLIKA_PAGE_BRIDGE") {
      return;
    }

    if (data.type === "REPLIKA_V17_INIT" && typeof data.initMessage === "string") {
      latestInitMessage = data.initMessage;
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "LINKLAB_REPLIKA_GET_INIT") {
      sendResponse({ initMessage: latestInitMessage });
    }
  });

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("pageBridge.js");
  script.onload = () => script.remove();
  (document.documentElement || document.head).append(script);
})();
