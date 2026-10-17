import { FC, useCallback } from 'react';
import { SignaturesComponent } from '@gitroom/frontend/components/settings/signatures.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const SignatureBox: FC<{
  editor: any;
}> = ({ editor }) => {
  const modals = useModals();
  const appendValue = (val: string) => {
    editor?.commands?.insertContent('\n\n' + val);
    editor?.commands?.focus();
  };

  const addSignature = useCallback(() => {
    modals.openModal({
      title: 'Add Signature',
      withCloseButton: true,
      classNames: { modal: 'po-sign-modal' },
      children: (close) => (
        <SignatureModal appendSignature={appendValue} close={close} />
      ),
    });
  }, [appendValue]);

  return (
    <>
      <button
        type="button"
        onClick={addSignature}
        data-tooltip-id="tooltip"
        data-tooltip-content="Add signature"
        aria-label="Add signature"
        className="c8-tool select-none cursor-pointer rounded-[6px] flex justify-center items-center"
      >
        <HugeIcon name="pencil" size={18} />
      </button>
    </>
  );
};
export const SignatureModal: FC<{
  close: () => void;
  appendSignature: (sign: string) => void;
}> = (props) => {
  const { appendSignature } = props;
  return <SignaturesComponent appendSignature={appendSignature} />;
};
