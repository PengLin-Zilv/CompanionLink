import { buildCsv, normalizeParticipantFilename } from "./csvWriter.js";
import { getReplikaInitMessage } from "./sessionBridge.js";
import { createStudyWindow } from "./studyWindow.js";
import { exportHistory } from "./v17Client.js";

const form = document.querySelector("#export-form");
const participantIdInput = document.querySelector("#participant-id");
const fromDateInput = document.querySelector("#from-date");
const toDateInput = document.querySelector("#to-date");
const exportButton = document.querySelector("#export-button");
const statusText = document.querySelector("#status");
const progressText = document.querySelector("#progress");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submittedAt = new Date();
  let filename;
  let studyWindow;
  try {
    filename = normalizeParticipantFilename(participantIdInput.value);
    studyWindow = createStudyWindow({
      startDate: fromDateInput.value,
      endDate: toDateInput.value,
      submittedAt
    });
  } catch (error) {
    showError(error.message);
    return;
  }

  setWorking(true);
  showStatus("Finding Replika session...");
  progressText.textContent = "";

  try {
    const initMessage = await getReplikaInitMessage();
    showStatus("Exporting chat history...");

    const rows = await exportHistory({
      initMessage,
      studyWindow,
      onProgress: (count) => {
        progressText.textContent = `${count} messages`;
      }
    });

    downloadText(filename, buildCsv(rows));
    showStatus(`Downloaded ${filename}`);
    progressText.textContent = `${rows.length} messages exported`;
  } catch (error) {
    showError(error.message);
  } finally {
    setWorking(false);
  }
});

function setWorking(isWorking) {
  exportButton.disabled = isWorking;
  participantIdInput.disabled = isWorking;
  fromDateInput.disabled = isWorking;
  toDateInput.disabled = isWorking;
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
