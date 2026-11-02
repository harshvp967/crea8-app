'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { ReactTags } from 'react-tag-autocomplete';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { SelectSkeleton } from '@gitroom/frontend/components/ui/skeleton';
export const DevtoTags: FC<{
  name: string;
  label: string;
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name, label } = props;
  const form = useSettings();
  const customFunc = useCustomProviderFunction();
  const [tags, setTags] = useState<any[] | undefined>(undefined);
  const { getValues } = useSettings();
  const [tagValue, setTagValue] = useState<any[]>([]);
  const onDelete = useCallback(
    (tagIndex: number) => {
      const modify = tagValue.filter((_, i) => i !== tagIndex);
      setTagValue(modify);
      form.setValue(name, modify);
    },
    [tagValue, name, form]
  );
  const onAddition = useCallback(
    (newTag: any) => {
      if (tagValue.length >= 4) {
        return;
      }
      const modify = [...tagValue, newTag];
      setTagValue(modify);
      form.setValue(name, modify);
    },
    [tagValue, name, form]
  );
  useEffect(() => {
    customFunc.get('tags').then((data) => setTags(Array.isArray(data) ? data : [])).catch(() => setTags([]));
    const settings = getValues()[props.name];
    if (settings) {
      setTagValue(settings);
    }
  }, []);
  if (!tags) {
    return <SelectSkeleton />;
  }
  if (!tags.length) {
    return null;
  }
  return (
    <div>
      <div className={`text-[14px] mb-[6px]`}>{label}</div>
      <ReactTags
        suggestions={tags}
        selected={tagValue}
        onAdd={onAddition}
        onDelete={onDelete}
      />
    </div>
  );
};
