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

# Read-Host keeps the prompt inline in this console. Get-Credential would pop a
# separate Windows dialog, which can open behind the window or fail outright when
# there is no interactive input attached.
$secure = Read-Host -Prompt "App password for $from (typing is hidden)" -AsSecureString

if (-not $secure -or $secure.Length -eq 0) {
    Write-Host ""
    Write-Host "No password entered - nothing was saved." -ForegroundColor Yellow
    exit 1
}

# Gmail displays app passwords in four blocks of four; the spaces are cosmetic
# and must not be sent to the server.
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$plain = $plain -replace '\s', ''

if ($plain.Length -lt 8) {
    Write-Host ""
    Write-Host "That looks too short to be an app password - nothing saved." -ForegroundColor Yellow
    Write-Host "Gmail app passwords are 16 characters."
    exit 1
}
if ($cfg.smtpHost -match 'gmail' -and $plain.Length -ne 16) {
    Write-Host ""
    Write-Host "Warning: Gmail app passwords are normally 16 characters; yours is $($plain.Length)." -ForegroundColor Yellow
    Write-Host "Saving anyway - if the test fails, generate a fresh one."
}

$clean = New-Object System.Security.SecureString
foreach ($ch in $plain.ToCharArray()) { $clean.AppendChar($ch) }
$clean.MakeReadOnly()
$plain = $null

$cred = New-Object System.Management.Automation.PSCredential($from, $clean)
$cred | Export-Clixml -Path $credPath

Write-Host ""
Write-Host "Saved, encrypted, to mail.cred.xml" -ForegroundColor Green
Write-Host "Now send yourself a test:    npm run test-mail"
Write-Host ""
