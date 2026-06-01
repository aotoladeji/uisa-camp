import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, Phone, Mail, Instagram, Globe, ChevronRight, Star, Shield, Clock } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import api from '../utils/api';

const SPORTS = [
  { name: 'Football',   emoji: '⚽', color: '#16A34A' },
  { name: 'Basketball', emoji: '🏀', color: '#EA580C' },
  { name: 'Athletics',  emoji: '🏃', color: '#7C3AED' },
  { name: 'Swimming',   emoji: '🏊', color: '#0891B2' },
  { name: 'Tennis',     emoji: '🎾', color: '#D97706' },
];

const HIGHLIGHTS = [
  'Pro Coaching & Skill Sessions',
  'Strength & Conditioning',
  'Competitive Matches',
  'Sports & Nutrition Workshops',
  'Maths & English Language Classes',
  'Talent Certification',
  'Meet Sports Personality',
  'Guest Lecture',
  '3 Meals & Boarding',
  'Evening Study',
  'T-Shirts & Medicals',
  'Certificates',
  'Sports Role Model',
  'Cinema & Field Trips',
];

export default function HomePage() {
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/applicants/pricing');
        setPricing(res.data?.pricing || null);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const earlyBird = Boolean(pricing?.early_bird_active);
  const regularFee = pricing?.regular_fee || 230000;
  const earlyBirdFee = pricing?.computed_early_bird_fee || 207000;
  const earlyBirdDiscount = pricing?.fee_source === 'fixed_amount'
    ? Math.max(0, Math.round((1 - (earlyBirdFee / regularFee)) * 100))
    : (pricing?.early_bird_discount_pct || 10);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)' }}>

      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <BrandLogo width={230} compact />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/admin/login" className="btn btn-ghost btn-sm">Admin</Link>
            <Link to="/status" className="btn btn-ghost btn-sm">Check Status</Link>
            <Link to="/register" className="btn btn-gold btn-sm">Register Now</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{
        backgroundImage: 'linear-gradient(rgba(8, 27, 56, 0.78), rgba(8, 27, 56, 0.78)), url(/ui-gate-hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        padding: '80px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        {[200,350,500].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: s, height: s,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '50%',
            top: -s/3, right: -s/4,
          }} />
        ))}

        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {earlyBird && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(232,160,0,0.15)',
              border: '1px solid rgba(232,160,0,0.4)',
              borderRadius: 20, padding: '5px 16px',
              color: '#FFB820', fontSize: 13, fontWeight: 600,
              marginBottom: 24,
            }}>
              <Star size={14} fill="currentColor" />
              Early Bird: {earlyBirdDiscount}% OFF — Ends July 3, 2026
            </div>
          )}

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(38px, 7vw, 72px)',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.05,
            marginBottom: 20,
          }}>
            4-Week Summer<br />
            <span style={{ color: 'var(--gold)' }}>Sports Camp</span>
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', marginBottom: 12, maxWidth: 580, margin: '0 auto 12px' }}>
            A Safe, Fun and Educational Sports Program for Kids
          </p>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>
            Ages 6–17 & 18–23 • August 3 – 28, 2026
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <Link to="/register" className="btn btn-gold btn-lg" style={{ fontSize: 16 }}>
              Enrol Your Child Today
              <ChevronRight size={18} />
            </Link>
            <Link to="/status" className="btn btn-outline btn-lg" style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
              Check Application Status
            </Link>
          </div>

          {/* Stats bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1, background: 'rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-xl)', overflow: 'hidden', maxWidth: 600, margin: '0 auto',
          }}>
            {[
              { icon: Calendar, label: 'Camp Duration', value: '4 Weeks' },
              { icon: Users,    label: 'Age Groups',   value: '6 – 23 yrs' },
              { icon: Trophy,   label: 'Program Fee',  value: `₦${regularFee.toLocaleString()}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ padding: '20px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.04)' }}>
                <Icon size={20} color="var(--gold)" style={{ marginBottom: 6 }} />
                <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPORTS ─────────────────────────────────────────────── */}
      <section style={{ padding: '64px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Available Sports</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: 'var(--navy)' }}>
              Choose Your Sport
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {SPORTS.map(({ name, emoji, color }) => (
              <div key={name} style={{
                background: 'var(--white)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 32px',
                textAlign: 'center',
                minWidth: 120,
                transition: 'all .2s',
                cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHTS ─────────────────────────────────────────── */}
      <section style={{ padding: '64px 24px', background: 'var(--white)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>What's Included</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: 'var(--navy)' }}>Program Highlights</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {HIGHLIGHTS.map(h => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                {h}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAYMENT INFO ───────────────────────────────────────── */}
      <section style={{ padding: '64px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: 'var(--navy)' }}>Payment Details</h2>
          </div>
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ gridColumn: '1/-1', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Bank Transfer</div>
                <div style={{ fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--navy)', letterSpacing: '.5px' }}>1805832892</div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>University of Ibadan MacArthur Grants · Access Bank</div>
              </div>
              {[
                { label: 'Regular Fee', value: `₦${regularFee.toLocaleString()}`, note: 'After July 3, 2026' },
                { label: 'Early Bird Fee', value: `₦${earlyBirdFee.toLocaleString()}`, note: `${earlyBirdDiscount}% off, before July 3`, highlight: true },
              ].map(({ label, value, note, highlight }) => (
                <div key={label} style={{ background: highlight ? 'rgba(232,160,0,0.08)' : 'var(--surface)', border: highlight ? '1.5px solid rgba(232,160,0,0.3)' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: highlight ? 'var(--amber)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--navy)' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{note}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--text-3)', background: 'rgba(26,111,165,0.06)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                <strong style={{ color: 'var(--blue)' }}>Important:</strong> Use <em>Applicant Name + SPORT</em> as your transfer narration (e.g., "John Adeyemi Football")
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DETAILS ────────────────────────────────────────────── */}
      <section style={{ padding: '64px 24px', background: 'var(--navy)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
            {[
              { icon: MapPin, label: 'Venue', value: 'International School, University of Ibadan, Ibadan, Oyo State' },
              { icon: Calendar, label: 'Dates', value: 'August 3 – 28, 2026' },
              { icon: Clock, label: 'Time', value: '9AM – 6PM (Class Mode)\nBoarding Camp' },
              { icon: Shield, label: 'Deadline', value: 'Registration: July 25, 2026\nEarly Bird: July 3, 2026' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color="var(--gold)" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ color: 'white', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'var(--white)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 800, color: 'var(--navy)', marginBottom: 16 }}>
          Ready to Develop a Champion?
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Spots are limited. Register your child today and invest in their athletic and academic future.
        </p>
        <Link to="/register" className="btn btn-gold btn-lg">
          Start Registration <ChevronRight size={18} />
        </Link>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--navy)', padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 18, marginBottom: 8 }}>UI Sports Academy</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7 }}>Developing Champions in Sports & Character</p>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Contact</div>
            {[
              { icon: Phone, text: '08036870535 · 07037928183 · 08033951775' },
              { icon: Mail,  text: 'uisportsacademy@gmail.com' },
              { icon: Instagram, text: '@uisportsacademy' },
              { icon: Globe, text: 'sportsacademy.ui.edu.ng' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 }}>
                <Icon size={14} /> {text}
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Quick Links</div>
            {[['Register', '/register'], ['Check Status', '/status'], ['Admin', '/admin/login']].map(([label, to]) => (
              <div key={to} style={{ marginBottom: 8 }}>
                <Link to={to} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, transition: 'color .15s' }}
                  onMouseEnter={e => e.target.style.color = 'var(--gold)'}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
                >{label}</Link>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
          © 2026 University of Ibadan Sports Academy. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
