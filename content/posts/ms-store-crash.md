---
date: '2026-09-27T21:44:32+08:00'
title: 'Microsoft Store 闪退的一种可能原因'
summary: '如果你也曾因为 C 盘根目录出现 .GamingRoot 文件而卸载过“游戏服务”，那你的 MS Store 很可能会因此频繁崩溃。'
---

笔者的电脑出现了一种症状：Microsoft Store 打开后过一段时间就会闪退，时间从几秒到几分钟不等。于是笔者借助 ChatGPT 调查了这个问题，把调查结果分享如下，供遇到相同问题的朋友参考。

## 省流版

笔者 MS Store 的问题是由于其代码的一处 bug 引起的，而卸载游戏服务（英文名：Gaming Services；包名：Microsoft.GamingServices）会大大加剧 bug 触发的概率，从而引起闪退。你可以重新安装[游戏服务](https://apps.microsoft.com/detail/9MWPM2CQNLHN)来缓解 bug。

## 第一步：MS Store 加载系统“游戏平台服务” DLL

MS Store 附带了一个 dll，名为 `Microsoft.GamePlatform.Services.dll`，其典型位置是 `C:\Program Files\WindowsApps\Microsoft.WindowsStore_...\microsoft.gameplatform.services.dll`。这个 dll 在 WinStore.App.exe 中被加载，用途是提供游戏相关的接口：
```xml
<!--AppxManifest.xml-->
<Extension Category="windows.activatableClass.inProcessServer">
  <InProcessServer>
    <Path>Microsoft.GamePlatform.Services.dll</Path>
    <ActivatableClass
      ActivatableClassId="Microsoft.GamePlatform.Services.PackageUpdate"
      ThreadingModel="both" />
    ...
    <ActivatableClass
      ActivatableClassId="Microsoft.GamePlatform.Services.PlatformStatus"
      ThreadingModel="both" />
  </InProcessServer>
</Extension>
```

这个 dll 在初始化函数 `FUN_1800043c8` 中动态加载了 System32 的 `gameplatformservices.dll`。为方便区分，下文把前者称为“Store DLL”，后者称为“系统 DLL”：

```c
// `FUN_…` 和 `DAT_…` 是反编译工具自动生成的名称，下文同
// 这里的 0x800 是指 LOAD_LIBRARY_SEARCH_SYSTEM32，表示从System32 搜索该文件
DAT_180096678 = LoadLibraryExW(L"gameplatformservices.dll", (HANDLE)0x0, 0x800);
DAT_1800966a0 = GetProcAddress(DAT_180096678, "QueryApiImpl");
DAT_1800966a8 = GetProcAddress(DAT_180096678, "InitializeApiImpl");
DAT_1800966b0 = GetProcAddress(DAT_180096678, "UninitializeApiImpl");
...
```

## 第二步：系统 DLL 检查包“游戏服务”是否存在

系统 DLL 依赖的组件之一是 Gaming Services，包名为 `Microsoft.GamingServices`。它提供游戏相关支持，微软的 GDK 文档就明确说明，MSIXVC 游戏包的打包部署流程依赖这个组件：

> The MSIXVC packaging and deployment steps for the development PC depend on the Gaming Services package being installed.

来源：[微软 Gaming Services 依赖说明](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/packaging/packaging-testing-pc-install?view=gdk-2510)。

系统 DLL 初始化平台状态接口时，会检查游戏服务包。包检查函数内部通过 `Windows.Management.Deployment.PackageManager` 查询包状态；相关检查不通过，就产生错误 `0x80070424`，含义是“指定的服务未安装”。

```c
// 包检查函数 FUN_18007b910 内部
    local_res10[0] = 1;
    // FUN_18007b9ec 用 Windows.Management.Deployment.PackageManager 查询包状态
    uVar1 = FUN_18007b9ec(local_res18, param_1, local_res10);
    ...
    return local_res10[0];

// 平台状态接口初始化代码节选
if ((cVar1 == '\0') && (cVar1 = FUN_18007b910(0x1800d1780), cVar1 == '\0')) {
    // 0xb6：十进制 182，是诊断信息中的源代码行号
    // 0x424：win32 错误 1060，映射到 HRESULT 为 0x80070424，其含义是“指定的服务未安装”
    FUN_18009e3c8(unaff_retaddr, 0xb6,
        "xbox\\base\\appmodel\\gameplatformservices\\status\\lib\\statusapi.cpp", 0x424);
    return unaff_RBX;
}

```

笔者使用 windbg 观察 MS Store 的运行，记录到了相同的错误：
```text
status\lib\statusapi.cpp(182) ... ReturnHr(1) ... 80070424
...
Failed QI on SID 77C5D568-2A98-4985-9D84-E4013B6DD035
IID 66ECFF13-21C4-4500-8170-044A47E9108B
```

## 第三步：MS Store 清理失败的初始化，然后重新尝试

Store DLL 中有一段代码负责保证接口已经初始化。它发现初始化或接口获取失败，就调用清理函数，把这次尝试建立的资源收回。

清理的顺序是：先处理包装层资源，调用系统 DLL 的反初始化入口，然后清空接口地址和初始化状态，最后调用 `FreeLibrary` 释放系统 DLL。按反编译整理，过程如下：

```c
// 执行顺序示意，名称经过简化。
清理包装层资源();
if (反初始化入口存在)
    UninitializeApiImpl();

清空接口地址();
已初始化 = false;

if (系统DLL句柄 != NULL) {
    FreeLibrary(系统DLL句柄);
    系统DLL句柄 = NULL;
}
```

初始化状态被清除后，后续请求又会重新加载、初始化。Store DLL 中还有一条定时重试路径：尝试失败，就安排约两秒后的下一次尝试。

```c
uVar1 = FUN_180008940();
if ((int)uVar1 < 0) {
    // 合起来是 −20,000,000 个 100 纳秒单位，即约两秒后。
    local_res20.dwLowDateTime = 0xfeced300;
    local_res20.dwHighDateTime = 0xffffffff;
    SetThreadpoolTimer(DAT_1800966d0, &local_res20, 0, 1000);
}
```

但缺少的组件没有恢复，下一次尝试仍然会失败。于是程序不断经过“加载—初始化失败—清理—卸载”的循环。在覆盖约 28 分钟的调试记录中，出现了 224 次系统 DLL 加载记录，以及 224 次来自 `statusapi.cpp(182)` 的错误信息，与这条循环相符。

## 第四步：内部引用归零，关闭流程继续，但后台线程还没退出系统 DLL

第三步中，真正卸载系统 DLL 的请求来自 Store DLL 对 `FreeLibrary` 的调用。Windows 为加载的 DLL 维护模块引用计数，`FreeLibrary` 减少这个计数；降到零时，Windows 就从进程地址空间卸载 DLL。[微软文档](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-freelibrary) 说明了其作用。

为了安全卸载，Store DLL 会先让系统 DLL 反初始化，等它处理自己的资源，再调用 `FreeLibrary`。问题就出在系统 DLL 如何判断“自己的工作已经结束”。

系统 DLL 内部有任务队列。它会把需要处理的工作交给 Windows 的线程池，由 Windows 安排后台线程执行。提交工作之前，代码为队列对象增加一份引用，保证后台线程还在使用队列时，队列对象不会被销毁，工作线程处理完队列后，再释放这份引用：

```c
// 提交工作的关键顺序示意。
增加队列对象引用();
SubmitThreadpoolWork(工作项);
```

系统 DLL 除了维护各个队列对象的引用数，还维护一份内部引用总数：增加对象引用时，总数也加一；释放时，总数也减一。它与 Windows 决定是否卸载 DLL 的模块引用计数，是两个不同的计数。关闭流程*等待*这个内部引用总数归零，以此判断相关对象是否已释放。关闭系统 DLL 的流程给这次等待设置了一秒上限，反编译中的调用为：

```c
bVar1 = FUN_18009c2a8(1000);  // 等待内部引用总数归零，最多等一秒。
```

不过，等待时间并不是恒定的。如果总数已经是零，就直接继续；如果等待过程中收到通知，发现总数变成零，也会提前结束等待。

而后台线程在把内部总数减到零之后，仍有几条 DLL 指令需要执行。对应代码的顺序是：

```c
// 按汇编整理的示意代码。
旧总数 = 原子减一并取得旧值(内部引用总数);
if (旧总数 == 1) {
    获取锁();
    WakeAllConditionVariable(...);  // 通知关闭方：总数归零了。
    释放锁();
}
return;  // 返回也需要执行 DLL 里的指令。
```

后台线程通知完毕、释放锁以后，关闭方就可能恢复执行：它看到总数为零，结束反初始化，返回 Store DLL。Store DLL 随后调用 `FreeLibrary`，模块引用计数降到零，系统 DLL 就被卸载了。

此时，后台线程却可能仍停留在最后几条返回指令之前。线程随时可能被暂停调度，剩下的指令少，并不保证它一定能抢在卸载之前完成。这样，关闭方已经释放了代码所在的内存，后台线程却还打算接着执行这些代码。

崩溃转储记录的正是这样的结果：

```text
EXCEPTION TID 14944 CODE 0xc0000005
UNLOADED_MATCH gameplatformservices.dll+0x9734e
PARAMS ['0x8', '0x7ffcc31c734e']
FAULT_MEMORY ... STATE 0x10000
```

异常参数 `0x8` 表示执行访问冲突；内存状态 `0x10000` 是 `MEM_FREE`，表示该地址所在内存已经被释放。

故障地址 `+0x9734e` 恰好位于内部总数减一函数的返回尾声：

```asm
180097348  CALL ...        ; 释放锁。
18009734e  ADD RSP,0x28    ; 故障位置：整理栈，准备返回。
180097352  RET
```

因此，这条链路中最关键的错误是：内部引用总数已经归零，被当成了可以继续关闭的条件；但负责减到零的线程本身，还没有彻底退出 DLL。两者之间的时间间隙，使 DLL 卸载与后台线程的最后几条指令撞在一起。

## 缓解方法

对遇到相同缺包错误的用户，安装 [Gaming Services（Microsoft Store 链接）](https://apps.microsoft.com/detail/9MWPM2CQNLHN) 是直接的缓解方向：补回缺失组件，让接口有机会正常初始化，从而避免反复失败和卸载。

## 为什么你可能卸载了“游戏服务”
因为“游戏服务”会在你的 C 盘根目录创建 `XBoxGames` 文件夹和 `.GamingRoot` 文件。按照微软支持社区提供的[解决方案](https://learn.microsoft.com/zh-cn/answers/questions/4334682/xboxgames)，在不玩 XBox 游戏的前提下，卸载“游戏服务”是一种解决方案。但意外的是，它增加了触发 MS Store 的 bug 的概率。

## 附录
测试平台：MS Store 22608.1401.4.0、Windows 11 26340.9502。
