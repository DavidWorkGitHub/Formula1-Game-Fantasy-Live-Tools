# F1 25 Fantasy Live — stable PS5 build

A local Node.js dashboard that receives F1 25 telemetry from a PS5 and calculates live fantasy scoring.

## First-time setup

1. Extract the ZIP to a normal folder.
2. Double-click `ALLOW_NODE_FIREWALL.cmd` and approve the Windows Administrator prompt.
3. Double-click `START_F1_FANTASY.cmd` and keep the window open.
4. Open `http://localhost:3000` in your browser.

## PS5 F1 25 telemetry settings

Use the PC IPv4 address shown by the app or `CHECK_CONNECTION.cmd`.

- UDP Telemetry: **On**
- UDP Broadcast Mode: **Off**
- UDP IP Address: **your PC IPv4 address**
- UDP Port: **the port shown in Setup** (default `20777`)
- UDP Send Rate: **20 Hz**
- UDP Format: **2025** (recommended/stable)
- Your Telemetry: **Public**
- Show Online IDs: **On**

The PS5 and PC must be connected to the same local network.

## Changing the UDP port

Open **Setup** in the dashboard, enter a port from 1024–65535, and press **Save port**. The Node listener changes immediately. Set the PS5 to the same port. Run `ALLOW_NODE_FIREWALL.cmd` again after changing the port so Windows allows the new port.

## Connection Debug

- **Raw UDP** proves Node received a datagram.
- **Parsed F1** proves the header was understood.
- A PS5 sender should look like `192.168.x.x:<random source port>`.
- The local self-test sender will show `127.0.0.1` or the PC's own IP.

If Wireshark sees PS5 packets but **Raw UDP** remains 0, another app/process may own the port or Windows Firewall is blocking the exact Node executable. This build uses an exclusive UDP socket so it reports `EADDRINUSE` instead of silently sharing the port.

## Weekend scoring flow

- Standard: Qualifying → Race → DOTD → Save Weekend
- Sprint: Sprint Qualifying (grid only, 0 points) → Sprint → Qualifying → Race → DOTD → Save Weekend

Completed session points are locked so overtakes, fastest lap, qualifying, Sprint, race result and DOTD do not disappear when the game changes session or enters the podium scene.

## Useful commands

```cmd
npm start
npm run simulate
npm run check
```

`npm run simulate` sends local F1-format test packets to the port saved in `app-settings.json`.
