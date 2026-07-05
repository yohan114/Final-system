// PM2 process supervision for the E&C Super Master System — UNIFIED MODE.
//
// The whole estate is ONE Node process (server/unified.mjs hosts the portal +
// all four systems on one port), so PM2 supervises a single app: it restarts
// on crash and comes back after reboot.
//
//   npm i -g pm2
//   set EC_ROOT=C:\ec           (the folder that holds the five repo checkouts)
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup                 (Linux/macOS: enables boot start)
//
// On Windows, run PM2 itself as a service so it survives reboot — use
// `pm2-installer` (https://github.com/jessety/pm2-installer) or wrap
// `pm2 resurrect` in an NSSM service. See DEPLOYMENT.md.
//
// SECRETS: do NOT hardcode secrets here. The unified server loads the portal's
// .env first (authoritative), then each app's own .env without overriding.
//
// (Running the five systems as separate processes is still possible — see the
// git history of this file for the five-app layout — but the unified single
// process is the supported deployment.)

const path = require("path");
const ROOT = process.env.EC_ROOT || path.resolve(__dirname, "..", "..");

module.exports = {
  apps: [
    {
      name: "ec-unified",
      cwd: path.join(ROOT, "Final-system"),
      script: "server/unified.mjs", // one process: portal + all four systems, port 4400
      env: { NODE_ENV: "production", EC_ROOT: ROOT },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
