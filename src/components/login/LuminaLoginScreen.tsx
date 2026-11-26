import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { companyDisplayName } from '../../utils/company';
import { brandIdentityEngine } from '../../core/brandIdentityEngine';
import { loginWithServer, startAuthSession } from '../../utils/authSession';
import '../../styles/lumina/style.css';
import '../../styles/lumina/animations.css';
import '../../styles/lumina/responsive.css';

interface LuminaLoginScreenProps {
  onAuthenticated: () => void;
}

type View = 'login' | 'recovery';
type Feedback = { type: 'info' | 'success' | 'error'; text: string } | null;
type EmailState = 'idle' | 'valid' | 'invalid';

const AUTH_ATTEMPTS_KEY = 'pk_detail_auth_attempts_v1';
const AUTH_LOCK_KEY = 'pk_detail_auth_lock_until_v1';
const REMEMBER_KEY = 'pk_detail_remembered_access';
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60_000;
const LOCK_MS = 30_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Proprietário',
  gerente: 'Gerência',
  atendente: 'Atendimento',
  operacional: 'Operacional',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!EMAIL_PATTERN.test(trimmed) || trimmed.includes('..')) return false;
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  const labels = domain.split('.');
  if (labels.some(part => !part || part.startsWith('-') || part.endsWith('-'))) return false;
  const tld = labels[labels.length - 1];
  return /^[A-Za-z]{2,}$/.test(tld) || /^xn--[A-Za-z0-9-]{2,}$/i.test(tld);
}

function readRememberedPreference(): { email: string; accessType: 'customer' | 'employee' } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.rememberMe !== true) return null;
    return {
      email: typeof parsed.email === 'string' ? parsed.email.trim() : '',
      accessType: parsed.accessType === 'employee' ? 'employee' : 'customer',
    };
  } catch {
    return null;
  }
}

function syncRememberedPreference(enabled: boolean, email: string, accessType: 'customer' | 'employee') {
  try {
    if (!enabled) {
      localStorage.removeItem(REMEMBER_KEY);
      return;
    }
    localStorage.setItem(
      REMEMBER_KEY,
      JSON.stringify({
        rememberMe: true,
        email: email.trim(),
        accessType,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* armazenamento restrito */
  }
}

function readAttempts(): number[] {
  try {
    const raw = sessionStorage.getItem(AUTH_ATTEMPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [];
  } catch {
    return [];
  }
}

function writeAttempts(list: number[]): void {
  try {
    sessionStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify(list));
  } catch {
    /* armazenamento restrito */
  }
}

function readLockUntil(): number {
  try {
    const raw = sessionStorage.getItem(AUTH_LOCK_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLockUntil(timestamp: number): void {
  try {
    sessionStorage.setItem(AUTH_LOCK_KEY, String(timestamp));
  } catch {
    /* armazenamento restrito */
  }
}

export const LuminaLoginScreen: React.FC<LuminaLoginScreenProps> = ({ onAuthenticated }) => {
  const { users, currentUser, setCurrentUserById, settings, portalConfig, logAudit } = useApp();

  const remembered = useMemo(readRememberedPreference, []);
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState(remembered?.email || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [employeeMode, setEmployeeMode] = useState(remembered?.accessType === 'employee');
  const [showPassword, setShowPassword] = useState(false);
  const [emailState, setEmailState] = useState<EmailState>('idle');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockUntil, setLockUntil] = useState(() => readLockUntil());
  const [clock, setClock] = useState(() => Date.now());
  const [supportOpen, setSupportOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryState, setRecoveryState] = useState<EmailState>('idle');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<{ name: string; roleLabel: string } | null>(null);
  const [exiting, setExiting] = useState(false);
  const successTimers = useRef<number[]>([]);

  const loginTitleRef = useRef<HTMLHeadingElement | null>(null);
  const supportCloseRef = useRef<HTMLButtonElement | null>(null);

  const lockRemaining = Math.max(0, Math.ceil((lockUntil - clock) / 1000));
  const isLocked = lockRemaining > 0;

  const supportEmail = settings.email || 'suporte@pkdetail.com.br';

  useEffect(() => {
    if (!lockUntil) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  useEffect(() => {
    if (!supportOpen) return;
    supportCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSupportOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [supportOpen]);

  useEffect(() => {
    loginTitleRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!shake) return;
    const timer = window.setTimeout(() => setShake(false), 450);
    return () => window.clearTimeout(timer);
  }, [shake]);

  useEffect(
    () => () => {
      successTimers.current.forEach(timer => window.clearTimeout(timer));
    },
    []
  );

  const evaluateEmail = (value: string): EmailState => {
    if (!value.trim()) return 'idle';
    return isValidEmail(value) ? 'valid' : 'invalid';
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError('');
    setEmailState(evaluateEmail(value));
    if (remember) syncRememberedPreference(true, value, employeeMode ? 'employee' : 'customer');
  };

  const handleRememberChange = (checked: boolean) => {
    setRemember(checked);
    syncRememberedPreference(checked, email, employeeMode ? 'employee' : 'customer');
  };

  const toggleEmployeeMode = () => {
    const next = !employeeMode;
    setEmployeeMode(next);
    setFeedback(null);
    setEmailError('');
    setPasswordError('');
    if (remember) syncRememberedPreference(true, email, next ? 'employee' : 'customer');
  };

  const revealError = (text: string) => {
    setFeedback({ type: 'error', text });
    setShake(true);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const now = Date.now();
    const storedLock = readLockUntil();
    if (now < storedLock) {
      setLockUntil(storedLock);
      setClock(now);
      return;
    }

    const trimmedEmail = email.trim();
    const emailValid = isValidEmail(trimmedEmail);
    const nextEmailError = !trimmedEmail
      ? 'Informe seu endereço de e-mail.'
      : emailValid
        ? ''
        : 'Digite um e-mail válido (ex: nome@dominio.com).';
    const nextPasswordError = password ? '' : 'Informe sua senha.';

    setEmailState(trimmedEmail ? (emailValid ? 'valid' : 'invalid') : 'idle');
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      setShake(true);
      return;
    }

    // A credencial é validada exclusivamente no servidor (sessão em cookie HttpOnly).
    setLoading(true);
    const result = await loginWithServer(trimmedEmail, password);
    if (!result.ok || !result.user) {
      setLoading(false);
      setShake(true);
      revealError('E-mail ou senha inválidos. Confira suas credenciais ou fale com o suporte.');
      return;
    }
    const user = result.user;

    writeAttempts([]);
    syncRememberedPreference(remember, trimmedEmail, employeeMode ? 'employee' : 'customer');
    setCurrentUserById(user.id);
    startAuthSession();
    logAudit('LOGIN_OPERADOR', 'Sistema', `Acesso autenticado por ${user.name} (${user.role})`);
    await brandIdentityEngine.refresh().catch(() => undefined);

    // Confirmação de boas-vindas: o formulário se dissolve e dá lugar à saudação.
    setLoading(false);
    setFeedback(null);
    setAuthSuccess({ name: user.name, roleLabel: ROLE_LABELS[user.role] || 'Acesso' });

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const holdMs = reduceMotion ? 700 : 1250;
    const exitMs = reduceMotion ? 0 : 300;
    successTimers.current.push(
      window.setTimeout(() => {
        setExiting(true);
        successTimers.current.push(window.setTimeout(onAuthenticated, exitMs));
      }, holdMs)
    );
  };

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const trimmed = recoveryEmail.trim();
    const valid = isValidEmail(trimmed);
    setRecoveryState(trimmed ? (valid ? 'valid' : 'invalid') : 'idle');
    setRecoveryError(
      !trimmed
        ? 'Informe seu endereço de e-mail.'
        : valid
          ? ''
          : 'Digite um e-mail válido (ex: nome@dominio.com).'
    );
    if (!trimmed || !valid) return;

    setRecoveryLoading(true);
    window.setTimeout(() => {
      setRecoveryLoading(false);
      setRecoverySent(true);
      setFeedback({
        type: 'info',
        text: 'Se este e-mail estiver cadastrado, o administrador poderá redefinir sua senha. Fale com o suporte para agilizar.',
      });
    }, 550);
  };

  const copySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied('E-mail copiado para a área de transferência.');
    } catch {
      setCopied(`Copie o e-mail: ${supportEmail}`);
    }
  };

  const supportWhatsappLink = useMemo(() => {
    const digits = (settings.whatsapp || settings.phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const message = encodeURIComponent(
      `Olá! Preciso de ajuda para acessar o sistema ${companyDisplayName(settings)}.`
    );
    return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}?text=${message}`;
  }, [settings]);

  const loginTitle = employeeMode ? 'Acesso de funcionário' : 'Bem-vindo de volta';
  const loginSubtitle = employeeMode
    ? 'Entre com suas credenciais corporativas da PK Detail.'
    : 'Entre na sua conta para continuar de onde parou.';

  return (
    <div className={`lumina-login-root${exiting ? ' is-logging-in' : ''}`}>
      <main className="auth-viewport">
        <section className="auth-card" aria-label="Sistema de autenticação PK Detail">
          <aside className="brand-panel" aria-label="Identidade visual PK Detail">
            <div className="brand-mesh" aria-hidden="true">
              <span className="mesh-orb mesh-orb--orange" />
              <span className="mesh-orb mesh-orb--amber" />
              <span className="mesh-orb mesh-orb--graphite" />
              <span className="brand-accent-line" />
              <span className="brand-scrim" />
            </div>

            <div className="brand-content">
              <div className="brand-top">
                <div className="pk-lockup">
                  <span className="pk-monogram" aria-hidden="true">
                    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="33"
                        height="33"
                        rx="9"
                        fill="#080808"
                        stroke="#383838"
                        strokeWidth="1.25"
                      />
                      <path
                        d="M18 7C18.65 13.75 22.25 17.35 29 18C22.25 18.65 18.65 22.25 18 29C17.35 22.25 13.75 18.65 7 18C13.75 17.35 17.35 13.75 18 7Z"
                        fill="#FF5A00"
                      />
                    </svg>
                  </span>
                  <div className="pk-wordmark">
                    <span className="pk-name">PK DETAIL</span>
                    <span className="pk-sub">Estética Automotiva</span>
                  </div>
                </div>
              </div>

              <div className="brand-copy">
                <p className="brand-kicker">Padrão de excelência automotiva.</p>
                <h2 className="brand-headline">
                  Precisão em cada detalhe. Proteção, brilho e acabamento em um só lugar.
                </h2>
                <p className="brand-description">
                  Acompanhe agendamentos, serviços executados e o histórico completo de cuidados do
                  seu veículo com clareza e sofisticação.
                </p>
              </div>
            </div>
          </aside>

          <div className="form-panel">
            <div className="form-shell">
              <div className="form-brand-icon" aria-hidden="true">
                <span className="brand-accent-bar" />
                <span className="brand-mini-label">PK DETAIL</span>
                <span className="mobile-app-badge">
                  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="56" height="56" rx="15" fill="#080808" />
                    <path
                      d="M28 11C29.02 21.5 34.5 26.98 45 28C34.5 29.02 29.02 34.5 28 45C26.98 34.5 21.5 29.02 11 28C21.5 26.98 26.98 21.5 28 11Z"
                      fill="#FF5A00"
                    />
                  </svg>
                </span>
              </div>

              {authSuccess ? (
                <div className="auth-success" role="status" aria-live="polite">
                  <div className="auth-success-badge">
                    <span className="auth-success-halo" aria-hidden="true" />
                    <svg className="auth-success-ring" viewBox="0 0 96 96" aria-hidden="true">
                      <circle className="auth-success-ring-track" cx="48" cy="48" r="45" />
                      <circle className="auth-success-ring-progress" cx="48" cy="48" r="45" />
                    </svg>
                    <span className="auth-success-initial" aria-hidden="true">
                      {getInitials(authSuccess.name)}
                    </span>
                    <span className="auth-success-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5.5 12.6 9.8 16.9 18.5 8.2" />
                      </svg>
                    </span>
                  </div>
                  <p className="auth-success-eyebrow">Sessão iniciada</p>
                  <h1 className="auth-success-title">Olá, {authSuccess.name.split(' ')[0]}.</h1>
                  <p className="auth-success-subtitle">
                    {authSuccess.roleLabel} · preparando seu ambiente
                  </p>
                  <div className="auth-success-progress" aria-hidden="true">
                    <span />
                  </div>
                </div>
              ) : (
                <>
              {feedback && (
                <div className="feedback-banner" data-type={feedback.type} role="status" aria-live="polite">
                  <span className="feedback-icon" aria-hidden="true">
                    {feedback.type === 'success' ? (
                      <CheckCircle2 />
                    ) : feedback.type === 'error' ? (
                      <AlertCircle />
                    ) : (
                      <Info />
                    )}
                  </span>
                  <p className="feedback-text">{feedback.text}</p>
                  <button
                    type="button"
                    className="feedback-close"
                    aria-label="Fechar aviso"
                    onClick={() => setFeedback(null)}
                  >
                    <X />
                  </button>
                </div>
              )}

              {view === 'login' ? (
                <div className="auth-view is-active" data-view="login">
                  <header className="view-header">
                    <h1 className="view-title" tabIndex={-1} ref={loginTitleRef}>
                      {loginTitle}
                    </h1>
                    <p className="view-subtitle">{loginSubtitle}</p>
                  </header>

                  <form
                    className={`auth-form ${shake ? 'is-invalid-shake' : ''}`}
                    onSubmit={handleLogin}
                    noValidate
                  >
                    <div className="field-group">
                      <label className="field-label" htmlFor="login-email">
                        E-mail <span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <div
                        className="input-wrapper input-wrapper--has-icon input-wrapper--has-status"
                        data-email-state={emailState}
                      >
                        <span className="input-leading-icon" aria-hidden="true">
                          <Mail />
                        </span>
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          className="field-input field-input--with-icon field-input--has-status"
                          autoComplete="email"
                          inputMode="email"
                          placeholder={employeeMode ? 'colaborador@pkdetail.com.br' : 'E-mail'}
                          value={email}
                          onChange={event => handleEmailChange(event.target.value)}
                          onBlur={() => {
                            if (email.trim()) setEmailState(evaluateEmail(email));
                          }}
                          required
                          aria-required="true"
                          aria-invalid={emailError ? 'true' : undefined}
                          aria-describedby="login-email-error"
                        />
                        <span className="input-status-icon" aria-hidden="true">
                          <CheckCircle2 className="icon-email-valid" />
                          <AlertCircle className="icon-email-invalid" />
                        </span>
                      </div>
                      {emailState === 'valid' && !emailError && (
                        <p className="field-status" aria-live="polite">
                          Formato de e-mail válido
                        </p>
                      )}
                      {emailError && (
                        <p className="field-error" role="alert">
                          {emailError}
                        </p>
                      )}
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="login-password">
                        Senha <span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <div className="input-wrapper input-wrapper--password input-wrapper--has-icon">
                        <span className="input-leading-icon" aria-hidden="true">
                          <Lock />
                        </span>
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="field-input field-input--password field-input--with-icon"
                          autoComplete="current-password"
                          placeholder="••••••••••••"
                          value={password}
                          onChange={event => {
                            setPassword(event.target.value);
                            setPasswordError('');
                          }}
                          required
                          aria-required="true"
                          aria-invalid={passwordError ? 'true' : undefined}
                          aria-describedby="login-password-error"
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(value => !value)}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="field-error" role="alert">
                          {passwordError}
                        </p>
                      )}
                    </div>

                    <div className="form-meta-row">
                      <label className="checkbox-control" htmlFor="login-remember">
                        <input
                          id="login-remember"
                          name="remember"
                          type="checkbox"
                          className="checkbox-input"
                          checked={remember}
                          onChange={event => handleRememberChange(event.target.checked)}
                        />
                        <span className="checkbox-box" aria-hidden="true">
                          <svg viewBox="0 0 12 10" fill="none">
                            <path
                              d="M1.5 5.2L4.5 8.2L10.5 1.8"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="checkbox-label">Lembrar de mim</span>
                      </label>

                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setView('recovery');
                          setFeedback(null);
                          setRecoveryEmail(email);
                        }}
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>

                    <button
                      type="submit"
                      className={`btn-primary ${loading ? 'is-loading' : ''}`}
                      disabled={loading || isLocked}
                    >
                      <span className="btn-label">
                        {isLocked ? `Aguarde ${lockRemaining}s` : loading ? 'Validando...' : 'Entrar'}
                      </span>
                      <span className="btn-spinner" aria-hidden="true" />
                    </button>
                  </form>

                  <button
                    type="button"
                    className={`btn-outline-secondary ${employeeMode ? 'is-active' : ''}`}
                    aria-pressed={employeeMode}
                    onClick={toggleEmployeeMode}
                  >
                    <UserRound className="btn-icon" />
                    <span className="btn-outline-label">
                      {employeeMode ? 'Voltar para acesso padrão' : 'Entrar como funcionário'}
                    </span>
                  </button>

                  <p className="view-switch">
                    Precisa de ajuda?{' '}
                    <button
                      type="button"
                      className="text-link text-link--accent"
                      onClick={() => setSupportOpen(true)}
                    >
                      Fale com o suporte
                    </button>
                  </p>

                  <p className="security-entry">
                    <span
                      className="security-entry-link"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <ShieldCheck width={13} height={13} aria-hidden="true" />
                      E-mail corporativo + sua senha individual (ou PIN da empresa)
                    </span>
                  </p>
                </div>
              ) : (
                <div className="auth-view is-active" data-view="recovery">
                  <header className="view-header">
                    <h1 className="view-title" tabIndex={-1} ref={loginTitleRef}>
                      Recuperar senha
                    </h1>
                    <p className="view-subtitle">
                      Informe seu e-mail para receber as instruções de recuperação.
                    </p>
                  </header>

                  <form
                    className={`auth-form ${shake ? 'is-invalid-shake' : ''}`}
                    onSubmit={handleRecovery}
                    noValidate
                  >
                    <div className="field-group">
                      <label className="field-label" htmlFor="recovery-email">
                        E-mail <span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <div
                        className="input-wrapper input-wrapper--has-icon input-wrapper--has-status"
                        data-email-state={recoveryState}
                      >
                        <span className="input-leading-icon" aria-hidden="true">
                          <Mail />
                        </span>
                        <input
                          id="recovery-email"
                          name="email"
                          type="email"
                          className="field-input field-input--with-icon field-input--has-status"
                          autoComplete="email"
                          inputMode="email"
                          placeholder="E-mail"
                          value={recoveryEmail}
                          onChange={event => {
                            setRecoveryEmail(event.target.value);
                            setRecoveryError('');
                            setRecoveryState(evaluateEmail(event.target.value));
                          }}
                          required
                          aria-required="true"
                          aria-invalid={recoveryError ? 'true' : undefined}
                        />
                        <span className="input-status-icon" aria-hidden="true">
                          <CheckCircle2 className="icon-email-valid" />
                          <AlertCircle className="icon-email-invalid" />
                        </span>
                      </div>
                      {recoveryError && (
                        <p className="field-error" role="alert">
                          {recoveryError}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className={`btn-primary ${recoveryLoading ? 'is-loading' : ''}`}
                      disabled={recoveryLoading}
                    >
                      <span className="btn-label">
                        {recoveryLoading ? 'Enviando...' : 'Enviar instruções'}
                      </span>
                      <span className="btn-spinner" aria-hidden="true" />
                    </button>
                  </form>

                  {recoverySent && supportWhatsappLink && (
                    <a className="btn-outline-secondary" href={supportWhatsappLink} target="_blank" rel="noreferrer">
                      <span className="btn-outline-label">Falar com o suporte no WhatsApp</span>
                    </a>
                  )}

                  <p className="view-switch view-switch--back">
                    <button type="button" className="back-link" onClick={() => setView('login')}>
                      <ArrowLeft />
                      <span>Voltar para o login</span>
                    </button>
                  </p>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {supportOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          onClick={event => {
            if (event.target === event.currentTarget) setSupportOpen(false);
          }}
        >
          <div className="modal-surface">
            <div className="modal-header">
              <h2 id="support-modal-title" className="modal-title">
                Suporte PK Detail
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Fechar janela de suporte"
                onClick={() => setSupportOpen(false)}
                ref={supportCloseRef}
              >
                <X />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Precisa de auxílio com seu acesso, cadastro ou conta corporativa da PK Detail? Entre
                em contato com a nossa equipe de atendimento.
              </p>
              <div className="support-info-list">
                <div className="support-info-item">
                  <span className="support-info-label">E-mail de atendimento</span>
                  <div className="support-info-action">
                    <span className="support-info-value">{supportEmail}</span>
                    <button type="button" className="btn-copy-inline" onClick={copySupportEmail}>
                      <Copy />
                      Copiar
                    </button>
                  </div>
                </div>
                <div className="support-info-item">
                  <span className="support-info-label">Horário de atendimento</span>
                  <span className="support-info-value">Segunda a Sábado · 08h às 18h</span>
                </div>
              </div>
              {copied && (
                <p className="support-copy-status" role="status" aria-live="polite">
                  {copied}
                </p>
              )}
              {supportWhatsappLink && (
                <a
                  className="btn-secondary"
                  href={supportWhatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}
                >
                  Abrir WhatsApp do suporte
                </a>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setSupportOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
