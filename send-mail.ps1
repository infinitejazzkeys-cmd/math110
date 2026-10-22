# Send the email drafted by notify.mjs to the class.
#
# Runs as the last step of `npm run publish-site`. Exits quietly (success) when
# email isn't configured or there's nothing to send, so publishing never breaks
# just because mail isn't set up.
#
#   -TestOnly   send to yourself only, ignoring the recipient list
#   -DryRun     show what would be sent, send nothing
#   -Announce   after sending, post the same message as an announcement on the
#               site (see announce.mjs). With -DryRun, previews it instead.

param(
    [switch]$TestOnly,
    [switch]$DryRun,
    [switch]$Announce
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$cfgPath   = Join-Path $here 'mail.config.json'
$credPath  = Join-Path $here 'mail.cred.xml'
$draftPath = Join-Path $here 'email-draft.txt'

# --- nothing to do? bow out quietly -------------------------------------
# A test is about proving the credentials work, so it must not depend on there
# being unpublished material lying around. Fall back to a sample message.
$usingSample = $false
if (-not (Test-Path $draftPath)) {
    if ($TestOnly -or $DryRun) {
        $usingSample = $true
    } else {
        Write-Host "No email draft to send."
        exit 0
    }
}
if (-not (Test-Path $cfgPath)) {
    Write-Host "Email not configured (no mail.config.json) - draft left in email-draft.txt."
    exit 0
}
if (-not $DryRun -and -not (Test-Path $credPath)) {
    Write-Host "Email password not set up yet - run:  powershell -File setup-mail.ps1"
    Write-Host "Draft left in email-draft.txt."
    exit 0
}

$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

if ($cfg.from -match 'FILL_IN_') {
    Write-Host ""
    Write-Host "mail.config.json still has placeholder values." -ForegroundColor Yellow
    Write-Host "Fill in 'from' (your new Gmail address) and 'recipients', then try again."
    Write-Host "Draft left in email-draft.txt."
    exit 0
}

# --- subject + body -----------------------------------------------------
if ($usingSample) {
    $subject = 'MATH 110 - test message'
    $body = @"
This is a test of the MATH 110 course site email setup.

If you are reading this, sending works: the site can now email the class
automatically whenever you post new material or an announcement.

Nothing was sent to your students - this message went only to you.

Course website: https://infinitejazzkeys-cmd.github.io/math110/
"@
} else {
    $draft = Get-Content $draftPath -Raw
    $lines = $draft -split "`r?`n"
    if ($lines[0] -notmatch '^Subject:\s*(.+)$') {
        Write-Host "email-draft.txt is malformed (no Subject line) - not sending." -ForegroundColor Yellow
        exit 0
    }
    $subject = $Matches[1].Trim()
    $body = ($lines[1..($lines.Length - 1)] -join "`r`n").TrimStart("`r", "`n")
}

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
    if ($Announce -and -not $usingSample) {
        & node (Join-Path $here 'announce.mjs') $draftPath --preview
    }
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
    if ($cfg.fromName) {
        $msg.From = New-Object System.Net.Mail.MailAddress($cfg.from, $cfg.fromName)
    } else {
        $msg.From = New-Object System.Net.Mail.MailAddress($cfg.from)
    }

    # Replies go to your real inbox, not the sending account's.
    if ($cfg.replyTo) { $msg.ReplyToList.Add($cfg.replyTo) }

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

    # Consume the draft so the same message can never go out twice. Tests and
    # dry runs leave it alone, and a failed send keeps it for manual sending.
    if (-not $TestOnly -and -not $usingSample) {
        $annCopy = $null
        if ($Announce) {
            $annCopy = Join-Path ([IO.Path]::GetTempPath()) 'math110-announcement.txt'
            Copy-Item $draftPath $annCopy -Force
        }
        if (Test-Path $draftPath) { Remove-Item $draftPath -Force }

        # Remember what we just told them about, so the next draft covers only
        # what has changed since - however many publishes that spans.
        $sha = & git -C $here rev-parse HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $sha) {
            Set-Content -Path (Join-Path $here '.last-emailed') -Value $sha.Trim() -Encoding ascii
        }

        # Post the same message on the site. announce.mjs moves .last-emailed
        # past its own commit, so the next email won't announce it again.
        if ($annCopy) {
            Write-Host ""
            Write-Host "Posting a matching announcement on the site..."
            & node (Join-Path $here 'announce.mjs') $annCopy
            Remove-Item $annCopy -Force -ErrorAction SilentlyContinue
        }
    }
}
catch {
    $detail = $_.Exception.Message
    if ($_.Exception.InnerException) { $detail += " / " + $_.Exception.InnerException.Message }

    Write-Host ""
    Write-Host "Could not send the email." -ForegroundColor Red
    Write-Host $detail

    if ($detail -match '5\.7\.0|535|Username and Password not accepted|authentication failed|BadCredentials') {
        Write-Host ""
        Write-Host "The mail server rejected your credentials." -ForegroundColor Yellow
        Write-Host "For Gmail and Yahoo this almost always means you used your normal"
        Write-Host "password instead of an APP PASSWORD. Gmail also requires 2-Step"
        Write-Host "Verification to be switched on before it will issue one."
        Write-Host "Generate a fresh app password, then re-run:  powershell -File setup-mail.ps1"
    }
    elseif ($detail -match '5\.7\.30|Basic authentication is not supported|SmtpAuthenticationDisabled|5\.7\.139') {
        Write-Host ""
        Write-Host "That error means the mail host has SMTP AUTH turned off for this mailbox." -ForegroundColor Yellow
        Write-Host "If you are on the IDPL account, switching to a dedicated Gmail avoids"
        Write-Host "needing anything from IDPL's IT staff - see README."
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
