import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/lib/auth-context'
import { User, Building, Bell, Shield, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

// Zod schemas for validation
const userProfileSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
})

const companySettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  defaultWarehouse: z.string().min(1, 'Default warehouse is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})

const notificationsSchema = z.object({
  grnNotifications: z.boolean(),
  deliveryUpdates: z.boolean(),
  lowStockAlerts: z.boolean(),
})

const securitySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Mock mutation functions
  const updateUserProfile = useMutation({
    mutationFn: async (data: z.infer<typeof userProfileSchema>) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return data
    },
    onSuccess: () => {
      setSuccessMessage('Profile updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
  })

  const updateCompanySettings = useMutation({
    mutationFn: async (data: z.infer<typeof companySettingsSchema>) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return data
    },
    onSuccess: () => {
      setSuccessMessage('Company settings updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
  })

  const updateNotifications = useMutation({
    mutationFn: async (data: z.infer<typeof notificationsSchema>) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      return data
    },
    onSuccess: () => {
      setSuccessMessage('Notification preferences updated')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
  })

  const updatePassword = useMutation({
    mutationFn: async (data: z.infer<typeof securitySchema>) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return data
    },
    onSuccess: () => {
      setSuccessMessage('Password updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      {successMessage && (
        <div className="rounded-lg border bg-green-500/10 border-green-500/20 text-green-600 px-4 py-3">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <UserProfileCard
          user={user}
          onSubmit={updateUserProfile.mutateAsync}
          isSubmitting={updateUserProfile.isPending}
        />

        <CompanySettingsCard
          onSubmit={updateCompanySettings.mutateAsync}
          isSubmitting={updateCompanySettings.isPending}
        />

        <NotificationsCard
          onSubmit={updateNotifications.mutateAsync}
          isSubmitting={updateNotifications.isPending}
        />

        <SecurityCard
          onSubmit={updatePassword.mutateAsync}
          isSubmitting={updatePassword.isPending}
        />
      </div>
    </div>
  )
}

function UserProfileCard({
  user,
  onSubmit,
  isSubmitting,
}: {
  user: { name: string; email: string; role: string } | null
  onSubmit: (data: z.infer<typeof userProfileSchema>) => Promise<unknown>
  isSubmitting: boolean
}) {
  const form = useForm({
    defaultValues: {
      name: user?.name || '',
    },
    validators: {
      onBlur: userProfileSchema,
      onSubmit: userProfileSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Profile
        </CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={user?.role || ''}
              disabled
              className="capitalize"
            />
            <p className="text-xs text-muted-foreground">
              Contact administrator to change roles
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CompanySettingsCard({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: z.infer<typeof companySettingsSchema>) => Promise<unknown>
  isSubmitting: boolean
}) {
  const form = useForm({
    defaultValues: {
      companyName: 'SME Ederan',
      defaultWarehouse: 'Main Warehouse',
      timezone: 'Asia/Kuala Lumpur',
    },
    validators: {
      onBlur: companySettingsSchema,
      onSubmit: companySettingsSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Company Settings
        </CardTitle>
        <CardDescription>
          Configure warehouse locations and settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field name="companyName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="defaultWarehouse">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="warehouse">Default Warehouse</Label>
                <Input
                  id="warehouse"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="timezone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function NotificationsCard({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: z.infer<typeof notificationsSchema>) => Promise<unknown>
  isSubmitting: boolean
}) {
  const form = useForm({
    defaultValues: {
      grnNotifications: true,
      deliveryUpdates: true,
      lowStockAlerts: true,
    },
    validators: {
      onSubmit: notificationsSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>Manage your notification preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field name="grnNotifications">
            {(field) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">GRN Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive alerts for new GRN entries
                  </p>
                </div>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </form.Field>

          <Separator />

          <form.Field name="deliveryUpdates">
            {(field) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delivery Updates</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified about delivery status changes
                  </p>
                </div>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </form.Field>

          <Separator />

          <form.Field name="lowStockAlerts">
            {(field) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Low Stock Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Alert when inventory is below threshold
                  </p>
                </div>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SecurityCard({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: z.infer<typeof securitySchema>) => Promise<unknown>
  isSubmitting: boolean
}) {
  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validators: {
      onBlur: securitySchema,
      onSubmit: securitySchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
      // Reset form after successful submission
      form.reset()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
        <CardDescription>Manage your account security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="newPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
