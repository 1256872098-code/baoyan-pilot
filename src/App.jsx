import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import SchoolsPage from "./pages/SchoolsPage.jsx";
import SchoolDetailPage from "./pages/SchoolDetailPage.jsx";
import CollegeDetailPage from "./pages/CollegeDetailPage.jsx";
import AiRecommendChat from "./pages/AiRecommendChat.jsx";
import ForumPage from "./pages/ForumPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import MySchoolPage from "./pages/MySchoolPage.jsx";
import WantBaoyanPage from "./pages/WantBaoyanPage.jsx";
import { featureFlags } from "./config/features.js";

export default function App() {
  const location = useLocation();
  const isHomePage = location.pathname === "/";
  const hideFooter = isHomePage || location.pathname === "/ai-recommend";

  return (
    <div className={`${isHomePage ? "h-[100svh] overflow-hidden" : "min-h-screen"} bg-slate-50 text-slate-900`}>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/assessment" element={<Navigate to="/ai-recommend" replace />} />
          <Route path="/profile-assessment" element={<Navigate to="/ai-recommend" replace />} />
          <Route path="/evaluation" element={<Navigate to="/ai-recommend" replace />} />
          {featureFlags.schoolDatabase ? (
            <>
              <Route path="/schools" element={<SchoolsPage />} />
              <Route path="/schools/:schoolId" element={<SchoolDetailPage />} />
              <Route path="/schools/:schoolId/colleges/:collegeId" element={<CollegeDetailPage />} />
            </>
          ) : (
            <Route path="/schools/*" element={<Navigate to="/" replace />} />
          )}
          <Route path="/my-school" element={<MySchoolPage />} />
          <Route path="/want-baoyan" element={<WantBaoyanPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/ai-recommend" element={<AiRecommendChat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
