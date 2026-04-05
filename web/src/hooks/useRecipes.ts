import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipesApi } from '../config/api';

export function useRecipes(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => recipesApi.list(params),
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipes', id],
    queryFn: () => recipesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recipesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => recipesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recipesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useSearchRecipes(params: Record<string, string>) {
  return useQuery({
    queryKey: ['recipes', 'search', params],
    queryFn: () => recipesApi.search(params),
    enabled: Object.values(params).some((v) => v.length > 0),
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
