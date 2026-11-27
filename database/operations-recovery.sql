/*
  Recovery operations for Mop Boss. THESE CHANGE DATA. None of them delete anything.

  How to use: select ONE section (from BEGIN to END) and run only that, after setting its
  variables. Every section:
    - does nothing until its variables are set (it stops with an error instead);
    - runs in a transaction and rolls back unless the number of affected rows is exactly
      what you said to expect.
  Running the whole file by accident therefore changes nothing: each section stops at
  its own unset variable.

  Use an operator identity, never the app's runtime identity. Run with stop-on-error
  (sqlcmd -b, or SSMS in SQLCMD mode with ":on error exit") where possible.
  See PRODUCTION_READINESS.md, "Operational recovery".
*/

-- BEGIN retry-one -----------------------------------------------------------------
-- Retry ONE Failed notification after fixing the cause (e.g. SMTP credentials).
-- HandledManually rows are never touched here. Linda may receive a second copy if an
-- earlier attempt actually reached her; both copies share one Message-ID.
DECLARE @Reference varchar(12) = NULL; -- e.g. 'MB-7K3Q9X'
IF @Reference IS NULL THROW 50010, N'retry-one: set @Reference first. Nothing changed.', 1;
BEGIN TRANSACTION;
UPDATE n
SET Status = 'Pending', Attempts = 0, NextAttemptAtUtc = SYSUTCDATETIME(),
    LockToken = NULL, LockedUntilUtc = NULL, LastError = NULL,
    UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE q.Reference = @Reference AND n.Status = 'Failed';
IF @@ROWCOUNT <> 1
BEGIN
    ROLLBACK;
    THROW 50011, N'retry-one: no single Failed notification for that reference. Nothing changed.', 1;
END
COMMIT;
-- END retry-one
GO

-- BEGIN retry-all-failed ----------------------------------------------------------
-- Retry EVERY unresolved Failed notification (e.g. after a provider outage). First run
-- query B in operations-readonly.sql and put its row count in @ExpectedRows.
-- HandledManually rows are never included.
DECLARE @ExpectedRows int = NULL; -- the count from operations-readonly.sql query B
IF @ExpectedRows IS NULL OR @ExpectedRows < 1
    THROW 50020, N'retry-all-failed: set @ExpectedRows first. Nothing changed.', 1;
BEGIN TRANSACTION;
UPDATE dbo.NotificationOutbox
SET Status = 'Pending', Attempts = 0, NextAttemptAtUtc = SYSUTCDATETIME(),
    LockToken = NULL, LockedUntilUtc = NULL, LastError = NULL,
    UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
WHERE Status = 'Failed';
IF @@ROWCOUNT <> @ExpectedRows
BEGIN
    ROLLBACK;
    THROW 50021, N'retry-all-failed: row count differs from @ExpectedRows. Nothing changed.', 1;
END
COMMIT;
-- END retry-all-failed
GO

-- BEGIN mark-handled --------------------------------------------------------------
-- After passing a Failed request to Linda another way (operations-readonly.sql query D),
-- record it. The row becomes HandledManually: never emailed, no longer degrading health,
-- and excluded from every retry above.
DECLARE @Reference varchar(12) = NULL; -- e.g. 'MB-7K3Q9X'
IF @Reference IS NULL THROW 50030, N'mark-handled: set @Reference first. Nothing changed.', 1;
BEGIN TRANSACTION;
UPDATE n
SET Status = 'HandledManually', UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE q.Reference = @Reference AND n.Status = 'Failed';
IF @@ROWCOUNT <> 1
BEGIN
    ROLLBACK;
    THROW 50031, N'mark-handled: no single Failed notification for that reference. Nothing changed.', 1;
END
COMMIT;
-- END mark-handled
GO

-- BEGIN override-requeue-handled --------------------------------------------------
-- Exceptional: email a request that was already handed over by hand (for example Linda
-- asks for it in her inbox too). Requires explicit confirmation.
DECLARE @Reference varchar(12) = NULL; -- e.g. 'MB-7K3Q9X'
DECLARE @ConfirmResendAlreadyHandled bit = 0; -- set to 1 to confirm
IF @Reference IS NULL OR @ConfirmResendAlreadyHandled <> 1
    THROW 50040, N'override-requeue-handled: set @Reference and @ConfirmResendAlreadyHandled = 1. Nothing changed.', 1;
BEGIN TRANSACTION;
UPDATE n
SET Status = 'Pending', Attempts = 0, NextAttemptAtUtc = SYSUTCDATETIME(),
    LockToken = NULL, LockedUntilUtc = NULL, LastError = NULL,
    UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE q.Reference = @Reference AND n.Status = 'HandledManually';
IF @@ROWCOUNT <> 1
BEGIN
    ROLLBACK;
    THROW 50041, N'override-requeue-handled: no single HandledManually notification for that reference. Nothing changed.', 1;
END
COMMIT;
-- END override-requeue-handled
GO

-- BEGIN set-status ----------------------------------------------------------------
-- Move one request through Linda's process (there is no public endpoint for this).
-- Allowed: New, Contacted, Quoted, Scheduled, Completed, Cancelled.
DECLARE @Reference varchar(12) = NULL; -- e.g. 'MB-7K3Q9X'
DECLARE @NewStatus varchar(20) = NULL; -- e.g. 'Contacted'
IF @Reference IS NULL OR @NewStatus IS NULL
    THROW 50050, N'set-status: set @Reference and @NewStatus first. Nothing changed.', 1;
BEGIN TRANSACTION;
UPDATE dbo.QuoteRequests
SET Status = @NewStatus, UpdatedAtUtc = SYSUTCDATETIME()
WHERE Reference = @Reference;
IF @@ROWCOUNT <> 1
BEGIN
    ROLLBACK;
    THROW 50051, N'set-status: no request with that reference. Nothing changed.', 1;
END
COMMIT;
-- END set-status
GO
