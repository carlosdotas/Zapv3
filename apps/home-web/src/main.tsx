import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Brand, Icon, MapBackdrop } from '@zap/ui';
import { portalUrl, registrationUrl } from '../../navigation';
import './style.css';

const companyUrl = import.meta.env.VITE_LOGIN_URL || portalUrl('company');
const professionalUrl = import.meta.env.VITE_PROFESSIONAL_URL || portalUrl('professional');
const registerUrl = registrationUrl(professionalUrl);
const motoristaDownloadUrl = '/downloads/encomendaszap-motorista.apk';
const transportadoraDownloadUrl = '/downloads/encomendaszap-transportadora.apk';

function App() {
  return <div className="home-page">
    <MapBackdrop />
    <header className="home-header">
      <a className="home-brand-link" href="/" aria-label="EncomendasZap, página inicial"><Brand compact /></a>
      <nav aria-label="Navegação principal"><a href="#downloads">Baixar aplicativos <Icon name="download" size={16} /></a></nav>
    </header>

    <main className="home-main">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <header className="welcome-card__header"><Brand /><p>Coletas e entregas de encomendas.</p></header>
        <div className="welcome-card__body">
          <h1 id="welcome-title">Transportadoras<br /><span>e motoristas conectados.</span></h1>
          <p className="welcome-description">A EncomendasZap conecta transportadoras a motoristas parceiros para organizar coletas e entregas de encomendas.</p>
          <div className="welcome-actions">
            <a className="primary-button" href="#downloads">Baixar aplicativos <Icon name="download" size={17} /></a>
            <a className="primary-button primary-button--orange" href={registerUrl}>Quero ser motorista parceiro <Icon name="bike" size={18} /></a>
          </div>
          <section className="download-panel" id="downloads" aria-labelledby="downloads-title">
            <div className="download-panel__heading"><span className="download-panel__eyebrow">Aplicativos para testar</span><h2 id="downloads-title">Baixe o app do seu perfil</h2><p>Escolha o aplicativo certo para sua operação.</p><p>Versão de teste 0.2.0 para Android 8 ou superior. Se o Android recusar a atualização por assinatura, desinstale a versão antiga antes de instalar esta versão.</p></div>
            <div className="download-panel__actions">
              <a className="download-option download-option--blue" href={motoristaDownloadUrl} download="encomendaszap-motorista.apk"><span className="download-option__icon"><Icon name="bike" size={20} /></span><span><strong>Motorista</strong><small>Baixar APK</small></span><Icon name="download" size={17} /></a>
              <a className="download-option download-option--orange" href={transportadoraDownloadUrl} download="encomendaszap-transportadora.apk"><span className="download-option__icon"><Icon name="building" size={20} /></span><span><strong>Transportadora</strong><small>Baixar APK</small></span><Icon name="download" size={17} /></a>
            </div>
            <p className="download-panel__note">Os arquivos são atualizados junto com a compilação dos aplicativos.</p>
          </section>
          <div className="welcome-divider"><span>Acesse pelo navegador</span></div>
          <div className="portal-links">
            <a href={companyUrl}><span className="portal-links__icon"><Icon name="building" size={19} /></span><span><strong>Sou transportadora</strong><small>Acessar minha operação</small></span><Icon name="chevron-right" size={16} /></a>
            <a href={professionalUrl}><span className="portal-links__icon portal-links__icon--orange"><Icon name="bike" size={20} /></span><span><strong>Sou motorista</strong><small>Entrar na minha conta</small></span><Icon name="chevron-right" size={16} /></a>
          </div>
        </div>
        <footer className="auth-card__footer">Criado por: Carlos Dottas</footer>
      </section>
      <a className="admin-access" href={portalUrl('admin')}><Icon name="shield" size={14} /> Acesso à administração</a>
    </main>

    <footer className="home-footer"><span>© {new Date().getFullYear()} EncomendasZap</span><span>Conectando transportadoras e motoristas.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
