# Branch Protection Baseline

Recommended protection for `work` / `main`:

1. Require pull request before merging.
2. Require status checks to pass:
   - `ci / test-and-build`
3. Require branch to be up to date before merging.
4. Restrict force-push on protected branches.
5. Require at least one reviewer approval.
