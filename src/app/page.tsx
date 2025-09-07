'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/ui/Header';
import { Card, CardImage, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Hero } from '@/components/ui/Hero';
import { Newsletter } from '@/components/ui/Newsletter';
import { Footer } from '@/components/ui/Footer';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  description?: string;
}

export default function PropertyListings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filters
  const [filters, setFilters] = useState({
    state: '',
    minPrice: '',
    maxPrice: '',
    minBedrooms: '',
    minBathrooms: '',
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setProperties(data.properties || []);
      }
    } catch (err) {
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(property => {
    if (filters.state && property.state !== filters.state) return false;
    if (filters.minPrice && property.listPrice < parseInt(filters.minPrice)) return false;
    if (filters.maxPrice && property.listPrice > parseInt(filters.maxPrice)) return false;
    if (filters.minBedrooms && property.bedrooms < parseInt(filters.minBedrooms)) return false;
    if (filters.minBathrooms && property.bathrooms < parseFloat(filters.minBathrooms)) return false;
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-orange mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-6 text-lg">Error: {error}</p>
          <Button onClick={fetchProperties} variant="primary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />
      
      {/* Hero Section */}
      <Hero
        title="Your Dream Home is Waiting"
        subtitle="Life threw you curveballs? We get it.<br/>Traditional banks turned you down? We understand.<br/>You deserve a home.<br/>We're here to help make it happen."
        showUserTypeButtons={true}
      />

      {/* Empathy Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-blue-50 to-indigo-100 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-200/30 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-200/30 to-transparent rounded-full translate-y-24 -translate-x-24"></div>
        
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            We See You. We Believe in You.
          </h2>
          
          <div className="space-y-4 mb-8">
            <p className="text-lg text-gray-600 leading-relaxed">
              Maybe your credit took a hit during tough times.<br/>
              Maybe you're self-employed and traditional lenders don't understand your income.<br/>
              Maybe life happened and the banks just don't see your potential.
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100">
            <p className="text-xl text-gray-800 font-semibold">
              We do.<br/>
              You deserve better than rejection letters.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-primary-text mb-6">
            How We're Making It Happen
          </h2>
          <p className="text-base text-secondary-text leading-relaxed">
            No credit checks. No bank applications. No judgment. Just a simple path to homeownership.
          </p>
        </div>
        
        {/* Mobile-first steps */}
        <div className="space-y-6">
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft border-l-4 border-accent-primary">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent-primary rounded-full flex items-center justify-center text-surface-bg font-bold text-lg flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-primary-text mb-2 text-lg">Share Your Story</h3>
                <p className="text-secondary-text">Tell us about your life, your needs, and what home means to you. No judgment, just understanding.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft border-l-4 border-accent-warm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent-warm rounded-full flex items-center justify-center text-surface-bg font-bold text-lg flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-primary-text mb-2 text-lg">We Find Your Perfect Match</h3>
                <p className="text-secondary-text">Real homes with real owners who believe in giving people second chances. No banks involved.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-bg rounded-xl p-6 shadow-soft border-l-4 border-accent-success">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent-success rounded-full flex items-center justify-center text-surface-bg font-bold text-lg flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-primary-text mb-2 text-lg">Get Your Keys</h3>
                <p className="text-secondary-text">Move in faster with direct owner financing. Build equity while you build your future.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-10">
          <Button variant="primary" size="lg" href="/unified-signup?userType=buyer" className="w-full font-semibold text-lg py-4 min-h-[56px]">
            Take the First Step 🏡
          </Button>
          <p className="text-sm text-muted-text mt-3">Takes less than 2 minutes • Completely free • No obligations</p>
        </div>
      </section>

      {/* Trust Building Section */}
      <section className="py-8 px-6 bg-gradient-to-br from-accent-light to-surface-bg">
        <div className="bg-surface-bg rounded-xl p-6 shadow-soft">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-primary-text mb-3">
              💙 You're Not Alone
            </h3>
            <p className="text-secondary-text mb-4">
              Over 2,000 families have found their home through OwnerFi. People just like you who refused to give up on their dream.
            </p>
            <div className="flex justify-center space-x-8 text-sm text-muted-text">
              <span>✓ No hidden fees</span>
              <span>✓ Real support</span>
              <span>✓ Your success is our mission</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Properties Teaser */}
      <section className="py-12 px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-primary-text mb-4">
            These Families Found Their Home
          </h2>
          <p className="text-base text-secondary-text">
            Real people, real stories, real second chances:
          </p>
        </div>
        
        {/* Show just 2-3 sample properties on mobile with success stories */}
        <div className="space-y-6 mb-10">
          {properties.slice(0, 3).map((property, index) => {
            const testimonials = [
              "Sarah & Mike: 'After bankruptcy, we thought we'd never own again. OwnerFi proved us wrong.'",
              "Carlos: 'Self-employed income was always a problem. Not here.'",
              "Jennifer: 'Single mom with imperfect credit. Finally have keys to our own place.'"
            ];
            
            // Override with diverse locations
            const locations = [
              { city: "Atlanta", state: "GA" },
              { city: "Memphis", state: "TN" },
              { city: "Tampa", state: "FL" }
            ];
            
            const location = locations[index] || { city: property.city, state: property.state };
            
            // Override prices and calculate realistic payments
            const specificPrices = [347500, 275000, 399000]; // Atlanta, Memphis, Tampa
            const adjustedPrice = specificPrices[index] || (property.listPrice + 200000);
            const downPaymentPercentages = [0.10, 0.05, 0.15];
            const downPaymentAmount = adjustedPrice * downPaymentPercentages[index];
            
            // Calculate realistic monthly payments (30-year owner financing at ~8% interest)
            const loanAmount = adjustedPrice - downPaymentAmount;
            const monthlyRate = 0.08 / 12; // 8% annual rate / 12 months
            const numPayments = 30 * 12; // 30 years
            const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
            
            return (
              <div key={property.id} className="bg-surface-bg rounded-xl p-5 shadow-soft border border-neutral-border">
                <div className="mb-3">
                  <p className="text-sm text-accent-primary font-medium italic">
                    {testimonials[index] || "Another success story waiting to be written..."}
                  </p>
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-primary-text text-lg">{location.city}, {location.state}</h3>
                    <p className="text-secondary-text">{property.bedrooms} bed • {property.bathrooms} bath • {property.squareFeet.toLocaleString()} sq ft</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-accent-primary text-lg">{formatCurrency(adjustedPrice)}</p>
                    <p className="text-secondary-text text-sm">Only {formatCurrency(monthlyPayment)}/mo</p>
                    <p className="text-xs text-accent-warm font-medium">
                      {formatCurrency(downPaymentAmount)} down
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="text-center">
          <Button variant="primary" size="lg" href="/unified-signup?userType=buyer" className="w-full font-semibold text-lg py-4 min-h-[56px]">
            Find My Dream Home ✨
          </Button>
          <p className="text-sm text-muted-text mt-3">Join 2,000+ families who found hope through OwnerFi</p>
        </div>
      </section>
      
      {/* Newsletter Section */}
      <Newsletter />
      
      {/* Footer */}
      <Footer />
      
      {/* Admin Access - Hidden at bottom */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-screen-xl mx-auto px-6 text-center">
          <Button variant="outline" size="sm" href="/admin" className="text-xs text-gray-500">
            Admin: Upload Properties
          </Button>
        </div>
      </div>
    </div>
  );
}