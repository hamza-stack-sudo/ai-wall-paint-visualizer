import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WallPaintVisualizer from './WallPaintVisualizer';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<WallPaintVisualizer />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
