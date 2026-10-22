# 版本下载与安装

## v0.2.0 通用版完整源码预发布

推荐下载 v0.2.0：已取消固定四组与特定行业角色限制，支持单人负责人、动态团队、客户/事项名称及可选电话。旧数据库字段保留兼容，见 GENERAL_PURPOSE.md。v0.1.0 下载保留用于历史对照。

在 [GitHub Releases](https://github.com/my12yyds/My12-Sales-Tracker/releases) 下载版本 ZIP 及 SHA256SUMS.txt。压缩包来自发布标签对应的 Git 提交，包含源码、云函数、测试、说明和工作流；不包含 .git、node_modules、真实环境配置或客户数据。

Windows PowerShell 可用 `Get-FileHash 下载的文件.zip -Algorithm SHA256` 检查校验值。其他平台可使用 `sha256sum` 或 `shasum -a 256`。

1. 解压完整源码包，用微信开发者工具打开解压后的项目目录。
2. 按 docs/PUBLIC_CONFIGURATION.md 仅在本机配置 AppID 与云环境。
3. 安装并部署 cloudfunctions 下各函数的依赖和完整目录，设置数据库集合权限和所需索引。
4. 按 docs/MAINTENANCE.md、docs/LEAD_WORKSPACE.md 使用虚构数据验证角色、小组、分页和导出。
5. 在自己的环境完成编译、真机测试及微信审核流程后再考虑生产发布。

这是预发布源码，不能通过下载直接获得已经上线的微信服务。不会自动连接某个生产数据库。

## Releases 与 Packages

Releases 用于本项目按版本分发完整源码和校验值。根目录 package.json 是私有测试脚本入口，不是可安装的业务 npm 库；云函数分别部署，当前也没有容器应用。因此不向 GitHub Packages 发布没有实际用途的 npm 或容器包。

如果以后提取独立可复用库或部署服务，再为其设计包入口、依赖和单独的发布验证流程。
