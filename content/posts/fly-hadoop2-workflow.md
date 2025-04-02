---
date: '2025-02-17T19:51:04+08:00'
title: 'fly-hadoop2-workflow：让编写 hadoop 2.7 应用的效率飞起来'
summary: '项目地址：https://github.com/HazeMa0/fly-hadoop2-workflow。借助 Docker 和 Dev Container，舒适地开发老旧框架的程序。本文阐述了这个项目中遇到的困难。'
---

项目地址（配有使用方法）：[https://github.com/HazeMa0/fly-hadoop2-workflow](https://github.com/HazeMa0/fly-hadoop2-workflow)

作为博客，还是整理一下这个过程中的困难吧。

### 一、网络问题很烦人

1. 首先，事实是：2024 年，中国大陆的主要高校和云服务商都关闭了 Docker Hub 的镜像源。但是百度仍有大量的帖子在建议更换镜像源以改善对 Docker Hub 的访问。

2. 我在我的 Windows 环境部署了代理。WSL2 理应继承代理设置。但是神奇的事情发生了：WSL2 我们可以顺利地 `docker build`，Windows 却不行。

然后，我们做了以下事情试图让 Dockerfile 的 from 指令正常工作：
 - 设置 HTTP_PROXY 和 HTTPS_PROXY 环境变量；
> **注意！**
>
> HTTPS_PROXY 对应的仍然是 http://localhost:1234，而不是 https！我是在发现环境变量使我的 VSCode 无法正常工作时才发现这个问题的；

 - 配置 Docker Engine 的配置文件：
```json
"proxies": {
    "default": {
        "httpProxy": "http://127.0.0.1:9870",
        "httpsProxy": "http://127.0.0.1:9870",
        "noProxy": "localhost,127.0.0.1"
    }
}
```
 - 修改 `~/.docker/config.json`（最后又删掉了）

在我没发现我把 HTTPS_PROXY 写成 https://... 时，这三个修改都不起作用。然后，在一次神秘的 `docker pull ...` 后，突然就好起来了，我至今也没搞清楚到底是怎么回事。

3. 我们认识到，`ping` 命令走的是 ICMP 协议，对测试 http/socks5 的代理没有意义。

### 二、对 Docker 和 Dev Container 的错误理解

刚开始，我们在使用 Docker 运行和使用 Dev Container 作为开发环境上犹豫和摇摆了很长时间。我问了 AI 下面这一大段文字，可见我当时的烦躁。

*我现在陷入了一些混乱，需要你来拯救我。要写代码，首先要有开发环境。一般来说，这意味着编译器和解释器以及外部库和系统库的版本，还有代码构建工具的版本。这些东西在不同的开发项目中很容易冲突。然后我们运行起来了程序。然后希望交给测试测试。我没有在公司工作过，我不知道测试测试时需不需要源代码，还是只拿最终可执行程序进行测试。如果需要，那他也需要开发环境。然后经过修改，最后交付用户。用户不同软件之间的运行环境也可能冲突，一般来说，运行环境应该是开发环境的一个子集。容器要怎么终结这一系列混乱？*

*好了，现在产生了问题。首先开发者要搭建一个叫做开发环境的玩意。把编译器/解释器/代码生成程序/外部库/系统库封装在容器里面是很好，问题是本地运行的IDE怎么和这些容器里面的玩意交互，从而支持语法高亮和其他功能呢？其次，我说了，运行环境往往是开发环境的子集，编译器对运行环境毫无必要。难道容器通过纵容这些冗余来换取分发效率吗？还有，为什么现实中面向普通用户的应用没有一个用docker分发呢？*

产生这些困惑的 Docker 相关问题是：
1. 以为代码的依赖都在容器里面，不希望手动把依赖拷到物理机恶心自己。虽然我们确实可以在容器里面援引相关的 jar，但更方便的方法是直接在本地通过 Maven 从中心仓库部署合适的依赖用于测试。
2. 不了解容器挂载技术，以为我们必须手动把 jar 文件拷贝到容器测试。
3. 不了解本地测试 Hadoop，以为所有类型的测试必须使用 `hadoop jar` 命令执行。实际上我们甚至可以不启动容器进行本地测试，完全本地开发。
4. 区分不了镜像和容器。镜像是死的初始化状态，容器是基于镜像的可工作的实体。Dockerfile 产生镜像。
5. 过早把自己摆到用户角度，认为开发环境对运行环境是冗余的（冗余了你改改 Dockerfile 不就行了吗，对刚开始的我来说改这玩意很困难，现在完全不是了）

Dev Container 相关问题是：

1. 神圣化 Dev Container，以为其不会往容器里面部署 IDE 后端，从而产生了一系列矛盾；
2. 以为 Dev Container 不能配置容器开放的端口。同时认识到，不能修改一个已经打开的容器的端口映射，这是为了简化容器运行状态故意为之的设计。
3. Dev Container 指定 entrypoint 不是在 postCreateCommand，也不是在 Dockerfile，只有通过 `runArgs` 指定才是正确的。
4. 不知道为什么，让 Dev Container 执行我的脚本时不能正确识别 echo 的 -e 参数，而是将其作为文本打印。最后我们换用了 printf 命令。


### 三、一些 linux 知识

1. Hadoop 环境初始化脚本需要 ssh 连接，就会产生下面这种需要手动确认的麻烦问题：
```
yes：The authenticity of host 'localhost (::1)' can't be established. 
ECDSA key fingerprint is SHA256:**********.
Are you sure you want to continue connecting (yes/no)? 
```
我们希望初始化脚本作为 Docker 的 1 号进程，当然不希望这种需要手工确认的东西出现。我们最终使用以下脚本解决：
```sh
touch ~/.ssh/config
printf "Host *\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile /dev/null\n" > ~/.ssh/config
```

2. 该死的 `\r\n`
在 Windows，git 默认会把 `\n` 替换成 `\r\n`。这最后导致我的脚本 push 再 clone 后竟然无法运行了。最后一行命令解决问题：
```powershell
git config --global core.autocrlf false
```

3. 有趣的事实：JDK 1.x == JDK x

### 四、该死的讲义问题

1. 讲义给出的一些命令根本是错误的。

2. 讲义没有细说应该怎么修改 Hadoop 的若干 xml，百度也在画蛇添足。只有官方文档才是可靠的。

3. 讲义没告诉我 start-all.sh 的正确位置，让我无法正确配置 PATH。

### 五、鸣谢

感谢 DeepSeek 和 ChatGPT 耐心地听我抱怨和提出问题。没有任何一个人类受得了这么多怨气和不满。

感谢官方的 [Hadoop 安装教程](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-common/SingleCluster.html)。

感谢 Google。珍爱生命，拒绝百度。
