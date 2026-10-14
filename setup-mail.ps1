# One-time setup for automatic class emails.
#
# Run this yourself in a terminal:    powershell -File setup-mail.ps1
#
# It prompts for your IDPL password and stores it encrypted with Windows DPAPI,
# which ties the file to your Windows account on this machine - nobody else can
# read it, and it never goes near the git repo.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgPath  = Join-Path $here 'mail.config.json'
$credPath = Join-Path $here 'mail.cred.xml'

if (-not (Test-Path $cfgPath)) {
    Write-Host ""
    Write-Host "mail.config.json not found." -ForegroundColor Yellow
    Write-Host "Copy mail.config.example.json to mail.config.json, put your 6 addresses"
    Write-Host "in the 'recipients' list, then run this script again."
    Write-Host ""
    exit 1
}

$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$from = $cfg.from

Write-Host ""
Write-Host "Setting up automatic class email for: $from"
Write-Host "Mail server: $($cfg.smtpHost)"
Write-Host ""
Write-Host "Use an APP PASSWORD here, not your normal password." -ForegroundColor Cyan

if ($cfg.smtpHost -match 'gmail') {
    Write-Host "  Gmail: turn on 2-Step Verification first, then generate one at"
    Write-Host "         https://myaccount.google.com/apppasswords"
    Write-Host "         It looks like 16 letters; spaces in it do not matter."
}
elseif ($cfg.smtpHost -match 'yahoo') {
    Write-Host "  Yahoo: generate one at https://myaccount.yahoo.com/security"
    Write-Host "         under 'How you sign in to Yahoo' > Generate app password."
}
else {
    Write-Host "  This host may require your IT department to allow Authenticated SMTP."
}

Write-Host ""
Write-Host "Nothing you type here is shown on screen or written anywhere in plain text."
Write-Host ""

$cred = Get-Credential -UserName $from -Message "Password for $from"
$cred | Export-Clixml -Path $credPath

Write-Host ""
Write-Host "Saved, encrypted, to mail.cred.xml" -ForegroundColor Green
Write-Host "Now send yourself a test:    npm run test-mail"
Write-Host ""
