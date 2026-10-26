import { FC, ReactNode, useEffect, useRef } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const ModalWrapperComponent: FC<{
  title: string;
  children: ReactNode;
  customClose?: () => void;
  ask?: boolean;
}> = ({ title, children, ask, customClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const modal = useModals();
  const t = useT();
  const closeModal = async () => {
    if (
      ask &&
      !(await deleteDialog(
        '',
        t('close', 'Close'),
        t('close_this_window', 'Close this window?'),
        t('cancel', 'Cancel'),
        'primary'
      ))
    ) {
      return;
    }

    if (customClose) {
      customClose();
      return;
    }

    modal.closeAll();
  };

  useEffect(() => {
    ref?.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, []);

  return (
    <>
      <div className="relative">
        <div className="absolute -top-[30px] left-0" ref={ref} />
      </div>
      <div
        className="p-[32px] flex flex-col text-newTextColor bg-newBgColorInner rounded-[24px]"
      >
        <div className="flex items-start mb-[24px]">
          <div className="flex-1 text-[24px]">{title}</div>
          <div className="cursor-pointer" onClick={closeModal}>
            <HugeIcon name="close" size={20} />
          </div>
        </div>
        <div>{children}</div>
      </div>
    </>
  );
};
