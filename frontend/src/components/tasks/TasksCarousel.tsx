import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/pagination'

import type { Task } from '../../types/task'


interface Props {
  tasks: Task[]
}


function getUrgency(plannedDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(plannedDate)
  target.setHours(0, 0, 0, 0)

  const diff =
    (target.getTime() - today.getTime()) /
    86400000

  if (diff < 0) {
    return {
      label: 'overdue',
      className: 'overdue',
    }
  }

  if (diff === 0) {
    return {
      label: 'today',
      className: 'today',
    }
  }

  if (diff === 1) {
    return {
      label: 'tomorrow',
      className: 'tomorrow',
    }
  }

  return {
    label: `${Math.round(diff)} days`,
    className: 'upcoming',
  }
}


export default function TaskCarousel({
  tasks,
}: Props) {
  if (!tasks.length) {
    return null
  }

  return (
    <div className="dashboard-section">

      <h2>Scheduled Tasks</h2>

      <Swiper
        modules={[
          Autoplay,
          Pagination,
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
        {tasks.map((task) => {
          const urgency = getUrgency(
            task.planned_date
          )

          return (
            <SwiperSlide key={task.id}>

              <div className="job-card">

                <div className="job-card__header">

                  <span className="job-number">
                    {task.task_id}
                  </span>

                  <span
                    className={
                      `urgency ${urgency.className}`
                    }
                  >
                    {urgency.label}
                  </span>

                </div>

                <div className="job-device">
                  {task.device}
                </div>

                <div className="job-description">
                  {task.description}
                </div>

                <div className="job-meta">

                  <span>
                    Planned:{' '}
                    {new Date(
                      task.planned_date
                    ).toLocaleDateString(
                      'en-GB'
                    )}
                  </span>

                  <span>
                    {task.status}
                  </span>

                </div>

              </div>

            </SwiperSlide>
          )
        })}
      </Swiper>

    </div>
  )
}