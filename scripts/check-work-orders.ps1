$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot

function Invoke-CheckStep {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "==> $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

Push-Location $workspaceRoot
try {
    Invoke-CheckStep 'Root lint' { npm run lint }
    Invoke-CheckStep 'Work-order UI typecheck' { npm --workspace apps/web run typecheck }
    Push-Location (Join-Path $workspaceRoot 'apps/java-api')
    try {
        Invoke-CheckStep 'Java API verification' { & .\mvnw.cmd -Plocal verify }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}
