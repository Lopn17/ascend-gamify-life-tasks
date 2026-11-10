# ASCEND

A personal expedition from 0 to 8,849 meters. Completing a meaningful task earns 1–15 meters and the same amount of XP.

## Run

Open `index.html` in a current Chrome, Edge, Firefox, or Safari browser. No build, installation, framework, CDN, or network access is required. You can also serve this folder with any static web server.

Progress belongs to the browser and origin that saved it. A file URL and a local server have separate storage. Use **Basecamp & settings → Export JSON / Import JSON** to transfer your expedition.

## What's included

- Overview with local SVG scenery, a quick activity flow, next checkpoint, XP progress, streak, planned tasks, and recent activity.
- A scrollable world containing all 50 original checkpoints, five regions, a current-position shortcut, and checkpoint details. Spacing is illustrative so nearby landmarks stay readable.
- Planned and completed tasks, notes, category and status filters, search, pending-task editing, and deletion that preserves historical rewards.
- Habit tracking inside Tasks with repeatable good-habit check-ins, daily bad-habit avoidance, daily/specific-day/times-per-week schedules, habit streaks, automatic clean-day rewards, and date-based corrections.
- Optional task deadlines and daily reminder times for tasks/habits. The top-bar Reminders button lists due or overdue tasks and scheduled habits awaiting attention. Overdue tasks can still be completed for the normal reward.
- **Undo** on completed tasks moves them back to To do and removes that completion's meters and XP, including accidentally logged activities. Completing the restored task earns its reward once again on the new completion date.
- Distance, task, checkpoint, and 3/7/14/30/60/100-day consistency achievements, with recorded unlock dates for new awards.
- Daily, weekly, and monthly distance charts; category distribution; and a 12-week activity calendar.
- Light/dark appearance, editable profile, JSON backup preview and confirmation, reset confirmation, and corrupt-storage recovery export.
- Category management in Basecamp & settings: add, rename, choose an icon, or delete an unused category. Initial names and icons come from `data.js`; your customization is saved locally and included in backups. Renames update existing tasks and activity labels without changing rewards.
- Keyboard-accessible native dialogs, focus restoration, mobile navigation, reduced-motion support, and escaped user-provided text.

## Data rules

Reminder times use the device's local clock. Task deadlines are calendar dates: the task becomes overdue the following day. Due/overdue tasks notify at 09:00 unless a reminder time is set; a task with a reminder time also receives daily nudges before its deadline or without a deadline. Good-habit reminders follow the selected schedule and stop for the day after a check-in, or once the weekly target is met. Bad-habit reminders encourage avoidance and stop for that day after a recorded failure.

Reminders are checked on opening, returning to the tab, and approximately every 30 seconds while the page runs. Closing the page stops notifications, and background-tab suspension can delay them. Browser notifications require explicit permission through Reminders; the in-app list remains available without permission or browser support. Delivery is grouped and limited to once per item per local day, with Web Locks preventing duplicates across supported tabs. Deadline/time settings are included in expedition backups. Notification permission, the notification toggle, and delivery receipts belong to the current browser and are not transferred with a backup.

`ascend-v1` remains the storage key so the original app's data can be read. Version 2 validates tasks, habits, habit events, and reward transactions before using or importing them. Distance, XP, levels, streaks, and statistics are derived from activity history. Legacy rewards are kept exactly as recorded, even when they do not match the newer difficulty range. New or edited tasks and habits must follow the range.

Good-habit check-ins each earn their configured reward. Daily and specific-day schedules measure streaks by required day; flexible weekly schedules measure streaks by completed week. Optional check-ins still earn altitude but do not replace a missed scheduled check-in. Bad habits are tracked daily: the user records only failures, and completed clean days are awarded when the app next opens. Historical corrections remove or restore the linked reward and recalculate streaks.

Completion is guarded by both task status and transaction identity. Supported browsers use Web Locks to serialize updates across tabs; the storage event refreshes other tabs. On browsers without Web Locks, each write re-reads storage, but simultaneous writes across tabs cannot be guaranteed atomic. A failed storage write does not award progress in memory. Corrupt saved content is not automatically overwritten.

Streaks use local calendar dates. A current streak survives through the day after the latest activity and becomes zero after a missed day. Historical activity dates are preserved during migration; dates originally recorded by the old UTC-based implementation cannot reliably be reconstructed in local time.

Undo explicitly removes the selected completion from activity history, so distance, XP, level, charts, active days, and streaks are recalculated. Task details stay intact. Previously unlocked checkpoints and achievements remain collected. Repeated or stale undo requests cannot subtract the reward twice or undo a later completion in another tab. Deleting a task still preserves rewards; use Undo to correct an accidental completion.

Checkpoint values retain the original brief. They mix approximate object heights, building/tower reference heights, mountain elevations, and illustrative stages. They are progression benchmarks, not a geographically uniform altitude survey. Building-height definitions and mountain surveys may differ; no new external fact verification was performed in this enhancement.

## Structure

- `data.js`: checkpoint, category, difficulty, achievement, and region definitions.
- `js/core.js`: pure date, progression, validation, completion, and aggregation logic.
- `js/storage.js`: persistence and recovery behavior.
- `js/reminders.js`: reminder forms, in-app reminder center, and opt-in browser notification delivery.
- `js/visuals.js`: reusable SVG icons, landscapes, and landmark illustrations.
- `app.js`: page rendering, routing, forms, and interactions.
- `styles.css`: shared visual system, themes, and responsive layouts.

Classic scripts intentionally support opening `index.html` directly; ES module loading from file URLs is restricted in several browsers.

## Verification

Requires Node 22+ for the test tooling only:

```sh
node --test tests/core.test.cjs
node tests/browser.mjs
```

The browser test launches an isolated temporary Chrome profile, uses the real `file://` app, and does not touch your personal browser data. On Windows it defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe`; set `ASCEND_BROWSER` to another Chromium executable if needed. Generated screenshots go to ignored `test-results/`. Tests exercise real task flows, persistence, backup download/import validation, duplicate clicks, concurrent tabs, keyboard dialogs, themes, all six pages at 320/390/768/1024 px, summit completion, and storage failure recovery.
