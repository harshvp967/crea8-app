'use client';

import { FC, useEffect, useState } from 'react';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { Select } from '@gitroom/react/form/select';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SelectSkeleton } from '@gitroom/frontend/components/ui/skeleton';
export const SkoolLabelSelect: FC<{
  name: string;
  groupId: string | undefined;
  onChange: (event: {
    target: {
      value: string;
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name, groupId } = props;
  const t = useT();
  const customFunc = useCustomProviderFunction();
  const [labels, setLabels] = useState<any[] | undefined>(undefined);
  const { getValues } = useSettings();
  const [currentLabel, setCurrentLabel] = useState<string | undefined>();
  const onChangeInner = (event: {
    target: {
      value: string;
      name: string;
    };
  }) => {
    setCurrentLabel(event.target.value);
    onChange(event);
  };
  useEffect(() => {
    if (!groupId) {
      setLabels([]);
      setCurrentLabel(undefined);
      return;
    }
    setLabels(undefined);
    customFunc
      .get('label', { id: groupId })
      .then((data) => setLabels(Array.isArray(data) ? data : []))
      .catch(() => setLabels([]));
  }, [groupId]);
  useEffect(() => {
    const settings = getValues()[name];
    if (settings) {
      setCurrentLabel(settings);
    }
  }, []);
  if (!groupId || (labels && !labels.length)) {
    return null;
  }
  if (!labels) {
    return <SelectSkeleton />;
  }
  return (
    <Select
      name={name}
      label="Select Label"
      onChange={onChangeInner}
      value={currentLabel}
    >
      <option value="">{t('select_1', '--Select--')}</option>
      {labels.map((label: any) => (
        <option key={label.id} value={label.id}>
          {label.name}
        </option>
      ))}
    </Select>
  );
};
