import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

interface LoginProps {
    onLoginSuccess: (session: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [dni, setDni] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            if (isRegistering) {
                if (!dni || dni.length < 4) {
                    throw new Error('Debe ingresar un DNI válido (mínimo 4 números)');
                }
                await authService.signUp(email, password, fullName, dni);
                setSuccessMsg('Cuenta creada con éxito. Por favor verifique su correo o inicie sesión.');
                setIsRegistering(false); // Switch back to login
            } else {
                const data = await authService.signIn(email, password);
                onLoginSuccess(data.session);
            }
        } catch (err: any) {
            if (err.message.includes('User already registered') || err.message.includes('already been registered')) {
                setError('Esta cuenta ya existe. Por favor, intenta "Iniciar Sesión" con tu contraseña.');
            } else {
                setError(err.message || 'Error al crear cuenta. Verifica tus datos.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 relative z-10">
                    <div className="flex flex-col items-center mb-10">
                        <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-600/30 mb-6 group hover:scale-110 transition-transform cursor-default">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                            {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                        </h1>
                        <p className="text-slate-400 font-medium text-sm mt-2">Control de Asistencia Biométrico</p>
                    </div>

                    {error && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-600 font-bold leading-relaxed">{error}</p>
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-emerald-600 font-bold leading-relaxed">{successMsg}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {isRegistering && (
                            <div className="space-y-2 animate-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Nombre Completo</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {isRegistering && (
                            <div className="space-y-2 animate-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">DNI (Documento)</label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={dni}
                                        onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="Solo números"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="admin@empresa.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-slate-900 border-none hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mt-4"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span>{isRegistering ? 'Guardar Registro' : 'Iniciar Sesión'}</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-50 text-center space-y-4">
                        <button
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError(null);
                                setSuccessMsg(null);
                            }}
                            className="text-indigo-600 font-bold text-xs uppercase tracking-wider hover:text-indigo-800 transition-colors"
                        >
                            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Registrar Usuario'}
                        </button>

                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                            Sistema de Gestión Descentralizado<br />v2.0 Beta
                        </p>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-400 text-xs font-medium">
                    ¿Problemas para ingresar? <a href="#" className="text-indigo-600 font-bold hover:underline">Contactar soporte</a>
                </p>
            </div>
        </div>
    );
};

export default Login;
