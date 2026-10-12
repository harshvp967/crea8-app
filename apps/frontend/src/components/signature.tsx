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
      children: (close) => (
        <SignatureModal appendSignature={appendValue} close={close} />
      ),
    });
  }, [appendValue]);

  return (
    <>
      <div
        onClick={addSignature}
        data-tooltip-id="tooltip"
        data-tooltip-content="Add Signature"
        className="select-none cursor-pointer rounded-[6px] w-[30px] h-[30px] bg-newColColor flex justify-center items-center"
      >
        <HugeIcon name="pencil" size={18} />
      </div>
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
