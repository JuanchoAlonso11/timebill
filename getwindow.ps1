Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
}
"@
$h = [WinAPI]::GetForegroundWindow()
$s = New-Object System.Text.StringBuilder(512)
[WinAPI]::GetWindowText($h, $s, 512) | Out-Null
$s.ToString()
