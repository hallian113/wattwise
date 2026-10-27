@echo off
REM Starts the WattWise backend and dashboard on http://localhost:8000/dashboard
cd /d %~dp0
call venv\Scripts\activate
uvicorn app.main:app --port 8000
pause
