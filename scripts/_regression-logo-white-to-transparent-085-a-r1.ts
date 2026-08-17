/**
 * TICKET-085-A-R1 聚焦回归：removeOpaqueWhiteBackground 白底转透明预处理。
 *
 * 断言：
 * 1) 白底 Logo 转透明后：边缘连通白 alpha=0，Logo 内部色保留；
 * 2) 与边缘隔断的内部白色不被掏空（红框围住的内部白 alpha=255）；
 * 3) compositeLogoOnScene 对转换后 Logo 放行（不再 LOGO_OPAQUE_WHITE_BACKGROUND）；
 * 4) 合成安全门对原始白底 Logo 仍拒绝（行为不变）。
 */
import sharp from "sharp";
import {
  compositeLogoOnScene,
  removeOpaqueWhiteBackground,
} from "../src/lib/vi-manual/logo-scene-compositor";

let passCount = 0;
let failCount = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passCount += 1;
    console.log(`PASS ${name}`);
  } else {
    failCount += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

async function buildWhiteBgLogo(): Promise<Buffer> {
  const svg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="100" fill="#FFFFFF"/>
    <rect x="60" y="25" width="80" height="50" fill="#B33A2B"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildIsolatedInteriorWhiteLogo(): Promise<Buffer> {
  // 白底 + 红色边框把内部白色区域与边缘隔开
  const svg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="100" fill="#FFFFFF"/>
    <rect x="10" y="10" width="10" height="80" fill="#B33A2B"/>
    <rect x="180" y="10" width="10" height="80" fill="#B33A2B"/>
    <rect x="10" y="10" width="180" height="10" fill="#B33A2B"/>
    <rect x="10" y="80" width="180" height="10" fill="#B33A2B"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildBackground(): Promise<Buffer> {
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="#E8E4DC"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function alphaAt(buffer: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return data[offset + 3];
}

async function main(): Promise<void> {
  const whiteLogo = await buildWhiteBgLogo();
  const converted = await removeOpaqueWhiteBackground(whiteLogo);
  const meta = await sharp(converted).metadata();

  check("输出为 PNG", meta.format === "png", `format=${meta.format}`);
  check("输出含 alpha 通道", meta.hasAlpha === true, `hasAlpha=${meta.hasAlpha}`);
  check(
    "边缘连通白已透明（左上角 alpha=0）",
    (await alphaAt(converted, 0, 0)) === 0,
    `alpha=${await alphaAt(converted, 0, 0)}`
  );
  check(
    "Logo 内部色保留（中心红块 alpha=255）",
    (await alphaAt(converted, 100, 50)) === 255,
    `alpha=${await alphaAt(converted, 100, 50)}`
  );

  const isolated = await buildIsolatedInteriorWhiteLogo();
  const isolatedConverted = await removeOpaqueWhiteBackground(isolated);
  check(
    "红框隔断的内部白不被掏空（中心 alpha=255）",
    (await alphaAt(isolatedConverted, 100, 50)) === 255,
    `alpha=${await alphaAt(isolatedConverted, 100, 50)}`
  );
  check(
    "红框外白底仍透明（左上角 alpha=0）",
    (await alphaAt(isolatedConverted, 0, 0)) === 0,
    `alpha=${await alphaAt(isolatedConverted, 0, 0)}`
  );

  const background = await buildBackground();
  const compositeConverted = await compositeLogoOnScene({
    background,
    logo: converted,
    sceneKey: "stationery-1",
  });
  check(
    "转换后 Logo 合成放行（ok=true）",
    compositeConverted.ok === true,
    compositeConverted.ok ? "" : `${compositeConverted.errorCode}: ${compositeConverted.message}`
  );

  const compositeRaw = await compositeLogoOnScene({
    background,
    logo: whiteLogo,
    sceneKey: "stationery-1",
  });
  check(
    "原始白底 Logo 仍被安全门拒绝（门未放宽）",
    compositeRaw.ok === false && compositeRaw.errorCode === "LOGO_OPAQUE_WHITE_BACKGROUND",
    compositeRaw.ok ? "unexpectedly ok" : compositeRaw.errorCode
  );

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL " + (err instanceof Error ? err.message : String(err)));
  process.exit(2);
});
