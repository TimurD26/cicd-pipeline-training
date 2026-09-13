/**
 * Minimal Express app for the Jenkins Multibranch / Manual pipeline training exercise.
 *
 * The port the app listens on is entirely controlled by the PORT environment
 * variable, which the Jenkins pipeline sets differently per branch/env:
 *   - main -> 3000
 *   - dev  -> 3001
 *
 * The logo shown on the page is whatever public/logo.svg contains at deploy
 * time. The pipeline overwrites public/logo.svg with the branch-specific
 * logo (logos/logo-main.svg or logos/logo-dev.svg) right before the docker
 * image is built, so the same server.js/index.html work for both envs.
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ENV_NAME = process.env.APP_ENV || 'local';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: ENV_NAME, port: PORT });
});

app.listen(PORT, () => {
  console.log(`[${ENV_NAME}] app listening on http://localhost:${PORT}`);
});

module.exports = app;
