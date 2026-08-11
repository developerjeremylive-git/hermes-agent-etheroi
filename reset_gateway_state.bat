@echo off
rem ============================================================================
rem Hermes Desktop - Reset Gateway Connection State
rem ============================================================================
rem This script resets the state so Hermes Desktop will show the "Connect to
rem existing Hermes" screen instead of trying to auto-detect a local backend.
rem ============================================================================

echo.
echo ============================================================================
echo Hermes Desktop Gateway Connection Reset
echo ============================================================================
echo.

rem 1. Ensure no hermes-agent subfolder exists (prevents local backend detection)
echo Checking for hermes-agent subfolder...
if exist "%LOCALAPPDATA%\hermes\hermes-agent" (
    echo Found hermes-agent subfolder - removing it...
    rmdir /s /q "%LOCALAPPDATA%\hermes\hermes-agent"
    echo Removed hermes-agent subfolder.
) else (
    echo hermes-agent subfolder does not exist - good.
)

rem 2. Remove bootstrap marker if it exists
echo Checking for bootstrap marker...
if exist "%LOCALAPPDATA%\hermes\hermes-agent\.hermes-bootstrap-complete" (
    echo Found bootstrap marker - removing it...
    del "%LOCALAPPDATA%\hermes\hermes-agent\.hermes-bootstrap-complete"
    echo Removed bootstrap marker.
) else (
    echo Bootstrap marker does not exist - good.
)

rem 3. Clear Hermes env vars that might cause auto-detection
echo Clearing Hermes environment variables...
set HERMES_HOME=
set HERMES_DESKTOP_HERMES_ROOT=
set HERMES_DESKTOP_HERMES=

rem 4. Clear any cached state
echo Clearing cached state...
if exist "%LOCALAPPDATA%\hermes\cache" (
    echo Found cache directory - cleaning...
    del /f /s "%LOCALAPPDATA%\hermes\cache\*.tmp" 2>nul
    echo Cache cleaned.
)

rem 5. Provide instructions
echo.
echo ============================================================================
echo Instructions:
echo ============================================================================
echo 1. Close Hermes Desktop if it's running.
echo 2. Double-click the Hermes Desktop shortcut on your Desktop.
echo 3. The "Connect to existing Hermes" screen should now appear.
echo 4. Enter your gateway URL to test the connection.
echo.
echo The gateway URL typically has one of these formats:
echo   ws://your-gateway-host:8188
echo   wss://your-gateway-host:8188
echo   http://your-gateway-host:3000 (if using HTTP polling)
echo.
echo ============================================================================
echo Done. Press any key to close...
echo ============================================================================
pause >nul