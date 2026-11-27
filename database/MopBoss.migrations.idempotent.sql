IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127153823_InitialQuoteRequests'
)
BEGIN
    CREATE TABLE [QuoteRequests] (
        [Id] uniqueidentifier NOT NULL,
        [ReceivedAt] datetimeoffset NOT NULL,
        [Service] nvarchar(100) NOT NULL,
        [Property] nvarchar(100) NOT NULL,
        [Bedrooms] int NOT NULL,
        [Bathrooms] int NOT NULL,
        [SquareFeet] nvarchar(100) NOT NULL,
        [Frequency] nvarchar(100) NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Phone] nvarchar(40) NULL,
        [Email] nvarchar(254) NULL,
        [Zip] nvarchar(10) NULL,
        [Notes] nvarchar(2000) NULL,
        [NotifiedAt] datetimeoffset NULL,
        [NotificationError] nvarchar(1000) NULL,
        CONSTRAINT [PK_QuoteRequests] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127153823_InitialQuoteRequests'
)
BEGIN
    CREATE INDEX [IX_QuoteRequests_ReceivedAt] ON [QuoteRequests] ([ReceivedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127153823_InitialQuoteRequests'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127153823_InitialQuoteRequests', N'10.0.11');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'
    DECLARE @badRooms int = (SELECT COUNT(*) FROM [QuoteRequests] WHERE [Bedrooms] NOT BETWEEN 0 AND 9 OR [Bathrooms] NOT BETWEEN 1 AND 9);
    DECLARE @noContact int = (SELECT COUNT(*) FROM [QuoteRequests] WHERE [Phone] IS NULL AND [Email] IS NULL);
    DECLARE @tooMany int = CASE WHEN (SELECT COUNT(*) FROM [QuoteRequests]) > 99999999 THEN 1 ELSE 0 END;
    IF @badRooms + @noContact + @tooMany > 0
    BEGIN
        DECLARE @msg nvarchar(400) = CONCAT(N''MopBoss migration preflight failed: '', @badRooms,
            N'' row(s) with bedrooms/bathrooms out of range, '', @noContact,
            N'' row(s) without phone or email'', CASE WHEN @tooMany = 1 THEN N'', and too many rows for legacy references'' ELSE N'''' END,
            N''. Fix or remove those rows, then rerun. Nothing was changed.'');
        THROW 50001, @msg, 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    DROP INDEX [IX_QuoteRequests_ReceivedAt] ON [QuoteRequests];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC sp_rename N'[QuoteRequests].[ReceivedAt]', N'CreatedAtUtc', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    ALTER TABLE [QuoteRequests] ADD [UpdatedAtUtc] datetimeoffset NOT NULL DEFAULT (SYSUTCDATETIME());
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'UPDATE [QuoteRequests] SET [UpdatedAtUtc] = [CreatedAtUtc];');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    ALTER TABLE [QuoteRequests] ADD [IdempotencyKey] uniqueidentifier NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    ALTER TABLE [QuoteRequests] ADD [PayloadHash] char(64) NOT NULL DEFAULT '';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    ALTER TABLE [QuoteRequests] ADD [Status] varchar(20) NOT NULL DEFAULT 'New';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    ALTER TABLE [QuoteRequests] ADD [Reference] varchar(12) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'
    WITH numbered AS (
        SELECT [Reference], ROW_NUMBER() OVER (ORDER BY [CreatedAtUtc], [Id]) AS n
        FROM [QuoteRequests] WHERE [Reference] IS NULL)
    UPDATE numbered SET [Reference] = ''MB-L'' + RIGHT(''00000000'' + CAST(n AS varchar(8)), 8);');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[QuoteRequests]') AND [c].[name] = N'Reference');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [QuoteRequests] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [QuoteRequests] ALTER COLUMN [Reference] varchar(12) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE TABLE [NotificationOutbox] (
        [Id] uniqueidentifier NOT NULL,
        [QuoteRequestId] uniqueidentifier NOT NULL,
        [Kind] varchar(40) NOT NULL,
        [Status] varchar(20) NOT NULL,
        [Attempts] int NOT NULL,
        [NextAttemptAtUtc] datetimeoffset NOT NULL,
        [LockedUntilUtc] datetimeoffset NULL,
        [LockToken] uniqueidentifier NULL,
        [SentAtUtc] datetimeoffset NULL,
        [LastError] nvarchar(200) NULL,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        [UpdatedAtUtc] datetimeoffset NOT NULL,
        [ConcurrencyStamp] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_NotificationOutbox] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_NotificationOutbox_Attempts] CHECK ([Attempts] >= 0),
        CONSTRAINT [CK_NotificationOutbox_Status] CHECK ([Status] IN ('Pending','Sent','Failed')),
        CONSTRAINT [FK_NotificationOutbox_QuoteRequests_QuoteRequestId] FOREIGN KEY ([QuoteRequestId]) REFERENCES [QuoteRequests] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'
    INSERT INTO [NotificationOutbox]
        ([Id], [QuoteRequestId], [Kind], [Status], [Attempts], [NextAttemptAtUtc], [SentAtUtc],
         [LastError], [CreatedAtUtc], [UpdatedAtUtc], [ConcurrencyStamp])
    SELECT NEWID(), q.[Id], ''QuoteReceived'',
           CASE WHEN q.[NotifiedAt] IS NULL THEN ''Pending'' ELSE ''Sent'' END,
           CASE WHEN q.[NotifiedAt] IS NULL THEN 0 ELSE 1 END,
           SYSUTCDATETIME(), q.[NotifiedAt],
           CASE WHEN q.[NotifiedAt] IS NULL AND q.[NotificationError] IS NOT NULL THEN ''Legacy'' ELSE NULL END,
           q.[CreatedAtUtc], SYSUTCDATETIME(), NEWID()
    FROM [QuoteRequests] q;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[QuoteRequests]') AND [c].[name] = N'NotificationError');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [QuoteRequests] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [QuoteRequests] DROP COLUMN [NotificationError];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[QuoteRequests]') AND [c].[name] = N'NotifiedAt');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [QuoteRequests] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [QuoteRequests] DROP COLUMN [NotifiedAt];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE INDEX [IX_QuoteRequests_CreatedAtUtc] ON [QuoteRequests] ([CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_QuoteRequests_IdempotencyKey] ON [QuoteRequests] ([IdempotencyKey]) WHERE [IdempotencyKey] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE INDEX [IX_QuoteRequests_PayloadHash_CreatedAtUtc] ON [QuoteRequests] ([PayloadHash], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE UNIQUE INDEX [IX_QuoteRequests_Reference] ON [QuoteRequests] ([Reference]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE INDEX [IX_QuoteRequests_Status_CreatedAtUtc] ON [QuoteRequests] ([Status], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'ALTER TABLE [QuoteRequests] ADD CONSTRAINT [CK_QuoteRequests_Bathrooms] CHECK ([Bathrooms] BETWEEN 1 AND 9)');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'ALTER TABLE [QuoteRequests] ADD CONSTRAINT [CK_QuoteRequests_Bedrooms] CHECK ([Bedrooms] BETWEEN 0 AND 9)');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'ALTER TABLE [QuoteRequests] ADD CONSTRAINT [CK_QuoteRequests_ContactRoute] CHECK ([Phone] IS NOT NULL OR [Email] IS NOT NULL)');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    EXEC(N'ALTER TABLE [QuoteRequests] ADD CONSTRAINT [CK_QuoteRequests_Status] CHECK ([Status] IN (''New'',''Contacted'',''Quoted'',''Scheduled'',''Completed'',''Cancelled''))');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE UNIQUE INDEX [IX_NotificationOutbox_QuoteRequestId] ON [NotificationOutbox] ([QuoteRequestId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    CREATE INDEX [IX_NotificationOutbox_Status_NextAttemptAtUtc] ON [NotificationOutbox] ([Status], [NextAttemptAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127155840_QuoteLifecycleAndNotificationOutbox'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127155840_QuoteLifecycleAndNotificationOutbox', N'10.0.11');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    CREATE TABLE [IdempotencyKeys] (
        [Key] uniqueidentifier NOT NULL,
        [QuoteRequestId] uniqueidentifier NOT NULL,
        [PayloadHash] char(64) NOT NULL,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        CONSTRAINT [PK_IdempotencyKeys] PRIMARY KEY ([Key]),
        CONSTRAINT [FK_IdempotencyKeys_QuoteRequests_QuoteRequestId] FOREIGN KEY ([QuoteRequestId]) REFERENCES [QuoteRequests] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    EXEC(N'INSERT INTO [IdempotencyKeys] ([Key], [QuoteRequestId], [PayloadHash], [CreatedAtUtc]) SELECT [IdempotencyKey], [Id], [PayloadHash], [CreatedAtUtc] FROM [QuoteRequests] WHERE [IdempotencyKey] IS NOT NULL;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    CREATE INDEX [IX_IdempotencyKeys_QuoteRequestId] ON [IdempotencyKeys] ([QuoteRequestId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    DROP INDEX [IX_QuoteRequests_IdempotencyKey] ON [QuoteRequests];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    DECLARE @var3 nvarchar(max);
    SELECT @var3 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[QuoteRequests]') AND [c].[name] = N'IdempotencyKey');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [QuoteRequests] DROP CONSTRAINT ' + @var3 + ';');
    ALTER TABLE [QuoteRequests] DROP COLUMN [IdempotencyKey];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127171743_DurableIdempotencyKeys'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127171743_DurableIdempotencyKeys', N'10.0.11');
END;

COMMIT;
GO

