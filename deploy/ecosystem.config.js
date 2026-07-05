// PM2 process supervision for the E&C Super Master System.
//
// PM2 keeps all five processes alive across crashes and reboots.
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
// SECRETS: do NOT hardcode secrets here. Each app already loads its own .env
// (Next apps automatically; the Express apps via their start scripts / env).
// Set per-app secrets there, or export them before `pm2 start`.

const path = require("path");
const ROOT = process.env.EC_ROOT || path.resolve(__dirname, "..", "..");

const repo = (name) => path.join(ROOT, name);

module.exports = {
  apps: [
    {
      name: "ec-portal",
      cwd: repo("Final-system"),
      script: "npm",
      args: "start", // next start -p 4400
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "ec-fuel",
      cwd: repo("Fuel-System-V2"),
      script: "npm",
      args: "start", // next start -p 3300
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "ec-stores",
      cwd: repo("Main-stros-system"),
      script: "npm",
      args: "start", // next start -p 1111
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "ec-workshop",
      cwd: repo("Store-Database"),
      script: "server.js", // Express, PORT 5000
      env: { NODE_ENV: "production", PORT: "5000", COOKIE_SECURE: "true" },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "ec-oil",
      cwd: repo("oil-stock-book"),
      script: "server/index.js", // Express, PORT 3000
      env: { NODE_ENV: "production", PORT: "3000" },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
