import { Routes, Route } from "react-router-dom";

import { Dashboard } from "./pages/Dashboard/Dashboard";
import { AirbusDemo } from "./pages/AirbusDemo/AirbusDemo";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/new" element={<AirbusDemo />} />
    </Routes>
  );
}

export default App;