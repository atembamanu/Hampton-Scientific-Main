import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../components/ui/accordion';
import { API_URL } from '@/config/apiBaseUrl';

export const Training = () => {
  const [trainingPrograms, setTrainingPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrainingPrograms = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/training/programs`);
        setTrainingPrograms(response.data);
      } catch (error) {
        console.error('Error fetching training programs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrainingPrograms();
  }, []);

  const deliveryOptions = [
    'On-site equipment training at your facility',
    'Commissioning-day training during installation',
    'Refresher and periodic retraining sessions',
    'User-level and supervisor-level training programs'
  ];

  return (
    <div className="min-h-screen pt-36 lg:pt-40 pb-20 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-[#006332]/10 text-[#006332] rounded-full text-sm font-semibold border border-[#006332]/20">
              Professional Development
            </span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Training Programs</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Structured, hands-on training to ensure safe operation, accurate results, and optimal performance of your medical equipment
          </p>
        </div>

        {/* Hero Image */}
        <div className="mb-16 relative rounded-2xl overflow-hidden h-96 shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwzfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85"
            alt="Training Program"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
            <div className="container mx-auto px-8">
              <h2 className="text-4xl font-bold text-white mb-4">Expert-Led Technical Training</h2>
              <p className="text-xl text-white/90 max-w-2xl">
                Empower your team with the knowledge and skills to maximize equipment performance and ensure quality patient care
              </p>
            </div>
          </div>
        </div>

        {/* Training Programs Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#006332]" />
          </div>
        ) : (
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {trainingPrograms.map((program) => (
            <Card key={program.program_id || program.id} className="border-2 border-gray-100 hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#006332] to-[#00a550] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{program.title}</CardTitle>
                    <CardDescription className="text-base">{program.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <Badge className="bg-[#006332]/10 text-[#006332] border-[#006332]/20">
                    <Clock className="w-3 h-3 mr-1" />
                    {program.duration}
                  </Badge>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                    <Users className="w-3 h-3 mr-1" />
                    Hands-on
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="topics" className="border-none">
                    <AccordionTrigger className="text-[#006332] hover:no-underline">
                      View Training Topics
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 mt-2">
                        {program.topics.map((topic, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-[#006332] flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {/* Training Delivery Options */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Training Delivery Options</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {deliveryOptions.map((option, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <CheckCircle2 className="w-6 h-6 text-[#006332] flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 font-medium">{option}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-[#006332] to-[#00a550] rounded-2xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">Ready to Train Your Team?</h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Schedule a training session or request a custom training program tailored to your facility&apos;s specific needs
            </p>
            <Link to="/contact?tab=training">
              <Button size="lg" className="bg-white text-[#006332] hover:bg-gray-100 shadow-lg">
                Schedule Training
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
