@echo off
echo ========================================
echo   Courtify - First Time Setup
echo ========================================
echo.

echo [1/4] Installing root dependencies...
call npm install
echo.

echo [2/4] Installing backend dependencies...
cd apps\backend
call npm install
echo.

echo [3/4] Generating Prisma client...
call npx prisma generate
echo.

echo [4/4] Creating database and running migrations...
call npx prisma db push
echo.
cd ..\..

echo.
echo [OPTIONAL] Installing frontend dependencies...
cd apps\frontend
call npm install
cd ..\..

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Database: apps\backend\prisma\dev.db (SQLite)
echo.
echo No demo data or test accounts are created.
echo Create an administrator account before using the system.
echo Next: Run 'dev.bat' to start development servers
echo.
pause
