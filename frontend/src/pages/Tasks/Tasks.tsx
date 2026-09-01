// frontend/src/pages/Tasks/Tasks.tsx

import {
  useEffect,
  useState,
} from "react";

import {
  getUpcomingTasks,
} from "../../api/tasks";

import type {
  Task,
} from "../../types/task";

import {
  TasksList,
} from "../../components/TasksList";

import "./Tasks.css";


export function Tasks() {
  const [
    tasks,
    setTasks,
  ] = useState<Task[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        setError(null);

        const data =
          await getUpcomingTasks(
            7
          );

        setTasks(data);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load scheduled tasks."
        );
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, []);

  if (loading) {
    return (
      <main className="tasks-page">
        Loading tasks...
      </main>
    );
  }

  if (error) {
    return (
      <main className="tasks-page">
        <div className="tasks-page__error">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="tasks-page">
      <header className="tasks-page__header">
        <div>
          <div className="tasks-page__eyebrow">
            Maintenance & Support
          </div>

          <h1 className="tasks-page__title">
            Scheduled Tasks
          </h1>

          <p className="tasks-page__subtitle">
            Upcoming maintenance tasks
            grouped by date and device.
          </p>
        </div>

        <div className="tasks-page__total">
          <strong>
            {tasks.length}
          </strong>

          <span>
            scheduled tasks
          </span>
        </div>
      </header>

      <TasksList
        tasks={tasks}
      />
    </main>
  );
}