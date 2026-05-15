import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import MusicPlayer from "./MusicPlayer";
import CpSoapCalculator from "./CpSoapCalculator";
import HpPasteSoapCalculator from "./HpPasteSoapCalculator";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MusicPlayer />} />
        <Route path="/soap" element={<CpSoapCalculator />} />
        <Route path="/soap-hp" element={<HpPasteSoapCalculator />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
