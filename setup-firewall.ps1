# Script to configure Windows Firewall for StreamLand backend
# Run this in PowerShell as Administrator

Write-Host "🔥 Configuring Windows Firewall for StreamLand..." -ForegroundColor Cyan

# Allow port 4000 (Backend API + WebSocket)
New-NetFirewallRule -DisplayName "StreamLand Backend - Port 4000" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 4000 `
  -Action Allow `
  -Profile Any `
  -Description "Allow connections to StreamLand backend server on port 4000"

# Allow port 3000 (Frontend Next.js)
New-NetFirewallRule -DisplayName "StreamLand Frontend - Port 3000" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Any `
  -Description "Allow connections to StreamLand frontend on port 3000"

Write-Host "✅ Firewall rules added successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Find your IP: ipconfig (look for IPv4 Address)" -ForegroundColor White
Write-Host "2. Update frontend\.env.local with your IP" -ForegroundColor White
Write-Host "3. Restart both frontend and backend servers" -ForegroundColor White
