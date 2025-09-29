"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { login as apiLogin, logout as apiLogout, getStoredUserData, clearStoredData } from "@/lib/api"
import { User, UserData } from "@/lib/types"
import { useToast } from "@/components/ui/toast-provider"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { error, success } = useToast()

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const storedUserData = getStoredUserData()
        if (storedUserData) {
          // Transform UserData to User interface
          const user: User = {
            userID: storedUserData.userID,
            email: storedUserData.email,
            displayName: storedUserData.displayName,
            firstName: storedUserData.firstName,
            lastName: storedUserData.lastName,
            companyId: storedUserData.companyId,
            roles: storedUserData.roles,
            privileges: storedUserData.privileges,
          }
          setUser(user)
        }
      } catch (error) {
        console.error('Error checking existing session:', error)
        // Clear invalid stored data
        clearStoredData()
      }
    }

    checkExistingSession()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)

    try {
      const userData = await apiLogin({ email, password })
      
      // Transform UserData to User interface
      const user: User = {
        userID: userData.userID,
        email: userData.email,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        companyId: userData.companyId,
        roles: userData.roles,
        privileges: userData.privileges,
      }
      
      setUser(user)
      success(`Welcome back, ${userData.displayName}!`, "Login Successful")
    } catch (err) {
      error(err instanceof Error ? err.message : "Login failed", "Login Error")
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
      success("You have been signed out successfully", "Logout Successful")
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
    } finally {
      setUser(null)
      clearStoredData()
    }
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
