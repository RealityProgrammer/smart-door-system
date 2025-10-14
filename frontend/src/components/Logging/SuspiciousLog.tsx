import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {useEffect, useState} from "react";
import {SuspiciousInfo} from "@/types";
import {apiService} from "@/services/api";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {Swiper, SwiperClass, SwiperSlide} from "swiper/react";
import {Navigation, Pagination} from "swiper/modules";
import {Badge} from "@/components/ui/badge";

export function SuspiciousLog() {
  const [openModal, setOpenModal] = useState<boolean>();
  const [suspicious, setSuspicious] = useState<SuspiciousInfo[] | null | "error">(null);

  useEffect(() => {
    if (!openModal) return;

    async function startFetching() {
      setSuspicious(null);
      const result = await apiService.getSuspiciousList();

      if (!ignore) {
        if (Array.isArray(result)) {
          setSuspicious(result);
        } else {
          setSuspicious("error");
        }
      }
    }

    let ignore = false;
    startFetching();
    return () => {
      ignore = true;
    }
  }, [openModal]);

  const [suspiciousIndex, setSuspiciousIndex] = useState(0);

  const onSliderChange = (slider: SwiperClass) : void => {
    setSuspiciousIndex(slider.realIndex);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Nghi ngờ
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              Xem
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2/3">
            <DialogHeader>
              <DialogTitle>Nhật ký nghi vấn</DialogTitle>
            </DialogHeader>

            { Array.isArray(suspicious) && (
              <div className="w-full max-w-full min-w-0">
                <div className="relative block" style={{ WebkitUserSelect: "none", KhtmlUserSelect: "none", MozUserSelect: "none" }}>
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
                    {suspicious.map((sus) => (
                      <SwiperSlide key={sus.id}>
                        <img src={sus.image_url} alt=""/>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>

                <div className="flex justify-between">
                  <span>Thời gian chụp:</span>
                  <Badge variant="outline">{new Date(suspicious[suspiciousIndex].created_at).toLocaleString("vi-VN")}</Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}