# Cài job lấy mức dùng Claude trên Windows: chạy 10 phút/lần bằng Task Scheduler (không cần quyền Admin).
# Cách dùng (PowerShell):  powershell -ExecutionPolicy Bypass -File install.ps1
# Gỡ:                      Unregister-ScheduledTask -TaskName ClaudeUsageDashboard -Confirm:$false

$ErrorActionPreference = 'Stop'
$Dir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script  = Join-Path $Dir 'claude_usage.ps1'
$UrlFile = Join-Path $env:USERPROFILE '.kindle-dashboard-url'
$Task    = 'ClaudeUsageDashboard'

if (-not (Test-Path $UrlFile) -or -not (Get-Content $UrlFile -Raw).Trim()) {
  Write-Output 'Copy DATA_URL (link Web app Apps Script + ?token=...) rồi chỉ cần bấm Enter: script tự đọc từ clipboard.'
  $sec = Read-Host 'DATA_URL (hoặc dán vào, chữ không hiện)' -AsSecureString
  $url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  if (-not $url -or -not $url.Trim()) { $url = (Get-Clipboard | Out-String) }
  $url = $url -replace '\s', ''
  if ($url -notmatch '^https://script\.google\.com/macros/s/.+/exec\?token=.+') {
    Write-Output 'Link không đúng dạng https://script.google.com/macros/s/.../exec?token=... — copy lại rồi chạy lại install.ps1.'
    exit 1
  }
  Write-Output ('Đã nhận: ' + ($url -replace '(/macros/s/.{6}).*(/exec).*', '$1…$2?token=****'))
  Set-Content -Path $UrlFile -Value $url -NoNewline -Encoding ASCII
  # chỉ tài khoản Windows của bạn đọc được file này
  icacls $UrlFile /inheritance:r /grant:r "$($env:USERNAME):F" | Out-Null
}

# Chạy ẩn cửa sổ, 10 phút/lần, và chạy luôn khi đăng nhập Windows
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Script`""
$triggers = @(
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)),
  (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME)
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Task -Action $action -Trigger $triggers -Settings $settings `
  -Description 'Gửi mức dùng Claude lên dashboard iPad' -Force | Out-Null

Write-Output "Đã cài job '$Task'. Chạy thử ngay:"
& powershell -NoProfile -ExecutionPolicy Bypass -File $Script
Get-Content (Join-Path $Dir 'claude_usage.log') -Tail 3 -Encoding UTF8
