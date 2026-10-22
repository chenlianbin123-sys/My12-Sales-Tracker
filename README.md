# 通用客户与事项跟进系统（微信云开发）

[![Regression checks](https://github.com/my12yyds/My12-Sales-Tracker/actions/workflows/checks.yml/badge.svg)](https://github.com/my12yyds/My12-Sales-Tracker/actions/workflows/checks.yml)
[![CodeQL](https://github.com/my12yyds/My12-Sales-Tracker/actions/workflows/codeql.yml/badge.svg)](https://github.com/my12yyds/My12-Sales-Tracker/actions/workflows/codeql.yml)

适用于客户服务、商务合作、项目事项和团队协作。支持单人负责人及多团队使用，不再限定主播、销售或固定四组。仓库名与部分内部字段保留，以兼容已有用户和数据库。

**项目制作人：** [my12yyds](https://github.com/my12yyds)、[Lyon-heng](https://github.com/Lyon-heng)。[制作人名单](AUTHORS.md)

当前 main：**0.2.0-dev，未发布的通用化开发版**。[Releases](https://github.com/my12yyds/My12-Sales-Tracker/releases) 中的 v0.1.0 仍为原有场景的源码预览包。

## 主要功能

- 管理员、负责人、成员三种通用角色；团队使用正整数编号，不限制四组。
- 客户/事项名称、选填联系电话、备注、协作分配与跟进记录。
- 单人负责人可直接使用；没有其他成员时新记录自动分配给自己。
- 名称/电话/备注搜索、四种排序、日期范围、未跟进筛选与分页加载。
- 精确详情、拨号、复制电话、已加载结果 CSV 导出及本机筛选偏好。
- 管理员动态团队看板、用户管理和团队设置。
- 通用流程：待处理、沟通中、方案确认、已完成、已关闭。

权限在云函数中校验；成员仍仅能查看当前团队中分配给自己的记录。团队不等于独立企业租户。

## 开始使用

1. 克隆 main 或下载对应提交的源码，用微信开发者工具打开根目录。
2. 公共配置保持 YOUR_APPID、YOUR_CLOUD_ENV_ID，在自己的本机配置实际环境；不要提交凭据。
3. 安装并部署 cloudfunctions 下各函数的依赖及完整目录，按云平台提示配置数据库集合、权限和索引。
4. 首次登录进入注册，普通账号默认未分配团队。由可信管理员设置角色和团队；普通用户不能自选管理员。
5. 单人使用：将自己的业务账号设为负责人、团队1；多团队使用：为各负责人和成员设置不同的正整数编号。
6. 先用虚构数据完成编译、云端和真机验收，再考虑生产发布。

## 本地检查

需要 Node.js 20 或更新版本，根目录没有运行时依赖：

```sh
npm test
npm run check:syntax
npm run check:public
```

测试模拟云 SDK，不访问真实数据库。通过测试不代表已完成微信云端、编译或真机验收。

## 文档与协作

- [通用化设置、兼容协议及升级说明](docs/GENERAL_PURPOSE.md)
- [搜索、导出等工作台功能](docs/LEAD_WORKSPACE.md)
- [公开配置与部署边界](docs/PUBLIC_CONFIGURATION.md)
- [维护说明](docs/MAINTENANCE.md)、[更新日志](CHANGELOG.md)
- [参与贡献](CONTRIBUTING.md)、[获取帮助](SUPPORT.md)、[安全报告](SECURITY.md)
- [反馈问题](https://github.com/my12yyds/My12-Sales-Tracker/issues/new/choose)、[GitHub 维护功能](docs/GITHUB_MAINTENANCE.md)

旧版安装/设计文档保留作历史参考；与当前通用版冲突时以通用化说明和当前代码为准。

## 边界与许可证

没有连接真实生产环境。看板使用有上限的分页读取；并发写入一致性、大数据量聚合和完整权限审计仍有后续工作。当前流程名称可在展示层继续调整，内部兼容代码不自动迁移。

许可证以 [LICENSE](LICENSE) 中的 AGPL-3.0 为准。
