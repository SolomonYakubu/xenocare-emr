import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Server, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import XenoCareLogo from '../components/shared/XenoCareLogo';

const heroImage = require('../../../assets/login/xenocare-african-healthcare.jpg');

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savingServer, setSavingServer] = useState(false);

  const { signIn, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message || 'Invalid email or password');
        setIsLoading(false);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const openServerSettings = async () => {
    setShowServer(true);
    setServerError(null);
    try {
      const config = await window.electron?.serverConfig?.get();
      setServerUrl(config?.supabaseUrl || '');
      setAnonKey(config?.supabaseAnonKey || '');
      const lan = await window.electron?.serverConfig?.lanInfo?.();
      setLanUrls(lan?.apiUrls || []);
    } catch {
      setLanUrls([]);
    }
  };

  const saveServerSettings = async () => {
    if (!window.electron?.serverConfig) {
      setServerError('Server settings are available in the desktop app.');
      return;
    }
    if (!serverUrl.trim() || !anonKey.trim()) {
      setServerError('Enter the server URL and anon key.');
      return;
    }
    setSavingServer(true);
    try {
      const result = await window.electron.serverConfig.saveUrl(
        serverUrl.trim(),
        'EMR Server',
        anonKey.trim(),
      );
      if (result?.success === false) {
        throw new Error(result.error || 'Could not save the server.');
      }
      window.location.reload();
    } catch (error: any) {
      setServerError(error?.message || 'Could not save the server.');
      setSavingServer(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EE]">
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Mobile image hero */}
        <div className="relative h-[290px] overflow-hidden bg-[#E9783F] md:hidden">
          <img
            src={heroImage}
            alt="African healthcare professionals collaborating in a clinical environment"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11] via-[#11151C]/75 to-[#1E232B]/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D11]/85 via-[#11151C]/45 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-between p-6">
            <div className="inline-flex w-fit items-center rounded-xl bg-white px-3 py-2">
              <XenoCareLogo height={20} />
            </div>

          </div>
        </div>

        {/* Desktop image-led brand panel */}
        <div className="relative hidden overflow-hidden bg-[#E9783F] md:flex md:w-[46%] lg:w-[58%]">
          <img
            src={heroImage}
            alt="African healthcare professionals collaborating in a clinical environment"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D11]/95 via-[#11151C]/80 to-[#1E232B]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11]/95 via-[#11151C]/25 to-[#1E232B]/35" />

          <div className="relative z-10 flex w-full flex-col justify-between p-7 lg:p-10 xl:p-14">
            <div className="inline-flex w-fit items-center rounded-2xl bg-white px-5 py-3.5 ring-1 ring-white/20">
              <XenoCareLogo height={30} />
            </div>


          </div>
        </div>

        {/* Login form panel */}
        <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-[#F4F2EE] px-5 py-10 md:w-[54%] md:px-8 lg:w-[42%] lg:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(17,21,28,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,21,28,0.05) 1px, transparent 1px)',
              backgroundSize: '42px 42px',
            }}
          />

          <div className="relative z-10 w-full max-w-md">
            <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white">
              <div className="h-1.5 w-full bg-[#E9783F]" />
              <div className="p-7 sm:p-9">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#E9783F]">
                      XenoCare
                    </p>
                    <h2 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#11151C]">
                      Welcome back
                    </h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E9783F]/5 p-1.5 ring-1 ring-[#11151C]/10">
                    <XenoCareLogo
                      variant="brand"
                      compact
                      className="h-full w-full"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                      !
                    </span>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#11151C]"
                    >
                      Username or email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-base text-[#11151C] outline-none transition-all placeholder:text-slate-400 focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15"
                      placeholder="name@hospital.org"
                      autoComplete="username"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#11151C]"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 pr-12 text-base text-[#11151C] outline-none transition-all placeholder:text-slate-400 focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#11151C]"
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E9783F] py-3.5 text-base font-bold text-white transition-all duration-160 hover:bg-[#D96A36] focus:outline-none focus:ring-4 focus:ring-[#E9783F]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin text-[#E9783F]"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 text-xs font-bold text-[#11151C]">
                  <span>XenoCare</span>
                  {window.electron?.serverConfig && (
                    <button
                      type="button"
                      onClick={openServerSettings}
                      className="inline-flex items-center gap-1.5 text-slate-400 transition-colors hover:text-[#C96A3A]"
                    >
                      <Server className="h-3.5 w-3.5" />
                      Server settings
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
            onClick={() => setShowServer(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C96A3A]">
                  Connection
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Server settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Point this device at the computer hosting the EMR.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowServer(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close server settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Server URL
                </label>
                <input
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="http://192.168.1.10:54321"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[#E9783F] focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Anon key
                </label>
                <textarea
                  value={anonKey}
                  onChange={(event) => setAnonKey(event.target.value)}
                  rows={3}
                  placeholder="Paste the host's anon key"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs outline-none focus:border-[#E9783F] focus:bg-white"
                />
              </div>

              {lanUrls.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-[#F7F5F1] px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    This computer as a host
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Other devices can join at:
                  </p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">
                    {lanUrls[0]}
                  </p>
                </div>
              )}

              {serverError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {serverError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowServer(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveServerSettings}
                disabled={savingServer}
                className="rounded-xl bg-[#E9783F] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D96A36] disabled:opacity-60"
              >
                {savingServer ? 'Saving…' : 'Save & reconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
