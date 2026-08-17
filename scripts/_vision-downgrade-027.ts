/**
 * 工单 027 降级路径验证：Ollama 不可用时 runLogoVisionCheck 必须返回
 * skipped + reason=ollama_unavailable（未初检标记），不静默当作通过。
 * 运行前请确保 Ollama 已停止。
 */
import { runLogoVisionCheck } from "../src/lib/vision-check";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main(): Promise<void> {
  const r = await runLogoVisionCheck({
    imageBase64: ONE_PX_PNG_BASE64,
    expectedText: "老碗香",
    mode: "chinese",
  });
  console.log(JSON.stringify(r));
  const ok = r.status === "skipped" && r.reason === "ollama_unavailable";
  console.log(ok ? "DOWNGRADE: PASS" : "DOWNGRADE: FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
