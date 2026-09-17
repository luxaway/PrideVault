# fix/farm-heart-p0-p1

Remote tip was used for MCP upload experiments; `src/components/pride-app.tsx` on this remote branch tip may be corrupted.

**Source of truth:** local commit `3420f0333ff4d48ca04847dd0b88fa3f14d29de3`.

```bash
git checkout fix/farm-heart-p0-p1
git push -u origin HEAD --force-with-lease
gh pr create --base main --head fix/farm-heart-p0-p1 \
  --title "fix(farm-heart): P0 phantom staked, claim pending>0, restake re-read" \
  --body "See commit 3420f03. Or apply farm-heart.patch onto main."
```
