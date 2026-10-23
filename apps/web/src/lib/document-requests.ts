import { useQuery } from '@tanstack/react-query';
import type { DocumentHealthDTO, DocumentRequestDTO } from '@tamas/shared';
import { api } from './api';
import { useAuth } from '../store/auth';

export function useDocumentHealth() {
  const userId = useAuth((state) => state.user?.id);
  return useQuery({ queryKey: ['document-health', userId], queryFn: () => api.get<{ items: DocumentHealthDTO[] }>('/admin/document-health'), staleTime: 15_000, enabled: Boolean(userId) });
}
export function useDocumentRequests() {
  const userId = useAuth((state) => state.user?.id);
  return useQuery({ queryKey: ['document-requests', userId], queryFn: () => api.get<{ items: DocumentRequestDTO[] }>('/document-requests'), staleTime: 15_000, refetchInterval: 60_000, enabled: Boolean(userId) });
}
export const documentHasIssue = (item: DocumentHealthDTO) => !item.resolved && (item.availability !== 'available' || (item.thumbnailAvailability !== null && item.thumbnailAvailability !== 'available'));
