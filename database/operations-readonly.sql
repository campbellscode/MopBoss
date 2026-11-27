/*
  Read-only operator queries for Mop Boss. Safe to run at any time; nothing here changes data.
  Use an operator identity, never the app's runtime identity. Changes live in
  operations-recovery.sql. See PRODUCTION_READINESS.md, "Operational recovery".
*/

-- A. Notification overview.
SELECT Status, COUNT(*) AS Notifications, MIN(NextAttemptAtUtc) AS OldestDue
FROM dbo.NotificationOutbox
GROUP BY Status;
GO

-- B. Requests Linda has NOT received (Failed and unresolved), oldest first.
--    LastError holds an exception type and SMTP code only.
SELECT q.Reference, q.CreatedAtUtc, n.Attempts, n.LastError, n.UpdatedAtUtc
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE n.Status = 'Failed'
ORDER BY q.CreatedAtUtc;
GO

-- C. Requests handed to Linda by hand after email failed, and log-only (Suppressed) rows
--    from non-production environments.
SELECT q.Reference, q.CreatedAtUtc, n.Status, n.LastError, n.UpdatedAtUtc
FROM dbo.NotificationOutbox n
JOIN dbo.QuoteRequests q ON q.Id = n.QuoteRequestId
WHERE n.Status IN ('HandledManually', 'Suppressed')
ORDER BY n.UpdatedAtUtc DESC;
GO

-- D. One request's details, to pass to Linda by a secure route when email cannot.
--    Contains customer contact data: do not paste the result into tickets or chat.
DECLARE @Reference varchar(12) = NULL; -- e.g. 'MB-7K3Q9X'
SELECT q.Reference, q.Status, q.CreatedAtUtc, q.Service, q.Property, q.Bedrooms, q.Bathrooms,
       q.SquareFeet, q.Frequency, q.Name, q.Phone, q.Email, q.Zip, q.Notes
FROM dbo.QuoteRequests q
WHERE q.Reference = @Reference;
GO
