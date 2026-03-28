import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../config/api';

export function useAiGenerate() {
  return useMutation({ mutationFn: aiApi.generate });
}

export function useAiModify() {
  return useMutation({ mutationFn: aiApi.modify });
}

export function useAiImportText() {
  return useMutation({ mutationFn: aiApi.importText });
}

export function useAiImportUrl() {
  return useMutation({ mutationFn: aiApi.importUrl });
}

export function useAiImportImage() {
  return useMutation({ mutationFn: aiApi.importImage });
}

export function useAiChat() {
  return useMutation({ mutationFn: aiApi.chat });
}
