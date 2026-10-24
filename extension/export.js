import { exportClaudeConversation, parseClaudeChatUrl } from "./claudeClient.js";
import { buildCsv, normalizeParticipantFilename, recordsToRows } from "./csvWriter.js";
import { exportKindroidHistory, parseKindroidChatUrl } from "./kindroidClient.js";
import { getReplikaInitMessage, isReplikaTabUrl } from "./sessionBridge.js";
import { createStudyWindow } from "./studyWindow.js";
import { exportHistory } from "./v17Client.js";

const form = document.querySelector("#export-form");
const participantIdInput = document.querySelector("#participant-id");
const fromDateInput = document.querySelector("#from-date");
const toDateInput = document.querySelector("#to-date");
const apiKeyInput = document.querySelector("#api-key");
const exportButton = document.querySelector("#export-button");
const statusText = document.querySelector("#status");
const progressText = document.querySelector("#progress");
const kindroidKey = document.querySelector("#kindroid-key");

// The tab the popup was opened on decides the platform; activeTab exposes its URL.
const openedTab = readOpenedTab();
openedTab.then(showPlatform);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submittedAt = new Date();
  const opened = await openedTab;
  const isKindroid = opened.platform === "kindroid";
  const apiKey = isKindroid ? apiKeyInput.value.trim() : "";
  let filename;
  let studyWindow;
  try {
    filename = normalizeParticipantFilename(participantIdInput.value);
    studyWindow = createStudyWindow({
      startDate: fromDateInput.value,
      endDate: toDateInput.value,
      submittedAt
    });
    // Printable ASCII only: an invisible pasted character would make fetch reject
    // the header, which would read as a network error.
    if (isKindroid && !/^kn_[!-~]+$/.test(apiKey)) {
      throw new Error("Paste your Kindroid API key. It starts with kn_.");
    }
  } catch (error) {
    showError(error.message);
    if (isKindroid) revealStatus();
    return;
  }

  setWorking(true);
  progressText.textContent = "";

  try {
    // The chat open in the tab when the popup opened is the one exported.
    const { rows, chatName } = await (isKindroid
      ? exportKindroid(apiKey, opened.aiId, studyWindow)
      : opened.platform === "claude"
        ? exportClaude(opened, studyWindow)
        : exportReplika(studyWindow));

    downloadText(filename, buildCsv(rows));
    showStatus(`Downloaded ${filename}${chatName ? ` (chat with ${chatName})` : ""}`);
    progressText.textContent = `${rows.length} messages exported`;
  } catch (error) {
    showError(error.message);
  } finally {
    setWorking(false);
    if (isKindroid) {
      // The key is never stored; it leaves the field once an export attempt ends.
      apiKeyInput.value = "";
      revealStatus();
    }
  }
});

async function exportReplika(studyWindow) {
  showStatus("Finding Replika session...");
  const initMessage = await getReplikaInitMessage();
  showStatus("Exporting chat history...");
  return { rows: await exportHistory({ initMessage, studyWindow, onProgress: showProgress }) };
}

// Pacing can pause a long export for up to 31 s at a time, and clicking outside the
// popup closes it, so say both.
async function exportKindroid(apiKey, aiId, studyWindow) {
  showStatus("Exporting Kindroid chat history. Keep this window open until the file downloads; clicking outside it stops the export.");
  revealStatus();
  let count = 0;
  const { records, companionName } = await exportKindroidHistory({
    apiKey,
    aiId,
    studyWindow,
    onProgress: (n) => {
      count = n;
      showProgress(n);
      revealStatus();
    },
    onWait: (ms) => {
      progressText.textContent = `${count} messages so far. Waiting ${Math.ceil(ms / 1000)} s (Kindroid allows 10 requests every 30 seconds).`;
      revealStatus();
    }
  });
  return { rows: recordsToRows(records, studyWindow.timeZone), chatName: companionName };
}

// A few requests and no paging, so there is no progress to show.
async function exportClaude({ tabId, conversationId }, studyWindow) {
  showStatus("Exporting Claude chat history. Keep this window open until the file downloads.");
  const records = await exportClaudeConversation({ tabId, conversationId, studyWindow });
  return { rows: recordsToRows(records, studyWindow.timeZone) };
}

function showProgress(count) {
  progressText.textContent = `${count} messages`;
}

// The Kindroid popup can be taller than Chrome allows (600 px, less at page zoom), so
// keep the status and progress lines, the last in the popup, in view as they change.
function revealStatus() {
  progressText.scrollIntoView({ block: "nearest" });
}

// Never rejects: a failed lookup counts as an unsupported page.
async function readOpenedTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (isReplikaTabUrl(tab?.url)) return { platform: "replika" };
  const aiId = parseKindroidChatUrl(tab?.url);
  if (aiId) return { platform: "kindroid", aiId };
  const conversationId = parseClaudeChatUrl(tab?.url);
  if (conversationId) return { platform: "claude", tabId: tab.id, conversationId };
  return { platform: null };
}

function showPlatform({ platform }) {
  if (platform === "kindroid") {
    form.dataset.platform = "kindroid";
    kindroidKey.hidden = false;
  } else if (!platform) {
    setWorking(true);
    showError("Open Replika, a one-to-one Kindroid chat or a Claude chat in this tab, then click the extension again.");
  }
}

function setWorking(isWorking) {
  exportButton.disabled = isWorking;
  participantIdInput.disabled = isWorking;
  fromDateInput.disabled = isWorking;
  toDateInput.disabled = isWorking;
  apiKeyInput.disabled = isWorking;
}

function showStatus(message) {
  statusText.dataset.tone = "info";
  statusText.textContent = message;
}

function showError(message) {
  progressText.textContent = "";
  statusText.dataset.tone = "error";
  statusText.textContent = message;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
