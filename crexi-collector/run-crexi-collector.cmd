@echo off
cd /d "%~dp0"
npm run collect >> collector.log 2>&1
