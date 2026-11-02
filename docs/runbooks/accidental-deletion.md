# Runbook — Accidental deletion

**Symptom:** a document/user/tenant was deleted and must be recovered. The
levers below stop working once retention windows pass.

## What is deleted through the app

| Deleted | What vanishes | Recoverable? |
|---|---|---|
| Document | DB row + current/version files in S3 | **No in-app undo.** Restore DB row from a dump/PITR; restore file from S3 object versions. |
| Conversation | Conversation + messages | No; not worth a targeted restore alone. |
| User | Account, attendance, DocumentAccess rows | Recreate; re-grant shares; audit log survives. |
| Company | All tenant-owned rows (cascades) | Scratch-restore + table-by-table re-import; plan an hour. |

## Procedure

1. **Stop further damage.** Deactivate the account in the admin panel; the
   audit log records actor/IP. Do not delete more objects.
2. **Document bytes:** S3 versioning is enabled. In the S3 console, open the
   object → Versions → restore the previous version (or copy it to a new key).
   The DB row still has to be restored separately.
3. **Database rows:** restore the nearest RDS PITR snapshot to a **new**
   instance (see `restore.md`), or a nightly logical dump to a scratch
   database. Export the missing rows, check FK children (`chunks`, versions,
   access grants), then insert into production.
4. **Whole tenant:** scratch-restore, recreate the company, copy rows table by
   table. Do this in a maintenance window and tell the tenant.
5. **Verify with the tenant:** login, document list, one ask,
   `check_embeddings` for restored documents.

## Prevention

* S3 versioning ON (Terraform sets it).
* RDS PITR 14 days + nightly logical dumps (30-day S3 retention).
* Deletion is admin/uploader-only; review `delete` audit actions weekly.
