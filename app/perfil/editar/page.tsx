"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useState } from "react";

type ProfileData = {
  name: string;
  role: string;
  email: string;
  sector: string;
  bio: string;
};

const defaultProfile: ProfileData = {
  name: "Abraão Ulhoa",
  role: "Técnico",
  email: "abraao.ulhoa@techchat.local",
  sector: "Suporte técnico",
  bio: "Técnico responsável por suporte e diagnóstico do setor de reparos.",
};

export default function EditProfilePage() {
  const [form, setForm] = useState<ProfileData>(() => {
    if (typeof window === "undefined") return defaultProfile;

    const saved = window.localStorage.getItem("techchat-profile");
    return saved ? (JSON.parse(saved) as ProfileData) : defaultProfile;
  });
  const [initialForm, setInitialForm] = useState<ProfileData>(() => {
    if (typeof window === "undefined") return defaultProfile;

    const saved = window.localStorage.getItem("techchat-profile");
    return saved ? (JSON.parse(saved) as ProfileData) : defaultProfile;
  });

  function updateField(field: keyof ProfileData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (typeof window !== "undefined") {
      window.localStorage.setItem("techchat-profile", JSON.stringify(form));
    }

    setInitialForm(form);
    window.history.back();
  }

  function handleCancel() {
    setForm(initialForm);
    window.history.back();
  }

  return (
    <main className="edit-page">
      <header className="top profile-top">
        <span className="section-icon">
          <User />
        </span>
        <div className="heading">
          <h1>Editar perfil</h1>
          <p>Atualize seus dados e informações</p>
        </div>
        <div className="top-actions">
          <Link href="/perfil" className="link-button">
            Voltar
          </Link>
        </div>
      </header>

      <div className="edit-shell">
        <header className="edit-header">
          <h1>Editar perfil</h1>
          <Link href="/perfil">Voltar</Link>
        </header>

        <form className="edit-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="role">Cargo</label>
              <input
                id="role"
                value={form.role}
                onChange={(event) => updateField("role", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="sector">Setor</label>
              <select
                id="sector"
                value={form.sector}
                onChange={(event) => updateField("sector", event.target.value)}
              >
                <option>Suporte técnico</option>
                <option>Hardware</option>
                <option>Software</option>
                <option>Celulares</option>
                <option>Gestão</option>
              </select>
            </div>

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(event) => updateField("bio", event.target.value)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleCancel}>
              Cancelar
            </button>
            <button type="submit" className="primary">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
