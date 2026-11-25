# LyricGrammar 学生网站

用歌词学语法。这是当前完整可用的版本，下载这一个仓库后，按下面步骤就能在本机试用。不需要再选分支。

仓库地址：https://github.com/yeguihua19810428/LyricGrammar-site

## 本机试用

先确认本机已安装 Node.js 20 或更高版本。在终端里输入 `node -v` 和 `npm -v`，能看到版本号即可。如果还没有，打开 https://nodejs.org 下载安装。

### 方法一：用 Git 下载（以后更新更方便）

在本机终端里执行：

```bash
cd /home/vincent
git clone https://github.com/yeguihua19810428/LyricGrammar-site.git
cd /home/vincent/LyricGrammar-site
bash 试用.sh
```

### 方法二：在网页上下载压缩包

1. 打开 https://github.com/yeguihua19810428/LyricGrammar-site
2. 点绿色的 **Code** 按钮，再点 **Download ZIP**
3. 解压到本机，例如解压到 `/home/vincent/LyricGrammar-site-main`
4. 在解压出来的文件夹里打开终端，执行：

```bash
cd /home/vincent/LyricGrammar-site-main
bash 试用.sh
```

（解压后的文件夹名以实际为准。）

### 打开页面

服务启动后，用**本机浏览器**打开：

- 学生页：http://127.0.0.1:8080/
- 一边试用一边改讲解：http://127.0.0.1:8080/?editExplain=1

建议先看第 25 讲。改完的讲解保存在本仓库里的：

`src/lyric/data/courseware-says-reviewed.json`

要停止服务，回到运行 `试用.sh` 的那个终端，按 `Ctrl+C`。

### 以后更新

如果是用 Git 下载的，在仓库文件夹里执行：

```bash
cd /home/vincent/LyricGrammar-site
git pull
bash 试用.sh
```

如果是下载的压缩包，请重新下载最新 ZIP，再按上面方法二操作。
