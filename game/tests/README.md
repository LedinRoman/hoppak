# Profile e2e

The runner builds the site and starts two loopback mock servers. Run from `game/`
with Node.js, Chrome and the build tools used by `build.sh` available.

```bash
set -e
for run in $(seq 1 20); do
  start=$SECONDS
  node tests/profile-e2e.js
  printf 'Run %s PASS (%ss)\n' "$run" "$((SECONDS-start))"
done
```

Use the same browser, host and build on both revisions when comparing timings.
The regression commands `net-protocol.js`, `net-e2e.js`, `kick-e2e.js` and
`presence-e2e.js` should target an isolated server. The last two create test
accounts or change presence state and require a disposable PostgreSQL database.
