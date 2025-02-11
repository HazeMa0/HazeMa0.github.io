---
date: '2025-02-11T17:56:58+08:00'
title: '如何为 nautilus 右键菜单添加新建文件选项'
summary: '为 nautilus 添加新建选项的菜单并不困难。因为 ~/Templates 就是专门为之服务的。' 
---

> **相关软件（不限版本）**
> - nautilus

刚装好 Ubuntu，我们在文件管理器的右键菜单里面找不到新建文件的选项，这确实很让人匪夷所思。

实际上，我们只需要在 `~/Templates` 新建一个模板就好。

```bash
$ cd ~/Templates
$ touch `TXT.txt`
$ touch `Markdown.md`
```

当然这个方案并不完美，就是并没有在新建文件后自动处于重命名状态的功能。
