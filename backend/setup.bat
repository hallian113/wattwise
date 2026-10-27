@echo off
REM One-time setup: creates the virtual environment and installs the packages.
cd /d %~dp0
py -3.13 -m venv venv
if errorlevel 1 py -3 -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo Done. Now open backend\.env and put your PostgreSQL password in DATABASE_URL.
pause
