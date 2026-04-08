// Populate page info and suggested filename
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  document.getElementById("pageTitle").textContent = tab.title || "Untitled";
  document.getElementById("pageUrl").textContent = tab.url;

  // Generate filename from page title: lowercase, hyphens, no special chars
  const today = new Date().toISOString().slice(0, 10);
  const slug = (tab.title || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  document.getElementById("filename").value = `${today}_${slug}`;
});

document.getElementById("captureBtn").addEventListener("click", async () => {
  const btn = document.getElementById("captureBtn");
  const status = document.getElementById("status");
  const filenameInput = document.getElementById("filename");

  const filename = (filenameInput.value.trim() || "page") + ".pdf";

  btn.disabled = true;
  btn.textContent = "Working...";
  setStatus("working", "Generating PDF...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.runtime.sendMessage({
      action: "capturePage",
      tabId: tab.id,
      filename,
    });

    if (response.success) {
      setStatus("success", `Uploaded "${response.fileName}" to Scans folder`);
      btn.textContent = "Done!";
    } else {
      throw new Error(response.error);
    }
  } catch (err) {
    setStatus("error", `Error: ${err.message}`);
    btn.textContent = "Capture & Upload to Scans";
    btn.disabled = false;
  }
});

function setStatus(type, message) {
  const status = document.getElementById("status");
  status.className = `status ${type}`;
  status.textContent = message;
}
