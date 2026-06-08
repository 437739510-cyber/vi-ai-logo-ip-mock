"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";

interface BrandColor {
  name: string;
  hex: string;
  cmyk?: string;
  rgb?: string;
  usage?: string;
}

interface ColorPaletteProps {
  colors: {
    primary: BrandColor;
    secondary: BrandColor;
    accent: BrandColor;
    neutrals: BrandColor[];
    hierarchy?: { level: string; colors: string[]; usage: string }[];
    matchingRules?: string;
  };
  onChange: (colors: ColorPaletteProps["colors"]) => void;
}

export function ColorPalette({ colors, onChange }: ColorPaletteProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editingHex, setEditingHex] = useState("");

  const updateColor = (key: string, hex: string) => {
    if (key.startsWith("neutral-")) {
      const idx = parseInt(key.split("-")[1]);
      const neutrals = [...colors.neutrals];
      neutrals[idx] = { ...neutrals[idx], hex };
      onChange({ ...colors, neutrals });
    } else {
      onChange({ ...colors, [key]: { ...(colors as any)[key], hex } });
    }
  };

  const updateName = (key: string, name: string) => {
    if (key.startsWith("neutral-")) {
      const idx = parseInt(key.split("-")[1]);
      const neutrals = [...colors.neutrals];
      neutrals[idx] = { ...neutrals[idx], name };
      onChange({ ...colors, neutrals });
    } else {
      onChange({ ...colors, [key]: { ...(colors as any)[key], name } });
    }
  };

  const addNeutral = () => {
    onChange({
      ...colors,
      neutrals: [...colors.neutrals, { name: "新色", hex: "#CCCCCC" }],
    });
  };

  const removeNeutral = (idx: number) => {
    const neutrals = colors.neutrals.filter((_, i) => i !== idx);
    onChange({ ...colors, neutrals });
  };

  const ColorItem = ({
    label,
    color,
    colorKey,
    isNeutral = false,
    onRemove,
  }: {
    label: string;
    color: BrandColor;
    colorKey: string;
    isNeutral?: boolean;
    onRemove?: () => void;
  }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-neutral-300 hover:text-danger transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg border border-neutral-200 cursor-pointer shrink-0"
          style={{ backgroundColor: color.hex }}
          onClick={() => {
            setEditing(colorKey);
            setEditingHex(color.hex);
          }}
        />
        <input
          value={color.name}
          onChange={(e) => updateName(colorKey, e.target.value)}
          className="w-20 px-1.5 py-1 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          value={color.hex}
          onChange={(e) => updateColor(colorKey, e.target.value)}
          className="w-20 px-1.5 py-1 text-xs font-mono border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-primary uppercase"
        />
      </div>

      {/* 取色器弹窗 */}
      {editing === colorKey && (
        <div className="absolute z-10 mt-1">
          <div className="fixed inset-0" onClick={() => setEditing(null)} />
          <div className="relative">
            <HexColorPicker
              color={editingHex}
              onChange={(hex) => {
                setEditingHex(hex);
                updateColor(colorKey, hex);
              }}
              style={{ width: 180, height: 140 }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-neutral-700">品牌色板</h4>

      <div className="space-y-3 relative">
        <ColorItem label="主色" color={colors.primary} colorKey="primary" />
        <ColorItem label="辅助色" color={colors.secondary} colorKey="secondary" />
        <ColorItem label="强调色" color={colors.accent} colorKey="accent" />

        <div className="pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500">中性色</span>
            <button
              onClick={addNeutral}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> 添加
            </button>
          </div>
          <div className="space-y-2">
            {colors.neutrals.map((n, i) => (
              <ColorItem
                key={i}
                label={`中性色 ${i + 1}`}
                color={n}
                colorKey={`neutral-${i}`}
                onRemove={() => removeNeutral(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
