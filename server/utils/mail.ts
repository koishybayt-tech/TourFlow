import { createTransport, type Transporter } from 'nodemailer'

let transport: Transporter | null = null

export async function sendMail(to: string, subject: string, text: string) {
  transport ??= createTransport(process.env.SMTP_URL || 'smtp://localhost:1025')
  await transport.sendMail({ from: process.env.MAIL_FROM || 'Tourflow <no-reply@tourflow.local>', to, subject, text })
}
