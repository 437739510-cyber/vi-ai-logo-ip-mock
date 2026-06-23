import PptxGenJS from "pptxgenjs";
export const SW = 8.27, SH = 11.69, MARGIN = 0.7, CONTENT_W = SW - MARGIN * 2, LEFT_BAR_W = 0.12;
export function createSlide(p: PptxGenJS) { return p.addSlide(); }
export function addLeftBar(s: any, c: string) { s.addShape("rect", { x: 0, y: 0, w: LEFT_BAR_W, h: SH, fill: { color: c } }); }
export function addBottomLine(s: any, c: string) { s.addShape("rect", { x: MARGIN, y: SH - 0.3, w: CONTENT_W, h: 0.02, fill: { color: c } }); }
export function resolveColor(c?: string, f?: string): string { return (!c||c==="#FFFFFF"||c==="#1A73E8") ? (f||"#37474F") : c; }
export function hx(c: string): string { return c.startsWith("#") ? c : "#" + c; }
