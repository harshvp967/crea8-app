import React, { useMemo, useRef, useState } from 'react';
import { useCopilotChatInternal } from '@copilotkit/react-core';
import AutoResizingTextarea from '@gitroom/frontend/components/agents/agent.textarea';
import { useChatContext, InputProps } from '@copilotkit/react-ui';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const MAX_NEWLINES = 6;

export const Input = ({
  inProgress,
  onSend,
  isVisible = false,
  onStop,
  onUpload,
  hideStopButton = false,
  onChange,
  onAttach,
}: InputProps & { onChange: (value: string) => void; onAttach?: () => void }) => {
  const context = useChatContext();
  const t = useT();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // If the user clicked a button or inside a button, don't focus the textarea
    if (target.closest('button')) return;

    // If the user clicked the textarea, do nothing (it's already focused)
    if (target.tagName === 'TEXTAREA') return;

    // Otherwise, focus the textarea
    textareaRef.current?.focus();
  };

  const [text, setText] = useState('');
  const send = () => {
    if (inProgress) return;
    onSend(text);
    setText('');

    textareaRef.current?.focus();
  };

  const isInProgress = inProgress;
  const buttonIcon =
    isInProgress && !hideStopButton ? (
      context.icons.stopIcon
    ) : (
      <HugeIcon name="send" size={18} />
    );

  const { interrupt } = useCopilotChatInternal();
  const canSend = useMemo(() => {
    return !isInProgress && text.trim().length > 0 && !interrupt;
  }, [interrupt, isInProgress, text]);

  const canStop = useMemo(() => {
    return isInProgress && !hideStopButton;
  }, [isInProgress, hideStopButton]);

  const sendDisabled = !canSend && !canStop;

  return (
    <div className="copilotKitInputContainer">
      <div className="copilotKitInput" onClick={handleDivClick}>
        <button
          type="button"
          className="agent-attach"
          aria-label={t('attachments', 'Attachments')}
          onClick={onAttach || onUpload}
        >
          <HugeIcon name="attachment" size={18} />
        </button>
        <AutoResizingTextarea
          ref={textareaRef}
          placeholder={context.labels.placeholder}
          autoFocus={false}
          maxRows={MAX_NEWLINES}
          value={text}
          onChange={(event) => {
            onChange(event.target.value);
            setText(event.target.value);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
              event.preventDefault();
              if (canSend) {
                send();
              }
            }
          }}
        />
        <button
          disabled={sendDisabled}
          onClick={isInProgress && !hideStopButton ? onStop : send}
          data-copilotkit-in-progress={inProgress}
          data-test-id={
            inProgress
              ? 'copilot-chat-request-in-progress'
              : 'copilot-chat-ready'
          }
          className="copilotKitInputControlButton agent-send"
        >
          {buttonIcon}
        </button>
      </div>
    </div>
  );
};
