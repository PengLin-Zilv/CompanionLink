# Companion Chat Log Export

Companion Chat Log Export is a LinkLab research tool for exporting participant-authorized chat history from supported AI companion web apps into a consistent CSV format.

The current release candidate supports Replika. It replaces a manual workflow involving browser developer tools, configuration files, Python, and file renaming with a participant-facing Chrome extension.

## Current Support

| Platform | Status | Exported data |
| --- | --- | --- |
| Replika Web | Release candidate | Text messages and reactions |

Images, voice messages, diary entries, memories, analytics, and profile data are not exported.

Additional AI companion platforms will be evaluated and implemented as platform-specific connectors.

## Participant Workflow

```text
Open Replika Web and sign in
-> Open Companion Chat Log Export
-> Enter the assigned Participant ID
-> Select the From date and To date
-> Click Export Chat Log
-> Download P<Participant ID>.csv
```

The extension does not require the participant to open developer tools, install Python, edit configuration files, or rename the downloaded file.

## Date Range

Both dates are required and included in the export. The current Replika connector interprets them as Eastern Time calendar dates.

- The From date begins at midnight.
- A past To date includes the complete day.
- If the To date is today, messages are included through the time the participant clicks **Export Chat Log**.
- Future To dates and reversed date ranges are rejected.

The selected dates are used only during the export and are not added to the CSV.

## Output Format

The Participant ID determines the filename:

```text
040  -> P040.csv
P040 -> P040.csv
p040 -> P040.csv
```

The CSV header is:

```csv
Timestamp,From,Text,Reaction,ID
```

The current Replika mapping preserves the lab's existing backup format:

- timestamps use Eastern Time and `YYYY-MM-DD HH:MM:SS`;
- Replika messages use `Rep` and participant messages use `Me`;
- missing reactions use `None`;
- message line breaks are preserved as literal `\n`;
- rows are ordered newest to oldest.

An export with no messages in the selected range produces a header-only CSV.

## Privacy Boundary

The extension uses the participant's active Replika web session locally in Chrome to request their chat history.

The extension does not:

- ask for or store a Replika password;
- persist Replika authentication or session values;
- write authentication tokens, device IDs, account IDs, chat IDs, email addresses, or profile data to the CSV;
- transmit the exported chat log to LinkLab or another server.

The only output is a CSV downloaded to the participant's computer.

## Release Status

Version `0.1.0` is a pre-release Replika build. Participant distribution is planned through an unlisted Chrome Web Store listing after release validation and policy review.

For local development and testing:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `extension` folder.
5. Refresh any open Replika tab before testing.

This unpacked installation flow is for development, not the planned participant workflow.

## Documentation

- [Researcher Guide](docs/researcher-guide.md)
- [Participant Instructions](docs/participant-guide.md)
- [Replika MVP Specification](docs/replika-exporter-mvp-spec.md)
- [Date Range Specification](docs/study-start-date-filter-spec.md)

The participant instructions reflect the planned Chrome Web Store distribution flow and should be updated if the release process changes.

## Development

The extension uses plain JavaScript, HTML, CSS, and Chrome Manifest V3. It has no runtime package dependencies.

Run the automated test suite:

```powershell
npm.cmd test
```

The tests cover:

- Participant ID filename normalization;
- CSV mapping and escaping;
- Eastern Time date boundaries;
- Replika v17 event sequencing and history pagination;
- study-window filtering;
- extension files, permissions, and participant-facing copy.

A complete release check also requires a manual export from an authenticated Replika web account.

## Project Structure

```text
extension/   Chrome extension source
tests/       Automated tests
docs/        Researcher, participant, and behavior documentation
```
