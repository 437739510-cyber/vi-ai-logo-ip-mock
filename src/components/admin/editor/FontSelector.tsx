"use client";

import type { Typography } from "@/types";

interface FontSelectorProps {
  typography: Typography;
  onChange: (typography: Typography) => void;
}

const FONT_OPTIONS = [
  "Noto Sans SC",
  "思源黑体",
  "思源宋体",
  "阿里巴巴普惠体",
  "OPPO Sans",
  "HarmonyOS Sans",
  "PingFang SC",
  "Helvetica Neue",
  "Inter",
  "Poppins",
  "Roboto",
];

const WEIGHT_OPTIONS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi Bold" },
  { value: 700, label: "Bold" },
  { value: 900, label: "Black" },
];

interface FontGroupProps {
  label: string;
  spec: { font: string; weights: number[] };
  onChange: (spec: { font: string; weights: number[] }) => void;
}

function FontGroup({ label, spec, onChange }: FontGroupProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <select
        value={spec.font}
        onChange={(e) => onChange({ ...spec, font: e.target.value })}
        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {WEIGHT_OPTIONS.map((w) => {
          const isSelected = spec.weights.includes(w.value);
          return (
            <button
              key={w.value}
              onClick={() => {
                const newWeights = isSelected
                  ? spec.weights.filter((v) => v !== w.value)
                  : [...spec.weights, w.value].sort();
                onChange({ ...spec, weights: newWeights });
              }}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
              }`}
            >
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FontSelector({ typography, onChange }: FontSelectorProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-neutral-700">字体规范</h4>

      <div className="space-y-4">
        <div className="pb-3 border-b border-neutral-100">
          <p className="text-xs text-neutral-400 mb-2">中文</p>
          <FontGroup
            label="标题"
            spec={typography.chinese.heading}
            onChange={(spec) =>
              onChange({
                ...typography,
                chinese: { ...typography.chinese, heading: spec },
              })
            }
          />
          <div className="mt-3">
            <FontGroup
              label="正文"
              spec={typography.chinese.body}
              onChange={(spec) =>
                onChange({
                  ...typography,
                  chinese: { ...typography.chinese, body: spec },
                })
              }
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-neutral-400 mb-2">英文</p>
          <FontGroup
            label="标题"
            spec={typography.english.heading}
            onChange={(spec) =>
              onChange({
                ...typography,
                english: { ...typography.english, heading: spec },
              })
            }
          />
          <div className="mt-3">
            <FontGroup
              label="正文"
              spec={typography.english.body}
              onChange={(spec) =>
                onChange({
                  ...typography,
                  english: { ...typography.english, body: spec },
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
