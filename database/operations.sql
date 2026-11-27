/*
  Operator queries for Mop Boss. Run with an operator identity, never the app's runtime
  identity, and never paste customer details into tickets or chat. See
  PRODUCTION_READINESS.md ("Notification failures") for when to use each.

  None of these delete data.
*/

-- A. Health of email notifications ------------------------------------------------
SELECT Status, COUNT(*) AS Notifications, MIN(NextAttemptAtUtc) AS OldestDue
FROM dbo.NotificationOutbox
GROUP BY Status;

-- B. Notifications Linda has NOT received (failed permanently), newest first.
--    LastError holds an exception type and SMTP code only.
SELECT q.Reference, q.CreatedAtUtc, n.Attempts, n.LastError, n.UpdatedAtUtc
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE n.Status = 'Failed'
ORDER BY q.CreatedAtUtc DESC;

-- C. Retry ONE failed notification after fixing the cause (e.g. SMTP credentials).
--    The worker picks it up within a poll interval. Linda may receive a second copy
--    if an earlier attempt actually reached her; both copies share one Message-ID.
UPDATE n
SET Status = 'Pending', Attempts = 0, NextAttemptAtUtc = SYSUTCDATETIME(),
    LockToken = NULL, LockedUntilUtc = NULL, LastError = NULL,
    UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE q.Reference = '<REFERENCE>' AND n.Status = 'Failed';

-- D. Retry ALL notifications that failed in the last 7 days (after a provider outage).
UPDATE dbo.NotificationOutbox
SET Status = 'Pending', Attempts = 0, NextAttemptAtUtc = SYSUTCDATETIME(),
    LockToken = NULL, LockedUntilUtc = NULL, LastError = NULL,
    UpdatedAtUtc = SYSUTCDATETIME(), ConcurrencyStamp = NEWID()
WHERE Status = 'Failed' AND UpdatedAtUtc >= DATEADD(day, -7, SYSUTCDATETIME());

-- E. Hand a failed request to Linda without email: read the details here and pass them
--    on by a secure route, then note it so the health check stops flagging it.
SELECT q.Reference, q.CreatedAtUtc, q.Service, q.Property, q.Bedrooms, q.Bathrooms,
       q.SquareFeet, q.Frequency, q.Name, q.Phone, q.Email, q.Zip, q.Notes
FROM dbo.QuoteRequests q WHERE q.Reference = '<REFERENCE>';

UPDATE n SET LastError = 'HandledManually', UpdatedAtUtc = DATEADD(day, -8, SYSUTCDATETIME()),
             ConcurrencyStamp = NEWID()
FROM dbo.NotificationOutbox n JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE q.Reference = '<REFERENCE>' AND n.Status = 'Failed';

-- F. Move a request through Linda's process (there is no public endpoint for this).
--    Allowed: New, Contacted, Quoted, Scheduled, Completed, Cancelled.
UPDATE dbo.QuoteRequests
SET Status = '<NEW_STATUS>', UpdatedAtUtc = SYSUTCDATETIME()
WHERE Reference = '<REFERENCE>';
