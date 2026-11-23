<#
    verifier-readme.ps1

    Compare les chiffres annoncés dans le README avec l'état réel du conteneur mon-app :
    taille de l'image, noms et tailles des fichiers servis, Content-Length, version de Nginx.

    Usage (PowerShell, à la racine du projet) :
        powershell -NoProfile -ExecutionPolicy Bypass -File .\verifier-readme.ps1

    Codes de sortie :
        0 = tout correspond
        1 = au moins un écart (le README est périmé)
        2 = impossible de comparer (conteneur arrêté, README absent, Docker indisponible)
#>
[CmdletBinding()]
param(
    [string]$Readme,
    [string]$Image = "mon-app-multistage:1.0",
    [string]$Conteneur = "mon-app",
    [string]$Url = "http://localhost:8080",
    [string]$Capture
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# $PSScriptRoot peut être vide selon la façon dont le script est lancé :
# on retombe alors sur le dossier courant.
$dossier = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not $Readme) {
    $Readme = Join-Path $dossier "README.md"
}
$resultats = New-Object 'System.Collections.Generic.List[object]'

function Ajouter-Resultat {
    param([string]$Libelle, [string]$Attendu, [string]$Reel, [bool]$Ok)
    $resultats.Add([pscustomobject]@{
            Libelle = $Libelle
            Attendu = $Attendu
            Reel    = $Reel
            Ok      = $Ok
        })
}

function Sans-Espaces {
    param([string]$Texte)
    return ($Texte -replace '[\s\u00A0\u202F]', '')
}

# Convertit une taille (valeur + unité) en mégaoctets.
function En-Mo {
    param([double]$Valeur, [string]$Unite)
    switch ($Unite.ToUpperInvariant()) {
        "GB" { return $Valeur * 1024 }
        "GO" { return $Valeur * 1024 }
        "KB" { return $Valeur / 1024 }
        "KO" { return $Valeur / 1024 }
        default { return $Valeur }
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker introuvable : ce script doit tourner là où Docker Desktop est installé." -ForegroundColor Red
    exit 2
}

if (-not (Test-Path -LiteralPath $Readme)) {
    Write-Host "README introuvable : $Readme" -ForegroundColor Red
    exit 2
}

$texte = Get-Content -LiteralPath $Readme -Raw -Encoding UTF8

# Le conteneur doit tourner : sans lui, aucun chiffre n'est vérifiable.
$enMarche = $false
try {
    $enMarche = ((& docker inspect -f '{{.State.Running}}' $Conteneur 2>$null) -eq "true")
} catch {
    $enMarche = $false
}
if (-not $enMarche) {
    Write-Host "Le conteneur '$Conteneur' n'est pas en marche." -ForegroundColor Red
    Write-Host "Démarre-le d'abord : docker start $Conteneur" -ForegroundColor Yellow
    Write-Host "(ou docker run -d --name $Conteneur -p 8080:80 $Image)"
    exit 2
}

# ---------------------------------------------------------------- taille de l'image
$tailleAttendue = [regex]::Match($texte, "Taille de l'image finale\s*\|\s*\*\*(?<n>[\d.,]+)\s*(?<u>Mo|Go|ko)\*\*")
$tailleDocker = (& docker images $Image --format "{{.Size}}").Trim()
$tailleReelle = [regex]::Match($tailleDocker, '^(?<n>[\d.]+)(?<u>[KMG]B)$')

if ($tailleAttendue.Success -and $tailleReelle.Success) {
    $moAttendus = En-Mo -Valeur ([double]($tailleAttendue.Groups['n'].Value -replace ',', '.')) -Unite $tailleAttendue.Groups['u'].Value
    $moReels = En-Mo -Valeur ([double]$tailleReelle.Groups['n'].Value) -Unite $tailleReelle.Groups['u'].Value
    Ajouter-Resultat -Libelle "Taille de l'image" `
        -Attendu ($tailleAttendue.Groups['n'].Value + " Mo") `
        -Reel $tailleDocker `
        -Ok ([math]::Abs($moAttendus - $moReels) -lt 0.05)
}
elseif (-not $tailleAttendue.Success) {
    Ajouter-Resultat -Libelle "Taille de l'image" -Attendu "introuvable dans le README" -Reel $tailleDocker -Ok $false
}
else {
    Ajouter-Resultat -Libelle "Taille de l'image" -Attendu ($tailleAttendue.Groups['n'].Value + " Mo") -Reel "image '$Image' absente" -Ok $false
}

# ------------------------------------------------------ en-têtes HTTP réels du serveur
$code = 0
$contentLength = $null
$server = $null
try {
    $reponse = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 10
    $code = [int]$reponse.StatusCode
    $contentLength = [string]($reponse.Headers['Content-Length'] | Select-Object -First 1)
    $server = [string]($reponse.Headers['Server'] | Select-Object -First 1)
} catch {
    $code = 0
}

$codeAttendu = [regex]::Match($texte, 'HTTP/1\.1\s+(?<c>\d{3})')
Ajouter-Resultat -Libelle "Code HTTP" `
    -Attendu ($(if ($codeAttendu.Success) { $codeAttendu.Groups['c'].Value } else { "introuvable" })) `
    -Reel ($(if ($code -gt 0) { "$code" } else { "aucune réponse sur $Url" })) `
    -Ok ($codeAttendu.Success -and $code -gt 0 -and [int]$codeAttendu.Groups['c'].Value -eq $code)

$longueurAttendue = [regex]::Match($texte, 'Content-Length:\s*(?<v>\d+)')
$longueurReelle = [regex]::Match($contentLength, '^\s*(?<v>\d+)\s*$')
Ajouter-Resultat -Libelle "Content-Length" `
    -Attendu ($(if ($longueurAttendue.Success) { $longueurAttendue.Groups['v'].Value } else { "introuvable" })) `
    -Reel ($(if ($longueurReelle.Success) { $longueurReelle.Groups['v'].Value } else { "absent" })) `
    -Ok ($longueurAttendue.Success -and $longueurReelle.Success -and $longueurAttendue.Groups['v'].Value -eq $longueurReelle.Groups['v'].Value)

$nginxAttendu = [regex]::Match($texte, 'Server:\s*nginx/(?<v>[\d.]+)')
$nginxReel = [regex]::Match($server, 'nginx/(?<v>[\d.]+)')
Ajouter-Resultat -Libelle "Version de Nginx" `
    -Attendu ($(if ($nginxAttendu.Success) { $nginxAttendu.Groups['v'].Value } else { "introuvable" })) `
    -Reel ($(if ($nginxReel.Success) { $nginxReel.Groups['v'].Value } else { $server })) `
    -Ok ($nginxAttendu.Success -and $nginxReel.Success -and $nginxAttendu.Groups['v'].Value -eq $nginxReel.Groups['v'].Value)

# ----------------------------------- noms et tailles des fichiers servis par le conteneur
$ligneContenu = [regex]::Match($texte, "Contenu de l'image finale\s*\|(?<ligne>[^\r\n]+)")
$fichiersAttendus = @{}
if ($ligneContenu.Success) {
    foreach ($paire in [regex]::Matches($ligneContenu.Groups['ligne'].Value, '`(?<nom>[^`]+)`\s*\((?<taille>[\d\s\u00A0\u202F]+)o\)')) {
        $fichiersAttendus[$paire.Groups['nom'].Value] = (Sans-Espaces $paire.Groups['taille'].Value)
    }
}

$fichiersReels = @{}
$racine = "/usr/share/nginx/html"

# On évite tout script shell (guillemets fragiles) : ls pour les noms, wc -c pour les tailles.
$chemins = @()
foreach ($nom in (& docker exec $Conteneur ls $racine)) {
    if ($nom -and $nom -ne "assets") { $chemins += "$racine/$nom" }
}
foreach ($nom in (& docker exec $Conteneur ls "$racine/assets")) {
    if ($nom) { $chemins += "$racine/assets/$nom" }
}

if ($chemins.Count -gt 0) {
    foreach ($ligne in (& docker exec $Conteneur wc -c @chemins)) {
        $morceaux = ($ligne.Trim() -split '\s+', 2)
        if ($morceaux.Count -eq 2 -and $morceaux[0] -match '^\d+$') {
            $nom = ($morceaux[1] -replace [regex]::Escape("$racine/"), '')
            # wc -c ajoute une ligne « total » quand on lui passe plusieurs fichiers.
            if ($nom -and $nom -ne "total") {
                $fichiersReels[$nom] = $morceaux[0]
            }
        }
    }
}

if ($fichiersAttendus.Count -eq 0) {
    Ajouter-Resultat -Libelle "Fichiers servis" -Attendu "introuvable dans le README" -Reel "$($fichiersReels.Count) fichier(s)" -Ok $false
}

foreach ($nom in ($fichiersAttendus.Keys | Sort-Object)) {
    $taille = $fichiersAttendus[$nom]
    if ($fichiersReels.ContainsKey($nom)) {
        Ajouter-Resultat -Libelle $nom `
            -Attendu "$taille o" `
            -Reel "$($fichiersReels[$nom]) o" `
            -Ok ($taille -eq $fichiersReels[$nom])
    }
    else {
        Ajouter-Resultat -Libelle $nom -Attendu "$taille o" -Reel "absent du conteneur" -Ok $false
    }
}

foreach ($nom in ($fichiersReels.Keys | Sort-Object)) {
    if (-not $fichiersAttendus.ContainsKey($nom)) {
        Ajouter-Resultat -Libelle $nom -Attendu "absent du README" -Reel "$($fichiersReels[$nom]) o" -Ok $false
    }
}

# ------------------------------------------------------------------------ affichage
$lignes = New-Object 'System.Collections.Generic.List[string]'
$titre = "Comparaison README.md / conteneur '$Conteneur' ($Url)"
$separateur = "-" * 84

Write-Host ""
Write-Host $titre -ForegroundColor Cyan
Write-Host $separateur -ForegroundColor DarkGray
$lignes.Add($titre)
$lignes.Add($separateur)

foreach ($resultat in $resultats) {
    $statut = if ($resultat.Ok) { "[OK]   " } else { "[ECART]" }
    $couleur = if ($resultat.Ok) { "Green" } else { "Red" }
    $ligne = "{0} {1,-30} README {2,-16} réel {3}" -f $statut, $resultat.Libelle, $resultat.Attendu, $resultat.Reel
    Write-Host $ligne -ForegroundColor $couleur
    $lignes.Add($ligne)
}

Write-Host $separateur -ForegroundColor DarkGray
$lignes.Add($separateur)

$ecarts = @($resultats | Where-Object { -not $_.Ok })
if ($ecarts.Count -eq 0) {
    $conclusion = "Tout correspond : le README est à jour."
    Write-Host $conclusion -ForegroundColor Green
}
else {
    $conclusion = "$($ecarts.Count) écart(s) : mets à jour la section 11 du README, puis relance ce script."
    Write-Host $conclusion -ForegroundColor Red
}
$lignes.Add($conclusion)

# Rapport texte prêt à versionner (captures/08-verification-readme.txt).
if ($Capture) {
    $cheminCapture = if ([System.IO.Path]::IsPathRooted($Capture)) { $Capture } else { Join-Path $dossier $Capture }
    $parent = Split-Path -Parent $cheminCapture
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent | Out-Null
    }
    Set-Content -Path $cheminCapture -Value $lignes -Encoding UTF8
    Write-Host "Rapport enregistré dans $cheminCapture" -ForegroundColor DarkGray
}

if ($ecarts.Count -eq 0) { exit 0 }
exit 1
