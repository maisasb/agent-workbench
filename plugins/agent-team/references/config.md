# Repo configuration

Each repo can carry a file `.agent-team.yml` at its root. A repo without the file uses the defaults below, and the lead asks the user for any value it cannot find.

```yaml
default_branch: main            # default: the branch that origin/HEAD points to
worktree_root: ../.team-worktrees/<repo>   # where run and unit worktrees go
install: pnpm install           # optional; runs once in each new worktree
preflight: aws sts get-caller-identity   # optional; must exit 0 before the run
verify:                         # commands of the verify, in order; each must exit 0
  lint: pnpm lint
  typecheck: pnpm typecheck
  test: pnpm test
  build: pnpm build
heavy_test_slots: 0             # 0 = no limit; N = at most N test suites at once in this repo
verify_ship_minutes: 6          # V of the team check; measure it for the repo
hold_label: do not merge        # optional; label for pull requests when the repo has an auto-merge workflow
post_commit_checks:             # optional; run by the lead in parallel with the verify
  - name: security-scan
    agent: my-scan-agent        # an agent to start, or `run: <command>` to run in the unit worktree
deploy:                         # optional; offered at the close
  command: ./deploy.sh <target>
  targets: [test1, test2]
```

## Defaults and rules

- `worktree_root` is a folder outside the repo. Never put worktrees inside a path that the repo tracks.
- `verify` lists the commands you would run before you open a pull request. A missing key is skipped, and the skip is reported.
- `heavy_test_slots` protects the machine. A suite with a large heap, such as a JVM build, needs 2. A small suite needs 0.
- `verify_ship_minutes` is 6 when unknown. A repo with a verify of a few seconds uses 2.
- `post_commit_checks` entries are read-only. An agent entry receives only the fields of its own contract. A `run` entry runs in the unit worktree and must not change it.
- `deploy` is never run without a yes from the user at the close.
- `hold_label` applies only when a workflow file in `.github/workflows/` has `auto-merge` in its name.

## Repo record

The lead builds one record for each repo and writes it in the ledger and in every brief:

`name`, `path` (the run worktree), `default_branch`, `worktree_root`, `install`, `preflight`, `verify`, `heavy_test_slots`, `verify_ship_minutes`, `hold_label`, `post_commit_checks`, `deploy`, `unit_suffix`, `base_sha`.

The ledger keeps `name`, `path`, `default_branch`, `worktree_root`, `install`, `unit_suffix`, `base_sha` and whether the hold label applies. A resume reads the other fields again from `.agent-team.yml`.

- `path` is the run worktree of the repo. The lead's repo holds the artifacts in it. In another repo nothing is committed in it: it is a clean baseline.
- `base_sha` is the tip of `origin/<default_branch>` after a fetch, when the run starts.
- `unit_suffix` is empty, or `-r<N>` when unit branches of the same feature already exist.
