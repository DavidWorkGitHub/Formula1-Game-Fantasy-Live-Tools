# F1 25 Fantasy Live — Persistence + Automatic Weekend Manager

These files add two things to the existing app:

1. **Persistent data outside the project folder**
2. **Automatic Sprint/Qualifying/Race session progression**

## Files

- `data-manager.js` — creates `Documents\\F1 Fantasy Live\\` and stores autosave, history, weekend state, season, prices, standings and settings. Writes are atomic and important saves are backed up.
- `weekend-manager.js` — detects Standard vs Sprint weekend flow, ignores Practice, locks completed sessions and prevents later telemetry from overwriting them.
- `server.js` — integrated version of the existing backend with both modules.

## Install

Replace the existing `server.js` with this one and copy `data-manager.js` and `weekend-manager.js` beside it.

Then run:

```cmd
npm start
```

On first start, the server migrates the old project-local files when the new data folder is empty.

## Data location

Default:

```text
C:\Users\\<you>\\Documents\\F1 Fantasy Live\\
```

Files include:

```text
history.json
autosave.json
weekend.json
season.json
prices.json
standings.json
settings.json
backups\\
```

You can override the location with:

```cmd
set F1_FANTASY_DATA_DIR=D:\F1FantasyData
npm start
```

## Automatic weekend flow

Standard:

```text
Practice -> ignored
Qualifying -> locked
Race -> locked
Weekend complete
```

Sprint:

```text
Practice -> ignored
Sprint Qualifying -> locked
Sprint -> locked
Qualifying -> locked
Race -> locked
Weekend complete
```

The user no longer needs to manually change the session to preserve points. Manual `/api/save-phase` remains only as a compatibility/debug endpoint.

## Recovery

The runtime is autosaved every 5 seconds and also when sessions change/finish. Restarting the program loads the last saved weekend before new UDP telemetry arrives.
