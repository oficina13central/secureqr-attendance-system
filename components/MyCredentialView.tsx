
import React from 'react';
import { Download, ShieldCheck, CreditCard, LogOut } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Profile } from '../types';
import { authService } from '../services/authService';

interface MyCredentialViewProps {
  user: Profile;
}

const MyCredentialView: React.FC<MyCredentialViewProps> = ({ user }) => {
  if (!user) return null;

  const handleDownload = async () => {
    const node = document.getElementById('my-qr-badge');
    if (node) {
      try {
        const dataUrl = await toPng(node, {
          quality: 0.95,
          pixelRatio: 3,
          backgroundColor: '#ffffff'
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
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mi <span className="text-indigo-600">Credencial</span></h2>
        <p className="text-slate-500 font-medium text-sm">Usá este código para registrar tu ingreso y salida en el terminal.</p>
      </div>

      {/* Badge Container */}
      <div className="flex flex-col items-center space-y-8 w-full max-w-md">

        {/* Credencial coincidente con la referencia */}
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

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
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
        <span className="text-[10px] font-black uppercase tracking-tighter">SecureQR Attendance System v2.0</span>
      </div>
    </div>
  );
};

export default MyCredentialView;
