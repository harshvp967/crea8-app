'use client';

import { FC, useEffect, useState } from 'react';
import { Select } from '@gitroom/react/form/select';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { SelectSkeleton } from '@gitroom/frontend/components/ui/skeleton';
export const WordpressPostType: FC<{
  name: string;
  onChange: (event: {
    target: {
      value: string;
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name } = props;
  const t = useT();
  const customFunc = useCustomProviderFunction();
  const [orgs, setOrgs] = useState<any[] | undefined>(undefined);
  const { getValues } = useSettings();
  const [currentMedia, setCurrentMedia] = useState<string | undefined>();
  const onChangeInner = (event: {
    target: {
      value: string;
      name: string;
    };
  }) => {
    setCurrentMedia(event.target.value);
    onChange(event);
  };
  useEffect(() => {
    customFunc.get('postTypes').then((data) => setOrgs(Array.isArray(data) ? data : [])).catch(() => setOrgs([]));
    const settings = getValues()[props.name];
    if (settings) {
      setCurrentMedia(settings);
    }
  }, []);
  if (!orgs) {
    return <SelectSkeleton />;
  }
  if (!orgs.length) {
    return null;
  }
  return (
    <Select
      name={name}
      label="Select type"
      onChange={onChangeInner}
      value={currentMedia}
    >
      <option value="">{t('select_1', '--Select--')}</option>
      {orgs.map((org: any) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </Select>
  );
};
