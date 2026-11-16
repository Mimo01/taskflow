# Phase 96: Wiki Foundations & Equivalence Harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-16
**Phase:** 96-wiki-foundations-equivalence-harness
**Areas discussed:** Library spike gate, Harness before a parser, Equivalence strictness, Corpus source & Jira truth

---

## Library spike gate

| Option | Description | Selected |
|--------|-------------|----------|
| In Phase 96 | Run once corpus exists; decide before Phase 97 parser | ✓ |
| Lock TipTap, no spike | Accept research default | |
| Defer to Phase 98 | Engine-neutral AST in 97 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rich-feel first | TipTap unless WKWebView caret/IME blocker | ✓ |
| Safety first | CodeMirror unless its look gap is clearly worse | |
| Show me both | Both prototypes, user picks in the Tauri app | |

## Harness before a parser

| Option | Description | Selected |
|--------|-------------|----------|
| Pluggable + identity | Identity round-trip + mutation self-test that must fail | ✓ |
| Identity only | No self-test | |
| Minimal real round-trip | Pull a marks-only parser into 96 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ship isEquivalent in lib/wiki | Shared by CI and runtime guard | ✓ |
| CI test only | Extract later | |

## Equivalence strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal normaliser, justified rules | Attr order + whitespace outside pre; add rules with fixtures | ✓ |
| Exact HTML, zero normalisation | Byte-equal pipeline HTML | |
| Broad normaliser up front | Many rules from the start | |

| Option | Description | Selected |
|--------|-------------|----------|
| Core pipeline only | Excludes issue-key linkify, React components | ✓ |
| Full React render | jsdom WikiRenderer DOM | |
| Both | Core bulk + full-render subset | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture name + HTML diff | Unified diff + emitted wiki | ✓ |
| Just pass/fail | Minimal output | |

## Corpus source & Jira truth

| Option | Description | Selected |
|--------|-------------|----------|
| Both: harvest + grammar sweep | Seed from WikiRenderer tests, fill per construct | ✓ |
| Hand-authored only | Fresh fixtures | |
| Harvest only | Existing test inputs only | |

| Option | Description | Selected |
|--------|-------------|----------|
| One-off probe, findings only | Read-only render endpoint, placeholder fixtures, no stored HTML | ✓ |
| Store Jira HTML per fixture | Golden files | |
| No live Jira | WikiRenderer only | |

| Option | Description | Selected |
|--------|-------------|----------|
| One .wiki file each | Folders by construct, ?raw glob, .gitattributes -text | ✓ |
| Single TS table | Array of {name, wiki} | |

## Claude's Discretion

- lib/wiki module split and re-export strategy; WikiRenderer.tsx location; fixture/harness placement; plan sequencing; spike hosting. Spike prototypes are throwaway with no deps on main (stated by Claude, not objected to).

## Deferred Ideas

- Golden Jira HTML per fixture; moving WikiRenderer.tsx to components/.
