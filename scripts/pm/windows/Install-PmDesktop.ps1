[CmdletBinding()]
param(
    [switch] $Uninstall,
    [string] $StartupDirectory = [Environment]::GetFolderPath('Startup'),
    [string] $DesktopDirectory = [Environment]::GetFolderPath('DesktopDirectory')
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).ProviderPath
$relativeLauncher = 'scripts\pm\windows\PmDesktop.ps1'
$launcher = Join-Path $repo $relativeLauncher
$powershell = Join-Path ([Environment]::GetFolderPath('System')) 'WindowsPowerShell\v1.0\powershell.exe'
$icon = Join-Path $repo 'public\favicon.ico'
$shell = New-Object -ComObject WScript.Shell

function Get-LaunchArguments([string] $root, [string] $action) {
    $interaction = if ($action -eq 'Start') { ' -NonInteractive' } else { '' }
    $script = Join-Path $root $relativeLauncher
    return "-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned$interaction -File `"$script`" -Action $action"
}

# An existing link belongs to this installer only if its marker, target and full
# command agree. A previous checkout can be moved because its own working
# directory must still account for the entire recorded launcher path.
function Test-OwnedLink($link, $entry) {
    if ($link.Description -cne $entry.Description -or $link.TargetPath -ine $powershell) { return $false }
    if ([string]::IsNullOrWhiteSpace($link.WorkingDirectory) -or
        -not [IO.Path]::IsPathRooted($link.WorkingDirectory)) { return $false }
    return $link.Arguments -ceq (Get-LaunchArguments $link.WorkingDirectory $entry.Action)
}

if (-not $Uninstall -and -not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "The PM desktop launcher is missing from $repo."
}
$entries = @(
    @{ Directory = $StartupDirectory; Name = 'ERA PM Bridge.lnk'; Action = 'Start'; Description = 'ERA PM Desktop | Start bridge at sign-in' },
    @{ Directory = $DesktopDirectory; Name = 'ERA PM Command Center.lnk'; Action = 'Menu'; Description = 'ERA PM Desktop | Command Center controls' }
)

# Check both destinations before making any changes.
foreach ($entry in $entries) {
    if ([string]::IsNullOrWhiteSpace($entry.Directory) -or -not [IO.Path]::IsPathRooted($entry.Directory)) {
        throw "A Windows folder could not be located for $($entry.Name)."
    }
    $entry.Path = Join-Path $entry.Directory $entry.Name
    if (Test-Path -LiteralPath $entry.Path) {
        $file = Get-Item -LiteralPath $entry.Path -Force
        if ($file.PSIsContainer -or $file.LinkType -in @('SymbolicLink', 'Junction', 'HardLink') -or
            -not (Test-OwnedLink ($shell.CreateShortcut($entry.Path)) $entry)) {
            throw "A different item already uses $($entry.Path). Rename it before running setup."
        }
    }
}

foreach ($entry in $entries) {
    if ($Uninstall) {
        if (Test-Path -LiteralPath $entry.Path -PathType Leaf) {
            Remove-Item -LiteralPath $entry.Path
        }
        Write-Output "Removed or already absent: $($entry.Path)"
        continue
    }
    [IO.Directory]::CreateDirectory($entry.Directory) | Out-Null
    $link = $shell.CreateShortcut($entry.Path)
    $link.TargetPath = $powershell
    $link.Arguments = Get-LaunchArguments $repo $entry.Action
    $link.WorkingDirectory = $repo
    $link.Description = $entry.Description
    $link.WindowStyle = 7
    $link.IconLocation = "$icon,0"
    $link.Save()

    $saved = $shell.CreateShortcut($entry.Path)
    if (-not (Test-OwnedLink $saved $entry) -or $saved.WorkingDirectory -ine $repo -or
        $saved.WindowStyle -ne $link.WindowStyle -or $saved.IconLocation -ine $link.IconLocation) {
        throw "Windows did not retain the expected shortcut settings for $($entry.Path)."
    }
    Write-Output "Verified: $($entry.Path)"
}
