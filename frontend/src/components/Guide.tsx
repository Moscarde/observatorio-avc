import type { ReactNode } from "react";
export function Tip({
  children,
  title = "Como ler",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <aside className="tip">
      <span className="tip-icon" aria-hidden="true">
        i
      </span>
      <p>
        <strong>{title}.</strong> {children}
      </p>
    </aside>
  );
}
export function StepHead({
  step,
  label,
  title,
  question,
  aside,
}: {
  step: string;
  label: string;
  title: string;
  question: string;
  aside?: ReactNode;
}) {
  return (
    <div className="step-head">
      <span className="step-number" aria-hidden="true">
        {step}
      </span>
      <div>
        <span className="eyebrow">{label}</span>
        <h2>{title}</h2>
        <p className="question">{question}</p>
      </div>
      {aside && <div className="step-aside">{aside}</div>}
    </div>
  );
}
export const sections = [
  ["visao-geral", "Visão geral"],
  ["territorio", "Território"],
  ["evolucao", "Evolução"],
  ["perfil", "Perfil"],
  ["rede", "Rede hospitalar"],
  ["notas", "Notas de leitura"],
] as const;
export function SectionNav() {
  return (
    <nav className="section-nav" aria-label="Seções do painel">
      {sections.map(([id, label], index) => (
        <a key={id} href={`#${id}`}>
          <span>{index + 1}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
