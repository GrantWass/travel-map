"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.max(pixelCrop.width, pixelCrop.height);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    (size - pixelCrop.width) / 2,
    (size - pixelCrop.height) / 2,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

interface ImageCropModalProps {
  file: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function ImageCropModal({ file, onCrop, onCancel }: ImageCropModalProps) {
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const croppedFile = await getCroppedFile(imageUrl, croppedAreaPixels, file.name);
      onCrop(croppedFile);
    } finally {
      setIsCropping(false);
      URL.revokeObjectURL(imageUrl);
    }
  }, [croppedAreaPixels, imageUrl, file.name, onCrop]);

  const handleCancel = useCallback(() => {
    URL.revokeObjectURL(imageUrl);
    onCancel();
  }, [imageUrl, onCancel]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm backdrop-fade">
      <div className="relative flex w-[min(480px,92vw)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl modal-expand-center">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Crop to square</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs hover:text-foreground"
            aria-label="Cancel crop"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative h-[340px] w-full bg-zinc-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            objectFit="contain"
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-gradient-to-r from-primary to-primary/90 px-5 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25"
              onClick={() => void handleCrop()}
              disabled={isCropping}
            >
              {isCropping ? "Cropping..." : "Crop"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
