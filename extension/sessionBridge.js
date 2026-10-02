export async function getReplikaInitMessage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active Replika tab found.");
  }

  if (!isReplikaTabUrl(tab.url)) {
    throw new Error("Open Replika in the active tab before exporting.");
  }

  await ensureContentScript(tab.id);
  const response = await sendMessageToTab(tab.id, { type: "LINKLAB_REPLIKA_GET_INIT" });

  if (!response?.initMessage) {
    throw new Error("Replika session was not captured. Refresh the Replika tab, then try again.");
  }

  return response.initMessage;
}

export function isReplikaTabUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname === "my.replika.com";
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["contentScript.js"]
    });
  } catch {
    // The manifest content script may already be present on Replika pages.
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(response);
    });
  });
}
