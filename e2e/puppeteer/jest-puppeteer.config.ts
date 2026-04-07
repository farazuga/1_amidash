export default {
  launch: { headless: true, args: ['--no-sandbox'] },
  server: {
    command: 'npm run dev',
    port: 3000,
    launchTimeout: 60000,
    usedPortAction: 'ignore',
  },
};
