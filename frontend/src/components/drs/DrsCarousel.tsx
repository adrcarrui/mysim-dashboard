import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay } from "swiper/modules"

import "swiper/css"

import type { Dr } from "../../types/dr"
import { DrCard } from "./DrCard"

type Props = {
  title: string
  drs: Dr[]
}

export function DrsCarousel({
  title,
  drs,
}: Props) {
  return (
    <section className="jobs-section">
      <h2>{title}</h2>

      <Swiper
        modules={[Autoplay]}
        spaceBetween={24}
        slidesPerView={3}
        autoplay={{
          delay: 10000,
          disableOnInteraction: false,
        }}
      >
        {drs.map((dr) => (
          <SwiperSlide key={dr.id}>
            <DrCard dr={dr} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}