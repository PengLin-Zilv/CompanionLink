// The chat open in a gemini.google.com tab.

// Only a chat page: https://gemini.google.com/app/<16 hex>, or /gem/<gem>/<id> for a chat
// with a Gem, either one after /u/<N> for another signed-in Google account. Home, Gem
// and share pages have no chat to export. The gem segment never reaches a request, and
// a strict id keeps a malformed path out of every request.
export function parseGeminiChatUrl(url) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (protocol !== "https:" || hostname !== "gemini.google.com") return null;
    const match = /^(\/u\/\d+)?\/(?:app|gem\/[^/]+)\/([0-9a-f]{16})\/?$/i.exec(pathname);
    return match ? { chatId: match[2].toLowerCase(), accountPath: (match[1] ?? "").toLowerCase() } : null;
  } catch {
    return null;
  }
}
