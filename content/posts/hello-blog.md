---
date: '2025-02-11T16:36:29+08:00'
draft: false
title: '如何为 nautilus 配置右键菜单'
summary: 'nautilus 是 GNOME 桌面环境默认的 GUI 文件管理器。本文介绍如何为 nautilus 添加自定义的右键菜单项。'
---

> **相关软件版本**
> - Ubuntu 22.04 及以上

nautilus 是 GNOME 桌面环境默认的 GUI 文件管理器。

本来其实没想到这样一个简单的任务会引起一些麻烦。把我处理这个麻烦的过程记下来吧。

首先，我们百度搜索这个问题，从一些相当新的帖子获得的解决方案是安装 `nautilus-actions`。但意外的是，在 Ubuntu 22.04 中，这个包被移除了。

我们转战谷歌，找到了[这篇帖子](https://askubuntu.com/questions/1405687/how-to-install-filemanager-actions-in-ubuntu-22-04)，告诉我们这个软件因为缺少更新已经被上游的 gnome [存档](https://gitlab.gnome.org/Infrastructure/Infrastructure/-/issues/671)了。我们也并不想使用已经被废弃的软件，那就去找替代方案吧——我相信不可能没有提供。

*意外发现：gnome 原来用 gitlab 管理项目，有趣。*

*翻译者没有兴趣维护这个软件："Sorry, but if there's no contributions for several years, we're not going to keep it active. It wastes the efforts of our translators. Feel free to fork and maintain it somewhere else if you like (it's open source, after all)."*

[另一篇帖子](https://www.reddit.com/r/gnome/comments/rf0leo/is_there_a_replacement_for_nautilusactions/?rdt=61801) 指出了两个替代方案：一个是我在以前使用过的 [`Nautilus Scripts`](https://help.ubuntu.com/community/NautilusScriptsHowto)，最终效果是在右键菜单里面显示一个 Scripts 子菜单，里面有我们写好的脚本作为选项。这种方法不够优雅，我们希望显示在主右键菜单里面；另一个是 [`nautilus-python`](https://gitlab.gnome.org/GNOME/nautilus-python/)，出于对 python 的好感我们最终选择这个方案。

问题又来了，在 Ubuntu 安装 `nautilus-python`，也没有这个包。经过检查，[一篇帖子](https://github.com/GSConnect/gnome-shell-extension-gsconnect/issues/1389) 指出其在 Ubuntu 源的名称是 `python3-nautilus`，这可能是因为一些误解产生的问题。

现在我们学习写 python 代码来实现 nautilus-python 的扩展。参考资源：[官方示例](https://gitlab.gnome.org/GNOME/nautilus-python/-/tree/master/examples?ref_type=heads)、[linuxconfig.org 的教程](https://linuxconfig.org/how-to-write-nautilus-extensions-with-nautilus-python)。我们将写好的 python 文件保存到 `~/.local/share/nautilus-python/extensions/` 即可，然后重启 nautilus 即可。

先看下面的示例，其为 VSCode 打开文件夹和文件提供了右键菜单（使用命令 `wget -qO- https://raw.githubusercontent.com/harry-cpp/code-nautilus/master/install.sh | bash` 以快速安装，我对代码做了一些简化，原本的源代码请参考相应的 [GitHub 仓库](https://github.com/harry-cpp/code-nautilus)）：
```py
from gi.repository import Nautilus, GObject
from subprocess import call
import os

class VSCodeExtension(GObject.GObject, Nautilus.MenuProvider):
    # python 支持多重继承
    def launch_vscode(self, menu, files):
        # 参数是 self, menu, files，注意不要修改
        safepaths = ''
        args = ''
        for file in files:
            filepath = file.get_location().get_path()
            safepaths += '"' + filepath + '" '
            if os.path.isdir(filepath) and os.path.exists(filepath):
                args = '--new-window '

        call('code ' + args + safepaths + '&', shell=True)

    def get_file_items(self, *args):
        # 右键文件/文件夹时对应的方法
        files = args[-1]
        item = Nautilus.MenuItem(
            name='VSCodeOpen',
            label='Open in Code',
            tip='Opens the selected files with VSCode'
        )
        item.connect('activate', self.launch_vscode, files)
        return [item]

    def get_background_items(self, *args):
        # 右键空白位置时的方法
        file_ = args[-1]
        item = Nautilus.MenuItem(
            name='VSCodeOpenBackground',
            label='Open in Code',
            tip='Opens the current directory in VSCode'
        )
        item.connect('activate', self.launch_vscode, [file_])
        return [item]
```
上面的 python 代码足够直观了。`get_backgroud_items` 和 `get_file_items` 返回一个菜单数组，而菜单如何创建和与具体的操作方法链接上面的示例已经足够说明。
