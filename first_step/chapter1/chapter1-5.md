## 第五幕 循环往复的轨迹 II

接下来就是鸡冻人心的时刻了——我们要开始编写程序了！

理论知识已经足够，我们下面来一起编写一些程序，然后我也会附几道习题作为练习。

### 循环-入门级-求一堆圆的周长之和

第一行输入圆的个数，第二行输入这n个圆的周长各自是多少。

举例输入：
```
3
1 2 3
```
举例输出：
```
37.68
```

这个问题没那么复杂，我们展示如下代码：
```c
#include <stdio.h>

int main(void)
{
    int circles;
    double res = 0;
    scanf("%d", &circles);
    for(int i = 0; i < circles; i++)
    {
        int num;
        scanf("%d", &num);
        res += 3.14 * 2 * num;
    }
    printf("%llf", res);
    return 0;
}
```