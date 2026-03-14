@echo off
echo 🚀 Starting FoodSave Application...
echo.

echo 📦 Checking Backend...
cd /d "%~dp0backend"
if exist venv\Scripts\activate.bat (
    echo ✅ Backend virtual environment found
    call venv\Scripts\activate.bat
    echo 🔧 Starting Django backend server...
    start "Django Backend" cmd /k "python manage.py runserver"
    echo ✅ Backend started on http://localhost:8000
) else (
    echo ❌ Backend virtual environment not found!
    echo Please run: cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
    pause
    exit /b
)

echo.
echo 🌐 Checking Frontend...
cd /d "%~dp0frontend"
if exist node_modules (
    echo ✅ Frontend dependencies found
    echo 🔧 Starting React frontend server...
    start "React Frontend" cmd /k "npm start"
    echo ✅ Frontend starting on http://localhost:3000
) else (
    echo ❌ Frontend dependencies not found!
    echo Please run: cd frontend && npm install
    pause
    exit /b
)

echo.
echo 🎉 FoodSave is starting up!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:8000
echo 👑 Admin:     http://localhost:8000/admin
echo.
echo 🍲 Demo Credentials:
echo    Donor:     donor@example.com / password123
echo    NGO:       ngo@example.com / password123  
echo    Volunteer:  volunteer@example.com / password123
echo    Admin:      admin@example.com / password123
echo.
echo Press any key to open the application in your browser...
pause > nul
start http://localhost:3000

echo.
echo ✨ FoodSave is running! Keep this window open to keep servers running.
echo Close this window to stop both servers.
pause
