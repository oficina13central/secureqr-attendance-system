
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

        {/* Outer decorative frame */}
        <div
          style={{
            padding: '6px',
            borderRadius: '2.8rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 30%, #c7d2fe 50%, #818cf8 70%, #4f46e5 100%)',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 25px 50px -12px rgba(99,102,241,0.35)',
            position: 'relative',
          }}
        >
          {/* Corner ornaments */}
          {[
            { top: 10, left: 10 },
            { top: 10, right: 10 },
            { bottom: 10, left: 10 },
            { bottom: 10, right: 10 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 20,
                height: 20,
                borderColor: 'rgba(255,255,255,0.7)',
                borderStyle: 'solid',
                borderWidth: 0,
                ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
                ...(pos.left !== undefined
                  ? { left: pos.left, borderLeftWidth: 3, borderTopWidth: i < 2 ? 3 : 0, borderBottomWidth: i >= 2 ? 3 : 0 }
                  : { right: pos.right, borderRightWidth: 3, borderTopWidth: i < 2 ? 3 : 0, borderBottomWidth: i >= 2 ? 3 : 0 }),
                borderRadius: pos.top !== undefined && pos.left !== undefined ? '4px 0 0 0'
                  : pos.top !== undefined ? '0 4px 0 0'
                  : pos.left !== undefined ? '0 0 0 4px'
                  : '0 0 4px 0',
              }}
            />
          ))}

          {/* Inner card */}
          <div 
            id="my-qr-badge" 
            className="bg-white overflow-hidden relative flex flex-col"
            style={{ width: '380px', borderRadius: '2.4rem' }}
          >
            {/* Security stripe at very top */}
            <div style={{
              height: '4px',
              background: 'repeating-linear-gradient(90deg, #4f46e5 0px, #4f46e5 8px, #818cf8 8px, #818cf8 16px, #c7d2fe 16px, #c7d2fe 20px)',
              opacity: 0.8,
            }} />

            {/* Header Block */}
            <div className="bg-indigo-600 p-10 text-center space-y-4">
              <div className="w-20 h-20 bg-white/20 rounded-3xl mx-auto flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                 <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-loose">
                  {user.full_name}
                </h3>
                <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em]">
                  {user.role}
                </p>
              </div>
            </div>

            {/* QR Area */}
            <div className="flex flex-col items-center justify-center p-10 bg-white space-y-6">
              <div className="p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user.qr_token}&bgcolor=ffffff&color=4f46e5`}
                    alt="QR Access Code" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Código de Acceso Intransferible
                </p>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  ID: {user.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {/* Security stripe at bottom */}
            <div style={{
              height: '4px',
              background: 'repeating-linear-gradient(90deg, #c7d2fe 0px, #c7d2fe 8px, #818cf8 8px, #818cf8 16px, #4f46e5 16px, #4f46e5 20px)',
              opacity: 0.8,
            }} />
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
