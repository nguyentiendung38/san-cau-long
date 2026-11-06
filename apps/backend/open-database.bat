@echo off
setlocal

set "DATABASE_FILE=%~dp0prisma\dev.db"
set "DB_BROWSER=%ProgramFiles%\DB Browser for SQLite\DB Browser for SQLite.exe"

if not exist "%DB_BROWSER%" set "DB_BROWSER=%ProgramFiles(x86)%\DB Browser for SQLite\DB Browser for SQLite.exe"

if not exist "%DB_BROWSER%" (
    echo DB Browser for SQLite was not found in Program Files.
    echo Edit this script and set DB_BROWSER to the installed application path.
    exit /b 1
)

if not exist "%DATABASE_FILE%" (
    echo Database file was not found: "%DATABASE_FILE%"
    exit /b 1
)

start "" "%DB_BROWSER%" "%DATABASE_FILE%"
