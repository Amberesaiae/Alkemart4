import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { auth } from "../lib/api"
import { useNavigate } from "@tanstack/react-router"

export function useAuth() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: auth.getSession,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: Record<string, string>) => auth.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] })
      navigate({ to: "/analytics" })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(["session"], null)
      navigate({ to: "/login" })
    },
  })

  return {
    session,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
  }
}
