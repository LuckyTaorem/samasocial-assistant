# Auto-sync local repo with GitHub (PowerShell version)

# Get current folder name
$folderName = Split-Path -Leaf (Get-Location)

# Initialize Git if not already
if (-not (Test-Path ".git")) {
    git init
}

# Check if remote origin exists
try {
    $remoteUrl = git remote get-url origin 2>$null
} catch {
    $remoteUrl = $null
}

if (-not $remoteUrl) {
    Write-Host "No remote found. Creating GitHub repo named $folderName..."
    # Requires GitHub CLI (gh) installed and authenticated
    gh repo create $folderName --public --source . --remote origin --push
} else {
    Write-Host "Remote found: $remoteUrl"
    Write-Host "Syncing changes..."
    git add .
    git commit -m "Auto-sync commit" 2>$null
    git branch -M main
    git push origin main
}
