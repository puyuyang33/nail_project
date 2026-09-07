[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipDocker,
  [switch]$SkipMigrate,
  [switch]$Seed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command {
  param([Parameter(Mandatory)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function New-UrlSafeSecret {
  param([int]$Bytes = 48)

  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  }
  finally {
    $generator.Dispose()
  }

  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Assert-LastCommand {
  param([Parameter(Mandatory)][string]$Description)

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

$rootDirectory = Split-Path -Parent $PSScriptRoot
Push-Location $rootDirectory

try {
  Assert-Command -Name "node"
  Assert-Command -Name "npm"

  & node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24 ? 0 : 1)"
  if ($LASTEXITCODE -ne 0) {
    throw "Use a Prisma 7-supported Node.js release: 20.19+, 22.12+, or 24+."
  }

  if (-not (Test-Path -LiteralPath ".env")) {
    $databasePassword = New-UrlSafeSecret -Bytes 24
    $authSecret = New-UrlSafeSecret
    $cronSecret = New-UrlSafeSecret
    $content = @"
# Generated for local development by scripts/setup.ps1.
POSTGRES_DB=lunaria
POSTGRES_USER=lunaria
POSTGRES_PASSWORD=$databasePassword
POSTGRES_PORT=5432
DATABASE_URL=postgresql://lunaria:$databasePassword@localhost:5432/lunaria?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=$authSecret
CRON_SECRET=$cronSecret
BUSINESS_TIMEZONE=America/Chicago
STORE_CURRENCY=USD
APPOINTMENT_DEPOSITS_ENABLED=false
"@
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
      (Join-Path $rootDirectory ".env"),
      "$content`n",
      $utf8WithoutBom
    )
    Write-Host "Created a gitignored .env with random local secrets."
  }
  else {
    Write-Host "Using existing .env; it was not modified."
  }

  if (-not $SkipInstall) {
    & npm ci
    Assert-LastCommand -Description "Dependency installation"
  }

  if (-not $SkipDocker) {
    Assert-Command -Name "docker"
    & docker compose up -d postgres
    Assert-LastCommand -Description "Starting PostgreSQL"

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
      & docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' *> $null
      if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
      }
      Start-Sleep -Seconds 1
    }
    if (-not $ready) {
      throw "PostgreSQL did not become ready. Run: docker compose logs postgres"
    }
    Write-Host "PostgreSQL is ready."
  }

  & npm run db:generate
  Assert-LastCommand -Description "Prisma Client generation"

  if (-not $SkipMigrate) {
    & npm run db:migrate:deploy
    Assert-LastCommand -Description "Database migration"
  }

  if ($Seed) {
    if (
      [string]::IsNullOrWhiteSpace($env:SEED_ADMIN_EMAIL) -or
      [string]::IsNullOrWhiteSpace($env:SEED_ADMIN_PASSWORD)
    ) {
      throw "-Seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in the current environment."
    }
    & npm run db:seed
    Assert-LastCommand -Description "Database seed"
  }
  else {
    Write-Host "Seed skipped. Pass -Seed after setting SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD."
  }

  Write-Host "Setup complete. Start the app with: npm run dev"
}
finally {
  Pop-Location
}
