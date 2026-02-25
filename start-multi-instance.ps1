# StreamLand Multi-Instance Setup Script

Write-Host "🚀 Starting StreamLand Multi-Instance Architecture..." -ForegroundColor Cyan

# Start Redis
Write-Host "`n📦 Starting Redis..." -ForegroundColor Yellow
docker-compose up -d redis

# Wait for Redis
Start-Sleep -Seconds 3

# Start Backend Instance 1 on port 4000
Write-Host "`n🟢 Starting Backend Instance 1 (Port 4000)..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd backend; $env:PORT=4000; $env:REDIS_URL='redis://localhost:6379'; $env:REDIS_PASSWORD='streamland123'; npm run start:dev"

# Wait a bit
Start-Sleep -Seconds 2

# Start Backend Instance 2 on port 4001
Write-Host "`n🟢 Starting Backend Instance 2 (Port 4001)..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd backend; $env:PORT=4001; $env:REDIS_URL='redis://localhost:6379'; $env:REDIS_PASSWORD='streamland123'; npm run start:dev"

Write-Host "`n✅ Multi-Instance Setup Complete!" -ForegroundColor Green
Write-Host "`nInstances running on:" -ForegroundColor Cyan
Write-Host "  - Instance 1: http://localhost:4000" -ForegroundColor White
Write-Host "  - Instance 2: http://localhost:4001" -ForegroundColor White
Write-Host "`nRedis running on: localhost:6379" -ForegroundColor White
Write-Host "`nTest cross-instance communication by connecting to different ports!" -ForegroundColor Yellow
