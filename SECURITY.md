# Security

CompanionLink runs in the participant's browser. It reads chat history from Replika, Kindroid, or Claude using a sign-in or API key that person already has, and it writes a CSV on their computer. It does not upload that CSV.

## Reporting a vulnerability

Please report a vulnerability in private. Do not open a public GitHub issue for it.

Once this repository is public, use GitHub private vulnerability reporting: Security, then "Report a vulnerability". The maintainer still needs to enable that feature. TODO: confirm the address that should receive reports, and replace this paragraph with it. Until then, contact the maintainer, Peng Lin, directly, and do not post the report on the issue tracker.

Include what you think the impact is, how to reproduce it, and which version you tested (`extension/manifest.json`).

Do not include participant chat logs, real participant identifiers, API keys, session tokens, cookies, or Chrome signing keys (`.pem`). A synthetic fixture is enough.

There is no bug bounty.

## What to expect

The maintainer will acknowledge a report when they see it and will follow up with a fix or an explanation. This project does not promise a response time. TODO: set one after the maintainers agree who is on call.

## Scope

In scope: the extension under `extension/`, including how it handles the Replika session, the Kindroid API key, and requests run in a Claude tab.

Out of scope: vulnerabilities in Replika, Kindroid, Claude, or Chrome themselves. Report those to the vendor. Also out of scope: a study's own file-submission procedure, which is outside this repository.

## Secrets that must not be committed

`.gitignore` ignores `.env`, `.env.local`, `*.pem`, and `*.crx`. Those files, and any real export CSV, stay off the repository. A Chrome `.pem` is the private key for a packed extension.
