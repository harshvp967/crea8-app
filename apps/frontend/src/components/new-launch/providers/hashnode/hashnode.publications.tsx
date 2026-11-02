'use client';

import { FC, useEffect, useState } from 'react';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { Select } from '@gitroom/react/form/select';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SelectSkeleton } from '@gitroom/frontend/components/ui/skeleton';
export const HashnodePublications: FC<{
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
  const [publications, setOrgs] = useState<any[] | undefined>(undefined);
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
    customFunc.get('publications').then((data) => setOrgs(Array.isArray(data) ? data : [])).catch(() => setOrgs([]));
    const settings = getValues()[props.name];
    if (settings) {
      setCurrentMedia(settings);
    }
  }, []);
  if (!publications) {
    return <SelectSkeleton />;
  }
  if (!publications.length) {
    return null;
  }
  return (
    <Select
      name={name}
      label="Select publication"
      onChange={onChangeInner}
      value={currentMedia}
    >
      <option value="">{t('select_1', '--Select--')}</option>
      {(publications || []).map((publication: any) => (
        <option key={publication.id} value={publication.id}>
          {publication.name}
        </option>
      ))}
    </Select>
  );
};
