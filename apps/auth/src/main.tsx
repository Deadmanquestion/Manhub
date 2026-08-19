import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  LogoutPage,
  PartnerLandingPage,
  PortalSelectionPage,
  SetPasswordPage,
  SingleSignOnPage,
  SupplierApplicationPage,
  TechnicianApplicationPage,
  UnauthorizedPage,
  WorkshopApplicationPage,
} from "@manhub/auth";

function AuthApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<SingleSignOnPage />} />
      <Route path="/register" element={<SingleSignOnPage initialMode="customer-register" />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/select-portal" element={<PortalSelectionPage />} />
      <Route path="/partners" element={<PartnerLandingPage />} />
      <Route path="/apply/supplier" element={<SupplierApplicationPage />} />
      <Route path="/apply/workshop" element={<WorkshopApplicationPage />} />
      <Route path="/apply/technician" element={<TechnicianApplicationPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><HashRouter><AuthApp /></HashRouter></StrictMode>);
