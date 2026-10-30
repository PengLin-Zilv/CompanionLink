---
title: "CompanionLink: a Chrome extension for exporting AI companion chat logs"
tags:
  - javascript
authors:
  - name: Peng Lin
    affiliation: "1"
affiliations:
  - index: 1
    name: "TODO: affiliation, pending confirmation by the author, the advisor, and the institution"
date: 30 October 2026
bibliography: paper.bib
---

# Summary

TODO: Replace this section with a summary for a non-specialist reader. The finished paper must be 750 to 1750 words. This file is a skeleton, and the date above is the draft date, not a submission date.

CompanionLink is a Chrome extension. A person who is already signed in to a supported AI companion app can export their own text messages, for a date range they choose, to a CSV file on their computer. The source contains connectors for Replika, Kindroid, and Claude. The CSV is assembled in the browser. The extension does not upload that file.

# Statement of need

TODO: State the research problem, who the software is for, and how it relates to other work. Cite only sources checked by the authors. Do not submit this paragraph as written.

Researchers who study conversations with AI companions need the same columns from each participant, limited to the dates of a study. The apps' own exports, where an app provides one, are a different shape. TODO: describe those exports only after checking their current behavior, and cite that check.

# State of the field

TODO: Name the tools researchers use for this job, explain why extending those tools was not sufficient, and cite them in `paper.bib`. This draft asserts no comparison.

# Software design

TODO: Explain the trade-offs the authors weighed and why the chosen design matters for the research use. The notes below are facts from the source tree. They are a starting point for that explanation, not the explanation itself.

The extension is plain JavaScript with no runtime package dependencies. One CSV writer and one study-date window are shared by three connectors. Replika history is requested from Replika's v17 WebSocket using the session the page already created. Kindroid history is requested from Kindroid's HTTP API with a key the user pastes for that export; the field is cleared when the attempt ends. Claude history is requested from inside the open claude.ai tab, so the browser attaches the existing sign-in and the extension does not read it. If an export fails, no file is written.

# Research impact statement

TODO: Replace this section with evidence the authors can point to. JOSS asks for realized use (a publication, an external user, an integration) or a specific near-term signal (a benchmark, reproducible materials, a concrete request from another group). A statement about future use is not enough. This repository does not record that evidence, so this draft states none.

# AI usage disclosure

TODO: Say whether generative AI was used on the software, the documentation, or this paper. If it was, name the tools and versions, where they were used, and how a person checked the result. If it was not, say that. This skeleton does not record that history.

# Acknowledgements

TODO: Name financial support, or state that there was none, and say whether a sponsor took part in the work. TODO: confirm who else should be acknowledged. Add a person's name only with that person's agreement.

# References

References will be generated from `paper.bib`. TODO: add entries there before citing them.
