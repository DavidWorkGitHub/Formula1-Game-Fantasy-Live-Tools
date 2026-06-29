# F1 25 Fantasy Live - scoring lock fix

Run:

```cmd
npm install
npm start
```

Open `http://localhost:3000`.

## What this version fixes

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
