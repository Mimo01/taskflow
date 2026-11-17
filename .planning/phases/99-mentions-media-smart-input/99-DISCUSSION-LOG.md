# Phase 99: Mentions, Media & Smart Input - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 99-mentions-media-smart-input
**Areas discussed:** Mentions & issue keys, Images & file uploads, Rich & wiki paste, Slash/emoticons/bubble

---

## Mentions & issue keys

| Question | Options | Selected |
|----------|---------|----------|
| Mention chip look | Same as WikiRenderer / @Name text / Avatar + name pill | "you decide, whatever looks nicest" |
| Mention search scope | Assignable users (as today) / All Jira users / You decide | Assignable users (as today) |
| Unknown user | Pill with username / Pill with warning | Pill with username |
| Issue-key trigger | Project prefix / `#` / Both / Decoration only | "you decide" |

## Images & file uploads

| Question | Options | Selected |
|----------|---------|----------|
| Image size | As WikiRenderer / Always thumbnail | As WikiRenderer |
| Upload state | Placeholder removed on fail / Placeholder with Retry / No placeholder | Placeholder, removed on fail |
| Multi-file | Upload and embed all / First only | All, in order |
| Non-images | `[^file]` chip / Upload only | `[^file]` chip |
| Staged on create | Real local preview / Placeholder chip | Real local preview |
| Delete embed | Nothing / Offer to delete | Offer to delete |
| Paste name | image-YYYYMMDD-HHMMSS.png / You decide | image-YYYYMMDD-HHMMSS.png |

## Rich & wiki paste

| Question | Options | Selected |
|----------|---------|----------|
| Wiki-text paste | Parse / Always literal / Ask each time | Parse |
| HTML keep (multi) | Structure / Marks + links / Colour / Images | All four, plus "you decide" on details |
| Cmd+Shift+V | Yes / No | Yes |
| Jira paste | Map Jira HTML back / Generic | Map back |

## Slash, emoticons, bubble

| Question | Options | Selected |
|----------|---------|----------|
| `/` trigger | Line start or after space / Empty line only | Line start or after space |
| Slash items | Every block + inserts / Blocks only | Every block + inserts |
| `:` trigger | `:`+2 letters / `:` immediately / Picker only | "it should be simple and easy to use". Confirmed reading: `:` plus 1 letter at word start, no digits or URLs, short glyph list |
| Compact UI | Bubble + slim footer / Bubble only / Toolbar + bubble | "you decide" |

## Claude's Discretion

- The mention chip look, the issue-key trigger, the compact-host UI and the details of pasted HTML (colour matching, unfetchable images).

## Deferred Ideas

- None.
