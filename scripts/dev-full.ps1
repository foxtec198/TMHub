$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path (Split-Path -Parent $frontendRoot) 'api_tmhub'
$apiPython = Join-Path $apiRoot 'venv\Scripts\python.exe'
$apiProcess = $null

if (-not (Test-Path -LiteralPath $apiPython)) {
    throw "Python da API não encontrado em: $apiPython"
}

$apiListening = Get-NetTCPConnection -LocalPort 8590 -State Listen -ErrorAction SilentlyContinue
if (-not $apiListening) {
    Write-Host 'Iniciando API em modo desenvolvimento na porta 8590...' -ForegroundColor Cyan
    $apiProcess = Start-Process -FilePath $apiPython `
        -ArgumentList @('app.py') `
        -WorkingDirectory $apiRoot `
        -WindowStyle Hidden `
        -PassThru
}
else {
    Write-Host 'Usando a API já aberta na porta 8590.' -ForegroundColor DarkGray
}

try {
    Write-Host 'Iniciando frontend Vite...' -ForegroundColor Green
    Push-Location $frontendRoot
    & npm.cmd run dev
}
finally {
    Pop-Location
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Write-Host 'Encerrando a API iniciada por este script...' -ForegroundColor DarkGray
        Stop-Process -Id $apiProcess.Id -Force
    }
}
