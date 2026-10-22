# GitHub 协作与维护功能

## 仓库内配置

- Bug 与 Feature 表单：收集环境、复现步骤、验收标准和数据脱敏确认。
- PR 模板：记录验证、权限影响、数据迁移及部署要求。
- CODEOWNERS：为改动标注现有维护者；不是协作者授权或强制第二人审批。
- CONTRIBUTING、SECURITY、SUPPORT 与行为规范：明确参与方式和私密报告路径。
- AUTHORS：项目制作人署名，代码归属仍由真实提交历史体现。
- Regression checks：Node.js 20/22 测试、JavaScript/JSON 检查及配置脱敏检查。
- CodeQL：main 推送、PR 及手动触发的 JavaScript 代码扫描，结果见 Security。
- Dependabot：每周检查 Actions 与各云函数依赖，限制同时开启的 PR 数；兼容版本分组，升级后需测试，不自动合并或部署。
- Source package：在 Actions 手动运行，先通过检查，再生成精确提交的源码 ZIP，保留 14 天；不执行微信部署。
- release.yml：为 GitHub 自动生成版本说明提供分类，不会自动发布版本。

## 操作入口

1. Issues → New issue：选择缺陷或功能建议。
2. 新建分支并提交 PR：按模板补充验证；单人维护不要求另一人审批。
3. Actions → Regression checks / CodeQL：检查实际运行结果；扫描成功不代表不存在漏洞。
4. Actions → Source package → Run workflow：选择受信任分支生成源码包，完成后在 Artifacts 下载。
5. Releases → Draft a new release：选择经过核对的提交/标签，生成版本说明，人工检查后发布。没有把未经过微信验收的源码称为生产版本。

## 仓库设置

仓库描述、主题、讨论区、合并后删除分支及维护标签可在 GitHub 查看。私密漏洞报告及漏洞告警以 Settings / Security 页面实际状态为准，不能仅凭配置文件假定已启用。

主分支规则设置后，后续开发应走分支和 PR，通过必需检查再合并；不要求第二名审批者。实际规则以 GitHub Branch protection 页面为准。

Wiki、Projects、Discussions 是可选协作入口，不会自动生成虚构任务、评论、用户量或运营记录。当前项目文档集中在仓库 docs/，避免维护多份相互冲突的资料。

参考：[GitHub Dependabot 配置](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)、[CodeQL 配置](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)。
