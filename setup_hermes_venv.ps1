# Activate venv and install hermes in editable mode
$pythonPath = "C:\Users\Jerem\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
& $pythonPath -m pip install -e ".[all]" 2>&1
Write-Host "Installation complete"