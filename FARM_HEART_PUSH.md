# Remote tip is NOT the fix

MCP could not upload the ~40–150KB source files; probe commits corrupted `src/components/pride-app.tsx` on this remote tip.

**Do not merge this remote tip.** Force-push the local commit over it:

```bash
cd PrideVault
git fetch origin
git checkout fix/farm-heart-p0-p1   # local commit 3420f0333ff4d48ca04847dd0b88fa3f14d29de3
git push -u origin HEAD --force-with-lease
gh pr create --base main --head fix/farm-heart-p0-p1 \
  --title "fix(farm-heart): P0 phantom staked, claim pending>0, restake re-read" \
  --body "$(cat <<'EOF'
## Summary
- P0: `readOoxPosition` always trusts VM `getUserStake` when present (including 0 after full unstake)
- Claim allows `pendingRoar > 0` even if `staked === 0`
- Restake: claim first → re-read wallet ROAR → `prepareFarmTx` stake with actual amount

## Test plan
- [ ] Full unstake clears phantom staked
- [ ] Claim with staked=0 pending>0
- [ ] Restake toast shows re-read amount
EOF
)"
```

`farm-heart.patch` on this branch applies the same diff onto `main` if preferred.
