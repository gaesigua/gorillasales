'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import {
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  Coffee,
  CheckCircle2,
  ChevronRight,
  Lock,
  Layers,
  BarChart3,
} from 'lucide-react';

export default function HomePageClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-yellow-500 selection:text-slate-950">
      {/* 1. Header Navigation — no bottom border */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <AppLogo size={34} />
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight group-hover:text-yellow-600 transition-colors">
                GorillaSales
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-widest text-slate-900 bg-yellow-400 px-2 py-0.5 rounded-sm border border-yellow-500/30">
                Enterprise CRM
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-700">
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#heritage" className="hover:text-black transition-colors">Coffee Network</a>
            <a href="#products" className="hover:text-black transition-colors">Product Catalog</a>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>Get Started</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold border border-slate-200 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="hidden sm:flex px-3.5 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-28 overflow-hidden bg-slate-50/60 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-yellow-100 border border-yellow-300 text-slate-900 text-xs font-bold mb-6">
            <Sparkles size={14} className="text-yellow-700" />
            <span>Powering Rwanda's Iconic Coffee Distribution</span>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse ml-1" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.15]">
            Enterprise Field Sales Automation & CRM for{' '}
            <span className="text-yellow-600 underline decoration-yellow-400 underline-offset-4">Gorilla's Coffee</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed font-medium">
            Real-time daily visit logging, Kigali route management, pipeline deal tracking, and target achievement analytics—built specifically for Rwanda Farmers Coffee Company (RFCC).
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-5 py-3 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Lock size={16} />
              <span>Get Started</span>
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-5 py-3 rounded bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm border border-slate-200 flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>Explore Capabilities</span>
              <ChevronRight size={16} />
            </a>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded bg-white border border-slate-200 text-left shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Coffee Grade</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">100% Arabica</p>
              <p className="text-[11px] font-semibold text-yellow-700 mt-0.5">Bourbon Roasted</p>
            </div>
            <div className="p-4 rounded bg-white border border-slate-200 text-left shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Reps</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">5 Sales Officers</p>
              <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">Daily Visit Route</p>
            </div>
            <div className="p-4 rounded bg-white border border-slate-200 text-left shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Key Outlets</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">12+ Major Chains</p>
              <p className="text-[11px] font-semibold text-blue-700 mt-0.5">Hotels & Supermarkets</p>
            </div>
            <div className="p-4 rounded bg-white border border-slate-200 text-left shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Commission Engine</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">Automated</p>
              <p className="text-[11px] font-semibold text-purple-700 mt-0.5">RWF Target Bonus</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Heritage & Coffee Story */}
      <section id="heritage" className="py-16 md:py-24 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-yellow-50 border border-yellow-200 text-xs font-bold text-slate-900 mb-4">
                <Coffee size={14} className="text-yellow-600" />
                <span>Rwanda Farmers Coffee Company (RFCC)</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                From Volcanic Soils to Kigali's Finest Outlets
              </h2>
              <p className="mt-4 text-slate-700 text-sm leading-relaxed font-medium">
                Gorilla's Coffee is harvested by smallholder coffee farmers across Rwanda's high-altitude volcanic ridges. GorillaSales provides the digital sales backbone connecting roasted inventory directly to top luxury hotels, supermarkets, and international export partners.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-800">
                    <strong className="text-slate-900">Hotel Channels:</strong> Hotel des Mille Collines, Radisson Blu, Marriott Kigali.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-800">
                    <strong className="text-slate-900">Supermarket Retail:</strong> Nakumatt Kigali City Mall, Simba Supermarket.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-800">
                    <strong className="text-slate-900">Coffee Shops & HORECA:</strong> Bourbon Coffee Kimihurura & Kigali International Airport outlets.
                  </p>
                </div>
              </div>
            </div>

            {/* Product Cards Preview */}
            <div className="grid grid-cols-2 gap-4" id="products">
              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded bg-yellow-400 border border-yellow-500/40 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                  250G
                </div>
                <p className="text-sm font-bold text-slate-900">250G Roasted Coffee</p>
                <p className="text-xs font-semibold text-slate-700">RWF 2,600 / Pack</p>
                <span className="inline-block text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-sm font-bold">SKU: COF-250G</span>
              </div>

              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded bg-yellow-400 border border-yellow-500/40 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                  500G
                </div>
                <p className="text-sm font-bold text-slate-900">500G Medium Ground</p>
                <p className="text-xs font-semibold text-slate-700">RWF 4,800 / Pack</p>
                <span className="inline-block text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-sm font-bold">SKU: COF-500G-MG</span>
              </div>

              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded bg-yellow-400 border border-yellow-500/40 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                  1KG
                </div>
                <p className="text-sm font-bold text-slate-900">1KG Coffee Beans</p>
                <p className="text-xs font-semibold text-slate-700">RWF 9,000 / KG</p>
                <span className="inline-block text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-sm font-bold">SKU: COF-1KG-BEAN</span>
              </div>

              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded bg-yellow-400 border border-yellow-500/40 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                  PODS
                </div>
                <p className="text-sm font-bold text-slate-900">Espresso Pods</p>
                <p className="text-xs font-semibold text-slate-700">Custom HORECA Pack</p>
                <span className="inline-block text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-sm font-bold">Commercial Pods</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Section */}
      <section id="features" className="py-16 md:py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Built for Enterprise Coffee Sales Execution
            </h2>
            <p className="text-sm font-medium text-slate-700 mt-2">
              Everything your sales reps and route managers need to track orders, customers, and targets in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded bg-white border border-slate-200 space-y-3 shadow-sm">
              <div className="w-9 h-9 rounded bg-yellow-100 border border-yellow-300 flex items-center justify-center text-slate-900">
                <ClipboardCheck size={18} className="text-yellow-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Daily Visit & Sales Logging</h3>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Reps log customer visits across Kigali routes with outcome status (Order Placed, Follow-Up Required), units, price, and payment terms (Paid, Credit, Pending).
              </p>
            </div>

            <div className="p-5 rounded bg-white border border-slate-200 space-y-3 shadow-sm">
              <div className="w-9 h-9 rounded bg-yellow-100 border border-yellow-300 flex items-center justify-center text-slate-900">
                <BarChart3 size={18} className="text-yellow-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Monthly Target & Commission</h3>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Automated monthly revenue achievement in RWF and weight targets in KG. Includes tier-based bonus rules and top performer bonuses.
              </p>
            </div>

            <div className="p-5 rounded bg-white border border-slate-200 space-y-3 shadow-sm">
              <div className="w-9 h-9 rounded bg-yellow-100 border border-yellow-300 flex items-center justify-center text-slate-900">
                <Layers size={18} className="text-yellow-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Twenty CRM Custom Fields</h3>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Flexible custom metadata definitions for coffee roaster models, coffee machine types, and custom client attributes without code changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="mt-auto py-8 bg-white text-xs text-slate-600 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="font-bold text-slate-900 text-sm">GorillaSales</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium">Rwanda Farmers Coffee Company (RFCC)</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://gorillascoffee.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 font-semibold transition-colors"
            >
              Gorilla's Coffee Official Site ↗
            </a>
            <Link href="/login" className="hover:text-slate-900 font-semibold transition-colors">
              Workspace Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}