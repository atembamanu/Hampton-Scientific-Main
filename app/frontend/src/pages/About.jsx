import { useState, useEffect } from 'react';
import { Target, Eye, Heart, Award, CheckCircle2, TrendingUp, Users, Award as AwardIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export const About = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const values = [
    {
      icon: Heart,
      title: 'Quality First',
      description: 'We source only certified, reliable equipment from trusted global manufacturers'
    },
    {
      icon: Target,
      title: 'Customer Focus',
      description: 'Your success is our priority - we provide comprehensive support throughout your journey'
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'Commitment to the highest standards in service delivery and technical expertise'
    },
    {
      icon: Eye,
      title: 'Innovation',
      description: 'Bringing cutting-edge healthcare solutions to African medical facilities'
    }
  ];

  const capabilities = [
    'Exclusive partnerships with certified global manufacturers',
    'Deep understanding of African healthcare infrastructure',
    'Technical expertise in medical equipment installation',
    'Comprehensive training programs for healthcare professionals',
    'Reliable supply chain and logistics management',
    'After-sales support and maintenance services',
    'Quality assurance and compliance standards',
    'Customized solutions for diverse facility needs'
  ];

  const stats = [
    { icon: TrendingUp, value: '4+', label: 'Years Enabling Healthcare' },
    { icon: Users, value: '10+', label: 'Facilities Served' },
    { icon: AwardIcon, value: '1000+', label: 'Staff Trained' },
    { icon: CheckCircle2, value: '50+', label: 'Product Categories' }
  ];

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-green-50 opacity-50" />
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute top-20 right-10 w-96 h-96 bg-[#006332] rounded-full blur-3xl"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        />
        <div 
          className="absolute bottom-20 left-10 w-[500px] h-[500px] bg-[#00a550] rounded-full blur-3xl"
          style={{ transform: `translateY(${-scrollY * 0.15}px)` }}
        />
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header with Parallax Effect */}
        <div className="mb-20 text-center" style={{ transform: `translateY(${scrollY * 0.05}px)` }}>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            About Hampton Scientific
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Your trusted partner in connecting Africa's healthcare sector with global scientific innovation
          </p>
        </div>

        {/* Hero Image with Zoom Effect */}
        <div className="mb-20 relative rounded-3xl overflow-hidden h-[500px] shadow-2xl group">
          <img
            src="https://images.unsplash.com/photo-1603398938378-e54eab446dde?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHw0fHxtZWRpY2FsfGVufDB8fHx8MTc2ODQ3MjY4NHww&ixlib=rb-4.1.0&q=85"
            alt="About Hampton Scientific"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <h2 className="text-4xl font-bold mb-4">Transforming Healthcare Across Africa</h2>
            <p className="text-xl opacity-90">Excellence in medical equipment supply and training since 2009</p>
          </div>
        </div>

        {/* Mission & Vision with Slide-in Animation */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <Card className="border-2 border-[#006332] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white/90 backdrop-blur-sm group">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Target className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed text-lg">
                To deliver reliable, cutting-edge healthcare tools and technologies to medical facilities across Africa, 
                empowering healthcare providers with the equipment and knowledge they need to deliver high-quality patient care.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#006332] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white/90 backdrop-blur-sm group">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl">Our Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed text-lg">
                To be Africa's leading healthcare solutions provider, recognized for excellence in medical equipment supply, 
                training, and support services that transform healthcare delivery across the continent.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* What We Do Section with Gradient Background */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">What We Do</h2>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-blue-50" />
            <div className="relative p-12 space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                Hampton Scientific Limited connects Africa's healthcare sector with global scientific and healthcare innovations. 
                We enable healthcare providers to access reliable, cutting-edge tools and technologies that support high-quality patient care.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Our mission is to deliver the right healthcare solutions to your facility—sourced exclusively from trusted and 
                certified healthcare equipment manufacturers.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Beyond procurement, we support your facility with customized training, certified installations, and reliable 
                maintenance throughout the service lifecycle.
              </p>
            </div>
          </div>
        </div>

        {/* Core Values with Stagger Animation */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">Our Core Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card 
                  key={index} 
                  className="border-2 border-gray-100 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 group text-center bg-white/90 backdrop-blur-sm"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <CardHeader>
                    <div className="w-20 h-20 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-500">
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-base leading-relaxed">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">Our Capabilities</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {capabilities.map((capability, index) => (
              <div 
                key={index} 
                className="flex items-start gap-4 p-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 hover:border-[#006332] hover:shadow-2xl transition-all duration-500 transform hover:-translate-x-2 group"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-gray-700 font-medium text-base leading-relaxed">{capability}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Section with Counter Animation */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#006332] via-[#00a550] to-[#006332]" />
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          <div className="relative z-10 p-16">
            <h2 className="text-4xl font-bold mb-16 text-center text-white">Our Impact</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div 
                    key={index} 
                    className="text-center group cursor-pointer"
                  >
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-500">
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-6xl font-bold mb-3 text-white group-hover:scale-110 transition-transform duration-300">{stat.value}</div>
                    <div className="text-xl opacity-90 text-white">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
