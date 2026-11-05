import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const loginUrl = import.meta.env.VITE_LOGIN_URL ?? '#acesso';
const professionalUrl = import.meta.env.VITE_PROFESSIONAL_URL ?? '#acesso-profissional';

function App() {
  return <main className="home-page">
    <nav className="home-nav">
      <a className="home-brand" href="#inicio" aria-label="Zap Encomendas - início"><span className="home-brand__mark">Z</span><span>Encomendas<span>Zap</span></span></a>
      <div className="home-nav__links"><a href="#como-funciona">Como funciona</a><a href="#vantagens">Vantagens</a><a href="#acesso">Acessar</a></div>
      <a className="home-nav__button" href={professionalUrl}>Seja profissional <span>↗</span></a>
    </nav>

    <section className="hero" id="inicio">
      <div className="hero__copy"><p className="section-kicker"><span /> Entregas do seu jeito</p><h1>O caminho mais simples entre <em>pedir</em> e chegar.</h1><p className="hero__text">A Zap Encomendas conecta empresas, profissionais e clientes para deixar cada entrega mais clara, rápida e segura.</p><div className="hero__actions"><a className="button button--primary" href={loginUrl}>Entrar na plataforma <span>→</span></a><a className="button button--ghost" href="#como-funciona">Conhecer a Zap <span>↓</span></a></div><div className="hero__trust"><div className="avatar-stack"><i>J</i><i>M</i><i>A</i><i>+</i></div><span><b>Feito para quem entrega</b><br/>e para quem espera receber.</span></div></div>
      <div className="hero__visual" aria-label="Ilustração de uma entrega em andamento"><div className="visual-card visual-card--order"><span className="visual-icon">✓</span><div><small>Entrega em andamento</small><strong>Pedido #0248</strong></div><b className="visual-status">Agora</b></div><div className="route-map"><span className="map-grid map-grid--one"/><span className="map-grid map-grid--two"/><div className="route-line"/><span className="map-pin map-pin--start">●</span><span className="map-pin map-pin--end">◆</span><div className="map-label map-label--start">Coleta</div><div className="map-label map-label--end">Destino</div></div><div className="visual-card visual-card--driver"><span className="driver-avatar">RC</span><div><small>Profissional a caminho</small><strong>Rafael Costa</strong></div><span className="driver-online" /></div><div className="hero-spark hero-spark--one">✦</div><div className="hero-spark hero-spark--two">✦</div></div>
    </section>

    <section className="stats-strip"><div><strong>1 só lugar</strong><span>para organizar seus pedidos</span></div><div><strong>Mais clareza</strong><span>em cada etapa da entrega</span></div><div><strong>Com quem entende</strong><span>do seu dia a dia</span></div></section>

    <section className="how-section" id="como-funciona"><div className="section-heading"><p className="section-kicker"><span /> Como funciona</p><h2>Entrega boa é aquela que <em>flui.</em></h2><p>Uma operação pensada para tirar a complexidade do caminho.</p></div><div className="step-grid"><article><b>01</b><span className="step-icon">⌖</span><h3>Você solicita</h3><p>Informe a coleta, o destino e os detalhes do pedido.</p></article><article><b>02</b><span className="step-icon">⇄</span><h3>A gente conecta</h3><p>Encontramos o profissional ideal para cada entrega.</p></article><article><b>03</b><span className="step-icon">♧</span><h3>Chega tranquilo</h3><p>Acompanhe tudo até a confirmação no destino.</p></article></div></section>

    <section className="benefits-section" id="vantagens"><div className="benefits-copy"><p className="section-kicker"><span /> Uma plataforma, todos os lados</p><h2>Mais controle para a empresa. <em>Mais oportunidade</em> para quem entrega.</h2><p>Do pedido ao destino, cada pessoa tem a visão certa para fazer o trabalho acontecer.</p><a className="text-link" href={loginUrl}>Acessar a plataforma <span>→</span></a></div><div className="benefit-list"><article><span>⌁</span><div><h3>Operação organizada</h3><p>Pedidos, profissionais e status em um só fluxo.</p></div></article><article><span>◌</span><div><h3>Rastreamento claro</h3><p>Informação simples para você nunca perder o caminho.</p></div></article><article><span>♡</span><div><h3>Parcerias que crescem</h3><p>Uma rede construída para gerar novas oportunidades.</p></div></article></div></section>

    <section className="access-section" id="acesso"><div><p className="section-kicker"><span /> Pronto para começar?</p><h2>Seu próximo pedido pode ser <em>mais simples.</em></h2><p>Escolha o acesso que combina com o seu momento.</p></div><div className="access-actions"><a className="button button--light" href={loginUrl}>Acessar minha conta <span>→</span></a><a className="button button--outline-light" href={professionalUrl}>Quero fazer entregas <span>↗</span></a></div></section>

    <footer className="home-footer"><a className="home-brand" href="#inicio"><span className="home-brand__mark">Z</span><span>Encomendas<span>Zap</span></span></a><span>Entregas que conectam pessoas.</span><span>© 2026 Zap Encomendas</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
