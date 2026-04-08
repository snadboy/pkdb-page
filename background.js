// PKDB Page Capture - Background Service Worker
// Converts current tab to PDF and uploads to Google Drive "Scans" folder

const SCANS_FOLDER_NAME = "Scans";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capturePage") {
    capturePage(message.tabId, message.filename)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function capturePage(tabId, filename) {
  // Step 1: Generate PDF via Chrome Debugger Protocol
  const pdfData = await generatePdf(tabId);

  // Step 2: Get OAuth token
  const token = await getAuthToken();

  // Step 3: Find or create the Scans folder
  const folderId = await findOrCreateFolder(token, SCANS_FOLDER_NAME);

  // Step 4: Upload PDF to Drive
  const file = await uploadToDrive(token, folderId, filename, pdfData);

  return { fileId: file.id, fileName: file.name };
}

async function generatePdf(tabId) {
  const debuggee = { tabId };

  await new Promise((resolve, reject) => {
    chrome.debugger.attach(debuggee, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(debuggee, "Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: true,
        marginTop: 0.4,
        marginBottom: 0.4,
        marginLeft: 0.4,
        marginRight: 0.4,
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    // result.data is base64-encoded PDF
    const binaryString = atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } finally {
    chrome.debugger.detach(debuggee, () => {});
  }
}

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function findOrCreateFolder(token, folderName) {
  // Search for existing folder
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchResp = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchResp.ok) {
    throw new Error(`Drive search failed: ${searchResp.status}`);
  }

  const searchData = await searchResp.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if it doesn't exist
  const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createResp.ok) {
    throw new Error(`Folder creation failed: ${createResp.status}`);
  }

  const folder = await createResp.json();
  return folder.id;
}

async function uploadToDrive(token, folderId, filename, pdfData) {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/pdf",
  };

  // Multipart upload
  const boundary = "pkdb_page_boundary";
  const metadataPart = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const postamble = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(preamble.length + pdfData.byteLength + postamble.length);
  body.set(preamble, 0);
  body.set(new Uint8Array(pdfData), preamble.length);
  body.set(postamble, preamble.length + pdfData.byteLength);

  const uploadResp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body.buffer,
    }
  );

  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Upload failed (${uploadResp.status}): ${errText}`);
  }

  return uploadResp.json();
}
