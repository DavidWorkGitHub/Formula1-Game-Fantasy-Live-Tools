# F1 25 Fantasy Live - player + podium autosave fix

Run:

```cmd
npm install
npm start
```

Open `http://localhost:3000`.

## What this version fixes

- Custom career/player cars now stay on the correct constructor when F1 sends an unknown driver ID.
- The app now tracks the player car index from the UDP header.
- Final classification automatically locks/saves the session before the podium scene or session reset clears live data.
- A local `fantasy-autosave.json` draft is written after every saved/final session and loaded again when the app starts.
- Saved session points are locked and no longer recalculated from refreshed telemetry.
- Sprint Qualifying, Sprint, Qualifying and Race are stored separately.
- Sprint overtakes, sprint fastest lap, sprint positions gained/lost and sprint result points are saved.
- Race overtakes, race fastest lap, race positions gained/lost, race result points and DOTD are saved separately.
- Qualifying `-5` only applies when SQ/Q is final or saved.
- Session changes auto-preserve the current phase before live telemetry is reset.
- Driver table now shows a clearer breakdown: SQ, Sprint, Q and Race.

## Important use flow

For a sprint weekend:

1. Select `Sprint Weekend`.
2. Run Sprint Qualifying.
3. Press `Save Current Session -> Next`.
4. Run Sprint.
5. Press `Save Current Session -> Next`.
6. Run Qualifying.
7. Press `Save Current Session -> Next`.
8. Run Race.
9. Select Driver of the Day.
10. Press `Save Current Session -> Next`.
11. Press `Save Weekend` in Race History.

Saved points should not disappear after refreshing or when the next session starts.


## Browser simulator

The dashboard now has simulator buttons at the top:

- Sim SQ
- Sim Sprint
- Sim Q
- Sim Race
- Sim Full Weekend

Use these to test scoring without opening F1 25. The simulator writes directly into the same scoring flow as live telemetry, so you can test saving sessions, DOTD, totals, and Race History.


## Custom player / career driver mapping

If your own driver still appears as `C0`, `C1`, or `YOU`, edit `driver-overrides.json` in the project folder.

Examples:

```json
{
  "player": { "name": "David O", "code": "DAV", "team": "MCL" },
  "0": { "name": "David O", "code": "DAV", "team": "FER" }
}
```

Use the `player` entry for whichever car F1 25 marks as your player car. Use a number like `0`, `1`, or `16` only if you want to force a specific car index.

Team codes:

```text
MER, FER, RED, MCL, VRB, ALP, AUD, HAA, AST, WIL, CAD
```

## Podium/reset protection

When F1 25 sends the final classification, this build locks that phase immediately. If the game then moves to the podium scene and resets live lap data, the saved SQ/Sprint/Q/Race scoring should remain available.

The autosaved draft is stored in:

```text
fantasy-autosave.json
```

The Race History sidebar still uses:

```text
fantasy-history.json
```

So the intended flow is:

1. Let the race finish.
2. The app auto-locks the race final classification.
3. Select Driver of the Day.
4. Press `Save Weekend` in the Race History sidebar to archive it permanently.
