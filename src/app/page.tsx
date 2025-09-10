'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header style={{
        padding: 'var(--space-4) var(--space-4)',
        borderBottom: '1px solid var(--gray-200)',
        background: 'var(--white)',
        position: 'sticky',
        top: '0',
        zIndex: '50'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🏠
            </div>
            <span style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)'
            }}>
              OwnerFi
            </span>
          </div>
          <div className="flex gap-2">
            <a href="/auth/signin" className="btn-ghost btn-sm">Sign In</a>
          </div>
        </div>
      </header>

      {/* Hero Section - Mobile Perfect */}
      <section style={{
        padding: 'var(--space-12) var(--space-4)',
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--white) 100%)'
      }}>
        <div style={{maxWidth: '340px', margin: '0 auto'}}>
          <h1 style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 'var(--font-extrabold)',
            color: 'var(--blue-950)',
            marginBottom: 'var(--space-4)',
            lineHeight: '1.1'
          }}>
            Your Dream Home is Waiting
          </h1>
          
          <p style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--blue-700)',
            marginBottom: 'var(--space-8)',
            lineHeight: '1.5'
          }}>
            Life threw you curveballs? We get it. Traditional banks turned you down? We understand.
            <br /><br />
            <strong>You deserve a home.</strong>
            <br />
            We're here to help make it happen.
          </p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'}}>
            <a href="/unified-signup" className="btn-primary btn-lg w-full">
              🏠 I Need a Home (Start Here)
            </a>
            <a href="/unified-signup" className="btn-secondary btn-lg w-full">
              🏠 I Help Families Find Homes
            </a>
          </div>
          
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--gray-500)',
            marginTop: 'var(--space-6)'
          }}>
            Free to start • No credit check required • Real human support
          </p>
        </div>
      </section>

      {/* Value Proposition */}
      <section style={{
        padding: 'var(--space-16) var(--space-4)',
        background: 'var(--white)'
      }}>
        <div style={{maxWidth: '340px', margin: '0 auto', textAlign: 'center'}}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-6) auto'
          }}>
            <span style={{fontSize: '2rem'}}>✓</span>
          </div>
          
          <h2 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--blue-950)',
            marginBottom: 'var(--space-4)'
          }}>
            We See You. We Believe in You.
          </h2>
          
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--blue-700)',
            lineHeight: '1.6',
            marginBottom: 'var(--space-8)'
          }}>
            Maybe your credit took a hit during tough times. Maybe you're self-employed and traditional lenders don't understand your income.
            <br /><br />
            Maybe life happened and the banks just don't see your potential.
            <br /><br />
            <strong style={{color: 'var(--gray-900)'}}>We do.</strong>
            <br /><br />
            You deserve better than rejection letters.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section style={{
        padding: 'var(--space-16) var(--space-4)',
        background: 'var(--blue-50)'
      }}>
        <div style={{maxWidth: '340px', margin: '0 auto'}}>
          <h2 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--blue-950)',
            textAlign: 'center',
            marginBottom: 'var(--space-2)'
          }}>
            How We're Making It Happen
          </h2>
          
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--blue-700)',
            textAlign: 'center',
            marginBottom: 'var(--space-12)'
          }}>
            No credit checks. No bank applications. No judgment. Just a simple path to homeownership.
          </p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-8)'}}>
            {/* Step 1 */}
            <div className="flex gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'var(--font-bold)',
                fontSize: 'var(--text-lg)',
                flexShrink: '0'
              }}>
                1
              </div>
              <div>
                <h3 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--blue-950)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Share Your Story
                </h3>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--blue-700)',
                  lineHeight: '1.5'
                }}>
                  Tell us about your life, your needs, and what home means to you. No judgment, just understanding.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'var(--font-bold)',
                fontSize: 'var(--text-lg)',
                flexShrink: '0'
              }}>
                2
              </div>
              <div>
                <h3 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--blue-950)',
                  marginBottom: 'var(--space-2)'
                }}>
                  We Find Your Perfect Match
                </h3>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--blue-700)',
                  lineHeight: '1.5'
                }}>
                  Real homes. Real owners willing to finance. Real opportunities that traditional lending can't touch.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div style={{
                width: '48px',
                height: '48px',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'var(--font-bold)',
                fontSize: 'var(--text-lg)',
                flexShrink: '0'
              }}>
                3
              </div>
              <div>
                <h3 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--blue-950)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Move In
                </h3>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--blue-700)',
                  lineHeight: '1.5'
                }}>
                  Direct owner financing means faster closings, flexible terms, and a path home that actually works for you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: 'var(--space-16) var(--space-4)',
        background: 'var(--gray-900)',
        textAlign: 'center'
      }}>
        <div style={{maxWidth: '340px', margin: '0 auto'}}>
          <h2 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--white)',
            marginBottom: 'var(--space-4)'
          }}>
            Ready to Find Your Home?
          </h2>
          
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--gray-300)',
            marginBottom: 'var(--space-8)'
          }}>
            Join thousands who've found their dream home through owner financing.
          </p>
          
          <a href="/unified-signup" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '56px',
            padding: 'var(--space-4) var(--space-8)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--blue-950)',
            background: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            width: '100%'
          }}>
            Start Your Home Search Today
          </a>
          
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--gray-400)',
            marginTop: 'var(--space-4)'
          }}>
            Takes less than 2 minutes • Completely free • No obligations
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: 'var(--space-8) var(--space-4)',
        background: 'var(--blue-50)',
        borderTop: '1px solid var(--gray-200)'
      }}>
        <div style={{maxWidth: '340px', margin: '0 auto', textAlign: 'center'}}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div style={{
              width: '24px',
              height: '24px',
              background: 'var(--primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🏠
            </div>
            <span style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--gray-900)'
            }}>
              OwnerFi
            </span>
          </div>
          
          <div className="flex justify-center gap-6 mb-6">
            <a href="/terms" style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)',
              textDecoration: 'none'
            }}>Terms</a>
            <a href="/privacy" style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)',
              textDecoration: 'none'
            }}>Privacy</a>
            <a href="/contact" style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)',
              textDecoration: 'none'
            }}>Contact</a>
          </div>
          
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--gray-400)'
          }}>
            © 2025 OwnerFi. Your trusted partner on the path to homeownership.
          </p>
        </div>
      </footer>
    </div>
  );
}