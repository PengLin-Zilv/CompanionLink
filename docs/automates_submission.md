## Feature: send participant's csv file directly to the our email by clicking it instead of “export csv file”

Fundamental Requirements for Final Deliervable:
1. One participant action: click `submit data`
2. Verified delivery: shows sucess after our lab system confirms the receipt
3. Correct attribution: associate the CSV with PID and study dates
4. Security transfer: HTTP and approved research-data storage
5. No embedded credentials: email or server secrets cannot safely live inside a Chrome extension
6. Failure recovery: if submission fails, allow retry or backup (default download)
7. Clear ownership: maintain the receiving service throughout the study

Approaches comparison:
1. Gmail/Outlook API in extension:
    - Easiest? for shorter study, or a prototype, but not for long-term use
    - Reliability: Medium
    - Participant experience: signs in and grant email permissions, not one click
2. Extension → prototype server → email attachment
    or Extension → approved storage → email notification
    or Extension → custom LinkLab server → storage + notification
    - Reliability: Medium to High, fits long-term needs
    - Participant experience: one click, no email sign-in


Does LinkLab or Syracuse already have an approved service that can receive and store participant files, and who would own that service during and after the study?