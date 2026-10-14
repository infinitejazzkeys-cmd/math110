# Send the email drafted by notify.mjs to the class.
#
# Runs as the last step of `npm run publish-site`. Exits quietly (success) when
# email isn't configured or there's nothing to send, so publishing never breaks
# just because mail isn't set up.
#
#   -TestOnly   send to yourself only, ignoring the recipient list
#   -DryRun     show what would be sent, send nothing

param(
    [switch]$TestOnly,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$cfgPath   = Join-Path $here 'mail.config.json'
$credPath  = Join-Path $here 'mail.cred.xml'
$draftPath = Join-Path $here 'email-draft.txt'

# --- nothing to do? bow out quietly -------------------------------------
if (-not (Test-Path $draftPath)) {
    Write-Host "No email draft to send."
    exit 0
}
if (-not (Test-Path $cfgPath)) {
    Write-Host "Email not configured (no mail.config.json) - draft left in email-draft.txt."
    exit 0
}
if (-not (Test-Path $credPath)) {
    Write-Host "Email password not set up yet - run:  powershell -File setup-mail.ps1"
    Write-Host "Draft left in email-draft.txt."
    exit 0
}

$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

# --- split the draft into subject + body --------------------------------
$draft = Get-Content $draftPath -Raw
$lines = $draft -split "`r?`n"
if ($lines[0] -notmatch '^Subject:\s*(.+)$') {
    Write-Host "email-draft.txt is malformed (no Subject line) - not sending." -ForegroundColor Yellow
    exit 0
}
$subject = $Matches[1].Trim()
$body = ($lines[1..($lines.Length - 1)] -join "`r`n").TrimStart("`r", "`n")

# --- who gets it --------------------------------------------------------
$recipients = @()
if (-not $TestOnly) {
    foreach ($r in $cfg.recipients) {
        if ($r -and $r -notmatch 'example\.(com|edu|org)$') { $recipients += $r }
    }
}

Write-Host ""
Write-Host "From:    $($cfg.from)"
Write-Host "To:      $($cfg.from)"
if ($TestOnly) {
    Write-Host "Bcc:     (test mode - no class recipients)"
} else {
    Write-Host "Bcc:     $($recipients.Count) recipient(s)"
}
Write-Host "Subject: $subject"

if ($DryRun) {
    Write-Host ""
    Write-Host "--- dry run, nothing sent ---" -ForegroundColor Yellow
    Write-Host $body
    exit 0
}

if (-not $TestOnly -and $recipients.Count -eq 0) {
    Write-Host ""
    Write-Host "No real recipients in mail.config.json (still the example addresses?)." -ForegroundColor Yellow
    Write-Host "Nothing sent."
    exit 0
}

# --- send ---------------------------------------------------------------
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$cred = Import-Clixml -Path $credPath
$msg = New-Object System.Net.Mail.MailMessage
$smtp = $null

try {
    $msg.From = New-Object System.Net.Mail.MailAddress($cfg.from)
    $msg.To.Add($cfg.from)                       # a copy for your own records
    foreach ($r in $recipients) { $msg.Bcc.Add($r) }   # BCC: students never see each other
    $msg.Subject = $subject
    $msg.Body = $body
    $msg.IsBodyHtml = $false

    $smtp = New-Object System.Net.Mail.SmtpClient($cfg.smtpHost, [int]$cfg.smtpPort)
    $smtp.EnableSsl = $true
    $smtp.Credentials = New-Object System.Net.NetworkCredential(
        $cred.UserName, $cred.GetNetworkCredential().Password)

    $smtp.Send($msg)
    Write-Host ""
    Write-Host "Sent." -ForegroundColor Green
}
catch {
    $detail = $_.Exception.Message
    if ($_.Exception.InnerException) { $detail += " / " + $_.Exception.InnerException.Message }

    Write-Host ""
    Write-Host "Could not send the email." -ForegroundColor Red
    Write-Host $detail

    if ($detail -match '5\.7\.30|Basic authentication is not supported|SmtpAuthenticationDisabled|5\.7\.139') {
        Write-Host ""
        Write-Host "That error means IDPL has SMTP AUTH turned off for your mailbox." -ForegroundColor Yellow
        Write-Host "Ask IT to enable 'Authenticated SMTP' for $($cfg.from), or switch to"
        Write-Host "the paste-the-draft workflow - email-draft.txt is ready to send."
    }

    Write-Host ""
    Write-Host "The site published fine; only the email failed." -ForegroundColor Yellow
    Write-Host "Draft is in email-draft.txt if you want to send it by hand."
    exit 0   # don't fail the publish over a mail problem
}
finally {
    if ($msg) { $msg.Dispose() }
    if ($smtp) { $smtp.Dispose() }
}
