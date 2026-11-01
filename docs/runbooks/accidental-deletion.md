# Runbook — Accidental deletion

**Symptom:** "we deleted the wrong document / user / whole company data is
gone." Speed matters: the levers below stop working once retention windows
pass.

## What is deleted through the app (and what that means)

| Deleted | What vanishes | Recoverable? |
|---|---|---|
| Document (DELETE /api/documents/<id>) | DB row + current file + version files in storage | **No in-app undo.** Restore from last night's DB dump (`restore.md`) + re-upload file from S3 versioning |
| Chat conversation | Conversation + messages | No (not in any backup worth restoring alone) |
| User (admin panel) | Account + attendance + their DocumentAccess rows | Recreate user, re-grant shares; audit log survives |
| Company (platform admin, Django admin) | Everything tenant-owned (cascades) | Restore DB to a scratch database, export the tenant's rows, re-import — plan an hour |

## Procedure

1. **Stop further damage**: if the wrong actor is still clicking, deactivate
   the account (admin panel) before anything else; audit log records who did
   what (`AuditLog` action `delete` / `remove_user` with IP).
2. **Documents**: the file blobs are in S3 under `<company-slug>/` — enable S3
   versioning NOW if it is off (checklist), then the deleted object's old
   version can be pulled directly. The DB row is what needs the dump.
3. **Database rows**: restore last night's dump into a SCRATCH database (never
   over production), export the missing rows
   (`docker exec <pg> psql -c "\copy (SELECT * FROM core_document WHERE id=…) TO stdout CSV"`),
   and re-insert into production. Check FK children (chunks, versions,
   access_grants) — `Document.on_delete=CASCADE` took them too.
4. **Whole tenant**: scratch-restore, then re-create the company in prod and
   copy rows table by table. If this ever actually happens, do it as a
   maintenance window with the tenant informed.
5. **Verify with the tenant**: log in as their admin, list documents, run one
   ask; check `check_embeddings` for the restored documents.

## Prevention

* S3 bucket versioning ON (cheap insurance for every document file).
* Nightly pg_dump with 30-day retention (backups) — deletion recovery window.
* Deletion already requires admin-or-uploader; keep it that way and watch the
  `delete` audit action in the weekly review.
