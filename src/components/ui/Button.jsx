'use client';

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-blue-400 text-white shadow hover:bg-blue-500 dark:bg-blue-400 dark:hover:bg-blue-500",
        primary:
          "bg-blue-400 text-white shadow hover:bg-blue-500 dark:bg-blue-400 dark:hover:bg-blue-500",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600",
        danger:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600",
        outline:
          "border border-blue-200 bg-white shadow-sm hover:bg-blue-50 hover:text-blue-400 dark:border-blue-600 dark:bg-gray-800 dark:hover:bg-blue-900/20 dark:text-blue-400 dark:hover:text-blue-300",
        secondary:
          "bg-blue-50 text-blue-400 shadow-sm hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30",
        ghost: "hover:bg-blue-50 hover:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400",
        link: "text-blue-400 underline-offset-4 hover:underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? "span" : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
export default Button
