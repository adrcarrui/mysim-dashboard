import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination } from "swiper/modules"

import "swiper/css"
import "swiper/css/pagination"

import type { Job } from "../../types/job"
import { JobCard } from "./JobCard"

type Props = {
  title: string
  jobs: Job[]
}

export function JobsCarousel({
  title,
  jobs,
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
        {jobs.map((job) => (
          <SwiperSlide key={job.id}>
            <JobCard job={job} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}