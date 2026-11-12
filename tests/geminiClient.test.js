import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiChatUrl } from "../extension/geminiClient.js";

const ID = "0123456789abcdef";

test("only a gemini.google.com chat page is accepted, with its id and account path lowercased", () => {
  for (const [url, expected] of [
    [`https://gemini.google.com/app/${ID}`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/app/${ID}/`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/app/${ID}?hl=en#x`, { chatId: ID, accountPath: "" }],
    [`https://GEMINI.GOOGLE.COM/U/1/APP/${ID.toUpperCase()}`, { chatId: ID, accountPath: "/u/1" }],
    [`https://gemini.google.com/gem/synthetic-gem/${ID}`, { chatId: ID, accountPath: "" }],
    [`https://gemini.google.com/u/2/gem/synthetic-gem/${ID}/`, { chatId: ID, accountPath: "/u/2" }]
  ]) {
    assert.deepEqual(parseGeminiChatUrl(url), expected, url);
  }
});

test("other gemini.google.com pages, lookalike hosts and other sites are rejected", () => {
  for (const url of [
    "https://gemini.google.com/",
    "https://gemini.google.com/app",
    "https://gemini.google.com/app/",
    `https://gemini.google.com/app/${ID.slice(1)}`,
    `https://gemini.google.com/app/${ID}0`,
    "https://gemini.google.com/app/0123456789abcdeg",
    `https://gemini.google.com/app/${ID}/x`,
    "https://gemini.google.com/gem/synthetic-gem",
    "https://gemini.google.com/gems/view",
    "https://gemini.google.com/u/1",
    `https://gemini.google.com/u/x/app/${ID}`,
    `https://gemini.google.com/share/${ID}`,
    `https://gemini.google.com/chat/${ID}`,
    `http://gemini.google.com/app/${ID}`,
    `https://www.gemini.google.com/app/${ID}`,
    `https://bard.google.com/app/${ID}`,
    `https://business.gemini.google/app/${ID}`,
    `https://gemini.google.com.example.com/app/${ID}`,
    `https://gemini.google.com@example.com/app/${ID}`,
    `https://example.com/gemini.google.com/app/${ID}`,
    "https://chatgpt.com/c/2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091",
    "https://claude.ai/chat/3f2a9c1e-7b4d-4e8f-9a6b-1c2d3e4f5a6b",
    "https://kindroid.ai/v2/chat/exampleCompanion",
    "https://my.replika.com/chat",
    "not a URL",
    undefined
  ]) {
    assert.equal(parseGeminiChatUrl(url), null, String(url));
  }
});
