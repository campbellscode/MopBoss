/*
  Migration preflight. Run by Invoke-MopBossMigration.ps1 immediately before
  MopBoss.migrations.idempotent.sql, on the same sqlcmd connection with -b (stop on error).
  sqlcmd variables: ExpectedDatabase, MigrationTarget.

  It refuses to continue unless the server says this session is in the expected database
  for the declared target. XACT_ABORT and the SET options below stay on for the rest of the session, so any error in
  the migration script rolls back that migration's transaction.

  This is a guard against mistakes, not a permission boundary: the migration identity for
  one database must have no rights on the other.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
-- sqlcmd (ODBC) starts with QUOTED_IDENTIFIER OFF, which makes the filtered indexes in the
-- migration script fail. These are the session settings SSMS and EF Core use.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF N'$(MigrationTarget)' NOT IN (N'Development', N'Production', N'Test')
    THROW 50100, N'Preflight: MigrationTarget must be Development, Production or Test. Nothing was changed.', 1;
IF DB_NAME() <> N'$(ExpectedDatabase)'
    THROW 50101, N'Preflight: connected to a different database than expected. Nothing was changed.', 1;
IF N'$(MigrationTarget)' = N'Development' AND DB_NAME() <> N'MB-Dev'
    THROW 50102, N'Preflight: Development may only migrate MB-Dev. Nothing was changed.', 1;
IF N'$(MigrationTarget)' = N'Production' AND DB_NAME() <> N'MB-Prod'
    THROW 50103, N'Preflight: Production may only migrate MB-Prod. Nothing was changed.', 1;
IF N'$(MigrationTarget)' = N'Test' AND DB_NAME() NOT LIKE N'MopBossTest[_]%'
    THROW 50104, N'Preflight: Test may only migrate MopBossTest_* databases. Nothing was changed.', 1;
IF @@TRANCOUNT <> 0
    THROW 50105, N'Preflight: an open transaction was found. Nothing was changed.', 1;

PRINT N'Preflight passed: ' + DB_NAME() + N' (' + N'$(MigrationTarget)' + N').';
GO
