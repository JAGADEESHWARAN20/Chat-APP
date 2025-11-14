"use client";

import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { cn } from "@/lib/utils";

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

    const handleCropComplete = useCallback(
      (_: Area, pixels: Area) => {
        setCroppedAreaPixels(pixels);
      },
      []
    );

    return (
      <div className="relative h-full w-full bg-gradient-to-br from-background to-muted rounded-xl overflow-hidden border border-border shadow-inner">
        
        {/* Cropper Layer */}
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={true}
          objectFit="cover"
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={handleCropComplete}
          classes={{
            containerClassName: "w-full h-full",
            mediaClassName: "transition-all duration-300 ease-out",
            cropAreaClassName: cn(
              "rounded-full border-2 border-primary/40 shadow-xl",
              "bg-black/10 backdrop-blur-sm"
            ),            
          }}
        />

{/* Dark mask outside crop area */}
<div className="absolute inset-0 pointer-events-none">
  <div className="absolute inset-0 backdrop-brightness-[0.45] pointer-events-none" />
</div>

{/* Glass highlight circle */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  <div
    className="
      pointer-events-none
      w-[65%] aspect-square rounded-full 
      border border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.2)]
      backdrop-blur-sm mix-blend-overlay
    "
  />
</div>

{/* Outer guide ring */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  <div
    className="
      pointer-events-none
      w-[75%] aspect-square rounded-full 
      border border-primary/20
    "
  />
</div>



        
      </div>
    );
  }
);

AvatarCropperUI.displayName = "AvatarCropperUI";
export default AvatarCropperUI;
