import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay} from "swiper/modules"

import "swiper/css"

import type { Task } from "../../types/task"
import TaskCard from "./TaskCard"


interface Props {
  title: string
  tasks: Task[]
}


export function TasksCarousel({
  title,
  tasks,
}: Props) {
  if (!tasks.length) {
    return null
  }

  return (
    <section className="jobs-section">
      <h2>{title}</h2>

      <Swiper
        modules={[
          Autoplay,
        ]}
        spaceBetween={24}
        slidesPerView={3}
        autoplay={{
          delay: 10000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
      >
        {tasks.map((task) => (
          <SwiperSlide key={task.scheduled_task_id}>
            <TaskCard task={task} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}
