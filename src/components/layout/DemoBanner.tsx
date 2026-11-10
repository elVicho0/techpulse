import { useState } from "react";
import { ArrowRight, FlaskConical, RefreshCw, WifiOff } from "lucide-react";
import { useAppState } from "@/state/AppState";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function DemoBanner() {
  const { mode, demoReason, retryLive, setMode } = useAppState();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);

  if (mode !== "demo") return null;

  const retry = async () => {
    setRetrying(true);
    const connected = await retryLive();
    setRetrying(false);
    if (connected) toast.success("Conexión restablecida", "La app vuelve a usar la API local.");
    else toast.error("La API local sigue sin responder", "Comprueba que techpulse-api esté en 127.0.0.1:8765.");
  };

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner__icon" aria-hidden>
        <FlaskConical size={16} />
      </span>
      <div className="demo-banner__copy">
        <strong>Modo demostración · datos de ejemplo</strong>
        <p>
          {demoReason ?? "La API local no está disponible."} Lo que ves sirve para revisar el diseño;
          no es información real ni sustituye a tus datos.
        </p>
      </div>
      <div className="demo-banner__actions">
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<RefreshCw size={13} />}
          loading={retrying}
          onClick={retry}
        >
          Reintentar conexión
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<WifiOff size={13} />}
          trailingIcon={<ArrowRight size={13} />}
          onClick={() => setMode("live")}
        >
          Ver solo estados reales
        </Button>
      </div>
    </div>
  );
}
