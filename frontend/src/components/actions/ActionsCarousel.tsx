import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay } from "swiper/modules"

import "swiper/css"

import type { Action } from "../../types/action"
import { ActionCard } from "./ActionCard"

type Props = {
  title: string
  actions: Action[]
}

export function ActionsCarousel({
  title,
  actions,
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
        {actions.map((action, index) => (
          <SwiperSlide
            key={
              action.id ??
              action.action_id ??
              `action-${index}`
            }
          >
            <ActionCard action={action} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}
