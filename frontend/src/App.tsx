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
  Availability,
} from "./pages/Availability/Availability";

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
                to="/availability"
                replace
              />
            }
          />

          <Route
            path="availability"
            element={<Availability />}
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