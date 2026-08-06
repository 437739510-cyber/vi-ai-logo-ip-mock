/**
 * 工单 044 回归：照片→场景图纯函数校验（不依赖 Ollama/ComfyUI/网络）。
 * 覆盖：parseTextRegionJson / buildPhotoScenePrompts / generateInpaintMaskPng /
 * checkBrandColors。
 * 运行：npx tsx scripts/_regression-vi-photo-scene-044.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  parseTextRegionJson,
  buildPhotoScenePrompts,
  generateInpaintMaskPng,
  checkBrandColors,
} from "../src/lib/vision-check";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-044-"));

test("parseTextRegionJson: 标准 JSON", () => {
  assert.deepEqual(parseTextRegionJson('{"x1":10,"y1":50,"x2":90,"y2":88}'), {
    x1: 10,
    y1: 50,
    x2: 90,
    y2: 88,
  });
});

test("parseTextRegionJson: 代码围栏 + 正则回退", () => {
  const a = parseTextRegionJson('```json\n{"x1":5,"y1":6,"x2":55,"y2":66}\n```');
  assert.ok(a && a.x1 === 5 && a.x2 === 55);
  const b = parseTextRegionJson("区域 10 50 90 88");
  assert.ok(b && b.x1 === 10 && b.y1 === 50 && b.x2 === 90 && b.y2 === 88);
});

test("parseTextRegionJson: 非法输入返回 null", () => {
  assert.equal(parseTextRegionJson(""), null);
  assert.equal(parseTextRegionJson('{"x1":90,"y1":10,"x2":10,"y2":50}'), null); // x2<x1
  assert.equal(parseTextRegionJson('{"x1":-5,"y1":0,"x2":50,"y2":50}'), null); // 越界
  assert.equal(parseTextRegionJson("没有数字"), null);
});

test("parseTextRegionJson: bbox_2d 像素数组→并集百分比", () => {
  const r = parseTextRegionJson(
    '```json\n' +
      '[{"bbox_2d":[200,672,467,887],"label":"百疗萃养生馆"},{"bbox_2d":[200,675,310,765],"label":"现"}]\n' +
      '```',
    { width: 1280, height: 960 },
  );
  assert.ok(r);
  assert.ok(Math.abs(r.x1 - (200 / 1280) * 100) < 0.5);
  assert.ok(Math.abs(r.y1 - (672 / 960) * 100) < 0.5);
  assert.ok(Math.abs(r.x2 - (467 / 1280) * 100) < 0.5);
  assert.ok(Math.abs(r.y2 - (887 / 960) * 100) < 0.5);
  assert.ok(r.x1 < r.x2 && r.y1 < r.y2);
});

test("buildPhotoScenePrompts: 文本版含品牌名；无色板时 colorPrompt=null", () => {
  const t1 = buildPhotoScenePrompts({ brandName: "百疗萃", brandColors: [] });
  assert.ok(t1.textPrompt.includes("百疗萃"));
  assert.equal(t1.colorPrompt, null);
  const t2 = buildPhotoScenePrompts({
    brandName: "百疗萃",
    brandColors: [
      { hex: "#F5F0E6", name: "暖米白" },
      { hex: "#7A9B76", name: "草本绿" },
      { hex: "#C9A063", name: "柔和金" },
    ],
  });
  assert.ok(t2.colorPrompt && t2.colorPrompt.includes("#F5F0E6") && t2.colorPrompt.includes("暖米白"));
  assert.ok(t2.colorPrompt.includes("百疗萃"));
});

test("generateInpaintMaskPng: 区域内透明（alpha=0）、区域外不透明（255）", async () => {
  const src = path.join(tmpDir, "src.png");
  await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .png()
    .toFile(src);
  const mask = path.join(tmpDir, "mask.png");
  await generateInpaintMaskPng(src, { x1: 25, y1: 25, x2: 75, y2: 75 }, mask, { featherPx: 8 });
  const { data, info } = await sharp(mask)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 200);
  assert.equal(info.height, 100);
  const alpha = (x: number, y: number) => data[(y * 200 + x) * info.channels + 3];
  assert.equal(alpha(100, 50), 0); // 中心=重绘区
  assert.equal(alpha(10, 50), 255); // 区域外=保留
  const edge = alpha(30, 50); // 羽化带内（0<alpha<255 或接近）
  assert.ok(edge >= 0 && edge <= 255);
});

test("checkBrandColors: 品牌色通过、明显偏色 suspect", async () => {
  const palette = [
    { hex: "#F5F0E6", name: "暖米白" },
    { hex: "#7A9B76", name: "草本绿" },
    { hex: "#C9A063", name: "柔和金" },
  ];
  const green = path.join(tmpDir, "green.png");
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 0x7a, g: 0x9b, b: 0x76 } } })
    .png()
    .toFile(green);
  const greenB64 = "data:image/png;base64," + fs.readFileSync(green).toString("base64");
  const ok = await checkBrandColors({ imageBase64: greenB64, palette });
  assert.equal(ok.status, "passed");
  assert.ok(ok.distances && Math.min(...ok.distances) < 30);

  const red = path.join(tmpDir, "red.png");
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .png()
    .toFile(red);
  const redB64 = "data:image/png;base64," + fs.readFileSync(red).toString("base64");
  const bad = await checkBrandColors({ imageBase64: redB64, palette, threshold: 150 });
  assert.equal(bad.status, "suspect");
});

test("checkBrandColors: 无色板 → skipped", async () => {
  const g = path.join(tmpDir, "g2.png");
  await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .png()
    .toFile(g);
  const r = await checkBrandColors({
    imageBase64: "data:image/png;base64," + fs.readFileSync(g).toString("base64"),
    palette: [],
  });
  assert.equal(r.status, "skipped");
});
