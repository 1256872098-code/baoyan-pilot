import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import AssessmentPage from "./pages/AssessmentPage.jsx";
import SchoolsPage from "./pages/SchoolsPage.jsx";
import ReviewAssistantPage from "./pages/ReviewAssistantPage.jsx";
import AiRecommendChat from "./pages/AiRecommendChat.jsx";

export default function App() {
  const location = useLocation();
  const hideFooter = location.pathname === "/ai-recommend";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/schools" element={<SchoolsPage />} />
          <Route path="/review" element={<ReviewAssistantPage />} />
          <Route path="/ai-recommend" element={<AiRecommendChat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
