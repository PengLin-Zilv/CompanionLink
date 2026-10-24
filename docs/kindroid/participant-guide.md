# Participant Instructions: Kindroid

> This guide covers Kindroid; see the [Replika](../replika/participant-guide.md) and [Claude](../claude/participant-guide.md) instructions for those apps.

Use these steps to export the Kindroid chat log requested by the research team.

## Before You Start

Have these items ready:

- Google Chrome on a computer;
- your Kindroid login;
- the Chrome Web Store link from the research team;
- your assigned Participant ID;
- your assigned From date and To date;
- the study's file-submission instructions.

You will also need your **Kindroid API key**. In Kindroid, open **Profile →
Preferences → API & Integrations → Open**, then click to reveal the key. It starts
with `kn_`. Treat it like a password: do not send it to anyone, including the
research team.

## Install The Extension

1. Open the Chrome Web Store link provided by the research team.
2. Click **Add to Chrome**.
3. Click **Add extension** to confirm.
4. Open Chrome's Extensions menu and select **CompanionLink**.

If CompanionLink is already installed, Chrome updates it automatically. If there is
no API key box on your Kindroid chat, remove CompanionLink and install it again from
the link.

## Export Your Chat Log

1. In Chrome, go to [kindroid.ai](https://kindroid.ai), sign in, and open the
   one-to-one chat with the Kin the study is about (not a group chat).
2. Open **CompanionLink**.
3. Enter the Participant ID provided by the research team.
4. Select the provided **From date** and **To date**.
5. Paste your Kindroid API key.
6. Click **Export Chat Log**.
7. **Keep the extension window open until the file downloads.** Clicking anywhere
   outside it, including another window, closes it and stops the export. A long date
   range can take several minutes. "Waiting … s" means the export is pausing for
   Kindroid's limit, which is normal.
8. Wait until the extension displays `Downloaded P<Participant ID>.csv`, usually
   followed by `(chat with <your Kin's name>)`. If it names a different Kin, delete
   the downloaded file, open the right chat and export again.
9. Confirm that the file is in Chrome's Downloads folder.

Both selected dates are included and use your computer's time zone automatically. Check that your computer's time zone is correct before exporting. If the To date is today, the export includes messages through the time you click **Export Chat Log**.

Your API key is used only to download your chat history from Kindroid. It is never saved. It is cleared when an export finishes or fails, so paste it again if the key box is empty.

## Submit The File

Submit the downloaded chat log file using the method provided by the research team.

## Troubleshooting

### "Open Replika, a one-to-one Kindroid chat or a Claude chat in this tab..."

Open the one-to-one chat with your Kin (not a group chat), then click the extension again.

### "Paste your Kindroid API key. It starts with kn_."

Delete everything in the API key box, then copy the key again from Kindroid and paste it. Do not add spaces or other characters.

### "Kindroid did not accept this API key..."

Copy the current key from Kindroid again. If you regenerated it, only the new key works.

### "Kindroid is limiting requests..."

Wait a minute, paste your API key again (it is cleared when an export fails), then click **Export Chat Log**. This can happen if you close the extension during an export and start again right away. If you use your key in another app, pause it while exporting. If it keeps happening, try again tomorrow.

### The extension closed before the download

Nothing was saved. Open the extension again, enter the same Participant ID and dates, paste your key and export again. If it then shows "Kindroid is limiting requests...", wait a minute and try again.

### Another error

If the key box is empty, paste your key again, then try once more later. If the problem continues, send the exact error message to the research team.
