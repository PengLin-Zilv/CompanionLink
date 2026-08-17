# Summer Documentation Design

## Problem Essence

The current Replika exporter needs two short guides that let researchers support an export and let participants complete one without understanding the implementation.

Success means:

- a researcher can prepare the extension, provide the required inputs, verify the downloaded file, and resolve common failures;
- a participant can install the current extension, export the requested date range, locate the file, and follow the study's separate submission instructions;
- both guides describe only behavior that exists in the Summer 2026 version.

## Assumptions Challenged

| Assumption | Decision |
| --- | --- |
| One guide can serve both audiences. | Reject. Their tasks and troubleshooting needs differ. |
| Participants need implementation details. | Reject. Include only information needed to complete the export safely. |
| The submission method belongs in the reusable participant guide. | Reject. Refer to the method provided by the research team so the guide remains valid across studies. |
| Future Web Store or automatic-upload behavior should be documented now. | Reject. Mark the current boundaries explicitly and update the guides when behavior changes. |
| The README can act as the user guide. | Reject. Keep the README as the technical project reference. |

## Ground Truths

- The Summer 2026 version supports Replika only.
- It is installed manually with Chrome's Load unpacked flow.
- The participant must already be logged into Replika web.
- The researcher supplies the Participant ID, From date, To date, and submission method.
- Both selected dates are included and currently use Eastern Time.
- If the To date is today, the export ends when the participant clicks Export Chat Log.
- The extension downloads `P<Participant ID>.csv` locally and does not submit it automatically.
- Participants should install only the extension package supplied by the research team.

## Document Design

### Researcher Guide

`docs/researcher-guide.md` will contain:

1. a prominent current-version boundary;
2. a short preparation checklist;
3. installation and pre-study verification;
4. the information to provide to each participant;
5. successful-export checks;
6. troubleshooting organized by visible symptom or exact error;
7. privacy, known limitations, and escalation guidance.

It will not contain source-code explanations, development commands, or speculative future workflows.

### Participant Guide

`docs/participant-guide.md` will contain:

1. the same current-version boundary in plain language;
2. a short before-you-start checklist;
3. linear unpacked-installation steps;
4. linear export steps matching the current interface;
5. a generic instruction to use the submission method supplied by the research team;
6. only the troubleshooting cases a participant can safely resolve.

It will not mention WebSockets, APIs, schemas, test commands, Web Store plans, or storage architecture.

## Reasoning Chain

Different users have different jobs -> separate the audiences -> include only decisions each audience must make -> describe only current behavior -> place future changes outside the operational steps.

## Verification

- Every control name must match the current extension UI.
- Every workflow step must be possible in the current Summer 2026 build.
- The guides must not prescribe email, OneDrive, or another submission channel.
- The guides must not claim automatic submission or multi-app support.
- Troubleshooting must match errors the extension can currently display.
- Both documents must be readable without the README.
