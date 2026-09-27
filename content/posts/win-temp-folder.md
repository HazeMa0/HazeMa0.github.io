---
date: '2026-07-03T23:02:43+08:00'
title: '解决 Windows 下载文件夹下自动创建 temp 空文件夹的问题'
summary: '微信输入法会在用户下载文件夹创建 temp 文件夹，用于隔空传送。本文教你视觉上隐藏这个文件夹。'
---

使用 Process Monitor 进行排查，发现这是微信输入法所为，用于 2.0 版本提供的隔空传送功能。微信输入法会进行以下操作：

1. 在每次开机时创建 temp 文件夹
2. 在隔空传送开始时，在 temp 文件夹里面创建临时文件
3. 在文件传送完成后，删除临时文件，在下载文件夹里创建最终文件

{{< figure src="/images/win-temp-folder/procmon.png" alt="使用 Process Monitor 发现创建和使用文件夹是由微信输入法的进程完成的。" caption="Process Monitor 里微信输入法使用 temp 文件夹的证据" >}}

你还可以使用另一种办法验证这是微信输入法所为。删除 temp 文件夹，创建一个叫 temp 的没有后缀名的文件，这时候你会发现隔空传送功能无法正常工作了。

这样会让用户维护的整洁的下载文件夹看起来很糟糕。我已经将该问题反馈给微信输入法团队，在他们官方修复这个问题前，可以使用以下脚本缓解该问题，也就是把 temp 文件夹设置成受保护的操作系统文件夹，这样眼不见心不烦。在 PowerShell 运行以下代码（AI 生成，运行任何脚本前请使用 AI 审计代码）：

```PowerShell
# 1. 获取当前用户真实的下载文件夹路径
$Downloads = [Environment]::ExpandEnvironmentVariables(
    (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders").'{374DE290-123F-4565-9164-39C4925E467B}'
)

# 2. 拼接 temp 路径
$Target = Join-Path $Downloads "temp"

# 3. 如果该文件夹存在，则赋予“隐藏 + 系统”属性（不删除任何文件）
if (Test-Path $Target) {
    attrib +s +h $Target
    Write-Host "已成功将 $Target 设置为系统隐藏文件夹，资源管理器中将不可见。"
} else {
    Write-Host "未找到该文件夹，可能已被清理或路径不对。"
}
```

看到操作成功的提示后，问题就在视觉层面解决了。希望官方能尽早修复。
