import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

export function NotFoundView() {
  return (
    <div className="view">
      <div className="not-found">
        <div className="not-found__content">
          <div className="not-found__icon">
            <Zap size={48} />
          </div>
          <h1>Esta sección no existe todavía</h1>
          <p>
            TechPulse está en construcción activa. El camino prioritario es overview → repositorios → noticias → ideas → guardados.
          </p>
          <div className="not-found__actions">
            <Link to="/" className="btn btn--primary btn--lg">
              <span className="btn__icon" aria-hidden>
                <LayoutIcon size={15} />
              </span>
              <span className="btn__label">Ir al Overview</span>
            </Link>
            <Link to="/repositories" className="btn btn--secondary btn--lg">
              <span className="btn__icon" aria-hidden>
                <ArrowRight size={15} />
              </span>
              <span className="btn__label">Explorar repositorios</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayoutIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>;
}
