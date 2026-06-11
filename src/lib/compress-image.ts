import sharp from "sharp";

/**
 * V30: 压缩base64图片，减小PPTX/PDF体积
 */
export async function compressImage(
  base64Data: string,
  options: { maxWidth?: number; quality?: number; isLogo?: boolean } = {}
): Promise<string> {
  const { maxWidth = 800, quality = 80, isLogo = false } = options;
  
  try {
    const isDataUri = base64Data.startsWith("data:");
    let rawBase64 = base64Data;
    
    if (isDataUri) {
      const commaIdx = base64Data.indexOf(",");
      if (commaIdx > 0) {
        rawBase64 = base64Data.substring(commaIdx + 1);
      }
    }
    
    const inputBuffer = Buffer.from(rawBase64, "base64");
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width || maxWidth;
    
    // Skip if already small enough
    if (width <= maxWidth && inputBuffer.length < 200 * 1024) {
      return base64Data;
    }
    
    let pipeline = sharp(inputBuffer).resize(maxWidth, null, { 
      withoutEnlargement: true,
      fit: "inside" 
    });
    
    let outputMime: string;
    if (isLogo) {
      pipeline = pipeline.png({ quality });
      outputMime = "image/png";
    } else {
      pipeline = pipeline.jpeg({ quality });
      outputMime = "image/jpeg";
    }
    
    const outputBuffer = await pipeline.toBuffer();
    const outputBase64 = outputBuffer.toString("base64");
    
    console.log(`[compress] ${width}px→≤${maxWidth}px, ${inputBuffer.length}→${outputBuffer.length} bytes, ${isLogo ? "PNG" : "JPEG"}`);
    return `data:${outputMime};base64,${outputBase64}`;
  } catch (e: any) {
    console.warn("[compress] Failed, using original:", e.message);
    return base64Data;
  }
}
