/* 图片槽：证件照 / 作品二维码。点击选图，自动居中裁方并压缩 */

import { useRef, useState } from "react";

import { fileToSquareDataUrl } from "../../../lib/image";
import { IconImage, IconQr, IconX } from "../../icons";
import { Spinner } from "../../kit/misc";
import { toast } from "../../kit/Toast";

export function ImageSlot({
  value,
  onChange,
  label,
  kind = "avatar",
  size = 64,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  kind?: "avatar" | "qr";
  size?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      // 二维码用 PNG：JPEG 的压缩块会糊掉模块边缘，影响扫码
      const url = await fileToSquareDataUrl(file, kind === "qr" ? 600 : 480, kind === "qr" ? "image/png" : "image/jpeg");
      onChange(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "图片处理失败", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={value ? `更换${label}` : `上传${label}`}
        title={value ? `更换${label}` : `上传${label}`}
        className="surface curve press relative flex h-full w-full items-center justify-center overflow-hidden text-fg-4 hover:text-fg-2"
        style={{ ["--r" as string]: "16px" }}
      >
        {value ? (
          <img src={value} alt="" className={`h-full w-full ${kind === "qr" ? "bg-white object-contain p-1" : "object-cover"}`} />
        ) : kind === "qr" ? (
          <IconQr className="h-5 w-5" />
        ) : (
          <IconImage className="h-5 w-5" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-[var(--card-2)]">
            <Spinner className="h-4 w-4 text-fg-2" />
          </span>
        )}
      </button>
      {value && !busy && (
        <button
          type="button"
          aria-label={`移除${label}`}
          onClick={() => onChange("")}
          className="solid press absolute -right-1.5 -top-1.5 flex h-5 w-5 scale-90 items-center justify-center rounded-full opacity-0 transition-[opacity,transform] duration-200 group-hover:scale-100 group-hover:opacity-100"
        >
          <IconX className="h-3 w-3" />
        </button>
      )}
      <span className="pointer-events-none absolute inset-x-0 -bottom-5 text-center text-[10px] text-fg-4">{label}</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
