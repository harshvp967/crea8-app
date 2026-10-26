import i18next from '@gitroom/react/translation/i18next';
import { areYouSure } from '@gitroom/frontend/components/layout/new-modal';

export const deleteDialog = async (
  message: string,
  confirmButton?: string,
  title?: string,
  cancelButton?: string,
  tone?: 'danger' | 'primary'
) => {
  const heading = (title || '').trim();
  const body = (message || '').trim();
  return areYouSure({
    title: heading || body,
    description: heading && body && body !== heading ? body : '',
    approveLabel: confirmButton || i18next.t('delete', 'Delete'),
    cancelLabel: cancelButton || i18next.t('cancel', 'Cancel'),
    tone: tone ?? 'destructive',
  });
};
