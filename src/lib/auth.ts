export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'finance' | 'warehouse' | 'user'
}

// Mock user database
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@ederan.com',
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: '2',
    email: 'finance@ederan.com',
    name: 'Finance User',
    role: 'finance',
  },
]

export function authenticateUser(
  email: string,
  password: string
): User | null {
  // Mock authentication - in production, this would call an API
  // For demo purposes, accept any password for known emails
  const user = mockUsers.find((u) => u.email === email)
  if (user && password === 'demo123') {
    return user
  }
  return null
}

export function getUserFromStorage(): User | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('user')
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function saveUserToStorage(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('user', JSON.stringify(user))
}

export function removeUserFromStorage(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('user')
}
