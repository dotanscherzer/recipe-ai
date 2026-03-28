import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { savedRecipesApi } from '../config/api';

export function useSavedRecipes() {
  return useQuery({
    queryKey: ['saved-recipes'],
    queryFn: savedRecipesApi.list,
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savedRecipesApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateSavedRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => savedRecipesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-recipes'] }),
  });
}

export function useDeleteSavedRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savedRecipesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}
