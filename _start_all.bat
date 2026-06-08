@echo off
cd /d C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock
start /B "NextJS" .\node_modules\.bin\next start --port 3002
timeout /t 5 /nobreak > NUL
start /B "Ngrok" ngrok http 3002 --log=stdout
timeout /t 3 /nobreak > NUL
echo === Next.js on port 3002, ngrok URL below ===
curl -s http://127.0.0.1:4041/api/tunnels
echo.
echo === Done ===
