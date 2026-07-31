import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeBrandName } from "../brand-name-normalizer";

test("normalizeBrandName fixes high-confidence 荼店 typo", () => {
  assert.equal(normalizeBrandName("有间荼店"), "有间奶茶店");
});

test("normalizeBrandName trims spaces before fixing typo", () => {
  assert.equal(normalizeBrandName(" 有间荼店 "), "有间奶茶店");
});

test("normalizeBrandName leaves a correct brand name unchanged", () => {
  assert.equal(normalizeBrandName("有间奶茶店"), "有间奶茶店");
});

test("normalizeBrandName collapses full-width and repeated spaces", () => {
  assert.equal(normalizeBrandName("有间\u3000\u3000奶茶店"), "有间 奶茶店");
});

test("normalizeBrandName returns empty string for empty input", () => {
  assert.equal(normalizeBrandName(""), "");
});
