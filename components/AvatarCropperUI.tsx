// components/AvatarCropperUI.tsx
"use client";
import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { cn } from "@/lib/utils"; // For class merging

export type CropperRef = {
  getCroppedArea: () => Area | null;
};

interface Props {
  imageSrc: string;
  crop: Point;
  zoom: number;
  onCropChange: (crop: Point) => void;
  onZoomChange: (zoom: number) => void;
}

const AvatarCropperUI = forwardRef<CropperRef, Props>(
  ({ imageSrc, crop, zoom, onCropChange, onZoomChange }, ref) => {
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getCroppedArea: () => croppedAreaPixels,
      }),
      [croppedAreaPixels]
    );

    const handleCropComplete = useCallback((_: Area, pixels: Area) => {
      setCroppedAreaPixels(pixels);
    }, []);

    return (
      <div className="relative h-full w-full">
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden",
            "border-2 border-border/50 hover:border-primary/30 transition-colors duration-200"
          )}
        >
       <Cropper
  image={imageSrc}
  crop={crop}
  zoom={zoom}
  aspect={1}
  cropShape="round"
  showGrid={true}  // Basic grid; style via CSS below if needed
  objectFit="horizontal-cover"
  onCropChange={onCropChange}
  onZoomChange={onZoomChange}
  onCropComplete={handleCropComplete}
  classes={{
    containerClassName: "h-full w-full",
    mediaClassName: "object-cover rounded-full",  // All styling here
    cropAreaClassName: "border-4 border-primary/50 rounded-full shadow-2xl",
  }}
/>
        </div>
        {/* Premium Overlay for Crop Area */}
        <div className="absolute inset-0 pointer-events-none">
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-primary/20 bg-white/10"
            style={{ pointerEvents: "none" }}
          />
        </div>
      </div>
    );
  }
);

AvatarCropperUI.displayName = "AvatarCropperUI";
export default AvatarCropperUI;