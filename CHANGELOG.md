# Stable build changes

- Replaced shared/reusable UDP binding with one exclusive socket to prevent packets going to an old process.
- Added live UDP port rebinding and rollback when a requested port is unavailable.
- Added a self-elevating Windows Firewall helper for the exact Node executable and selected port.
- Added separate Raw UDP and Parsed F1 counters.
- Corrected the official F1 25 participant record size and 32-character name field.
- Corrected the lap-data pit-lane timer offset.
- Prevented custom/network players from being mistaken for an official driver solely because of their race number.
- Preserved player team mapping, including Cadillac/custom-team disambiguation.
- Added automatic Standard vs Sprint weekend detection.
- Prevented Q1/Q2/Q3 transitions from wiping qualifying state.
- Added automatic phase advancement after final classification.
- Sprint Qualifying now awards exactly 0 points and no -5 penalty.
- Saved Sprint, qualifying, race, overtakes, fastest lap and DOTD points remain locked.
- Ignored repetitive BUTN packets in the event log.
- Corrected track ID to race-round mapping for the race banner.
- Improved stored-data deletion so stale participant/session mappings are cleared.
- Race History no longer displays Sprint Qualifying as a scoring column.
- Web port automatically falls back from 3000 to the next available port through 3010.
