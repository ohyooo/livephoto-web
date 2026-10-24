# LivePhoto Web

在线使用：<https://ohyooo.github.io/livephoto-web/>

这是 [LivePhoto](https://github.com/ohyooo/LivePhoto) 的静态网站发布仓库。界面与 Core 为 Kotlin/Wasm，媒体只在浏览器本地处理。

`site/` 来自源码仓库已成功的 Web CI 网站产物，`web-ui-package-evidence.json` 记录源码提交、运行编号和逐文件 SHA-256。发布流程核对来源与全部文件，部署 GitHub Pages 后再通过真实 Chromium 验证在线资源和生成下载。

更新时，将成功运行的 `LivePhoto-web-ui-<run>-<attempt>` 中 `web-ui/` 完整替换到 `site/`，同步根目录清单，再提交到 `main`；Pages 会自动发布。不要复制测试素材、报告或源码构建目录。第三方许可证随网站一同保留。

原视频可超过 32 MiB，媒体预处理最高 256 MiB / 60 秒；生成时图片与处理后视频合计必须小于 32 MiB。浏览器仍需内存暂存；更完整的功能、格式范围和限制见源码仓库 README。
