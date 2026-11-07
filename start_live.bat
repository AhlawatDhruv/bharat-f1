@echo off
title Bharat F1 Live Tunnel Server
set ELECTRON_RUN_AS_NODE=1
set PORT=8080

echo ========================================================
echo   Starting Bharat F1 Local Web Server on port %PORT%...
echo ========================================================
start /b "" "C:\Users\Dell15\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe" "%~dp0server.js"

echo Waiting 2 seconds for server to initialize...
timeout /t 2 /nobreak >nul

echo ========================================================
echo   Starting Cloudflare Tunnel (HTTP/2 TCP mode)...
echo ========================================================
"%~dp0cloudflared.exe" tunnel --protocol http2 --url http://127.0.0.1:8080 --logfile "%~dp0cloudflared.log"
