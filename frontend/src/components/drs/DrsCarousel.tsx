import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination } from "swiper/modules"

import "swiper/css"
import "swiper/css/pagination"

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
        modules={[Autoplay, Pagination]}
        spaceBetween={24}
        slidesPerView={3}
        pagination={{
          clickable: true,
        }}
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