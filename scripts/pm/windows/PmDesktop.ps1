[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Start', 'Status')]
    [string] $Action = 'Menu'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).ProviderPath
Set-Location -LiteralPath $repo
$backend = Join-Path $PSScriptRoot 'desktop.mjs'
$logPath = Join-Path $repo '.pm\desktop\desktop.log'

function Start-DesktopCommand([string] $command) {
    $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $node) { throw 'Windows could not find Node.js. Make node.exe available on your user PATH, then reopen the panel.' }
    if (-not (Test-Path -LiteralPath $backend -PathType Leaf)) { throw "The PM desktop controller is missing from $repo." }

    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $node.Source
    $info.Arguments = '"{0}" {1}' -f $backend, $command
    $info.WorkingDirectory = $repo
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [Text.Encoding]::UTF8
    $process = [System.Diagnostics.Process]::Start($info)
    # Drain both pipes immediately, including while the form is busy painting.
    return [pscustomobject]@{
        Process = $process
        Output = $process.StandardOutput.ReadToEndAsync()
        Errors = $process.StandardError.ReadToEndAsync()
        Command = $command
    }
}

function Read-DesktopResult($operation) {
    try {
        $output = $operation.Output.GetAwaiter().GetResult()
        $errors = $operation.Errors.GetAwaiter().GetResult()
        try { $result = $output | ConvertFrom-Json -ErrorAction Stop } catch { $result = $null }
        if ($null -eq $result -or $result.ok -isnot [bool] -or [string]::IsNullOrWhiteSpace($result.message)) {
            if (-not [string]::IsNullOrWhiteSpace($errors)) { throw $errors.Trim() }
            throw 'The desktop controller returned no usable status. Open View log for details.'
        }
        if ($operation.Process.ExitCode -ne 0) { $result.ok = $false }
        return $result
    } finally {
        $operation.Process.Dispose()
    }
}

if ($Action -ne 'Menu') {
    try {
        $operation = Start-DesktopCommand $Action.ToLowerInvariant()
        $operation.Process.WaitForExit()
        $result = Read-DesktopResult $operation
    } catch {
        $result = [pscustomobject]@{ ok = $false; state = 'error'; message = $_.Exception.Message }
    }
    if ($Action -eq 'Start' -and -not $result.ok) {
        # Sign-in is silent. Preserve failures that happened before Node could log.
        [IO.Directory]::CreateDirectory((Split-Path -Parent $logPath)) | Out-Null
        [IO.File]::AppendAllText($logPath, ('{0:u}  {1}{2}' -f [DateTime]::UtcNow, $result.message, [Environment]::NewLine))
    }
    $result | ConvertTo-Json -Compress
    if ($result.ok) { exit 0 } else { exit 1 }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object Windows.Forms.Form
$form.Text = 'ERA PM Command Center'
$form.AutoScaleMode = 'Font'
$form.Font = New-Object Drawing.Font('Segoe UI', 10)
$form.ClientSize = New-Object Drawing.Size(575, 210)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$iconPath = Join-Path $repo 'public\favicon.ico'
if (Test-Path -LiteralPath $iconPath -PathType Leaf) {
    try { $form.Icon = New-Object Drawing.Icon($iconPath) } catch { }
}

$layout = New-Object Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'
$layout.Padding = New-Object Windows.Forms.Padding(14)
$layout.ColumnCount = 1
$layout.RowCount = 3
$null = $layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('AutoSize')))
$null = $layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Percent', 100)))
$null = $layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('AutoSize')))
$form.Controls.Add($layout)

$locationLabel = New-Object Windows.Forms.Label
$locationLabel.Text = $repo
$locationLabel.AutoEllipsis = $true
$locationLabel.Dock = 'Top'
$layout.Controls.Add($locationLabel, 0, 0)

$statusText = New-Object Windows.Forms.TextBox
$statusText.AccessibleName = 'Command Center status'
$statusText.ReadOnly = $true
$statusText.Multiline = $true
$statusText.ScrollBars = 'Vertical'
$statusText.Dock = 'Fill'
$statusText.BackColor = [Drawing.SystemColors]::Window
$layout.Controls.Add($statusText, 0, 1)

$buttons = New-Object Windows.Forms.FlowLayoutPanel
$buttons.Dock = 'Fill'
$buttons.AutoSize = $true
$buttons.WrapContents = $true
$layout.Controls.Add($buttons, 0, 2)

function Add-PanelButton([string] $label) {
    $button = New-Object Windows.Forms.Button
    $button.Text = $label
    $button.AutoSize = $true
    $button.Padding = New-Object Windows.Forms.Padding(6, 2, 6, 2)
    $buttons.Controls.Add($button)
    return $button
}

$openButton = Add-PanelButton 'Open'
$restartButton = Add-PanelButton 'Restart'
$rebuildButton = Add-PanelButton 'Rebuild + restart'
$logButton = Add-PanelButton 'View log'
$form.AcceptButton = $openButton
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 150
$script:pending = $null

function Set-CommandButtons([bool] $enabled) {
    foreach ($button in @($openButton, $restartButton, $rebuildButton)) { $button.Enabled = $enabled }
}

function Invoke-PanelCommand([string] $command, [string] $progressText) {
    if ($null -ne $script:pending) { return }
    $statusText.Text = $progressText
    try {
        $script:pending = Start-DesktopCommand $command
        Set-CommandButtons $false
        $timer.Start()
    } catch {
        $statusText.Text = $_.Exception.Message
    }
}

$timer.Add_Tick({
    $operation = $script:pending
    if ($null -eq $operation -or -not $operation.Process.HasExited -or
        -not $operation.Output.IsCompleted -or -not $operation.Errors.IsCompleted) { return }
    $timer.Stop()
    $script:pending = $null
    try {
        $result = Read-DesktopResult $operation
        $statusText.Text = $result.message
        if ($operation.Command -eq 'open' -and $result.ok) {
            $address = $null
            if (-not [Uri]::TryCreate([string]$result.url, [UriKind]::Absolute, [ref]$address) -or
                $address.Scheme -ne 'http' -or -not $address.IsLoopback) {
                throw 'The controller did not return a local Command Center address. Open View log for details.'
            }
            Start-Process -FilePath $address.AbsoluteUri
        }
    } catch {
        $statusText.Text = $_.Exception.Message
    } finally {
        Set-CommandButtons $true
    }
})

$openButton.Add_Click({ Invoke-PanelCommand 'open' 'Opening the Command Center...' })
$restartButton.Add_Click({ Invoke-PanelCommand 'restart' 'Restarting the bridge...' })
$rebuildButton.Add_Click({ Invoke-PanelCommand 'rebuild' 'Checking the build and restarting the bridge...' })
$logButton.Add_Click({
    try {
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            Start-Process -FilePath notepad.exe -ArgumentList ('"{0}"' -f $logPath)
        } else {
            $statusText.Text = 'The desktop log has not been created yet.'
        }
    } catch { $statusText.Text = $_.Exception.Message }
})
$form.Add_Shown({ Invoke-PanelCommand 'status' 'Checking the bridge...' })
try {
    $null = $form.ShowDialog()
} finally {
    $timer.Dispose()
    # Closing the panel leaves a requested rebuild or restart running.
    if ($null -ne $script:pending) { $script:pending.Process.Dispose() }
    $form.Dispose()
}
