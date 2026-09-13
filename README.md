# Jenkins CI/CD Training: Multibranch + Manual Pipelines

This repo is a self-contained exercise for training systems engineers on Jenkins pipelines. It deploys a tiny Node.js app whose **port** and **logo.svg** change depending on which branch (`main` or `dev`) triggered the build. Two Jenkins jobs are built on top of it:

* **CICD** — a Multibranch Pipeline that auto-discovers `main` and `dev` and runs checkout → build → test → build docker image → deploy for whichever branch changed.
* **CD_deploy_manual** — a regular Pipeline, triggered only by clicking "Build with Parameters", that deploys whichever environment (`main` or `dev`) you pick.

Everything the pipelines need is already in this repo: `Jenkinsfile` (multibranch), `Jenkinsfile.manual` (manual job), `Dockerfile`, the app itself under `app/`, and the two branch logos under `logos/`.

## Repo layout

```
app/
  server.js        Express app; listens on process.env.PORT
  package.json
  test.js          placeholder "test" stage
  public/
    index.html
    logo.svg       overwritten per-branch at build time
logos/
  logo-main.svg    green "MAIN / port 3000" logo
  logo-dev.svg     blue "DEV / port 3001" logo
Dockerfile
Jenkinsfile         multibranch pipeline (job: CICD)
Jenkinsfile.manual   manual pipeline (job: CD_deploy_manual)
```

## Prerequisites

* Git, Docker and Jenkins basics; general familiarity with app deployment and shell scripting.
* A Linux VM with Jenkins installed (https://www.jenkins.io/download) and Docker installed on the same VM (the Jenkins agent runs `docker build` / `docker run` directly on the host in this exercise).
* Jenkins plugins installed via Manage Jenkins → Plugins: **Docker Pipeline**, **Docker plugin**, **Git plugin**, **Groovy**, **NodeJs plugin**, **Pipeline**.
* A GitHub account and a personal access token for Jenkins to use (scopes below).
* The `jenkins` system user must be able to run `docker` (e.g. `sudo usermod -aG docker jenkins`, then restart Jenkins).

## Step 1 — Get the source and create your own repo

```bash
git clone https://github.com/epam-msdp/cicd-pipeline.git
cd cicd-pipeline
```

Or, if you're starting from this training package instead, just use the files in this folder as-is — they already have the same structure the original exercise expects (app + Dockerfile + Jenkinsfiles + logos).

Create a new, empty repository on GitHub (e.g. `cicd-pipeline-training`), then push:

```bash
cd cicd-pipeline-training      # or cicd-pipeline, whichever you pulled
git init
git remote add origin https://github.com/<your-github-user>/cicd-pipeline-training.git
git add .
git commit -m "Initial commit: app, Dockerfile, Jenkinsfiles, logos"
git branch -M main
git push -u origin main
```

Create the `dev` branch from `main`:

```bash
git checkout -b dev
git push -u origin dev
```

You should now see two branches on GitHub, `main` and `dev`, with identical content (the pipeline is what makes them behave differently at deploy time — you generally don't need different source per branch, since `Jenkinsfile` reads `BRANCH_NAME` and swaps the logo/port itself).

## Step 2 — GitHub token for Jenkins

Create a personal access token at GitHub → Settings → Developer settings → Personal access tokens, then add it as a "Username with password" (username = your GitHub username, password = the token) or "Secret text" credential in Jenkins (Manage Jenkins → Credentials).

Scopes depend on what you need:

* `admin:repo_hook` — Jenkins manages the webhook itself (needed for Multibranch Pipeline auto-scan-on-push).
* `admin:org_hook` — same, at the GitHub Organization level (only if you're using a GitHub Organization Folder instead of a single repo).
* `repo` — required to see private repos; it's a parent scope covering `repo:status`, `repo:deployment` and `public_repo`. If your repo is public, `public_repo` alone is enough.
* `read:org` and `user:email` — recommended minimum if you're using the GitHub OAuth Plugin for Jenkins login.

## Step 3 — Global Tool Configuration (Node)

Manage Jenkins → Tools → NodeJS installations → Add NodeJS:

1. Name: `Node 7.8.0` (this must match the `tools { nodejs '...' }` name used in both Jenkinsfiles — rename in both files if you pick a different name).
2. Check "Install automatically" → Install from nodejs.org → Version: `NodeJS 7.8.0`.
3. Save.

## Step 4 — Create the Multibranch Pipeline ("CICD")

1. Dashboard → New Item → name it `CICD` → type "Multibranch Pipeline".
2. Branch Sources → Add source → GitHub → point it at `https://github.com/<your-github-user>/cicd-pipeline-training` and select your credentials.
3. Build Configuration → Mode: "by Jenkinsfile", Script Path: `Jenkinsfile` (default, matches the repo root file).
4. Scan Multibranch Pipeline Triggers → check "Periodically if not otherwise run" (e.g. every 1 minute) for the exercise, or rely on the GitHub webhook if you configured one.
5. Save. Jenkins scans the repo, finds `main` and `dev`, and runs both automatically.

Trigger a build by pushing a commit to either branch, or manually via each branch's "Build Now" / "Scan Multibranch Pipeline Now". You should end up with a Stage View like: **Checkout SCM → Tool Install → Build → Test → Docker build → Deploy**, one row per branch (`dev`, `main`), each with its own last-success/last-failure history.

## Step 5 — Create the manual Pipeline ("CD_deploy_manual")

1. Dashboard → New Item → name it `CD_deploy_manual` → type "Pipeline".
2. Under Pipeline, choose "Pipeline script from SCM" → SCM: Git → repository URL and credentials as above → Branch Specifier: `*/main` (any value works; the job checks out whatever `TARGET_ENV` says instead) → Script Path: `Jenkinsfile.manual`.
3. Save, then run once with "Build with Parameters" and pick `TARGET_ENV` = `main` or `dev`.

This job never runs on its own — no SCM polling, no webhook — it only runs when a person clicks "Build with Parameters", which satisfies the "manually triggered" requirement.

## Step 6 — Verify the branch-specific behavior

After a successful `CICD` run for both branches (or two manual runs of `CD_deploy_manual`), you should have two containers running side by side:

```bash
docker ps
# node-main   ...   0.0.0.0:3000->3000/tcp
# node-dev    ...   0.0.0.0:3001->3001/tcp
```

Open http://localhost:3000 — green "MAIN" logo. Open http://localhost:3001 — blue "DEV" logo. `docker images` shows two distinct image IDs, `nodemain:v1.0` and `nodedev:v1.0`.

## How the branch → port/logo logic works

Both Jenkinsfiles set four environment variables from the branch name (`env.BRANCH_NAME` for the multibranch job, `params.TARGET_ENV` for the manual job) before anything else runs:

| Branch | Port | Image          | Container   | Logo               |
|--------|------|----------------|-------------|--------------------|
| main   | 3000 | nodemain:v1.0  | node-main   | logos/logo-main.svg|
| dev    | 3001 | nodedev:v1.0   | node-dev    | logos/logo-dev.svg |

The "Apply branch assets" stage copies the right SVG over `app/public/logo.svg` *before* `docker build`, so the logo is baked into the image, not swapped at runtime. The port is passed both as a Docker build arg (`APP_PORT`) and as a runtime env var (`PORT`) so it works whether you rebuild the image or just re-run an existing one.

## Advanced task: only touch the deployed env's container

A naive version of this pipeline might do `docker rm -f $(docker ps -aq)` before deploying, which would kill *every* container, including the other environment's. Both Jenkinsfiles here avoid that: the "Deploy" stage only stops/removes the container matching `CONTAINER_NAME` for the branch/env currently being deployed:

```groovy
sh """
    if [ \$(docker ps -aq -f name=^${env.CONTAINER_NAME}\$) ]; then
        docker rm -f ${env.CONTAINER_NAME}
    fi
"""
sh "docker run -d --name ${env.CONTAINER_NAME} -p ${env.APP_PORT}:${env.APP_PORT} -e PORT=${env.APP_PORT} ${env.IMAGE_NAME}"
```

Deploying `dev` never touches `node-main`, and vice versa — you can verify this by deploying `main`, then `dev`, and confirming `docker ps` still shows both containers.

## Optional: add a Trivy vulnerability scan stage

Install Trivy on the Jenkins agent (https://aquasecurity.github.io/trivy), then add a stage after "Build Docker image" in either Jenkinsfile:

```groovy
stage('Scan Docker Image for Vulnerabilities') {
    steps {
        script {
            def vulnerabilities = sh(
                script: "trivy image --exit-code 0 --severity HIGH,MEDIUM,LOW --no-progress ${env.IMAGE_NAME}",
                returnStdout: true
            ).trim()
            echo "Vulnerability Report:\n${vulnerabilities}"
        }
    }
}
```

Set `--exit-code 1` instead of `0` if you want the build to fail on findings rather than just report them.

## Troubleshooting

* **`docker: command not found` in the pipeline** — the `jenkins` user isn't in the `docker` group, or Jenkins wasn't restarted after adding it.
* **NodeJS tool not found** — the name in `tools { nodejs '...' }` must exactly match the name configured in Global Tool Configuration.
* **Multibranch job shows no branches** — check the GitHub credential has at least `repo` (or `public_repo`) scope and the repository URL is correct.
* **Port already in use** — a leftover container from a previous run; `docker rm -f node-main` / `docker rm -f node-dev` and re-run the pipeline.
