@echo off
setlocal
cd /d "%~dp0"

title TechChat - Demo portatil
set "NODE_VERSION=22.13.0"
set "NODE_DIR=%~dp0.node-portable\node-v%NODE_VERSION%-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"

if not exist "%NODE_EXE%" (
  echo Baixando o Node.js portatil pela primeira vez...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $zip=Join-Path $env:TEMP 'techchat-node-portable.zip'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.13.0/node-v22.13.0-win-x64.zip' -OutFile $zip; Expand-Archive -Path $zip -DestinationPath '%~dp0.node-portable' -Force; Remove-Item $zip -Force"
  if errorlevel 1 (
    echo.
    echo Nao foi possivel baixar o Node.js portatil.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Preparando a demo pela primeira vez...
  call "%NODE_DIR%\npm.cmd" install
  if errorlevel 1 (
    echo.
    echo Nao foi possivel preparar a demo.
    pause
    exit /b 1
  )
)

start "TechChat - Servidor" /D "%~dp0" cmd /k "set PATH=%NODE_DIR%;%~dp0node_modules\.bin;%PATH%&& npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
