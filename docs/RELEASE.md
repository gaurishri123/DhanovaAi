# Dhanova Release Checklist

## Build inputs

- [ ] Apply `backend/migrations/001_initial_schema.sql` to the target Supabase project.
- [ ] Build the model with the recorded training seed and feature schema.
- [ ] Generate and verify the model manifest with `scripts/verify_artifact_manifest.py`.
- [ ] Store model binaries in a release artifact or object store, never in Git.
- [ ] Keep synthetic-data disclaimers with all published ML metrics.

## Verification

- [ ] Run `python -m compileall -q backend scripts`.
- [ ] Run `python -m pytest -q`.
- [ ] Run the deterministic importer dry run.
- [ ] Validate `/health/live` and `/health/ready` in the built image.
- [ ] Run a disposable Supabase RPC and idempotency smoke test.
- [ ] Confirm `AUTH_REQUIRED=true`, CORS allowlist, secrets, and model directory.

## Rollback

Keep the previous API image, migration version, and model bundle available. Roll back the
application and model together when the feature schema or model version changes. Do not roll
back a database migration that has already been used by newer application code without a
forward-compatible migration.
