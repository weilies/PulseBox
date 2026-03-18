'use client';

import React from 'react';
import { Card } from './ui/card';

export function ThemeShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg-primary via-dark-bg-secondary to-dark-bg-tertiary p-12">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold" style={{ fontFamily: "var(--font-geist-sans), sans-serif", letterSpacing: '2px' }}>
            <span className="neon-blue">Cyber</span>
            <span className="neon-purple">Pulse</span>
          </h1>
          <p className="text-lg text-muted-foreground">Futuristic Dark Theme for PulseBoard</p>
        </div>

        {/* Neon Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Neon Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glow-card p-6 text-center">
              <div className="w-12 h-12 rounded bg-blue-400 mx-auto mb-3 shadow-lg" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }} />
              <p className="neon-blue font-semibold">Cyan</p>
              <p className="text-xs text-muted-foreground">#00f0ff</p>
            </div>
            <div className="glow-card p-6 text-center">
              <div className="w-12 h-12 rounded bg-purple-500 mx-auto mb-3 shadow-lg" style={{ boxShadow: '0 0 20px rgba(79, 70, 229, 0.8)' }} />
              <p className="neon-purple font-semibold">Purple</p>
              <p className="text-xs text-muted-foreground">#c700ff</p>
            </div>
            <div className="glow-card p-6 text-center">
              <div className="w-12 h-12 rounded bg-blue-500 mx-auto mb-3 shadow-lg" style={{ boxShadow: '0 0 20px rgba(96, 165, 250, 0.8)' }} />
              <p className="neon-blue font-semibold">Blue</p>
              <p className="text-xs text-muted-foreground">#0080ff</p>
            </div>
            <div className="glow-card p-6 text-center">
              <div className="w-12 h-12 rounded bg-pink-500 mx-auto mb-3 shadow-lg" style={{ boxShadow: '0 0 20px rgba(255, 0, 110, 0.8)' }} />
              <p className="text-pink-400 font-semibold">Pink</p>
              <p className="text-xs text-muted-foreground">#ff006e</p>
            </div>
            <div className="glow-card p-6 text-center">
              <div className="w-12 h-12 rounded bg-lime-400 mx-auto mb-3 shadow-lg" style={{ boxShadow: '0 0 20px rgba(57, 255, 20, 0.8)' }} />
              <p className="text-lime-400 font-semibold">Lime</p>
              <p className="text-xs text-muted-foreground">#39ff14</p>
            </div>
          </div>
        </section>

        {/* Glow Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Glassmorphism Cards</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glow-card p-6 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Real-time Sync</h3>
              <p className="text-sm text-muted-foreground">Instant data synchronization across all devices with zero latency</p>
            </div>
            <div className="glow-card p-6 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
              <p className="text-sm text-muted-foreground">Deep insights into team performance with AI-powered predictions</p>
            </div>
            <div className="glow-card p-6 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-blue-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Secure & Encrypted</h3>
              <p className="text-sm text-muted-foreground">Enterprise-grade security with end-to-end encryption</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Interactive Elements</h2>
          <div className="flex flex-wrap gap-4">
            <button className="btn-neon">
              Primary Button
            </button>
            <button className="btn-neon border-purple-400" style={{ borderColor: '#c700ff', boxShadow: '0 0 15px rgba(79, 70, 229, 0.3)' }}>
              Secondary Button
            </button>
            <button className="btn-neon border-blue-500" style={{ borderColor: '#0080ff', boxShadow: '0 0 15px rgba(96, 165, 250, 0.3)' }}>
              Accent Button
            </button>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Typography</h2>
          <div className="glow-card p-8 space-y-6">
            <div>
              <h3 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
                Space Mono Display
              </h3>
              <p className="text-sm text-muted-foreground">Used for headings and titles</p>
            </div>
            <div>
              <p className="text-base mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                JetBrains Mono Code Font
              </p>
              <p className="text-sm text-muted-foreground">Used for code and technical content</p>
            </div>
            <div>
              <p className="text-base mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Poppins Body Font
              </p>
              <p className="text-sm text-muted-foreground">Used for body text and UI content</p>
            </div>
          </div>
        </section>

        {/* Status Indicators */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Status Indicators</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="glow-card p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-sm">Active</span>
            </div>
            <div className="glow-card p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-sm">Processing</span>
            </div>
            <div className="glow-card p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-sm">Success</span>
            </div>
            <div className="glow-card p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm">Alert</span>
            </div>
          </div>
        </section>

        {/* Effects Showcase */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Special Effects</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glow-card p-8 flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-glow text-3xl font-bold neon-blue mb-4">
                Neon Glow Text
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Pulsing neon text effect with dynamic glow
              </p>
            </div>
            <div className="glow-card p-8 flex flex-col items-center justify-center min-h-[200px] pulse-glow">
              <div className="text-3xl font-bold mb-4">✨</div>
              <p className="text-sm text-muted-foreground text-center">
                Pulse glow effect on container
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
