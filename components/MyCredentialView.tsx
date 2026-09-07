import React from 'react';
import { Download, CreditCard, LogOut } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Profile } from '../types';
import { authService } from '../services/authService';
import { isBarMiles, isMilesEmployee, BAR_MILES_LOGO } from '../utils/companyTheme';

interface MyCredentialViewProps {
  user: Profile;
}

const MyCredentialView: React.FC<MyCredentialViewProps> = ({ user }) => {
  if (!user) return null;

  const isMiles = isMilesEmployee(user);

  const handleDownload = async () => {
    const node = document.getElementById('my-qr-badge');
    if (node) {
      try {
        const dataUrl = await toPng(node, {
          quality: 0.95,
          pixelRatio: 3,
          backgroundColor: isMiles ? '#FAF8F5' : '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `credencial-${user.full_name.replace(/\s+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Error generando la imagen:', error);
      }
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 md:p-12 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mi <span className={isMiles ? "text-[#A08266]" : "text-indigo-600"}>Credencial</span></h2>
        <p className="text-slate-500 font-medium text-sm">Usá este código para registrar tu ingreso y salida en el terminal.</p>
      </div>

      {/* Badge Container */}
      <div className="flex flex-col items-center space-y-8 w-full max-w-md">

        {isMiles ? (
          /* Credencial Bar Miles */
          <div 
            id="my-qr-badge" 
            className="overflow-hidden relative flex flex-col shadow-2xl"
            style={{ 
              width: '380px', 
              height: '580px', 
              borderRadius: '1.25rem',
              background: '#FAF8F5',
              border: '1px solid #E5DDD2',
              boxSizing: 'border-box',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {/* Marco interior */}
            <div style={{ position: 'absolute', inset: '12px', border: '1px solid rgba(184, 158, 132, 0.35)', borderRadius: '0.85rem', pointerEvents: 'none', zIndex: 1 }} />

            {/* Header Block Bar Miles */}
            <div style={{ height: '210px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.8rem 1.5rem 0 1.5rem', textAlign: 'center', zIndex: 10 }}>
              <img
                src={BAR_MILES_LOGO}
                alt="Miles Bar"
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.12))', marginBottom: '8px' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1C1917', letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1 }}>
                MILES BAR
              </span>
              <h3 style={{ fontSize: user.full_name.length > 24 ? '1.35rem' : user.full_name.length > 18 ? '1.6rem' : '1.85rem', fontWeight: 900, color: '#1C1917', textTransform: 'uppercase', margin: '10px 0 0 0', lineHeight: 1.1 }}>
                {user.full_name}
              </h3>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A08266', letterSpacing: '0.22em', textTransform: 'uppercase', margin: '6px 0 0 0' }}>
                STAFF • CREDENCIAL DE ACCESO
              </p>
            </div>

            {/* QR Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: '#B89E84', padding: '10px', borderRadius: '1.25rem', boxShadow: '0 6px 18px rgba(184, 158, 132, 0.28)' }}>
                <div style={{ background: '#ffffff', padding: '6px', borderRadius: '8px' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user.qr_token}&bgcolor=ffffff&color=1C1917`}
                    alt="QR Access Code" 
                    className="w-44 h-44 object-contain"
                  />
                </div>
              </div>
              <div className="mt-4 text-center">
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#A08266', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  ID: {user.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {/* Bottom accent ribbon */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '10px', zIndex: 5, display: 'flex' }}>
              <div style={{ flex: 1, background: '#B89E84' }} />
              <div style={{ width: '80px', background: '#C87556' }} />
              <div style={{ flex: 1, background: '#1C1917' }} />
            </div>
          </div>
        ) : (
          /* Credencial coincidente con la referencia (Ayres) */
          <div 
            id="my-qr-badge" 
            className="bg-white overflow-hidden relative flex flex-col shadow-2xl"
            style={{ 
              width: '380px', 
              height: '580px', 
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Block */}
            <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                {user.full_name}
              </h3>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#52B788', letterSpacing: '0.3em', textTransform: 'uppercase', margin: '0.8rem 0 0 0', opacity: 0.8 }}>
                Credencial de Acceso
              </p>
            </div>

            {/* QR Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10 }}>
              <div style={{ background: '#52B788', padding: '1rem', borderRadius: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <div style={{ background: 'white', padding: '0.2rem', borderRadius: '2px' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user.qr_token}&bgcolor=ffffff&color=1B4332`}
                    alt="QR Access Code" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>
              <div className="mt-6 text-center">
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  ID: {user.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {/* Triple Wave al pie */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 100 + '%', height: '80px', zIndex: 0, lineHeight: 0 }}>
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" style={{ width: 100 + '%', height: 100 + '%' }}>
                  <path d="M0,150 L500,150 L500,100 C400,130 100,80 0,120 Z" fill="#52B788" opacity="0.3"></path>
                  <path d="M0,150 L500,150 L500,110 C350,140 150,90 0,130 Z" fill="#2D6A4F" opacity="0.6"></path>
                  <path d="M0,150 L500,150 L500,120 C300,150 200,100 0,140 Z" fill="#1B4332" opacity="1"></path>
              </svg>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={handleDownload}
            className={`flex items-center justify-center space-x-3 px-6 py-4 ${isMiles ? 'bg-[#A08266] hover:bg-[#8C7055] shadow-[#A08266]/20' : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'} text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg transition-all active:scale-95`}
          >
            <Download className="w-5 h-5" />
            <span>Descargar</span>
          </button>
          <button
            onClick={() => authService.signOut()}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-sm font-black uppercase tracking-wider transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 text-slate-400">
        <CreditCard className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-tighter">{isMiles ? 'Miles Bar • Staff v2.0' : 'Asistencias QR v2.0'}</span>
      </div>
    </div>
  );
};

export default MyCredentialView;
