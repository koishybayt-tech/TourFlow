import { hash, verify } from '@node-rs/argon2'

export function hashUserPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 })
}

export async function verifyUserPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password)
  }
  catch {
    return false
  }
}
