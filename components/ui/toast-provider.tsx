"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { Button } from "./button"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, "id">) => void
  success: (message: string, title?: string, duration?: number) => void
  error: (message: string, title?: string, duration?: number) => void
  warning: (message: string, title?: string, duration?: number) => void
  info: (message: string, title?: string, duration?: number) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    // Check if a toast with the same message and type already exists
    const existingToast = toasts.find(
      (t) => t.message === toast.message && t.type === toast.type && t.title === toast.title
    )

    if (existingToast) {
      // If toast exists, just reset its duration instead of creating a duplicate
      const updatedToasts = toasts.map((t) =>
        t.id === existingToast.id
          ? { ...t, duration: toast.duration ?? 5000 }
          : t
      )
      setToasts(updatedToasts)

      // Auto remove after duration
      const duration = toast.duration ?? 5000
      if (duration > 0) {
        setTimeout(() => {
          removeToast(existingToast.id)
        }, duration)
      }
      return
    }

    const id = Math.random().toString(36).substring(2)
    const newToast = { ...toast, id }
    
    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [toasts, removeToast])

  const success = useCallback((message: string, title?: string, duration?: number) => {
    showToast({ type: "success", message, title, duration })
  }, [showToast])

  const error = useCallback((message: string, title?: string, duration?: number) => {
    showToast({ type: "error", message, title, duration })
  }, [showToast])

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    showToast({ type: "warning", message, title, duration })
  }, [showToast])

  const info = useCallback((message: string, title?: string, duration?: number) => {
    showToast({ type: "info", message, title, duration })
  }, [showToast])

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
      case "error":
        return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200"
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200"
    }
  }

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, removeToast, clearToasts }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 animate-in slide-in-from-right-4
              ${getToastStyles(toast.type)}
            `}
          >
            {getToastIcon(toast.type)}
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="font-medium text-sm mb-1">{toast.title}</h4>
              )}
              <p className="text-sm">{toast.message}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 hover:bg-transparent opacity-70 hover:opacity-100"
              onClick={() => removeToast(toast.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
