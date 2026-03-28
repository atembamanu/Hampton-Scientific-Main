import { useState, useEffect } from 'react';
import { Search, X, ShoppingCart, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useQuote } from '../context/QuoteContext';
import axios from 'axios';
import { getFullImageUrl, API_URL } from '../utils/imageHelper';

const STATICFILES_URL = process.env.REACT_APP_STATIC_FILES_URL;


export const Products = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data from API
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { addToQuote, removeFromQuote, isInQuote, getItemCount } = useQuote();

  // Toggle: add or remove from quote
  const handleToggleProduct = (product) => {
    if (checkIsInCart(product)) {
      removeFromQuote(`${product.categoryId}-${product.id}`);
    } else {
      addToQuote(product);
    }
  };

  // Fetch products and categories from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          axios.get(`${API_URL}/api/products`),
          axios.get(`${API_URL}/api/products/categories`)
        ]);
        
        // Transform products to match expected format
        const transformedProducts = productsRes.data.map(product => ({
          id: product.product_id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          inStock: product.in_stock,
          categoryId: product.category_id,
          categoryName: product.category_name,
          categoryImage:  getFullImageUrl(product.image_url)
        }));

        console.log('Transformed Products:', transformedProducts);
        
        // Transform categories
        const transformedCategories = categoriesRes.data.map(cat => ({
          id: cat.category_id,
          name: cat.name,
          description: cat.description,
          image: getFullImageUrl(cat.image),
          productCount: transformedProducts.filter(p => p.categoryId === cat.category_id).length
        }));
        
        setProducts(transformedProducts);
        setCategories(transformedCategories);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Apply filters
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.categoryId);
    return matchesSearch && matchesCategory;
  });

  // Apply sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'category':
        return a.categoryName.localeCompare(b.categoryName);
      default:
        return 0;
    }
  });

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSearchTerm('');
  };

  const checkIsInCart = (product) => {
    return isInQuote(product.id, product.categoryId);
  };

  const cartCount = getItemCount();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#006332] mb-4" />
            <p className="text-lg text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <X className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Products</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-[#006332] hover:bg-[#005028] text-white"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">All Products</h1>
          <p className="text-base md:text-lg text-gray-600">
            Browse our comprehensive range of medical laboratory equipment and healthcare supplies
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left Sidebar - Filters */}
          <aside className={`${sidebarOpen ? 'w-full lg:w-80' : 'w-0'} flex-shrink-0 transition-all duration-300 ${sidebarOpen ? '' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl shadow-lg p-6 lg:sticky lg:top-28 space-y-6">
              {/* Search */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Search Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 h-11 text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="product-search-input"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Filter by category</Label>
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={() => setSelectedCategories([])}
                      className="text-sm text-[#006332] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-start gap-3">
                      <Checkbox
                        id={category.id}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={category.id}
                        className="text-sm leading-tight cursor-pointer hover:text-[#006332] transition-colors flex-1"
                      >
                        {category.name}
                        <span className="text-gray-400 ml-1">({category.productCount})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clear All Filters */}
              {(selectedCategories.length > 0 || searchTerm) && (
                <Button
                  onClick={clearAllFilters}
                  variant="outline"
                  className="w-full border-[#006332] text-[#006332] hover:bg-[#006332] hover:text-white transition-all"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Results Bar */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
                <p className="text-base font-medium text-gray-700">
                  <span className="font-bold text-[#006332]">{sortedProducts.length}</span> results
                  {(selectedCategories.length > 0 || searchTerm) && (
                    <span className="text-gray-500 ml-1">filtered</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-sm text-gray-600 whitespace-nowrap hidden sm:block">Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 sm:w-48 h-10" data-testid="sort-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Tags */}
            {(selectedCategories.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedCategories.map(catId => {
                  const category = categories.find(c => c.id === catId);
                  return (
                    <Badge
                      key={catId}
                      className="bg-[#006332]/10 text-[#006332] border border-[#006332]/20 pl-3 pr-2 py-1 text-sm"
                    >
                      {category?.name}
                      <button
                        onClick={() => handleCategoryToggle(catId)}
                        className="ml-2 hover:bg-[#006332]/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Products Grid */}
            {sortedProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedProducts.map((product) => (
                  <Card
                    key={`${product.categoryId}-${product.id}`}
                    className="border-2 border-gray-100 hover:shadow-xl transition-all duration-300 group bg-white overflow-hidden"
                    data-testid={`product-card-${product.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        <img
                          src={product.categoryImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = getFullImageUrl(null);
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 mb-2 block">
                        {product.categoryName}
                      </span>
                      <CardTitle className="text-base leading-tight line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="mb-3">
                        <p className={`text-sm font-medium ${checkIsInCart(product) ? 'text-[#006332]' : 'text-gray-600'}`}>
                          {checkIsInCart(product) ? 'Selected for quote' : 'Select to request quote'}
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleToggleProduct(product)}
                          className={`w-12 h-12 rounded-full shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center flex-shrink-0 ${
                            checkIsInCart(product)
                              ? 'bg-[#006332] text-white ring-2 ring-[#006332] ring-offset-2'
                              : 'bg-gradient-to-r from-[#006332] to-[#00a550] hover:from-[#005028] hover:to-[#008844] text-white group-hover:scale-110'
                          }`}
                          aria-label={checkIsInCart(product) ? "Remove from quote" : "Add to quote"}
                          data-testid={`add-to-cart-${product.id}`}
                        >
                          {checkIsInCart(product) ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <ShoppingCart className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your filters or search terms</p>
                <Button
                  onClick={clearAllFilters}
                  className="bg-[#006332] hover:bg-[#005028] text-white"
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <Link to="/quote-cart">
          <button className="fixed bottom-20 right-24 w-16 h-16 bg-gradient-to-r from-[#006332] to-[#00a550] text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center group hover:scale-110 z-50"
            data-testid="floating-cart-btn"
          >
            <ShoppingCart className="w-7 h-7" />
            <span className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              {cartCount}
            </span>
          </button>
        </Link>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #006332;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #005028;
        }
      `}</style>
    </div>
  );
};
