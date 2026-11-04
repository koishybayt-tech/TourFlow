declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
  }
  interface UserSession {
    memberId: string
    organizationId: string
  }
}
export {}
