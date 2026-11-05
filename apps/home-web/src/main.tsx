import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Brand, Icon, MapBackdrop } from '@zap/ui';
import { portalUrl, registrationUrl } from '../../navigation';
import './style.css';

const companyUrl = import.meta.env.VITE_LOGIN_URL || portalUrl('company');
const professionalUrl = import.meta.env.VITE_PROFESSIONAL_URL || portalUrl('professional');
const registerUrl = registrationUrl(professionalUrl);

function App() {
  return <div className="home-page">
    <MapBackdrop />
    <header className="home-header">
      <a className="home-brand-link" href="/" aria-label="EncomendasZap, página inicial"><Brand compact /></a>
      <nav aria-label="Navegação principal"><a href={companyUrl}>Entrar <Icon name="arrow-right" size={16} /></a></nav>
    </header>

    <main className="home-main">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <header className="welcome-card__header"><Brand /><p>Coletas e entregas, em um só lugar.</p></header>
        <div className="welcome-card__body">
          <h1 id="welcome-title">Sua encomenda.<br /><span>No caminho certo.</span></h1>
          <p className="welcome-description">Conectamos empresas e profissionais para simplificar cada etapa da sua entrega.</p>
          <div className="welcome-actions">
            <a className="primary-button" href={companyUrl}>Entrar no Sistema <Icon name="arrow-right" size={16} /></a>
            <a className="primary-button primary-button--orange" href={registerUrl}>Quero ser profissional parceiro <Icon name="bike" size={18} /></a>
          </div>
          <div className="welcome-divider"><span>Escolha seu acesso</span></div>
          <div className="portal-links">
            <a href={companyUrl}><span className="portal-links__icon"><Icon name="building" size={19} /></span><span><strong>Sou empresa</strong><small>Acessar minha operação</small></span><Icon name="chevron-right" size={16} /></a>
            <a href={professionalUrl}><span className="portal-links__icon portal-links__icon--orange"><Icon name="bike" size={20} /></span><span><strong>Sou profissional</strong><small>Entrar na minha conta</small></span><Icon name="chevron-right" size={16} /></a>
          </div>
        </div>
        <footer className="auth-card__footer">Criado por: Carlos Dottas</footer>
      </section>
      <a className="admin-access" href={portalUrl('admin')}><Icon name="shield" size={14} /> Acesso à administração</a>
    </main>

    <footer className="home-footer"><span>© {new Date().getFullYear()} EncomendasZap</span><span>Conectando quem envia a quem entrega.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
