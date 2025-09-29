"use client"

import { useToast } from "./toast-provider"
import { Button } from "./button"

// This is an example component showing how to use the toast system
export function ToastExamples() {
  const { success, error, warning, info } = useToast()

  const showSuccessToast = () => {
    success("Operation completed successfully!", "Success")
  }

  const showErrorToast = () => {
    error("Something went wrong. Please try again.", "Error")
  }

  const showWarningToast = () => {
    warning("Please check your input and try again.", "Warning")
  }

  const showInfoToast = () => {
    info("This is some helpful information.", "Info")
  }

  const showBackendErrorToast = () => {
    // Example of how backend errors would be shown
    error("Invalid login credentials", "Login Error")
  }

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Toast Examples</h2>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={showSuccessToast} variant="default">
          Success Toast
        </Button>
        <Button onClick={showErrorToast} variant="destructive">
          Error Toast
        </Button>
        <Button onClick={showWarningToast} variant="outline">
          Warning Toast
        </Button>
        <Button onClick={showInfoToast} variant="secondary">
          Info Toast
        </Button>
        <Button onClick={showBackendErrorToast} variant="destructive">
          Backend Error Example
        </Button>
      </div>
    </div>
  )
}
