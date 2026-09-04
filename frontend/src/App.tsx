import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  AppLayout,
} from "./layouts/AppLayout";

import {
  Dashboard,
} from "./pages/Dashboard/Dashboard";

import {
  Jobs,
} from "./pages/Jobs/Jobs";

import { 
  DRs,
} from "./pages/DRs/DRs";

import { 
  Actions,
} from "./pages/Actions/Actions"

import {
  Tasks,
} from "./pages/Tasks/Tasks";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          element={<AppLayout />}
        >

          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="jobs"
            element={<Jobs />}
          />
          
          <Route
            path="drs"
            element={<DRs />}
          />

          <Route
            path="actions"
            element={<Actions />}
          />

          <Route
            path="tasks"
            element={<Tasks />}
          />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}