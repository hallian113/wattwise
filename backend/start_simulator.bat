@echo off
REM Starts the simulator. Extra options can follow, for example:
REM    start_simulator.bat --speed 20 --start 18:30
REM    start_simulator.bat --scenario projector
cd /d %~dp0
call venv\Scripts\activate
python simulator\simulate.py --scenario laptop %*
pause
