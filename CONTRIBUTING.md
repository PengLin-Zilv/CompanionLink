# Contributing to CompanionLink

CompanionLink is a Chrome extension that exports a person's own Replika, Kindroid, or Claude chat history to a CSV on their computer. Thank you for taking an interest in it.

This repository does not have an open-source license yet. The copyright holder and the license need confirmation from the author, the advisor, and the institution. Until a `LICENSE` file is added, please open an issue to discuss a change rather than sending a pull request that would need a license to merge. The instructions below describe how the project is set up so that discussion can be concrete.

## Report a bug or ask for help

Open a [GitHub issue](https://github.com/PengLin-Zilv/CompanionLink/issues). Use the bug or feature template when it fits.

Include the CompanionLink version from `chrome://extensions`, the Chrome version, and which app you were exporting (Replika, Kindroid, or Claude). Describe what you expected and what happened.

Do not include any of the following in an issue, pull request, or commit:

- chat logs, screenshots of messages, or a CSV from a real export
- a participant identifier tied to a real person
- a Kindroid API key, a Replika session or auth token, a Claude cookie, or any other credential
- a `.env` file, a Chrome `.pem` signing key, or a `.crx` package
- a local filesystem path from your computer

If the report would be incomplete without private data, describe the shape of the data (for example, "a message with an embedded newline") and use a synthetic example. Security reports go through [SECURITY.md](SECURITY.md), not a public issue.

## Seek support

For a study using the published extension, start with the researcher guide for that app under `docs/`. For a problem in the source, open a GitHub issue. There is no separate support desk.

## Set up the source

The extension has no compile step and no package dependencies. Node.js 22.6 or newer is required only for the tests.

1. Clone the repository.
2. From the repository root, run `npm test`.
3. To load the extension, open `chrome://extensions`, turn on Developer mode, choose Load unpacked, and select the `extension` folder.
4. Refresh any open `my.replika.com` tab before trying a Replika export.

`extension/manifest.json` and `package.json` must stay on the same version. A test checks that.

## Tests

`npm test` runs `node --test`. The suite covers CSV writing, study-date boundaries, each connector, and the manifest permissions. It uses synthetic fixtures. It does not call Replika, Kindroid, or Claude.

A change to export behavior should add or adjust a test. Run `npm test` before asking for review.

## Pull requests, once a license exists

When a `LICENSE` file is present:

- Open an issue first for a large change.
- Keep the patch limited to the problem it solves.
- Run `npm test`.
- Say how you checked the change.
- Confirm the patch contains none of the private material listed above.
- If you change `extension/manifest.json` permissions, explain why the new permission is the smallest one that works.

## Conduct

Everyone who participates is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
