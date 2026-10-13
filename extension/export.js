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
const chatText = document.querySelector("#chat");
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
    return;
  }

  setWorking(true);
  progressText.textContent = "";

  try {
    // The chat named when the popup opened is the one exported.
    const { rows, chatName } = await (isKindroid
      ? exportKindroid(apiKey, opened.aiId, studyWindow)
      : exportReplika(studyWindow));

    downloadText(filename, buildCsv(rows));
    showStatus(`Downloaded ${filename}${chatName ? ` (chat with ${chatName})` : ""}`);
    progressText.textContent = `${rows.length} messages exported`;
  } catch (error) {
    showError(error.message);
  } finally {
    // The key is never stored; it leaves the field once an export attempt ends.
    if (isKindroid) apiKeyInput.value = "";
    setWorking(false);
  }
});

async function exportReplika(studyWindow) {
  showStatus("Finding Replika session...");
  const initMessage = await getReplikaInitMessage();
  showStatus("Exporting chat history...");
  return { rows: await exportHistory({ initMessage, studyWindow, onProgress: showProgress }) };
}

async function exportKindroid(apiKey, aiId, studyWindow) {
  showStatus("Exporting Kindroid chat history...");
  const { records, companionName } = await exportKindroidHistory({ apiKey, aiId, studyWindow, onProgress: showProgress });
  return { rows: recordsToRows(records, studyWindow.timeZone), chatName: companionName };
}

function showProgress(count) {
  progressText.textContent = `${count} messages`;
}

// Never rejects: a failed lookup counts as an unsupported page.
async function readOpenedTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (isReplikaTabUrl(tab?.url)) return { platform: "replika" };
  const aiId = parseKindroidChatUrl(tab?.url);
  if (aiId) return { platform: "kindroid", aiId, title: tab.title ?? "" };
  return { platform: null };
}

function showPlatform({ platform, title }) {
  if (platform === "kindroid") {
    chatText.textContent = title ? `Kindroid chat: ${title}` : "Kindroid chat detected.";
    chatText.hidden = false;
    kindroidKey.hidden = false;
  } else if (!platform) {
    setWorking(true);
    showError("Open Replika or a one-to-one Kindroid chat in this tab, then click the extension again.");
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
