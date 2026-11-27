/*
  Least-privilege database identities for Mop Boss. TEMPLATE: review, then run once per
  database (MB-Dev, then MB-Prod) as an administrator. Replace every <PLACEHOLDER>; no
  real names or passwords belong in this file or in Git.

  Two identities per environment:
    - runtime   : what MopBoss.Server uses. Reads and writes its three tables, reads
                  the migration history (readiness). No schema changes, no deletes.
                  Its request lock (sp_getapplock) needs only the default public role.
    - migration : used by a person applying reviewed migrations. Schema rights.
  Use different identities (and passwords or managed identities) for MB-Dev and MB-Prod,
  so a development credential can never open production.

  Contained database users are shown. If the server uses server logins instead, create
  the logins in master and map them here with CREATE USER ... FOR LOGIN.
*/

-- Run in the target database (MB-Dev or MB-Prod).

-- 1. Runtime identity ---------------------------------------------------------------
CREATE USER [<RUNTIME_USER>] WITH PASSWORD = '<RUNTIME_PASSWORD_FROM_SECRET_MANAGER>';
-- Or, for Microsoft Entra / managed identity: CREATE USER [<APP_IDENTITY>] FROM EXTERNAL PROVIDER;

GRANT SELECT, INSERT, UPDATE ON dbo.QuoteRequests      TO [<RUNTIME_USER>];
GRANT SELECT, INSERT, UPDATE ON dbo.NotificationOutbox TO [<RUNTIME_USER>];
GRANT SELECT, INSERT         ON dbo.IdempotencyKeys    TO [<RUNTIME_USER>];
GRANT SELECT ON dbo.__EFMigrationsHistory              TO [<RUNTIME_USER>]; -- readiness only
-- Deliberately NOT granted: DELETE, ALTER, CREATE TABLE, db_owner, db_ddladmin.
-- SqlServerTests checks these exact GRANT lines against the API's real code paths.

-- 2. Migration identity -------------------------------------------------------------
CREATE USER [<MIGRATION_USER>] WITH PASSWORD = '<MIGRATION_PASSWORD_FROM_SECRET_MANAGER>';
ALTER ROLE db_ddladmin   ADD MEMBER [<MIGRATION_USER>];
ALTER ROLE db_datareader ADD MEMBER [<MIGRATION_USER>];
ALTER ROLE db_datawriter ADD MEMBER [<MIGRATION_USER>]; -- migrations backfill existing rows

-- 3. Check what each identity can do ----------------------------------------------
-- EXECUTE AS USER = '<RUNTIME_USER>';
-- SELECT * FROM fn_my_permissions('dbo.QuoteRequests', 'OBJECT');
-- REVERT;
