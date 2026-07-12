/**
 * Envio de e-mail com abstração mínima.
 * - Se RESEND_API_KEY estiver definido, envia via API do Resend (https://resend.com).
 * - Caso contrário (dev), apenas registra no log — o fluxo funciona sem provedor.
 *
 * Env:
 *   RESEND_API_KEY   chave da API do Resend
 *   MAIL_FROM        remetente verificado (ex.: "Karick <no-reply@seudominio.com>")
 */
const FROM = process.env.MAIL_FROM || 'Karick <onboarding@resend.dev>';

/** True quando há um provedor de e-mail configurado (produção). */
export const mailConfigured = (): boolean => !!process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dev: sem provedor — mostra no log para dar para testar o fluxo.
    console.log(`📧 [DEV] E-mail para ${to} — ${subject}\n${html.replace(/<[^>]+>/g, ' ').trim()}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${body.slice(0, 200)}`);
  }
}

/** Monta e envia o e-mail de redefinição de senha. */
export async function sendPasswordReset(to: string, link: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Redefinir sua senha</h2>
      <p>Você pediu para redefinir a senha da sua conta Karick. Clique no botão abaixo — o link vale por 1 hora.</p>
      <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Redefinir senha</a></p>
      <p style="color:#64748b;font-size:13px">Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all">${link}</p>
    </div>`;
  await sendEmail(to, 'Redefinir sua senha — Karick', html);
}
