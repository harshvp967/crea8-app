'use client';

import { Button } from '@gitroom/react/form/button';
import React, { FC } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PostComment } from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const AddPostButton: FC<{
  onClick: () => void;
  num: number;
  postComment: PostComment;
}> = (props) => {
  const { onClick, num } = props;
  const t = useT();

  return (
    <div className="flex">
      <div
        onClick={onClick}
        className="po-add-row select-none cursor-pointer flex text-textColor gap-[8px] items-center py-[4px] text-[14px] font-[500]"
      >
        <div>
          <HugeIcon name="plus" size={16} />
        </div>
        <div>
          {t(
            ...(props.postComment === PostComment.ALL
              ? ['add_comment_or_post', 'Add comment']
              : props.postComment === PostComment.POST
              ? ['add_post', 'Add post']
              : ['add_comment', 'Add comment'])
          )}
        </div>
      </div>
    </div>
  );
};
