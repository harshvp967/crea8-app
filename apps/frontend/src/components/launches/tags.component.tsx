'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import { ReactTags } from 'react-tag-autocomplete';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Input } from '@gitroom/react/form/input';
import { ColorPicker } from '@gitroom/react/form/color.picker';
import { Button } from '@gitroom/react/form/button';
import { uniqBy } from 'lodash';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  TagIcon,
  DropdownArrowIcon,
  PlusIcon,
  CheckmarkIcon,
} from '@gitroom/frontend/components/ui/icons';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const TagsComponent: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const fetch = useFetch();

  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('load-tags', loadTags);

  if (isLoading) {
    return null;
  }

  return <TagsComponentInner {...props} allTags={data} mutate={mutate} />;
};

export const TagsComponentInner: FC<{
  name: string;
  label: string;
  initial: any[];
  allTags: any;
  mutate: () => Promise<any>;
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = ({ initial, onChange, name, mutate, allTags: data, label }) => {
  const t = useT();
  const fetch = useFetch();
  const [isOpen, setIsOpen] = useState(false);
  const [allowClose, setAllowClose] = useState(true);
  const [tagQuery, setTagQuery] = useState('');
  const [tagValue, setTagValue] = useState<any[]>(
    (initial?.slice(0) || []).map((p: any) => {
      return data?.tags.find((a: any) => a.name === p.value) || p;
    })
  );
  const modals = useModals();

  const ref = useClickOutside(() => {
    if (!isOpen || !allowClose) {
      return;
    }
    setIsOpen(false);
  });

  const addTag = useCallback(async () => {
    const val: string | undefined = await new Promise((resolve) => {
      modals.openModal({
        title: t('add_new_tag', 'Add New Tag'),
        classNames: { modal: 'po-tag-modal' },
        children: (close) => (
          <ShowModal tag="" close={close} resolve={resolve} />
        ),
      });
    });

    const newValues = await mutate();

    if (!val) {
      return;
    }

    const newTag = newValues.tags.find((p: any) => p.name === val);
    if (newTag) {
      const modify = [...tagValue, newTag];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    }
  }, []);

  const deleteTag = useCallback(
    async (tag: any, e: React.MouseEvent) => {
      setAllowClose(false);
      e.stopPropagation();
      const confirmed: boolean = await new Promise((resolve) => {
        modals.openModal({
          title: t('delete_tag', 'Delete Tag'),
          children: (close) => (
            <ConfirmDeleteModal
              tagName={tag.name}
              close={close}
              resolve={resolve}
            />
          ),
        });
      });

      if (!confirmed) {
        setTimeout(() => {
          setAllowClose(true);
        }, 500);
        return;
      }

      await fetch(`/posts/tags/${tag.id}`, {
        method: 'DELETE',
      });

      // Remove the tag from current selection if it was selected
      const modify = tagValue.filter((a) => a.id !== tag.id);
      if (modify.length !== tagValue.length) {
        setTagValue(modify);
        onChange({
          target: {
            value: modify.map((p: any) => ({
              label: p.name,
              value: p.name,
            })),
            name,
          },
        });
      }

      await mutate();

      setTimeout(() => {
        setAllowClose(true);
      }, 500);
    },
    [tagValue, name, onChange, mutate, fetch, modals, t]
  );

  return (
    <div
      ref={ref}
      className={clsx(
        'po-tags border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] select-none',
        isOpen ? 'border-[#00D9FF] bg-[#00D9FF]/10' : 'border-newTextColor/10'
      )}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-[16px] justify-center flex gap-[8px] items-center h-full select-none flex-1"
      >
        <div className="cursor-pointer">
          <TagIcon />
        </div>
        <div className="cursor-pointer flex gap-[6px] items-center min-w-0">
          {tagValue.length === 0 ? (
            label
          ) : (
            <>
              <span
                className="po-tag-dot"
                style={{ background: tagValue[0].color }}
              />
              <span className="whitespace-nowrap">{tagValue[0].name}</span>
              {tagValue.length > 1 ? <span>+{tagValue.length - 1}</span> : null}
            </>
          )}
        </div>
        <div className="cursor-pointer">
          <DropdownArrowIcon rotated={isOpen} />
        </div>
      </div>
      {isOpen && (
        <div className="po-tags-menu z-[300] absolute start-0 bottom-[calc(100%+8px)] flex flex-col">
          <label className="po-tag-search">
            <HugeIcon name="search" size={16} />
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder={t('search_tags', 'Search tags')}
            />
          </label>
          {(data?.tags || [])
            .filter((p: any) =>
              p.name.toLowerCase().includes(tagQuery.trim().toLowerCase())
            )
            .map((p: any) => {
              const selected = !!tagValue.find((a) => a.id === p.id);
              return (
                <div
                  onClick={() => {
                    const modify = selected
                      ? tagValue.filter((a) => a.id !== p.id)
                      : [...tagValue, p];
                    setTagValue(modify);
                    onChange({
                      target: {
                        value: modify.map((item: any) => ({
                          label: item.name,
                          value: item.name,
                        })),
                        name,
                      },
                    });
                  }}
                  key={p.name}
                  className={clsx('po-menu-row', selected && 'is-on')}
                >
                  <span className="po-tag-dot" style={{ background: p.color }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {selected && <CheckmarkIcon className="text-[#00D9FF]" />}
                  <button
                    type="button"
                    className="po-tag-pen"
                    aria-label={t('edit', 'Edit')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllowClose(false);
                      new Promise((resolve) => {
                        modals.openModal({
                          title: t('add_new_tag', 'Add New Tag'),
                          classNames: { modal: 'po-tag-modal' },
                          children: (close) => (
                            <ShowModal
                              tag={p.name}
                              color={p.color}
                              id={p.id}
                              close={close}
                              resolve={resolve as (value: string) => void}
                            />
                          ),
                        });
                      }).then(async (val) => {
                        const next = await mutate();
                        if (val && selected) {
                          const renamed = (next?.tags || []).find(
                            (item: any) => item.name === val
                          );
                          if (renamed) {
                            const modify = tagValue.map((item) =>
                              item.id === p.id ? renamed : item
                            );
                            setTagValue(modify);
                            onChange({
                              target: {
                                value: modify.map((item: any) => ({
                                  label: item.name,
                                  value: item.name,
                                })),
                                name,
                              },
                            });
                          }
                        }
                        setTimeout(() => setAllowClose(true), 500);
                      });
                    }}
                  >
                    <HugeIcon name="pencil" size={14} />
                  </button>
                  {!selected && (
                    <button
                      type="button"
                      className="po-tag-pen"
                      aria-label={t('delete', 'Delete')}
                      onClick={(e) => deleteTag(p, e)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          <div onClick={addTag} className="po-menu-row po-add-tag">
            <PlusIcon />
            <span>{t('add_a_tag', 'Add a tag')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const TagsComponentA: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name, initial } = props;
  const fetch = useFetch();
  const [tagValue, setTagValue] = useState<any[]>(initial?.slice(0) || []);
  const [suggestions, setSuggestions] = useState<string>('');
  const [showModal, setShowModal] = useState<any>(false);
  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);
  const { isLoading, data, mutate } = useSWR<{
    tags: {
      name: string;
      color: string;
    }[];
  }>('tags', loadTags, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const onDelete = useCallback(
    (tagIndex: number) => {
      const modify = tagValue.filter((_, i) => i !== tagIndex);
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue]
  );
  const createNewTag = useCallback(
    async (newTag: any) => {
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: newTag.value,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      return val;
    },
    [mutate]
  );
  const edit = useCallback(
    (tag: any) => async (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: tag.name,
          color: tag.color,
          id: tag.id,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      const modify = tagValue.map((t) => {
        if (t.label === tag.name) {
          return {
            value: val,
            label: val,
          };
        }
        return t;
      });
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );
  const onAddition = useCallback(
    async (newTag: any) => {
      if (tagValue.length >= 3) {
        return;
      }
      const getTag = data?.tags?.find((f) => f.name === newTag.label)
        ? newTag.label
        : await createNewTag(newTag);
      const modify = [
        ...tagValue,
        {
          value: getTag,
          label: getTag,
        },
      ];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );

  // useEffect(() => {
  //   const settings = getValues()[props.name];
  //   if (settings) {
  //     setTagValue(settings);
  //   }
  // }, []);

  const suggestionsArray = useMemo(() => {
    return uniqBy<{
      label: string;
      value: string;
    }>(
      [
        ...(data?.tags.map((p) => ({
          label: p.name,
          value: p.name,
        })) || []),
        ...tagValue,
        {
          label: suggestions,
          value: suggestions,
        },
      ].filter((f) => f.label),
      (o) => o.label
    );
  }, [suggestions, tagValue]);

  const t = useT();

  if (isLoading) {
    return null;
  }
  return (
    <>
      {showModal && <ShowModal {...showModal} />}
      <div className="flex-1 flex tags-top">
        <ReactTags
          placeholderText={t('add_a_tag', 'Add a tag')}
          suggestions={suggestionsArray}
          selected={tagValue}
          onAdd={onAddition}
          onInput={setSuggestions}
          onDelete={onDelete}
          renderTag={(tag) => {
            const findTag = data?.tags?.find((f) => f.name === tag.tag.label);
            const findIndex = tagValue.findIndex(
              (f) => f.label === tag.tag.label
            );
            return (
              <div
                className={`min-w-[50px] float-left ms-[4px] p-[3px] rounded-sm relative`}
                style={{
                  backgroundColor: findTag?.color,
                }}
              >
                <div
                  className="absolute -top-[5px] start-[10px] text-[12px] text-red-600 bg-white px-[3px] rounded-full"
                  onClick={edit(findTag)}
                >
                  {t('edit', 'Edit')}
                </div>
                <div
                  className="absolute -top-[5px] -start-[5px] text-[12px] text-red-600 bg-white px-[3px] rounded-full"
                  onClick={() => onDelete(findIndex)}
                >
                  X
                </div>
                <div className="text-white mix-blend-difference">
                  {tag.tag.label}
                </div>
              </div>
            );
          }}
        />
      </div>
    </>
  );
};
const ConfirmDeleteModal: FC<{
  tagName: string;
  close: () => void;
  resolve: (value: boolean) => void;
}> = ({ tagName, close, resolve }) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-[16px]">
      <p className="text-[14px]">
        {t(
          'confirm_delete_tag',
          'Are you sure you want to delete the tag "{{tagName}}"?',
          { tagName }
        )}
      </p>
      <div className="flex gap-[8px] justify-end">
        <Button
          onClick={() => {
            resolve(false);
            close();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={() => {
            resolve(true);
            close();
          }}
          className="bg-red-500 hover:bg-red-600"
        >
          {t('delete', 'Delete')}
        </Button>
      </div>
    </div>
  );
};

const ShowModal: FC<{
  tag: string;
  color?: string;
  id?: string;
  close: () => void;
  resolve: (value: string) => void;
}> = (props) => {
  const t = useT();

  const { close, tag, resolve, color: theColor, id } = props;
  const fetch = useFetch();
  const [color, setColor] = useState<string>(theColor || '#942828');
  const [tagName, setTagName] = useState<string>(tag);
  const save = useCallback(async () => {
    await fetch(id ? `/posts/tags/${id}` : '/posts/tags', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: tagName,
        color,
      }),
    });
    resolve(tagName);
    close();
  }, [tagName, color, id]);
  const swatches = ['#00D9FF', '#4ADE80', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'];
  return (
    <div className="po-new-tag">
      <Input
        name="name"
        disableForm={true}
        label={t('tag_name', 'Name')}
        value={tagName}
        onChange={(e) => setTagName(e.target.value)}
      />
      <div className="po-swatches">
        <div className="text-[14px] mb-[8px]">{t('label_tag_color', 'Tag Color')}</div>
        <div className="flex gap-[8px] flex-wrap">
          {swatches.map((swatch) => (
            <button
              type="button"
              key={swatch}
              aria-label={swatch}
              onClick={() => setColor(swatch)}
              className={clsx('po-swatch', color.toLowerCase() === swatch.toLowerCase() && 'is-on')}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </div>
      <ColorPicker
        onChange={(e) => setColor(e.target.value)}
        label=""
        name="color"
        value={color}
        enabled={true}
        canBeCancelled={false}
      />
      <div className="po-tag-actions">
        <Button
          secondary
          onClick={() => {
            resolve('');
            close();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
        <Button onClick={save} className="po-tag-save">
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};
