import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react';

export const Route = createFileRoute('/')({ component: App, })

function App() {

  useEffect(() => {
    console.log('redirecting to /login')
    throw redirect({ to: '/login' })
  }, [])

  return null;
}
