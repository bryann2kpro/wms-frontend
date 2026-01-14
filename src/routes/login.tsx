import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { authenticateUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

function RouteComponent() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        const user = authenticateUser(value.email, value.password)
        if (user) {
          login(user)
          navigate({ to: '/' })
        } else {
          setError('Invalid email or password')
        }
      } catch (err) {
        setError('An error occurred during login')
      }
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-slate-800 bg-clip-text text-transparent">
            SME Ederan WMS
          </CardTitle>
          <CardDescription className="text-center text-base">
            Enter your credentials to access the warehouse system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field
              name="email"
              validators={{
                onBlur: ({ value }) => {
                  const result = loginSchema.shape.email.safeParse(value)
                  return result.success ? undefined : result.error.issues[0]?.message
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name} className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="admin@ederan.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={form.state.isSubmitting}
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="pl-9 transition-all duration-200"
                    />
                  </div>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onBlur: ({ value }) => {
                  const result = loginSchema.shape.password.safeParse(value)
                  return result.success ? undefined : result.error.issues[0]?.message
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.name} className="text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id={field.name}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={form.state.isSubmitting}
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="pl-9 pr-10 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={0}
                      disabled={form.state.isSubmitting}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {error && (
              <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe
              selector={(state) => [state.isSubmitting, state.canSubmit]}
            >
              {([isSubmitting, canSubmit]) => (
                <Button
                  type="submit"
                  className="w-full mt-6 h-10 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              )}
            </form.Subscribe>

            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <p className="font-semibold mb-3 text-foreground">Demo accounts:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">👤</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Admin:</span> admin@smee.com.my / demo123
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">👤</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Finance:</span> finance@smee.com.my / demo123
                  </span>
                </li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
