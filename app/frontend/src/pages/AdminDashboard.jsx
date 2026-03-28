import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import {
  Users,
  FileText,
  Package,
  Mail,
  TrendingUp,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Download,
  Edit,
  Trash2,
  Send,
  Receipt,
  UserPlus,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  Link,
  BarChart3,
  PieChart,
  Calendar,
  ArrowUpRight,
  Settings,
  Eye,
  FolderOpen,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { getFullImageUrl, API_URL } from "../utils/imageHelper";

// ======== Slide-Out Panel Component ========
const SlideOutPanel = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "w-[40vw]",
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative ${width} min-w-[400px] max-w-[700px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="close-panel-btn"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// ======== Sidebar Navigation Items ========
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "users", label: "Users", icon: Users },
  { id: "products", label: "Products", icon: Package },
  { id: "categories", label: "Categories", icon: FolderOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [adminToken, setAdminToken] = useState(null);
  const [stats, setStats] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Date range filter
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  // Panel states (replacing modals)
  const [panelType, setPanelType] = useState(null);
  const [panelData, setPanelData] = useState(null);

  // Product filters & pagination
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Admin quote product & customer dropdown search (local filters)
  const [quoteProductDropdownFilter, setQuoteProductDropdownFilter] =
    useState("");
  const [quoteCustomerDropdownFilter, setQuoteCustomerDropdownFilter] =
    useState("");

  // Modify-quote product search (remote)
  const [modifyProductSearch, setModifyProductSearch] = useState("");
  const [modifyProductResults, setModifyProductResults] = useState([]);
  const [modifyProductSearchLoading, setModifyProductSearchLoading] =
    useState(false);

  // User filters & pagination
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);

  // Quote pagination
  const [quotePage, setQuotePage] = useState(1);

  // Image upload states
  const [imageUploadType, setImageUploadType] = useState("url");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Form states
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    facilityName: "",
    facilityType: "",
    address: "",
    city: "",
    role: "customer",
    can_login: true,
  });
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    package: "",
    stocking_unit: "",
    category_id: "",
    description: "",
    in_stock: true,
    image_url: "",
  });
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [editCategory, setEditCategory] = useState(null);
  const [modifyQuoteData, setModifyQuoteData] = useState({
    items: [],
    discount_amount: 0,
    tax_rate: 16,
    validity_days: 30,
    notes: "",
  });

  // Settings state
  const [siteSettings, setSiteSettings] = useState({
    company_name: "",
    website: "",
    address: "",
    po_box: "",
    phone: "",
    email: "",
    working_hours: "",
    default_payment_terms: "Net 30",
    default_quote_validity_days: 7,
    default_invoice_due_days: 14,
    default_tax_rate: 16,
    default_include_vat: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState("site-info");
  const [followUpSettings, setFollowUpSettings] = useState({
    quote_followup_enabled: true,
    quote_followup_hours: 24,
    invoice_followup_enabled: true,
    invoice_followup_days: 7,
    invoice_overdue_reminder_days: 3,
  });
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [showEmailLogs, setShowEmailLogs] = useState(false);

  const [quoteFormData, setQuoteFormData] = useState({
    user_id: "",
    facility_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    validity_days: 7,
    items: [
      {
        product_id: "",
        product_name: "",
        category: "",
        quantity: 1,
        unit_price: 0,
      },
    ],
    discount_amount: 0,
    tax_rate: 16,
    include_vat: true,
    notes: "",
  });
  const [quoteFormLoading, setQuoteFormLoading] = useState(false);
  const [quoteUpdateLoading, setQuoteUpdateLoading] = useState(false);
  const [quoteSendLoading, setQuoteSendLoading] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [editingQuoteRef, setEditingQuoteRef] = useState("");

  const getAuthHeader = () =>
    adminToken ? { Authorization: `Bearer ${adminToken}` } : {};

  const handleAdminLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    toast.success("Logged out successfully");
    navigate("/sysadmin");
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const userStr = localStorage.getItem("admin_user");
    if (!token || !userStr) {
      navigate("/sysadmin");
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== "admin") {
        toast.error("Admin access required");
        navigate("/sysadmin");
        return;
      }
      setAdminUser(user);
      setAdminToken(token);
    } catch (e) {
      navigate("/sysadmin");
    }
  }, [navigate]);

  // 15-min inactivity timeout
  useEffect(() => {
    if (!adminToken) return;
    const TIMEOUT = 15 * 60 * 1000;
    let timeoutId;
    const reset = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        toast.error("Session expired due to inactivity.");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        navigate("/sysadmin");
      }, TIMEOUT);
    };
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((e) => document.addEventListener(e, reset));
    reset();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [adminToken, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Inline auth header to keep `fetchData` stable and avoid dependency churn.
      const headers = adminToken
        ? { Authorization: `Bearer ${adminToken}` }
        : {};
      const [
        statsRes,
        quotesRes,
        usersRes,
        productsRes,
        categoriesRes,
        settingsRes,
        invoicesRes,
        emailSettingsRes,
      ] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { headers }),
        axios.get(`${API_URL}/api/admin/quotes?limit=100`, { headers }),
        axios.get(`${API_URL}/api/admin/users?limit=100`, { headers }),
        axios.get(`${API_URL}/api/products`),
        axios.get(`${API_URL}/api/products/categories`),
        axios.get(`${API_URL}/api/settings`),
        axios.get(`${API_URL}/api/admin/invoices?limit=100`, { headers }),
        axios
          .get(`${API_URL}/api/admin/email-settings`, { headers })
          .catch(() => ({ data: {} })),
      ]);
      setStats(statsRes.data);
      setQuotes(quotesRes.data.quotes || []);
      setUsers(usersRes.data.users || []);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setSiteSettings(settingsRes.data);
      setInvoices(invoicesRes.data.invoices || []);
      if (
        emailSettingsRes.data &&
        Object.keys(emailSettingsRes.data).length > 0
      ) {
        setFollowUpSettings((prev) => ({ ...prev, ...emailSettingsRes.data }));
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("Admin access required");
        navigate("/");
      } else toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [adminToken, navigate]);

  useEffect(() => {
    if (adminToken && adminUser?.role === "admin") fetchData();
  }, [adminToken, adminUser, fetchData]);

  // Date range filter
  const getFilteredByDateRange = (data) => {
    if (dateRange === "all") return data;
    const now = new Date();
    let startDate;
    if (dateRange === "7days")
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === "30days")
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === "90days")
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (dateRange === "custom" && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      return data.filter((item) => {
        const d = new Date(item.created_at);
        return d >= startDate && d <= endDate;
      });
    } else return data;
    return data.filter((item) => new Date(item.created_at) >= startDate);
  };

  // ======== CRUD Handlers ========
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await axios.put(`${API_URL}/api/admin/settings`, siteSettings, {
        headers: getAuthHeader(),
      });
      toast.success("Settings saved!");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSettingsLoading(false);
    }
  };
  const handleSaveFollowUpSettings = async () => {
    setFollowUpLoading(true);
    try {
      await axios.put(`${API_URL}/api/admin/email-settings`, followUpSettings, {
        headers: getAuthHeader(),
      });
      toast.success("Email settings saved!");
    } catch (e) {
      toast.error("Failed to save email settings");
    } finally {
      setFollowUpLoading(false);
    }
  };
  const handleFetchEmailLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/email-logs?limit=50`, {
        headers: getAuthHeader(),
      });
      setEmailLogs(res.data.logs || []);
      setShowEmailLogs(true);
    } catch (e) {
      toast.error("Failed to load email logs");
    }
  };

  const updateQuoteStatus = async (quoteId, newStatus) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/quotes/${quoteId}/status`,
        { status: newStatus },
        { headers: getAuthHeader() },
      );
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q)),
      );
      toast.success(`Quote status updated to ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/admin/users`, newUser, {
        headers: getAuthHeader(),
      });
      toast.success(
        `User created! ${newUser.can_login ? `Temp password: ${res.data.temp_password}` : ""}`,
      );
      setPanelType(null);
      setNewUser({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        facilityName: "",
        facilityType: "",
        address: "",
        city: "",
        role: "customer",
        can_login: true,
      });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: getAuthHeader(),
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted");
    } catch (e) {
      toast.error("Failed to delete user");
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/admin/users/${panelData.id}`, panelData, {
        headers: getAuthHeader(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === panelData.id ? { ...u, ...panelData } : u)),
      );
      toast.success("User updated!");
      setPanelType(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update user");
    }
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  const handleImageFileChange = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Max 5MB");
        return;
      }
      setImageFile(file);
      const b64 = await fileToBase64(file);
      setImagePreview(b64);
      if (isEdit) setPanelData((prev) => ({ ...prev, image_url: b64 }));
      else setNewProduct((prev) => ({ ...prev, image_url: b64 }));
    }
  };
  const resetImageStates = () => {
    setImageUploadType("url");
    setImageFile(null);
    setImagePreview("");
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setProductLoading(true);
    try {
      let response;
      if (imageUploadType === "file" && imageFile) {
        const formData = new FormData();
        formData.append("name", newProduct.name);
        formData.append("category_id", newProduct.category_id);
        formData.append("price", parseFloat(newProduct.price) || 0);
        formData.append("package", newProduct.package || "");
        formData.append("stocking_unit", newProduct.stocking_unit || "");
        formData.append("description", newProduct.description || "");
        formData.append("in_stock", newProduct.in_stock);
        formData.append("image_url", "");
        formData.append("image", imageFile);
        response = await axios.post(
          `${API_URL}/api/admin/products/with-image`,
          formData,
          {
            headers: {
              ...getAuthHeader(),
              "Content-Type": "multipart/form-data",
            },
          },
        );
      } else {
        response = await axios.post(
          `${API_URL}/api/admin/products`,
          { ...newProduct, price: parseFloat(newProduct.price) || 0 },
          { headers: getAuthHeader() },
        );
      }
      if (response.data.product)
        setProducts((prev) => [...prev, response.data.product]);
      else await fetchData();
      toast.success("Product created!");
      setPanelType(null);
      setNewProduct({
        name: "",
        price: "",
        package: "",
        stocking_unit: "",
        category_id: "",
        description: "",
        in_stock: true,
        image_url: "",
      });
      resetImageStates();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create product");
    } finally {
      setProductLoading(false);
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setProductLoading(true);
    try {
      let finalImageUrl = panelData.image_url;
      if (imageUploadType === "file" && imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await axios.post(
          `${API_URL}/api/admin/products/upload-image`,
          formData,
          {
            headers: {
              ...getAuthHeader(),
              "Content-Type": "multipart/form-data",
            },
          },
        );
        finalImageUrl = uploadRes.data.image_url;
      }
      const productData = {
        ...panelData,
        image_url: finalImageUrl,
        price: parseFloat(panelData.price) || 0,
      };
      await axios.put(
        `${API_URL}/api/admin/products/${panelData.product_id}`,
        productData,
        { headers: getAuthHeader() },
      );
      setProducts((prev) =>
        prev.map((p) =>
          p.product_id === panelData.product_id ? { ...p, ...productData } : p,
        ),
      );
      toast.success("Product updated!");
      setPanelType(null);
      resetImageStates();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update product");
    } finally {
      setProductLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API_URL}/api/admin/products/${productId}`, {
        headers: getAuthHeader(),
      });
      setProducts((prev) => prev.filter((p) => p.product_id !== productId));
      toast.success("Product deleted");
    } catch (e) {
      toast.error("Failed to delete product");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/categories`,
        newCategory,
        { headers: getAuthHeader() },
      );
      setCategories((prev) => [...prev, res.data.category]);
      toast.success("Category created!");
      setPanelType(null);
      setNewCategory({ name: "", description: "" });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create category");
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `${API_URL}/api/admin/categories/${editCategory.category_id}`,
        editCategory,
        { headers: getAuthHeader() },
      );
      setCategories((prev) =>
        prev.map((c) =>
          c.category_id === editCategory.category_id ? res.data.category : c,
        ),
      );
      toast.success("Category updated!");
      setPanelType(null);
      setEditCategory(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update category");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await axios.delete(`${API_URL}/api/admin/categories/${categoryId}`, {
        headers: getAuthHeader(),
      });
      setCategories((prev) => prev.filter((c) => c.category_id !== categoryId));
      toast.success("Category deleted");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete category");
    }
  };

  const handleModifyQuote = async (quoteId) => {
    try {
      await axios.post(
        `${API_URL}/api/admin/quotes/${quoteId}/modify`,
        modifyQuoteData,
        { headers: getAuthHeader() },
      );
      toast.success("Modified quote sent to customer!");
      setPanelType(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to modify quote");
    }
  };

  const handleCreateInvoice = async (quoteId) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/invoices`,
        {
          quote_id: quoteId,
          payment_terms: 30,
        },
        { headers: getAuthHeader() },
      );
      toast.success(`Invoice ${res.data.invoice_number} created!`);
      setPanelType(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create invoice");
    }
  };

  const downloadQuotePDF = async (quoteId) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/admin/quotes/${quoteId}/pdf`,
        { headers: getAuthHeader(), responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `quote_${quoteId.slice(0, 8).toUpperCase()}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF downloaded!");
    } catch (e) {
      toast.error("Failed to download PDF");
    }
  };

  const handleBulkImport = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        `${API_URL}/api/admin/products/bulk-import`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            "Content-Type": "multipart/form-data",
          },
        },
      );
      toast.success(
        `Imported ${res.data.imported}, Updated ${res.data.updated}`,
      );
      setPanelType(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to import");
    }
  };

  // ======== Computed / Filtered Data ========
  const filteredQuotesAll = quotes
    .filter((q) => statusFilter === "all" || q.status === statusFilter)
    .filter(
      (q) =>
        searchTerm === "" ||
        q.facility_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.email?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortOrder === "newest")
        return new Date(b.created_at) - new Date(a.created_at);
      if (sortOrder === "oldest")
        return new Date(a.created_at) - new Date(b.created_at);
      if (sortOrder === "value-high") {
        return (
          (b.items?.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0) ||
            0) -
          (a.items?.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0) ||
            0)
        );
      }
      return 0;
    });
  const totalQuotePages = Math.ceil(filteredQuotesAll.length / ITEMS_PER_PAGE);
  const filteredQuotes = filteredQuotesAll.slice(
    (quotePage - 1) * ITEMS_PER_PAGE,
    quotePage * ITEMS_PER_PAGE,
  );

  const filteredProductsAll = products
    .filter(
      (p) =>
        productCategoryFilter === "all" ||
        p.category_id === productCategoryFilter,
    )
    .filter(
      (p) =>
        productSearch === "" ||
        p.name?.toLowerCase().includes(productSearch.toLowerCase()),
    );
  const totalProductPages = Math.ceil(
    filteredProductsAll.length / ITEMS_PER_PAGE,
  );
  const filteredProducts = filteredProductsAll.slice(
    (productPage - 1) * ITEMS_PER_PAGE,
    productPage * ITEMS_PER_PAGE,
  );

  const filteredUsersAll = users
    .filter((u) => userRoleFilter === "all" || u.role === userRoleFilter)
    .filter(
      (u) =>
        userSearch === "" ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.firstName?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(userSearch.toLowerCase()),
    );
  const totalUserPages = Math.ceil(filteredUsersAll.length / ITEMS_PER_PAGE);
  const filteredUsers = filteredUsersAll.slice(
    (userPage - 1) * ITEMS_PER_PAGE,
    userPage * ITEMS_PER_PAGE,
  );

  // Search products (remote) while modifying an existing quote
  const handleModifyProductSearch = async () => {
    const query = modifyProductSearch.trim();
    if (!query) {
      setModifyProductResults([]);
      return;
    }
    setModifyProductSearchLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/products/search`, {
        params: { q: query },
      });
      setModifyProductResults(res.data || []);
    } catch (error) {
      console.error("Modify quote product search failed", error);
      toast.error("Failed to search products");
    } finally {
      setModifyProductSearchLoading(false);
    }
  };

  const handleAddSearchedProductToModifyQuote = (product) => {
    if (!product) return;
    const alreadySelected = (modifyQuoteData.items || []).some(
      (it) => it?.product_id && it.product_id === product.product_id,
    );
    if (alreadySelected) {
      toast.info("That product is already in this quote");
      return;
    }
    setModifyQuoteData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: product.product_id,
          product_name: product.name,
          category: product.category_name,
          quantity: 1,
          original_price: product.price || 0,
          modified_price: product.price || 0,
          customer_proposed_price: 0,
          discount_percent: 0,
          notes: "",
        },
      ],
    }));
  };

  const handleCreateAdminQuote = async (e) => {
    e.preventDefault();

    // Validation
    if (
      !quoteFormData.facility_name ||
      !quoteFormData.contact_person ||
      !quoteFormData.email ||
      !quoteFormData.phone
    ) {
      toast.error("Please fill in all required customer fields");
      return;
    }

    if (
      quoteFormData.items.length === 0 ||
      quoteFormData.items.some((i) => !i.product_id || i.quantity < 1)
    ) {
      toast.error(
        "Please add at least one product with valid quantity and price",
      );
      return;
    }

    setQuoteFormLoading(true);
    setQuoteUpdateLoading(true);

    try {
      const quotePayload = {
        user_id: quoteFormData.user_id || null,
        facility_name: quoteFormData.facility_name,
        contact_person: quoteFormData.contact_person,
        email: quoteFormData.email,
        phone: quoteFormData.phone,
        address: quoteFormData.address,
        validity_days:
          parseInt(quoteFormData.validity_days, 10) ||
          siteSettings.default_quote_validity_days ||
          7,
        items: quoteFormData.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price) || 0,
        })),
        discount_amount: parseFloat(quoteFormData.discount_amount) || 0,
        tax_rate: parseFloat(quoteFormData.tax_rate) || 16,
        include_vat: quoteFormData.include_vat,
        notes: quoteFormData.notes,
      };

      if (editingQuoteId) {
        await axios.put(
          `${API_URL}/api/admin/quotes/${editingQuoteId}`,
          quotePayload,
          { headers: getAuthHeader() },
        );
        toast.success("Quote updated!");
      } else {
        await axios.post(`${API_URL}/api/admin/quotes`, quotePayload, {
          headers: getAuthHeader(),
        });
        toast.success("Quote created and sent to customer!");
      }

      setPanelType(null);
      setEditingQuoteId(null);
      setEditingQuoteRef("");

      // Reset form
      setQuoteFormData({
        user_id: "",
        facility_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        validity_days: siteSettings.default_quote_validity_days ?? 7,
        items: [
          {
            product_id: "",
            product_name: "",
            category: "",
            quantity: 1,
            unit_price: 0,
          },
        ],
        discount_amount: 0,
        tax_rate: siteSettings.default_tax_rate ?? 16,
        include_vat: siteSettings.default_include_vat ?? true,
        notes: "",
      });

      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create quote");
    } finally {
      setQuoteFormLoading(false);
      setQuoteUpdateLoading(false);
    }
  };

  const handleUpdateAndSendQuote = async () => {
    if (!editingQuoteId) return;
    // Validation (same rules as Update)
    if (
      !quoteFormData.facility_name ||
      !quoteFormData.contact_person ||
      !quoteFormData.email ||
      !quoteFormData.phone
    ) {
      toast.error("Please fill in all required customer fields");
      return;
    }
    if (
      quoteFormData.items.length === 0 ||
      quoteFormData.items.some((i) => !i.product_id || i.quantity < 1)
    ) {
      toast.error(
        "Please add at least one product with valid quantity and price",
      );
      return;
    }

    setQuoteFormLoading(true);
    setQuoteSendLoading(true);
    try {
      const payload = {
        facility_name: quoteFormData.facility_name,
        contact_person: quoteFormData.contact_person,
        email: quoteFormData.email,
        phone: quoteFormData.phone,
        address: quoteFormData.address,
        items: quoteFormData.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          quantity: item.quantity,
          original_price: parseFloat(item.unit_price) || 0,
          modified_price: parseFloat(item.unit_price) || 0,
          customer_proposed_price: 0,
          discount_percent: 0,
          notes: item.notes || "",
        })),
        discount_amount: parseFloat(quoteFormData.discount_amount) || 0,
        tax_rate: parseFloat(quoteFormData.tax_rate) || 16,
        include_vat: quoteFormData.include_vat,
        validity_days:
          parseInt(quoteFormData.validity_days, 10) ||
          siteSettings.default_quote_validity_days ||
          7,
        terms_and_conditions: null,
        notes: quoteFormData.notes || "",
      };

      await axios.post(
        `${API_URL}/api/admin/quotes/${editingQuoteId}/modify`,
        payload,
        { headers: getAuthHeader() },
      );
      toast.success("Quote updated and sent to customer!");

      setPanelType(null);
      setEditingQuoteId(null);
      setEditingQuoteRef("");
      fetchData();
    } catch (e) {
      toast.error(
        e.response?.data?.detail || "Failed to update and send quote",
      );
    } finally {
      setQuoteFormLoading(false);
      setQuoteSendLoading(false);
    }
  };

  // Add this helper function to calculate quote totals
  const calculateAdminQuoteTotal = () => {
    const subtotal = quoteFormData.items.reduce(
      (sum, item) => sum + (parseFloat(item.unit_price) || 0) * item.quantity,
      0,
    );
    const discount = parseFloat(quoteFormData.discount_amount) || 0;
    const taxRate = parseFloat(quoteFormData.tax_rate) || 0;
    const includeVat = quoteFormData.include_vat;
    const taxAmount = includeVat ? (subtotal - discount) * (taxRate / 100) : 0;
    const total = subtotal - discount + taxAmount;
    return { subtotal, discount, taxRate, taxAmount, total, includeVat };
  };

  const calculateQuoteValue = (items) =>
    items?.reduce((sum, i) => sum + (i.unit_price || 0) * i.quantity, 0) || 0;

  const getQuoteMonetaryTotals = (quote) => {
    const subtotal = calculateQuoteValue(quote.items);
    const discount =
      typeof quote.discount_amount === "number" ? quote.discount_amount : 0;
    const taxRate = typeof quote.tax_rate === "number" ? quote.tax_rate : 0;
    const includeVat = quote.include_vat !== false;

    const storedTaxAmount =
      typeof quote.tax_amount === "number"
        ? quote.tax_amount
        : ((subtotal - discount) * taxRate) / 100;

    const effectiveTaxAmount = includeVat ? storedTaxAmount : 0;

    const storedTotal =
      typeof quote.total === "number"
        ? quote.total
        : subtotal - discount + storedTaxAmount;

    const effectiveTotal = includeVat
      ? storedTotal
      : storedTotal - storedTaxAmount;

    return {
      subtotal,
      discount,
      taxRate,
      taxAmount: effectiveTaxAmount,
      total: effectiveTotal,
      includeVat,
    };
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      quoted: "bg-blue-100 text-blue-800",
      approved: "bg-emerald-100 text-emerald-800",
      invoiced: "bg-green-100 text-green-800",
    };
    const icons = {
      pending: <Clock className="w-3 h-3 mr-1" />,
      quoted: <FileText className="w-3 h-3 mr-1" />,
      approved: <ThumbsUp className="w-3 h-3 mr-1" />,
      invoiced: <Receipt className="w-3 h-3 mr-1" />,
    };
    return (
      <Badge
        className={`${styles[status] || styles.pending} flex items-center`}
      >
        {icons[status] || icons.pending}
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
  };

  // Open quote detail in slide-out
  const openQuotePanel = (quote) => {
    setPanelData(quote);
    setPanelType("quote-detail");
  };

  if (loading || !adminUser)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#00a550]" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="admin-dashboard">
      {/* Left Sidebar */}
      <aside
        className="w-[240px] bg-gray-900 text-white flex flex-col fixed h-screen z-30"
        data-testid="admin-sidebar"
      >
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src="/hampton-logo.svg"
              alt="Hampton Scientific"
              className="h-9 w-auto brightness-0 invert"
            />
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${activeTab === item.id ? "bg-[#006332] text-white font-semibold" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-700 px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[#006332] rounded-full flex items-center justify-center text-xs font-bold">
              {adminUser?.firstName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {adminUser?.firstName}
              </p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
          <Button
            onClick={handleAdminLogout}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800 gap-2 px-0"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-[240px] flex-1 min-h-screen">
        {/* Top Bar */}
        <div className="sticky top-0 z-20 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label || "Dashboard"}
            </h1>
          </div>
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="refresh-data-btn"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="p-6">
          {/* ======== OVERVIEW ======== */}
          {activeTab === "overview" && stats && (
            <div className="space-y-6">
              <DateRangeFilter
                dateRange={dateRange}
                setDateRange={setDateRange}
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-gradient-to-br from-[#006332] to-[#00a550] text-white">
                  <CardContent className="pt-6">
                    <p className="text-white/80 text-sm">Total Quotes</p>
                    <p className="text-3xl font-bold">
                      {getFilteredByDateRange(quotes).length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Quoted</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {
                        getFilteredByDateRange(quotes).filter(
                          (q) => q.status === "quoted",
                        ).length
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Invoiced</p>
                    <p className="text-3xl font-bold text-green-600">
                      {
                        getFilteredByDateRange(quotes).filter(
                          (q) => q.status === "invoiced",
                        ).length
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <CardContent className="pt-6">
                    <p className="text-white/80 text-sm">Est. Revenue</p>
                    <p className="text-2xl font-bold">
                      KES{" "}
                      {(
                        getFilteredByDateRange(quotes).reduce(
                          (s, q) => s + getQuoteMonetaryTotals(q).total,
                          0,
                        ) / 1000000
                      ).toFixed(2)}
                      M
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-4 h-4 text-[#006332]" /> Recent Quotes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getFilteredByDateRange(quotes)
                        .slice(0, 5)
                        .map((q) => {
                          const { total } = getQuoteMonetaryTotals(q);
                          return (
                            <div
                              key={q.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-sm">
                                  {q.facility_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(q.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm text-[#006332]">
                                  KES {total.toLocaleString()}
                                </p>
                                {getStatusBadge(q.status)}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChart className="w-4 h-4 text-[#006332]" /> Status
                      Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { s: "Quoted", c: "bg-blue-500", f: "quoted" },
                        { s: "Invoiced", c: "bg-green-600", f: "invoiced" },
                      ].map((item) => {
                        const filtered = getFilteredByDateRange(quotes);
                        const count = filtered.filter(
                          (q) => q.status === item.f,
                        ).length;
                        const pct = filtered.length
                          ? (count / filtered.length) * 100
                          : 0;
                        return (
                          <div key={item.s}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{item.s}</span>
                              <span className="font-medium">
                                {count} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`${item.c} h-2 rounded-full`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ======== ANALYTICS ======== */}
          {activeTab === "analytics" && stats && (
            <div className="space-y-6">
              <DateRangeFilter
                dateRange={dateRange}
                setDateRange={setDateRange}
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Conversion Rate</p>
                    <p className="text-2xl font-bold text-[#006332]">
                      {(() => {
                        const f = getFilteredByDateRange(quotes);
                        return f.length
                          ? (
                              (f.filter((q) => q.status === "invoiced").length /
                                f.length) *
                              100
                            ).toFixed(1)
                          : 0;
                      })()}
                      %
                    </p>
                    <p className="text-xs text-gray-400">Invoiced / Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Avg. Quote Value</p>
                    <p className="text-2xl font-bold text-blue-600">
                      KES{" "}
                      {(() => {
                        const f = getFilteredByDateRange(quotes);
                        if (!f.length) return 0;
                        const sum = f.reduce(
                          (s, q) => s + getQuoteMonetaryTotals(q).total,
                          0,
                        );
                        return Math.round(sum / f.length).toLocaleString();
                      })()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Active Users</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {users.filter((u) => u.can_login).length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-500 text-sm">Products</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {products.length}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Status Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { s: "Quoted", c: "bg-blue-500", f: "quoted" },
                        { s: "Invoiced", c: "bg-green-600", f: "invoiced" },
                      ].map((item) => {
                        const filtered = getFilteredByDateRange(quotes);
                        const count = filtered.filter(
                          (q) => q.status === item.f,
                        ).length;
                        const pct = filtered.length
                          ? (count / filtered.length) * 100
                          : 0;
                        return (
                          <div key={item.s}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{item.s}</span>
                              <span className="font-medium">
                                {count} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`${item.c} h-2 rounded-full`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Products by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categories.slice(0, 8).map((cat) => {
                        const count = products.filter(
                          (p) => p.category_id === cat.category_id,
                        ).length;
                        const pct = products.length
                          ? (count / products.length) * 100
                          : 0;
                        return (
                          <div key={cat.category_id}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600 truncate max-w-[200px]">
                                {cat.name}
                              </span>
                              <span className="font-medium">{count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#006332] h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">
                        Total Quote Value
                      </p>
                      <p className="text-xl font-bold text-[#006332]">
                        KES{" "}
                        {getFilteredByDateRange(quotes)
                          .reduce(
                            (s, q) => s + getQuoteMonetaryTotals(q).total,
                            0,
                          )
                          .toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">
                        Invoiced Revenue
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        KES{" "}
                        {getFilteredByDateRange(quotes)
                          .filter((q) => q.status === "invoiced")
                          .reduce(
                            (s, q) => s + getQuoteMonetaryTotals(q).total,
                            0,
                          )
                          .toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">
                        Quoted (Not invoiced)
                      </p>
                      <p className="text-xl font-bold text-emerald-600">
                        KES{" "}
                        {getFilteredByDateRange(quotes)
                          .filter((q) => q.status === "quoted")
                          .reduce(
                            (s, q) => s + getQuoteMonetaryTotals(q).total,
                            0,
                          )
                          .toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">
                        Paid Invoices
                      </p>
                      <p className="text-xl font-bold text-yellow-600">
                        KES{" "}
                        {getFilteredByDateRange(invoices)
                          .filter((inv) => inv.status === "paid")
                          .reduce((s, inv) => s + (inv.total || 0), 0)
                          .toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======== QUOTES ======== */}
          {activeTab === "quotes" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Quoted
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-600" />{" "}
                  Invoiced
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search quotes..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setQuotePage(1);
                      }}
                      className="pl-9"
                      data-testid="quote-search"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setQuotePage(1);
                    }}
                  >
                    <SelectTrigger
                      className="w-[150px]"
                      data-testid="quote-status-filter"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sortOrder}
                    onValueChange={(v) => {
                      setSortOrder(v);
                      setQuotePage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="value-high">Highest Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    setQuoteFormData({
                      user_id: "",
                      facility_name: "",
                      contact_person: "",
                      email: "",
                      phone: "",
                      address: "",
                      items: [
                        {
                          product_id: "",
                          product_name: "",
                          category: "",
                          quantity: 1,
                          unit_price: 0,
                        },
                      ],
                      discount_amount: 0,
                      tax_rate: siteSettings.default_tax_rate ?? 16,
                      include_vat: siteSettings.default_include_vat ?? true,
                      notes: "",
                    });
                    setPanelType("add-quote");
                  }}
                  size="sm"
                  className="bg-[#006332] hover:bg-[#005028] gap-2"
                  data-testid="add-quote-btn"
                >
                  <Plus className="w-4 h-4" /> Add Quote
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                {filteredQuotesAll.length} of {quotes.length} quotes
              </p>
              <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Quote Ref
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredQuotes.map((quote) => {
                      const quoteRef =
                        quote.quote_number ||
                        `QUO-${String(quote.id).slice(0, 8).toUpperCase()}`;
                      const canEdit = quote.status === "quoted";
                      return (
                        <tr
                          key={quote.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          data-testid={`quote-item-${quote.id}`}
                          onClick={() => openQuotePanel(quote)}
                        >
                          <td className="px-4 py-3 font-mono text-sm font-semibold text-[#006332] whitespace-nowrap">
                            {quoteRef}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {quote.facility_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {quote.items?.length || 0} items
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {quote.contact_person}
                            </div>
                            <div className="text-xs text-gray-500">
                              {quote.email}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getStatusBadge(quote.status)}
                              {quote.customer_response &&
                                quote.status !== "invoiced" &&
                                quote.status !== "approved" && (
                                  <Badge
                                    className={
                                      quote.customer_response === "accepted"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-orange-100 text-orange-800"
                                    }
                                  >
                                    Customer: {quote.customer_response}
                                  </Badge>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            KES{" "}
                            {getQuoteMonetaryTotals(
                              quote,
                            ).total.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(quote.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQuotePanel(quote);
                                }}
                              >
                                <ChevronDown className="w-3 h-3" /> View
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={`gap-1 ${canEdit ? "" : "opacity-50 cursor-not-allowed"}`}
                                disabled={!canEdit}
                                title={
                                  canEdit
                                    ? "Edit quote"
                                    : "Only Quoted quotes can be edited"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingQuoteId(quote.id);
                                  setEditingQuoteRef(quote.quote_number || "");
                                  setQuoteFormData({
                                    user_id: quote.user_id || "",
                                    facility_name: quote.facility_name || "",
                                    contact_person: quote.contact_person || "",
                                    email: quote.email || "",
                                    phone: quote.phone || "",
                                    address: quote.address || "",
                                    validity_days:
                                      quote.validity_days ??
                                      siteSettings.default_quote_validity_days ??
                                      7,
                                    items: (quote.items || []).map((it) => ({
                                      product_id: it.product_id || "",
                                      product_name: it.product_name || "",
                                      category: it.category || "",
                                      quantity: it.quantity || 1,
                                      unit_price: it.unit_price || 0,
                                    })),
                                    discount_amount: quote.discount_amount || 0,
                                    tax_rate:
                                      quote.tax_rate ??
                                      siteSettings.default_tax_rate ??
                                      16,
                                    include_vat:
                                      typeof quote.include_vat === "boolean"
                                        ? quote.include_vat
                                        : (siteSettings.default_include_vat ??
                                          true),
                                    notes: quote.notes || "",
                                  });
                                  setPanelType("add-quote");
                                }}
                              >
                                <Edit className="w-3 h-3" /> Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredQuotes.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    {quotes.length === 0 ? (
                      <>
                        <p className="text-gray-600 font-medium mb-1">
                          No Quotes Yet
                        </p>
                        <p className="text-sm text-gray-500">
                          Quotes will appear here when customers submit requests
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-600 font-medium mb-2">
                          No matching quotes found
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setStatusFilter("all");
                            setSearchTerm("");
                            setSortOrder("newest");
                            setQuotePage(1);
                          }}
                        >
                          Clear Filters
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {totalQuotePages > 1 && (
                <Pagination
                  page={quotePage}
                  setPage={setQuotePage}
                  total={totalQuotePages}
                  totalItems={filteredQuotesAll.length}
                  perPage={ITEMS_PER_PAGE}
                />
              )}
            </div>
          )}

          {/* ======== INVOICES ======== */}
          {activeTab === "invoices" && (
            <div>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">
                    No Invoices Yet
                  </p>
                  <p className="text-sm text-gray-500">
                    Invoices will appear here when generated from approved
                    quotes
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Invoice #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Client
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm font-semibold text-[#006332]">
                            {inv.invoice_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {inv.facility_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {inv.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            KES {(inv.total || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={
                                inv.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {inv.status?.charAt(0).toUpperCase() +
                                inv.status?.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(inv.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`download-invoice-${inv.id}`}
                                onClick={async () => {
                                  try {
                                    // Backend download endpoint expects invoice_number in the path
                                    const r = await axios.get(
                                      `${API_URL}/api/admin/invoices/${inv.invoice_number}/download`,
                                      {
                                        headers: getAuthHeader(),
                                        responseType: "blob",
                                      },
                                    );
                                    const u = window.URL.createObjectURL(
                                      new Blob([r.data]),
                                    );
                                    const l = document.createElement("a");
                                    l.href = u;
                                    l.setAttribute(
                                      "download",
                                      `Invoice_${inv.invoice_number}.pdf`,
                                    );
                                    document.body.appendChild(l);
                                    l.click();
                                    l.remove();
                                  } catch (e) {
                                    toast.error("Failed to download");
                                  }
                                }}
                                className="gap-1"
                              >
                                <Download className="w-3 h-3" /> PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`send-invoice-${inv.id}`}
                                onClick={async () => {
                                  try {
                                    await axios.post(
                                      `${API_URL}/api/admin/invoices/${inv.id}/resend`,
                                      {},
                                      { headers: getAuthHeader() },
                                    );
                                    fetchData();
                                    toast.success("Invoice sent!");
                                  } catch (e) {
                                    toast.error("Failed to send");
                                  }
                                }}
                                className="gap-1"
                              >
                                <Send className="w-3 h-3" /> Send
                              </Button>
                              {inv.status !== "paid" && (
                                <Button
                                  size="sm"
                                  data-testid={`mark-paid-${inv.id}`}
                                  onClick={async () => {
                                    try {
                                      await axios.put(
                                        `${API_URL}/api/admin/invoices/${inv.id}/mark-paid`,
                                        {},
                                        { headers: getAuthHeader() },
                                      );
                                      toast.success("Marked as paid!");
                                      fetchData();
                                    } catch (e) {
                                      toast.error("Failed");
                                    }
                                  }}
                                  className="gap-1 bg-[#006332] hover:bg-[#005028] text-white"
                                >
                                  <CheckCircle className="w-3 h-3" /> Mark Paid
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======== USERS ======== */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={userRoleFilter}
                    onValueChange={(v) => {
                      setUserRoleFilter(v);
                      setUserPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="customer">Customers</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    setNewUser({
                      firstName: "",
                      lastName: "",
                      email: "",
                      phone: "",
                      facilityName: "",
                      facilityType: "",
                      address: "",
                      city: "",
                      role: "customer",
                      can_login: true,
                    });
                    setPanelType("add-user");
                  }}
                  size="sm"
                  className="bg-[#006332] hover:bg-[#005028] gap-2"
                  data-testid="add-user-btn"
                >
                  <UserPlus className="w-4 h-4" /> Add User
                </Button>
              </div>
              {filteredUsersAll.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  {users.length === 0 ? (
                    <>
                      <p className="text-gray-600 font-medium mb-1">
                        No Users Yet
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 bg-[#006332] hover:bg-[#005028]"
                        onClick={() => {
                          setNewUser({
                            firstName: "",
                            lastName: "",
                            email: "",
                            phone: "",
                            facilityName: "",
                            facilityType: "",
                            address: "",
                            city: "",
                            role: "customer",
                            can_login: true,
                          });
                          setPanelType("add-user");
                        }}
                      >
                        Create New User
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 font-medium mb-2">
                        No matching users found
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUserSearch("");
                          setUserRoleFilter("all");
                          setUserPage(1);
                        }}
                      >
                        Clear Filters
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Facility</th>
                        <th className="text-center p-3">Role</th>
                        <th className="text-left p-3">Joined</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">
                            {u.firstName} {u.lastName}
                          </td>
                          <td className="p-3">{u.email}</td>
                          <td className="p-3">{u.facilityName || "-"}</td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                u.role === "admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                              }
                            >
                              {u.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPanelData({ ...u });
                                  setPanelType("edit-user");
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {totalUserPages > 1 && (
                <Pagination
                  page={userPage}
                  setPage={setUserPage}
                  total={totalUserPages}
                  totalItems={filteredUsersAll.length}
                  perPage={ITEMS_PER_PAGE}
                />
              )}
            </div>
          )}

          {/* ======== PRODUCTS ======== */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setProductPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={productCategoryFilter}
                    onValueChange={(v) => {
                      setProductCategoryFilter(v);
                      setProductPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.category_id} value={c.category_id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPanelType("bulk-import")}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" /> Import CSV
                  </Button>
                  <Button
                    onClick={() => {
                      resetImageStates();
                      setNewProduct({
                        name: "",
                        price: "",
                        package: "",
                        stocking_unit: "",
                        category_id: "",
                        description: "",
                        in_stock: true,
                        image_url: "",
                      });
                      setPanelType("add-product");
                    }}
                    size="sm"
                    className="bg-[#006332] hover:bg-[#005028] gap-2"
                    data-testid="add-product-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Product
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {filteredProductsAll.length} of {products.length} products
              </p>
              {filteredProductsAll.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  {products.length === 0 ? (
                    <>
                      <p className="text-gray-600 font-medium mb-1">
                        No Products Yet
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 bg-[#006332] hover:bg-[#005028]"
                        onClick={() => {
                          resetImageStates();
                          setNewProduct({
                            name: "",
                            price: "",
                            package: "",
                            stocking_unit: "",
                            category_id: "",
                            description: "",
                            in_stock: true,
                            image_url: "",
                          });
                          setPanelType("add-product");
                        }}
                      >
                        Create New Product
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 font-medium mb-2">
                        No matching products found
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProductSearch("");
                          setProductCategoryFilter("all");
                          setProductPage(1);
                        }}
                      >
                        Clear Filters
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">Product</th>
                        <th className="text-left p-3">Package</th>
                        <th className="text-left p-3">Unit</th>
                        <th className="text-right p-3">Price</th>
                        <th className="text-center p-3">Stock</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p) => (
                        <tr
                          key={p.product_id}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {p.image_url ? (
                                <img
                                  src={getFullImageUrl(p.image_url)}
                                  alt=""
                                  className="w-10 h-10 object-cover rounded bg-gray-50"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.src = getFullImageUrl(null);
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100" />
                              )}
                              <span className="font-medium">{p.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-600">
                            {p.package || "-"}
                          </td>
                          <td className="p-3 text-gray-600">
                            {p.stocking_unit || p.unit || "-"}
                          </td>
                          <td className="p-3 text-right">
                            {(p.price || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            {p.in_stock ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  resetImageStates();
                                  setPanelData({ ...p });
                                  setPanelType("edit-product");
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteProduct(p.product_id)
                                }
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {totalProductPages > 1 && (
                <Pagination
                  page={productPage}
                  setPage={setProductPage}
                  total={totalProductPages}
                  totalItems={filteredProductsAll.length}
                  perPage={ITEMS_PER_PAGE}
                />
              )}
            </div>
          )}

          {/* ======== CATEGORIES ======== */}
          {activeTab === "categories" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {categories.length} categories
                </p>
                <Button
                  onClick={() => {
                    setNewCategory({ name: "", description: "" });
                    setPanelType("add-category");
                  }}
                  size="sm"
                  className="bg-[#006332] hover:bg-[#005028] gap-2"
                  data-testid="add-category-btn"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </Button>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">
                    No Categories Yet
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 bg-[#006332] hover:bg-[#005028]"
                    onClick={() => {
                      setNewCategory({ name: "", description: "" });
                      setPanelType("add-category");
                    }}
                  >
                    Create New Category
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* SWAPPED: ID moved to the first position */}
                        <th className="text-left p-3">ID</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Description</th>
                        <th className="text-center p-3">Products</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr
                          key={cat.category_id}
                          className="border-b hover:bg-gray-50"
                        >
                          {/* SWAPPED: Data columns swapped to match the header */}
                          <td className="p-3 font-mono text-xs text-gray-500">
                            {cat.category_id}
                          </td>
                          <td className="p-3 font-medium">{cat.name}</td>
                          <td className="p-3 text-gray-600 max-w-[200px] truncate">
                            {cat.description || "-"}
                          </td>
                          <td className="p-3 text-center">
                            {
                              products.filter(
                                (p) => p.category_id === cat.category_id,
                              ).length
                            }
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditCategory({ ...cat });
                                  setPanelType("edit-category");
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteCategory(cat.category_id)
                                }
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======== SETTINGS ======== */}
          {activeTab === "settings" && (
            <div>
              <div
                className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit"
                data-testid="settings-sub-tabs"
              >
                {[
                  {
                    id: "site-info",
                    label: "Site Info",
                    icon: <Settings className="w-4 h-4" />,
                  },
                  {
                    id: "payment-info",
                    label: "Payment Info",
                    icon: <DollarSign className="w-4 h-4" />,
                  },
                  {
                    id: "email-followups",
                    label: "Email Follow-Ups",
                    icon: <Send className="w-4 h-4" />,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    data-testid={`settings-tab-${tab.id}`}
                    onClick={() => setSettingsSubTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${settingsSubTab === tab.id ? "bg-white text-[#006332] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              {settingsSubTab === "site-info" && (
                <SettingsSiteInfo
                  settings={siteSettings}
                  setSettings={setSiteSettings}
                  onSave={handleSaveSettings}
                  loading={settingsLoading}
                />
              )}
              {settingsSubTab === "payment-info" && (
                <SettingsPaymentInfo
                  settings={siteSettings}
                  setSettings={setSiteSettings}
                  onSave={handleSaveSettings}
                  loading={settingsLoading}
                />
              )}
              {settingsSubTab === "email-followups" && (
                <SettingsEmailFollowUps
                  settings={followUpSettings}
                  setSettings={setFollowUpSettings}
                  onSave={handleSaveFollowUpSettings}
                  loading={followUpLoading}
                  onViewLogs={handleFetchEmailLogs}
                  emailLogs={emailLogs}
                  showLogs={showEmailLogs}
                  setShowLogs={setShowEmailLogs}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* ======== SLIDE-OUT PANELS ======== */}

      {/* Quote Detail Panel */}
      <SlideOutPanel
        isOpen={panelType === "quote-detail"}
        onClose={() => setPanelType(null)}
        title="Quote Details"
        subtitle={panelData?.facility_name}
      >
        {panelData && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              {getStatusBadge(panelData.status)}
              {panelData.customer_response &&
                panelData.status !== "invoiced" && (
                  <Badge
                    className={
                      panelData.customer_response === "accepted"
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }
                  >
                    Customer: {panelData.customer_response}
                  </Badge>
                )}
              {panelData.current_handler && panelData.status === "quoted" && (
                <Badge
                  className={
                    panelData.current_handler === "ADMIN_REVIEW"
                      ? "bg-purple-100 text-purple-800"
                      : panelData.current_handler === "CUSTOMER_REVIEW"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                  }
                >
                  {panelData.current_handler === "ADMIN_REVIEW"
                    ? "Admin Review"
                    : panelData.current_handler === "CUSTOMER_REVIEW"
                      ? "Customer Review"
                      : "Locked"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Contact</p>
                <p className="font-medium">{panelData.contact_person}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{panelData.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{panelData.phone}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date(panelData.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {/* Status is now controlled implicitly (Quoted / Invoiced) via pricing and invoice actions */}
            <div>
              <h4 className="font-semibold mb-2">Items</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2">Product</th>
                    <th className="text-center p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    {panelData.items?.some(
                      (i) => i.customer_proposed_price,
                    ) && <th className="text-right p-2">Customer Price</th>}
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {panelData.items?.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{item.product_name}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">
                        {item.unit_price ? (
                          `KES ${item.unit_price.toLocaleString()}`
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      {panelData.items?.some(
                        (it) => it.customer_proposed_price,
                      ) && (
                        <td className="p-2 text-right">
                          {item.customer_proposed_price ? (
                            <span className="text-amber-600 font-medium">
                              KES{" "}
                              {item.customer_proposed_price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )}
                      <td className="p-2 text-right font-medium">
                        KES{" "}
                        {(
                          (item.unit_price || 0) * item.quantity
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const {
                      subtotal,
                      discount,
                      taxRate,
                      taxAmount,
                      total,
                      includeVat,
                    } = getQuoteMonetaryTotals(panelData);
                    const spanCols = panelData.items?.some(
                      (i) => i.customer_proposed_price,
                    )
                      ? 4
                      : 3;
                    return (
                      <>
                        <tr>
                          <td
                            colSpan={spanCols}
                            className="p-2 text-right text-gray-500"
                          >
                            Subtotal:
                          </td>
                          <td className="p-2 text-right">
                            KES {subtotal.toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={spanCols}
                            className="p-2 text-right text-gray-500"
                          >
                            Discount:
                          </td>
                          <td className="p-2 text-right text-red-600">
                            - KES {discount.toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={spanCols}
                            className="p-2 text-right text-gray-500"
                          >
                            {includeVat
                              ? `VAT (${taxRate}%)`
                              : `Exclusive VAT (${taxRate}%)`}
                          </td>
                          <td className="p-2 text-right">
                            KES {taxAmount.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="font-bold">
                          <td colSpan={spanCols} className="p-2 text-right">
                            Total:
                          </td>
                          <td className="p-2 text-right text-[#006332]">
                            KES {total.toLocaleString()}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
            {panelData.customer_notes && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <p className="text-sm font-semibold text-orange-800">
                  Customer Notes:
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  {panelData.customer_notes}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2 border-t">
              {panelData.status === "quoted" && (
                <Button
                  onClick={() => {
                    setEditingQuoteId(panelData.id);
                    setEditingQuoteRef(panelData.quote_number || "");
                    setQuoteFormData({
                      user_id: panelData.user_id || "",
                      facility_name: panelData.facility_name || "",
                      contact_person: panelData.contact_person || "",
                      email: panelData.email || "",
                      phone: panelData.phone || "",
                      address: panelData.address || "",
                      items: (panelData.items || []).map((it) => ({
                        product_id: it.product_id || "",
                        product_name: it.product_name || "",
                        category: it.category || "",
                        quantity: it.quantity || 1,
                        unit_price: it.unit_price || 0,
                      })),
                      discount_amount: panelData.discount_amount || 0,
                      tax_rate: panelData.tax_rate || 16,
                      include_vat:
                        typeof panelData.include_vat === "boolean"
                          ? panelData.include_vat
                          : true,
                      notes:
                        panelData.notes || panelData.additional_notes || "",
                    });
                    setPanelType("add-quote");
                  }}
                  className="bg-[#006332] hover:bg-[#005028] gap-2"
                >
                  <Edit className="w-4 h-4" /> Edit / Revise Quote
                </Button>
              )}
              {panelData.status === "quoted" && (
                <Button
                  onClick={() => downloadQuotePDF(panelData.id)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
              )}
              {panelData.status === "quoted" && (
                <Button
                  onClick={() => {
                    setPanelData(panelData);
                    setPanelType("create-invoice");
                  }}
                  className="bg-[#006332] hover:bg-[#005028] gap-2"
                >
                  <Receipt className="w-4 h-4" /> Create Invoice
                </Button>
              )}
              {panelData.status === "invoiced" && (
                <Badge className="bg-green-100 text-green-800 py-2 px-4">
                  Invoice Generated
                </Badge>
              )}
            </div>
          </div>
        )}
      </SlideOutPanel>

      {/* Modify Quote Panel removed (merged into Update Quote). */}

      {/* Create Invoice Panel */}
      <SlideOutPanel
        isOpen={panelType === "create-invoice"}
        onClose={() => setPanelType(null)}
        title="Create Invoice"
        subtitle="Generate and send invoice to customer"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will generate an invoice for{" "}
            <strong>{panelData?.facility_name}</strong> and send it via email.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPanelType(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateInvoice(panelData?.id)}
              className="bg-[#006332] hover:bg-[#005028] gap-2"
            >
              <Receipt className="w-4 h-4" /> Create & Send Invoice
            </Button>
          </div>
        </div>
      </SlideOutPanel>

      {/* Add User Panel */}
      <SlideOutPanel
        isOpen={panelType === "add-user"}
        onClose={() => setPanelType(null)}
        title="Add New User"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input
                value={newUser.firstName}
                onChange={(e) =>
                  setNewUser({ ...newUser, firstName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input
                value={newUser.lastName}
                onChange={(e) =>
                  setNewUser({ ...newUser, lastName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={newUser.phone}
                onChange={(e) =>
                  setNewUser({ ...newUser, phone: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Facility Name *</Label>
              <Input
                value={newUser.facilityName}
                onChange={(e) =>
                  setNewUser({ ...newUser, facilityName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Facility Type</Label>
              <Input
                value={newUser.facilityType}
                onChange={(e) =>
                  setNewUser({ ...newUser, facilityType: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={newUser.address}
                onChange={(e) =>
                  setNewUser({ ...newUser, address: e.target.value })
                }
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={newUser.city}
                onChange={(e) =>
                  setNewUser({ ...newUser, city: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser({ ...newUser, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                checked={newUser.can_login}
                onCheckedChange={(v) =>
                  setNewUser({ ...newUser, can_login: v })
                }
              />
              <Label>Allow Login</Label>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPanelType(null)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-[#006332] hover:bg-[#005028]">
              Create User
            </Button>
          </div>
        </form>
      </SlideOutPanel>

      {/* Edit User Panel */}
      <SlideOutPanel
        isOpen={panelType === "edit-user"}
        onClose={() => setPanelType(null)}
        title="Edit User"
      >
        {panelData && (
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={panelData.firstName || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, firstName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={panelData.lastName || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, lastName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={panelData.email || ""}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={panelData.phone || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Facility Name</Label>
                <Input
                  value={panelData.facilityName || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, facilityName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Facility Type</Label>
                <Input
                  value={panelData.facilityType || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, facilityType: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select
                  value={panelData.role}
                  onValueChange={(v) => setPanelData({ ...panelData, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={panelData.can_login}
                  onCheckedChange={(v) =>
                    setPanelData({ ...panelData, can_login: v })
                  }
                />
                <Label>Allow Login</Label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPanelType(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#006332] hover:bg-[#005028]">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </SlideOutPanel>

      {/* Add Product Panel */}
      <SlideOutPanel
        isOpen={panelType === "add-product"}
        onClose={() => {
          setPanelType(null);
          resetImageStates();
        }}
        title="Add New Product"
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <Label>Product Name *</Label>
            <Input
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, name: e.target.value })
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price (KES)</Label>
              <Input
                type="number"
                value={newProduct.price}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, price: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Package</Label>
              <Input
                value={newProduct.package}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, package: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stocking Unit</Label>
              <Input
                value={newProduct.stocking_unit}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    stocking_unit: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={newProduct.category_id}
                onValueChange={(v) =>
                  setNewProduct({ ...newProduct, category_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_id} value={c.category_id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ImageUploadField
            type={imageUploadType}
            setType={setImageUploadType}
            imageUrl={newProduct.image_url}
            setImageUrl={(v) => setNewProduct({ ...newProduct, image_url: v })}
            preview={imagePreview}
            onFile={(e) => handleImageFileChange(e, false)}
            setFile={setImageFile}
            setPreview={setImagePreview}
          />
          <div>
            <Label>Description</Label>
            <Textarea
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct({ ...newProduct, description: e.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={newProduct.in_stock}
              onCheckedChange={(v) =>
                setNewProduct({ ...newProduct, in_stock: v })
              }
            />
            <Label>In Stock</Label>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPanelType(null);
                resetImageStates();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#006332] hover:bg-[#005028]"
              disabled={productLoading}
            >
              {productLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Product"
              )}
            </Button>
          </div>
        </form>
      </SlideOutPanel>

      {/* Edit Product Panel */}
      <SlideOutPanel
        isOpen={panelType === "edit-product"}
        onClose={() => {
          setPanelType(null);
          resetImageStates();
        }}
        title="Edit Product"
      >
        {panelData && (
          <form onSubmit={handleEditProduct} className="space-y-4">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={panelData.name}
                onChange={(e) =>
                  setPanelData({ ...panelData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (KES)</Label>
                <Input
                  type="number"
                  value={panelData.price}
                  onChange={(e) =>
                    setPanelData({ ...panelData, price: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Package</Label>
                <Input
                  value={panelData.package || ""}
                  onChange={(e) =>
                    setPanelData({ ...panelData, package: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stocking Unit</Label>
                <Input
                  value={panelData.stocking_unit || ""}
                  onChange={(e) =>
                    setPanelData({
                      ...panelData,
                      stocking_unit: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={panelData.category_id}
                  onValueChange={(v) =>
                    setPanelData({ ...panelData, category_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.category_id} value={c.category_id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageUploadField
              type={imageUploadType}
              setType={setImageUploadType}
              imageUrl={panelData.image_url}
              setImageUrl={(v) => setPanelData({ ...panelData, image_url: v })}
              preview={imagePreview}
              onFile={(e) => handleImageFileChange(e, true)}
              setFile={setImageFile}
              setPreview={setImagePreview}
            />
            <div>
              <Label>Description</Label>
              <Textarea
                value={panelData.description || ""}
                onChange={(e) =>
                  setPanelData({ ...panelData, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={panelData.in_stock}
                onCheckedChange={(v) =>
                  setPanelData({ ...panelData, in_stock: v })
                }
              />
              <Label>In Stock</Label>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPanelType(null);
                  resetImageStates();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#006332] hover:bg-[#005028]"
                disabled={productLoading}
              >
                {productLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        )}
      </SlideOutPanel>

      {/* Add Category Panel */}
      <SlideOutPanel
        isOpen={panelType === "add-category"}
        onClose={() => setPanelType(null)}
        title="Add New Category"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <Label>Category Name *</Label>
            <Input
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({ ...newCategory, name: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={newCategory.description}
              onChange={(e) =>
                setNewCategory({ ...newCategory, description: e.target.value })
              }
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPanelType(null)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-[#006332] hover:bg-[#005028]">
              Add Category
            </Button>
          </div>
        </form>
      </SlideOutPanel>

      {/* Edit Category Panel */}
      <SlideOutPanel
        isOpen={panelType === "edit-category"}
        onClose={() => setPanelType(null)}
        title="Edit Category"
      >
        {editCategory && (
          <form onSubmit={handleEditCategory} className="space-y-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                value={editCategory.name}
                onChange={(e) =>
                  setEditCategory({ ...editCategory, name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editCategory.description || ""}
                onChange={(e) =>
                  setEditCategory({
                    ...editCategory,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPanelType(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#006332] hover:bg-[#005028]">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </SlideOutPanel>

      {/* Bulk Import Panel */}
      <SlideOutPanel
        isOpen={panelType === "bulk-import"}
        onClose={() => setPanelType(null)}
        title="Bulk Import Products"
        subtitle="Upload CSV to add/update products"
      >
        <div className="space-y-5">
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-semibold mb-3 text-sm">Data Requirements</h4>
            <div className="space-y-2 text-sm">
              {[
                {
                  field: "name",
                  type: "String",
                  desc: "Product name (required)",
                  required: true,
                },
                {
                  field: "category_name",
                  type: "String",
                  desc: "Existing category name (required)",
                  required: true,
                },
                {
                  field: "price",
                  type: "Decimal",
                  desc: "Unit price (e.g., 1500.00)",
                  required: false,
                },
                {
                  field: "package",
                  type: "String",
                  desc: "Package description",
                  required: false,
                },
                {
                  field: "description",
                  type: "Text",
                  desc: "Product description",
                  required: false,
                },
                {
                  field: "in_stock",
                  type: "Boolean",
                  desc: "true or false",
                  required: false,
                },
                {
                  field: "image_url",
                  type: "URL",
                  desc: "Valid image URL",
                  required: false,
                },
              ].map((f) => (
                <div
                  key={f.field}
                  className="flex items-start gap-3 py-1 border-b border-gray-200 last:border-0"
                >
                  <code className="bg-white px-2 py-0.5 rounded text-xs font-mono min-w-[120px]">
                    {f.field}
                  </code>
                  <Badge
                    className={
                      f.required
                        ? "bg-red-50 text-red-700 text-[10px]"
                        : "bg-gray-100 text-gray-600 text-[10px]"
                    }
                  >
                    {f.required ? "Required" : "Optional"}
                  </Badge>
                  <span className="text-gray-500 text-xs">
                    {f.type} — {f.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Note:</strong> category_name must match an existing
            category. Create categories first before importing products.
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#006332] transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) handleBulkImport(f);
              }}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="font-medium text-gray-700">
                Click to upload CSV file
              </p>
              <p className="text-xs text-gray-500 mt-1">Supports .csv files</p>
            </label>
          </div>
        </div>
      </SlideOutPanel>

      {/* Add / Edit Quote Panel */}
      <SlideOutPanel
        isOpen={panelType === "add-quote"}
        onClose={() => {
          setPanelType(null);
          setEditingQuoteId(null);
          setEditingQuoteRef("");
        }}
        title={editingQuoteId ? "Update Quote" : "Create Quote"}
        subtitle={
          editingQuoteId ? "Update quote details" : "Add a quote for a customer"
        }
        width="w-[50vw]"
      >
        <form onSubmit={handleCreateAdminQuote} className="space-y-5">
          {editingQuoteId && (
            <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-2 text-xs">
              <div className="text-gray-600">
                <span className="font-semibold text-gray-800">
                  Quote Reference:
                </span>{" "}
                <span className="font-mono">
                  {editingQuoteRef ||
                    `QUO-${String(editingQuoteId).slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              <div className="text-gray-500 font-mono">
                {String(editingQuoteId).slice(0, 8).toUpperCase()}
              </div>
            </div>
          )}
          {/* Customer Selection */}
          <div className="space-y-3 pb-4 border-b">
            <h4 className="font-semibold text-sm text-gray-700">
              Select or Enter Customer
            </h4>

            <div>
              <Label className="text-xs">Existing Customer (Optional)</Label>
              <Select
                value={quoteFormData.user_id}
                onValueChange={(v) => {
                  if (!v) {
                    // Clear selected user but keep manual entries
                    setQuoteFormData({ ...quoteFormData, user_id: "" });
                    return;
                  }
                  const selectedUser = users.find((u) => u.id === v);
                  if (selectedUser) {
                    setQuoteFormData({
                      ...quoteFormData,
                      user_id: v,
                      facility_name: selectedUser.facilityName || "",
                      contact_person:
                        `${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim(),
                      email: selectedUser.email || "",
                      phone: selectedUser.phone || "",
                      address: selectedUser.address || "",
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select existing customer or leave blank for new..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search customers..."
                      className="h-8 text-xs"
                      value={quoteCustomerDropdownFilter}
                      onChange={(e) =>
                        setQuoteCustomerDropdownFilter(e.target.value)
                      }
                      autoFocus
                    />
                  </div>
                  {users
                    .filter((u) => u.role === "customer")
                    .filter((u) => {
                      if (!quoteCustomerDropdownFilter.trim()) return true;
                      const q = quoteCustomerDropdownFilter.toLowerCase();
                      return (
                        (u.facilityName || "").toLowerCase().includes(q) ||
                        (u.email || "").toLowerCase().includes(q) ||
                        `${u.firstName || ""} ${u.lastName || ""}`
                          .toLowerCase()
                          .includes(q)
                      );
                    })
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.facilityName || u.email} ({u.firstName} {u.lastName})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Facility Name *</Label>
                <Input
                  placeholder="Hospital ABC"
                  value={quoteFormData.facility_name}
                  onChange={(e) =>
                    setQuoteFormData({
                      ...quoteFormData,
                      facility_name: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Contact Person *</Label>
                <Input
                  placeholder="John Doe"
                  value={quoteFormData.contact_person}
                  onChange={(e) =>
                    setQuoteFormData({
                      ...quoteFormData,
                      contact_person: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  placeholder="john@hospital.com"
                  value={quoteFormData.email}
                  onChange={(e) =>
                    setQuoteFormData({
                      ...quoteFormData,
                      email: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input
                  placeholder="+254 700 000 000"
                  value={quoteFormData.phone}
                  onChange={(e) =>
                    setQuoteFormData({
                      ...quoteFormData,
                      phone: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Address</Label>
                <Input
                  placeholder="Street, City"
                  value={quoteFormData.address}
                  onChange={(e) =>
                    setQuoteFormData({
                      ...quoteFormData,
                      address: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-gray-700">Products</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setQuoteFormData({
                    ...quoteFormData,
                    items: [
                      ...quoteFormData.items,
                      {
                        product_id: "",
                        product_name: "",
                        category: "",
                        quantity: 1,
                        unit_price: 0,
                      },
                    ],
                  })
                }
              >
                <Plus className="w-3 h-3 mr-1" /> Add Item
              </Button>
            </div>
            <p className="text-[11px] text-gray-500">
              At least one product line is required. The delete icon clears the
              last line item if only one remains.
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {quoteFormData.items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">
                      Item {idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title={
                        quoteFormData.items.length <= 1
                          ? "Clear this item"
                          : "Remove this item"
                      }
                      onClick={() => {
                        if (quoteFormData.items.length <= 1) {
                          // Keep at least one line item; clear it instead of removing.
                          setQuoteFormData({
                            ...quoteFormData,
                            items: [
                              {
                                product_id: "",
                                product_name: "",
                                category: "",
                                quantity: 1,
                                unit_price: 0,
                              },
                            ],
                          });
                          return;
                        }
                        setQuoteFormData({
                          ...quoteFormData,
                          items: quoteFormData.items.filter(
                            (_, i) => i !== idx,
                          ),
                        });
                      }}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Product *</Label>
                      <Select
                        value={item.product_id}
                        onValueChange={(v) => {
                          const prod = products.find((p) => p.product_id === v);
                          const newItems = [...quoteFormData.items];
                          newItems[idx] = {
                            product_id: v,
                            product_name: prod?.name || "",
                            category: prod?.category_name || "",
                            quantity: item.quantity,
                            unit_price: prod?.price || 0,
                          };
                          setQuoteFormData({
                            ...quoteFormData,
                            items: newItems,
                          });
                        }}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search products..."
                              className="h-8 text-xs"
                              value={quoteProductDropdownFilter}
                              onChange={(e) =>
                                setQuoteProductDropdownFilter(e.target.value)
                              }
                              autoFocus
                            />
                          </div>
                          {products
                            .filter((p) => {
                              // Avoid double-entry: hide products already selected in other rows
                              const selectedOther = new Set(
                                (quoteFormData.items || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it) => it.product_id)
                                  .filter(Boolean),
                              );
                              return !selectedOther.has(p.product_id);
                            })
                            .filter((p) => {
                              if (!quoteProductDropdownFilter.trim())
                                return true;
                              const q =
                                quoteProductDropdownFilter.toLowerCase();
                              return (
                                p.name.toLowerCase().includes(q) ||
                                (p.category_name || "")
                                  .toLowerCase()
                                  .includes(q)
                              );
                            })
                            .map((p) => (
                              <SelectItem
                                key={p.product_id}
                                value={p.product_id}
                              >
                                {p.name} ({p.category_name})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        className="text-sm"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...quoteFormData.items];
                          newItems[idx].quantity =
                            parseInt(e.target.value) || 1;
                          setQuoteFormData({
                            ...quoteFormData,
                            items: newItems,
                          });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Unit Price (KES)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="text-sm"
                        value={item.unit_price}
                        onChange={(e) => {
                          const newItems = [...quoteFormData.items];
                          newItems[idx].unit_price =
                            parseFloat(e.target.value) || 0;
                          setQuoteFormData({
                            ...quoteFormData,
                            items: newItems,
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-right text-xs text-gray-600">
                    Line Total:{" "}
                    <span className="font-semibold text-[#006332]">
                      KES{" "}
                      {(
                        (item.unit_price || 0) * item.quantity
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          {(() => {
            const { subtotal, discount, taxAmount, total, includeVat } =
              calculateAdminQuoteTotal();
            return (
              <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">
                    KES {subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="font-medium text-red-600">
                    - KES {discount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>
                    {includeVat
                      ? `VAT (${quoteFormData.tax_rate}%)`
                      : `Exclusive VAT (${quoteFormData.tax_rate}%)`}
                  </span>
                  <span className="font-medium">
                    KES {taxAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-[#006332]">
                    KES {total.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Discount & Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Discount (KES)</Label>
              <Input
                type="number"
                min="0"
                value={quoteFormData.discount_amount}
                onChange={(e) =>
                  setQuoteFormData({
                    ...quoteFormData,
                    discount_amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Tax Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={quoteFormData.tax_rate}
                onChange={(e) =>
                  setQuoteFormData({
                    ...quoteFormData,
                    tax_rate: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          {/* VAT Toggle */}
          <div className="flex items-center justify-between mt-3">
            <div>
              <Label className="text-xs">VAT Handling</Label>
              <p className="text-[11px] text-gray-500">
                Toggle off to treat prices as exclusive of VAT (shown as
                “Exclusive VAT”).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={quoteFormData.include_vat}
                onChange={(e) =>
                  setQuoteFormData({
                    ...quoteFormData,
                    include_vat: e.target.checked,
                  })
                }
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006332]" />
            </label>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="Any additional notes or terms..."
              value={quoteFormData.notes}
              onChange={(e) =>
                setQuoteFormData({ ...quoteFormData, notes: e.target.value })
              }
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPanelType(null);
                setEditingQuoteId(null);
              }}
            >
              Cancel
            </Button>
            {editingQuoteId && (
              <Button
                type="button"
                disabled={quoteFormLoading}
                onClick={handleUpdateAndSendQuote}
                variant="outline"
                className="gap-2"
              >
                {quoteSendLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {quoteSendLoading ? "Sending..." : "Update & Send"}
              </Button>
            )}
            <Button
              type="submit"
              disabled={quoteFormLoading}
              className="bg-[#006332] hover:bg-[#005028] gap-2"
            >
              {quoteUpdateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingQuoteId ? (
                <Edit className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {quoteUpdateLoading
                ? editingQuoteId
                  ? "Updating..."
                  : "Creating..."
                : editingQuoteId
                  ? "Update Quote"
                  : "Create & Send Quote"}
            </Button>
          </div>
        </form>
      </SlideOutPanel>
    </div>
  );
};

// ======== Sub-Components ========
const DateRangeFilter = ({
  dateRange,
  setDateRange,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
}) => (
  <Card className="border-[#006332]/20">
    <CardContent className="pt-4 pb-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#006332]" />
          <span className="font-medium text-gray-700">Date Range:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "all", l: "All Time" },
            { v: "7days", l: "Last 7 Days" },
            { v: "30days", l: "Last 30 Days" },
            { v: "90days", l: "Last 90 Days" },
            { v: "custom", l: "Custom" },
          ].map((o) => (
            <Button
              key={o.v}
              variant={dateRange === o.v ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(o.v)}
              className={
                dateRange === o.v ? "bg-[#006332] hover:bg-[#005028]" : ""
              }
            >
              {o.l}
            </Button>
          ))}
        </div>
        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-40"
            />
            <span>to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

const Pagination = ({ page, setPage, total, totalItems, perPage }) => (
  <div className="flex items-center justify-between pt-4 border-t mt-4">
    <p className="text-sm text-gray-500">
      Showing {(page - 1) * perPage + 1} -{" "}
      {Math.min(page * perPage, totalItems)} of {totalItems}
    </p>
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => p - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </Button>
      <span className="text-sm px-3">
        Page {page}/{total}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => p + 1)}
        disabled={page === total}
      >
        Next <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

const ImageUploadField = ({
  type,
  setType,
  imageUrl,
  setImageUrl,
  preview,
  onFile,
  setFile,
  setPreview,
}) => (
  <div className="space-y-3">
    <Label>Product Image</Label>
    <div className="flex gap-2">
      <Button
        type="button"
        variant={type === "url" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setType("url");
          setFile(null);
          setPreview("");
        }}
        className={type === "url" ? "bg-[#006332]" : ""}
      >
        <Link className="w-4 h-4 mr-2" /> URL
      </Button>
      <Button
        type="button"
        variant={type === "file" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setType("file");
          setImageUrl("");
        }}
        className={type === "file" ? "bg-[#006332]" : ""}
      >
        <Upload className="w-4 h-4 mr-2" /> Upload
      </Button>
    </div>
    {type === "url" ? (
      <Input
        placeholder="https://..."
        value={imageUrl || ""}
        onChange={(e) => setImageUrl(e.target.value)}
      />
    ) : (
      <Input type="file" accept="image/*" onChange={onFile} />
    )}
    {(preview || imageUrl) && (
      <img
        src={preview || imageUrl}
        alt=""
        className="w-20 h-20 object-cover rounded border"
        onError={(e) => (e.target.style.display = "none")}
      />
    )}
  </div>
);

const SettingsSiteInfo = ({ settings, setSettings, onSave, loading }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">Site Information</CardTitle>
      <CardDescription>Manage contact and social links</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Label>Company Name</Label>
          <Input
            value={settings.company_name || ""}
            onChange={(e) =>
              setSettings({ ...settings, company_name: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label>Website</Label>
          <Input
            placeholder="https://hamptonscientific.com"
            value={settings.website || ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                website: e.target.value,
              })
            }
            className="mt-1"
            data-testid="website-input"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={settings.phone || ""}
            onChange={(e) =>
              setSettings({ ...settings, phone: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            value={settings.email || ""}
            onChange={(e) =>
              setSettings({ ...settings, email: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label>Working Hours</Label>
          <Input
            value={settings.working_hours || ""}
            onChange={(e) =>
              setSettings({ ...settings, working_hours: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Input
            value={settings.address || ""}
            onChange={(e) =>
              setSettings({ ...settings, address: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div className="md:col-span-2">
          <Label>P.O. Box</Label>
          <Input
            value={settings.po_box || ""}
            onChange={(e) =>
              setSettings({ ...settings, po_box: e.target.value })
            }
            className="mt-1"
          />
        </div>
      </div>
      <div className="border-t pt-6">
        <h3 className="font-semibold mb-4">Social Media</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Facebook</Label>
            <Input
              value={settings.facebook_url || ""}
              onChange={(e) =>
                setSettings({ ...settings, facebook_url: e.target.value })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>Twitter</Label>
            <Input
              value={settings.twitter_url || ""}
              onChange={(e) =>
                setSettings({ ...settings, twitter_url: e.target.value })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input
              value={settings.linkedin_url || ""}
              onChange={(e) =>
                setSettings({ ...settings, linkedin_url: e.target.value })
              }
              className="mt-1"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={loading}
          className="bg-[#006332] hover:bg-[#005028] gap-2"
          data-testid="save-site-settings-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}{" "}
          Save
        </Button>
      </div>
    </CardContent>
  </Card>
);

const SettingsPaymentInfo = ({ settings, setSettings, onSave, loading }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">Payment Information</CardTitle>
      <CardDescription>
        Bank and mobile payment details for invoices
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="border rounded-lg p-5 space-y-4">
        <h4 className="font-semibold">Bank Details</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Bank Name</Label>
            <Input
              value={settings.bank_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, bank_name: e.target.value })
              }
              className="mt-1"
              data-testid="bank-name-input"
            />
          </div>
          <div>
            <Label>Account Name</Label>
            <Input
              value={settings.bank_account_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, bank_account_name: e.target.value })
              }
              className="mt-1"
              data-testid="bank-account-name-input"
            />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input
              value={settings.bank_account_number || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bank_account_number: e.target.value,
                })
              }
              className="mt-1"
              data-testid="bank-account-number-input"
            />
          </div>
        </div>
      </div>
      <div className="border rounded-lg p-5 space-y-4">
        <h4 className="font-semibold">Lipa Na Mpesa</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Paybill</Label>
            <Input
              value={settings.mpesa_paybill || ""}
              onChange={(e) =>
                setSettings({ ...settings, mpesa_paybill: e.target.value })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input
              value={settings.mpesa_account_number || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mpesa_account_number: e.target.value,
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>Account Name</Label>
            <Input
              value={settings.mpesa_account_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, mpesa_account_name: e.target.value })
              }
              className="mt-1"
            />
          </div>
        </div>
      </div>
      <div className="border rounded-lg p-5 space-y-4">
        <h4 className="font-semibold mb-3">Default Terms</h4>
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <Label>Default Payment Terms (text)</Label>
            <Input
              value={settings.default_payment_terms || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_payment_terms: e.target.value,
                })
              }
              className="mt-1"
              data-testid="payment-terms-input"
            />
          </div>
          <div>
            <Label>Quote Terms (validity days)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={settings.default_quote_validity_days ?? 7}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_quote_validity_days: parseInt(e.target.value) || 7,
                })
              }
              className="mt-1"
              data-testid="quote-validity-days-input"
            />
          </div>
          <div>
            <Label>Invoice Terms (due days)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={settings.default_invoice_due_days ?? 14}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_invoice_due_days: parseInt(e.target.value) || 14,
                })
              }
              className="mt-1"
              data-testid="invoice-due-days-input"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 max-w-md">
          <div>
            <Label>Default VAT Rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={settings.default_tax_rate ?? 16}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_tax_rate: parseFloat(e.target.value) || 0,
                })
              }
              className="mt-1"
            />
          </div>
          <div className="flex items-center justify-between mt-5 md:mt-7">
            <div>
              <Label className="text-xs">Include VAT by default</Label>
              <p className="text-[11px] text-gray-500">
                Controls whether new quotes start with VAT included.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.default_include_vat !== false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_include_vat: e.target.checked,
                  })
                }
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006332]" />
            </label>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={loading}
          className="bg-[#006332] hover:bg-[#005028] gap-2"
          data-testid="save-payment-settings-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}{" "}
          Save
        </Button>
      </div>
    </CardContent>
  </Card>
);

const SettingsEmailFollowUps = ({
  settings,
  setSettings,
  onSave,
  loading,
  onViewLogs,
  emailLogs,
  showLogs,
  setShowLogs,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">Email Follow-Up Settings</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Quote Follow-Ups</h4>
            <p className="text-sm text-gray-500">
              Auto-remind customers about pending quotes
            </p>
          </div>
          <label
            className="relative inline-flex items-center cursor-pointer"
            data-testid="quote-followup-toggle"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.quote_followup_enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  quote_followup_enabled: e.target.checked,
                })
              }
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006332]"></div>
          </label>
        </div>
        {settings.quote_followup_enabled && (
          <div>
            <Label>Follow-up after (hours)</Label>
            <Input
              type="number"
              min="1"
              max="168"
              value={settings.quote_followup_hours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  quote_followup_hours: parseInt(e.target.value) || 24,
                })
              }
              className="mt-1 max-w-xs"
              data-testid="quote-followup-hours"
            />
          </div>
        )}
      </div>
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Invoice Reminders</h4>
            <p className="text-sm text-gray-500">
              Auto-remind about unpaid invoices
            </p>
          </div>
          <label
            className="relative inline-flex items-center cursor-pointer"
            data-testid="invoice-followup-toggle"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.invoice_followup_enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  invoice_followup_enabled: e.target.checked,
                })
              }
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006332]"></div>
          </label>
        </div>
        {settings.invoice_followup_enabled && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Remind before due (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={settings.invoice_followup_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    invoice_followup_days: parseInt(e.target.value) || 7,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Overdue frequency (days)</Label>
              <Input
                type="number"
                min="1"
                max="14"
                value={settings.invoice_overdue_reminder_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    invoice_overdue_reminder_days:
                      parseInt(e.target.value) || 3,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={onViewLogs}
          className="gap-2"
          data-testid="view-email-logs-btn"
        >
          <Eye className="w-4 h-4" /> View Logs
        </Button>
        <Button
          onClick={onSave}
          disabled={loading}
          className="bg-[#006332] hover:bg-[#005028] gap-2"
          data-testid="save-email-settings-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}{" "}
          Save
        </Button>
      </div>
      {showLogs && (
        <div className="border-t pt-4">
          <div className="flex justify-between mb-3">
            <h4 className="font-semibold">Email Logs</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogs(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {emailLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No logs</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">Type</th>
                    <th className="px-3 py-2 text-left text-xs">To</th>
                    <th className="px-3 py-2 text-left text-xs">Status</th>
                    <th className="px-3 py-2 text-left text-xs">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        <Badge className="bg-gray-100 text-gray-800">
                          {log.type?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {Array.isArray(log.to) ? log.to.join(", ") : log.to}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            log.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {log.sent_at
                          ? new Date(log.sent_at).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
