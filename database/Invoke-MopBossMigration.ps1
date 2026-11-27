<#
.SYNOPSIS
  Applies the reviewed database/MopBoss.migrations.idempotent.sql to ONE named Mop Boss
  database, after a server-side preflight, with sqlcmd stopping at the first error.

.DESCRIPTION
  Refuses before connecting unless -Target and -Database agree:
    Development -> MB-Dev
    Production  -> MB-Prod, and only with -ConfirmProduction MB-Prod
    Test        -> MopBossTest_* (disposable databases only)
  Then sqlcmd runs migration-preflight.sql and the migration script on one connection with
  -b (abort on error). The preflight checks DB_NAME() on the server and turns on
  XACT_ABORT. The connection is encrypted (-N); -TrustServerCertificate is refused for
  Production.

  Credentials are never passed on the command line. Use Windows authentication, or set
  SQLCMDUSER and SQLCMDPASSWORD in this shell only (the migration identity, never the
  app's runtime identity).

  These checks prevent mistakes; they do not replace permissions. The MB-Dev migration
  identity must have no rights on MB-Prod, and the reverse.

.EXAMPLE
  ./database/Invoke-MopBossMigration.ps1 -Target Development -Server 'sql.example,1433' -Database MB-Dev -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Development', 'Production', 'Test')][string]$Target,
    [Parameter(Mandatory)][string]$Server,
    [Parameter(Mandatory)][string]$Database,
    [string]$ConfirmProduction,
    [switch]$TrustServerCertificate,
    [string]$Sqlcmd = 'sqlcmd',
    # Print the sqlcmd command and stop without connecting.
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Migration([string]$Message) {
    Write-Error "$Message Nothing was changed." -ErrorAction Continue
    exit 2
}

if ($Database -notmatch '^[A-Za-z0-9_-]{1,128}$') { Stop-Migration 'Database name contains unexpected characters.' }

switch ($Target) {
    'Development' {
        if ($Database -ne 'MB-Dev') { Stop-Migration 'Target Development may only migrate MB-Dev.' }
    }
    'Production' {
        if ($Database -ne 'MB-Prod') { Stop-Migration 'Target Production may only migrate MB-Prod.' }
        if ($ConfirmProduction -cne 'MB-Prod') { Stop-Migration 'Migrating MB-Prod requires -ConfirmProduction MB-Prod.' }
        if ($TrustServerCertificate) { Stop-Migration 'Production must validate the server certificate; remove -TrustServerCertificate.' }
    }
    'Test' {
        if (-not $Database.StartsWith('MopBossTest_', [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Migration 'Target Test may only migrate MopBossTest_* databases.'
        }
    }
}

$preflight = Join-Path $PSScriptRoot 'migration-preflight.sql'
$script = Join-Path $PSScriptRoot 'MopBoss.migrations.idempotent.sql'
foreach ($file in $preflight, $script) {
    if (-not (Test-Path -LiteralPath $file)) { Stop-Migration "Missing $file." }
}

$arguments = @(
    '-S', $Server,
    '-d', $Database,
    '-b',          # stop at the first error
    '-I',          # QUOTED_IDENTIFIER ON (sqlcmd defaults to OFF; filtered indexes need it)
    '-N',          # encrypt the connection
    '-l', '30',
    '-v', "ExpectedDatabase=$Database", "MigrationTarget=$Target",
    '-i', "$preflight,$script"
)
if ($TrustServerCertificate) { $arguments += '-C' }

Write-Host "Target: $Target  Database: $Database  Server: $Server"
if ($DryRun) {
    Write-Host ("Dry run, not connecting: {0} {1}" -f $Sqlcmd, ($arguments -join ' '))
    exit 0
}

& $Sqlcmd @arguments
if ($LASTEXITCODE -ne 0) {
    Write-Error "sqlcmd stopped with exit code $LASTEXITCODE. Review the output above." -ErrorAction Continue
    exit $LASTEXITCODE
}
Write-Host "Migration script completed on $Database. Check __EFMigrationsHistory and /health/ready."
