# Signal Desk integrated acceptance

Date: 2026-07-29

Environment: local static site in headless Chrome, with contract-compatible mocked CRM REST and realtime transports. No production CRM records were created.

## Coverage and results

| Scenario | Expected result | Result |
| --- | --- | --- |
| Intro, open, guided intake, review, confirm | One coherent transition into bootstrap | Pass |
| Successful bootstrap and live messaging | One CRM start, one structured brief, one realtime connection, one Context Signal | Pass |
| Duplicate realtime event and repeated history sync | One rendered copy per server message ID | Pass |
| Conversation-start failure and retry | Error on channel creation; retry restarts only the failed work | Pass |
| Structured-brief failure and retry | Existing conversation retained; retry skips conversation creation | Pass |
| Realtime plus polling failure and retry | Final milestone fails; retry reconnects without resending the brief | Pass |
| Server validation error | Return to review; no credentials or stale bootstrap signal | Pass |
| Refresh restoration | History restored and realtime authenticated without starting a new conversation | Pass |
| Invalid restoration credentials | Runtime credentials cleared and “Start a New Line” recovery shown | Pass |
| Browser offline then online | Offline state followed by one reconnect attempt; duplicate `connect` did not create a socket | Pass |
| BFCache suspend and resume | Viewport/composer resize handling restored after `pageshow` | Pass after fix |
| Keyboard containment and Escape | Tab wraps within panel; Escape closes and restores trigger focus | Pass |
| Decorative/accessibility semantics | One adaptive-header status region, one milestone region, decorative dots hidden | Pass |
| Reduced motion | Material/status/milestone animation disabled and transcript scrolling set to `auto` | Pass |
| Untrusted message markup | Rendered as text; no injected element or handler execution | Pass |

## Viewports

Passed at 1440×900, 1024×768, 768×900, 430×932, 390×844, and 360×800. At each size the panel and close control remained inside the viewport, the status label stayed intact, and the document had no horizontal overflow.

## State invariants observed

- Successful completion: `live`, `line-open`, connected header, four complete milestones.
- Start failure: `complete / error / pending / pending`.
- Brief-send failure: `complete / complete / error / pending`.
- Realtime failure: `complete / complete / complete / error`.
- All retries retained one brief and one Context Signal; completed upstream work was not repeated.
- The safe session snapshot did not contain the runtime visitor token. Runtime credentials remained in the dedicated session-scoped credential record only.
- All eight static pages contain byte-identical Signal Desk markup.

## Confirmed defect and fix

`pagehide` correctly removed viewport listeners, but a persisted `pageshow` did not restore them. This left composer auto-resize and virtual-keyboard recovery inactive after BFCache navigation. The persisted `pageshow` path now re-registers the same passive resize callbacks. Re-registering an identical listener is idempotent and does not create duplicate handlers.

## Not exercised

- The production CRM endpoint and production WebSocket were not called.
- Real mobile browser virtual keyboards, assistive-technology speech output, packet loss, background-tab timer throttling, and multi-tab contention require device/staging validation.
- Performance was checked structurally (single signal instance, idempotent listeners, transform/opacity animations, no duplicate socket); a production-device trace was not recorded.
