import { useEffect } from 'react';
import "./App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { Training } from "./pages/Training";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { QuoteCart } from "./pages/QuoteCart";
import { Register } from "./pages/Register";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import { NotFound } from "./pages/NotFound";
import { Chatbot } from "./components/Chatbot";
import { Toaster } from "./components/ui/sonner";
import { QuoteProvider } from "./context/QuoteContext";
import { AuthProvider } from "./context/AuthContext";

// Scroll to top component
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [pathname]);

  return null;
}

// Layout for public pages (with Header, Footer, Chatbot)
function PublicLayout({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <Chatbot />
    </>
  );
}

// Layout for admin pages (no Header, Footer, Chatbot)
function AdminLayout({ children }) {
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <QuoteProvider>
        <div className="App">
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Admin Routes - No Header/Footer */}
              <Route path="/sysadmin" element={
                <AdminLayout>
                  <AdminLogin />
                </AdminLayout>
              } />
              <Route path="/sysadmin/dashboard" element={
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              } />
              
              {/* Public Routes - With Header/Footer */}
              <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
              <Route path="/products" element={<PublicLayout><Products /></PublicLayout>} />
              <Route path="/training" element={<PublicLayout><Training /></PublicLayout>} />
              <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
              <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
              <Route path="/quote-cart" element={<PublicLayout><QuoteCart /></PublicLayout>} />
              <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
              <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
              <Route path="/profile" element={<PublicLayout><Profile /></PublicLayout>} />
              <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
              <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
              
              {/* 404 - With Header/Footer */}
              <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
            </Routes>
            <Toaster position="top-right" />
          </BrowserRouter>
        </div>
      </QuoteProvider>
    </AuthProvider>
  );
}

export default App;
