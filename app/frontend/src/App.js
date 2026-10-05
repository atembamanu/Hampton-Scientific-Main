import { useEffect } from 'react';

import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';

import { Toaster } from './components/ui/sonner';

import { QuoteProvider } from './context/QuoteContext';

import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmProvider';
import { SessionExpiryWatcher } from './components/SessionExpiryWatcher';

import { ProtectedRoute } from './components/facility/ProtectedRoute';

import { FacilityLayout } from './components/facility/FacilityLayout';



import { Header } from './components/Header';

import { Footer } from './components/Footer';

import { Home } from './pages/Home';

import { Products } from './pages/Products';

import { ProductDetail } from './pages/ProductDetail';

import { About } from './pages/About';

import { Contact } from './pages/Contact';

import { Training } from './pages/Training';
import { OrderManagement } from './pages/OrderManagement';

import { NotFound } from './pages/NotFound';
import { Careers } from './pages/Careers';
import { CareerDetail } from './pages/CareerDetail';

import { TemplateQuoteCart } from './pages/TemplateQuoteCart';

import { Login } from './pages/Login';

import { Register } from './pages/Register';

import { ForgotPassword } from './pages/ForgotPassword';

import { ResetPassword } from './pages/ResetPassword';
import { NewsletterUnsubscribe } from './pages/NewsletterUnsubscribe';

import { FacilityDashboard } from './pages/facility/FacilityDashboard';

import { Branches } from './pages/facility/Branches';

import { Users } from './pages/facility/Users';

import { OrganizationSettings } from './pages/facility/OrganizationSettings';

import { Quotes } from './pages/facility/Quotes';
import { QuoteDetail } from './pages/facility/QuoteDetail';

import { Orders } from './pages/facility/Orders';

import { OrderDetail } from './pages/facility/OrderDetail';

import { Invoices } from './pages/facility/Invoices';
import { InvoiceDetail } from './pages/facility/InvoiceDetail';

import { Reports } from './pages/facility/Reports';

import { FacilityProducts } from './pages/facility/FacilityProducts';

import { FacilityProductDetail } from './pages/facility/FacilityProductDetail';

import { FacilityQuoteBasket } from './pages/facility/FacilityQuoteBasket';

import { FacilityProfile } from './pages/facility/FacilityProfile';

import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRoute } from './components/admin/AdminRoute';
import { OpsDashboard } from './pages/admin/OpsDashboard';
import { QuoteQueue } from './pages/admin/QuoteQueue';
import { QuoteWorkspace } from './pages/admin/QuoteWorkspace';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminOrderWorkspace } from './pages/admin/AdminOrderWorkspace';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminCustomerDetail } from './pages/admin/AdminCustomerDetail';
import { AdminMessages } from './pages/admin/AdminMessages';
import { AdminDeliveries } from './pages/admin/AdminDeliveries';
import { AdminDeliveryLocations } from './pages/admin/AdminDeliveryLocations';
import { AdminBranches } from './pages/admin/AdminBranches';
import { AdminLegacyTab } from './pages/admin/AdminLegacyTab';
import { AdminCompanyStaff } from './pages/admin/AdminCompanyStaff';
import { AdminInvoices } from './pages/admin/AdminInvoices';
import { AdminInvoiceWorkspace } from './pages/admin/AdminInvoiceWorkspace';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminCategories } from './pages/admin/AdminCategories';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminCareers } from './pages/admin/AdminCareers';
import { AdminCareerApplication } from './pages/admin/AdminCareerApplication';
import { AdminField } from './pages/admin/AdminField';
import { AdminSalesTargets } from './pages/admin/AdminSalesTargets';
import { AdminFieldCheckIn } from './pages/admin/AdminFieldCheckIn';
import { AdminFieldDetail } from './pages/admin/AdminFieldDetail';
import { AdminFieldRegister } from './pages/admin/AdminFieldRegister';



import './App.css';



function ScrollToTop() {

  const { pathname } = useLocation();

  useEffect(() => {

    window.scrollTo({ top: 0, behavior: 'smooth' });

  }, [pathname]);

  return null;

}



function TemplateLayout({ children }) {
  return (
    <>
      <Header />
      <div className="pt-public-nav min-h-screen flex flex-col bg-cream">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </>
  );
}



const LegacyCustomerRedirect = () => {
  const { orgId } = useParams();
  return <Navigate to={`/sysadmin/facilities/${orgId}`} replace />;
};

function App() {

  return (

    <div className="App">

      <AuthProvider>

        <QuoteProvider>

          <BrowserRouter>
            <ConfirmProvider>
            <SessionExpiryWatcher />

            <ScrollToTop />

            <Routes>

              <Route path="/" element={<TemplateLayout><Home /></TemplateLayout>} />

              <Route path="/products" element={<TemplateLayout><Products /></TemplateLayout>} />

              <Route path="/products/:slug" element={<TemplateLayout><ProductDetail /></TemplateLayout>} />

              <Route path="/quote-cart" element={<TemplateLayout><TemplateQuoteCart /></TemplateLayout>} />

              <Route path="/training" element={<TemplateLayout><Training /></TemplateLayout>} />
              <Route path="/order-management" element={<TemplateLayout><OrderManagement /></TemplateLayout>} />

              <Route path="/about" element={<TemplateLayout><About /></TemplateLayout>} />

              <Route path="/contact" element={<TemplateLayout><Contact /></TemplateLayout>} />
              <Route path="/careers" element={<TemplateLayout><Careers /></TemplateLayout>} />
              <Route path="/careers/:jobId" element={<TemplateLayout><CareerDetail /></TemplateLayout>} />



              <Route path="/login" element={<Login />} />

              <Route path="/register" element={<Register />} />

              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />



              <Route path="/dashboard" element={

                <ProtectedRoute>

                  <FacilityLayout />

                </ProtectedRoute>

              }>

                <Route index element={<ProtectedRoute permission="dashboard"><FacilityDashboard /></ProtectedRoute>} />

                <Route path="products" element={<ProtectedRoute permission="products"><FacilityProducts /></ProtectedRoute>} />

                <Route path="products/:slug" element={<ProtectedRoute permission="products"><FacilityProductDetail /></ProtectedRoute>} />

                <Route path="quote" element={<ProtectedRoute permission="products"><FacilityQuoteBasket /></ProtectedRoute>} />

                <Route path="profile" element={<ProtectedRoute permission="profile"><FacilityProfile /></ProtectedRoute>} />

                <Route path="quotes" element={<ProtectedRoute permission="quotes"><Quotes /></ProtectedRoute>} />

                <Route path="quotes/:quoteId" element={<ProtectedRoute permission="quotes"><QuoteDetail /></ProtectedRoute>} />

                <Route path="orders" element={<ProtectedRoute permission="orders"><Orders /></ProtectedRoute>} />

                <Route path="orders/:orderId" element={<ProtectedRoute permission="orders"><OrderDetail /></ProtectedRoute>} />

                <Route path="branches" element={<ProtectedRoute permission="branches"><Branches /></ProtectedRoute>} />

                <Route path="users" element={<ProtectedRoute permission="users"><Users /></ProtectedRoute>} />

                <Route path="invoices" element={<ProtectedRoute permission="invoices"><Invoices /></ProtectedRoute>} />

                <Route path="invoices/:invoiceId" element={<ProtectedRoute permission="invoices"><InvoiceDetail /></ProtectedRoute>} />

                <Route path="reports" element={<ProtectedRoute permission="reports"><Reports /></ProtectedRoute>} />

                <Route path="settings" element={<ProtectedRoute permission="org_settings"><OrganizationSettings /></ProtectedRoute>} />

              </Route>



              <Route path="/sysadmin" element={<AdminLogin />} />

              <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route path="/sysadmin/dashboard" element={<AdminRoute permission="dashboard"><OpsDashboard /></AdminRoute>} />
                <Route path="/sysadmin/quote-requests" element={<AdminRoute permission="quotes"><QuoteQueue title="Quote Requests" defaultOpsStatus="submitted" /></AdminRoute>} />
                <Route path="/sysadmin/quotes" element={<AdminRoute permission="quotes"><QuoteQueue title="Quotes" /></AdminRoute>} />
                <Route path="/sysadmin/quotes/:quoteId" element={<AdminRoute permission="quotes"><QuoteWorkspace /></AdminRoute>} />
                <Route path="/sysadmin/orders" element={<AdminRoute permission="orders"><AdminOrders /></AdminRoute>} />
                <Route path="/sysadmin/orders/:orderId" element={<AdminRoute permission="orders"><AdminOrderWorkspace /></AdminRoute>} />
                <Route path="/sysadmin/facilities" element={<AdminRoute permission="facilities"><AdminCustomers /></AdminRoute>} />
                <Route path="/sysadmin/facilities/:orgId" element={<AdminRoute permission="facilities"><AdminCustomerDetail /></AdminRoute>} />
                <Route path="/sysadmin/customers" element={<Navigate to="/sysadmin/facilities" replace />} />
                <Route path="/sysadmin/customers/:orgId" element={<LegacyCustomerRedirect />} />
                <Route path="/sysadmin/products" element={<AdminRoute permission="catalogue"><AdminProducts /></AdminRoute>} />
                <Route path="/sysadmin/categories" element={<AdminRoute permission="catalogue"><AdminCategories /></AdminRoute>} />
                <Route path="/sysadmin/pricing" element={<AdminRoute permission="catalogue"><AdminProducts /></AdminRoute>} />
                <Route path="/sysadmin/deliveries" element={<AdminRoute permission="deliveries"><AdminDeliveries /></AdminRoute>} />
                <Route path="/sysadmin/delivery-locations" element={<AdminRoute permission="deliveries"><AdminDeliveryLocations /></AdminRoute>} />
                <Route path="/sysadmin/invoices" element={<AdminRoute permission="invoices"><AdminInvoices /></AdminRoute>} />
                <Route path="/sysadmin/invoices/:invoiceId" element={<AdminRoute permission="invoices"><AdminInvoiceWorkspace /></AdminRoute>} />
                <Route path="/sysadmin/payments" element={<AdminRoute permission="invoices"><AdminInvoices /></AdminRoute>} />
                <Route path="/sysadmin/reports" element={<AdminRoute permission="reports"><AdminReports /></AdminRoute>} />
                <Route path="/sysadmin/messages" element={<AdminRoute permission="messages"><AdminMessages /></AdminRoute>} />
                <Route path="/sysadmin/sales-targets" element={<AdminRoute permission="field"><AdminSalesTargets /></AdminRoute>} />
                <Route path="/sysadmin/field" element={<AdminRoute permission="field"><AdminField /></AdminRoute>} />
                <Route path="/sysadmin/field/check-in" element={<AdminRoute permission="field"><AdminFieldCheckIn /></AdminRoute>} />
                <Route path="/sysadmin/field/register" element={<AdminRoute permission="field"><AdminFieldRegister /></AdminRoute>} />
                <Route path="/sysadmin/field/:prospectId/check-in" element={<AdminRoute permission="field"><AdminFieldCheckIn /></AdminRoute>} />
                <Route path="/sysadmin/field/:prospectId" element={<AdminRoute permission="field"><AdminFieldDetail /></AdminRoute>} />
                <Route path="/sysadmin/users" element={<AdminRoute permission="company_users"><AdminCompanyStaff /></AdminRoute>} />
                <Route path="/sysadmin/careers" element={<AdminRoute permission="careers"><AdminCareers /></AdminRoute>} />
                <Route path="/sysadmin/careers/applications/:applicationId" element={<AdminRoute permission="careers"><AdminCareerApplication /></AdminRoute>} />
                <Route path="/sysadmin/branches" element={<AdminRoute permission="facilities"><AdminBranches /></AdminRoute>} />
                <Route path="/sysadmin/settings" element={<AdminRoute permission="settings"><AdminLegacyTab tab="settings" /></AdminRoute>} />
              </Route>


              <Route path="*" element={<TemplateLayout><NotFound /></TemplateLayout>} />

            </Routes>

            <Toaster position="top-right" style={{ zIndex: 80 }} />
            </ConfirmProvider>

          </BrowserRouter>

        </QuoteProvider>

      </AuthProvider>

    </div>

  );

}



export default App;

