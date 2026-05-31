IP Sandbox UI V1 已完成。

改动：
- 新建 `/admin/ip-sandbox/[sessionId]` 页面 — 逐张生成、逐张确认的沙盒 UI
- Decision Layer Step 3 新增「IP Sandbox」入口按钮（仅 create_new / protect_existing 模式显示）
- 状态流：pending → generating → reviewing → approved/skipped/cancelled
- approvalNote 输入框 + skip reason
- 完成页展示总费用、余额、步骤概览

验收：
- npm run build 零错误
- 连锁茶饮 create_new → 8 步骤入口
- 椰岛工坊 protect_existing → 4 步骤入口
- 律师事务所 not_needed → 不显示入口

当前不做：不接通义万相、不改 SVG、不改封面、不改生成层
