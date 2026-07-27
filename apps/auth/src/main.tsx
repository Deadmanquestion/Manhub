import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LogoutPage, SingleSignOnPage, UnauthorizedPage } from "@manhub/auth";

function AuthApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<SingleSignOnPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><AuthApp /></BrowserRouter></StrictMode>);
