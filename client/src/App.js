import { HashRouter, Routes, Route } from "react-router-dom";
import CombinedPolls from "./CombinedPolls";
import AdminPage from "./AdminPage";

function App() {
  return (
    <HashRouter>
      <div style={{ maxWidth: 520, margin: "20px auto", fontFamily: "Arial" }}>
        <h2 style={{ color: "#0f766e" }}>CHAAT Poll</h2>

        <Routes>
          <Route path="/" element={<CombinedPolls />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
