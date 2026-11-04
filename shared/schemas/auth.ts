import { z } from 'zod'

export const loginSchema = z.object({
  login: z.string().trim().min(3, 'Укажите email или телефон'),
  password: z.string().min(1, 'Введите пароль'),
  remember: z.boolean().optional(),
})

export const registerSchema = z.object({
  agency: z.string().trim().min(2, 'Укажите название агентства'),
  bin: z.string().trim().regex(/^\d{12}$/, 'БИН — 12 цифр'),
  city: z.string().trim().min(2, 'Укажите город'),
  owner: z.string().trim().min(2, 'Укажите имя владельца'),
  phone: z.string().trim().refine(v => v.replace(/\D/g, '').length >= 10, 'Укажите телефон: +7 и 10 цифр'),
  email: z.email('Укажите корректный email'),
  password: z.string().min(8, 'Пароль — минимум 8 символов'),
})

export const forgotSchema = z.object({ email: z.email('Укажите корректный email') })

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Пароль — минимум 8 символов'),
})

export const changePasswordSchema = z.object({
  current: z.string().min(1, 'Введите текущий пароль'),
  next: z.string().min(8, 'Новый пароль — минимум 8 символов'),
})
