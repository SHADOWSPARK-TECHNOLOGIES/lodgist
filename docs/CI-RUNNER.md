# Self-hosted CI runner

GitHub-hosted runners are unavailable for this repository while the org billing
hold is in place: every workflow run ends in `startup_failure` within a second
and no log is produced. CI therefore runs on one repository-scoped self-hosted
runner.

## Where it runs

| Item | Value |
|------|-------|
| Host | the Lodgist dev workstation (moronto), `linux/x64` |
| Runner version | 2.338.1 (see `~/actions-runner/.runner`) |
| Install dir | `~/actions-runner` |
| Scope | repository `SHADOWSPARK-TECHNOLOGIES/lodgist` (not org-wide) |
| Labels | `self-hosted`, `linux`, `x64`, `lodgist-ci` |
| Service | `actions.runner.SHADOWSPARK-TECHNOLOGIES-lodgist.<name>.service` (systemd, runs as `moronto`) |

Jobs opt in with the custom label so the runner is never silently picked up by
unrelated workflows:

```yaml
runs-on: [self-hosted, linux, x64, lodgist-ci]
```

## Registering a runner from scratch

Registration needs a **registration token**, not a PAT, and only an admin of the
repository can mint one. Tokens expire after one hour.

```bash
# 1. Install the runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -fsSL -o runner.tar.gz \
  https://github.com/actions/runner/releases/download/v2.338.1/actions-runner-linux-x64-2.338.1.tar.gz
tar xzf runner.tar.gz

# 2. Register (token from the API, never committed)
TOKEN=$(gh api -X POST \
  repos/SHADOWSPARK-TECHNOLOGIES/lodgist/actions/runners/registration-token --jq .token)
./config.sh --url https://github.com/SHADOWSPARK-TECHNOLOGIES/lodgist \
  --token "$TOKEN" \
  --name "lodgist-dev-linux-x64" \
  --labels lodgist-ci \
  --work _work \
  --unattended --replace

# 3. Install and start the systemd service
sudo ./svc.sh install moronto
sudo ./svc.sh start
sudo ./svc.sh status
```

Verify from the API:

```bash
gh api repos/SHADOWSPARK-TECHNOLOGIES/lodgist/actions/runners \
  --jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
```

## Operating it

```bash
sudo ./svc.sh status      # is it up?
gh api repos/SHADOWSPARK-TECHNOLOGIES/lodgist/actions/runners --jq '.runners[].status'
sudo ./svc.sh stop && sudo ./svc.sh start   # restart after host updates
tail -f ~/actions-runner/_diag/Runner_*.log # live diagnostics
```

- A job that never starts with the runner `online` and idle means the labels in
  `runs-on` do not match — check `--labels` at registration.
- A runner idle for more than 14 days is deleted by GitHub; re-register.
- `_work` accumulates every checkout. `./run.sh --once` style cleanup or a
  periodic `rm -rf ~/actions-runner/_work/_actions` keeps disk usage sane.

## Upgrading the runner

GitHub forces an upgrade when a new runner version is required. Do it manually
to keep it deterministic:

```bash
sudo ./svc.sh stop
curl -fsSL -o runner.tar.gz \
  https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-x64-X.Y.Z.tar.gz
tar xzf runner.tar.gz          # extract over the existing install
sudo ./svc.sh start
```

## Security notes

- The runner executes code from pull requests in this private repository under
  the `moronto` account. Do not approve PRs from untrusted forks for automatic
  runs on it, and do not add `pull_request_target` workflows that check out fork
  code.
- Nothing on this host is a deployment target: deploy jobs stay on Railway.
- The registration token is single-use for this purpose and short-lived; it is
  never written into the repository.
- Secrets (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) are
  still repository secrets and are exposed to these jobs exactly as they were to
  hosted runners.

## Removing it

```bash
cd ~/actions-runner
sudo ./svc.sh stop && sudo ./svc.sh uninstall
TOKEN=$(gh api -X POST \
  repos/SHADOWSPARK-TECHNOLOGIES/lodgist/actions/runners/remove-token --jq .token)
./config.sh remove --token "$TOKEN"
```
