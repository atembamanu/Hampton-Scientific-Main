import { ArrowRight, CheckCircle2, GraduationCap, Wrench, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productCategories } from '../data/mock';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export const Home = () => {
  const services = [
    {
      icon: Package,
      title: 'Medical Equipment Supply',
      description: 'Comprehensive range of laboratory and healthcare consumables from certified manufacturers.',
      features: ['Diagnostic Test Kits', 'Laboratory Reagents', 'Medical Instruments']
    },
    {
      icon: GraduationCap,
      title: 'Professional Training',
      description: 'Structured, hands-on training for safe operation and optimal equipment performance.',
      features: ['Equipment Operation', 'Quality Control', 'Troubleshooting']
    },
    {
      icon: Wrench,
      title: 'Installation & Maintenance',
      description: 'Certified installations and reliable maintenance throughout the service lifecycle.',
      features: ['Professional Setup', 'Regular Servicing', 'Technical Support']
    }
  ];

  const whyChooseUs = [
    'Certified healthcare equipment from trusted manufacturers',
    'Comprehensive technical training and support',
    'Professional installation and commissioning',
    'Reliable after-sales service and maintenance',
    'Deep understanding of African healthcare needs',
    'Quality assurance and compliance standards'
  ];

  return (
    <div className="min-h-screen pt-36 lg:pt-40">
      {/* Hero Section */}
      <section className="relative pb-20 px-4 sm:px-6 overflow-hidden min-h-[600px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-green-50/30 to-white" />
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#006332] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00a550] rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto relative z-10 px-2 sm:px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 sm:space-y-8">
              <div className="inline-block">
                <span className="px-3 sm:px-4 py-2 bg-[#006332]/10 text-[#006332] rounded-full text-xs sm:text-sm font-semibold border border-[#006332]/20">
                  Trusted Healthcare Solutions Partner
                </span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Connecting Africa's Healthcare with
                <span className="text-[#006332]"> Global Innovation</span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed">
                We supply cutting-edge medical equipment, laboratory consumables, and provide comprehensive training to healthcare providers across Africa.
              </p>
              
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Link to="/products">
                  <Button size="lg" className="bg-[#006332] hover:bg-[#005028] text-white shadow-lg hover:shadow-xl transition-all group text-sm sm:text-base">
                    Explore Products
                    <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="border-2 border-[#006332] text-[#006332] hover:bg-[#006332] hover:text-white transition-all text-sm sm:text-base">
                    Request Quote
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwxfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85"
                  alt="Healthcare Professional"
                  className="w-full h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              
              {/* Floating Stats */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-6 border-t-4 border-[#006332]">
                <div className="text-4xl font-bold text-[#006332]">4+</div>
                <div className="text-sm text-gray-600 mt-1">Years Enabling Healthcare</div>
              </div>
              
              <div className="absolute -top-6 -right-6 bg-white rounded-xl shadow-xl p-6 border-t-4 border-[#006332]">
                <div className="text-4xl font-bold text-[#006332]">10+</div>
                <div className="text-sm text-gray-600 mt-1">Healthcare Facilities Served</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Core Services</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive healthcare solutions tailored to meet the unique needs of medical facilities across Africa
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card key={index} className="border-2 border-gray-100 hover:shadow-xl transition-all duration-300 group">
                  <CardHeader>
                    <div className="w-16 h-16 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{service.title}</CardTitle>
                    <CardDescription className="text-base">{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-[#006332] flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product Categories Preview */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Product Categories</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Browse our comprehensive range of medical laboratory and healthcare supplies
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productCategories.slice(0, 6).map((category) => (
              <Link key={category.id} to="/products" className="group">
                <Card className="overflow-hidden border-2 border-gray-100 hover:shadow-xl transition-all duration-300 h-full">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white font-bold text-lg">{category.name}</h3>
                    </div>
                  </div>
                  <CardContent className="pt-4">
                    <p className="text-gray-600 text-sm line-clamp-2">{category.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/products">
              <Button size="lg" className="bg-[#006332] hover:bg-[#005028] text-white group">
                View All Products
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwyfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85"
                alt="Medical Professional"
                className="rounded-2xl shadow-2xl"
              />
            </div>
            
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Why Choose Hampton Scientific?</h2>
              <p className="text-xl text-gray-600 mb-8">
                Your trusted partner for healthcare excellence with proven track record across Africa.
              </p>
              
              <div className="grid gap-4">
                {whyChooseUs.map((reason, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg hover:bg-green-50 transition-colors">
                    <CheckCircle2 className="w-6 h-6 text-[#006332] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 font-medium">{reason}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8">
                <Link to="/about">
                  <Button size="lg" variant="outline" className="border-2 border-[#006332] text-[#006332] hover:bg-[#006332] hover:text-white transition-all">
                    Learn More About Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#006332] to-[#00a550] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl font-bold mb-6">Ready to Elevate Your Healthcare Facility?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto opacity-90">
            Get in touch with our team to discuss your equipment needs, request a quote, or schedule training for your staff.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/contact">
              <Button size="lg" className="bg-white text-[#006332] hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all">
                Request a Quote
              </Button>
            </Link>
            <Link to="/products">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-[#006332] transition-all">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
