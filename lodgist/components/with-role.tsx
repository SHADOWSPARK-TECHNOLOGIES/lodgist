import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import React, { useEffect } from "react"
import { useRole } from "@/hooks/use-role"

interface WithRoleOptions {
  allowedRoles: string[]
  redirectPath?: string
}

const withRole = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithRoleOptions,
) => {
  const ComponentWithRole = (props: P) => {
    const { allowedRoles, redirectPath = "/403" } = options
    const { role, isLoading } = useRole()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && (!role || !allowedRoles.includes(role))) {
        router.push(redirectPath)
      }
    }, [isLoading, role, allowedRoles, redirectPath, router])

    if (isLoading || !role || !allowedRoles.includes(role)) {
      return <div>Loading or Unauthorized...</div> // Or a loading spinner
    }

    return <WrappedComponent {...props} />
  }

  return ComponentWithRole
}

export default withRole