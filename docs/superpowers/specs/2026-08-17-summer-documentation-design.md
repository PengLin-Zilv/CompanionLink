# Summer Documentation Design

## Problem Essence

The Replika exporter needs two short guides for the expected Chrome Web Store workflow: one that lets researchers support an export and one that lets participants complete it without understanding the implementation.

Success means:

- a researcher can prepare the extension, provide the required inputs, verify the downloaded file, and resolve common failures;
- a participant can install the published extension, export the requested date range, locate the file, and follow the study's separate submission instructions;
- both guides remain concise drafts until the Chrome Web Store listing is available.

## Assumptions Challenged

| Assumption | Decision |
| --- | --- |
| One guide can serve both audiences. | Reject. Their tasks and troubleshooting needs differ. |
| Participants need implementation details. | Reject. Include only information needed to complete the export safely. |
| The submission method belongs in the reusable participant guide. | Reject. Refer to the method provided by the research team so the guide remains valid across studies. |
| The participant guide should document unpacked installation because that is how the extension is currently tested. | Reject. Draft the intended Chrome Web Store installation flow and do not distribute the guide until the listing is available. |
| Automatic upload should be documented now. | Reject. The current workflow ends with a local download. |
| The README can act as the user guide. | Reject. Keep the README as the technical project reference. |

## Ground Truths

- The documented release supports Replika only.
- The participant guide assumes installation from a research-team-provided Chrome Web Store link.
- The participant must already be logged into Replika web.
- The researcher supplies the Participant ID, From date, To date, and submission method.
- Both selected dates are included and currently use Eastern Time.
- If the To date is today, the export ends when the participant clicks Export Chat Log.
- The extension downloads `P<Participant ID>.csv` locally and does not submit it automatically.
- Participants should use only the Chrome Web Store link supplied by the research team.

## Document Design

### Researcher Guide

`docs/researcher-guide.md` will contain:

1. an internal note that the guide is a draft for the Web Store release;
2. a short preparation checklist;
3. installation and pre-study verification;
4. the information to provide to each participant;
5. successful-export checks;
6. troubleshooting organized by visible symptom or exact error.

It will not contain source-code explanations, development commands, or speculative future workflows.

### Participant Guide

`docs/participant-guide.md` will contain:

1. a short before-you-start checklist;
2. installation from the research team's Chrome Web Store link;
3. linear export steps matching the current interface;
4. a generic instruction to use the submission method supplied by the research team;
5. only the troubleshooting cases a participant can safely resolve.

It will not mention WebSockets, APIs, schemas, test commands, unpacked installation, publication plans, or storage architecture.

## Reasoning Chain

Different users have different jobs -> separate the audiences -> include only decisions each audience must make -> preserve the current export behavior -> substitute the intended Web Store installation flow -> keep all other future changes outside the operational steps.

## Verification

- Every control name must match the current extension UI.
- Every export step must match the current build, and installation must match the expected Chrome Web Store workflow.
- The participant guide must not be distributed before the Chrome Web Store listing is available.
- The guides must not prescribe email, OneDrive, or another submission channel.
- The guides must not claim automatic submission or multi-app support.
- Troubleshooting must match errors the extension can currently display.
- Both documents must be readable without the README.
