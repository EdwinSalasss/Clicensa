const RESEND_API_URL = "https://api.resend.com/emails";

export function correoConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function enviarCorreo({ to, subject, html }) {
  if (!correoConfigurado()) {
    throw new Error("El correo no está configurado: define RESEND_API_KEY y EMAIL_FROM.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`El proveedor de correo respondió ${response.status}: ${details}`);
  }
}
