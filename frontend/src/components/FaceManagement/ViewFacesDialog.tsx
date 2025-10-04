import { Dialog, DialogHeader, DialogTitle, DialogContent } from "@/components/ui/dialog";
import { FaceVariation, VARIATION_TYPES } from "@/types";
import { Swiper, SwiperSlide, SwiperClass } from 'swiper/react';

import { Navigation, Pagination } from "swiper/modules";
import { useState } from "react";

import 'swiper/css';
import 'swiper/css/navigation'
import 'swiper/css/scrollbar'
import 'swiper/css/pagination'
import {CardTitle} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ViewFacesDialogProps {
  isOpen: boolean;
  onOpenChange?(open: boolean): void;
  faceVariations: FaceVariation[];
}

export function ViewFacesDialog({ isOpen, onOpenChange, faceVariations } : ViewFacesDialogProps) {
  const [variationIndex, setVariationIndex] = useState(0);  // Assume the Swiper always start at index 0.

  const onSliderChange = (slider: SwiperClass) : void => {
    setVariationIndex(slider.realIndex);
  };

  // TODO: Delete variation after somebody pull an ID system for Face variation.

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2/3 xl:max-w-2/3">
        <DialogHeader>
          <DialogTitle>Thông tin các variation</DialogTitle>
        </DialogHeader>

        { /* Image Carousel */}
        <div className="relative block w-full max-w-full min-w-0" style={{ WebkitUserSelect: "none", KhtmlUserSelect: "none", MozUserSelect: "none" }}>
          <Swiper
            modules={[ Navigation, Pagination ]}
            spaceBetween={50}
            slidesPerView={1}
            navigation={{ }}
            pagination={{ clickable: true }}
            className="w-2/3 aspect-video"
            onSlideChange={onSliderChange}
            loop={true}
          >
            {faceVariations.map((faceVariation) => (
              <SwiperSlide key={faceVariation.image_path}>
                <img src={faceVariation.image_url} alt=""/>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="flex justify-between">
          <span>Loại:</span>
          <Badge variant="outline">{VARIATION_TYPES.find(x => x.value == faceVariations[variationIndex].type)?.label || "???"}</Badge>
        </div>

        <div className="flex justify-between">
          <span>Thời gian chụp:</span>
          <Badge variant="outline">{new Date(faceVariations[variationIndex].added_date).toLocaleString("vi-VN")}</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}