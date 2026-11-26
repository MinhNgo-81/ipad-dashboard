# Cài job lấy mức dùng Claude trên Windows: chạy 10 phút/lần bằng Task Scheduler (không cần quyền Admin).
# Cách dùng (PowerShell):  powershell -ExecutionPolicy Bypass -File install.ps1
# Gỡ:                      Unregister-ScheduledTask -TaskName ClaudeUsageDashboard -Confirm:$false

$ErrorActionPreference = 'Stop'
$Dir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script  = Join-Path $Dir 'claude_usage.ps1'
$UrlFile = Join-Path $env:USERPROFILE '.kindle-dashboard-url'
$Task    = 'ClaudeUsageDashboard'

if (-not (Test-Path $UrlFile) -or -not (Get-Content $UrlFile -Raw).Trim()) {
  $sec = Read-Host 'Dán DATA_URL (link Web app Apps Script + ?token=...) rồi Enter' -AsSecureString
  $url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  Set-Content -Path $UrlFile -Value ($url -replace '\s', '') -NoNewline -Encoding ASCII
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
