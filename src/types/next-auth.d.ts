declare module "next-auth" {
  interface User {
    id: string
    role: 'buyer' | 'realtor' | 'admin'
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'buyer' | 'realtor' | 'admin'
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: 'buyer' | 'realtor' | 'admin'
  }
}