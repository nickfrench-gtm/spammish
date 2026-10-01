const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const json = async (response) => response.json().catch(() => ({}));

export async function googleTokenRequest(fields) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const result = await json(response);
  if (!response.ok) throw new Error(`google_oauth_${result.error || response.status}`);
  return result;
}

async function gmail(path, token, { method = "GET", body, query = {} } = {}) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item));
    else url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await json(response);
  if (!response.ok) throw new Error(`gmail_api_${response.status}`);
  return result;
}

export const profile = (token) => gmail("/profile", token);
export const history = (token, startHistoryId, pageToken) => gmail("/history", token, { query: { startHistoryId, historyTypes: "messageAdded", maxResults: 100, pageToken } });
export const messageMetadata = (token, id) => gmail(`/messages/${encodeURIComponent(id)}`, token, { query: { format: "metadata", metadataHeaders: ["From", "Subject"], fields: "id,labelIds,payload(headers)" } });
export const fullMessage = (token, id) => gmail(`/messages/${encodeURIComponent(id)}`, token, { query: { format: "full", fields: "id,labelIds,payload(headers,mimeType,body(data),parts(mimeType,body(data),parts(mimeType,body(data),parts(mimeType,body(data)))))" } });
export const labels = (token) => gmail("/labels", token);
export const createLabel = (token) => gmail("/labels", token, { method: "POST", body: { name: "The Abyss", labelListVisibility: "labelShow", messageListVisibility: "show" } });
export const moveToAbyss = (token, id, labelId) => gmail(`/messages/${encodeURIComponent(id)}/modify`, token, { method: "POST", body: { addLabelIds: [labelId], removeLabelIds: ["INBOX"] } });

export function extractMessage(message) {
  const headers = Object.fromEntries((message.payload?.headers || []).map(({ name, value }) => [String(name).toLowerCase(), value]));
  const decode = (data) => Buffer.from(String(data || "").slice(0, 16000).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const bodies = [];
  const htmlBodies = [];
  const visit = (part) => {
    if (part?.mimeType === "text/plain" && part.body?.data) bodies.push(decode(part.body.data));
    if (part?.mimeType === "text/html" && part.body?.data) htmlBodies.push(decode(part.body.data));
    for (const child of part?.parts || []) visit(child);
  };
  visit(message.payload);
  const htmlText = htmlBodies.join("\n").replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'");
  return { headers, subject: headers.subject || "", from: headers.from || "", body: (bodies.length ? bodies.join("\n") : htmlText).slice(0, 12000), unread: (message.labelIds || []).includes("UNREAD"), inInbox: (message.labelIds || []).includes("INBOX") };
}
