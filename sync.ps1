# Auto-sync local repo with GitHub (PowerShell version)

$folderName = Split-Path -Leaf (Get-Location)

if (-not (Test-Path ".git")) {
    git init
}

git branch -M main

try {
    $remoteUrl = git remote get-url origin 2>$null
} catch {
    $remoteUrl = $null
}

if (-not $remoteUrl) {
    Write-Host "No remote found. Creating GitHub repo named $folderName..."
    gh repo create $folderName --public --source . --remote origin --push
} else {
    Write-Host "Remote found: $remoteUrl"
    Write-Host "Syncing changes..."
    git add .
    if ((git status --porcelain).Length -gt 0) {
        git commit -m "Auto-sync commit"
    } else {
        Write-Host "No changes to commit."
    }
    # Pull before pushing to avoid rejection
    git pull --rebase origin main
    git push origin main
}
