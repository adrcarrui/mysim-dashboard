import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";

import { Dashboard } from "./pages/Dashboard/Dashboard";
import { Tasks } from "./pages/Tasks/Tasks";
import { AirbusDemo } from "./pages/AirbusDemo/AirbusDemo";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/new"
            element={<AirbusDemo />}
          />

          <Route
            path="/tasks"
            element={<Tasks />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}