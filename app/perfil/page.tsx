import Link from "next/link";
import { User } from "lucide-react";

export default function PerfilPage() {
  return (
    <main className="profile-page">
      <header className="top profile-top">
        <span className="section-icon">
          <User />
        </span>
        <div className="heading">
          <h1>Perfil</h1>
          <p>Dados da sua conta e acesso</p>
        </div>
        <div className="top-actions">
          <Link href="/" className="link-button">
            Voltar ao chat
          </Link>
        </div>
      </header>

      <div className="profile-shell">
        <header className="profile-header">
          <div className="profile-avatar">AU</div>
          <div>
            <h1>Abraão Ulhoa</h1>
            <p>Técnico · Área de suporte e reparos</p>
          </div>
        </header>

        <section className="profile-grid">
          <article className="profile-card">
            <h2>Dados pessoais</h2>
            <div className="info">
              <div>
                <strong>Email</strong>
                abraao.ulhoa@techchat.local
              </div>
              <div>
                <strong>Setor</strong>
                Suporte técnico
              </div>
              <div>
                <strong>Local</strong>
                Bancada 4 · São Paulo
              </div>
            </div>
          </article>

          <article className="profile-card">
            <h2>Acesso</h2>
            <div className="info">
              <div>
                <strong>Permissões</strong>
                Técnico registrado
              </div>
              <div>
                <strong>Modo</strong>
                Administrador desativado
              </div>
              <div>
                <strong>Status</strong>
                Online
              </div>
            </div>
          </article>
        </section>

        <div className="profile-action">
          <Link href="/">Voltar ao chat</Link>
          <Link href="/perfil/editar">Editar perfil</Link>
        </div>
      </div>
    </main>
  );
}
