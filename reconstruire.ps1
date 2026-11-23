<#
    reconstruire.ps1

    Enchaîne en une seule commande :
        1. reconstruction de l'image mon-app-multistage:1.0
        2. suppression puis recréation du conteneur mon-app (port 8080)
        3. attente que le conteneur soit "healthy" (ou réponde 200)
        4. lancement de verifier-readme.ps1 pour voir les chiffres périmés

    Usage (PowerShell, à la racine du projet) :
        powershell -NoProfile -ExecutionPolicy Bypass -File .\reconstruire.ps1

    Codes de sortie :
        0 = rebuild réussi et README à jour
        1 = rebuild réussi mais au moins un écart dans le README
        autre = code d'erreur de Docker (le build ou le run a échoué)
#>
[CmdletBinding()]
param(
    [string]$Image = "mon-app-multistage:1.0",
    [string]$Conteneur = "mon-app",
    [int]$Port = 8080,
    [string]$Url = "http://localhost:8080",
    [string]$Verificateur,
    [string]$Readme
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$dossier = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not $Verificateur) { $Verificateur = Join-Path $dossier "verifier-readme.ps1" }

function Etape {
    param([string]$Numero, [string]$Texte)
    Write-Host ""
    Write-Host "[$Numero] $Texte" -ForegroundColor Cyan
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker introuvable : lance ce script là où Docker Desktop est installé." -ForegroundColor Red
    exit 2
}

if (-not (Test-Path -LiteralPath $Verificateur)) {
    Write-Host "Script de vérification introuvable : $Verificateur" -ForegroundColor Red
    exit 2
}

# ------------------------------------------------------------------ 1. construction
Etape "1/4" "Construction de l'image $Image"
& docker build -t $Image $dossier
if ($LASTEXITCODE -ne 0) {
    Write-Host "Échec de 'docker build' (code $LASTEXITCODE) : le conteneur existant n'a pas été touché." -ForegroundColor Red
    exit $LASTEXITCODE
}

# ------------------------------------------------- 2. recréation du conteneur mon-app
Etape "2/4" "Recréation du conteneur $Conteneur sur le port $Port"
$existe = $false
try {
    & docker inspect -f '{{.Id}}' $Conteneur *> $null
    $existe = ($LASTEXITCODE -eq 0)
} catch {
    $existe = $false
}

if ($existe) {
    Write-Host "Suppression de l'ancien conteneur $Conteneur" -ForegroundColor DarkGray
    & docker rm -f $Conteneur | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Impossible de supprimer le conteneur $Conteneur (code $LASTEXITCODE)." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

& docker run -d --name $Conteneur -p "${Port}:80" $Image | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Échec de 'docker run' (code $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

# ------------------------------------------------------- 3. attente de disponibilité
Etape "3/4" "Attente que $Conteneur réponde"
$limite = (Get-Date).AddSeconds(60)
$pret = $false
$etat = "inconnu"

while ((Get-Date) -lt $limite) {
    $etat = (& docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}aucun-healthcheck{{end}}' $Conteneur 2>$null)
    if ($etat -eq "healthy") { $pret = $true; break }

    if ($etat -eq "aucun-healthcheck" -or $etat -eq "none") {
        try {
            $reponse = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 2
            if ([int]$reponse.StatusCode -eq 200) { $etat = "HTTP 200"; $pret = $true; break }
        } catch { }
    }

    if ($etat -eq "unhealthy") { break }
    Start-Sleep -Seconds 2
}

if (-not $pret) {
    Write-Host "Le conteneur n'est pas prêt (état : $etat). Dernières lignes du journal :" -ForegroundColor Red
    & docker logs --tail 20 $Conteneur
    exit 1
}

Write-Host "Conteneur prêt (état : $etat)." -ForegroundColor Green

# ------------------------------------------------ 4. comparaison README / conteneur
Etape "4/4" "Comparaison du README avec le conteneur"
$arguments = @{ Image = $Image; Conteneur = $Conteneur; Url = $Url }
if ($Readme) { $arguments['Readme'] = $Readme }
& $Verificateur @arguments
$codeVerification = $LASTEXITCODE

Write-Host ""
if ($codeVerification -eq 0) {
    Write-Host "Rebuild terminé : README à jour." -ForegroundColor Green
}
else {
    Write-Host "Rebuild terminé : mets à jour la section 11 du README, puis relance verifier-readme.ps1." -ForegroundColor Yellow
}

exit $codeVerification
