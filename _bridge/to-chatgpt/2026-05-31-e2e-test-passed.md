测试结果可以直接复制给 ChatGPT：

---

**IP Sandbox V1 端到端测试完成，所有 53 项测试通过，npm run build 零错误。**

**测试场景 1：律师事务所（not_needed）**
- ✓ 模式正确
- ✓ assetSequence 为空
- ✓ 零成本、零图片
- ✓ 不创建 Sandbox

**测试场景 2：椰岛工坊（protect_existing）**
- ✓ 4 步骤（原始IP整理→使用规范→场景延展→包装应用）
- ✓ 低成本（总计 200 credits）
- ✓ 全部步骤走完：3 approved + 1 skipped
- ✓ 余额：50000 → 49800
- ✓ session 正确 completed
- ✓ 包含重绘禁止警告

**测试场景 3：连锁茶饮（create_new）**
- ✓ 8 步骤完整映射
- ✓ 高成本（8800 credits 预估）
- ✓ 需用户确认（requiresUserApproval=true）
- ✓ 重试功能正常（step 0 retry → generating）
- ✓ approvalNote 记录正确
- ✓ skip 功能正常（step 2 skipped + 记录原因）
- ✓ cancel session 正常（剩余步骤全部 marked cancelled）
- ✓ 进度百分比正确

**UI 验证结果：**
- Decision Layer Step 3：create_new/protect_existing 显示 IP Sandbox 按钮，not_needed 不显示 ✓
- 全部状态流转：pending→generating→reviewing→approved/skipped/cancelled ✓
- 余额联动正确 ✓
- Billing 无问题 ✓
- Memory 保存/恢复路径就绪 ✓
