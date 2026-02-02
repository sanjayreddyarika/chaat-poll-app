import { BrowserRouter, Routes, Route } from "react-router-dom";
import CombinedPolls from "./CombinedPolls";
import AdminPage from "./AdminPage";

function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 520, margin: "20px auto", fontFamily: "Arial" }}>
        <h2 style={{ color: "#0f766e" }}>CHAAT Poll</h2>

        {/* Admin is NOT shown publicly. You must type /admin manually */}
        <Routes>
          <Route path="/" element={<CombinedPolls />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
