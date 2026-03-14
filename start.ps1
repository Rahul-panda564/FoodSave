# FoodSave Application Startup Script
Write-Host "🚀 Starting FoodSave Application..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "📦 Checking Backend..." -ForegroundColor Blue
Set-Location backend
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "✅ Backend virtual environment found" -ForegroundColor Green
    & .\venv\Scripts\Activate.ps1
    Write-Host "🔧 Starting Django backend server..." -ForegroundColor Yellow
    Start-Job -Name "DjangoBackend" -ScriptBlock {
        python manage.py runserver
    }
    Write-Host "✅ Backend started on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "❌ Backend virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run: cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit
}

Write-Host ""

# Start Frontend
Write-Host "🌐 Checking Frontend..." -ForegroundColor Blue
Set-Location ..\frontend
if (Test-Path "node_modules") {
    Write-Host "✅ Frontend dependencies found" -ForegroundColor Green
    Write-Host "🔧 Starting React frontend server..." -ForegroundColor Yellow
    Start-Job -Name "ReactFrontend" -ScriptBlock {
        npm start
    }
    Write-Host "✅ Frontend starting on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend dependencies not found!" -ForegroundColor Red
    Write-Host "Please run: cd frontend && npm install" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit
}

Write-Host ""
Write-Host "🎉 FoodSave is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "👑 Admin:     http://localhost:8000/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "🍲 Demo Credentials:" -ForegroundColor Yellow
Write-Host "   Donor:     donor@example.com / password123" -ForegroundColor White
Write-Host "   NGO:       ngo@example.com / password123" -ForegroundColor White
Write-Host "   Volunteer:  volunteer@example.com / password123" -ForegroundColor White
Write-Host "   Admin:      admin@example.com / password123" -ForegroundColor White
Write-Host ""

# Wait a moment for servers to start
Start-Sleep -Seconds 5

# Open browser
Write-Host "🌐 Opening application in browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "✨ FoodSave is running! Keep this window open to keep servers running." -ForegroundColor Green
Write-Host "Close this window to stop both servers." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the application..." -ForegroundColor Red

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "🛑 Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Name "DjangoBackend" -ErrorAction SilentlyContinue
    Stop-Job -Name "ReactFrontend" -ErrorAction SilentlyContinue
    Write-Host "✅ Servers stopped." -ForegroundColor Green
}
