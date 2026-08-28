@echo off

start "mySim Backend" cmd /k "%~dp0run_backend.bat"
start "mySim Frontend" cmd /k "%~dp0run_frontend.bat"

exit