# Lấy mức dùng Claude (phiên 5 giờ + giới hạn tuần) rồi gửi lên Apps Script để dashboard hiển thị.
# Bản Windows của mac/claude_usage.sh. Task Scheduler gọi 10 phút/lần (cài bằng install.ps1).
# Lưu ý: địa chỉ lấy số liệu là địa chỉ nội bộ Claude Code dùng, chưa công bố — có thể ngừng chạy bất cứ lúc nào.
# Chạy thử không gửi đi:  powershell -ExecutionPolicy Bypass -File claude_usage.ps1 -DryRun

param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Dir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $Dir 'claude_usage.log'
$Stamp   = Join-Path $Dir '.last_refresh'
$UrlFile = Join-Path $env:USERPROFILE '.kindle-dashboard-url'      # chứa DATA_URL (link Web app + ?token=...)
$CredFile = Join-Path $env:USERPROFILE '.claude\.credentials.json'  # Claude Code lưu đăng nhập ở đây

function Write-Log($msg) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $msg
  if ($DryRun) { Write-Output $line }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  $all = Get-Content $LogFile -Encoding UTF8
  if ($all.Count -gt 500) { $all | Select-Object -Last 500 | Set-Content $LogFile -Encoding UTF8 }
}

function Get-ClaudeToken {
  if (-not (Test-Path $CredFile)) { return $null }
  try { return (Get-Content $CredFile -Raw -Encoding UTF8 | ConvertFrom-Json).claudeAiOauth.accessToken } catch { return $null }
}

# Trả về @{ Code = 200; Body = '...' }
function Get-Usage($token) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri 'https://api.anthropic.com/api/oauth/usage' -Headers @{
      'Authorization'  = "Bearer $token"
      'anthropic-beta' = 'oauth-2025-04-20'
      'Content-Type'   = 'application/json'
    }
    # đọc đúng UTF-8
    $body = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    return @{ Code = [int]$r.StatusCode; Body = $body }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ Code = $code; Body = '' }
  }
}

$dataUrl = $null
if (Test-Path $UrlFile) { $dataUrl = (Get-Content $UrlFile -Raw).Trim() }
if (-not $dataUrl -and -not $DryRun) { Write-Log "Thiếu file $UrlFile (chạy lại install.ps1)"; exit 1 }

$token = Get-ClaudeToken
if (-not $token) { Write-Log 'Không đọc được token Claude Code. Mở cửa sổ lệnh, gõ: claude  rồi đăng nhập.'; exit 1 }

$res = Get-Usage $token

# Token hết hạn → chạy Claude Code 1 lệnh ngắn để nó tự làm mới token (tối đa 1 lần/giờ)
if ($res.Code -eq 401) {
  $old = (Test-Path $Stamp) -and (((Get-Date) - (Get-Item $Stamp).LastWriteTime).TotalMinutes -lt 60)
  if (-not $old) {
    Set-Content $Stamp ''
    Write-Log 'Token hết hạn, làm mới bằng claude -p'
    $claudeExe = (Get-Command claude -ErrorAction SilentlyContinue).Source
    if (-not $claudeExe) { $claudeExe = Join-Path $env:USERPROFILE '.local\bin\claude.exe' }
    try { & $claudeExe -p 'ok' --max-turns 1 *> $null } catch {}
    $token = Get-ClaudeToken
    $res = Get-Usage $token
  }
}

if ($res.Code -ne 200) { Write-Log "Lấy mức dùng thất bại (HTTP $($res.Code))"; exit 1 }

if ($DryRun) {
  $u = $res.Body | ConvertFrom-Json
  Write-Output ('Phiên 5 giờ: ' + $u.five_hour.utilization + '%  (reset ' + $u.five_hour.resets_at + ')')
  Write-Output ('Tuần:        ' + $u.seven_day.utilization + '%  (reset ' + $u.seven_day.resets_at + ')')
  Write-Output 'DryRun: không gửi lên Apps Script.'
  exit 0
}

try {
  $bytes = [Text.Encoding]::UTF8.GetBytes($res.Body)
  $post = Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Method Post -Uri $dataUrl `
          -ContentType 'application/json; charset=utf-8' -Body $bytes
  if ($post.Content -match '"ok":\s*true') {
    $short = ($res.Body -replace '\s', '')
    Write-Log ('OK ' + $short.Substring(0, [Math]::Min(160, $short.Length)))
  } else {
    Write-Log ('Gửi lên Apps Script lỗi: ' + $post.Content.Substring(0, [Math]::Min(160, $post.Content.Length)))
  }
} catch {
  Write-Log ('Gửi lên Apps Script lỗi: ' + $_.Exception.Message)
}
