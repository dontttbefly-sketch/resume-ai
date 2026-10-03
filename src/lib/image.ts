/* 图片处理：居中裁成正方形并压缩，避免证件照把 localStorage 撑爆 */

export function fileToSquareDataUrl(
  file: File,
  maxEdge = 480,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (side === 0) throw new Error("图片尺寸异常");

        const out = Math.min(maxEdge, side);
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("当前浏览器不支持图片处理");

        if (mime === "image/jpeg") {
          // JPEG 没有透明通道，先铺白底，免得透明 PNG 变黑
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, out, out);
        }
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2,
          (img.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          out,
          out,
        );
        resolve(canvas.toDataURL(mime, 0.9));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("图片处理失败"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，换一张试试"));
    };

    img.src = url;
  });
}
