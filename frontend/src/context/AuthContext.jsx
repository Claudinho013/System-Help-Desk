/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'helpdesk_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState(null)
  const [isReady, setIsReady] = useState(false)

  const loadSession = useCallback(async (sessionToken) => {
    if (!sessionToken) {
      setUser(null)
      return
    }

    try {
      const data = await apiRequest('/auth/me', { token: sessionToken })
      setUser(data.user)
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      await loadSession(token)
      if (mounted) {
        setIsReady(true)
      }
    }

    bootstrap()

    return () => {
      mounted = false
    }
  }, [token, loadSession])

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    })

    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    setToken(data.token)
    setUser(data.user)

    return data.user
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })

    return data.user
  }, [])

  const forgotPassword = useCallback(async (email) => {
    const data = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    })

    return data.message
  }, [])

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          token,
        })
      }
    } catch {
      // The local session is always cleared to guarantee logout on the client.
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      setToken(null)
      setUser(null)
    }
  }, [token])

  const refreshUser = useCallback(async () => {
    if (!token) {
      return null
    }

    const data = await apiRequest('/auth/me', { token })
    setUser(data.user)
    return data.user
  }, [token])

  const updateProfile = useCallback(
    async (payload) => {
      if (!token) {
        throw new Error('Sem sessao ativa')
      }

      const data = await apiRequest('/users/me', {
        method: 'PATCH',
        token,
        body: payload,
      })

      setUser(data.user)
      return data.user
    },
    [token],
  )

  const hasRole = useCallback(
    (roles) => {
      if (!user) {
        return false
      }

      return roles.includes(user.role)
    },
    [user],
  )

  const value = useMemo(
    () => ({
      token,
      user,
      isReady,
      isAuthenticated: Boolean(user && token),
      isStaff: Boolean(user && ['admin', 'attendant', 'manager'].includes(user.role)),
      login,
      register,
      forgotPassword,
      logout,
      refreshUser,
      updateProfile,
      hasRole,
    }),
    [forgotPassword, hasRole, isReady, login, logout, refreshUser, register, token, updateProfile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  }

  return context
}
