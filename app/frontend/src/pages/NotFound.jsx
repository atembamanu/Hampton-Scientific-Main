import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/ui/button';

export const NotFound = () => {
  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 bg-gray-50 flex items-center justify-center">
      <div className="container mx-auto px-4 text-center max-w-lg">
        <div className="mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-bold text-6xl">404</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600 text-lg mb-8">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button className="bg-[#006332] hover:bg-[#005028] text-white gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Go to Homepage
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="border-[#006332] text-[#006332] gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            Need help? <Link to="/contact" className="text-[#006332] hover:underline">Contact us</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
